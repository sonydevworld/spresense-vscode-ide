import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import * as cp from '../shell_exec';

/**
 * Return Spresense SDK root path
 */

export function getRootDir(): string | undefined {
	if (vscode.workspace.workspaceFolders === undefined) {
		console.log('no workspace');
		return undefined;
	}
	let dir = vscode.workspace.workspaceFolders[0].uri.fsPath;
	console.log(`workspace root: ${dir}`);
	return dir;
}

/**
 * Get absolute path to python
 *
 * @return Path to python, return undefined if both of 'python' and 'python3' are not found.
 */

export function getPythonPath(): string | undefined {
	let python:string| undefined;

	try {
		python = cp.execSync('which python3').toString().trim();
	} catch {
		try {
			python = cp.execSync('which python').toString().trim();
		} catch {
		}
	}

	/* In MSYS2, append MSYS2 install path */
	if (process.platform === 'win32' && python) {
		const mpath = vscode.workspace.getConfiguration('spresense.msys').get('path');

		if (mpath && typeof mpath === 'string') {
			python = path.join(mpath, python);
		}
	}

	return python;
}

/**
 * Tweak configuration
 *
 * This function emulates the kconfig-tweak tool, but only adding boolean options.
 * This implementation is too lazy but enough to work for this extension. If you
 * want to work completely, please rewrite it!
 *
 * @param configfile Path to config file
 * @param configname Config name without CONFIG_ prefix
 * @param enable     Boolean option value
 */

export function tweakConfig(configfile: string, configname: string, enable: boolean) {
	let config;

	if (enable) {
		config = `CONFIG_${configname}=y\n`;
	} else {
		config = `# CONFIG_${configname} is not set\n`;
	}

	fs.writeFileSync(configfile, config, { flag: "a" });
}

/**
 * Tweak configuration for Windows (MSYS) platform
 *
 * This process needs to be able to build on windows environment.
 * It is also defconfig. Please check SDKConfigView._loadDefconfigFiles().
 *
 * @param configfile Path to config file
 */
export function tweakPlatform(configfile: string) {
	if (process.platform === "win32") {
		console.log(`tweak ${configfile} for Windows`);
		tweakConfig(configfile, "HOST_WINDOWS", true);
		tweakConfig(configfile, "TOOLCHAIN_WINDOWS", true);
		// XXX: Currently only MSYS2 is supported
		tweakConfig(configfile, "WINDOWS_MSYS", true);
	}
}

/**
 * Find any build task is running
 *
 * This function targets only for tasks managed by VS Code.
 *
 * @return {boolean} true when found build task.
 */

export function BuildTaskIsRunning() : boolean {
	for (let ex of vscode.tasks.taskExecutions) {
		if (ex.task.group === vscode.TaskGroup.Build) {
			return true;
		}
	}
	return false;
}
