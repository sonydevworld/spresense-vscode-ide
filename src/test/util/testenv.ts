import * as path from 'path';

export const projectPath = path.resolve(__dirname, '..', '..', '..');
export const wsPath = path.resolve(projectPath, 'test-resources', 'harness');
export const spresensePath = path.resolve(wsPath, 'spresense');
export const sdkPath = path.resolve(spresensePath, 'sdk');
export const nuttxPath = path.resolve(spresensePath, 'nuttx');
export const resultPath = path.resolve(projectPath, 'test', 'results');
