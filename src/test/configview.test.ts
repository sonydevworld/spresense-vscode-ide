import { expect } from 'chai';
import { Workbench, VSBrowser, WebView, EditorView } from 'vscode-extension-tester';

import * as testenv from './util/testenv';
import { DefconfigUtil } from './util/defconfig';
import { cleanupRepository, setupRepository } from './util/repository';

import { evaluationTests } from './spec/configview/evaltest';
import { boolTests } from './spec/configview/booltest';
import { syntaxTests } from './spec/configview/syntaxtest';
import { defconfigTests } from './spec/configview/defconfigtest';

// XXX: WebView object may create once in the test sequence.
// Do NOT create other WebView instance in each describes, it may cause a assert.
export let webView: WebView;

before(async () => {
    const util = new DefconfigUtil();
    setupRepository();
    cleanupRepository();
    util.makeBaseDotConfigs();

    const title = await new Workbench().getTitleBar().getTitle();
    if (title.indexOf('spresnese') >= 0) {
        return;
    }

    const browser = VSBrowser.instance;
    const driver = browser.driver;
    await browser.openResources(testenv.spresensePath);
    await driver.wait(async () => {
        const notifications = await new Workbench().getNotifications();
        for (const notification of notifications) {
            const message = await notification.getMessage();
            return message.indexOf('Spresense') >= 0;
        }
    }, 10000);

    await new EditorView().closeAllEditors();

    const bench = new Workbench();
    await bench.executeCommand('spresensesdkconfig');
    await new Promise(res => setTimeout(res, 2000));
    webView = new WebView();
    expect(await webView.getTitle()).has.string('SDK Config');

    // Wait for progress notification is dismissed (as ready to use).
    // If taking a long time to open configuration editor, it is fail.

    await driver.wait(async () => {
        const notifications = await new Workbench().getNotifications();
        return notifications.length === 0;
    }, 10 * 60 * 1000);

    await webView.switchToFrame();
});

describe('SDK Configuration', async () => {
    // Temporary disabled until Kconfig test vector is ready to use.
    //describe('Internal core function', evaluationTests);
    describe('Bool type config test', boolTests);
    describe('Syntax related config test', syntaxTests);
    describe('New button test', defconfigTests);
});
