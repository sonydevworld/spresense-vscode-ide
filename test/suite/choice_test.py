#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import time

from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from suite.menu_test import open_menu

title = 'Choice type config test'

def choice_click_test(driver):
    '''
    choice コンフィグテスト

    メニューBuild Setupをクリックして開き、その下の "Build Host Platform" でWindowsを選択します。（デフォルトはLinux）
    この操作により関連しているコンフィグが可視化されることを確認します。
    '''

    print(' - Select config')

    open_menu(driver, 'Build Setup')

    assert driver.find_element_by_css_selector('#choice-0>div.symbol').text == 'HOST_LINUX', 'Choice symbol text is invalid'

    # Select 'Build Host Platform' to 'Windows'
    driver.find_element_by_id('HOST_WINDOWS').click()

    e = driver.find_element_by_css_selector('#choice-0>select')
    assert e.get_property('value') == 'Windows', 'It should be "Windows"'
    assert driver.find_element_by_css_selector('#choice-0>div.symbol').text == 'HOST_WINDOWS', 'Choice symbol text is invalid'

    driver.find_element_by_id('choice-0').screenshot('screenshots/select-windows-host.png')
    # Related option 'Windows Host Platform' has been displayed
    e = driver.find_element_by_id('choice-1')
    ActionChains(driver).move_to_element(e).perform()
    assert e.is_displayed()
    assert e.find_element_by_tag_name('select').get_property('value') == 'Cygwin', 'It should be "Cygwin" by default'

    # Revert 'Build Host Platform' to 'Linux'
    driver.find_element_by_id('HOST_LINUX').click()

    e = driver.find_element_by_css_selector('#choice-0>select')
    assert e.get_property('value') == 'Linux', 'It should be "Linux"'
    
    driver.find_element_by_id('choice-0').screenshot('screenshots/select-linux-host.png')

    # Related option 'Windows Host Platform' to be hidden
    e = driver.find_element_by_id('choice-1')
    assert not e.is_displayed()

def run(driver):

    frame = driver.find_element_by_id('debug-target')
    driver.switch_to.frame(frame)

    choice_click_test(driver)

    driver.switch_to.parent_frame()

