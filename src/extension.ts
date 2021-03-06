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
import * as settings from './settings';
import * as serial_terminal from './serial_terminal';
import * as sdk_config from './sdk_config';
import * as wizard_workspace from './wizard_workspace';
import * as wizard_item from './wizard_item';


export function activate(context: vscode.ExtensionContext) {
	/* Activate Spresense settings */
	settings.activate(context);

	/* Activate Serial terminal */
	serial_terminal.activate(context);

	/* Activate SDK Config */
	sdk_config.activate(context);

	/* Activate Workspace Wizard */
	wizard_workspace.activate(context);

	/* Activate Item Wizard */
	wizard_item.activate(context);
}

export function deactivate() {
	/* Deactivate Spresense settings */
	settings.deactivate();

	/* Deactivate Serial terminal */
	serial_terminal.deactivate();

	/* Deactivate Workspace Wizard */
	wizard_workspace.deactivate();

	/* Deactivate Item Wizard */
	wizard_item.deactivate();
}
