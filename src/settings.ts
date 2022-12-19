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
import * as cp from 'child_process';
import * as md5 from 'md5';
import * as unzip from 'extract-zip';

import * as nls from './localize';

import { isMsysInstallFolder, isSpresenseSdkFolder, getSDKVersion, UNKNOWN_SDK_VERSION, Version, loadJson, loadSpresenseConfFile, checkSdkCompatibility, getExactPlatform } from './common';

import * as launch from './launch';
import * as tasks from './tasks';
import * as util from './configview/util';

const spresenseExtInterfaceVersion: number = 1003;

const configSdkPathKey = 'spresense.sdk.path';
const configSdkToolsPathKey = 'spresense.sdk.tools.path';
const configMsysPathKey = 'spresense.msys.path';

/* SDK Version */
var sdkVersion: Version = {
	major: 0,
	minor: 0,
	patch: 0,
	str: UNKNOWN_SDK_VERSION
};

/* Interface for Configuration definition */
interface ConfigInterface {
	[key: string]: string | object;
}

function win32ToPosixPath(win32Path: string): string {
	let posixPath = win32Path;

	/* C:\\msys64\\home\\ -> /C\\msys64\\home\\ */
	posixPath = posixPath.replace(/^([a-zA-Z]{1}):/, '/$1');

	/* /C\\msys64\\home\\ -> /C/msys64/home/ */
	posixPath = posixPath.replace(/\\/g, '/');

	return posixPath;
}

function createVscode(newFolderPath: string) {
	let vscodePath = path.join(newFolderPath, '.vscode');
	let includePath = path.join(vscodePath, 'include');

	if (!fs.existsSync(vscodePath) || !fs.statSync(vscodePath).isDirectory()) {
		/* If .vscode does not exist, create it */
		fs.mkdirSync(vscodePath);
	}

	if (!fs.existsSync(includePath) || !fs.statSync(includePath).isDirectory()) {
		/* If .vscode/include does not exist, create it */
		fs.mkdirSync(includePath);
	}
}

function getFirstFolder(): vscode.WorkspaceFolder | undefined {
	const wsFolders = vscode.workspace.workspaceFolders;

	if (wsFolders === undefined || wsFolders.length === 0) {
		/* No folders or workspaces are open */
		return undefined;
	}

	return wsFolders[0];
}

function getFirstFolderPath(): string | undefined {
	const folder = getFirstFolder();

	return folder ? folder.uri.fsPath : undefined;
}

/**
 * Remove folder from workspace
 *
 * This function delete a folder from current workspace.
 *
 * @param folderUri Uri to target folder for deleting..
 */

function removeWorkspaceFolder(folderUri: vscode.Uri) {
	const wsFolders = vscode.workspace.workspaceFolders;

	for (let index = 0; wsFolders && index < wsFolders.length; index ++) {
		if (wsFolders[index].uri === folderUri) {
			vscode.workspace.updateWorkspaceFolders(index, 1);
			break;
		}
	}
}

function sdkCppConfig(context: vscode.ExtensionContext, newFolderPath: string, force?: boolean) {
	let sdkFolder = getFirstFolderPath();
	const configurationPath = path.join(newFolderPath, '.vscode', 'c_cpp_properties.json');
	const config = loadJson(configurationPath, true);

	if (!sdkFolder || !config) {
		return;
	}

	// Set environemnt variable, it refered by include paths in Spresense SDK configuration at below.
	if ('env' in config) {
		config.env.mySpresenseSdkPath = sdkFolder;
	} else {
		config.env = { mySpresenseSdkPath: sdkFolder};
	}

	// Add SDK include paths configuration
	const sdkConfig = loadJson(path.join(context.extensionPath, 'data', 'config.json'), false);
	if(!sdkConfig) {
		vscode.window.showErrorMessage(nls.localize("spresense.src.cpp.config.error", "Preset configuration not exist. Please re-install extension."));
		return;
	}
	if (!('configurations' in config)) {
		config['configurations'] = [sdkConfig];
	} else {
		if (config.configurations.some((o: any) => o?.name === 'Spresense SDK')) {
			if (force) {
				config.configurations.map((o: any) => o?.name === 'Spresense SDK' ? sdkConfig : o);
			}
		} else {
			config.configurations.push(sdkConfig);
		}
	}

	fs.writeFileSync(configurationPath, JSON.stringify(config, null, 4));
}

