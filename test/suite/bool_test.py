#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import time

from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from suite.menu_test import open_menu, close_menu

title = 'Bool type config test'

def bool_click_test(driver):
    '''
    Bool コンフィグ

    メニューBuild Setup -> Debug Options　をクリックして開き、その下の Enable Debug Features
    コンフィグをクリックします。default defconfigの状態ではNなので、クリック後にYになっていることを確認し、
    関連しているコンフィグが可視化されることを確認します。
    '''

    print(' - Click bool config (N -> Y)')

    open_menu(driver, 'Build Setup')
    open_menu(driver, 'Debug Options')

    # Click 'Enable Debug Features' config, N -> Y
    driver.find_element_by_css_selector('#DEBUG_FEATURES>label>span').click()

    e = driver.find_element_by_css_selector('#DEBUG_FEATURES>label>input')
    assert e.get_property('checked'), 'Clicked config should be Y'

    # Check visibility of related configs, they should be visible.
    related = [
        # nuttx/Kconfig (related by if .. endif section)
        '#DEBUG_ERROR',
        '#DEBUG_ASSERTIONS',
        '#DEBUG_BINFMT',
        '#DEBUG_FS',
        '#DEBUG_GRAPHICS',
        '#DEBUG_LIB',
        '#DEBUG_MM',
        '#DEBUG_NET',
        '#DEBUG_POWER',
        '#DEBUG_SCHED',
        '#DEBUG_DMA',
        '#DEBUG_IRQ',
        '#DEBUG_LEDS',
        '#DEBUG_GPIO',
        '#DEBUG_I2C',
        '#DEBUG_PWM',
        '#DEBUG_RTC',
        '#DEBUG_MEMCARD',
        '#DEBUG_SPI',
        '#DEBUG_TIMER',
        '#DEBUG_USB',
        '#DEBUG_WATCHDOG',
        # sched/Kconfig
        '#DEBUG_CHILDSTATUS',
    ]

    for id in related:
        e = driver.find_element_by_css_selector(id)
        classlist = e.get_attribute('class')
        assert not 'invisible' in classlist, '{} is not visible'.format(id)

    # Wait for bool config animation finished
    time.sleep(0.5)
    driver.find_element_by_id('DEBUG_FEATURES').screenshot('screenshots/bool-clicked-y.png')

    print(' - Click bool config (Y -> N)')

    driver.find_element_by_css_selector('#DEBUG_FEATURES>label>span').click()

    for id in related:
        e = driver.find_element_by_css_selector(id)
        classlist = e.get_attribute('class')
        assert 'invisible' in classlist, '{} is not visible'.format(id)

    # Wait for bool config animation finished
    time.sleep(0.5)
    driver.find_element_by_id('DEBUG_FEATURES').screenshot('screenshots/bool-clicked-n.png')

def run(driver):

    frame = driver.find_element_by_id('debug-target')
    driver.switch_to.frame(frame)

    bool_click_test(driver)

    driver.switch_to.parent_frame()

