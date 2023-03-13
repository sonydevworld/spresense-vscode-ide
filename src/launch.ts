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

/* configuration template for cortex-debug extension */

const launchMainSkelton = {
	"name": "Main Core",
	"cwd": "",
	"executable": "",
	"request": "launch",
	"type": "cortex-debug",
	"servertype": "openocd",
	"configFiles": [
		"interface/cmsis-dap.cfg",
		"cxd5602.cfg"
	],
	"searchDir": [
		"${workspaceFolder:spresense}/sdk/tools"
	],
	"svdFile": "${workspaceFolder:spresense}/sdk/tools/SVD/cxd5602.svd",
	"debuggerArgs": [
		"-ix",
		"${workspaceFolder:spresense}/sdk/tools/.gdbinit"
	],
	"preLaunchTask": "Clean flash",
	"overrideLaunchCommands": [
		"monitor reset",
		"monitor halt",
		"load"
	],
	"overrideRestartCommands": [
		"monitor sleep 3000",
		"monitor halt",
		"load"
	]
};

const launchSubSkelton = {
	"name": "Sub Core 1",
	"cwd": "${workspaceRoot}/examples/asmp/worker/hello",
	"executable": "./hello.debug",
	"request": "attach",
	"type": "cortex-debug",
	"servertype": "external",
	"gdbTarget": "localhost:50001"
};

function addTarget(targetFolder: vscode.Uri, target: any) {
	let config = vscode.workspace.getConfiguration('launch', targetFolder);

	// I had not found the meanings of the "version". "0.2.0" is used in various extensions
	// and samples, so we use it for now.
	// Please keep check the version information, and update here appropriately.

	if (!config.has('version')) {
		config.update('version', "0.2.0", vscode.ConfigurationTarget.WorkspaceFolder);
	}

	let configs: Array<any> | undefined = config.get('configurations');
	console.log(configs);
	if (configs) {
		const found = configs.find((element: any) => {
			return element.name === target.name;
		});
		if (found) {
			console.log(`Specified target "${target.name}" is already exists.`);
			return;
		}
		configs.push(target);
	} else {
		configs = [ target ];
	}

	console.log(`update configuration with: ${configs}`);

	config.update('configurations', configs, vscode.ConfigurationTarget.WorkspaceFolder);
}

/**
 * Add debug target for main core
 *
 * @param targetFolder Project folder URI
 * @param executable Path to executable file. Relative from @a cwd.
 * @param cwd Current working directory for OpenOCD
 * @param sdkPath Path to sdk (absolute or VS Code workspace path style)
 */

export function addMainTarget(targetFolder: vscode.Uri, executable: string, cwd: string, sdkPath: string) {
	let target = launchMainSkelton;
	target.executable = executable;
	target.cwd = cwd;

	target.searchDir = [ path.join(sdkPath, "sdk", "tools") ];
	target.svdFile = path.join(sdkPath, "sdk", "tools", "SVD", "cxd5602.svd");

	addTarget(targetFolder, target);
}

/**
 * Add debug target for sub core (a.k.a worker program)
 *
 * TENTATIVE: This function is not used for now, but remain for future.
 *
 * @param targetFolder Project folder URI
 * @param executable Path to executable file. Relative from @a cwd.
 * @param cwd Current working directory for OpenOCD
 * @param subcpuid Target sub core ID (1 - 5)
 */

export function addSubTarget(targetFolder: vscode.Uri, executable: string, cwd: string, subcpuid: number) {
	let target = launchSubSkelton;
	target.executable= executable;
	target.cwd = cwd;
	target.name = `Sub Core ${subcpuid}`;

	//
	// XXX: Cortex-Debug invokes OpenOCD with searched TCP port from 50000.
	// So sub cores may assigned from 50001 to 50008 sequentially.
	// That port is depends on user environment, but we never know that port
	// number before creating launch.json.
	// 
	target.gdbTarget = `localhost:${50000 + subcpuid}`;

	addTarget(targetFolder, target);
}

/**
 * Test the launch.json contains windows path delimiter (\)
 *
 * @param targetFolder project folder path
 */
export function includeWin32Path(targetFolder: vscode.Uri): boolean {
	try {
		const buf = fs.readFileSync(path.join(targetFolder.fsPath, '.vscode', 'launch.json')).toString();
		return !!buf.match(/\\\\/g);
	} catch(err) {
		return false; // file not found as not path included
	}
}

/**
 * Fix windows path delimiter (\) to POSIX (/)
 *
 * @param targetFolder project folder path
 */
export function win32ToPosixPath(targetFolder: vscode.Uri) {
	const fp = path.join(targetFolder.fsPath, '.vscode', 'launch.json');
	try {
		const buf = fs.readFileSync(fp).toString();
		fs.writeFileSync(fp, buf.replace(/\\\\/g, '/'));
	} catch (err) {
		// Ignore if launch.json is missing
		console.log(err);
	}
}