/**
 * Update tasks/launch config file from new configuration
 *
 * This function update a configuration file (tasks.json/launch.json) from
 * new configurations. And keep user original configuration.
 *
 * @param config Workspace configuration from 'vscode.workspace.getConfiguration'
 * @param section Key of configuration list from workspace configuration
 * @param configs New configurations
 * @param identKey Key of label name in configuration list
 * @param version Version number for configuration format
 */
async function updateConfiguration(config: vscode.WorkspaceConfiguration, section: string, configs: ConfigInterface[], identKey: string, version?: string | undefined) {
	let configVersion: string = '2.0.0';
	let currentConfigs = config.get(section);
	let updateConfigs: ConfigInterface[] = configs;

	/* If configuration is set, use it for configuration format */
	if (version) {
		configVersion = version;
	}

	/* Filter current configurations for just update spresense configurations.
	 * If not a auto generated spresense configuration, keep it in configuration.
	 */
	if (Array.isArray(currentConfigs)) {
		currentConfigs.forEach((conf) => {
			if (!configs.some((item) => {
				return conf[identKey] === item[identKey];
			})) {
				updateConfigs.push(conf);
			}
		});
	}

	/* Write updated configurations into json file */
	await config.update('version', configVersion, vscode.ConfigurationTarget.WorkspaceFolder);
	await config.update(section, updateConfigs, vscode.ConfigurationTarget.WorkspaceFolder);
}

async function sdkTaskConfig(newFolderUri: vscode.Uri, context: vscode.ExtensionContext) {
	const newFolderPath = newFolderUri.fsPath;
	const extensionPath = context.extensionPath;
	let tasksConfig = vscode.workspace.getConfiguration('tasks', newFolderUri);

	if (!vscode.workspace.workspaceFolders) {
		return;
	}

	const isAppfolder = !isSpresenseSdkFolder(newFolderPath);

	let buildKernelTask = tasks.buildKernelTask;
	let buildTask = tasks.buildTask;
	let sdkCleanTask = tasks.sdkCleanTask;
	let kernelCleanTask = tasks.kernelCleanTask;
	let flashTask = tasks.flashTask;
	let cleanFlashTask = tasks.flashCleanTask;

	// Tweak each tasks for user environment

	buildKernelTask.options.env.ISAPPFOLDER = `${isAppfolder}`;
	buildTask.options.env.ISAPPFOLDER = `${isAppfolder}`;
	sdkCleanTask.options.env.ISAPPFOLDER = `${isAppfolder}`;
	kernelCleanTask.options.env.ISAPPFOLDER = `${isAppfolder}`;

	flashTask.args.push(isAppfolder ? 'out/*.nuttx.spk' : 'sdk/nuttx.spk');

	// prepare_debug.sh takes 2nd argument for platform, it changes tools directory
	// in the SDK.
	let platform = getExactPlatform();
	switch (platform) {
		case 'win32':
		case 'wsl':
			platform = 'windows';
			break;
		case 'darwin':
			platform = 'macos';
			break;
	}
	cleanFlashTask.args[1] = platform;

	const allTasks = [
		buildKernelTask,
		buildTask,
		kernelCleanTask,
		sdkCleanTask,
		flashTask,
		tasks.flashWorkerTask,
		cleanFlashTask,
		tasks.flashBootTask
	];

	/* Apply into tasks.json */
	await updateConfiguration(tasksConfig, 'tasks', allTasks, 'label');

	/* Copy script file */
	try {
		fs.copyFileSync(path.join(extensionPath, 'scripts', 'build.sh'),
						path.join(newFolderPath, '.vscode', 'build.sh'));
		fs.copyFileSync(path.join(extensionPath, 'resources', 'makefiles', 'application.mk'),
						path.join(newFolderPath, '.vscode', 'application.mk'));
		fs.copyFileSync(path.join(extensionPath, 'resources', 'makefiles', 'worker.mk'),
						path.join(newFolderPath, '.vscode', 'worker.mk'));
	} catch (err) {
		console.log(err);
		vscode.window.showErrorMessage(`${err}`);
	}
}

/**
 * Setup debug environment
 *
 * This function update a launch.json file for debugging application code
 * with ICE debugger.
 *
 * @param targetFolder Path to target project folder or SDK repository
 *
 * @returns true if updated, false is error.
 */

