#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import platform
from string import Template
from zipfile import ZipFile
import glob
import subprocess as sp
import re
from tempfile import TemporaryDirectory

URLTEMP = 'https://chromedriver.storage.googleapis.com/${version}/${filename}'

_default_chrome_binaries = {
    'Linux': 'chromium-browser',
    'Darwin': None,
    'Windows': None,
}

def _get_chrome_version(binarypath):
    with sp.Popen([binarypath, '--version'], stdout=sp.PIPE) as proc:
        versionstr = proc.stdout.read().decode()

    m = re.search(r'Chromium (?P<version>[\d\.]*) .*', versionstr)
    if m:
        return m.group('version')
    return None

def download_chromedriver(binarypath=None):
    if binarypath is None:
        binarypath = _default_chrome_binaries.get(platform.system())
        if binarypath is None:
            raise RuntimeError('This platform currently not supported yet.')

    ver = _get_chrome_version(binarypath)
    sys_ = platform.system()
    if sys_ == 'Linux':
        filename = 'chromedriver_linux64.zip'
    else:
        raise RuntimeError('{} is not supported yet.'.format(sys_))

    _driver_dir = os.path.join(os.path.dirname(__file__), 'drivers')
    driverdir = os.path.join(_driver_dir, ver)
    driverpath = os.path.join(driverdir, 'chromedriver')
    url = Template(URLTEMP).substitute(version=ver, filename=filename)

    if not os.path.exists(driverpath):
        with TemporaryDirectory() as tmpdirname:
            zipfilepath = os.path.join(tmpdirname, filename)
            ret = os.system('wget -nc -O {} {}'.format(zipfilepath, url))
            if ret != 0:
                print('Failed to download driver archive file from {}'.format(url), file=sys.stderr)
                return None
        
            with ZipFile(zipfilepath) as zip:
                zip.extractall(path=driverdir)
                # Add exec permission to chromedriver
                os.chmod(driverpath, 0o775)

    return driverpath

if __name__ == '__main__':
    print(download_chromedriver())
