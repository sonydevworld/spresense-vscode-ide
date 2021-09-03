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
		this._panel.title = nls.localize("sdkconfig.src.webview.title.sdk", "SDK Config ({0})", _folder);

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
							return new Promise<void>((resolve) => {
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
								// Add platform tweak options and apps directory option.
								// If already set them in read config file, overwrite at loading
								// process, so it can be taken a raw .config and a saved defconfig.
								buf = this._tweakPlatform(buf.toString());
								buf += 'CONFIG_APPS_DIR="../sdk/apps"\n';
								this._panel.webview.postMessage({command: "loaded", content: buf});
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

						data = this._loadDefconfigFiles(message.content);
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

			return new Promise<void>(resolve => {
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
		let workspaceFolder: vscode.WorkspaceFolder | undefined;
		let options: object | undefined;
		let args: Array<string> | undefined;
		let includePath: string | undefined;
		let headerPath: string | undefined;
		let headerFile: string | undefined;

		workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(this._configFile));

		if (!workspaceFolder) {
			return;
		}

		includePath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'include');
		headerFile = path.join(this._kernelDir, "include/nuttx/config.h");
		headerPath = path.join(includePath, 'nuttx');

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

		try {
			/* Save config.h at project folder, it would be referred by C++ Extension (mainly code completion).
			 * config.h may be changed by other projects sharing with Spresense repository.
			 * So we need to save generated config.h for prevent unexpected code completion.
			 */
			if (!fs.existsSync(includePath)) {
				fs.mkdirSync(includePath);
			}
			if (!fs.existsSync(headerPath)) {
				fs.mkdirSync(headerPath);
			}
			fs.copyFileSync(headerFile, path.join(headerPath, 'config.h'));
		} catch (err) {
			vscode.window.showErrorMessage(err.message);
			return;
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

	private _getDefconfigs(): any[] {
		let list = glob.sync("**/defconfig", {
			cwd: path.join(this._sdkDir, "configs")
		});
		list = list.concat(glob.sync("**/defconfig", {
			cwd: path.join(this._kernelDir, "boards", "arm", "cxd56xx")
		}));
		let ret = [];
		for (let c of list) {
			let p = path.join(this._sdkDir, "configs", path.dirname(c), "README.txt");
			let desc = '';

			try {
				desc = fs.readFileSync(p).toString();
			} catch (err) {
				// Ignore read error
			}
			let item = {'defconfig': c, 'desc': desc};
			ret.push(item);
		}
		return ret;
	}

	private _loadDefconfig(path: string): string {
		try {
			let buf = fs.readFileSync(path);
			return buf.toString();
		} catch (e) {
			console.assert('File not found ' + path);
		}
		return "";
	}

	private _tweakDefconfig(defconfig: Array<string>, tweak: string): Array<string> {
		console.log("tweak: " + tweak);
		let m = tweak.match(/([ +-])(.*)=(.*)/);
		if (!m) {
			return defconfig; // unknown tweak pattern, ignored
		}

		let pm = m[1];
		let name = m[2];
		let val = m[3];
		let pat = new RegExp("[# ]*CONFIG_" + name + "[ =]");
		let i;
		let line;

		switch (pm) {
			case '-':
				return defconfig.filter(value => {
					return !value.match(pat);
				});

			case '+':
				i = defconfig.findIndex((value) => {
					return value.match(pat);
				});
				line = val === 'n' ? `# CONFIG_${name} is not set` : `CONFIG_${name}=${val}`;
				if (i >= 0) {
					defconfig[i] = line;
				} else {
					defconfig.push(line);
				}
				return defconfig;

			case ' ':
			default:
				let v = val.split('->');
				line = v[1] === 'n' ? `# CONFIG_${name} is not set` : `CONFIG_${name}=${v[1]}`;

				for (i in defconfig) {
					if (defconfig[i].match(pat)) {
						defconfig[i] = line;
						break;
					}
				}
				return defconfig;
		}
	}

	private _tweakPlatform(buf: string): string {
		// XXX: Add tweak options for windows build environment.
		// This workaround is the same with tweakPlatform() function but
		// patch it on demand. So be careful if you want to change this tweaks.

		switch (process.platform) {
			case "win32":
				buf += [
					"CONFIG_HOST_WINDOWS=y",
					"CONFIG_TOOLCHAIN_WINDOWS=y",
					"CONFIG_WINDOWS_MSYS=y",
				].join("\n");
				break;

			case "linux":
				buf += "CONFIG_HOST_LINUX=y";
				break;

			case "darwin":
				buf += "CONFIG_HOST_MACOS=y";
				break;
			default:
				return buf;
		}
		buf += "\n";
		return buf;
	}

	private _loadDefconfigFiles(paths: string): string {
		const sdkdir = path.join(this._sdkDir, "configs");
		const kerneldir = path.join(this._kernelDir, "boards", "arm", "cxd56xx");
		const list = paths.split("\n");

		/* REVISIT: paths takes list of defconfig file paths, but empty string would be acceptable.
		 * In this case, choose "default" defconfig, but it is not a kernel defconfig.
		 *
		 * We decided the kernel defconfigs are not supported in the SDK config tools.
		 * So this logic is not needed for now, but remain this for future spec changes.
		 */
		if (list[0] !== "" && list[0].indexOf('/') === -1) {
			// If no slash contained name is passed, it treat as kernel defconfig, then
			// just read and return its contents.
			const filename = path.join(kerneldir, list[0]);
			return this._loadDefconfig(filename);
		}

		const defpath = path.join(sdkdir, "default", "defconfig");
		let content: Array<string>;
		try {
			let buf;
			buf = fs.readFileSync(defpath).toString();
			content = buf.split('\n');
		} catch (e) {
			console.log("default defconfig not found.");
			return "";
		}

		console.log(content);

		for (let p of list) {
			const filename = path.join(sdkdir, p);
			let buf;

			console.log(`Loading file: ${filename}`);
			try {
				buf = fs.readFileSync(filename);
			} catch (e) {
				console.log("File not found " + filename);
				continue;
			}

			for (let l of buf.toString().split('\n')) {
				content = this._tweakDefconfig(content, l);
			}
		}

		let buf = this._tweakPlatform(content.join('\n') + '\n');
		buf += 'CONFIG_APPS_DIR="../sdk/apps"\n';

		console.log("content after apply tweaks");
		console.log(buf);
		return buf;
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

				return new Promise<void>((resolve, reject) => {
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
		// Tentative: KCONFIG_CONFIG will be remove
		const options = {
			cwd: this._kernelDir,
			env: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				"APPSDIR": appsDir,
				// eslint-disable-next-line @typescript-eslint/naming-convention
				"EXTERNALDIR": "dummy",
				// eslint-disable-next-line @typescript-eslint/naming-convention
				"KCONFIG_CONFIG": this._configFile
			},
			maxBuffer: 10 * 1024 * 1024
		};
		console.log("Creating kernel config data");

		this._progress.emit("update",
			nls.localize("sdkconfig.src.progress.parse", "Parsing Kconfig"), 20);

		Promise.resolve().then(() => {
			return new Promise<void>((resolve, reject) => {
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
				return new Promise<void>((resolve, reject) => {
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
			// Workaround: The latest python3 (3.9.6) in MSYS can not take the script in windows path.
			// So we need to windows path to MSYS path (e.g. c:\User -> /c/User/).
			// MSYS path can be used in 3.9.6 or older minor versions (I tested in 3.7.4).
			// This replace logic would be affected only when this._extensionPath is windows path, Linux and macOS
			// would not be changed.
			const args = [path.join(this._extensionPath, "helper", "kconfig2json.py").replace(/\\/g, '/').replace(/^(\w):/, '/$1')];
			cp.execFile(this._python, args, options, (err, stdout, stderr) => {
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
		const visibilityHelp = nls.localize("sdkconfig.src.menu.visible", "Show all options");

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
				<div class="tooltip">${visibilityHelp}</div>
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
