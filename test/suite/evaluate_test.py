#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from selenium import webdriver
from selenium.webdriver.common.by import By

import inspect

''' evaluateCond() function test

This test is function test of evaluateCond() defined in resource/config/main.js.
This function uses evaluate expression in condition, dependency and default values.
The expression is defined by Kconfig language (https://www.kernel.org/doc/Documentation/kbuild/kconfig-language.txt).
The purpose of this test is evaluateCond() correctly performed according to Kconfig language.
'''

title = 'Evaluate function test'

# Complex expressions, they bring from actual configuraion conditions

CONFIG_BCH_cond = '(LC823450_IPL2 && ARCH_CHIP_LC823450 && ARCH_ARM) || (Z20X_W25_CHARDEV && y) || (EXAMPLES_MTDPART && MTD_PARTITION && BUILD_FLAT) || (EXAMPLES_MTDRWB && (MTD_WRBUFFER || MTD_READAHEAD) && BUILD_FLAT) || (FSUTILS_MKFATFS && FS_FAT && !DISABLE_PSEUDOFS_OPERATIONS) || (FSUTILS_MKSMARTFS && FS_SMARTFS && !DISABLE_PSEUDOFS_OPERATIONS)'

CONFIG_ARCH_HAVE_SDIO_cond = "(ARCH_CHIP_CXD56XX && MMCSD && y) || (IMXRT_USDHC1 && ARCH_CHIP_IMXRT && ARCH_CHIP_IMXRT && ARCH_ARM) || (IMXRT_USDHC2 && ARCH_CHIP_IMXRT && ARCH_CHIP_IMXRT && ARCH_ARM) || (KINETIS_SDHC && ARCH_CHIP_KINETIS && ARCH_ARM) || (LPC17_40_SDCARD && (ARCH_FAMILY_LPC177X || ARCH_FAMILY_LPC178X || ARCH_FAMILY_LPC407X || ARCH_FAMILY_LPC408X) && ARCH_CHIP_LPC17XX_40XX && ARCH_ARM) || (LPC31_MCI && ARCH_CHIP_LPC31XX && ARCH_ARM) || (LPC43_SDMMC && ARCH_CHIP_LPC43XX && ARCH_ARM) || (LPC54_SDMMC && EXPERIMENTAL && ARCH_CHIP_LPC54XX && ARCH_ARM) || (SAMA5_SDMMC && SAMA5_HAVE_SDMMC && ARCH_CHIP_SAMA5 && ARCH_CHIP_SAMA5 && ARCH_ARM) || (SAMA5_HSMCI0 && ARCH_CHIP_SAMA5 && ARCH_CHIP_SAMA5 && ARCH_ARM) || (SAMA5_HSMCI1 && ARCH_CHIP_SAMA5 && ARCH_CHIP_SAMA5 && ARCH_ARM) || (SAMA5_HSMCI2 && SAMA5_HAVE_HSMCI2 && ARCH_CHIP_SAMA5 && ARCH_CHIP_SAMA5 && ARCH_ARM) || (SAMA5_SDMMC && ARCH_CHIP_SAMA5 && ARCH_CHIP_SAMA5 && ARCH_ARM) || (SAM34_HSMCI && (ARCH_CHIP_SAM3U || ARCH_CHIP_SAM3X || ARCH_CHIP_SAM3A || ARCH_CHIP_SAM4S || ARCH_CHIP_SAM4E) && ARCH_CHIP_SAM34 && ARCH_ARM) || (SAMV7_HSMCI0 && SAMV7_HAVE_HSMCI0 && ARCH_CHIP_SAMV7 && ARCH_CHIP_SAMV7 && ARCH_ARM) || (STM32_SDIO && !STM32_CONNECTIVITYLINE && !STM32_VALUELINE && ARCH_CHIP_STM32 && ARCH_ARM) || (STM32F0L0G0_SDIO && STM32F0L0G0_HAVE_SDIO && (ARCH_CHIP_STM32F0 || ARCH_CHIP_STM32L0 || ARCH_CHIP_STM32G0) && ARCH_ARM) || (STM32F7_SDMMC1 && ARCH_CHIP_STM32F7 && ARCH_CHIP_STM32F7 && ARCH_ARM) || (STM32F7_SDMMC2 && STM32F7_HAVE_SDMMC2 && ARCH_CHIP_STM32F7 && ARCH_CHIP_STM32F7 && ARCH_ARM) || (STM32H7_SDMMC1 && ARCH_CHIP_STM32H7 && ARCH_CHIP_STM32H7 && ARCH_ARM) || (STM32H7_SDMMC2 && ARCH_CHIP_STM32H7 && ARCH_CHIP_STM32H7 && ARCH_ARM) || (STM32L4_SDMMC1 && STM32L4_HAVE_SDMMC1 && ARCH_CHIP_STM32L4 && ARCH_CHIP_STM32L4 && ARCH_ARM) || (CXD56_SDIO && SCHED_HPWORK && ARCH_CHIP_CXD56XX && ARCH_ARM) || (SAMA5_SDMMC && ARCH_BOARD_SAMA5D2_XULT && ARCH_BOARD_SAMA5D2_XULT) || (SAMA5_SDMMC && ARCH_BOARD_GIANT_BOARD && ARCH_BOARD_GIANT_BOARD)"