function setupDebugEnv(targetFolder: vscode.Uri): boolean {
	let elfFile: string;
	let cwd: string;
	let folder = vscode.workspace.getWorkspaceFolder(targetFolder);
	if (!folder) {
		return false;
	}

	const sdkFolder = getFirstFolder(); // XXX: This routine must not be here.
	if (!sdkFolder) {
		return false;
	}

	// Target ELF file is differ between SDK repository and user project.
	// And CWD and SDK path are also differ, about workspace folder referencing variables.

	let sdkpath;
	if (isSpresenseSdkFolder(folder.uri.fsPath)) {
		elfFile = './nuttx';
		cwd = "${workspaceFolder}/sdk";
		sdkpath = "${workspaceFolder}";
	} else {
		elfFile = './out/${workspaceFolderBasename}.nuttx';
		cwd = "${workspaceFolder:" + folder.name + "}";
		sdkpath = "${workspaceFolder:" + sdkFolder.name + "}";
	}

	launch.addMainTarget(folder.uri, elfFile, cwd, sdkpath);

	// Add .gdbinit file from SDK repository. This file needs to show the NuttX thread information.

	let src = path.join(sdkFolder.uri.fsPath, 'sdk', 'tools', '.gdbinit');
	const dest = path.join(folder.uri.fsPath, '.vscode', '.gdbinit');
	try {
		fs.copyFileSync(src, dest);
	} catch (err) {
		// Retry with source file in the top of the SDK repository. This is for old version repository.
		src = path.join(sdkFolder.uri.fsPath, 'sdk', '.gdbinit');
		try {
			fs.copyFileSync(src, dest);
		} catch (err) {
			vscode.window.showErrorMessage(nls.localize("spresense.src.debug.gdbinit.error", "Cannot copy .gdbinit file."));
			return false;
		}
	}

	return true;
}

function setSpresenseButton() {
	/* Enable or Disable spresense comands and buttons */
	if (vscode.window.activeTextEditor &&
		vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)) {

		/* Enable Spresense button */
		vscode.commands.executeCommand('setContext', 'spresenseButtonEnabled', true);
	} else {

		/* Disable Spresense button */
		vscode.commands.executeCommand('setContext', 'spresenseButtonEnabled', false);
	}
}

function getTargetWorkspaceFolder(selectedUri: vscode.Uri | undefined): string | undefined {
	if (selectedUri && vscode.workspace.getWorkspaceFolder(selectedUri)) {
		/* Folder tree or Button case */
		const wsFolder = vscode.workspace.getWorkspaceFolder(selectedUri);
		return wsFolder ? wsFolder.uri.fsPath : undefined;
	} else if (vscode.window.activeTextEditor) {
		/* Command palette case */
		const fileUri = vscode.window.activeTextEditor.document.uri;
		const wsFolder = vscode.workspace.getWorkspaceFolder(fileUri);
		return wsFolder ? wsFolder.uri.fsPath : undefined;
	}

	return undefined;
}

/* For general commands */
function registerCommonCommands(context: vscode.ExtensionContext) {
	/* Register msys command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.msys.path', async () => {
		/* Only enable for Windows */

		const defaultMsysPath = `${process.env.SystemDrive}\\msys64`;
		const conf = vscode.workspace.getConfiguration();
		const folderUris: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
			defaultUri: vscode.Uri.file(defaultMsysPath),
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false
		});

		if (folderUris && folderUris.length) {
			/* If directory opened, set shell path into settings.json */
			const msysPath = folderUris[0].fsPath;

			/* Check Msys install path */
			if (!isMsysInstallFolder(msysPath)) {
				/* If necessary directory missing, target direcgtory is invalid */
				vscode.window.showErrorMessage(nls.localize("spresense.src.msys.error.path", "{0} is not a Msys install directory. Please set valid path (ex. c:\\msys64)", msysPath));

				return;
			}

			await conf.update(configMsysPathKey, msysPath, vscode.ConfigurationTarget.Global);

			if (isSpresenseEnvironment()) {
				/* Reset spresense workspace, if spresense workspace opened */
				spresenseSdkSetup(context);
			}
		}
	}));
}

/**
 * Get bootloader download page URL
 *
 * This function get Web URL for downloading new bootloader.
 * If no need to update bootloader, return undefined.
 *
 * @param requestPath Path to version.json
 * @param suggestPath Path to stored_version.json
 * @returns Download page URL.(If no need to update, return undefined.)
 */

function getBootloaderDownloadUrl(requestPath: string, suggestPath: string): string | undefined {
	const versionKey = 'LoaderVersion';
	const requestJson = loadJson(requestPath, true);
	const suggestJson = loadJson(suggestPath, true);

	if (!suggestJson || !requestJson) {
		return undefined;
	}

	if (!suggestJson[versionKey] || requestJson[versionKey] !== suggestJson[versionKey]) {
		/* If stored_version.json doesn't have VersionKey or version is not same, need to update. */
		return requestJson['DownloadURL'];
	} else {
		/* No need to update */
		return undefined;
	}
}

