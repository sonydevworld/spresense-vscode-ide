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
import * as cp from 'child_process';

import * as nls from './localize';

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
		'Build and flash',
		'Flash application',
		'Flash worker',
		'Clean flash',
		'Burn bootloader'
	];

	return flashTasks.some((task) => {
		return task === taskExec.task.name;
	});
}

function pathToPort (path: string): string {
	if (process.platform === 'win32') {
		const prefix = '/dev/ttyS';

		/* /dev/ttyS16 -> COM17 */
		if (path.startsWith(prefix)) {
			const portNum = Number(path.replace(prefix, '')) + 1;
			return `COM${portNum}`;
		} else {
			return 'Invalid';
		}
	} else {
		return path;
	}
}

function portToPath (port: string): string {
	if (process.platform === 'win32') {
		const prefix = 'COM';

		/* COM17 -> /dev/ttyS16 */
		if (port.startsWith(prefix)) {
			const portNum = Number(port.replace(prefix, '')) - 1;
			return `/dev/ttyS${portNum}`;
		} else {
			return 'Invalid';
		}
	} else {
		return port;
	}
}

function getAvailablePortList(): string[] {
	try {
		const osEnv = getEnv(process.platform);
		const result = cp.execSync(`${osEnv.shell} -c \'ls ${osEnv.prefix}*\'`, {env: osEnv}).toString().trim();
		const portPaths = result.split('\n');
		let ports : string[] = [];

		portPaths.forEach(portpath => {
			ports.push(pathToPort(portpath));
		});

		return ports;
	} catch (error) {
		return [];
	}
}

function getSerialPortPath(): string {
	const port = vscode.workspace.getConfiguration().get('spresense.serial.port');

	if (typeof(port) === 'string') {
		return portToPath(port);
	} else {
		return '';
	}
}

async function setSerialPort(port: string) {
	const config = vscode.workspace.getConfiguration();

	await config.update('spresense.serial.port', port, vscode.ConfigurationTarget.Global);
}

async function showSerialPortSelector() {
	const ports = getAvailablePortList();

	if (ports.length > 0) {
		const port = await vscode.window.showQuickPick(ports,
			{
				placeHolder: nls.localize("serial.src.select.port", 'Select serial port.')
			}
		);

		if (port !== undefined) {
			await setSerialPort(port);
		}
	} else {
		vscode.window.showErrorMessage(nls.localize("serial.src.select.error",
			'Cannot detect serial ports. Please connect Spresense.'));
	}
}

function isSerialAvailable(portPath: string): boolean {
	if (portPath === '') {
		/* If port === '', not available */
		return false;
	} else {
		try {
			const osEnv = getEnv(process.platform);

			/* Check exist */
			cp.execSync(`${osEnv.shell} -c \'\ls ${portPath}\'`, {env: osEnv});
		} catch (error) {
			/* If exception in ls, not available */
			return false;
		}
	}

	return true;
}

async function tryGetSerialPort(): Promise<string> {
	let portPath: string;
	let available: boolean;

	/* Get current port setting */
	portPath = getSerialPortPath();

	/* Check available */
	available = isSerialAvailable(portPath);

	if (!available) {
		/* If not exist port device, show dialog */
		await showSerialPortSelector();

		/* Pick setting again */
		portPath = getSerialPortPath();
	}

	return portPath;
}

export function activate(context: vscode.ExtensionContext) {
	var serialTerminal: vscode.Terminal | undefined;
	// Temporary: avoid showing error message while flashing
	var retryCount: number = 0;

	nls.config(context);

	context.subscriptions.push(vscode.commands.registerCommand('spresense.serial.open', async () => {
		if (serialTerminal === undefined) {
			const osEnv = getEnv(process.platform);

			/* Take configuration from preference */
			let portPath = await tryGetSerialPort();
			let baudrate = vscode.workspace.getConfiguration().get('spresense.serial.baudrate');

			let extPath = context.extensionPath;
			let terminalPath = path.join(extPath, 'helper', process.platform, 'serialTerminal');
			let terminalCommand = `\'${terminalPath}\' -c ${portPath} -b ${baudrate}`;

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
