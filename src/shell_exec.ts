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
import * as cp from 'child_process';

export interface ExecOptions extends cp.ExecOptions {}
export interface ChildProcess extends cp.ChildProcess {}
export interface ExecException extends cp.ExecException {}

export function getEnv () {
	/* Interface for platform environment */
	interface EnvInterface {
		[key: string]: string;
	}

	const config = vscode.workspace.getConfiguration('terminal.integrated');
	let os;
	switch (process.platform) {
		case 'win32':
			os = 'windows';
			break;
		case 'linux':
			os = 'linux';
			break;
		case 'darwin':
			os = 'osx';
			break;
		default:
			os = '';
			break;
	}

	const defaultShell = '/bin/bash';
	const defaultPath = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

	const osEnv: EnvInterface = config.get(`env.${os}`) || {};
	const osShell = config.get(`shell.${os}`);

	return {
		SHELL: osShell ? osShell : defaultShell,
		PATH: osEnv.PATH ? osEnv.PATH : defaultPath
	};
}

export function exec(cmd: string, options?: cp.ExecOptions, callback?: (error: cp.ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void): cp.ChildProcess {
	const env = getEnv();
	const shell = env.SHELL;
	let command = `${shell} -c \'${cmd}\'`;

	if (!options) {
		options = {};
	}

	if (options.env) {
		options.env['PATH'] = env.PATH;
	} else {
		options.env = {PATH: env.PATH};
	}

	/* For windows file path delimiter */
	command = command.replace(/\\/g, '\\\\');

	return cp.exec(command, options, callback);
}

export function execFile(file: string, args: string[], options?: cp.ExecOptions, callback?: (error: cp.ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void): cp.ChildProcess {
	let command = file;
	args.forEach((arg) => {
		command = command + ' \"' + arg + '\" ';
	});

	/* For windows file path delimiter */
	command = command.replace(/\\/g, '\\\\');

	return exec(command, options, callback);
}

export function execSync(command: string, options?: cp.ExecOptions): Buffer | string {
	const env = getEnv();
	const shell = env.SHELL;

	command = `${shell} -c \'${command}\'`;

	if (!options) {
		options = {};
	}

	if (options.env) {
		options.env['PATH'] = env.PATH;
	} else {
		options.env = {PATH: env.PATH};
	}

	/* For windows file path delimiter */
	command = command.replace(/\\/g, '\\\\');

	return cp.execSync(command, options);
}

export function execFileSync(file: string, args: string[], options?: cp.ExecOptions): Buffer | string {
	let command = file;
	args.forEach((arg) => {
		command = command + ' \"' + arg + '\" ';
	});

	/* For windows file path delimiter */
	command = command.replace(/\\/g, '\\\\');

	return execSync(command, options);
}
