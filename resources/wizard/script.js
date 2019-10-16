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

const vscode = acquireVsCodeApi();

const PROJECT_WIZARD_TABLE = {
    'sdk-path': sdkpath,
    'project-path': projectpath,
    'msys2-path': msys2path,
}

window.addEventListener('message', event => {
    const message = event.data;

    if ('command' in message && 'id' in message && 'path' in message && message.id in PROJECT_WIZARD_TABLE) {
        switch (message.command) {
            case 'selectFolder':
                PROJECT_WIZARD_TABLE[message.id].path.value = message.path;
                break;
        }
    }
});

function openFolder(id) {
    if (id in PROJECT_WIZARD_TABLE) {
        // Open folder with specified path
        vscode.postMessage({command: "openFolder", id: id, path: PROJECT_WIZARD_TABLE[id].path.value});
    }
}

function handleButton(id) {
    switch (id) {
        case 'Create':
            // Create workspace with settings
            vscode.postMessage({command: "create"});
            return;
        case 'Cancel':
            // Cancel to create workspace
            vscode.postMessage({command: "cancel"});
            return;
    }
}