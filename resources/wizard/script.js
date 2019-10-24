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

const PROJECT_WIZARD_TABLE = [SDK_PATH_ID, PROJECT_PATH_ID];

function main() {
    /* Event listner for communicate with vscode */
    addVscodeEventListner();

    /* Event listner for button */
    addButtonEventListner();

    /* Event listner for textbox */
    addTextboxEventListner();
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
                case 'updateResult':
                    /* Update path checker result */
                    updateResult(message);
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

    /* Cancel button */
    document.getElementById('wizard-left-button').addEventListener("click", () => {
        // Cancel to create workspace
        vscode.postMessage({command: "cancel"});
    });

    /* Create button will handle by updateState() */
}

function addTextboxEventListner() {
    Array.prototype.forEach.call(document.getElementsByClassName('wizard-text-box'), (box) => {
        const id = box.id.replace('form-', '');
        box.addEventListener("keyup", () => {
            // post updated path
            vscode.postMessage({command: "updatePath", id: id, path: box.value});
        });
    }) ;
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
    if ('id' in message && 'path' in message && PROJECT_WIZARD_TABLE.includes(message.id)) {
        /* Update textbox */
        document.getElementById(`form-${message.id}`).value = message.path;

        /* Update dialog state */
        updateState();
    }
}

function updateResult(message) {
    if ('id' in message && 'result' in message && PROJECT_WIZARD_TABLE.includes(message.id)) {
        if (message.id === SDK_PATH_ID) {
            var sdkErr = document.getElementById('sdk-path-error');

            if (message.result === 'OK') {
                sdkErr.style.display = 'none';
            } else {
                sdkErr.style.display = 'inline';
            }
        }

        /* Update dialog state */
        updateState();
    }
}

function updateState() {
    var createBtn = document.getElementById('wizard-right-button');

    if (isReadyToCreate()) {
        // Change button to enable
        createBtn.className = "wizard-enable-button"

        // Enable event
        createBtn.addEventListener("click", doCreate);
    } else {
        // Change button to disable
        createBtn.className = "wizard-disable-button"

        // Disable event
        createBtn.removeEventListener("click", doCreate);
    }
}

function showProblems() {
    document.getElementById("environment-problems").style.display = 'inline';
}

function openFolder(id) {
    if (PROJECT_WIZARD_TABLE.includes(id)) {
        // Open folder with specified path
        vscode.postMessage({command: "openFolder", id: id, path: document.getElementById(`form-${id}`).value});
    }
}

function doCreate() {
    let settings = {};

    PROJECT_WIZARD_TABLE.forEach((id) => {
        settings[id] = document.getElementById(`form-${id}`).value;
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
