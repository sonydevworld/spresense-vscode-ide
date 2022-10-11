import { expect } from 'chai';
import { Workbench, VSBrowser, WebView, until, By } from 'vscode-extension-tester';

import { DefconfigUtil } from '../../util/defconfig';
import { scrollIntoView, waitForProgress } from '../../util/viewctrl';

export async function defconfigTests() {
    it('should be created a new configuration from defconfigs', async () => {
        const driver = VSBrowser.instance.driver;
        const util = new DefconfigUtil();
        const defconfigs = util.getDefconfigNames();
        const view = new WebView();
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
}