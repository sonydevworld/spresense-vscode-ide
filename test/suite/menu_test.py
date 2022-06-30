#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import time

from selenium import webdriver
from selenium.webdriver import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

title = 'Menu type config test'

def _proc_menu(driver: webdriver, prompt: str, toopen: bool):
    menus = driver.find_elements(By.CSS_SELECTOR, '.menu.config .prompt')
    for m in menus:
        if m.text == prompt:
            label = m.find_element(By.XPATH, '..')
            labelid = label.get_attribute('id')
            menuid = label.get_attribute('for')
            input = driver.find_element(By.ID, menuid)
            if input.get_property('checked') != toopen:
                ActionChains(driver).scroll_to_element(m).perform()
                wait = WebDriverWait(driver, timeout=10)
                label = wait.until(EC.element_to_be_clickable((By.ID, labelid)))
                label.click()
            return menuid

def open_menu(driver: webdriver, prompt: str):
    return _proc_menu(driver, prompt, True)

def close_menu(driver: webdriver, prompt: str):
    return _proc_menu(driver, prompt, False)

def menu_click_test(driver: webdriver):
    '''
    Menu

    メニュー "Build Setup" をクリックして開き、その下のコンフィグが展開されて可視化されることを確認します。
    また、再度クリックしたらそのメニューが折りたたまれ、その下のコンフィグが不可視となることを確認します。
    '''

    print(' - Click to menu expand')

    id = open_menu(driver, 'Build Setup')
    assert id, 'Menu not found'
    menu = driver.find_element(By.ID, id)
    assert menu.get_property('checked'), 'Menu should be expanded'
    menu.find_element(By.XPATH, '..').screenshot('screenshots/menu-expanded.png')

    print(' - Click to menu shrink')
    id = close_menu(driver, 'Build Setup')
    assert id, 'Menu not found'
    assert menu.get_property('checked') == False, 'Menu should be shrinked'
    menu.find_element(By.XPATH, '..').screenshot('screenshots/menu-shrinked.png')

def run(driver: webdriver):

    frame = driver.find_element(By.ID, 'debug-target')
    driver.switch_to.frame(frame)

    menu_click_test(driver)

    driver.switch_to.parent_frame()

