/* --------------------------------------------------------------------------------------------
 * Copyright 2020 Sony Semiconductor Solutions Corporation
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

import * as cp from '../shell_exec';
import * as nls from '../localize';
import { getNonce, isSameContents } from '../common';
import * as util from './util';

export class SDKConfigView2 {

	public static currentPanel: SDKConfigView2 | undefined;

	public static readonly viewType = 'SDKConfigView';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionPath: string;
	private readonly _resourcePath: string;

	private _configFile: string;
	private _disposables: vscode.Disposable[] = [];
	private _isUserConfig: boolean;
	private _sdkDir: string;
	private _kernelDir: string;
	private _python: string;
	private _progress: EventEmitter;
	private _currentProcess: cp.ChildProcess | undefined = undefined;

	public static createOrShow(extensionPath: string, targetConfig: string | undefined) {
		const column = vscode.window.activeTextEditor ?
			vscode.window.activeTextEditor.viewColumn : undefined;

		if (util.BuildTaskIsRunning()) {
			vscode.window.showErrorMessage(nls.localize("sdkconfig.src.open.error.task",
				"Can not open configuration while in the build task is running"));
			return;
		}

		if (util.getPythonPath() === undefined) {
			vscode.window.showErrorMessage(nls.localize("sdkconfig.src.open.error.python",
				"Couldn't find necessary tools."), { modal: true });
			return;
		}

		if (SDKConfigView2.currentPanel) {
			SDKConfigView2.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			SDKConfigView2.viewType,
			"SDK Config", column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,

				localResourceRoots: [
					vscode.Uri.file(path.join(extensionPath, 'resources'))
				]
			}
		);

		SDKConfigView2.currentPanel = new SDKConfigView2(panel, extensionPath, targetConfig);

		SDKConfigView2.currentPanel._generateMenu();
	}

	private constructor(panel: vscode.WebviewPanel, extensionPath: string, targetConfig: string | undefined) {
		this._panel = panel;
		this._extensionPath = extensionPath;
		this._resourcePath = path.join(extensionPath, 'resources', 'config');
		this._configFile = '';
		this._isUserConfig = targetConfig !== undefined;
		this._python = util.getPythonPath() || "python";
		this._sdkDir = "";
		this._kernelDir = "";
		this._progress = new EventEmitter();

		let rootDir = util.getRootDir();
		if (rootDir === undefined) {
			return;
		}

		this._sdkDir = path.join(rootDir, "sdk");
		this._kernelDir = path.join(rootDir, "nuttx");

		// Make.defs needs both of SDK and NuttX configurations.
		// This process is the same as ./tools/config.py.

		const makedefs = path.join(this._kernelDir, "Make.defs");
		try {
			fs.copyFileSync(path.join(this._sdkDir, "tools", "scripts", "Make.defs"), makedefs,
				fs.constants.COPYFILE_EXCL);
		} catch (e) {
			// Ignore errors
		}

		let _folder;
		if (targetConfig) {
			let _proj = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(targetConfig));
			// This statement is for avoid errors by tslint, so may not be set empty string.
			_folder = _proj ? _proj.name : "";
		} else {
			_folder = path.basename(rootDir);
		}

		this._configFile = targetConfig || path.join(this._kernelDir, '.config');
		this._panel.title = nls.localize("sdkconfig.src.webview.title.kernel", "Kernel Config ({0})", _folder);

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
						if (util.BuildTaskIsRunning()) {
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
						let l;

						// If no defconfig selected, use default defconfig.

						l = message.content.length > 0 ? message.content : "default/defconfig";
						data = this._loadDefconfigFiles(l);
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
				this._initKernelKconfig(false);
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
	 */

	private _updateHeaderFiles() {
		let options: object | undefined;
		let args: Array<string> | undefined;

		options = { cwd: this._kernelDir };
		args = [
			"include/nuttx/config.h",
			"include/nuttx/version.h",
			"include/math.h",
			"include/float.h",
			"include/stdarg.h",
			"dirlinks"
		];

		try {
			cp.execFileSync("make", args, options);
		} catch (err) {
			vscode.window.showErrorMessage(err.message);
		}
	}

	private _saveConfigFile(filePath: string, content: string) {
		const dotConfig = path.join(this._kernelDir, '.config');

		try {
			fs.writeFileSync(filePath, content, { mode: 0o644 });

			if (filePath === dotConfig) {
				if (!fs.existsSync(dotConfig) || !isSameContents(this._configFile, dotConfig)) {
					fs.copyFileSync(this._configFile, dotConfig);
				}
			}
			vscode.window.showInformationMessage(nls.localize("sdkconfig.src.save.done", "Configuration has been saved. {0}", filePath));
		} catch (err) {
			vscode.window.showErrorMessage(err.message);
		}
	}

	private _getDefconfigs(): string[] {
		let list = glob.sync("**/defconfig", {
			cwd: path.join(this._sdkDir, "configs")
		});
		return list.concat(glob.sync("**/defconfig", {
			cwd: path.join(this._kernelDir, "boards", "arm", "cxd56xx")
		}));
	}

	private _loadDefconfigFiles(paths: string): string {
		const sdkdir = path.join(this._sdkDir, "configs");
		const kerneldir = path.join(this._kernelDir, "boards", "arm", "cxd56xx");
		const list = paths.split("\n");
		let data = "";

		for (let p of list) {
			const filename = path.join(p.startsWith("spresense") ? kerneldir : sdkdir, p);
			let buf;

			console.log(`Loading file: ${filename}`);
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

		switch (process.platform) {
			case "win32":
				const tweaks = [
					"CONFIG_HOST_WINDOWS=y",
					"CONFIG_TOOLCHAIN_WINDOWS=y",
					"CONFIG_WINDOWS_MSYS=y",
				];
				data += tweaks.join("\n") + "\n";
				break;

			case "linux":
				data += "CONFIG_HOST_LINUX=y\n";
				break;

			case "darwin":
				data += "CONFIG_HOST_MACOS=y\n";
				break;
			default:
				break;
		}
		data += 'CONFIG_APPS_DIR="../sdk/apps"\n';

		return data;
	}

	public dispose() {
		SDKConfigView2.currentPanel = undefined;

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

	private _initKernelKconfig(force: boolean) {
		const dotconfig = path.join(this._kernelDir, ".config");

		const options = { cwd: this._kernelDir };

		Promise.resolve().then(() => {
			if (force || !fs.existsSync(dotconfig)) {
				console.log("create kernel .config");
				try {
					fs.copyFileSync(path.join(this._sdkDir, "configs", "default", "defconfig"), dotconfig);
					util.tweakPlatform(dotconfig);
					util.tweakConfigStr(dotconfig, "APPS_DIR", "../sdk/apps");
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
		const appsDir = path.join("..", "sdk", "apps");
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
			return new Promise((resolve, reject) => {
				console.log("make dirlinks");
				this._currentProcess = cp.exec("make dirlinks apps_preconfig", options, (error, stdout, stderr) => {
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
			child_process.execFile(this._python, args, options, (err, stdout, stderr) => {
				if (err) {
					console.error(stderr);
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

<body>
	<div class="container">
		<div class="topmenu">
			<div class="button" id="new">${newStr}</div>
			<div class="button" id="save">${saveStr}</div>
			<div class="button" id="load">${loadStr}</div>
			<div class="button" id="saveas">${saveasStr}</div>
			<div class="button" id="search-icon">
				<div class="icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="bevel"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
				</div>
			</div>
			<div class="button" id="visibility-icon">
				<div class="icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="bevel"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
				</div>
				<div class="tooltip">Show all options</div>
			</div>
		</div>
		<div id="search">
			<div id="search-menu">
				<input type="search" id="search-box" placeholder="Search...">
			</div>
			<div id="search-results">

			</div>
		</div>

		<div class="contents" id="configs">
		</div>

		<div id="help"></div>
	</div>

	<div id="defconfig" class="modal">
		<div class="modal-content defconfig">
			<div id="defconfig-header">
				<h1>New Configuration</h1>
			</div>
			<div id="defconfig-body">
				<div id="defconfig-selector">
					<div id="defconfig-category">
					</div>
					<div id="defconfig-list"></div>
				</div>
				<div id="defconfig-selected">
					<p>selected defconfigs</p>
					<div id="selected-defconfig-list"></div>
				</div>
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
