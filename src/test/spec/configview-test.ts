import { expect } from 'chai';
import { Workbench, VSBrowser, WebView, By, EditorView, WebDriver, WebElement } from 'vscode-extension-tester';
import * as testenv from './testenv';
import { MenuConfig } from './menuconfig';
import { scrollIntoView } from './helper';

describe('SDK Configuration', async () => {
    let view: WebView;

    before(async () => {
        const title = await new Workbench().getTitleBar().getTitle();
        if (title.indexOf('spresnese') >= 0) {
            return;
        }

        const browser = VSBrowser.instance;
        await browser.openResources(testenv.sdkPath);
        await browser.driver.wait(async () => {
            const notifications = await new Workbench().getNotifications();
            for (const notification of notifications) {
                const message = await notification.getMessage();
                return message.indexOf('Spresense') >= 0;
            }
        }, 5000);
    });

    after(async () => {
        await view?.switchBack();
    });

    describe('Open Configuration', async () => {
        before(async () => {
            await new EditorView().closeAllEditors();
        });

        it('from command palette', async () => {
            const bench = new Workbench();
            const driver = VSBrowser.instance.driver;
            await bench.executeCommand('spresensesdkconfig');
            driver.sleep(1000);
            view = new WebView();
            expect(await view.getTitle()).has.string('SDK Config');

            await view.switchToFrame();

            // Wait for configuration setup is done.
            // If taking a long time to open configuration editor, it is fail.
            await driver.wait(async () => {
                const progress = await view.findWebElement(By.id('progress'));
                return !await progress.isDisplayed();
            }, 300000);
        });
    });

    describe('Menu type config test', async () => {
        it('Open/Close a menu', async () => {
            // Open the menu config and check that inside configuration has been shown,
            // and close the menu config and check that inside configration has been hidden.
            let menu = await new MenuConfig('Build Setup').build();
            expect(menu).to.exist;
            await menu?.open();
            await new Promise(res => setTimeout(res, 1000));
            let config = await view.findWebElement(By.id('EXPERIMENTAL'));
            expect(await config.isDisplayed()).to.be.true;
            await menu?.close();
            expect(await config.isDisplayed()).to.be.false;
        });
    });

    describe('Bool type config test', async () => {
        let menu: MenuConfig;
        const relatedConfigs = [
            // nuttx/Kconfig (related by if .. endif section)
            'DEBUG_ERROR',
            'DEBUG_ASSERTIONS',
            'DEBUG_BINFMT',
            'DEBUG_FS',
            'DEBUG_GRAPHICS',
            'DEBUG_LIB',
            'DEBUG_MM',
            'DEBUG_NET',
            'DEBUG_POWER',
            'DEBUG_SCHED',
            'DEBUG_DMA',
            'DEBUG_IRQ',
            'DEBUG_LEDS',
            'DEBUG_GPIO',
            'DEBUG_I2C',
            'DEBUG_PWM',
            'DEBUG_RTC',
            'DEBUG_MEMCARD',
            'DEBUG_SPI',
            'DEBUG_TIMER',
            'DEBUG_USB',
            'DEBUG_WATCHDOG',
            'DEBUG_CHILDSTATUS'
        ];

        before(async () => {
            menu = await new MenuConfig('Build Setup').build();
            await menu?.open();
            let submenu = await new MenuConfig('Debug Options').build();
            await submenu?.open();
        });

        after(async () => {
            await menu?.close();
        });

        it('Bool click (N -> Y)', async () => {
            const label = await view.findWebElement(By.css('#DEBUG_FEATURES > label'));
            const span = await view.findWebElement(By.css('#DEBUG_FEATURES > label > span'));
            const input = await view.findWebElement(By.css('#DEBUG_FEATURES > label > input'));
            await scrollIntoView(label);
            await span.click();
            expect(await input.getAttribute('checked')).to.equal('true');

            //await new Promise(res => setTimeout(res, 10000));
        });

        it('Related options should be visible if Y', async () => {
            // Check the visibility of related config options.
            // Do not use isDisplay() method because the part of the options are not visible
            // by parent menu shrunken.
            for (let id of relatedConfigs) {
                const config = await view.findWebElement(By.id(id));
                const cn = await config.getAttribute('class');
                expect(cn).to.not.contains('visible');
            }
            await new Promise(res => setTimeout(res, 500));
        });

        it('Bool click (Y -> N)', async () => {
            // This function code is the same as above because bool option operation is just click
            // the button.
            const label = await view.findWebElement(By.css('#DEBUG_FEATURES > label'));
            const span = await view.findWebElement(By.css('#DEBUG_FEATURES > label > span'));
            const input = await view.findWebElement(By.css('#DEBUG_FEATURES > label > input'));
            await scrollIntoView(label);
            await span.click();
            expect(await input.getAttribute('checked')).to.not.exist;
        });

        it('Related options should be invisible if N', async () => {
            for (let id of relatedConfigs) {
                const config = await view.findWebElement(By.id(id));
                const cn = await config.getAttribute('class');
                expect(cn).to.contains('invisible');
            }
            await new Promise(res => setTimeout(res, 500));
        });
    });

    describe('Choice type config test', async () => {
        let menu: MenuConfig;
        let sel: WebElement;

        before(async () => {
            menu = await new MenuConfig('Build Setup').build();
            sel = await view.findWebElement(By.css('#choice-0 > select'));
            await menu?.open();
            await new Promise(res => setTimeout(res, 1000)); // make sure want to be menu opened
            await (await view.findWebElement(By.id('HOST_LINUX')))?.click();
        });

        after(async () => {
            await menu?.close();
        });

        it('should be windows', async () => {
            await (await view.findWebElement(By.id('HOST_WINDOWS')))?.click();
            expect(await sel.getAttribute('value')).to.equal('Windows');
        });
        it('should windows related options has been displayed', async () => {
            let opt = await view.findWebElement(By.id('choice-1'));
            await scrollIntoView(opt);
            expect(await opt.isDisplayed()).to.be.true;
            let s  = await opt.findElement(By.css('select'));
            expect(await s?.getAttribute('value')).to.equal('Cygwin');
        });
        it('should be linux', async () => {
            await (await view.findWebElement({id: 'HOST_LINUX'}))?.click();
            expect(await sel.getAttribute('value')).to.equal('Linux');
        });
        it('should be windows related options has been hidden', async () => {
            let opt = await view.findWebElement(By.id('choice-1'));
            expect(await opt.isDisplayed()).to.be.false;
        });
    });
});
