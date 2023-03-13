import { WebDriver, WebElement, VSBrowser, By } from "vscode-extension-tester";
import assert = require("assert");

export class MenuConfig {
    driver: WebDriver;
    title: string;
    input?: WebElement;
    label?: WebElement;

    constructor(title: string) {
        this.driver = VSBrowser.instance.driver;
        this.title = title;
    };

    public async build(): Promise<MenuConfig> {
        const menus = await this.driver.findElements(By.css('.menu.config .prompt'));
        for (const menu of menus) {
            if (await menu.getText() === this.title) {
                this.label = await menu.findElement(By.xpath('..'));
                const menuid = await this.label.getAttribute('for');
                this.input = await this.driver.findElement(By.id(menuid));
                break;
            }
        }
        return this;
    }

    public async open(): Promise<void> {
        assert(this.input);
        let checked = await this.input?.getAttribute('checked');
        if (!checked) {
            await scrollIntoView(this.label);
            this.label?.click();
        }
    }

    public async close(): Promise<void> {
        assert(this.input);
        let checked = await this.input?.getAttribute('checked');
        if (checked) {
            await scrollIntoView(this.label);
            this.label?.click();
        }
    }
}

async function scrollIntoView(element?: WebElement) {
    if (!element) {
        return;
    }
    await VSBrowser.instance.driver.executeScript('arguments[0].scrollIntoView()', element);
    await new Promise(res => setTimeout(res, 1000));
}
