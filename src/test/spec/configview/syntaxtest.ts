import { expect } from 'chai';
import { Workbench, VSBrowser, By, WebDriver, WebElement, until, WebView, EditorView } from 'vscode-extension-tester';

import { MenuConfig } from '../../util/menuconfig';
import { scrollIntoView } from '../../util/viewctrl';

export async function syntaxTests() {
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
}