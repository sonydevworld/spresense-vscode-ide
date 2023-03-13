#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import glob
import json
import subprocess as sp

from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

from defconfig import Defconfig

title = 'New (defconfig) test'

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

def show_new_dialog_and_select(driver: webdriver, dclist: list, name: str):
    '''
    name: defconfig name (e.g. examples/hello)
    '''

    wait = WebDriverWait(driver, 10)
    # Emulate press new button
    frame = driver.find_element(By.ID, 'debug-target')
    driver.switch_to.frame(frame)
    driver.find_element(By.ID, 'new').click()
    driver.switch_to.parent_frame()

    # Wait for get-defconfigs message by new button pressed
    wait.until(EC.title_contains('get-defconfigs'))

    driver.execute_script(f'sendDefconfigList({json.dumps(dclist)})')

    # Switch to main content and select defconfig dialog, and press OK.
    driver.switch_to.frame(frame)
    # If 'default' config specified, no select and just press OK.
    if name != 'default':
        elements = driver.find_elements(By.CSS_SELECTOR, 'div.defconfig-item')
        for e in elements:
            ename = e.get_attribute('data-exact-name')
            if ename == name + '/defconfig':
                e.click() # select
                break
    driver.find_element(By.ID, 'defconfig-ok').click()
    driver.switch_to.parent_frame()

    wait.until(EC.title_contains('load-defconfigs'))
    return driver.execute_script('return messageContent;')

def load_config(driver: webdriver, sdkdir: str, configname: str):
    '''
    configname(str): e.g. 'examples/hello'
    '''

    # main.js sends 'load-defconfigs' message with selected defconfigs when press OK button.
    # Here is a loading from selected defconfigs content, and reply
    # configuration content to main.js.
    defconfig = Defconfig(sdkdir)
    defconfig.apply(configname)
    driver.execute_script(f"loadDefconfigs('{defconfig.stringify()}')")

def save_config(driver: webdriver, filepath: str):
    # Click 'save' button
    driver.switch_to.frame(driver.find_element(By.ID, 'debug-target'))
    driver.find_element(By.ID, 'save').click()
    driver.switch_to.parent_frame()

    wait = WebDriverWait(driver, 10)
    wait.until(EC.title_contains('save'))
    content = driver.execute_script('return messageContent;')

    _dir = os.path.dirname(filepath)
    os.makedirs(_dir, exist_ok=True)
    with open(filepath, 'w') as fh:
        fh.write(content)

def run(driver: webdriver):
    from compare_config import prepare, compare_config

    sdkdir = '.harness/spresense/sdk'

    prepare(sdkdir)

    dclist = create_defconfig_list(sdkdir)
    #dclist = [{'defconfig': 'feature/subcore'}]
    #dclist = [{'defconfig': 'examples/hostif_spi'}]
    #dclist = [{'defconfig': 'examples/hostif_spi'},
    #          {'defconfig': 'feature/ramlog'}]

    for c in dclist:
        cname = c['defconfig']
        print(f' - Test for {cname}')
        # XXX: show_new_dialog_and_select() function selects only one defconfig
        config = show_new_dialog_and_select(driver, dclist, cname)
        print('  - Load configuration')
        load_config(driver, sdkdir, cname)
        outfile = os.path.join('results', cname, 'gui.config')
        print(f'  - Save configuration to {outfile}')
        save_config(driver, outfile)

        compare_config(f'results/{cname}/basis.config',
                       f'results/{cname}/dot.config')