/**
 * Install downloaded boootloader files into firmware directory
 *
 * This function install all bootloader espk files into firmware directory
 * for flashing bootloader.
 *
 * @param context ExtensionContext for this extension
 * @param firmwarePath Path to install directory
 */

async function installBootloader(context: vscode.ExtensionContext, firmwarePath: string, zipFilePath: string) {
	const temporaryKey = md5(new Date().toString()).slice(1, 9);
	const tempPath = path.join(context.storagePath || context.globalStoragePath, '..', `spresenseBootloader_${temporaryKey}`);
	const versionJson = path.join(firmwarePath, 'version.json');
	const storeJson = path.join(tempPath, 'stored_version.json');

	/* Create temporary directory for extracting zip file */
	fs.mkdirSync(tempPath);

	/* Extract downloaded bootloader zip file */
	await unzip(zipFilePath, { dir: tempPath });

	/* Check correct bootloader zip file contents */
	if (!fs.existsSync(storeJson) || !fs.statSync(storeJson).isFile()) {
		vscode.window.showErrorMessage(nls.localize("spresense.src.bootloader.error.invalid", "Invalid zip file slected. Please check download zip file({0}).", zipFilePath));
		return;
	}

	/* Check bootloader vertion */
	if (getBootloaderDownloadUrl(versionJson, storeJson)) {
		vscode.window.showErrorMessage(nls.localize("spresense.src.bootloader.error.version", "Different bootloader zip file selected. Please check zip file."));
	} else {
		const fileList = fs.readdirSync(tempPath);

		/* Copy binary files into firmware directory from temporary directory */
		fileList.forEach((file) => {
			fs.copyFileSync(path.join(tempPath, file), path.join(firmwarePath, file));
			fs.unlinkSync(path.join(tempPath, file));
		});

		/* Clean temporary directory */
		fs.rmdir(tempPath, (err) => {
			console.log(err);
		});
	}
}

/**
 * Prepare bootloader files
 *
 * This function prepare the bootloader binaries. If spresense repository doesn't have
 * bootloader binaries or mismatched binaries, show message and install steps with UI.
 *
 * @param context ExtensionContext for this extension
 * @param firmwarePath Path to install directory
 */

async function prepareBootloader(context: vscode.ExtensionContext) {
	/* Extension itself need to use platform specific path */
	const sdkPath: string | undefined = vscode.workspace.getConfiguration().get('spresense.sdk.tools.path');

	if (!sdkPath) {
		vscode.window.showWarningMessage(nls.localize("spresense.src.bootloader.error.sdkpath", "Your workspace is not setup yet for spresense extension."));
		return;
	}

	const firmwarePath = path.join(sdkPath, '..', '..', 'firmware', 'spresense');
	const versionJsonPath = path.join(firmwarePath, 'version.json');
	const storedVersionJsonPath = path.join(firmwarePath, 'stored_version.json');

	if (!fs.existsSync(versionJsonPath) || !fs.statSync(versionJsonPath).isFile()) {
		vscode.window.showWarningMessage(nls.localize("spresense.src.bootloader.error.info", "Your Spresense repository folder does not contain a firmware information file. Please check if spresense repository is correctly cloned."));
		return;
	}

	/* Get correct bootloader version.(If don't need to update, return undefined.) */
	const downloadUrl = getBootloaderDownloadUrl(versionJsonPath, storedVersionJsonPath);

	if (!downloadUrl) {
		/* No need to download */
		return;
	}

	/* Show pop up for confirm to jump download page at browser */
	const reply = await vscode.window.showInformationMessage(nls.localize("spresense.src.bootloader.confirm", "To install the bootloader, you must download the bootloader archive with a web browser. Are you sure to open the download page? {0}", downloadUrl), { modal: true }, "OK");
	if (reply === 'OK') {
		/* Jump to download page */
		vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(downloadUrl));
	}

	/* Show next step */
	await vscode.window.showInformationMessage(nls.localize("spresense.src.bootloader.done", "Please select downloaded zip file for install."), "OK");

	/* Show bootloader zip open dialog */
	const archiveUris: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		filters: {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			"ZIP file": ["zip"]
		}
	});

	if (!archiveUris || archiveUris.length !== 1) {
		return;
	}

	/* Install bootloader into spresense repository */
	await installBootloader(context, firmwarePath, archiveUris[0].fsPath);
}

