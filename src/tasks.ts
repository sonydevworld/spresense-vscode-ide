/* --------------------------------------------------------------------------------------------
 * Copyright 2022 Sony Semiconductor Solutions Corporation
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

/* eslint-disable @typescript-eslint/naming-convention */

export const buildKernelTask = {
    label: 'Build kernel',
    type: 'shell',
    command: '.vscode/build.sh buildkernel',
    options: {
        env: {
            SDK_PATH: "${config:spresense.sdk.path}",
            ISAPPFOLDER: "false"
        }
    },
    group: 'build',
    problemMatcher: [
        '$gcc'
    ]
};

export const buildTask = {
    label: 'Build application',
    type: 'shell',
    command: '.vscode/build.sh build',
    options: {
        env: {
            SDK_PATH: "${config:spresense.sdk.path}",
            ISAPPFOLDER: "false"
        }
    },
    group: 'build',
    problemMatcher: ['$gcc']
};

export const sdkCleanTask = {
    label: 'Clean application',
    type: 'shell',
    command: '.vscode/build.sh clean',
    options: {
        env: {
            SDK_PATH: "${config:spresense.sdk.path}",
            ISAPPFOLDER: "false"
        }
    },
    group: 'build',
    problemMatcher: ['$gcc']
};

export const kernelCleanTask = {
    label: 'Clean kernel',
    type: 'shell',
    command: '.vscode/build.sh cleankernel',
    options: {
        env: {
            SDK_PATH: "${config:spresense.sdk.path}",
            ISAPPFOLDER: "false"
        }
    },
    group: 'build',
    problemMatcher: ['$gcc']
};

export const flashWorkerTask = {
    label: 'Flash worker',
    type: 'shell',
    command: '${extensionInstallFolder:sony-spresense.spresense-vscode-ide}/scripts/flash_worker.sh',
    args: [
        '${config:spresense.sdk.path}',
        '${config:spresense.serial.port}',
        '${config:spresense.flashing.speed}'
    ],
    options: {
        cwd: '${workspaceFolder}'
    },
    group: 'test',
    problemMatcher: ['$gcc']
};

export const flashTask = {
    label: 'Build and flash',
    type: 'shell',
    dependsOrder: 'sequence',
    dependsOn: [
        buildTask.label,
        flashWorkerTask.label
    ],
    command: '${config:spresense.sdk.path}/sdk/tools/flash.sh',
    args: [
        '-c', '${config:spresense.serial.port}',
        '-b', '${config:spresense.flashing.speed}'
    ],
    group: 'test',
    problemMatcher: ['$gcc']
};

export const flashCleanTask = {
    label: 'Clean flash',
    type: 'shell',
    command: '${extensionInstallFolder:sony-spresense.spresense-vscode-ide}/scripts/prepare_debug.sh',
    args: [
        '${config:spresense.sdk.path}',
        'linux', // This argument will be replaced at generating task.json
        '${config:spresense.serial.port}'
    ],
    group: 'test',
    problemMatcher: ['$gcc']
};

export const flashBootTask = {
    label: 'Flash bootloader',
    type: 'shell',
    command: '${config:spresense.sdk.path}/sdk/tools/flash.sh',
    args: [
        '-l', '${config:spresense.sdk.path}/firmware/spresense',
        '-c', '${config:spresense.serial.port}',
        '-b', '${config:spresense.flashing.speed}'
    ],
    group: 'test',
    problemMatcher: ['$gcc']
};
