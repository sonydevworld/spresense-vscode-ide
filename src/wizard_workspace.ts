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

import * as settings from './settings';
import * as nls from './localize';

const WS_STYLE_SHEET_URI = '__WORKSPACE_WIZARD_STYLE_SHEET__';
const WS_SCRIPT_URI = '__WORKSPACE_WIZARD_SCRIPT__';
const NONCE = '__NONCE__';

const SDK_PATH_ID = 'sdk-path';
const PROJECT_PATH_ID = 'project-path';
const MSYS2_PATH_ID = 'msys2-path';

export function activate(context: vscode.ExtensionContext) {
    const resourcePath = path.join(context.extensionPath, 'resources', 'wizard');

    /* Localize config */
    nls.config(context);

	/* Register workspace setup wizard command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.workspace.wizard', () => {
        /* Open Workspace wizard */
        WorkspaceWizard.openWizard(resourcePath);
	}));
}

export function deactivate() {
}

class WorkspaceWizard {

    public static currentPanel: WorkspaceWizard | undefined;

    public static readonly viewType = 'WorkspaceWizardView';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _resourcePath: string | undefined;

	private _disposables: vscode.Disposable[] = [];

    public static openWizard(resourcePath: string) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (WorkspaceWizard.currentPanel) {
            WorkspaceWizard.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            WorkspaceWizard.viewType,
            nls.localize("spresense.workspace.wizard.label", "Workspace setup wizard"),
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(resourcePath)
                ]
            });

        /* Create new panel */
        WorkspaceWizard.currentPanel = new WorkspaceWizard(panel, resourcePath);
    }

    private constructor(panel: vscode.WebviewPanel, resourcePath: string) {
        this._resourcePath = resourcePath;
        this._panel = panel;

        this._panel.webview.onDidReceiveMessage(this.handleWebViewEvents, this, this._disposables);
        this._panel.onDidDispose(() => this.dispose(), null, undefined);

        this._panel.webview.html = this.getViewContent();

        this.updateAllDescription();
    }

    private dispose() {
        WorkspaceWizard.currentPanel = undefined;
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

        const cssUri = vscode.Uri.file(path.join(this._resourcePath, 'style.css')).with({
			scheme: 'vscode-resource'
        });

        const scriptUri = vscode.Uri.file(path.join(this._resourcePath, 'script.js')).with({
			scheme: 'vscode-resource'
        });

        const nonce = this.getNonce();

        let content = fs.readFileSync(path.join(this._resourcePath, 'index.html')).toString();

        /* Replace style sheet Uri */
        content = content.replace(new RegExp(WS_STYLE_SHEET_URI, "g"), cssUri.toString());

        /* Replace script Uri */
        content = content.replace(new RegExp(WS_SCRIPT_URI, "g"), scriptUri.toString());

        /* Replace script content */
        content = content.replace(new RegExp(NONCE, "g"), nonce);

        return content;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
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
            'wizard-header':
                nls.localize("spresense.workspace.wizard.label", "Workspace setup wizard"),
            'wizard-sdk-path-label':
                nls.localize("spresense.workspace.wizard.sdk.label", "Spresense SDK Path"),
            'wizard-sdk-path-description':
                nls.localize("spresense.workspace.wizard.sdk.desc", "Please select Spresense SDK path (e.g. /home/myspresense/spresense)"),
            'sdk-path-error':
                nls.localize("spresense.workspace.wizard.sdk.error", "Invalid SDK Path selected. Please re-select correct SDK path."),
            'sdk-path-button':
                nls.localize("spresense.workspace.wizard.select.button", "Select"),
            'wizard-project-path-label':
                nls.localize("spresense.workspace.wizard.project.label", "Project folder path"),
            'wizard-project-path-description':
                nls.localize("spresense.workspace.wizard.project.desc", "Please select Project folder path."),
            'project-path-button':
                nls.localize("spresense.workspace.wizard.select.button", "Select"),
            'create-button':
                nls.localize("spresense.workspace.wizard.create.button", "Create"),
            'cancel-button':
                nls.localize("spresense.workspace.wizard.cancel.button", "Cancel")
            
        };
    
        Object.keys(locale).forEach((key) => {
            this.updateDescriptionById(key, locale[key]);
        })
    }

    private postSelectedFolder(id: string, path: string) {
        let result = 'OK';

        /* Check SDK Path */
        if (id === SDK_PATH_ID && !settings.isSpresenseSdkFolder(path)) {
            result = 'NG';
        }

        /* Post selected folder message */
        this._panel.webview.postMessage({command: 'selectFolder', id: id, path: path, result: result});
    }

    private handleOpenFolder(message: any) {
        let defaultUri: vscode.Uri | undefined;

        if ('id' in message && 'path' in message) {
            switch (message.id) {
                case SDK_PATH_ID:
                    // TODO: Store previous path into defaultUri
                    break;
                case PROJECT_PATH_ID:
                    // TODO: Store previous path into defaultUri
                    break;
                case MSYS2_PATH_ID:
                    // TODO: Store previous path into defaultUri
                    break;
                default:
                    console.log("ERR");
                    return;
            }

            if (message.path !== "") {
                defaultUri = vscode.Uri.file(message.path);
            }

            vscode.window.showOpenDialog({
                defaultUri: defaultUri,
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false
            }).then((uri) => {
                if (uri) {
                    this.postSelectedFolder(message.id, uri[0].fsPath);
                }
            });
        }
    }

    private handleCreateWorkspace(message:any) {
        if ('settings' in message) {
            const sdkPath = message.settings[SDK_PATH_ID];
            const projectPath = message.settings[PROJECT_PATH_ID];
            const msys2Path = message.settings[MSYS2_PATH_ID];

            /* Create workspace */
            vscode.workspace.updateWorkspaceFolders(
                0,
                0,
                {uri: vscode.Uri.file(sdkPath)},
                {uri: vscode.Uri.file(projectPath)}
                );

            /* Close wizard */
            this.dispose();
        }
    }

    private handleWebViewEvents(message: any) {
        if ('command' in message) {
            switch (message.command) {
                case 'openFolder':
                    this.handleOpenFolder(message);
                    return;
                case 'create':
                    this.handleCreateWorkspace(message);
                    return;
                case 'cancel':
                    this.dispose();
                    return;
            }
        }
    }
}