async function burnBootloader(context: vscode.ExtensionContext) {
	const wsFolders = vscode.workspace.workspaceFolders;

	if (!wsFolders) {
		return;
	}

	/* Prepare bootloader first. If bootloader binary not exist, install it */
	await prepareBootloader(context);

	/* Kick bootloader flash task */
	triggerSpresenseTask(wsFolders[0].uri, tasks.flashBootTask.label);
}

/**
 * Trigger task by task label and folder path
 *
 * This function trigger a task from task label and folder path.
 *
 * @param selectedUri Uri to selected tree view item
 * @param label Label name of task
 */

async function triggerSpresenseTask(selectedUri: vscode.Uri | undefined, label: string) {
	let wsFolderPath: string | undefined;
	const wsFolders = vscode.workspace.workspaceFolders;

	if (!wsFolders) {
		return;
	}

	if (selectedUri) {
		/* Trigger by file right click */
		wsFolderPath = getTargetWorkspaceFolder(selectedUri);
	} else if (wsFolders.length === 1) {
		/* workspace has just only one folder, so use it */
		wsFolderPath = wsFolders[0].uri.fsPath;
	} else {
		/* Open by command pallet, use folder picker */
		const wsFolder = await vscode.window.showWorkspaceFolderPick();
		if (wsFolder) {
			wsFolderPath = wsFolder.uri.fsPath;
		}
	}

	if (!wsFolderPath) {
		/* Canceled */
		return;
	}

	if (!checkSdkCompatibility(sdkVersion, vscode.Uri.file(wsFolderPath))) {
		vscode.window.showErrorMessage(nls.localize("spresense.src.error.compatibility", "Your project folder {0} does not compatible with using Spresense SDK.", wsFolderPath), {modal: true}, "OK");
		return;
	}

	vscode.tasks.fetchTasks().then((tasks: vscode.Task[]) => {
		const targetTask = tasks.find((task) => {
			return task.scope &&
				   task.scope !== vscode.TaskScope.Global &&
				   task.scope !== vscode.TaskScope.Workspace &&
				   task.name === label &&
				   task.scope.uri.fsPath === wsFolderPath;
		});

		if (targetTask) {
			/* Execute a task */
			vscode.tasks.executeTask(targetTask);
		}
	});
}

/* For Spresense workspace commands */
function registerSpresenseCommands(context: vscode.ExtensionContext) {
	/* Register kernel build command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.build.kernel', (selectedUri) => {
		/* Do the kernel build */
		triggerSpresenseTask(selectedUri, tasks.buildKernelTask.label);
	}));

	/* Register build command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.build', (selectedUri) => {
		/* Do the build */
		triggerSpresenseTask(selectedUri, tasks.buildTask.label);
	}));

	/* Register clean kernel command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.clean.kernel', (selectedUri) => {
		/* Do the Kernel clean */
		triggerSpresenseTask(selectedUri, tasks.kernelCleanTask.label);
	}));

	/* Register clean sdk command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.clean.sdk', (selectedUri) => {
		/* Do the SDK Clean */
		triggerSpresenseTask(selectedUri, tasks.sdkCleanTask.label);
	}));

	/* Register flash command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.flash', (selectedUri) => {
		/* Do the flash */
		triggerSpresenseTask(selectedUri, tasks.flashTask.label);
	}));

	/* Register burn bootloader command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.burn.bootloader', () => {
		/* Burn bootloader */
		burnBootloader(context);
	}));

	/* Register update project settings command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.update.project.folder', () => {
		/* Choose project */
		vscode.window.showWorkspaceFolderPick().then((folder) => {
			if (folder) {
				/* Update project folder settings */
				spresenseEnvSetup(context, folder.uri, true);
			}
		});
	}));
}

