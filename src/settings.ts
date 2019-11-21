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
import * as common from './common';

const spresenseExtInterfaceVersion: number = 1000;

const configSdkPathKey = 'spresense.sdk.path';
const configSdkToolsPathKey = 'spresense.sdk.tools.path';
const configMsysPathKey = 'spresense.msys.path';

/* These label is only for tasks.json. Not a command title.  */
const taskBuildKernelLabel = 'Build kernel';
const taskBuildLabel = 'Build application';
const taskSdkCleanLabel = 'Clean application';
const taskkernelCleanLabel = 'Clean kernel';
const taskFlashLabel = 'Build and flash';
const taskWorkerFlashLabel = 'Flash worker';
const taskCleanFlashLabel = 'Clean flash';
const taskBootFlashLabel = 'Burn bootloader';

/* For component creation */
const createAppMode: string = 'app';
const createWorkerMode: string = 'worker';

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

	if (!fs.existsSync(vscodePath) || !fs.statSync(vscodePath).isDirectory()) {
		/* If .vscode does not exist, create it */
		fs.mkdirSync(vscodePath);
	}
}

function getFirstFolderPath(): string | undefined {
	let firstFolder:string | undefined;
	let wsFolders = vscode.workspace.workspaceFolders;

	if (wsFolders === undefined || wsFolders.length === 0) {
		/* No folders or workspaces are open */
		return undefined;
	}

	/* Get first folder path */
	firstFolder = wsFolders[0].uri.fsPath;

	return firstFolder;
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

function loadJson(file: string, create: boolean) {
	try {
		return JSON.parse(fs.readFileSync(file, 'utf-8'));
	} catch (err) {
		if (err) {
			if (create) {
				return JSON.parse('{}');
			} else {
				return null;
			}
		}
	}
}

function sdkCppConfig(context: vscode.ExtensionContext, newFolderPath: string) {
	/* Interface for C/C++ Extension .json file */
	interface CppInterface {
		[key: string]: string;
	}

	let sdkFolder = getFirstFolderPath();
	let extensionPath = context.extensionPath;

	let configurationPath = path.join(newFolderPath, '.vscode', 'c_cpp_properties.json');
	let presetConfigPath = path.join(extensionPath, 'data', 'config.json');

	const jsonObj = loadJson(configurationPath, true);

	if (!sdkFolder) {
		return;
	}

	/* Create .vscode */
	createVscode(newFolderPath);

	/* Prepare 'env' */
	if ( !('env' in jsonObj) ) {
		jsonObj['env'] = {};
	}

	/* Specify Spresense SDK Path */
	jsonObj['env']['mySpresenseSdkPath'] = sdkFolder;

	/* Prepare 'configurations' */
	if ( !('configurations' in jsonObj) ) {
		jsonObj['configurations'] = [];
	}

	/* If already exists, remove it only */
	const configs = jsonObj['configurations'].filter((value: CppInterface) => {
		return value['name'] !== 'Spresense SDK';
	});

	/* Replace filtered configurations */
	jsonObj['configurations'] = configs;

	/* Load Spresense SDK configuration */
	const sdkConfig = loadJson(presetConfigPath, false);

	if(!sdkConfig) {
		vscode.window.showErrorMessage(nls.localize("spresense.src.cpp.config.error", "Preset configuration not exist. Please re-install extension."));
		return;
	}

	/* Push Spresense SDK config into configurations */
	jsonObj['configurations'].push(sdkConfig);

	/* Save modified c_cpp_properties.json */
	fs.writeFileSync(configurationPath, JSON.stringify(jsonObj, null, 4));
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
	let buildKenelTask: ConfigInterface = {};
	let buildTask: ConfigInterface = {};
	let sdkCleanTask: ConfigInterface = {};
	let kernelCleanTask: ConfigInterface = {};
	let flashTask: ConfigInterface = {};
	let flashWrokerTask: ConfigInterface = {};
	let flashCleanTask: ConfigInterface = {};
	let flashBootTask: ConfigInterface = {};
	let isAppfolder: boolean | undefined;

	if (!vscode.workspace.workspaceFolders) {
		return;
	}

	/* If folder is not a SDK's onem, it is app folder */
	isAppfolder = !common.isSpresenseSdkFolder(newFolderPath);

	/* Build Kernel Task */
	buildKenelTask['label'] = taskBuildKernelLabel;
	buildKenelTask['type'] = 'shell';
	buildKenelTask['command'] = '.vscode/build.sh buildkernel';
	buildKenelTask['options'] = {
		"env": {
			"SDK_PATH": "${config:spresense.sdk.path}",
			"ISAPPFOLDER": `${isAppfolder}`
		}};
	buildKenelTask['group'] = 'build';
	buildKenelTask['problemMatcher'] = ['$gcc'];

	/* Build Task */
	buildTask['label'] = taskBuildLabel;
	buildTask['type'] = 'shell';
	buildTask['command'] = '.vscode/build.sh build';
	buildTask['options'] = {
		"env": {
			"SDK_PATH": "${config:spresense.sdk.path}",
			"ISAPPFOLDER": `${isAppfolder}`
		}};
	buildTask['group'] = 'build';
	buildTask['problemMatcher'] = ['$gcc'];

	/* Build Clean Task */
	sdkCleanTask['label'] = taskSdkCleanLabel;
	sdkCleanTask['type'] = 'shell';
	sdkCleanTask['command'] = '.vscode/build.sh clean';
	sdkCleanTask['options'] = {
		"env": {
			"SDK_PATH": "${config:spresense.sdk.path}",
			"ISAPPFOLDER": `${isAppfolder}`
		}};
	sdkCleanTask['group'] = 'build';
	sdkCleanTask['problemMatcher'] = ['$gcc'];

	/* Kernel Build Clean Task */
	kernelCleanTask['label'] = taskkernelCleanLabel;
	kernelCleanTask['type'] = 'shell';
	kernelCleanTask['command'] = '.vscode/build.sh cleankernel';
	kernelCleanTask['options'] = {
		"env": {
			"SDK_PATH": "${config:spresense.sdk.path}",
			"ISAPPFOLDER": `${isAppfolder}`
		}};
	kernelCleanTask['group'] = 'build';
	kernelCleanTask['problemMatcher'] = ['$gcc'];

	/* Flash and build Task */
	flashTask['label'] = taskFlashLabel;
	flashTask['type'] = 'shell';
	flashTask['dependsOrder'] = 'sequence',
	flashTask['dependsOn'] = [taskBuildLabel, taskWorkerFlashLabel];
	flashTask['command'] = 'cd \"${workspaceFolder}\";${config:spresense.sdk.path}/sdk/tools/flash.sh -c ${config:spresense.serial.port} -b ${config:spresense.flashing.speed}';
	if (isAppfolder) {
		flashTask['command'] += ` out/*.nuttx.spk`;
	} else {
		flashTask['command'] += ' sdk/nuttx.spk';
	}
	flashTask['group'] = 'test';
	flashTask['problemMatcher'] = ['$gcc'];

	/* Flash worker Task */
	flashWrokerTask['label'] = taskWorkerFlashLabel;
	flashWrokerTask['type'] = 'shell';
	flashWrokerTask['command'] = 'cd \"${workspaceFolder}\";if [ \"`echo out/worker/*`\" != \"out/worker/*\" ]; then ${config:spresense.sdk.path}/sdk/tools/flash.sh -w -c ${config:spresense.serial.port} -b ${config:spresense.flashing.speed} out/worker/*; fi;';
	flashWrokerTask['group'] = 'test';
	flashWrokerTask['problemMatcher'] = ['$gcc'];

	/* Clean flash Task */
	flashCleanTask['label'] = taskCleanFlashLabel;
	flashCleanTask['type'] = 'shell';
	flashCleanTask['command'] = '.vscode/clean_flash.sh -s ${config:spresense.sdk.path} -c ${config:spresense.serial.port}';
	flashCleanTask['group'] = 'test';
	flashCleanTask['problemMatcher'] = ['$gcc'];

	/* Clean flash Task */
	flashBootTask['label'] = taskBootFlashLabel;
	flashBootTask['type'] = 'shell';
	flashBootTask['command'] = '${config:spresense.sdk.path}/sdk/tools/flash.sh -l ${config:spresense.sdk.path}/firmware/spresense -c ${config:spresense.serial.port} -b ${config:spresense.flashing.speed}';
	flashBootTask['group'] = 'test';
	flashBootTask['problemMatcher'] = ['$gcc'];

	const allTasks = [
		buildKenelTask,
		buildTask,
		kernelCleanTask,
		sdkCleanTask,
		flashTask,
		flashWrokerTask,
		flashCleanTask,
		flashBootTask
	];

	/* Apply into tasks.json */
	await updateConfiguration(tasksConfig, 'tasks', allTasks, 'label');

	/* Copy script file */
	try {
		fs.copyFileSync(path.join(extensionPath, 'scripts', 'build.sh'),
						path.join(newFolderPath, '.vscode', 'build.sh'));
		fs.copyFileSync(path.join(extensionPath, 'scripts', 'clean_flash.sh'),
						path.join(newFolderPath, '.vscode', 'clean_flash.sh'));
	} catch (err) {
		console.log(err);
		vscode.window.showErrorMessage(`${err}`);
	}
}

/**
 * Update launch.json file for application debug
 *
 * This function update a launch.json file for debugging application code
 * with ICE JTAG.
 * Replace rules:
 *
 * @param newFolderUri Path to target project folder
 * @returns true if success to update, false otherwise.
 */

async function sdkLaunchConfig(newFolderUri: vscode.Uri): Promise<boolean> {
	const sdkFolder = getFirstFolderPath();
	const vsocodeFolder = path.join(newFolderUri.fsPath, '.vscode');
	let launch = vscode.workspace.getConfiguration('launch', newFolderUri);
	let cortexDebug: ConfigInterface = {};
	let elfFile: string | undefined;

	if (!vscode.workspace.workspaceFolders || !sdkFolder) {
		return false;
	}

	if (common.isSpresenseSdkFolder(newFolderUri.fsPath)) {
		/* SDK task definition */
		elfFile = 'sdk/nuttx';
	} else {
		/* Application Folder task definition */
		elfFile = '${workspaceFolder}/out/${workspaceFolderBasename}.nuttx';
	}

	/* cortex-debug */
	cortexDebug['name'] = 'Main core debug';
	cortexDebug['type'] = 'cortex-debug';
	cortexDebug['request'] = 'launch';
	cortexDebug['servertype'] = 'openocd';
	cortexDebug['cwd'] = '${workspaceFolder}';
	cortexDebug['executable'] = elfFile;
	cortexDebug['device'] = 'CXD5602';
	cortexDebug['preLaunchTask'] = taskCleanFlashLabel;
	cortexDebug['configFiles'] = ['interface/cmsis-dap.cfg', '${config:spresense.sdk.tools.path}/cxd5602.cfg'];
	cortexDebug['svdFile'] = '${config:spresense.sdk.tools.path}/SVD/cxd5602.svd';
	cortexDebug['debuggerArgs'] = [
		'-ix',
		'.vscode/.gdbinit'
	];
	cortexDebug['overrideRestartCommands'] = [
		"monitor sleep 3000",
		"load",
		"monitor reset halt"
	];

	/* Apply into tasks.json */
	await updateConfiguration(launch, 'configurations', [cortexDebug], 'name');

	try {
		/* Copy Spresense specific .gdbinit */
		fs.copyFileSync(path.join(sdkFolder, 'sdk', '.gdbinit'), path.join(vsocodeFolder, '.gdbinit'));
	} catch (err) {
		vscode.window.showErrorMessage(nls.localize("spresense.src.debug.gdbinit.error", "Cannot copy .gdbinit file."));
		return false;
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
		if (process.platform === 'win32') {
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
					spresenseSdkSetup();
				}
			}

		} else {
			vscode.window.showInformationMessage(nls.localize("spresense.src.msys.error.platform", "Msys path setting is only for Windows."));
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
	const VersionKey = 'LoaderVersion';
	const requestJson = loadJson(requestPath, true);
	const suggestJson = loadJson(suggestPath, true);

	if (!suggestJson[VersionKey] || requestJson[VersionKey] !== suggestJson[VersionKey]) {
		/* If stored_version.json doesn't have VersionKey or version is not same, need to update. */
		return requestJson['DownloadURL'];
	} else {
		/* No need to update */
		return undefined;
	}
}

/**
 * Extract zip file synchronously
 *
 * This function extract zip file synchronously.
 *
 * @param srcFile Path to zip file
 * @param destDir Path to extract directory
 */

function unzipSync(srcFile: string, destDir: string) {
	return new Promise((resolve) => {
		unzip(srcFile, {dir: destDir}, (err) => {
			if (err) {
				vscode.window.showErrorMessage(nls.localize("spresense.src.bootloader.error.unzip", "Can not extract selected zip file."));
			}
			/* Done unzip */
			resolve();
		});
	});
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
	await unzipSync(zipFilePath, tempPath);

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
	const reply = await vscode.window.showInformationMessage(nls.localize("spresense.src.bootloader.confirm", "To install the bootloader, you must download the bootloader archive with a web browser. Are you sure to open the download page? {0}", downloadUrl), "OK", "Cancel");
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
			"Zip file": ["zip"]
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
	triggerSpresenseTask(wsFolders[0].uri, taskBootFlashLabel);
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
		triggerSpresenseTask(selectedUri, taskBuildKernelLabel);
	}));

	/* Register build command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.build', (selectedUri) => {
		/* Do the build */
		triggerSpresenseTask(selectedUri, taskBuildLabel);
	}));

	/* Register clean kernel command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.clean.kernel', (selectedUri) => {
		/* Do the Kernel clean */
		triggerSpresenseTask(selectedUri, taskkernelCleanLabel);
	}));

	/* Register clean sdk command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.clean.sdk', (selectedUri) => {
		/* Do the SDK Clean */
		triggerSpresenseTask(selectedUri, taskSdkCleanLabel);
	}));

	/* Register flash command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.flash', (selectedUri) => {
		/* Do the flash */
		triggerSpresenseTask(selectedUri, taskFlashLabel);
	}));

	/* Register burn bootloader command */
	context.subscriptions.push(vscode.commands.registerCommand('spresense.burn.bootloader', () => {
		/* Burn bootloader */
		burnBootloader(context);
	}));
}

