import { WebElement, VSBrowser } from 'vscode-extension-tester';

export async function scrollIntoView(element: WebElement | undefined) {
    if (!element) {
        return;
    }
    await VSBrowser.instance.driver.executeScript('arguments[0].scrollIntoView()', element);
    await new Promise(res => setTimeout(res, 1000));
}