def evaluateCond(driver, expr):
    fn = inspect.currentframe().f_code.co_name
    print(f'  - test {fn}("{expr}")')
    return driver.execute_script(f'return {fn}("{expr}");')

def evaluateExpr(driver, expr):
    ''' evaluateExpr will returns 0 = "n", 1 = "m", 2 = "y".
    Other values are error, such as bool.
    '''
    fn = inspect.currentframe().f_code.co_name
    print(f'  - test {fn}("{expr}")')
    return driver.execute_script(f'return {fn}("{expr}");')

def run(driver: webdriver):

    # Move frame to webview content
    driver.switch_to.frame(driver.find_element(By.ID, 'debug-target'))

    print(' - Evaluate single boolean value')
    # DEFAULT_SMALL (bool) = n
    # SYSTEM_NSH (bool) = y
    # EXAMPLES_CAMERA (tristate) = n
    assert evaluateCond(driver, 'DEFAULT_SMALL') == False, 'It should be false'
    assert evaluateExpr(driver, 'DEFAULT_SMALL') == 0, 'It should be "n"'
    assert evaluateCond(driver, 'SYSTEM_NSH'), 'It should be true'
    assert evaluateExpr(driver, 'SYSTEM_NSH') == 2, 'It should be "y"'
    assert evaluateCond(driver, 'EXAMPLES_CAMERA') == False, 'It should be false'
    assert evaluateExpr(driver, 'EXAMPLES_CAMERA') == 0, 'It should be "n"'

    print(' - Evaluate expression with int type')
    # DEV_PIPE_SIZE (int) = 1024
    assert evaluateCond(driver, 'DEV_PIPE_SIZE = 1024'), 'It should be true'
    assert evaluateCond(driver, 'DEV_PIPE_SIZE != 0'), 'It should be true'
    assert evaluateCond(driver, 'DEV_PIPE_SIZE < 1025'), 'It should be true'
    assert evaluateCond(driver, 'DEV_PIPE_SIZE < 1024') == False, 'It should be false'
    assert evaluateCond(driver, 'DEV_PIPE_SIZE > 1024') == False, 'It should be false'
    assert evaluateCond(driver, 'DEV_PIPE_SIZE > 1023'), 'It should be true'
    assert evaluateCond(driver, 'DEV_PIPE_SIZE <= 1023') == False, 'It should be false'
    assert evaluateCond(driver, 'DEV_PIPE_SIZE <= 1024'), 'It should be true'
    assert evaluateCond(driver, 'DEV_PIPE_SIZE <= 1025'), 'It should be true'
    assert evaluateCond(driver, 'DEV_PIPE_SIZE >= 1025') == False, 'It should be false'
    assert evaluateCond(driver, 'DEV_PIPE_SIZE >= 1024'), 'It should be true'
    assert evaluateCond(driver, 'DEV_PIPE_SIZE >= 1023'), 'It should be true'

    print(' - Evaluate expression with hex type')
    # RAM_START (hex) = "0x0d000000"
    assert evaluateCond(driver, 'RAM_START = 0x0d000000'), 'It should be true'
    assert evaluateCond(driver, 'RAM_START != 0'), 'It should be true'
    assert evaluateCond(driver, 'RAM_START < 0x0d000001'), 'It should be true'
    assert evaluateCond(driver, 'RAM_START < 0x0d000000') == False, 'It should be false'
    assert evaluateCond(driver, 'RAM_START > 0x0d000000') == False, 'It should be false'
    assert evaluateCond(driver, 'RAM_START > 0x0cffffff'), 'It should be true'
    assert evaluateCond(driver, 'RAM_START <= 0x0cffffff') == False, 'It should be false'
    assert evaluateCond(driver, 'RAM_START <= 0x0d000000'), 'It should be true'
    assert evaluateCond(driver, 'RAM_START <= 0x0d000001'), 'It should be true'
    assert evaluateCond(driver, 'RAM_START >= 0x0d000001') == False, 'It should be false'
    assert evaluateCond(driver, 'RAM_START >= 0x0d000000'), 'It should be true'
    assert evaluateCond(driver, 'RAM_START >= 0x0cffffff'), 'It should be true'

    print(' - Evaluate not (!) syntax')
    assert evaluateCond(driver, '!DEFAULT_SMALL'), '!DEFAULT_SMALL should be true'
    assert evaluateExpr(driver, '!DEFAULT_SMALL') == 2, '!DEFAULT_SMALL should be "y"'

    print(' - Evaluate and (&&) syntax')
    # SYSTEM_CLE (bool) = y
    # VIDEO (bool) = n
    assert evaluateCond(driver, 'SYSTEM_NSH && SYSTEM_CLE'), 'It should be true'
    assert evaluateExpr(driver, 'SYSTEM_NSH && SYSTEM_CLE') == 2, 'It should be "y"'
    assert evaluateCond(driver, 'DEFAULT_SMALL && SYSTEM_NSH') == False, 'It should be false'
    assert evaluateExpr(driver, 'DEFAULT_SMALL && SYSTEM_NSH') == 0, 'It should be "n"'
    assert evaluateCond(driver, 'SYSTEM_NSH && DEFAULT_SMALL') == False, 'It should be false'
    assert evaluateExpr(driver, 'SYSTEM_NSH && DEFAULT_SMALL') == 0, 'It should be "n"'
    assert evaluateCond(driver, 'DEFAULT_SMALL && VIDEO') == False, 'It should be false'
    assert evaluateExpr(driver, 'DEFAULT_SMALL && VIDEO') == 0, 'It should be "n"'

    print(' - Evaluate or (||) syntax')
    assert evaluateCond(driver, 'SYSTEM_NSH || SYSTEM_CLE'), 'It should be true'
    assert evaluateExpr(driver, 'SYSTEM_NSH || SYSTEM_CLE') == 2, 'It should be "y"'
    assert evaluateCond(driver, 'DEFAULT_SMALL || SYSTEM_NSH'), 'It should be true'
    assert evaluateExpr(driver, 'DEFAULT_SMALL || SYSTEM_NSH') == 2, 'It should be "y"'
    assert evaluateCond(driver, 'SYSTEM_NSH || DEFAULT_SMALL'), 'It should be true'
    assert evaluateExpr(driver, 'SYSTEM_NSH || DEFAULT_SMALL') == 2, 'It should be "y"'
    assert evaluateCond(driver, 'DEFAULT_SMALL || VIDEO') == False, 'It should be false'
    assert evaluateExpr(driver, 'DEFAULT_SMALL || VIDEO') == 0, 'It should be "n"'

    print(' - Evaluate brackets')
    assert evaluateCond(driver, '(DEFAULT_SMALL && SYSTEM_NSH) || SYSTEM_CLE'), 'It should be true'
    assert evaluateExpr(driver, '(DEFAULT_SMALL && SYSTEM_NSH) || SYSTEM_CLE') == 2, 'It should be "y"'
    assert evaluateCond(driver, 'SYSTEM_CLE || (DEFAULT_SMALL && SYSTEM_NSH)'), 'It should be true'
    assert evaluateExpr(driver, 'SYSTEM_CLE || (DEFAULT_SMALL && SYSTEM_NSH)') == 2, 'It should be "y"'

    print(' - Evaluate complex expressions')
    assert evaluateCond(driver, 'SYSTEM_NSH && (SYSTEM_CLE || VIDEO) && DEV_PIPE_SIZE = 1024'), 'It should be true'
    assert evaluateCond(driver, '(DEFAULT_SMALL || !BOARD_POWEROFF || !BOARD_RESET) && (BOARDCTL_POWEROFF || BOARDCTL_RESET) && NSH_LIBRARY'), 'It should be true'
    assert evaluateExpr(driver, '(DEFAULT_SMALL || !BOARD_POWEROFF || !BOARD_RESET) && (BOARDCTL_POWEROFF || BOARDCTL_RESET) && NSH_LIBRARY') == 2, 'It should be "y"'

    assert evaluateCond(driver, CONFIG_BCH_cond), 'It should be true'
    assert evaluateExpr(driver, CONFIG_BCH_cond) == 2, 'It should be "y"'
    assert evaluateCond(driver, CONFIG_ARCH_HAVE_SDIO_cond), 'It should be true'
    assert evaluateExpr(driver, CONFIG_ARCH_HAVE_SDIO_cond) == 2, 'It should be "y"'

    driver.switch_to.parent_frame()
