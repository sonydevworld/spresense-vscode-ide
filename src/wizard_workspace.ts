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
import * as fs from 'fs';
import * as path from 'path';

import * as nls from './localize';
import { isMsysInstallFolder } from './common';
import { isSpresenseSdkFolder } from './common';
import { WizardBase } from './wizard';

const SDK_PATH_ID = 'wizard-sdk-path-box';
const PROJECT_PATH_ID = 'wizard-project-path-box';

const SDK_PATH_HISTORY_KEY = 'spresense.history.sdk.path';
const PROJECT_PATH_HISTORY_KEY = 'spresense.history.project.path';

export function activate(context: vscode.ExtensionContext) {
    const resourcePath = path.join(context.extensionPath, 'resources');

    /* Localize config */
    nls.config(context);

	/* Register workspace setup wizard command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.workspace.wizard', () => {
        /* Open Workspace wizard */
        WorkspaceWizard.openWizard(resourcePath, context.globalState);
    }));

    /* Register Configuration change event for sync spresense preference with wizard */
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((evt) => {
        if (evt.affectsConfiguration("spresense.msys.path")) {
            updateEnvironmentProblem();
        }
    }));
}

export function deactivate() {
}

function updateEnvironmentProblem() {
    if (!WorkspaceWizard.currentPanel || process.platform !== 'win32') {
        /* Nothing to do. */
        return;
    }

    const msysPath = vscode.workspace.getConfiguration().get('spresense.msys.path');

    if (msysPath && typeof msysPath === 'string' && isMsysInstallFolder(msysPath)) {
        /* No problem, so hide message */
        WorkspaceWizard.currentPanel.postMessage({command: 'showProblems', show: false});
    } else {
        /* Has problem, so show message  */
        WorkspaceWizard.currentPanel.postMessage({command: 'showProblems', show: true});
    }
}

class WorkspaceWizard extends WizardBase {

    public static currentPanel: WorkspaceWizard | undefined;

    private readonly _globalState: vscode.Memento | undefined;

    public static openWizard(resourcePath: string, globalState: vscode.Memento) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (WorkspaceWizard.currentPanel) {
            if (WorkspaceWizard.currentPanel._panel) {
                WorkspaceWizard.currentPanel._panel.reveal(column);
            }
            return;
        }

        const panel = WizardBase.createWizardPanel(nls.localize("spresense.workspace.wizard.label", "Workspace setup wizard"), resourcePath);

        /* Create new panel */
        WorkspaceWizard.currentPanel = new WorkspaceWizard(panel, resourcePath, globalState);

        /* Update environment problem message */
        updateEnvironmentProblem();
    }

    public constructor(panel: vscode.WebviewPanel, resourcePath: string, globalState: vscode.Memento) {
        super(panel, 'workspace', resourcePath);
        this._globalState = globalState;

        /* If workspace is already opened, show error message to close current workspace */
        if (vscode.workspace.workspaceFolders &&
            vscode.workspace.workspaceFolders.length > 0) {
            /* Post description message */
            this.postMessage({command: 'disableWizard'});
        }
    }

    public dispose() {
        WorkspaceWizard.currentPanel = undefined;
        super.dispose();
    }

    public getLocaleObject() {
        return {
            'wizard-error':
                nls.localize("spresense.workspace.wizard.error", "This setup wizard is working on empty window. Please close opened workspace first."),
            'workspace-wizard-header':
                nls.localize("spresense.workspace.wizard.label", "Workspace setup wizard"),
            'wizard-sdk-path-label':
                nls.localize("spresense.workspace.wizard.sdk.label", "Spresense SDK Path"),
            'wizard-sdk-path-description':
                nls.localize("spresense.workspace.wizard.sdk.desc", "Please select Spresense SDK path (e.g. /home/myspresense/spresense)"),
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
            'wizard-cancel-button':
                nls.localize("spresense.workspace.wizard.cancel.button", "Cancel"),
            'wizard-environment-problems-label':
                nls.localize("spresense.workspace.wizard.problems.label", "Problems"),
            'wizard-environment-problems-description':
                nls.localize("spresense.workspace.wizard.problems.desc", "Environment problems message")
        };
    }

    public handleWebViewEvents(message: any) {
        if ('command' in message) {
            switch (message.command) {
                case 'openFolder':
                    this.handleOpenFolder(message);
                    return;
                case 'checkBasicPath':
                    this.postBasicPathCheckerResult(message.id, message.path);
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

    private postSelectedFolder(id: string, path: string) {
        /* Post selected folder message */
        this.postMessage({command: 'updateFolderText', id: id, path: path});

        /* Selected path check */
        if (id === SDK_PATH_ID) {
            this.postSdkCheckerResult(id, path);
        } else {
            this.postBasicPathCheckerResult(id, path);
        }
    }

    private postBasicPathCheckerResult(id: string, path: string) {
        let result = true;
        let text = '';

        try {
            if (!fs.existsSync(path) || !fs.statSync(path).isDirectory()) {
                result = false;
                text = nls.localize("spresense.workspace.wizard.path.notfound.error", "Folder {0} not found. Please create a new folder and select it.", path);
            } else if (path.includes(' ')) {
                result = false;
                text = nls.localize("spresense.workspace.wizard.path.space.error", "Selected path has space ' ', please choose different folder.");
            }
        } catch (e: any) {
            result = false;
            text = e.message;
        }

        /* Post path checker result */
        this.postMessage({
            command: 'checkPathResult',
            id: id,
            result: result,
            text: text
        });
    }

    private postSdkCheckerResult(id: string, path: string) {
        /* Before SDK path check, need to check basic path check */
        this.postBasicPathCheckerResult(id, path);

        if (!isSpresenseSdkFolder(path)) {
            /* Post path checker result */
            this.postMessage({
                command: 'checkPathResult',
                id: id,
                result: false,
                text: nls.localize("spresense.workspace.wizard.sdk.error", "Invalid SDK Path selected. Please re-select correct SDK path.")
            });
        }
    }

    private handleOpenFolder(message: any) {
        if ('id' in message && 'path' in message) {
            let defaultUri: vscode.Uri | undefined;
            let path: string | undefined;

            if (message.path !== "") {
                path = message.path;
            } else if (this._globalState) {
                switch (message.id) {
                    case SDK_PATH_ID:
                        path = this._globalState.get(SDK_PATH_HISTORY_KEY);
                        break;
                    case PROJECT_PATH_ID:
                        path = this._globalState.get(PROJECT_PATH_HISTORY_KEY);
                        break;
                    default:
                        console.log("ERR");
                        break;
                }
            }

            if (path) {
                defaultUri = vscode.Uri.file(path);
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
}