async function updateSettings(progress: vscode.Progress<{ message?: string; increment?: number;}>) {
	let termConf = vscode.workspace.getConfiguration('terminal.integrated');

	const osName = {
		'win32': 'windows',
		'linux': 'linux',
		'darwin': 'osx',
		'aix': undefined,
		'freebsd': undefined,
		'openbsd': undefined,
		'sunos': undefined,
		'android': undefined,
		'cygwin': undefined
	};

	if (process.platform === 'win32') {
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
			/* If necessary directory missing, target direcgtory is invalid */
			vscode.window.showErrorMessage(nls.localize("spresense.src.setting.error.msys", "{0} is not a Msys install directory. Please set valid path (ex. c:\\msys64)", msysPath));
		} else {
			vscode.window.showErrorMessage(nls.localize("spresense.src.setting.error.nomsys", "Please set Msys install path first. ('F1' -> 'Spresense: Set MSYS install location'"));
		}
	}

	/* Initial check done */
	progress.report({increment: 20, message: nls.localize("spresense.src.setting.progress.check", "Checking operating system done.")});

	/* Get shell path */
	let shpath = termConf.get(`shell.${osName[process.platform]}`) || '/bin/bash';

	try {
		/* && control character for bash */
		let andCtrl = '&&';

		/* In Windows environment(cmd.exe), && need a escape character */
		if (process.platform === 'win32') {
			andCtrl = '^&^&';
		}
		/* Get enviroment from bash
		 * Line 1: PATH
		 * Line 2: Openocd path
		 */
		const shellEnv = cp.execSync(
			`${shpath} --login -c 'source ~/spresenseenv/setup ${andCtrl} echo $PATH ${andCtrl} which openocd'`
			).toString().trim().split('\n');

		/* Parse PATH */
		const envPath     = shellEnv[0]; /* Line 1 */
		const openocdPath = shellEnv[1]; /* Line 2 */

		/* Get toolchain directory by openocd path */
		const sprEnvPath = path.dirname(openocdPath);

		/* Prepare shell environment done */
		progress.report({increment: 20, message: nls.localize("spresense.src.setting.progress.env", "Get shell environment done.")});

		/* Set PATH */
		termConf.update(`env.${osName[process.platform]}`,{
			'PATH': envPath
		}, vscode.ConfigurationTarget.Workspace);

		/* Check spresenseenv done(If not exist, skip it) */
		progress.report({increment: 20, message: nls.localize("spresense.src.setting.progress.valid", "Correct toolchain path done.")});

		const ocdConf = vscode.workspace.getConfiguration('cortex-debug');
		const sprEnvConf = vscode.workspace.getConfiguration('spresense.env');

		if (process.platform === 'win32') {
			const msysPath: string | undefined = vscode.workspace.getConfiguration().get(configMsysPathKey);

			if (msysPath) {
				sprEnvConf.update('toolchain.path', path.join(msysPath, sprEnvPath), vscode.ConfigurationTarget.Workspace);
				ocdConf.update('armToolchainPath', path.join(msysPath, sprEnvPath), vscode.ConfigurationTarget.Workspace);
				ocdConf.update('openocdPath', path.join(msysPath, openocdPath), vscode.ConfigurationTarget.Workspace);
			}
		} else {
			sprEnvConf.update('toolchain.path', sprEnvPath, vscode.ConfigurationTarget.Workspace);
			ocdConf.update('armToolchainPath', sprEnvPath, vscode.ConfigurationTarget.Workspace);
			ocdConf.update('openocdPath', openocdPath, vscode.ConfigurationTarget.Workspace);
		}
	} catch (error) {
		/* nop: Use system environment */
	}

	/* Inform complete */
	progress.report({increment: 100, message: nls.localize("spresense.src.setting.progress.done", "Setup complete.")});
}

