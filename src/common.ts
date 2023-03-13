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
import * as path from 'path';
import * as fs from 'fs';

import * as nls from './localize';

export interface Version {
	major: number;
	minor: number;
	patch: number;
	str: string;
}

/**
 * Check Msys folder
 *
 * This function detecting folder as Msys install path or not.
 *
 * @param folderPath Path to target folder for detecting.
 * @returns If target folder is Msys install path, return true. If not, return false.
 */

export function isMsysInstallFolder(folderPath: string): boolean {
	/* If first folder is spresense, set sdk path to settings */
	if (fs.existsSync(path.join(folderPath, 'home'))
		&& fs.statSync(path.join(folderPath, 'home')).isDirectory()
		&& fs.existsSync(path.join(folderPath, 'usr'))
		&& fs.statSync(path.join(folderPath, 'usr')).isDirectory()
		&& fs.existsSync(path.join(folderPath, 'msys2.exe'))
		&& fs.statSync(path.join(folderPath, 'msys2.exe')).isFile()) {
		/* This folder is Msys install path */
		return true;
	} else {
		return false;
	}
}

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
 * Create project folder makefiles
 *
 * This function create a makefiles for setting up a project folder.
 *
 * @param folder Path to project root folder
 * @param resourcePath Path to extension resource folder
 */

export function createProjectMakefiles (folder: string, resourcePath: string) {
	const projecRestPath = path.join(resourcePath, 'projectfiles');

	/* Necessary files: LibTarget.mk, Make.defs, Makefile */
	const tempFileList = fs.readdirSync(projecRestPath);

	tempFileList.forEach((file) => {
		const src = path.join(projecRestPath, file);
		const dest = path.join(folder, file);

		fs.copyFile(src, dest, fs.constants.COPYFILE_EXCL, (err) => {
			/* Nop */
		});
	});
}

/**
 * Create new file with template
 *
 * This function create a new file for adding application or library or worker in
 * initial setup. And replace special letter for changing component name.
 *
 * @param srcFile Path to template file
 * @param destFile Path to destination file
 * @param custom Replacement rules for coping template
 */

export function createFileByTemplate (srcFile: string, destFile: string, custom: {[key: string]: string}, callback?: () => void| undefined) {
	const targetDir = path.dirname(destFile);
	let buff = fs.readFileSync(srcFile).toString();

	if (custom) {
		Object.keys(custom).forEach((key) => {
			buff = buff.replace(new RegExp(key, "g"), custom[key]);
		});
	}

	/* If destination directory missing, create it */
	if (!fs.existsSync(targetDir)) {
		fs.mkdirSync(targetDir);
	}

	fs.writeFile(destFile, buff, (err) => {
		if (err) {
			vscode.window.showErrorMessage(nls.localize("spresense.src.create.app.error.file", "Error in creating file {0}.", destFile));
		} else {
			if (callback) {
				callback();
			}
		}
	});
}

/**
 * Get template file root directory with SDK version
 *
 * This function get a root directory that contain a template files.
 *
 * @param resourcePath Path to resource directory
 * @param folderPath Path to workspace folder
 */

export function getTemplateRootPathWithVersion (resourcePath: string, folderPath: string): string {
	let version: Version = getSdkVersionFromSpresenseConf(folderPath);
	let subdir: string = "ver2";

	if (version.major === 1) {
		subdir = "ver1";
	}

	return path.join(resourcePath, subdir);
}

/**
 * Create new worker files with template
 *
 * This function create new files for adding worker initial setup.
 * Creation rules:
 *  worker.c -> <name>_worker.c
 *  header.c -> include/<name>.h
 *  Other files: Keep file name
 *
 * @param name Name of worker
 * @param appname Name of sample application
 * @param folder Path to destination folder
 * @param resourcePath Path to extension resource files
 */

export function createWorkerFiles (name: string, appname: string| undefined, folder: string, resourcePath: string) {
	const tempPath = path.join(getTemplateRootPathWithVersion(resourcePath, folder), 'workerfiles', 'worker');
	const fileList = fs.readdirSync(tempPath);
	const destDir = path.join(folder, `${name}_worker`);
	const replaceRules = {
		__app_name__: name,
		__APP_NAME__: name.toUpperCase()
	};

	/* Create worker directory */
	fs.mkdirSync(destDir);

	/* Create all file from template */
	fileList.forEach((file) => {
		const srcFile = path.join(tempPath, file);

		/* Destination file path */
		let destFile: string;
		let cb = undefined;
		if (file === 'worker.c') {
			destFile = path.join(destDir, `${name}_worker.c`);
			cb = () => {
				vscode.window.showTextDocument(
					vscode.Uri.file(destFile),
					{
						preview: false
					}
				);
			};
		} else if (file === 'header.h') {
			destFile = path.join(destDir, 'include', `${name}.h`);
		} else {
			destFile = path.join(destDir, file);
		}

		/* Create a file from template */
		createFileByTemplate(srcFile, destFile, replaceRules, cb);
	});

	if (appname) {
		createWorkerApplicationFiles(appname, name, folder, resourcePath);
	}
}

