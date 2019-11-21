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
import { WizardBase } from './wizard';

export function activate(context: vscode.ExtensionContext) {
    const resourcePath = path.join(context.extensionPath, 'resources');

	/* Register item wizard command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.item.wizard', (uri) => {
        let wsFolder: vscode.WorkspaceFolder | undefined;
        let selectedFolder: string | undefined;

		if (uri instanceof vscode.Uri) {
			wsFolder = vscode.workspace.getWorkspaceFolder(uri);
        }

        if (wsFolder && !common.isSpresenseSdkFolder(wsFolder.uri.fsPath)) {
            selectedFolder = wsFolder.uri.fsPath;
        }

        /* Open Workspace wizard */
        ItemWizard.openWizard(resourcePath, selectedFolder);
    }));
}

export function deactivate() {
}

class ItemWizard extends WizardBase {
    private static readonly ITEM_TYPE_APP_COMMAND = 'app-command';
    private static readonly ITEM_TYPE_ASMP_WORKER = 'asmp-worker';

    public static currentPanel: ItemWizard | undefined;

    public static openWizard(resourcePath: string, selectedFolder: string | undefined) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (ItemWizard.currentPanel) {
            if (ItemWizard.currentPanel._panel) {
                ItemWizard.currentPanel._panel.reveal(column);
            }
            return;
        }

        const panel = WizardBase.createWizardPanel("Create new Item wizard", resourcePath);

        /* Create new panel */
        ItemWizard.currentPanel = new ItemWizard(panel, resourcePath, selectedFolder);
    }

    public constructor(panel: vscode.WebviewPanel, resourcePath: string, selectedFolder: string | undefined) {
        super(panel, 'item', resourcePath);
        this.updateButtonDescription();
        this.postWorkspaceFolders(selectedFolder);
    }

    public dispose() {
        ItemWizard.currentPanel = undefined;
        super.dispose();
    }

    public getLocaleObject() {
        return {
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
                nls.localize("spresense.item.wizard.asmp.name.desc", "Please input ASMP worker name. This name is using by ASMP worker ELF file name. And command name can use number(0 ~ 9), alphabet(a ~ z, A ~ Z), underscore(_)."),
            'wizard-item-checkbox-label':
                nls.localize("spresense.item.wizard.asmp.sample.check", "Create a sample application command for using this ASMP worker"),
            'wizard-asmp-worker-app-name-label':
                nls.localize("spresense.item.wizard.asmp.sample.label", "Sample application name"),
            'wizard-asmp-worker-app-name-description':
                nls.localize("spresense.item.wizard.app.name.desc", "Please input application command name. This name is using by NuttShell. And command name can use number(0 ~ 9), alphabet(a ~ z, A ~ Z), underscore(_)."),
            'wizard-cancel-button':
                nls.localize("spresense.item.wizard.button.cancel", "Cancel"),
            'wizard-left-button':
                nls.localize("spresense.item.wizard.button.previous", "Previous"),
            'wizard-right-button':
                nls.localize("spresense.item.wizard.button.next", "Next")
        };
    }

    public handleWebViewEvents(message: any) {
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

    private updateButtonDescription() {
        const buttonText = {
            'next': nls.localize("spresense.item.wizard.button.next", "Next"),
            'create': nls.localize("spresense.item.wizard.button.create", "Create")
        };

        /* Post button description message */
        this.postMessage({command: 'updateButtonText', patterns: buttonText});
    }

    private postWorkspaceFolders(selectedFolder?: string) {
        const folders = common.getProjectFolders().map((folder) => {
            return {'name': folder.name, 'path': folder.uri.fsPath};
        });

        /* Sent project folders information */
        this.postMessage({
            command: 'setProjectFolders',
            folders: folders,
            selected: selectedFolder? selectedFolder : folders[0].path
        });
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
            this.postMessage({command: 'showErrorMessage', id: message.id, errText: errorText});
        }
    }

    private handleCreateItem(message: any) {
        if (!this._resourcePath) {
            return;
        }

        if ('type' in message && 'folder' in message && 'name' in message) {
            if (message.type === ItemWizard.ITEM_TYPE_APP_COMMAND) {
                /* Create a application template for using new worker */
                common.createApplicationFiles(message.name, message.folder, this._resourcePath);
            } else if (message.type === ItemWizard.ITEM_TYPE_ASMP_WORKER) {
                /* Create worker template */
                common.createWorkerFiles(message.name, message.sampleName, message.folder, this._resourcePath);
            }
        }

        this.dispose();
    }
}