async function updateSettings(context: vscode.ExtensionContext, progress: vscode.Progress<{ message?: string; increment?: number;}>) {
	let termConf = vscode.workspace.getConfiguration('terminal.integrated');
	const platform = getExactPlatform();

	if (platform === 'win32') {
		const msysPath: string | undefined = vscode.workspace.getConfiguration().get(configMsysPathKey);
		const winShPath = termConf.get('shell.windows');

		if (msysPath && isMsysInstallFolder(msysPath)) {
			const bashPath = path.join(msysPath, 'usr', 'bin', 'bash.exe');

			if (!winShPath || bashPath !== winShPath) {
				await termConf.update('shell.windows', bashPath, vscode.ConfigurationTarget.Workspace);

				/* Reload configuration */
				termConf = vscode.workspace.getConfiguration('terminal.integrated');
			}
		} else if (msysPath) {
			/* If necessary directory missing, target directory is invalid */
			vscode.window.showErrorMessage(nls.localize("spresense.src.setting.error.msys", "{0} is not a Msys install directory. Please set valid path (ex. c:\\msys64)", msysPath));
		} else {
			vscode.window.showErrorMessage(nls.localize("spresense.src.setting.error.nomsys", "Please set Msys install path first. ('F1' -> 'Spresense: Set MSYS install location'"));
		}
	}

	/* Initial check done */
	progress.report({increment: 20, message: nls.localize("spresense.src.setting.progress.check", "Checking operating system done.")});

	const ret = cp.execSync(path.resolve(context.extensionPath, 'helper', 'showenv.sh')).toString().trim().split('\n');
	const envPath = ret[0];
	const toolchainPath = ret[1].split(':')[1];

	/* Prepare shell environment done */
	progress.report({increment: 20, message: nls.localize("spresense.src.setting.progress.env", "Get shell environment done.")});

	const osName = {
		win32: 'windows',
		linux: 'linux',
		darwin: 'osx',
		wsl: 'linux'
	}[platform];

	/* Update terminal PATH variable to be able to call the cross toolchain. This process is the same as 'source ~/spresenseenv/setup'. */
	termConf.update(`env.${osName}`,{
		// eslint-disable-next-line @typescript-eslint/naming-convention
		'PATH': envPath
	}, vscode.ConfigurationTarget.Workspace);

	progress.report({increment: 20, message: nls.localize("spresense.src.setting.progress.valid", "Correct toolchain path done.")});

	const debugConf = vscode.workspace.getConfiguration('cortex-debug');
	const sprEnvConf = vscode.workspace.getConfiguration('spresense.env');

	if (platform === 'win32') {
		const msysPath: string | undefined = vscode.workspace.getConfiguration().get(configMsysPathKey);

		if (msysPath) {
			sprEnvConf.update('toolchain.path', path.join(msysPath, toolchainPath), vscode.ConfigurationTarget.Workspace);
			debugConf.update('armToolchainPath', path.join(msysPath, toolchainPath), vscode.ConfigurationTarget.Workspace);
			debugConf.update('openocdPath', path.join(msysPath, toolchainPath, 'openocd'), vscode.ConfigurationTarget.Workspace);
		}
	} else if (platform === 'wsl') {
		// Set windows binary path for Cortex-Debug extension can find the cross gdb and openocd.
		const p = path.resolve(toolchainPath, '..', '..', 'windows', 'bin');
		sprEnvConf.update('toolchain.path', toolchainPath, vscode.ConfigurationTarget.Workspace);
		debugConf.update('armToolchainPath', p, vscode.ConfigurationTarget.Workspace);
		debugConf.update('openocdPath', path.resolve(p, 'openocd'), vscode.ConfigurationTarget.Workspace);
	} else {
		sprEnvConf.update('toolchain.path', toolchainPath, vscode.ConfigurationTarget.Workspace);
		debugConf.update('armToolchainPath', toolchainPath, vscode.ConfigurationTarget.Workspace);
		debugConf.update('openocdPath', path.resolve(toolchainPath, 'openocd'), vscode.ConfigurationTarget.Workspace);
	}
}

function isSpresenseEnvironment() {
	let firstFolder = getFirstFolderPath();

	if (!firstFolder) {
		/* No folders or workspaces are open */
		return false;
	}

	/* If first folder is spresense, set sdk path to settings */
	if (isSpresenseSdkFolder(firstFolder)) {
		/* Get SDK Version */
		sdkVersion = getSDKVersion(firstFolder);
		if (sdkVersion.str === UNKNOWN_SDK_VERSION) {
			vscode.window.showErrorMessage(nls.localize("spresense.src.error.version", 'Cannot read SDK version.'));
		}

		/* Set SDK version into context */
		vscode.commands.executeCommand('setContext', 'spresenseSdkVersionMajor', `${sdkVersion.major}`);
		vscode.commands.executeCommand('setContext', 'spresenseSdkVersionMinor', `${sdkVersion.minor}`);
		vscode.commands.executeCommand('setContext', 'spresenseSdkVersionPatch', `${sdkVersion.patch}`);

		return true;
	} else {
		if (fs.existsSync(path.join(firstFolder, '.vscode', 'spresense_prj.json'))) {
			/* Spresense project folder without add spresense repository */
			vscode.window.showWarningMessage(nls.localize("spresense.src.error.noenv", "Your folder is setting up for Spresense. \
			But there are not spresense repository in top of workspace folders."));
		}
		return false;
	}
}

