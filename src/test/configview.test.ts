import { expect } from 'chai';
import { Workbench, VSBrowser, WebView, EditorView } from 'vscode-extension-tester';

import * as testenv from './util/testenv';
import { DefconfigUtil } from './util/defconfig';
import { cleanupRepository } from './util/repository';

import { evaluationTests } from './spec/configview/evaltest';
import { boolTests } from './spec/configview/booltest';
import { syntaxTests } from './spec/configview/syntaxtest';
import { defconfigTests } from './spec/configview/defconfigtest';

let view: WebView;

before(async () => {
    const util = new DefconfigUtil();
    util.makeBaseDotConfigs();
    cleanupRepository();

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

    await new EditorView().closeAllEditors();

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

describe('SDK Configuration', async () => {
    describe('Internal core function', evaluationTests);
    describe('Bool type config test', boolTests);
    describe('Syntax relatec config test', syntaxTests);
    describe.skip('New button test', defconfigTests);
});
