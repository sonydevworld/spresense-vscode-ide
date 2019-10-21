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

const ITEM_TYPE_APP_COMMAND = 'app-command';
const ITEM_TYPE_ASMP_WORKER = 'asmp-worker';
const WIZARD_PAGES = [
    'wizard-page1',
    'wizard-page2',
    {
        [ITEM_TYPE_APP_COMMAND]: 'wizard-page3-1',
        [ITEM_TYPE_ASMP_WORKER]: 'wizard-page3-2'
    }];

const APP_COMMAND_BOX_ID = 'wizard-app-command-name-box';
const ASMP_WORKER_BOX_ID = 'wizard-asmp-worker-name-box';
const ASMP_APP_BOX_ID = 'wizard-asmp-app-name-box';
const ALL_TEXTBOX_ID = [
    APP_COMMAND_BOX_ID,
    ASMP_WORKER_BOX_ID,
    ASMP_APP_BOX_ID];

var currentPage = 0;
var currentType = ITEM_TYPE_APP_COMMAND;

function main() {
    /* Event listner for communicate with vscode */
    addVscodeEventListner();

    /* Evento listner for button */
    addPageEventListner();

    /* Show first page */
    showPage(0);
}

function showPage(idx) {
    if(idx < 0 || idx >= WIZARD_PAGES.length) {
        return;
    }

    var items = document.getElementsByClassName("wizard-body");
    var page = "";
    if (typeof WIZARD_PAGES[idx] === 'string') {
        page = WIZARD_PAGES[idx];
    } else {
        page = WIZARD_PAGES[idx][currentType];
    }

    Array.prototype.forEach.call(items, (item) => {
        if (item.id === page) {
            item.style.display = 'inherit';
        } else {
            item.style.display = 'none';
        }
    });

    currentPage = idx;
}

function addVscodeEventListner() {
    window.addEventListener('message', event => {
        const message = event.data;

        if ('command' in message) {
            switch (message.command) {
                case 'setProjectFolders':
                    setProjectFolders(message);
                    break;
                case 'showErrorMessage':
                    showTextboxErrorMessage(message);
                    break;
            }
        }
    });
}

function addPageEventListner() {
    /* Left button */
    document.getElementById('left-button').addEventListener("click", doLeftButton);

    /* Left button */
    document.getElementById('right-button').addEventListener("click", doRightButton);

    /* Project select radio button event */
    Array.prototype.forEach.call(document.getElementsByName('select-project'), (radio) => {
        radio.addEventListener("change", () => {
            setProjectFolder(radio.value);
        });
    });

    /* Item type select radio button event */
    Array.prototype.forEach.call(document.getElementsByName('select-item'), (radio) => {
        radio.addEventListener("change", () => {
            setItemType(radio.value);
        });
    });

    /* Textbox event */
    ALL_TEXTBOX_ID.forEach((name) => {
        var textbox = document.getElementById(name);
        textbox.addEventListener("keyup", () => {
            vscode.postMessage({command: "checkItemName", id:name, text:textbox.value});
        });
    });

    /* Checkbox event */
    var checkbox = document.getElementById('wizard-item-checkbox');
    checkbox.addEventListener("click", () => {
        setAsmpSampleEnabled(checkbox.checked);
    });

}

function doLeftButton() {
    showPage(currentPage - 1);
}

function doRightButton() {
    showPage(currentPage + 1);
}

function setProjectFolders(message) {
    if ('folders' in message) {
        var projectRot = document.getElementById("wizard-project-picker");

        message.folders.forEach(folder => {
            var projectSec = document.createElement("div");
            var projectRad = document.createElement("input");
            var projectLb1 = document.createElement("label");
            var projectLb2 = document.createElement("label");

            projectSec.className = 'wizard-radio-button';

            projectRad.type = 'radio';
            projectRad.name = 'select-project';
            projectRad.value = folder.path;

            projectLb1.className = 'wizard-radio-button-title';
            projectLb1.textContent = folder.name;

            projectLb2.className = 'wizard-radio-button-subtitle';
            projectLb2.textContent = folder.path;

            projectSec.appendChild(projectRad);
            projectSec.appendChild(projectLb1);
            projectSec.appendChild(projectLb2);
            projectRot.appendChild(projectSec);
        });

        addPageEventListner();
    }
}

function showTextboxErrorMessage(messgae) {
    if ('id' in messgae && 'errText' in messgae) {
        var errBox = document.getElementById(`${messgae.id}-error`);
        if (messgae.errText === "") {
            errBox.style.display = 'none';
        } else {
            errBox.style.display = 'inherit';
            errBox.textContent = messgae.errText;
        }
    }
}

function setProjectFolder(folder) {
    vscode.postMessage({command: "setProjectFolder", path:folder});
}

function setItemType(type) {
    currentType = type;
}

function setAsmpSampleEnabled(enable) {
    vscode.postMessage({command: "debug", log:enable});
    var setting = document.getElementById('asmp-app-name');
    if (enable) {
        setting.style.display = 'inherit';
    } else {
        setting.style.display = 'none';
    }
}

main();