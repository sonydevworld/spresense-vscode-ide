import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { getExactPlatform } from './common';

export class HelperTools {
  private helperPath: string;
  private sdkToolPath: string = '';
  private exeExt: string;

  constructor(context: vscode.ExtensionContext) {
    let p = getExactPlatform();
    if (p === 'wsl') {
      p = 'win32';
    }
    this.exeExt = p === 'win32' ? '.exe' : '';
    this.helperPath = path.resolve(context.extensionPath, 'helper', p);

    let sdk;
    if (vscode.workspace.workspaceFolders) {
      sdk = path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, 'sdk', 'tools');
    } else {
      return;
    }
    if (p === 'win32') {
      p = 'windows';
    } else if (p === 'darwin') {
      p = 'macos';
    }
    this.sdkToolPath = path.resolve(sdk, p);
  }

  getToolPath(filename: string): string {
    filename += this.exeExt;

    // If not sdk directory found, this path is invalid and always false.
    let toolPath = path.resolve(this.sdkToolPath, filename);
    if (!fs.existsSync(toolPath)) {
      toolPath = path.resolve(this.helperPath, filename);
    }
    return toolPath;
  }
}
