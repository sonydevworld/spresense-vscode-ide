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

const SDK_PATH_ID = 'sdk-path';
const PROJECT_PATH_ID = 'project-path';

const PROJECT_WIZARD_TABLE = {
    [SDK_PATH_ID]: sdkpath,
    [PROJECT_PATH_ID]: projectpath,
}

function main() {
    /* Event listner for communicate with vscode */
    addVscodeEventListner();

    /* Evento listner for button */
    addButtonEventListner();
}

function addVscodeEventListner() {
    window.addEventListener('message', event => {
        const message = event.data;

        if ('command' in message) {
            switch (message.command) {
                case 'selectFolder':
                    /* Update folder box text */
                    updateFolderText(message);
                    break;
                case 'updateText':
                    /* Update description text */
                    updateText(message);
                    break;
                case 'disableWizard':
                    disableWizardDialog();
                    break;
                case 'showProblems':
                    showProblems();
                    break;
            }
        }
    });
}

function addButtonEventListner() {
    /* SDK Path button */
    document.getElementById('sdk-path-button').addEventListener("click", () => {
        openFolder(SDK_PATH_ID);
    });

    /* Project Path button */
    document.getElementById('project-path-button').addEventListener("click", () => {
        openFolder(PROJECT_PATH_ID);
    });

    /* MSYS2 Path button */
    document.getElementById('cancel-button').addEventListener("click", () => {
        // Cancel to create workspace
        vscode.postMessage({command: "cancel"});
    });
}

function disableWizardDialog() {
    document.getElementById("wizard-body").style.display = 'none';
    document.getElementById("wizard-error").style.display = 'inherit';
}

function updateText(message) {
    if ('id' in message && 'text' in message) {
        var item = document.getElementById(message.id);
        item.textContent = message.text;
    }
}

function updateFolderText(message) {
    if ('id' in message && 'path' in message && 'result' in message && message.id in PROJECT_WIZARD_TABLE) {
        if (message.id === SDK_PATH_ID) {
            var sdkErr = document.getElementById('sdk-path-error');

            if (message.result === 'OK') {
                sdkErr.style.display = 'none';
            } else {
                sdkErr.style.display = 'inline';
            }
        }
        /* Update textbox */
        PROJECT_WIZARD_TABLE[message.id].path.value = message.path;

        /* Update dialog state */
        updateState();
    }
}

function updateState() {
    var createBtn = document.getElementById('create-button');

    if (isReadyToCreate()) {
        // Change button to enable
        createBtn.className = "enabledButton"

        // Enable event
        createBtn.addEventListener("click", () => {
            // Create workspace with settings
            doCreate();
        });
    } else {
        // Change button to disable
        createBtn.className = "disabledButton"

        // Disable event
        createBtn.removeEventListener();
    }
}

function showProblems() {
    document.getElementById("environment-problems").style.display = 'inline';
}

function openFolder(id) {
    if (id in PROJECT_WIZARD_TABLE) {
        // Open folder with specified path
        vscode.postMessage({command: "openFolder", id: id, path: PROJECT_WIZARD_TABLE[id].path.value});
    }
}

function doCreate() {
    const keys = Object.keys(PROJECT_WIZARD_TABLE);
    let settings = {};

    keys.forEach((key) => {
        settings[key] = PROJECT_WIZARD_TABLE[key].path.value;
    });

    vscode.postMessage({command: "create", settings: settings});
}

function isReadyToCreate() {
    var sdkErr = document.getElementById('sdk-path-error');

    /* If not complete to select all path, cannot create */
    if (sdkpath.path.value === "" || projectpath.path.value === "") {
        return false;
    }

    /* If SDK path select invalid path, cannot create */
    if (sdkErr.style.display !== 'none') {
        return false;
    }

    return true;
}

main();
