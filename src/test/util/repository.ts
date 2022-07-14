import * as path from 'path';
import * as child_process from 'child_process';

import * as testenv from './testenv';
import * as fs from 'fs';

export function setupRepository(dest?: string, repositoryUrl?: string) {
    dest = dest || testenv.spresensePath;
    const url = repositoryUrl || 'git@github.com:SonySemiconductorSolutions/spresense.git';
    let cmd: string;

    if (fs.existsSync(dest)) {
        cmd = `git -C ${dest} pull --recurse-submodules`;
    } else {
        dest = path.resolve(dest, '..');
        cmd = `git -C ${dest} clone --recursive ${url}`;
    }
    child_process.execSync(cmd);
}

//setupRepository();
