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

export function tweakConfigBool(configfile: string, configname: string, enable: boolean) {
	let config;

	if (enable) {
		config = `CONFIG_${configname}=y\n`;
	} else {
		config = `# CONFIG_${configname} is not set\n`;
	}

	fs.writeFileSync(configfile, config, { flag: "a" });
}

export function tweakConfigStr(configfile: string, configname: string, value: string) {
	fs.writeFileSync(configfile, `CONFIG_${configname}="${value}"\n`, { flag: "a" });
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
		tweakConfigBool(configfile, "HOST_WINDOWS", true);
		tweakConfigBool(configfile, "TOOLCHAIN_WINDOWS", true);
		// XXX: Currently only MSYS2 is supported
		tweakConfigBool(configfile, "WINDOWS_MSYS", true);
	}
}

/**
 * Change kernel configuration to running host platform
 *
 * @param buf Configuration file contents
 */
export function updateHostConfiguration(configfile: string, kernelDir: string) {
	let contents;
	try {
		contents = fs.readFileSync(configfile).toString();
	} catch(err) {
		return; // Ignore file missing
	}

	// Turned off related configurations first
	contents = contents.replace(/^(CONFIG_HOST_\w+)=y/gm, '# $1 is not set')
		.replace('CONFIG_TOOLCHAIN_WINDOWS=y', '# CONFIG_TOOLCHAIN_WINDOWS is not set')
		.replace('CONFIG_WINDOWS_MSYS=y', '# CONFIG_WINDOWS_MSYS is not set');

	function setConfig(content: string, sym: string, value: boolean): string {
		if (value) {
			return content.replace(`CONFIG_${sym}=y`, `# CONFIG_${sym} is not set`);
		} else {
			return content.replace(`# CONFIG_${sym} is not set`, `CONFIG_${sym}=y`);
		}
	}

	switch (process.platform) {
		case 'win32':
			contents = setConfig(contents, 'HOST_WINDOWS', true);
			contents = setConfig(contents, "TOOLCHAIN_WINDOWS", true);
			contents = setConfig(contents, "WINDOWS_MSYS", true);
			break;
		case 'darwin':
			contents = setConfig(contents, 'HOST_MACOS', true);
			break;
		case 'linux':
			contents = setConfig(contents, 'HOST_LINUX', true);
			break;
		default:
			// not changed for unsupported platforms
			break;
	}

	fs.writeFileSync(configfile, contents);

	// Run 'make olddefconfig to update configuration for resolve HOST configration changes.
	// If configfile is user application ones, it copy to kernel directory and copy back after
	// configuration updated.

	function makeOldDefconfig(dir: string) {
		console.log(`kerneldir: ${dir}`);
		return cp.execSync('make olddefconfig', { cwd: dir });
	}
	let stdout;
	if (path.dirname(configfile) !== kernelDir) {
		fs.writeFileSync(path.resolve(kernelDir, '.config'), contents);
		stdout = makeOldDefconfig(kernelDir);
		fs.copyFileSync(path.resolve(kernelDir, '.config'), configfile);
	} else {
		stdout = makeOldDefconfig(kernelDir);
	}
	//console.log(stdout.toString());
}

export function isDifferentHostConfig(configfile: string): boolean {
	let contents;

	try {
		contents = fs.readFileSync(configfile).toString();
	} catch(err) {
		// If .config file does not existed, it would be created for host platform.
		return false;
	}

	let hostWin = contents.includes('CONFIG_HOST_WINDOWS=y');
	let hostMac = contents.includes('CONFIG_HOST_MACOS=y');
	let hostLinux = contents.includes('CONFIG_HOST_LINUX=y');

	if (hostWin || hostMac || hostLinux) {
		// Return HOST configuration other than running platform
		switch (process.platform) {
			case 'win32':
				return hostMac || hostLinux;
			case 'darwin':
				return hostWin || hostLinux;
			case 'linux':
				return hostWin || hostMac;
			default:
				return true; // Running platform is not supported.
		}
	} else {
		// When no HOST_* configuration found, it treated with the same as .config not found.
		return false;
	}
}

/**
 * Find any build task is running
 *
 * This function targets only for tasks managed by VS Code.
 *
 * @return {boolean} true when found build task.
 */

export function buildTaskIsRunning() : boolean {
	for (let ex of vscode.tasks.taskExecutions) {
		if (ex.task.group === vscode.TaskGroup.Build) {
			return true;
		}
	}
	return false;
}
