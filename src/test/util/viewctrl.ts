import { VSBrowser, By, WebElement, until } from 'vscode-extension-tester';

export async function waitForProgress(timeout?: number) {
    let driver = VSBrowser.instance.driver;
    let progress = await driver.wait(until.elementLocated(By.id('progress')), 1000);
    await driver.wait(until.elementIsNotVisible(progress), timeout || 10000);
}

export async function scrollIntoView(element?: WebElement) {
    if (element) {
        await VSBrowser.instance.driver.executeScript('arguments[0].scrollIntoView()', element);
        await new Promise(res => setTimeout(res, 1000));
    }
}