/**
 * Check Msys folder
 *
 * This function detecting folder as Msys install path or not.
 *
 * @param folderPath Path to target folder for detecting.
 * @returns If target folder is Msys install path, return true. If not, return false.
 */

function isMsysInstallFolder(folderPath: string): boolean {
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

function isSpresenseEnvironment() {
	let firstFolder = getFirstFolderPath();

	if (!firstFolder) {
		/* No folders or workspaces are open */
		return false;
	}

	/* If first folder is spresense, set sdk path to settings */
	if (common.isSpresenseSdkFolder(firstFolder)) {
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

function spresenseSdkSetup() {
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
		await updateSettings(progress);

		return new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, 5000);
		});
	});
}

/* Add spresense_prj.json file for detecting spresense project folder. */
/* If spresense_prj.json is exist, spresense extension detect it to spresense project folder */
function createSpresenseConfFile(folderPath: string) {
	/* Interface for spresense_prj.json file */
	interface SpresenseJsonInterface {
		[key: string]: string | number;
	}

	const sdkFolder = getFirstFolderPath();

	if (!sdkFolder) {
		return;
	}

	const sprConfFile = path.join(folderPath, '.vscode', 'spresense_prj.json');
	const versionFilePath = path.join(sdkFolder, 'sdk', 'tools', 'mkversion.sh');
	let jsonItem: SpresenseJsonInterface = {};
	let version: string = 'Unknown';
	if (fs.existsSync(versionFilePath) && fs.statSync(versionFilePath).isFile()) {
		try {
			const buff = fs.readFileSync(versionFilePath).toString();

			/* Get SDK version */
			const results = buff.match(/^SDK_VERSION=\"([A-Za-z0-9.]+)\"/m);
			if  (!results) {
				throw new Error();
			}
			version = results[1];
		} catch (error) {
			vscode.window.showErrorMessage(nls.localize("spresense.src.error.version", 'Cannot read SDK version.'));
		}
		console.log(version);
	}

	/* Append item (SDK version) */
	jsonItem['SdkVersion'] = version;

	/* Append item (Spresense Extension compatibility revision) */
	jsonItem['SpresenseExtInterfaceVersion'] = spresenseExtInterfaceVersion;

	try {
		/* Save spresense_prj.json */
		fs.writeFileSync(sprConfFile, JSON.stringify(jsonItem, null, 4));
	} catch (err) {
		vscode.window.showErrorMessage(nls.localize("spresense.src.create.conf.error", "Cannot create file ({0}).", sprConfFile));
	}
}

function isAlreadySetup(folderPath: string): boolean {
	const sprConfFile = path.join(folderPath, '.vscode', 'spresense_prj.json');
	const jsonItem = loadJson(sprConfFile, false);

	if (!jsonItem) {
		/* Not created yet */
		return false;
	} else {
		const projectVersion: number = parseInt(jsonItem['SpresenseExtInterfaceVersion']);
		/* TODO: WIll implement for update .vscode */
		if (isNaN(projectVersion)) {
			/* Force update for alpha version. There are no compatibility between alpha version and later version.
			 * So, force update.
			 */
			return false;
		} else if (projectVersion > spresenseExtInterfaceVersion) {
			/* Newer extension's project */
			vscode.window.showWarningMessage(nls.localize("spresense.src.error.newer", "Project folder was created by newer version of Spresense extension. Please update Spresense extension."));
			return true;
		} else {
			/* Keep current .vscode */
			return true;
		}
	}
}

async function spresenseEnvSetup(context: vscode.ExtensionContext, folderUri: vscode.Uri) {
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

	if (common.isSpresenseSdkFolder(folderPath) && folderUri !== wsFolders[0].uri) {
		/* Remove 2nd Spresense SDK folder */
		removeWorkspaceFolder(folderUri);

		/* If folderUri is SDK and it is not a first folder, that is multiple SDK */
		vscode.window.showErrorMessage(nls.localize("spresense.src.setting.error.multi", "Spresense extension can not use multiple Spresense SDK. \
		Please remove one of spresense folder from workspace."));
		return;
	}

	if (isAlreadySetup(folderPath)) {
		return;
	}

	/* For C/C++ Extension */
	sdkCppConfig(context, folderPath);

	/* For build/flash task */
	await sdkTaskConfig(folderUri, context);

	/* For debug */
	if (! await sdkLaunchConfig(folderUri)) {
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
		if (common.isSpresenseSdkFolder(folder.uri.fsPath)) {
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
		context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders((event: vscode.WorkspaceFoldersChangeEvent) => {
			event.added.forEach((addedFolder) => {
				/* Create several json files for new folder */
				spresenseEnvSetup(context, addedFolder.uri);
			});
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
		spresenseSdkSetup();

		if (vscode.workspace.workspaceFolders) {
			vscode.workspace.workspaceFolders.forEach((folder) => {
				/* Create several json files for new folder */
				spresenseEnvSetup(context, folder.uri);
			});
		}

		/* Register Commands */
		registerSpresenseCommands(context);

		/* Enable Spresense IDE */
		vscode.commands.executeCommand('setContext', 'spresenseIdeEnabled', true);
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
