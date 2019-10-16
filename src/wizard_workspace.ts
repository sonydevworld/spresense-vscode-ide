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

const WS_STYLE_SHEET_URI = '__WORKSPACE_WIZARD_STYLE_SHEET__';
const WS_SCRIPT_URI = '__WORKSPACE_WIZARD_SCRIPT__';

const SDK_PATH_ID = 'sdk-path';
const PROJECT_PATH_ID = 'project-path';
const MSYS2_PATH_ID = 'msys2-path';

export function activate(context: vscode.ExtensionContext) {
    const resourcePath = path.join(context.extensionPath, 'resources', 'wizard');

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
            "Workspace setup wizard",
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

        let content = fs.readFileSync(path.join(this._resourcePath, 'index.html')).toString();

        /* Replace style sheet Uri */
        content = content.replace(WS_STYLE_SHEET_URI, cssUri.toString());

        /* Replace script Uri */
        content = content.replace(WS_SCRIPT_URI, scriptUri.toString());

        return content;
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
                    this._panel.webview.postMessage({command: 'selectFolder', id: message.id, path: uri[0].fsPath});
                }
            });
        }
    }

    private handleWebViewEvents(message: any) {
        if ('command' in message) {
            switch (message.command) {
                case 'openFolder':
                    this.handleOpenFolder(message);
                    return;
                case 'cancel':
                    this.dispose();
                    return;
            }
        }
    }
}
