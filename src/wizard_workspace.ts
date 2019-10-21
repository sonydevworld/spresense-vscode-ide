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

const WS_STYLE_SHEET_URI = '__WORKSPACE_WIZARD_STYLE_SHEET__';
const WS_SCRIPT_URI = '__WORKSPACE_WIZARD_SCRIPT__';
const NONCE = '__NONCE__';

const SDK_PATH_ID = 'wizard-sdk-path-box';
const PROJECT_PATH_ID = 'wizard-project-path-box';

const SDK_PATH_HISTORY_KEY = 'spresense.history.sdk.path';
const PROJECT_PATH_HISTORY_KEY = 'spresense.history.project.path';

export function activate(context: vscode.ExtensionContext) {
    const resourcePath = path.join(context.extensionPath, 'resources', 'wizard');

    /* Localize config */
    nls.config(context);

	/* Register workspace setup wizard command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.workspace.wizard', () => {
        /* Open Workspace wizard */
        WorkspaceWizard.openWizard(resourcePath, context.globalState);
    }));
}

export function deactivate() {
}

class WorkspaceWizard {

    public static currentPanel: WorkspaceWizard | undefined;

    public static readonly viewType = 'WorkspaceWizardView';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _resourcePath: string | undefined;
    private readonly _globalState: vscode.Memento | undefined;

	private _disposables: vscode.Disposable[] = [];

    public static openWizard(resourcePath: string, globalState: vscode.Memento) {
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
        WorkspaceWizard.currentPanel = new WorkspaceWizard(panel, resourcePath, globalState);
    }

    private constructor(panel: vscode.WebviewPanel, resourcePath: string, globalState: vscode.Memento) {
        this._resourcePath = resourcePath;
        this._panel = panel;
        this._globalState = globalState;

        this._panel.webview.onDidReceiveMessage(this.handleWebViewEvents, this, this._disposables);
        this._panel.onDidDispose(() => this.dispose(), null, undefined);

        this._panel.webview.html = this.getViewContent();

        this.updateAllDescription();

        /* If workspace is already opened, show error message to close current workspace */
        if (vscode.workspace.workspaceFolders &&
            vscode.workspace.workspaceFolders.length > 0) {
            /* Post description message */
            this._panel.webview.postMessage({command: 'disableWizard'});
        }

        /* If MSYS2 path is not set in windows environment, show message to set it */
        if (process.platform === 'win32' &&
            !vscode.workspace.getConfiguration().get('spresense.msys.path')) {
            /* Send request to show problems */
            this._panel.webview.postMessage({command: 'showProblems'});
        }
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

        const scriptUri = vscode.Uri.file(path.join(this._resourcePath, 'ws_script.js')).with({
			scheme: 'vscode-resource'
        });

        const nonce = this.getNonce();

        let content = fs.readFileSync(path.join(this._resourcePath, 'workspace.html')).toString();

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
            'wizard-error':
                nls.localize("spresense.workspace.wizard.error", "This setup wizard is working on empty window. Please close opened workspace first."),
            'workspace-wizard-header':
                nls.localize("spresense.workspace.wizard.label", "Workspace setup wizard"),
            'wizard-sdk-path-label':
                nls.localize("spresense.workspace.wizard.sdk.label", "Spresense SDK Path"),
            'wizard-sdk-path-description':
                nls.localize("spresense.workspace.wizard.sdk.desc", "Please select Spresense SDK path (e.g. /home/myspresense/spresense)"),
            'wizard-sdk-path-box-error':
                nls.localize("spresense.workspace.wizard.sdk.error", "Invalid SDK Path selected. Please re-select correct SDK path."),
            'wizard-sdk-path-button':
                nls.localize("spresense.workspace.wizard.select.button", "Select"),
            'wizard-project-path-label':
                nls.localize("spresense.workspace.wizard.project.label", "Project folder path"),
            'wizard-project-path-description':
                nls.localize("spresense.workspace.wizard.project.desc", "Please select Project folder path."),
            'wizard-project-path-button':
                nls.localize("spresense.workspace.wizard.select.button", "Select"),
            'wizard-right-button':
                nls.localize("spresense.workspace.wizard.create.button", "Create"),
            'wizard-left-button':
                nls.localize("spresense.workspace.wizard.cancel.button", "Cancel"),
            'wizard-environment-problems-label':
                nls.localize("spresense.workspace.wizard.problems.label", "Problems"),
            'wizard-environment-problems-description':
                nls.localize("spresense.workspace.wizard.problems.desc", "Environment problems message")
        };
    
        Object.keys(locale).forEach((key) => {
            this.updateDescriptionById(key, locale[key]);
        });
    }

    private postSelectedFolder(id: string, path: string) {
        /* Post selected folder message */
        this._panel.webview.postMessage({command: 'updateFolderText', id: id, path: path});

        /* Selected path check */
        this.postSdkCheckerResult(id, path);
    }

    private postSdkCheckerResult(id: string, path: string) {
        /* Post path checker result */
        this._panel.webview.postMessage({
            command: 'checkSdkResult',
            id: id,
            result: common.isSpresenseSdkFolder(path)
        });
    }

    private handleOpenFolder(message: any) {
        let defaultUri: vscode.Uri | undefined;

        if ('id' in message && 'path' in message) {
            switch (message.id) {
                case SDK_PATH_ID:
                    if (this._globalState) {
                        const sdkPath: string | undefined = this._globalState.get(SDK_PATH_HISTORY_KEY);
                        if (sdkPath) {
                            defaultUri = vscode.Uri.file(sdkPath);
                        }
                    }
                    break;
                case PROJECT_PATH_ID:
                    if (this._globalState) {
                        const prjPath: string | undefined = this._globalState.get(PROJECT_PATH_HISTORY_KEY);
                        if (prjPath) {
                            defaultUri = vscode.Uri.file(prjPath);
                        }
                    }
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

            /* Create workspace */
            vscode.workspace.updateWorkspaceFolders(
                0,
                0,
                {uri: vscode.Uri.file(sdkPath)},
                {uri: vscode.Uri.file(projectPath)}
                );

            if (this._globalState) {
                /* Store path into history */
                this._globalState.update(SDK_PATH_HISTORY_KEY, sdkPath);
                this._globalState.update(PROJECT_PATH_HISTORY_KEY, path.dirname(projectPath));
            }

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
                case 'checkSdkPath':
                    this.postSdkCheckerResult(message.id, message.path);
                    return;
                case 'create':
                    this.handleCreateWorkspace(message);
                    return;
                case 'cancel':
                    this.dispose();
                    return;
                case 'debug':
                    console.log(message.log);
                    return;
            }
        }
    }
}