/**
 * Create new ASMP application files with template
 *
 * This function create new files for adding application initial setup.
 * Creation rules:
 *  main.c -> <name>_main.c
 *  Other files: Keep file name
 *
 * @param name Name of application
 * @param worker_name Name of ASMP worker
 * @param folder Path to destination folder
 * @param resourcePath Path to extension resource files
 */

export function createWorkerApplicationFiles (name: string, worker_name: string, folder: string, resourcePath: string) {
	const tempPath = path.join(getTemplateRootPathWithVersion(resourcePath, folder), 'workerfiles', 'app');
	const fileList = fs.readdirSync(tempPath);
	const destDir = path.join(folder, name);
	const replaceRules = {
		__app_name__: name,
		__APP_NAME__: name.toUpperCase(),
		__worker_name__: worker_name,
		__WORKER_NAME__: worker_name.toUpperCase()
	};

	/* Create worker directory */
	fs.mkdirSync(destDir);

	/* Create all file from template */
	fileList.forEach((file) => {
		const srcFile = path.join(tempPath, file);

		/* Destination file path */
		let destFile: string;
		let cb = undefined;
		if (file === 'main.c') {
			destFile = path.join(destDir, `${name}_main.c`);
			cb = () => {
				vscode.window.showTextDocument(
					vscode.Uri.file(destFile),
					{
						preview: false
					}
				);
			};
		} else {
			destFile = path.join(destDir, file);
		}

		/* Create a file from template */
		createFileByTemplate(srcFile, destFile, replaceRules, cb);
	});
}

/**
 * Create new application files with template
 *
 * This function create new files for adding application initial setup.
 * Creation rules:
 *  main.c -> <name>_main.c
 *  Other files: Keep file name
 *
 * @param name Name of application
 * @param folder Path to destination folder
 * @param resourcePath Path to extension resource files
 */

