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

export function activate(context: vscode.ExtensionContext) {
    const resourcePath = path.join(context.extensionPath, 'resources', 'wizard');

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
        return "";
    }

    private handleWebViewEvents(message: any) {
        if ('command' in message) {

        }
    }
}
