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
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as glob from 'glob';
import { EventEmitter } from 'events';

import * as cp from './shell_exec';
import * as nls from './localize';

export function activate(context: vscode.ExtensionContext) {

	nls.config(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('spresense.sdkconfig', async (uri) => {
			if (!detectSpresenseSDK()) {
				vscode.window.showErrorMessage(nls.localize("sdkconfig.src.open.error.repository",
					"Spresense repository not found."));
				return;
			}

			const config = await getProjectConfigFile(uri, "sdk.config");

			if (config === '') {
				/* Canceled */
				return;
			}

			SDKConfigView.createOrShow(context.extensionPath, config, SDKConfigView.sdkMode);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('spresense.kernelconfig', async (uri) => {
			if (!detectSpresenseSDK()) {
				vscode.window.showErrorMessage(nls.localize("sdkconfig.src.open.error.repository",
					"Spresense repository not found."));
				return;
			}

			const config = await getProjectConfigFile(uri, "kernel.config");

			if (config === '') {
				/* Canceled */
				return;
			}

			SDKConfigView.createOrShow(context.extensionPath, config, SDKConfigView.kernelMode);
		})
	);
}

/**
 * Check first folder of workspace has specific folders.
 * If first folder has 'sdk' and 'nuttx' subfolders, it may Spresense SDK folder.
 */

function detectSpresenseSDK(): boolean {
	const wf = vscode.workspace.workspaceFolders;

	if (wf) {
		try {
			const sdk = fs.statSync(path.join(wf[0].uri.fsPath, 'sdk'));
			const nuttx = fs.statSync(path.join(wf[0].uri.fsPath, 'nuttx'));

			if (sdk.isDirectory && nuttx.isDirectory) {
				return true;
			}
		} catch (e) {
			return false;
		}
	}

	return false;
}

/**
 * Return Spresense SDK root path
 */

function getRootDir(): string | undefined {
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

function getPythonPath(): string {
	let python = 'python';

	/* In MSYS2, append MSYS2 install path */
	if (process.platform === 'win32') {
		const mpath = vscode.workspace.getConfiguration('spresense.msys').get('path');

		if (mpath && typeof mpath === 'string') {
			python = path.join(mpath, 'usr', 'bin', python);
		}
	}

	return python;
}

/**
 * Get user project configuration file
 *
 * @param uri    Object passed by vscode
 * @param expect Expected file name, "sdk.config" or "kernel.config".
 *               It concatnate to workspace path recognized as project folder.
 * @returns Path to project file.
 *          Return undefined when project folder is not found.
 *          Return "" when canceled.
 */

async function getProjectConfigFile(uri: any, expect: string): Promise<string | undefined> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	let folder: vscode.WorkspaceFolder | undefined;

	if (!workspaceFolders) {
		return undefined;
	}

	if (uri && uri instanceof vscode.Uri) {
		if (path.basename(uri.fsPath) === expect) {
			return uri.fsPath;
		}

		folder = vscode.workspace.getWorkspaceFolder(uri);
	} else if (workspaceFolders.length === 1) {
		folder = workspaceFolders[0];
	} else {
		folder = await vscode.window.showWorkspaceFolderPick();
		if (!folder) {
			return "";
		}
	}

	if (folder) {
		if (folder !== workspaceFolders[0]) {
			return path.join(folder.uri.fsPath, expect);
		}
	}

	return undefined;
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

function tweakConfig(configfile: string, configname: string, enable: boolean) {
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
function tweakPlatform(configfile: string) {
	if (process.platform === "win32") {
		console.log(`tweak ${configfile} for Windows`);
		tweakConfig(configfile, "HOST_WINDOWS", true);
		tweakConfig(configfile, "TOOLCHAIN_WINDOWS", true);
		// XXX: Currently only MSYS2 is supported
		tweakConfig(configfile, "WINDOWS_MSYS", true);
	}
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

function isSameContents(partA: fs.PathLike, partB: fs.PathLike):boolean {
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
 * Find any build task is running
 *
 * This function targets only for tasks managed by VS Code.
 *
 * @return {boolean} true when found build task.
 */

function BuildTaskIsRunning() : boolean {
	for (let ex of vscode.tasks.taskExecutions) {
		if (ex.task.group === vscode.TaskGroup.Build) {
			return true;
		}
	}
	return false;
}

class SDKConfigView {

	public static currentPanel: SDKConfigView | undefined;

	public static readonly viewType = 'SDKConfigView';
	public static readonly sdkMode = "SDK";
	public static readonly kernelMode = "Kernel";

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionPath: string;
	private readonly _resourcePath: string;

	private readonly _sdkTmpKconfig = ".kconfig.tmp";

	private _mode: string | undefined;
	private _configFile: string;
	private _disposables: vscode.Disposable[] = [];
	private _isUserConfig: boolean;
	private _sdkDir: string;
	private _kernelDir: string;
	private _progress: EventEmitter;
	private _currentProcess: cp.ChildProcess | undefined = undefined;

	public static createOrShow(extensionPath: string, targetConfig: string | undefined, mode: string) {
		const column = vscode.window.activeTextEditor ?
			vscode.window.activeTextEditor.viewColumn : undefined;

		if (BuildTaskIsRunning()) {
			vscode.window.showErrorMessage(nls.localize("sdkconfig.src.open.error.task",
				"Can not open configuration while in the build task is running"));
			return;
		}

		if (SDKConfigView.currentPanel) {
			if (mode !== SDKConfigView.currentPanel._mode) {
				vscode.window.showErrorMessage(nls.localize("sdkconfig.src.open.error.multiple",
					"Can not open {0} configuration. Please close other configuration tab first.", mode));
				return;
			}

			SDKConfigView.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			SDKConfigView.viewType,
			"SDK Config", column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,

				localResourceRoots: [
					vscode.Uri.file(path.join(extensionPath, 'resources'))
				]
			}
		);

		SDKConfigView.currentPanel = new SDKConfigView(panel, extensionPath, targetConfig, mode);

		SDKConfigView.currentPanel._generateMenu();
	}

	private constructor(panel: vscode.WebviewPanel, extensionPath: string, targetConfig: string | undefined, mode: string) {
		this._panel = panel;
		this._extensionPath = extensionPath;
		this._resourcePath = path.join(extensionPath, 'resources');
		this._mode = mode;
		this._configFile = '';
		this._isUserConfig = targetConfig !== undefined;
		this._sdkDir = "";
		this._kernelDir = "";
		this._progress = new EventEmitter();

		let rootDir = getRootDir();
		if (rootDir === undefined) {
			return;
		}

		this._sdkDir = path.join(rootDir, "sdk");
		this._kernelDir = path.join(rootDir, "nuttx");

		// Make.defs needs both of SDK and NuttX configurations.
		// This process is the same as ./tools/config.py.

		const makedefs = path.join(this._kernelDir, "Make.defs");
		try {
			fs.copyFileSync(path.join(this._sdkDir, "bsp", "scripts", "Make.defs.nuttx"),	makedefs,
				fs.constants.COPYFILE_EXCL);
		} catch (e) {
			// Ignore errors
		}

		// sdkconfig.src.webviewTitle
		let _folder;
		if (targetConfig) {
			let _proj = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(targetConfig));
			// This statement is for avoid errors by tslint, so may not be set empty string.
			_folder = _proj ? _proj.name : "";
		} else {
			_folder = path.basename(rootDir);
		}

		if (mode === SDKConfigView.sdkMode) {
			this._configFile = targetConfig || path.join(this._sdkDir,'.config');
			this._panel.title = nls.localize("sdkconfig.src.webview.title.sdk", "SDK Config ({0})", _folder);
		} else {
			this._configFile = targetConfig || path.join(this._kernelDir, '.config');
			this._panel.title = nls.localize("sdkconfig.src.webview.title.kernel", "Kernel Config ({0})", _folder);
		}

		this._update();

		this._panel.onDidDispose(() => this.dispose(), null, undefined);

		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case "loading":
						// Update progress from webview process
						this._progress.emit("update",
							nls.localize("sdkconfig.src.progress.menu", "Construct menu"), message.content);
						return;

					case "save":
						if (BuildTaskIsRunning()) {
							vscode.window.showErrorMessage(nls.localize("sdkconfig.src.save.error.task",
								"Save configuration failed because of the build task is running."));
							return;
						}
						Promise.resolve().then(() => {
							return new Promise((resolve) => {
								this._saveConfigFile(this._configFile, message.content);
								this._updateHeaderFiles();
								resolve();
							});
						});
						return;

					case "load":
						vscode.window.showOpenDialog({canSelectMany: false}).then(uri => {
							if (uri) {
								let buf;

								try {
									buf = fs.readFileSync(uri[0].fsPath);
								} catch (e) {
									return;
								}
								this._panel.webview.postMessage({command: "loaded", content: buf.toString()});
							}
						});
						return;

					case "saveas":
						vscode.window.showSaveDialog({}).then(uri => {
							if (uri) {
								this._saveConfigFile(uri.fsPath, message.content);
							}
						});
						return;

					case "get-defconfigs":
						const list = this._getDefconfigs();
						if (list.length > 0) {
							this._panel.webview.postMessage({command: "get-defconfigs", content: list});
						}
						return;

					case "load-defconfigs":
						let data;

						// If no defconfig selected, return zero length string to webview, and
						// all of options will be default.

						if (message.content.length > 0) {
							data = this._loadDefconfigFiles(message.content);
						} else {
							data = "";
						}
						this._panel.webview.postMessage({command: "load-defconfigs", content: data});
						return;
				}
			},
			undefined,
			this._disposables
		);

	}

	private _generateMenu() {
		vscode.window.withProgress({
			cancellable: true,
			location: vscode.ProgressLocation.Notification,
			title: nls.localize("sdkconfig.src.progress.title", "Invoking configuration")
		}, (progress, token) => {
			token.onCancellationRequested(event => {
				this.dispose(); // XXX: enough?
			});

			progress.report({message: nls.localize("sdkconfig.src.progress.prepare", 'Preparing configuration')});

			setTimeout(() => {
				if (this._mode === SDKConfigView.sdkMode) {
					this._genSdkKconfig(false);
				} else {
					this._initKernelKconfig(false);
				}
			}, 1);

			return new Promise(resolve => {
				this._progress.on("update", (_message, _increment) => {

					// FIXME: We want to show the percentage but current status of webview
					// process couldn't received.
					// So, disable increment parameter to show to loop animation on the
					// progress window.

					progress.report({message: _message /*, increment: _increment*/});
					if (_increment === 100) {
						resolve();
					}
				});
			});
		});
	}

	/**
	 * Update config dependent header files
	 *
	 * This function update config dependent header files (ex. config.h).
	 * And this operation is necessary for code completion and worker build.
	 *
	 */

	private _updateHeaderFiles() {
		let dotConfig: string | undefined;
		let options: object | undefined;
		let args: Array<string> | undefined;

		if (this._mode === SDKConfigView.sdkMode) {
			options = { cwd: this._sdkDir };
			args = [
				"bsp/include/sdk/config.h",
				"dirlinks"
			];
			dotConfig = path.join(this._sdkDir, '.config');
		} else {
			options = { cwd: this._kernelDir };
			args = [
				"include/nuttx/config.h",
				"include/nuttx/version.h",
				"include/math.h",
				"include/float.h",
				"include/stdarg.h",
				"dirlinks"
			];
			dotConfig = path.join(this._kernelDir, '.config');
		}

		if (!fs.existsSync(dotConfig) || !isSameContents(this._configFile, dotConfig)) {
			fs.copyFileSync(this._configFile, dotConfig);
		}

		try {
			cp.execFileSync("make", args, options);
		} catch (err) {
			vscode.window.showErrorMessage(err.message);
		}
	}

	private _saveConfigFile(filePath: string, content: string) {
		try {
			fs.writeFileSync(filePath, content, { mode: 0o644 });
			vscode.window.showInformationMessage(nls.localize("sdkconfig.src.save.done", "Configuration has been saved. {0}", filePath));
		} catch (err) {
			vscode.window.showErrorMessage(err.message);
		}
	}

	private _getDefconfigs(): string[] {
		let opts = { cwd: path.join(this._sdkDir, "configs") };

		if (this._mode === SDKConfigView.sdkMode) {
			return glob.sync("@(device|examples|feature)/*-defconfig", opts);
		} else {
			return glob.sync("kernel/*-defconfig", opts);
		}
	}

	private _loadDefconfigFiles(paths: string): string {
		const configDir = path.join(this._sdkDir, "configs");
		const list = paths.split("\n");
		let data = "";

		for (let p of list) {
			const filename = path.join(configDir, p + "-defconfig");
			let buf;

			try {
				buf = fs.readFileSync(filename);
			} catch (e) {
				return "";
			}

			data += buf.toString();
		}

		// XXX: Add tweak options for windows build environment.
		// This workaround is the same with tweakPlatform() function but
		// patch it on demand. So be careful if you want to change this tweaks.

		if (this._mode === SDKConfigView.kernelMode) {
			if (process.platform === "win32") {
				const tweaks = [
					"CONFIG_HOST_WINDOWS=y",
					"CONFIG_TOOLCHAIN_WINDOWS=y",
					"CONFIG_WINDOWS_MSYS=y"
				];
				data += tweaks.join("\n");
			}
		}
		return data;
	}

	public dispose() {
		SDKConfigView.currentPanel = undefined;

		if (this._currentProcess) {
			this._currentProcess.kill();
		}

		this._progress.emit("update", "Closed", 100);

		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		this._panel.webview.html = this._getViewContent();
	}

	private _genSdkKconfig(force: boolean) {
		const tmpKconfig = path.join(this._sdkDir, this._sdkTmpKconfig);
		const options = { cwd: this._sdkDir, env: { "SDKDIR": "." } };

		Promise.resolve().then(() => {
			if (force || !fs.existsSync(tmpKconfig)) {
				return new Promise((resolve, reject) => {
					this._currentProcess = cp.execFile("make", [ this._sdkTmpKconfig ], options, (err, stdout, stderr) => {
						this._currentProcess = undefined;
						if (err) {
							reject(err);
						} else {
							resolve();
						}
					});
				});
			}
		})
		.then(() => {
			this._genSdkConfigMenuData();
		})
		.catch((reason) => {
			vscode.window.showErrorMessage(nls.localize("sdkconfig.src.progress.error.prepare", "Preparing configuration failed."));
			console.error(reason);
			this.dispose();
		});
	}

	private _genSdkConfigMenuData() {
		/*
		 * Exec helper python script, it must be:
		 * python /path/to/helper/kconfig2json.py -o /path/to/menu.js
		 */

		const python = getPythonPath();
		const args = [path.join(this._extensionPath, "helper", "kconfig2json.py")];
		args.push(this._sdkTmpKconfig);

		this._progress.emit("update",
			nls.localize("sdkconfig.src.progress.parse", "Parsing Kconfig"), 20);

		// Tentative: KCONFIG_CONFIG will be remove
		const options = {
			cwd: this._sdkDir,
			env: {
				"SDKDIR": ".",
				"KCONFIG_CONFIG": this._configFile
			},
			maxBuffer: 1024 * 1024
		};

		child_process.execFile(python, args, options, (err, stdout, stderr) => {
			if (err) {
				console.error(err);
				vscode.window.showErrorMessage(nls.localize("sdkconfig.src.progress.error.parse", "Kconfig parse error"));
				this.dispose();
			} else {
				this._progress.emit("update",
					nls.localize("sdkconfig.src.progress.menu", "Construct menu"), 40);
				this._panel.webview.postMessage({command: "init", content: stdout.toString()});
			}
		});
	}

	private _initKernelKconfig(force: boolean) {
		const dotconfig = path.join(this._kernelDir, ".config");

		const options = { cwd: this._kernelDir };

		Promise.resolve().then(() => {
			if (force || !fs.existsSync(dotconfig)) {
				console.log("create kernel .config");
				try {
					fs.copyFileSync(path.join(this._sdkDir, "configs", "kernel", "release-defconfig"), dotconfig);
					tweakPlatform(dotconfig);
				} catch (e) {
					// XXX: show error message
					console.error(e);
					return Promise.reject(e);
				}

				return new Promise((resolve, reject) => {
					console.log("olddefconfig");
					this._currentProcess = cp.exec("make olddefconfig", options, (error, stdout, stderr) => {
						this._currentProcess = undefined;
						if (error) {
							if (!error.killed) {
								vscode.window.showErrorMessage(error.message);
							}
							// Remove .config file for reenterring in the next time.
							fs.unlinkSync(dotconfig);
							reject(error);
						} else {
							resolve();
						}
					});
				});
			}
		})
		.then(() => {
			this._genKernelConfigMenuData();
		})
		.catch((reason) => {
			console.error(reason);
			this.dispose();
		});
	}

	private _genKernelConfigMenuData() {
		const python = getPythonPath();
		const appsDir = path.join("..", "sdk", "tools", "empty_apps");
		const args = [path.join(this._extensionPath, "helper", "kconfig2json.py")];
		// Tentative: KCONFIG_CONFIG will be remove
		const options = {
			cwd: this._kernelDir,
			env: {
				"APPSDIR": appsDir,
				"KCONFIG_CONFIG": this._configFile
			},
			maxBuffer: 10 * 1024 * 1024
		};
		console.log("Creating kernel config data");

		this._progress.emit("update",
			nls.localize("sdkconfig.src.progress.parse", "Parsing Kconfig"), 20);

		Promise.resolve().then(() => {
			if (!fs.existsSync(path.join(this._kernelDir, "configs", "dummy", "Kconfig"))) {
				return new Promise((resolve, reject) => {
					console.log("make dirlinks");
					this._currentProcess = cp.exec("make dirlinks", options, (error, stdout, stderr) => {
						this._currentProcess = undefined;
						if (error) {
							if (!error.killed) {
								vscode.window.showErrorMessage(error.message);
							}
							reject(error);
						} else {
							resolve();
						}
					});
				});
			}
		})
		.then(() => {
			if (this._isUserConfig && !fs.existsSync(this._configFile)) {
				// If project folder kernel config file is specified but it's not exists,
				// create it from current kernel ".config" file.
				return new Promise((resolve, reject) => {
					console.log("copying project config");
					fs.copyFile(path.join(this._kernelDir, '.config'), this._configFile, (err) => {
						if (err) {
							reject(err);
						} else {
							resolve();
						}
					});
				});
			}
		})
		.then(() => {
			console.log("parse config");
			child_process.execFile(python, args, options, (err, stdout, stderr) => {
				if (err) {
					vscode.window.showErrorMessage(nls.localize("sdkconfig.src.progress.error.parse", "Kconfig parse error"));
					this.dispose();
				} else {
					this._progress.emit("update",
						nls.localize("sdkconfig.src.progress.menu", "Construct menu"), 40);
					this._panel.webview.postMessage({command: "init", content: stdout.toString()});
				}
			});
		})
		.catch((reason) => {
			console.error(reason);
			this.dispose();
		});
	}

	private _getViewContent() {
		const mainUri = vscode.Uri.file(path.join(this._resourcePath, 'main.js')).with({
			scheme: 'vscode-resource'
		});
		const progressUri = vscode.Uri.file(path.join(this._resourcePath, "progress.js")).with({
			scheme: 'vscode-resource'
		});
		const cssUri = vscode.Uri.file(path.join(this._resourcePath, 'style.css')).with({
			scheme: 'vscode-resource'
		});
		const defconfigUri = vscode.Uri.file(path.join(this._resourcePath, "defconfig.js")).with({
			scheme: 'vscode-resource'
		});
		const nonce = getNonce();

		const newStr = nls.localize("sdkconfig.src.menu.new", "New");
		const saveStr = nls.localize("sdkconfig.src.menu.save", "Save");
		const loadStr = nls.localize("sdkconfig.src.menu.load", "Load...");
		const saveasStr = nls.localize("sdkconfig.src.menu.saveas", "Save as...");

		return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
	  content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src vscode-resource:;"
/>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<link rel="stylesheet" type="text/css" href="${cssUri}">
<title>Configuration</title>
</head>

<body data-mode="${this._mode}">
	<div class="container">
		<div class="topmenu">
			<input id="search-box" type="search" placeholder="Filter">
			<ul>
				<li><a class="button" id="new" href="javascript:void(0)">${newStr}</a></li>
				<li><a class="button" id="save" href="javascript:void(0)">${saveStr}</a></li>
				<li><a class="button" id="load" href="javascript:void(0)">${loadStr}</a></li>
				<li><a class="button" id="saveas" href="javascript:void(0)">${saveasStr}</a></li>
			</ul>
		</div>

		<div class="contents">
			<div class="side-menu" id="category"></div>
			<div class="main" id="configs"></div>
		</div>
	</div>

	<div id="defconfig" class="modal">
		<div class="modal-content defconfig">
			<div id="defconfig-header">
				<h1>New Configuration</h1>
			</div>
			<div id="defconfig-body">
				<div id="defconfig-selector">
					<div id="defconfig-category">
						<div id="category-device" class="tab">Device</div>
						<div id="category-feature" class="tab">Feature</div>
						<div id="category-examples" class="tab">Examples</div>
					</div>
					<div id="defconfig-list"></div>
				</div>
				<div id="defconfig-selected">
					<p>selected defconfigs</p>
					<div id="selected-defconfig-list"></div>
				</div>
				<div id="defconfig-kernel"></div>
			</div>
			<div id="defconfig-footer">
				<div id="defconfig-ok">OK</div>
				<div id="defconfig-cancel">Cancel</div>
			</div>
		</div>
	</div>

	<div id="progress" class="modal">
	</div>

	<script nonce="${nonce}" src="${progressUri}"></script>
	<script nonce="${nonce}" src="${mainUri}"></script>
	<script nonce="${nonce}" src="${defconfigUri}"></script>
</body>
</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
