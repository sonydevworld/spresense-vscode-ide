#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import glob
import json
import subprocess as sp

from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from defconfig import Defconfig

def create_defconfig_list(sdkdir):
    ''' Create defconfig dialog data
    This function emulates SDKConfigView2._getDefconfigs().
    '''

    list_ = []
    configdir = os.path.join(sdkdir, 'configs')
    configs = glob.glob(os.path.join(configdir, '*', 'defconfig'))
    configs += sorted(glob.glob(os.path.join(configdir, '*', '*', 'defconfig')))

    for c in configs:
        path = os.path.dirname(c)
        cname = path.replace(configdir + '/', '')
        readmepath = os.path.join(path, 'README.txt')
        desc = ''
        try:
            with open(readmepath) as fh:
                desc = fh.read()
        except:
            pass

        list_.append({
            'defconfig': cname,
            'desc': desc
        })

    return list_

def show_new_dialog_and_select(driver, dclist, name):
    '''
    name: defconfig name (e.g. examples/hello)
    '''

    wait = WebDriverWait(driver, 10)
    # Emulate press new button
    frame = driver.find_element_by_id('debug-target')
    driver.switch_to.frame(frame)
    driver.find_element_by_id('new').click()
    driver.switch_to.parent_frame()

    # Wait for get-defconfigs message by new button pressed
    wait.until(EC.title_contains('get-defconfigs'))

    driver.execute_script('sendDefconfigList(%s)' % json.dumps(dclist))

    # Switch to main content and select defconfig dialog, and press OK.
    driver.switch_to.frame(frame)
    # If 'default' config specified, no select and just press OK.
    if name != 'default':
        elements = driver.find_elements_by_css_selector('div.defconfig-item')
        for e in elements:
            ename = e.get_attribute('data-exact-name')
            if ename == name + '/defconfig':
                e.click() # select
                break
    driver.find_element_by_id('defconfig-ok').click()
    driver.switch_to.parent_frame()

    wait.until(EC.title_contains('load-defconfigs'))
    return driver.execute_script('return messageContent;')

def load_config(driver, sdkdir, configname):
    '''
    configname(str): e.g. 'examples/hello'
    '''

    # main.js sends 'load-defconfigs' message with selected defconfigs when press OK button.
    # Here is a loading from selected defconfigs content, and reply
    # configuration content to main.js.
    defconfig = Defconfig(sdkdir)
    defconfig.apply(configname)
    driver.execute_script("loadDefconfigs('%s')" % (defconfig.stringify()))

def save_config(driver, filepath):
    # Click 'save' button
    driver.switch_to.frame(driver.find_element_by_id('debug-target'))
    driver.find_element_by_id('save').click()
    driver.switch_to.parent_frame()

    wait = WebDriverWait(driver, 10)
    wait.until(EC.title_contains('save'))
    content = driver.execute_script('return messageContent;')

    _dir = os.path.dirname(filepath)
    os.makedirs(_dir, exist_ok=True)
    with open(filepath, 'w') as fh:
        fh.write(content)

def run(driver, sdkdir):
    from compare_config import prepare, compare_config

    prepare(sdkdir)

    dclist = create_defconfig_list(sdkdir)
    #dclist = [{'defconfig': 'feature/subcore'}]
    #dclist = [{'defconfig': 'examples/hostif_spi'}]
    #dclist = [{'defconfig': 'examples/hostif_spi'},
    #          {'defconfig': 'feature/ramlog'}]

    for c in dclist:
        cname = c['defconfig']
        print(' - Test for %s' % cname)
        # XXX: show_new_dialog_and_select() function selects only one defconfig
        config = show_new_dialog_and_select(driver, dclist, cname)
        print('  - Load configuration')
        load_config(driver, sdkdir, cname)
        outfile = os.path.join('results', cname, 'gui.config')
        print('  - Save configuration to %s' % outfile)
        save_config(driver, outfile)

        compare_config('results/' + cname + '/basis.config',
                       'results/' + cname + '/dot.config')
