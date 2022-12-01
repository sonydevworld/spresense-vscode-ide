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

/* eslint-disable @typescript-eslint/naming-convention */

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as iconv from 'iconv-lite';

import * as nls from './localize';
import { HelperTools } from './helper';
import * as tasks from './tasks';

let helper: HelperTools;

function getShell(osName: string) : string {
	const defaultShell = '/bin/bash';
	const config = vscode.workspace.getConfiguration('terminal.integrated.shell');
	const shell = config.get(osName);

	return typeof shell === 'string' ? shell : defaultShell;
}

function getEnv (platform: string) {

	switch (platform) {
		case 'win32':
			return {
				'shell': getShell('windows'),
				'prefix': '/dev/ttyS',
				'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
			};
		case 'linux':
			return {
				'shell': getShell('linux'),
				'prefix': '/dev/ttyUSB',
				'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
			};

		case 'darwin':
			return {
				'shell': getShell('osx'),
				'prefix': '/dev/cu.SLAB_USBtoUART',
				'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
			};

		default:
			return {
				'shell': '',
				'prefix': '',
				'PATH': ''
			};
	}
}

/**
 * Check task is for flashing
 *
 * This function checking a task is a flashing task or not.
 *
 * @param taskExec TaskExecution for checking
 * @returns If task is flashing true, else false
 */

function isFlashTask(taskExec: vscode.TaskExecution): boolean {
	const flashTasks = [
		tasks.flashTask.label,
		tasks.flashWorkerTask.label,
		tasks.flashCleanTask.label,
		tasks.flashBootTask.label
	];

	return flashTasks.some((task) => {
		return task === taskExec.task.name;
	});
}

function getAvailablePortList(): string[] {
	try {
		const p = helper.getToolPath('list_ports');
		const buf = cp.execFileSync(p);
		let result;
		if (p.endsWith('.exe')) {
			// Unfortunately, windows executable outputs messages in CP932 encode for japanese.
			// We need to transcode such messages to UTF-8.
			result = iconv.decode(buf, 'CP932');
		} else {
			result = buf.toString();
		}

		return result.trim().split('\n');
	} catch (error) {
		return [];
	}
}

async function showSerialPortSelector(): Promise<string> {
	const ports = getAvailablePortList();
	let name = '';

	if (ports.length > 0) {
		const port = await vscode.window.showQuickPick(ports,
			{
				placeHolder: nls.localize("serial.src.select.port", 'Select serial port.')
			}
		);

		if (port !== undefined) {
			// Port items of list are in '<port name>: <desctiption>' (e.g. COM3: Silicon Labs CP210x).
			// The program needs only port name.
			name = port.split(':')[0];
			await vscode.workspace.getConfiguration().update('spresense.serial.port', name, vscode.ConfigurationTarget.Global);
		}
	} else {
		vscode.window.showErrorMessage(nls.localize("serial.src.select.error",
			'Cannot detect serial ports. Please connect Spresense.'));
	}
	return name;
}

async function tryGetSerialPort(): Promise<string> {
	let port: string = vscode.workspace.getConfiguration().get('spresense.serial.port') || 'not configured';
	if (!getAvailablePortList().some(i => i.startsWith(port))) {
		/* If not exist port device, show dialog */
		port = await showSerialPortSelector();
	}

	return port;
}

export function activate(context: vscode.ExtensionContext) {
	var serialTerminal: vscode.Terminal | undefined;
	// Temporary: avoid showing error message while flashing
	var retryCount: number = 0;

	nls.config(context);

	helper = new HelperTools(context);

	context.subscriptions.push(vscode.commands.registerCommand('spresense.serial.open', async () => {
		if (serialTerminal === undefined) {
			const osEnv = getEnv(process.platform);

			/* Take configuration from preference */
			const port = await tryGetSerialPort();
			if (port === '') {
				console.log('cancelled');
				return;
			}
			const baudrate = vscode.workspace.getConfiguration().get('spresense.serial.baudrate');

			const terminalPath = helper.getToolPath('miniterm');
			const opts = '--eol LF --raw -q'; // End of line is LF, no transcoding, quiet app messages
			const terminalCommand = `'${terminalPath}' ${opts} ${port} ${baudrate}`;

			let flashTask = vscode.tasks.taskExecutions.find(taskExec => isFlashTask(taskExec));

			/* Avoid to conflict common resource */
			/* TODO: This is a just workaround for avoid show error message when flash task finished */
			if (flashTask !== undefined) {
				if (retryCount > 1) {
					vscode.window.showErrorMessage(nls.localize("serial.src.open.error",
						"Error to start serial terminal (Serial port in flashing programs)."));
				}
				retryCount ++;
				return;
			}

			/* Create serial terminal */
			serialTerminal = vscode.window.createTerminal({
				name: nls.localize("serial.src.terminal.title", "Serial terminal"),
				env: osEnv,
				shellPath: osEnv.shell,
				shellArgs: ['-c', terminalCommand]});
			serialTerminal.show();
		} else {
			serialTerminal.show(true);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('spresense.serial.close', () => {
		if (serialTerminal) {
			serialTerminal.dispose();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('spresense.serial.port', () => {
		showSerialPortSelector();
	}));

	context.subscriptions.push(vscode.window.onDidCloseTerminal((terminal) => {
		/* If serial terminal closed, serialTerminal set to undefined */
		if (terminal === serialTerminal) {
			serialTerminal = undefined;
		}
	}));

	context.subscriptions.push(vscode.tasks.onDidStartTask((taskStartEvent) => {
		if (isFlashTask(taskStartEvent.execution)) {
			vscode.commands.executeCommand('spresense.serial.close');
		}
	}));

	context.subscriptions.push(vscode.tasks.onDidEndTaskProcess((taskEndProcess) => {
		if (taskEndProcess.exitCode === 0 && isFlashTask(taskEndProcess.execution)) {
			/* Reset */
			retryCount = 0;

			vscode.commands.executeCommand('spresense.serial.open');
		}
	}));
}

export function deactivate() {
}