function spresenseSdkSetup(context: vscode.ExtensionContext) {
	let firstFolder = getFirstFolderPath();
	let configuration = vscode.workspace.getConfiguration();

	if (!firstFolder) {
		return;
	}

	/* Required platform dependent path */
	const sdkToolsFolder = path.join(firstFolder, 'sdk', 'tools');

	/* Win32 Path to Posix Path */
	if (process.platform === 'win32') {
		firstFolder = win32ToPosixPath(firstFolder);
	}

	/* Update configuration */
	configuration.update(configSdkPathKey, firstFolder, vscode.ConfigurationTarget.Workspace);
	configuration.update(configSdkToolsPathKey,sdkToolsFolder, vscode.ConfigurationTarget.Workspace);

	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: nls.localize("spresense.src.setting.progress.title", 'Spresense setup'),
		cancellable: false
	}, async (progress, token) => {

		progress.report({increment: 20, message: nls.localize("spresense.src.setting.progress.start", "Started to setup.")});

		/* Update settings.json */
		await updateSettings(context, progress);
		progress.report({increment: 100, message: nls.localize("spresense.src.setting.progress.done", "Setup complete.")});

		return new Promise<void>((resolve) => {
			setTimeout(() => {
				resolve();
			}, 5000);
		});
	});
}

/**
 * Add spresense_prj.json file for detecting spresense project folder.
 * If spresense_prj.json is exist, spresense extension detect it to spresense project folder
 */

function createSpresenseConfFile(folderPath: string) {
	const sprConfFile = path.resolve(folderPath, '.vscode', 'spresense_prj.json');
	const data = {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		SdkVersion: sdkVersion.str,
		// eslint-disable-next-line @typescript-eslint/naming-convention
		SpresenseExtInterfaceVersion: spresenseExtInterfaceVersion
	};

	try {
		fs.writeFileSync(sprConfFile, JSON.stringify(data, null, 4));
	} catch (err) {
		vscode.window.showErrorMessage(nls.localize("spresense.src.create.conf.error", "Cannot create file ({0}).", sprConfFile));
	}
}

function isAlreadySetup(folderPath: string): boolean {
	const jsonItem = loadSpresenseConfFile(folderPath);

	if (!jsonItem) {
		/* Not created yet */
		return false;
	} else {
		const projectVersion: number = parseInt(jsonItem['SpresenseExtInterfaceVersion']);

		if (!checkSdkCompatibility(sdkVersion, vscode.Uri.file(folderPath))) {
			vscode.window.showWarningMessage(nls.localize("spresense.src.warning.compatibility", "Your project folder {0} does not compatible with using Spresense SDK. Please use compatible version of Spresense SDK.", folderPath));
		}

		/* TODO: WIll implement for update .vscode */
		if (isNaN(projectVersion)) {
			/* Force update for alpha version. There are no compatibility between alpha version and later version.
			 * So, force update.
			 */
			return false;
		} else if (projectVersion > spresenseExtInterfaceVersion) {
			/* If project folder created by newer version of extension, show notice to update extension. */
			vscode.window.showWarningMessage(nls.localize("spresense.src.error.newer", "Project folder was created by newer version of Spresense extension. Please update Spresense extension."));
			return true;
		} else if (projectVersion < spresenseExtInterfaceVersion) {
			/* If project folder created by older version of extension, show notice to update project settings. */
			vscode.window.showWarningMessage(nls.localize("spresense.src.error.older", "Project folder was created by older version of Spresense extension. Please update project folder by F1 -> '{0}'.", nls.localize("spresense.src.update.project.folder", "Spresense: Update project folder settings")));
			return true;
		} else {
			/* Keep current .vscode */
			return true;
		}
	}
}

