import * as vscode from 'vscode';
import * as path from 'path';

import { getExactPlatform } from './common';

export class HelperTools {
  private helperPath: string;

  constructor(context: vscode.ExtensionContext) {
    let p = getExactPlatform();
    if (p === 'wsl') {
      p = 'win32';
    }
    this.helperPath = path.resolve(context.extensionPath, 'helper', p);
  }

  getToolPath(filename: string): string {
    const p = this.getExactPlatform();
    if (p === 'win32' || p === 'wsl') {
      filename += '.exe';
    }
    return path.resolve(this.helperPath, filename);
  }
}
