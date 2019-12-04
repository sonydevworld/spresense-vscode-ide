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
                case 'updateFolderText':
                    /* Update folder box text */
                    updateFolderText(message);
                    break;
                case 'checkPathResult':
                    /* Basic path checker result */
                    checkPathResult(message);
                    break;
                case 'updateText':
                    /* Update description text */
                    updateText(message);
                    break;
                case 'disableWizard':
                    disableWizardDialog();
                    break;
                case 'showProblems':
                    showProblems(message);
                    break;
            }
        }
    });
}

function addButtonEventListner() {
    /* Reference buttons */
    for (var button of document.getElementsByClassName('wizard-reference-button')) {
        button.addEventListener("click", (event) => {
            openFolder(event.target.id);
        });
    }

    /* Cancel button */
    document.getElementById('wizard-cancel-button').addEventListener("click", () => {
        // Cancel to create workspace
        vscode.postMessage({command: "cancel"});
    });

    /* Create button */
    document.getElementById('wizard-right-button').addEventListener("click", doCreate);
}

function addTextboxEventListner() {
    for (var form of document.getElementsByClassName("require-basic-path-check")) {
        form.addEventListener("keyup", (event) => {
            vscode.postMessage({command: "checkBasicPath", id: event.target.id, path: event.target.value});
        });
    }

    for (var form of document.getElementsByClassName("require-sdk-path-check")) {
        form.addEventListener("keyup", (event) => {
            vscode.postMessage({command: "checkSdkPath", id: event.target.id, path: event.target.value});
        });
    }
}

function disableWizardDialog() {
    document.getElementById("wizard-configuration-body").style.display = 'none';
    document.getElementById("wizard-error").style.display = 'inherit';
}

function updateText(message) {
    if ('id' in message && 'text' in message) {
        var item = document.getElementById(message.id);
        item.textContent = message.text;
    }
}

function updateFolderText(message) {
    if ('id' in message && 'path' in message) {
        /* Update textbox */
        document.getElementById(message.id).value = message.path;

        /* Update dialog state */
        updateState();
    }
}

function checkPathResult(message) {
    if ('id' in message && 'result' in message && 'text' in message) {
        var err = document.getElementById(`${message.id}-error`);

        err.textContent = message.text;

        if (message.result) {
            err.style.display = 'none';
        } else {
            err.style.display = 'inline';
        }

        /* Update dialog state */
        updateState();
    }
}

function updateState() {
    var createBtn = document.getElementById('wizard-right-button');

    if (isReadyToCreate()) {
        // Change button to enable
        createBtn.classList.add("enable");
        createBtn.classList.remove("disable");
    } else {
        // Change button to disable
        createBtn.classList.add("disable");
        createBtn.classList.remove("enable");
    }
}

function showProblems(message) {
    if ('show' in message) {
        if (message.show) {
            document.getElementById("environment-problems").style.display = 'inline';
        } else {
            document.getElementById("environment-problems").style.display = 'none';
        }
    }
}

function openFolder(id) {
    const box_id = id.replace('-button', '-box');
    vscode.postMessage({command: 'debug', log:box_id});
    // Open folder with specified path
    vscode.postMessage({command: "openFolder", id: box_id, path: document.getElementById(box_id).value});
}

function doCreate() {
    if (isReadyToCreate()) {
        let settings = {};

        for(var box of document.getElementsByClassName('wizard-text-box')) {
            settings[box.id] = box.value;
        }

        vscode.postMessage({command: "create", settings: settings});
    }
}

function isReadyToCreate() {
    const allErr = document.getElementsByClassName('wizard-item-error-message');
    const allTextBox = document.getElementsByClassName('wizard-text-box');

    for (let item of allErr) {
        if (item.style.display !== "none") {
            return false;
        }
    }

    for (let box of allTextBox) {
        if (box.value === "") {
            return false;
        }
    }

    return true;
}

main();