async function spresenseEnvSetup(context: vscode.ExtensionContext, folderUri: vscode.Uri, force?: boolean) {
	const wsFolders = vscode.workspace.workspaceFolders;
	const folderPath = folderUri.fsPath;

	if (!wsFolders) {
		return;
	}

	if (folderPath.indexOf(' ') !== -1) {
			/* If folderPath contain ' ', show error and do not setup */
			vscode.window.showErrorMessage(nls.localize("spresense.src.setting.error.space", "Spresense extension can not use this folder that contain ' '. "));

			/* Remove folder in advance */
			removeWorkspaceFolder(folderUri);
			return;
	}

	if (isSpresenseSdkFolder(folderPath) && folderUri !== wsFolders[0].uri) {
		/* Remove 2nd Spresense SDK folder */
		removeWorkspaceFolder(folderUri);

		/* If folderUri is SDK and it is not a first folder, that is multiple SDK */
		vscode.window.showErrorMessage(nls.localize("spresense.src.setting.error.multi", "Spresense extension can not use multiple Spresense SDK. \
		Please remove one of spresense folder from workspace."));
		return;
	}

	createVscode(folderPath);

	// Setup C/C++ Extension include paths to SDK ones.
	sdkCppConfig(context, folderPath, force);

	let configfile = path.join(folderPath, 'nuttx', '.config');
	if (!fs.existsSync(configfile)) {
		configfile = path.join(folderPath, 'sdk.config');
	}
	if (launch.includeWin32Path(folderUri) || util.isDifferentHostConfig(configfile)) {
		const reply = await vscode.window.showInformationMessage(nls.localize("spresense.src.warning.platformmismatch",
		"The project folder {0} is created on different host but it cannnot be used on this systems.\nIt is necessary to convert the configuration, do you want to convert it?", folderPath),
			{ modal: true}, 'Yes');
		if (reply === 'Yes') {
			launch.win32ToPosixPath(folderUri);
			util.updateHostConfiguration(configfile, path.join(wsFolders[0].uri.fsPath, 'nuttx'));
		}
	}

	if (!force && isAlreadySetup(folderPath)) {
		return;
	}

	/* For build/flash task */
	await sdkTaskConfig(folderUri, context);

	if (!setupDebugEnv(folderUri)) {
		return;
	}

	/* Create file for storing spresense environment */
	createSpresenseConfFile(folderPath);
}

/**
 * Check error usage for notice
 *
 * This function shows warning if user add spresense sdk folder as new folder as not top
 * of workspace.
 *
 */

function checkErrorUsage() {
	const wsFolders = vscode.workspace.workspaceFolders;

	if (!wsFolders || wsFolders.length < 2) {
		/* No need to check */
		return;
	}

	wsFolders.slice(1).forEach((folder) => {
		if (isSpresenseSdkFolder(folder.uri.fsPath)) {
			/* If new folder is spresense sdk repository,
			 * inform usage about spresense extension.
			 */
			const basename = path.basename(folder.uri.fsPath);

			vscode.window.showWarningMessage(nls.localize("spresense.src.activeate.error.usage", "Spresense repository folder needs to be placed at \
			the top of workspace. Please move {0} to the top.", basename));
		}
	});
}

export function activate(context: vscode.ExtensionContext) {
	nls.config(context);

	/* Detect Spresense environment */
	if (isSpresenseEnvironment()) {
		/* Handle workspace change event */
		context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(async (event: vscode.WorkspaceFoldersChangeEvent) => {
			/* 1sec to wait for the completion of folder addition.
			 * TODO: Json file must not update by this event. Move this operation to such as build configuration or item creation timing.
			 */
			await new Promise(resolve => setTimeout(resolve, 1000));

			/* If in folder view windows, force deactivate when achieve this event. In this case, skip this operation.
			 * After re-open the window, this operation will execute by folder scan.
			 * TODO: This is just a temporary solution. Need to implement deactivate() function for update json file more secure.
			 */
			if (vscode.workspace.workspaceFile) {
				event.added.forEach((addedFolder) => {
					/* Create several json files for new folder */
					spresenseEnvSetup(context, addedFolder.uri);
				});
			}
		}));

		let watcher = vscode.workspace.createFileSystemWatcher("**/* *", false, true, true);
		context.subscriptions.push(watcher.onDidCreate((event) => {
			/* This event is triggered from file creation or coping or moving.
			 * Therefore, it is dangerous to delete. So just only to show warning message.
			 */
			vscode.window.showWarningMessage(
				nls.localize("spresense.src.create.error.space", "Spresense extension can not use this new folder or file that contain ' '. ")
			);
		}));

		context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((event) => {
			/* Set Spresense button */
			setSpresenseButton();
		}));

		/* Setup every activate timing for open folder */
		spresenseSdkSetup(context);

		if (vscode.workspace.workspaceFolders) {
			vscode.workspace.workspaceFolders.forEach((folder) => {
				/* Create several json files for new folder */
				spresenseEnvSetup(context, folder.uri);
			});
		}

		/* Register Commands */
		registerSpresenseCommands(context);
	} else {
		/* For error handling */

		/* Handle workspace change event when new folder added */
		context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders((event) => {
			/* Check new folder is not SDK */
			checkErrorUsage();
		}));

		/* Check new folder is not SDK when activate */
		checkErrorUsage();
	}

	/* Register common commands */
	registerCommonCommands(context);
}

export function deactivate() {
}