export function createApplicationFiles (name: string, folder: string, resourcePath: string) {
	const tempPath = path.join(getTemplateRootPathWithVersion(resourcePath, folder), 'appfiles');
	const fileList = fs.readdirSync(tempPath);
	const destDir = path.join(folder, name);
	const replaceRules = {
		__app_name__: name,
		__APP_NAME__: name.toUpperCase()
	};

	/* Create worker directory */
	fs.mkdirSync(destDir);

	/* Create all file from template */
	fileList.forEach((file) => {
		const srcFile = path.join(tempPath, file);

		/* Destination file path */
		let destFile: string;
		let cb = undefined;
		if (file === 'main.c') {
			destFile = path.join(destDir, `${name}_main.c`);
			cb = () => {
				vscode.window.showTextDocument(
					vscode.Uri.file(destFile),
					{
						preview: false
					}
				);
			};
		} else {
			destFile = path.join(destDir, file);
		}

		/* Create a file from template */
		createFileByTemplate(srcFile, destFile, replaceRules, cb);
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

export const UNKNOWN_SDK_VERSION = "Unknown";

/**
 * Get SDK version from repository.
 * 
 * @param sdkFolder Path to SDK repository folder
 * 
 * @returns Version data
 */

export function getSDKVersion(sdkFolder: string) : Version {
	const versionFilePath = path.join(sdkFolder, 'sdk', 'tools', 'mkversion.sh');
	let buff: string;
	let ver : Version = {
		major: 0,
		minor: 0,
		patch: 0,
		str: UNKNOWN_SDK_VERSION
	};

	try {
		buff = fs.readFileSync(versionFilePath).toString();
	} catch (error) {
		return ver;
	}

	const results = buff.match(/^SDK_VERSION="(SDK\d+\.\d+\.\d+)"/m);
	if (results) {
		let vers = results[1].split(".");
		ver.major = parseInt(vers[0].replace("SDK", ""));
		ver.minor = parseInt(vers[1]);
		ver.patch = parseInt(vers[2]);
		ver.str = results[1];
	}
	console.log(ver);
	return ver;
}

/**
 * Get NuttX version information
 *
 * This function MUST be called after run any make targets (e.g. olddefconfig).
 *
 * @return {Version} version information. If failed, each number memebers are zero.
 */

export function getNuttXVersion(rootDir: string): Version {
    let ver: Version = {
        str: '0.0.0',
        major: 0,
        minor: 0,
        patch: 0
    };

    let p = path.resolve(rootDir, '.version');
    if (fs.existsSync(p)) {
        let lines = fs.readFileSync(p).toString().split('\n');
        for (let line of lines) {
            const m =line.match('CONFIG_VERSION_(STRING|MAJOR|MINOR|PATCH|BUILD)=(.*)');
            if (m) {
                switch (m[1]) {
                    case 'STRING':
                        ver.str = m[2].replace(/"(.*)"/, '$1');
                        break;
                    case 'MAJOR':
                        ver.major = parseInt(m[2]);
                        break;
                    case 'MINOR':
                        ver.minor = parseInt(m[2]);
                        break;
                    case 'PATCH':
                        ver.patch = parseInt(m[2]);
                        break;
                    case 'BUILD':
                        break;
                }
            }
        }
    }
    return ver;
}

/**
 * Check if two contents are the same
 *
 * This function check if two contents are the same.
 *
 * @param partA Part of contents
 * @param partB Other contents
 * @returns true: Same file / false: Different file
 */

export function isSameContents(partA: fs.PathLike, partB: fs.PathLike):boolean {
	let buf1;
	let buf2;

	try {
		buf1 = fs.readFileSync(partA);
		buf2 = fs.readFileSync(partB);
	} catch (e) {
		return false;
	}

	return buf1.equals(buf2);
}

/**
 * Load Json file.
 * 
 * @param file Path to Json file
 * @param create If true, create json with empty.
 * 
 * @returns Json data
 */

export function loadJson(file: string, create: boolean):{[key: string]: any} | null {
	try {
		return JSON.parse(fs.readFileSync(file, 'utf-8'));
	} catch (err) {
		if (err) {
			if (create) {
				return JSON.parse('{}');
			} else {
				return null;
			}
		} else {
			return null;
		}
	}
}

/**
 * Load spresense_prj.json.
 * 
 * @param folderPath Path to project folder
 * 
 * @returns Spresense config Json data
 */

export function loadSpresenseConfFile(folderPath: string): {[key: string]: any} | null {
	const sprConfFile = path.join(folderPath, '.vscode', 'spresense_prj.json');
	const jsonItem = loadJson(sprConfFile, false);

	return jsonItem;
}

/**
 * Get Spresense SDK version from spresense_prj.json
 * 
 * @param folderPath Path to project folder
 * 
 * @returns Version information
 */

 export function getSdkVersionFromSpresenseConf(folderPath: string): Version {
	const jsonItem = loadSpresenseConfFile(folderPath);
	let ver : Version = {
		major: 0,
		minor: 0,
		patch: 0,
		str: UNKNOWN_SDK_VERSION
	};

	if (jsonItem) {
		let pjVer = jsonItem['SdkVersion'].match(/SDK(\d+).(\d+).(\d+)/);
		ver.major = parseInt(pjVer[1]);
		ver.minor = parseInt(pjVer[2]);
		ver.patch = parseInt(pjVer[3]);
		ver.str = jsonItem['SdkVersion'];
	}

	return ver;
}

/**
 * Check project folder compatibility.
 * 
 * @param sdkVersion Includes Spresense SDK version
 * @param path Project folder path
 * 
 * @returns If project folder has compaibility, return true
 */

export function checkSdkCompatibility(sdkVersion: Version, uri: vscode.Uri): boolean {
	let wsFolder = vscode.workspace.getWorkspaceFolder(uri);
	let verInPrj : Version;

	if (!wsFolder) {
		return false;
	}

	verInPrj = getSdkVersionFromSpresenseConf(wsFolder.uri.fsPath);

	if (sdkVersion.major === verInPrj.major) {
		return true;
	} else {
		return false;
	}
}

/**
 * Get exact platform name
 *
 * @returns Same values of process.platform, and extra platform value of 'wsl' for WSL environments
 */
export function getExactPlatform(): string {
    let p = process.platform.toString();
    if (p === 'linux' && process.env['WSL_INTEROP'] !== undefined) {
      p = 'wsl';
    }
    return p;
}
