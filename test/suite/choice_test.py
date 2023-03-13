#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import time

from selenium import webdriver
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

from suite.menu_test import open_menu, close_menu

title = 'Choice type config test'

def choice_click_test(driver: webdriver):
    '''
    choice コンフィグテスト

    メニューBuild Setupをクリックして開き、その下の "Build Host Platform" でWindowsを選択します。（デフォルトはLinux）
    この操作により関連しているコンフィグが可視化されることを確認します。
    '''

    print(' - Select config')

    open_menu(driver, 'Build Setup')

    assert driver.find_element(By.CSS_SELECTOR, '#choice-0>div.symbol').text == 'HOST_LINUX', 'Choice symbol text is invalid'

    # Select 'Build Host Platform' to 'Windows'
    driver.find_element(By.ID, 'HOST_WINDOWS').click()

    e = driver.find_element(By.CSS_SELECTOR, '#choice-0>select')
    assert e.get_property('value') == 'Windows', 'It should be "Windows"'
    assert driver.find_element(By.CSS_SELECTOR, '#choice-0>div.symbol').text == 'HOST_WINDOWS', 'Choice symbol text is invalid'

    driver.find_element(By.ID, 'choice-0').screenshot('screenshots/select-windows-host.png')
    # Related option 'Windows Host Platform' has been displayed
    e = driver.find_element(By.ID, 'choice-1')
    ActionChains(driver).move_to_element(e).perform()
    assert e.is_displayed()
    assert e.find_element(By.TAG_NAME, 'select').get_property('value') == 'Cygwin', 'It should be "Cygwin" by default'

    # Revert 'Build Host Platform' to 'Linux'
    driver.find_element(By.ID, 'HOST_LINUX').click()

    e = driver.find_element(By.CSS_SELECTOR, '#choice-0 > select')
    assert e.get_property('value') == 'Linux', 'It should be "Linux"'
    
    driver.find_element(By.ID, 'choice-0').screenshot('screenshots/select-linux-host.png')

    # Related option 'Windows Host Platform' to be hidden
    e = driver.find_element(By.ID, 'choice-1')
    assert not e.is_displayed()

    close_menu(driver, 'Build Setup')

def run(driver: webdriver):

    frame = driver.find_element(By.ID, 'debug-target')
    driver.switch_to.frame(frame)

    choice_click_test(driver)

    driver.switch_to.parent_frame()

