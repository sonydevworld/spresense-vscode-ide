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

import * as nls from './localize';
import * as common from './common';

const STYLE_SHEET_URI = '__WIZARD_STYLE_SHEET__';
const SCRIPT_URI = '__WIZARD_SCRIPT__';
const NONCE = '__NONCE__';

const ITEM_TYPE_APP_COMMAND = 'app-command';
const ITEM_TYPE_ASMP_WORKER = 'asmp-worker';

export function activate(context: vscode.ExtensionContext) {
    const resourcePath = path.join(context.extensionPath, 'resources');

	/* Register item wizard command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.item.wizard', () => {
        /* Open Workspace wizard */
        ItemWizard.openWizard(resourcePath);
    }));
}

export function deactivate() {
}

class ItemWizard {

    public static currentPanel: ItemWizard | undefined;

    public static readonly viewType = 'ItemWizardView';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _resourcePath: string | undefined;

    private _disposables: vscode.Disposable[] = [];

    public static openWizard(resourcePath: string) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (ItemWizard.currentPanel) {
            ItemWizard.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            ItemWizard.viewType,
            "Create new Item wizard",
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(resourcePath)
                ]
            });

        /* Create new panel */
        ItemWizard.currentPanel = new ItemWizard(panel, resourcePath);
    }

    private constructor(panel: vscode.WebviewPanel, resourcePath: string) {
        this._resourcePath = resourcePath;
        this._panel = panel;

        this._panel.webview.onDidReceiveMessage(this.handleWebViewEvents, this, this._disposables);
        this._panel.onDidDispose(() => this.dispose(), null, undefined);

        this._panel.webview.html = this.getViewContent();

        this.updateAllDescription();

        this.postWorkspaceFolders();
    }

    private dispose() {
        ItemWizard.currentPanel = undefined;
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private getViewContent(): string {
        if (!this._resourcePath) {
            /* TODO: Show error message */
            return "";
        }

        const cssUri = vscode.Uri.file(path.join(this._resourcePath, 'wizard', 'style.css')).with({
			scheme: 'vscode-resource'
        });

        const scriptUri = vscode.Uri.file(path.join(this._resourcePath, 'wizard', 'item_script.js')).with({
			scheme: 'vscode-resource'
        });

        const nonce = common.getNonce();

        let content = fs.readFileSync(path.join(this._resourcePath, 'wizard', 'item.html')).toString();

        /* Replace style sheet Uri */
        content = content.replace(new RegExp(STYLE_SHEET_URI, "g"), cssUri.toString());

        /* Replace script Uri */
        content = content.replace(new RegExp(SCRIPT_URI, "g"), scriptUri.toString());

        /* Replace script content */
        content = content.replace(new RegExp(NONCE, "g"), nonce);

        return content;
    }

    private updateButtonDescription() {
        const buttonText = {
            'previous': nls.localize("spresense.item.wizard.button.previous", "Previous"),
            'next': nls.localize("spresense.item.wizard.button.next", "Next"),
            'cancel': nls.localize("spresense.item.wizard.button.cancel", "Cancel"),
            'create': nls.localize("spresense.item.wizard.button.create", "Create")
        };

        /* Post button description message */
        this._panel.webview.postMessage({command: 'updateButtonText', patterns: buttonText});
    }
    private updateDescriptionById(id:string, text: string) {
        /* Post description message */
        this._panel.webview.postMessage({command: 'updateText', id: id, text: text});
    }

    private updateAllDescription() {
        interface LocaleInterface {
            [key: string]: string;
        }

        const locale: LocaleInterface = {
            'wizard-title':
                nls.localize("spresense.item.wizard.label", "Add new item wizard"),
            'wizard-project-name-description':
                nls.localize("spresense.item.wizard.project.desc", "Please select project name for creating item."),
            'wizard-item-type-description':
                nls.localize("spresense.item.wizard.type.desc", "Please select the type of item you want to add."),
            'app-command-label':
                nls.localize("spresense.item.wizard.app.label", "Application Command"),
            'wizard-app-command-description':
                nls.localize("spresense.item.wizard.app.desc", "Create a program code to add NuttShell application command."),
            'asmp-worker-label':
                nls.localize("spresense.item.wizard.asmp.label", "ASMP worker program"),
            'wizard-asmp-worker-description':
                nls.localize("spresense.item.wizard.asmp.desc", "Create a program code to add ASMP worker."),
            'wizard-app-command-name-label':
                nls.localize("spresense.item.wizard.app.name.label", "Application command name"),
            'wizard-app-command-name-description':
                nls.localize("spresense.item.wizard.app.name.desc", "Please input application command name. This name is using by NuttShell. And command name can use number(0 ~ 9), alphabet(a ~ z, A ~ Z), underscore(_)."),
            'wizard-asmp-worker-name-label':
                nls.localize("spresense.item.wizard.asmp.name.label", "ASMP worker name"),
            'wizard-asmp-worker-name-description':
                nls.localize("spresense.item.wizard.asmp.name.desc", "Please input ASMP worker name. This name is using by ASMP worker elf name. And command name can use number(0 ~ 9), alphabet(a ~ z, A ~ Z), underscore(_)."),
            'wizard-item-checkbox-label':
                nls.localize("spresense.item.wizard.asmp.sample.check", "Create a sample application command for using this ASMP worker"),
            'wizard-asmp-worker-app-name-label':
                nls.localize("spresense.item.wizard.asmp.sample.label", "Samplle application name"),
            'wizard-asmp-worker-app-name-description':
                nls.localize("spresense.item.wizard.app.name.desc", "Please input application command name. This name is using by NuttShell. And command name can use number(0 ~ 9), alphabet(a ~ z, A ~ Z), underscore(_).")
        };

        Object.keys(locale).forEach((key) => {
            this.updateDescriptionById(key, locale[key]);
        });

        this.updateButtonDescription();
    }

    private postWorkspaceFolders() {
        const folders = common.getProjectFolders().map((folder) => {
            return {'name': folder.name, 'path': folder.uri.fsPath};
        });

        /* Sent project folders information */
        this._panel.webview.postMessage({command: 'setProjectFolders', folders: folders, selected:folders[0]});
    }

    private handleWebViewEvents(message: any) {
        if ('command' in message) {
            switch (message.command) {
                case 'checkItemName':
                    this.handleCheckItemName(message);
                    break;
                case 'createItem':
                    this.handleCreateItem(message);
                    break;
                case 'close':
                    this.dispose();
                    break;
                case 'debug':
                    console.log(message.log);
                    break;
            }
        }
    }

    private handleCheckItemName(message: any) {
        if ('id' in message && 'project' in message && 'text' in message) {
            const input = message.text;
            const namePattern = /^[a-zA-Z][\w]*$/;
            const dirlist = fs.readdirSync(message.project);
            const reservedName = ['out', 'Makefile'];
            let errorText: string = "";

            if (!namePattern.test(input)) {
                errorText ="Invalid name entered.";
            } else if (dirlist.indexOf(input) !== -1) {
                errorText = `Directory or file '${input}' is already exists.`;
            } else if (reservedName.indexOf(input) !== -1) {
                errorText = `Cannot use '${input}'.`;
            }

            /* Post input value result */
            this._panel.webview.postMessage({command: 'showErrorMessage', id: message.id, errText: errorText});
        }
    }

    private handleCreateItem(message: any) {
        if (!this._resourcePath) {
            return;
        }

        if ('type' in message && 'folder' in message && 'name' in message) {
            if (message.type === ITEM_TYPE_APP_COMMAND) {
                /* Create a application template for using new worker */
                common.createApplicationFiles(message.name, message.folder, path.join(this._resourcePath, 'appfiles'));
            } else if (message.type === ITEM_TYPE_ASMP_WORKER) {
                /* Create worker template */
                common.createWorkerFiles(message.name, message.folder, path.join(this._resourcePath, 'workerfiles', 'worker'));
                if ('sampleName' in message) {
                    /* Create a application template for using new worker */
                    common.createApplicationFiles(message.sampleName, message.folder, path.join(this._resourcePath, 'workerfiles', 'app'));
                }
            }
        }

        this.dispose();
    }
}
