import * as path from 'path';
import * as child_process from 'child_process';

import * as testenv from './testenv';
import * as fs from 'fs';

export function setupRepository(dest?: string, sdkRepositoryUrl?: string, testRepositoryUrl?: string) {
    dest = dest || testenv.spresensePath;
    const url = sdkRepositoryUrl || 'git@github.com:SonySemiconductorSolutions/spresense.git';
    const testurl = testRepositoryUrl || 'git@github.com:SonySemiconductorSolutions/spresense-test.git';
    let cmd: string;

    if (fs.existsSync(dest)) {
        console.log(`Found repository ${dest}. Skip clone.`);
        console.log(`If you want to update the repository, please update manually or remove ${dest}.`);
    } else {
        console.log(`Cloning repository ${dest}`);
        const _dest = path.resolve(dest, '..');
        cmd = `git -C ${_dest} clone --recursive ${url}`;
        child_process.execSync(cmd);
    }
    console.log(`spresense.git latest commit information:`);
    child_process.execSync(`git -C ${dest} log -1`, { stdio: 'inherit' });
    console.log();

    dest = path.resolve(dest, 'spresense-test');
    if (fs.existsSync(dest)) {
        console.log(`Found repository ${dest}. Skip clone`);
    } else {
        console.log(`Cloning repository ${dest}`);
        const _dest = path.resolve(dest, '..');
        cmd = `git -C ${_dest} clone --recursive ${testurl}`;
        child_process.execSync(cmd);
    }
    console.log(`spresense-test.git latest commit information:`);
    child_process.execSync(`git -C ${dest} log -1`, { stdio: 'inherit' });
    console.log();
}

export function cleanupRepository(dest?: string) {
    dest = dest || testenv.spresensePath;

    const nuttx = path.resolve(dest, 'nuttx');
    const apps = path.resolve(dest, 'sdk', 'apps');
    const test = path.resolve(dest, 'spresense-test');

    child_process.execSync(`git -C ${dest} clean -xdf`);
    child_process.execSync(`git -C ${nuttx} clean -xdf`);
    child_process.execSync(`git -C ${apps} clean -xdf`);
    child_process.execSync(`git -C ${test} clean -xdf`);

    child_process.execSync('./tools/config.py default -- +ELF', {
        cwd: path.resolve(dest, 'sdk')
    });
}
