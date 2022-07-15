import { expect } from 'chai';
import { Workbench, VSBrowser, WebView, By, EditorView, WebDriver, WebElement, until } from 'vscode-extension-tester';

import * as testenv from '../util/testenv';
import { MenuConfig } from '../util/menuconfig';
import { DefconfigUtil } from '../util/defconfig';
import { cleanupRepository } from '../util/repository';

before(async () => {
    const util = new DefconfigUtil();
    util.makeBaseDotConfigs();
    cleanupRepository();
});

describe('SDK Configuration', async () => {
    let view: WebView;

    before(async () => {
        const title = await new Workbench().getTitleBar().getTitle();
        if (title.indexOf('spresnese') >= 0) {
            return;
        }

        const browser = VSBrowser.instance;
        await browser.openResources(testenv.spresensePath);
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
            await bench.executeCommand('spresensesdkconfig');
            await new Promise(res => setTimeout(res, 2000));
            view = new WebView();
            expect(await view.getTitle()).has.string('SDK Config');

            // Wait for progress notification is dismissed (as ready to use).
            // If taking a long time to open configuration editor, it is fail.

            await VSBrowser.instance.driver.wait(async () => {
                const notifications = await new Workbench().getNotifications();
                return notifications.length === 0;
            }, 180000);

            await view.switchToFrame();
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
            let config = await VSBrowser.instance.driver.findElement(By.id('EXPERIMENTAL'));
            expect(await config.isDisplayed()).to.be.true;
            await menu?.close();
            expect(await config.isDisplayed()).to.be.false;
        });
    });

    describe('Bool type config test', async () => {
        let driver: WebDriver;
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
            driver = VSBrowser.instance.driver;
            menu = await new MenuConfig('Build Setup').build();
            await menu?.open();
            let submenu = await new MenuConfig('Debug Options').build();
            await submenu?.open();
        });

        after(async () => {
            await menu?.close();
        });

        it('Bool click (N -> Y)', async () => {
            const label = await driver.findElement(By.css('#DEBUG_FEATURES > label'));
            const span = await driver.findElement(By.css('#DEBUG_FEATURES > label > span'));
            const input = await driver.findElement(By.css('#DEBUG_FEATURES > label > input'));
            await scrollIntoView(label);
            await span.click();
            expect(await input.getAttribute('checked')).to.equal('true');
        });

        it('Related options should be visible if Y', async () => {
            // Check the visibility of related config options.
            // Do not use isDisplay() method because the part of the options are not visible
            // by parent menu shrunken.
            for (let id of relatedConfigs) {
                const config = await driver.findElement(By.id(id));
                const cn = await config.getAttribute('class');
                expect(cn).to.not.contains('invisible');
            }
            await new Promise(res => setTimeout(res, 500));
        });

        it('Bool click (Y -> N)', async () => {
            // This function code is the same as above because bool option operation is just click
            // the button.
            const label = await driver.findElement(By.css('#DEBUG_FEATURES > label'));
            const span = await driver.findElement(By.css('#DEBUG_FEATURES > label > span'));
            const input = await driver.findElement(By.css('#DEBUG_FEATURES > label > input'));
            await scrollIntoView(label);
            await span.click();
            expect(await input.getAttribute('checked')).to.not.exist;
        });

        it('Related options should be invisible if N', async () => {
            for (let id of relatedConfigs) {
                const config = await driver.findElement(By.id(id));
                const cn = await config.getAttribute('class');
                expect(cn).to.contains('invisible');
            }
            await new Promise(res => setTimeout(res, 500));
        });
    });

    describe('Choice type config test', async () => {
        let driver: WebDriver;
        let menu: MenuConfig;
        let sel: WebElement;

        before(async () => {
            driver = VSBrowser.instance.driver;
            menu = await new MenuConfig('Build Setup').build();
            sel = await driver.findElement(By.css('#choice-0 > select'));
            await menu?.open();
            await new Promise(res => setTimeout(res, 1000)); // make sure want to be menu opened
            await (await driver.findElement(By.id('HOST_LINUX')))?.click();
        });

        after(async () => {
            await menu?.close();
        });

        it('should be windows', async () => {
            await (await driver.findElement(By.id('HOST_WINDOWS')))?.click();
            expect(await sel.getAttribute('value')).to.equal('Windows');
        });
        it('should windows related options has been displayed', async () => {
            let opt = await driver.findElement(By.id('choice-1'));
            await scrollIntoView(opt);
            expect(await opt.isDisplayed()).to.be.true;
            let s  = await opt.findElement(By.css('select'));
            expect(await s?.getAttribute('value')).to.equal('Cygwin');
        });
        it('should be linux', async () => {
            await (await driver.findElement({id: 'HOST_LINUX'}))?.click();
            expect(await sel.getAttribute('value')).to.equal('Linux');
        });
        it('should be windows related options has been hidden', async () => {
            let opt = await driver.findElement(By.id('choice-1'));
            expect(await opt.isDisplayed()).to.be.false;
        });
    });

    describe('New button test', async () => {

        it('should be created a new configuration from defconfigs', async () => {
            const driver = VSBrowser.instance.driver;
            const util = new DefconfigUtil();
            const defconfigs = util.getDefconfigNames();
            //const defconfigs = ['feature/subcore', 'examples/lowpower'];

            for (let name of defconfigs) {
                let _new = await driver.findElement(By.id('new'));
                await _new?.click();
                let modal = await driver.wait(until.elementLocated(By.id('defconfig')), 5000);
                await driver.wait(until.elementIsVisible(modal), 10000);
                console.log(`Applying ${name}`);

                if (name !== 'default') {
                    let cat = name.split('/')[0];
                    let tab = await driver.findElement(By.id(`category-${cat}`));
                    await tab.click();
                    let e = await driver.findElement(By.css(`div[data-exact-name="${name}/defconfig"]`));
                    await scrollIntoView(e);
                    await e.click();
                }
                let okbtn = await driver.findElement(By.id('defconfig-ok'));
                await okbtn.click();
                await waitForProgress();

                let save = await driver.findElement(By.id('save'));
                await save?.click();
                await view.switchBack();
                await driver.wait(async () => {
                    const notifications = await new Workbench().getNotifications();
                    for (const notification of notifications) {
                        const message = await notification.getMessage();
                        if (message.indexOf('Configuration has been saved') >= 0) {
                            await notification.dismiss();
                            return true;
                        }
                    }
                }, 10000);
                await view.switchToFrame();

                util.saveResultConfig(name);
                expect(util.compare(name)).to.be.true;
            }
        });
    });
});

async function waitForProgress(timeout?: number) {
    let driver = VSBrowser.instance.driver;
    let progress = await driver.wait(until.elementLocated(By.id('progress')), 1000);
    await driver.wait(until.elementIsNotVisible(progress), timeout || 10000);
}

async function scrollIntoView(element?: WebElement) {
    if (element) {
        await VSBrowser.instance.driver.executeScript('arguments[0].scrollIntoView()', element);
        await new Promise(res => setTimeout(res, 1000));
    }
}
