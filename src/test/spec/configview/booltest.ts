import { expect } from 'chai';
import { VSBrowser, By, WebDriver } from 'vscode-extension-tester';

import { MenuConfig } from '../../util/menuconfig';
import { scrollIntoView } from '../../util/viewctrl';

export async function boolTests() {
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
}
