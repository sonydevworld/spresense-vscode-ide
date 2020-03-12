/* --------------------------------------------------------------------------------------------
 * Copyright 2019, 2020 Sony Semiconductor Solutions Corporation
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

import { SDKConfigView } from './configview/sdkconfigview';
import { SDKConfigView2 } from './configview/sdkconfigview2';
import { getSDKVersion } from './common';

export function activate(context: vscode.ExtensionContext) {

	nls.config(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('spresense.sdkconfig', async (uri) => {
			const repo = getSpresenseRepositoryPath();
			if (repo === undefined) {
				vscode.window.showErrorMessage(nls.localize("sdkconfig.src.open.error.repository",
					"Spresense repository not found."));
				return;
			}

			const config = await getProjectConfigFile(uri, "sdk.config");

			if (config === '') {
				/* Canceled */
				return;
			}

			const version = getSDKVersion(repo);
			if (version.major >= 2) {
				SDKConfigView2.createOrShow(context.extensionPath, config);
			} else {
				SDKConfigView.createOrShow(context.extensionPath, config, SDKConfigView.sdkMode);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('spresense.kernelconfig', async (uri) => {
			const repo = getSpresenseRepositoryPath();
			if (repo === undefined) {
				vscode.window.showErrorMessage(nls.localize("sdkconfig.src.open.error.repository",
					"Spresense repository not found."));
				return;
			}

			const config = await getProjectConfigFile(uri, "kernel.config");

			if (config === '') {
				/* Canceled */
				return;
			}

			SDKConfigView.createOrShow(context.extensionPath, config, SDKConfigView.kernelMode);
		})
	);
}

/**
 * Check first folder of workspace has specific folders.
 * If first folder has 'sdk' and 'nuttx' subfolders, it may Spresense SDK folder.
 */

function getSpresenseRepositoryPath(): string | undefined {
	const wf = vscode.workspace.workspaceFolders;

	if (wf) {
		try {
			const sdk = fs.statSync(path.join(wf[0].uri.fsPath, 'sdk'));
			const nuttx = fs.statSync(path.join(wf[0].uri.fsPath, 'nuttx'));

			if (sdk.isDirectory && nuttx.isDirectory) {
				return wf[0].uri.fsPath;
			}
		} catch (e) {
			return undefined;
		}
	}

	return undefined;
}

/**
 * Get user project configuration file
 *
 * @param uri    Object passed by vscode
 * @param expect Expected file name, "sdk.config" or "kernel.config".
 *               It concatnate to workspace path recognized as project folder.
 * @returns Path to project file.
 *          Return undefined when project folder is not found.
 *          Return "" when canceled.
 */

async function getProjectConfigFile(uri: any, expect: string): Promise<string | undefined> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	let folder: vscode.WorkspaceFolder | undefined;

	if (!workspaceFolders) {
		return undefined;
	}

	if (uri && uri instanceof vscode.Uri) {
		if (path.basename(uri.fsPath) === expect) {
			return uri.fsPath;
		}

		folder = vscode.workspace.getWorkspaceFolder(uri);
	} else if (workspaceFolders.length === 1) {
		folder = workspaceFolders[0];
	} else {
		folder = await vscode.window.showWorkspaceFolderPick();
		if (!folder) {
			return "";
		}
	}

	if (folder) {
		if (folder !== workspaceFolders[0]) {
			return path.join(folder.uri.fsPath, expect);
		}
	}

	return undefined;
}
