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
import * as fs from "fs";
import * as path from 'path';

let translateData : any = undefined;

function getNlsFilePath(context: vscode.ExtensionContext, locale: string | undefined): string {
    const defaultFile = "package.nls.json";
    if (!locale) {
        return path.join(context.extensionPath, defaultFile);
    }

    let filePath = path.join(context.extensionPath, `package.nls.${locale}.json`);
    if (fs.existsSync(filePath)) {
        return filePath;
    } else {
        return path.join(context.extensionPath, defaultFile);
    }
}

/**
 * Configure localization
 *
 * @param context extension context
 */

export function config(context: vscode.ExtensionContext) {
    let envvar = process.env['VSCODE_NLS_CONFIG'];
    if (envvar === undefined) {
        return;
    }

    let nlsConfig = JSON.parse(envvar);
    let locale = nlsConfig["locale"];
    let nlsFile = getNlsFilePath(context, locale);

    try {
        let buf = fs.readFileSync(nlsFile);
        translateData = JSON.parse(buf.toString());
    } catch (e) {
    }
}

/**
 * Localize with package.nls.<locale>.json
 *
 * @param key Search key for translation table.
 * @param template Template string to use when key not found or nls file not found.
 * @param args variables for replace with '{\d}' string.
 */

export function localize(key: string, template: string, ...args: string[]) : string {
    let str = undefined;
    if (translateData) {
        str = translateData[key];
    }
    if (str === undefined) {
        str = template;
    }

    // Replace {<number>} to specified arguments.
    //
    // e.g. localize("key", "{0}, {1}", "hello", "world") = "hello, world"
    //

    return str.replace(/{(\d*)}/g, (match: string, p1: number, offset: number, string: string) => {
        return args[p1];
    });
}
