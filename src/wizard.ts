/* --------------------------------------------------------------------------------------------
 * Copyright 2019 Sony Semiconductor Solutions Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 * to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 * --------------------------------------------------------------------------------------------
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { getNonce } from './common';

interface LocaleInterface {
    [key: string]: string;
}

export class WizardBase {
    private static readonly VIEW_TYPE = 'WizardView';
    private static readonly STYLE_SHEET_URI = '__WIZARD_STYLE_SHEET__';
    private static readonly SCRIPT_URI = '__WIZARD_SCRIPT__';
    private static readonly NONCE = '__NONCE__';

    public readonly _panel: vscode.WebviewPanel | undefined;
    public readonly _resourcePath: string | undefined;

    private _disposables: vscode.Disposable[] = [];

    /**
     * Create new Webview panel
     *
     * This function create a new instance of vscode.WebviewPanel with Wizard configuration.
     *
     * @param title Webview title.
     * @returns vscode.WebviewPanel instance.
     */
    public static createWizardPanel(title: string, resourcePath: string): vscode.WebviewPanel {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        return vscode.window.createWebviewPanel(
            WizardBase.VIEW_TYPE,
            title,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(resourcePath)
                ]
            });
    }

    /**
     * Constructor for WiazardBase
     *
     * This constructor create a wizard panel and common components.
     *
     * @param panel WebviewPanel for wizard.
     * @param component Type name of Wizard.
     * @param resourcePath Path to extension's reasource.
     */
    public constructor(panel: vscode.WebviewPanel, component: string, resourcePath: string) {
        this._resourcePath = resourcePath;
        this._panel = panel;

        /* Event handling */
        this._panel.webview.onDidReceiveMessage(this.handleWebViewEvents, this, this._disposables);
        this._panel.onDidDispose(() => this.dispose(), null, undefined);

        /* View web contents */
        this._panel.webview.html = this.getViewContent(component);

        /* Apply locale text */
        this.updateAllDescription();
    }

    /**
     * Create contents
     *
     * This function create a content for showing wizard. And apply script path.
     *
     * @param component Type name of wizard.
     * @returns HTML contents.
     */
    private getViewContent(component: string): string {
        if (!this._resourcePath) {
            /* TODO: Show error message */
            return "";
        }

        const cssUri = vscode.Uri.file(path.join(this._resourcePath, 'wizard', 'style.css')).with({
			scheme: 'vscode-resource'
        });

        const scriptUri = vscode.Uri.file(path.join(this._resourcePath, 'wizard', component, 'script.js')).with({
			scheme: 'vscode-resource'
        });

        const nonce = getNonce();

        let content = fs.readFileSync(path.join(this._resourcePath, 'wizard', component, 'index.html')).toString();

        /* Replace style sheet Uri */
        content = content.replace(new RegExp(WizardBase.STYLE_SHEET_URI, "g"), cssUri.toString());

        /* Replace script Uri */
        content = content.replace(new RegExp(WizardBase.SCRIPT_URI, "g"), scriptUri.toString());

        /* Replace script content */
        content = content.replace(new RegExp(WizardBase.NONCE, "g"), nonce);

        return content;
    }

    /**
     * Dispose Wizard UI
     *
     * This function disposing a wizard panel.
     */
    public dispose() {
        if (this._panel) {
            this._panel.dispose();

            while (this._disposables.length) {
                const x = this._disposables.pop();
                if (x) {
                    x.dispose();
                }
            }
        }
    }

    /**
     * Apply locale text for wizard panel
     *
     * This function appling locale text into wizard contents.
     */
    public updateAllDescription() {
        const locale: LocaleInterface| undefined = this.getLocaleObject();

        if (locale) {
            Object.keys(locale).forEach((key) => {
                this.updateDescriptionById(key, locale[key]);
            });
        }
    }

    /**
     * Post message to Web Script
     *
     * This function posting a message to web script.
     *
     * @param message Message.
     */
    public postMessage(message: any) {
        if (this._panel) {
            this._panel.webview.postMessage(message);
        }
    }

    /**
     * user imprements functions
     */

    /**
     * Get locale dictionaly
     *
     * This function posting a message to web script.
     *
     * @returns Locale dictionary with LocaleInterface.
     */
    public getLocaleObject(): LocaleInterface| undefined {
        return undefined;
    }

    /**
     * Handle incomming message
     * 
     * @param message Incomming message
     */
    public handleWebViewEvents(message: any) {}

    /**
     * Private functions
     */

    private updateDescriptionById(id:string, text: string) {
        /* Post description message */
        this.postMessage({command: 'updateText', id: id, text: text});
    }

}
