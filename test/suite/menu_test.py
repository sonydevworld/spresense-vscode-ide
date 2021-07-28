#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import time

from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

title = 'Menu type config test'

def _proc_menu(driver, prompt, toopen):
   menus = driver.find_elements_by_css_selector('.menu.config')
   for m in menus:
       e = m.find_element_by_css_selector('.prompt')
       if e.text == prompt:
           menuid = m.get_attribute('for')
           input = driver.find_element_by_id(menuid)
           if input.get_property('checked') != toopen:
               e.click()
           return menuid

def open_menu(driver, prompt):
    return _proc_menu(driver, prompt, True)

def close_menu(driver, prompt):
    return _proc_menu(driver, prompt, False)

def menu_click_test(driver):
    '''
    Menu

    メニュー "Build Setup" をクリックして開き、その下のコンフィグが展開されて可視化されることを確認します。
    また、再度クリックしたらそのメニューが折りたたまれ、その下のコンフィグが不可視となることを確認します。
    '''

    print(' - Click to menu expand')

    id = open_menu(driver, 'Build Setup')
    assert id, 'Menu not found'
    menu = driver.find_element_by_id(id)
    assert menu.get_property('checked'), 'Menu should be expanded'
    menu.find_element_by_xpath('..').screenshot('screenshots/menu-expanded.png')

    print(' - Click to menu shrink')
    id = close_menu(driver, 'Build Setup')
    assert id, 'Menu not found'
    assert menu.get_property('checked') == False, 'Menu should be shrinked'
    menu.find_element_by_xpath('..').screenshot('screenshots/menu-shrinked.png')

def run(driver):

    frame = driver.find_element_by_id('debug-target')
    driver.switch_to.frame(frame)

    menu_click_test(driver)

    driver.switch_to.parent_frame()

