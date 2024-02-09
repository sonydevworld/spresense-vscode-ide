#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os, sys
import time
from string import Template
import re
import subprocess as sp
import argparse
from datetime import datetime
import importlib.util
import glob

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities

_here = os.path.dirname(os.path.abspath(__file__))
TEST_HARNESS = os.path.join(_here, '.harness')
REPODIR = os.path.join(TEST_HARNESS, 'spresense')
SDKDIR = os.path.join(REPODIR, 'sdk')
TOPDIR = os.path.join(REPODIR, 'nuttx')

#
def _to_uri(path):
    return 'file://' + path

def setup_test_harness():
    # This script clone Spresense SDK source tree from private repository.
    # Please register your key to the SSH key chain support program (e.g. ssh-agent).

    os.makedirs(TEST_HARNESS, exist_ok=True)
    if not os.path.exists(REPODIR):
        cmd = ['git', '-C', TEST_HARNESS, 'clone', '--recursive',
               'git@github.com:SonySemiconductorSolutions/spresense.git']
        proc = sp.run(cmd)
        proc.check_returncode()

def create_index_html():
    template = os.path.join(_here, '..', 'resources', 'config', 'index.html.template')
    resourcedir = os.path.normpath(os.path.join(_here, '..', 'resources', 'config'))
    css_uri = _to_uri(os.path.join(resourcedir, 'style.css'))
    spinner_uri = _to_uri(os.path.join(resourcedir, 'spinner.css'))
    progress_uri = _to_uri(os.path.join(resourcedir, 'progress.js'))
    main_uri = _to_uri(os.path.join(resourcedir, 'main.js'))
    defconfig_uri = _to_uri(os.path.join(resourcedir, 'defconfig.js'))

    # index.html template replacement dictionary. see index.html.template.

    tempdict = {
        'cssUri': css_uri,
        'spinnerUri': spinner_uri,
        'newStr': 'New',
        'saveStr': 'Save',
        'loadStr': 'Load',
        'saveasStr': 'Save as...',
        'visibilityHelp': 'Show/Hide all options',
        'nonce': '__NONCE__',
        'progressUri': progress_uri,
        'mainUri': main_uri,
        'defconfigUri': defconfig_uri,
        'cspSource': '',
    }

    with open(template) as fh:
        _temp = fh.read()

    # Customize index.html to be able to running test
    content = Template(_temp).substitute(tempdict)

    # Remove access restriction meta data and insert "acquireVsCodeApi()" emulation API
    patch = ['<script src="acquire_vscode_api.js"></script>']
    patch += ['<link rel="stylesheet" type="text/css" href="test-style.css">']
    content = re.sub(r'<meta http-equiv.*/>', '\n'.join(patch), content)

    # Output file extension should be .html
    index_html = os.path.join(_here, '.index.html')
    with open(index_html, 'w') as fh:
        fh.write(content)

def create_kconfig_menudata():
    # We must NuttX configured before create Kconfig menu structure

    cmd = ['./tools/config.py', 'default']
    proc = sp.run(cmd, cwd=SDKDIR)
    proc.check_returncode()

    # Output Kconfig tree structure data because subprocess popen buffer
    # can not takes all of outputs, so it read from file instead.
    cmd = ['python3', '../helper/kconfig2json.py', '-o', 'menudata.json']
    proc = sp.run(cmd, env={
        'srctree': TOPDIR,
        'APPSDIR': '../sdk/apps',
        'EXTERNALDIR': 'dummy',
        'APPSBINDIR': '../sdk/apps',
        'BINDIR': TOPDIR,
    })
    proc.check_returncode()

    with open('menudata.json') as fh:
        menudata = fh.read()
    return menudata

def cleanup_driver_process():
    os.system('pkill chromedriver')
    os.system('pkill -f chromium-browser')

def load_test_suite(suite):
    name = suite + '_test'
    spec = importlib.util.spec_from_file_location(name, f'suite/{suite}_test.py')
    assert spec, f'test suite "{suite}" not found'
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

if __name__ == '__main__':

    testsuitefiles = glob.glob('suite/*_test.py')
    testsuites = list(map(lambda fn: os.path.basename(fn).replace('_test.py', ''),
                          testsuitefiles))

    parser = argparse.ArgumentParser()
    parser.add_argument('-d', '--debug', action="store_true", help='debug mode, test is not run')
    parser.add_argument('-nc', action='store_true', help='show window and not close when test finished')
    parser.add_argument('TESTSUITE', nargs='*', help=f'test suite name(s) {testsuites}')
    args = parser.parse_args()

    if len(args.TESTSUITE) > 0:
        testsuites = args.TESTSUITE

    cleanup_driver_process()
    setup_test_harness()
    create_index_html()
    menudata = create_kconfig_menudata()

    # Open chrome with developer tools (if needed)
    options = Options()
    if args.debug:
        # chrome devtools is very slow when the page has
        # large number of elements.
        # So, SDK configuration opens very slow with devtools.
        # I recommend open devtools after menu loaded.

        # options.add_argument('--auto-open-devtools-for-tabs')
        pass
    else:
        options.headless = True
    if args.nc:
        options.headless = False

    dc = DesiredCapabilities.CHROME
    dc['goog:loggingPrefs'] = { 'browser': 'ALL' }
    service = webdriver.ChromeService(log_output=sp.STDOUT)
    driver = webdriver.Chrome(options=options, service=service)
    driver.set_window_position(0, 0)
    driver.set_window_size(1600, 1024)

    url = _to_uri(os.path.join(_here, 'test.html'))
    driver.get(url)
    wait = WebDriverWait(driver, 5)
    # Wait for the test page is successfully loaded
    wait.until(EC.presence_of_element_located((By.ID, 'ready')))

    # Build Kconfig cofniguration UI in main.js
    driver.execute_script('loadMenu(%s)' % (menudata))
    wait.until(EC.invisibility_of_element((By.ID, 'progress')))

    os.makedirs('screenshots', exist_ok=True)
    driver.save_screenshot('screenshots/initial.png')

    if not args.debug:
        # Test start

        for suite in testsuites:
            mod = load_test_suite(suite)
            print('== {} =='.format(mod.title))
            mod.run(driver)
            print('== {} done =='.format(mod.title))

        logfile = open('console.log', 'w')

        for e in driver.get_log('browser'):
            # snip long URL
            _h = _to_uri(os.path.dirname(_here))
            msg = e['message'].replace(_h, '..')
            ts = datetime.fromtimestamp(e['timestamp']/1000).isoformat(timespec='milliseconds').split('T')[1]

            print(f'[{ts}][{e["level"]}] {msg}', file=logfile)

        logfile.close()

        if not args.nc:
            driver.close()
