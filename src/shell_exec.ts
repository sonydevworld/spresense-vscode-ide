/* eslint-disable @typescript-eslint/naming-convention */
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

function getOSName() {
	switch (process.platform) {
		case 'win32':
			return 'windows';
		case 'darwin':
			return 'osx';
		default:
			return process.platform;
	}
}

export function getDefaultShellPath() {
	const os = getOSName();
	const config = vscode.workspace.getConfiguration('terminal.integrated');
	// Take automationProfile first to use shell in tasks
	const p: any = config.get(`automationProfile.${os}`);
	if (p) {
		if (typeof(p) === 'string') {
			return p;
		} else if ('path' in p && p.path !== '') {
			return p.path;
		}
	}

	const profname: string | undefined = config.get(`defaultProfile.${os}`);
	if (profname === null || profname === undefined) {
		const profs: any | undefined = config.get(`profiles.${os}`);
		if (profs) {
			const p: any = Object.values(profs)[0];
			if (p && 'path' in p && p.path !== '') {
				return p.path;
			}
		}
		return '/bin/bash';
	} else {
		const path: string | undefined = config.get(`profiles.${os}.${profname}.path`);
		return path ? path : '/bin/bash';
	}
}

function getEnvPATH() {
	const config = vscode.workspace.getConfiguration('terminal.integrated');
	const os = getOSName();
	const e: any = config.get(`env.${os}`);
	console.log(e);
	return e ? e.PATH : '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
}

export function exec(cmd: string, options?: cp.ExecOptions, callback?: (error: cp.ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void): cp.ChildProcess {
	const shell = getDefaultShellPath();
	const pathVar = getEnvPATH();
	let command = `${shell} -c \'${cmd}\'`;

	if (!options) {
		options = {};
	}

	if (options.env) {
		options.env['PATH'] = pathVar;
	} else {
		options.env = {PATH: pathVar};
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
	const pathVar = getEnvPATH();
	const shell = getDefaultShellPath();

	command = `${shell} -c \'${command}\'`;

	if (!options) {
		options = {};
	}

	if (options.env) {
		options.env['PATH'] = pathVar;
	} else {
		options.env = {PATH: pathVar};
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
