#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import subprocess as sp
import glob
import shutil

def create_cuidotconfig(sdkdir, name):
    src = os.path.normpath(os.path.join(sdkdir, '..', 'nuttx', '.config'))
    dest = os.path.join('results', name, 'cui.config')
    if os.path.exists(dest):
        return

    print('Create config from %s' % name)
    cmd = ['./tools/config.py', name]
    proc = sp.run(cmd, cwd=sdkdir)
    proc.check_returncode()

    _dir = os.path.dirname(dest)
    os.makedirs(_dir, exist_ok=True)
    shutil.copy(src, dest)

def prepare(sdkdir):
    cmd = ['./tools/config.py', '-l']
    proc = sp.Popen(cmd, cwd=sdkdir, stdout=sp.PIPE)

    n = 0
    list_ = []
    for line in proc.stdout:
        line = line.decode().strip()
        n += 1
        if n >= 2: # Skip header 2 lines
            list_ += [line]

    for c in list_:
        create_cuidotconfig(sdkdir, c)

def compare_configs(_dir):

    basisfiles = sorted(glob.glob('**/cui.config', recursive=True))
    configfiles = sorted(glob.glob('**/gui.config', recursive=True))
    assert len(basisfiles) == len(configfiles)

    result = True
    for (a, b) in zip(basisfiles, configfiles):
        assert os.path.dirname(a) == os.path.dirname(b) 
        if compare_config(a, b) == False:
            result = False

    return result

def read_config(path):
    ret = []
    with open(path) as fh:
        for line in fh:
            l = line.strip()
            # Ignore empty line and comment lines, also disabled options
            if len(l) == 0 or l.startswith('#'):
                continue
            ret.append(l)
    return ret

def compare_config(a, b):
    print('  - Comparing config %s' % os.path.dirname(a))
    aconfig = read_config(a)
    bconfig = read_config(b)

    result = True
    for c in aconfig:
        if not (c in bconfig):
            print('    X < %s is only in CUI' % c, flush=True)
            result = False
    for c in bconfig:
        if not (c in aconfig):
            print('    X > %s is only in extension' % c, flush=True)
            result = False

    
    return result

if __name__ == '__main__':
    prepare('.harness/spresense/sdk')
    result = compare_configs('results')
    print('Comparing config files %s.' % ('passed' if result else 'failed'))
