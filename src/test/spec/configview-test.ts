import { expect } from 'chai';
import { Workbench, VSBrowser, Notification, WebView, By, EditorView } from 'vscode-extension-tester';
import * as testenv from './testenv';

describe('SDK Configuration', async () => {
    before(async () => {
        const title = await new Workbench().getTitleBar().getTitle();
        if (title.indexOf('spresnese') >= 0) {
            return;
        }

        await VSBrowser.instance.openResources(testenv.sdkPath);
        await VSBrowser.instance.driver.wait(async () => {
            const notifications = await new Workbench().getNotifications();
            for (const notification of notifications) {
                const message = await notification.getMessage();
                if (message.indexOf('Spresense') >= 0) {
                    return notification;
                }
            }
        }, 5000) as Notification;
    });

    describe('Open Configuration', async () => {
        before(async () => {
            await new EditorView().closeAllEditors();
        });

        it('from command palette', async () => {
            const bench = new Workbench();
            const driver = VSBrowser.instance.driver;
            await bench.executeCommand('spresensesdkconfig');
            driver.sleep(500);
            const view = new WebView();
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
    
});
