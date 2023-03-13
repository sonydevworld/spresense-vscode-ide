import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

import * as testenv from './testenv';

export class DefconfigUtil {
    sdkDir: string = testenv.sdkPath;
    nuttxDir: string = testenv.nuttxPath;
    resultDir: string = path.resolve(testenv.resultPath, 'configs');

    getDefconfigNames(): Array<string> {
        let buf = child_process.execSync('python3 ./tools/config.py -l', {cwd: this.sdkDir});
        let namelist = buf.toString().replace(/\t/g, '',).split('\n');
        return namelist.filter(name => name.length > 0 && !name.includes(':'));
    }

    makeDotConfig(name: string, outDir: string, force?: boolean) {
        if (name === '') {
            return;
        }
        const src = path.resolve(this.nuttxDir, '.config');
        const dest = path.resolve(outDir, name, 'config');
        if (force || !fs.existsSync(dest)) {
            console.log(`Creating ${name} config file`);
            child_process.execSync(`python3 ./tools/config.py ${name}`, {cwd: this.sdkDir});
            fs.mkdirSync(path.resolve(outDir, name), {recursive: true});
            fs.copyFileSync(src, dest);
        }
    }

    makeBaseDotConfigs() {
        const defconfigs = this.getDefconfigNames();
        try {
            fs.mkdirSync(this.resultDir, {recursive: true});
        } catch {
            // ignore
        }
        for (let name of defconfigs) {
            this.makeDotConfig(name, this.resultDir);
        }
    }

    saveResultConfig(name: string) {
        const src = path.resolve(testenv.nuttxPath, '.config');
        const dest = path.resolve(this.resultDir, name, 'config.result');
        fs.copyFileSync(src, dest);
    }

    private getConfigs(filepath: string) {
        const buf = fs.readFileSync(filepath).toString().split('\n');
        return buf.filter(conf => conf.length > 0 && conf.indexOf('#') !== 0); // ignore empty lines
    }

    compare(name: string) {
        const a = this.getConfigs(path.resolve(this.resultDir, name, 'config'));
        const b = this.getConfigs(path.resolve(this.resultDir, name, 'config.result'));

        for (let c of a) {
            if (c === 'CONFIG_NSH_MMCSDMINOR=0') {
                // WORKAROUND: This configuration is out from kconfig-frontend but
                // it is duplicated in apps/nshlib/Kconfig, so it should not to output
                // when MMCSD is 'n'.
                // We just ignore at here.
                continue;
            }
            if (!b.includes(c)) {
                console.log(`${c} is missing`);
                return false;
            }
        }
        for (let c of b) {
            if (!a.includes(c)) {
                console.log(`${c} is extra`);
                return false;
            }
        }
        return true;
    }
}

// entrypoint for called from CLI
if (path.basename(__filename) === path.basename(process.argv[1])) {
    const dc = new DefconfigUtil();
    for (let name of dc.getDefconfigNames()) {
        console.log(name);
    }
    dc.makeBaseDotConfigs();

    console.log(dc.compare('feature/libcxx'));
}
