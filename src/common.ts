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

/**
 * Check spresense sdk folder
 *
 * This function detecting folder as spresense sdk or not.
 *
 * @param folderPath Path to target folder for detecting.
 * @returns If target folder is spresense sdk, return true. If not, return false.
 */

export function isSpresenseSdkFolder(folderPath: string): boolean {
	/* If first folder is spresense, set sdk path to settings */
	if (fs.existsSync(path.join(folderPath, 'sdk'))
		&& fs.existsSync(path.join(folderPath, 'nuttx'))
		&& fs.statSync(path.join(folderPath, 'sdk')).isDirectory()
		&& fs.statSync(path.join(folderPath, 'nuttx')).isDirectory()) {
		/* This folder is spresense sdk */
		return true;
	} else {
		return false;
	}
}

/**
 * Get spresense project folders
 *
 * This function getting spresense project folders from current workspace.
 *
 * @returns Array of project folder path. If not exist, return [].
 */

export function getProjectFolders(): vscode.WorkspaceFolder[] {
	const wsFolders = vscode.workspace.workspaceFolders;

	/* Workspace doesn't have folders */
	if (!wsFolders || wsFolders.length === 0) {
		return [];
	}

	return wsFolders.filter((folder) => {
		return !isSpresenseSdkFolder(folder.uri.fsPath);
	});
}

/**
 * Get one time token for loading javascript
 *
 * This function generating a random character for NONCE value.
 *
 * @returns 32 digits of random characters.
 */

export function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
