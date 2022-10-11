import { expect } from 'chai';
import { VSBrowser } from 'vscode-extension-tester';

async function evaluateCond(expr: string) {
    return await VSBrowser.instance.driver.executeScript(`return evaluateCond("${expr}");`);
}

async function evaluateExpr(expr: string) {
    return await VSBrowser.instance.driver.executeScript(`return evaluateExpr("${expr}");`);
}

export async function evaluationTests() {
    it('can evaluate single boolean value', async () => {
        // DEFAULT_SMALL (bool) = n
        // SYSTEM_NSH (bool) = y
        // EXAMPLES_CAMERA (tristate) = n
        expect(await evaluateCond('DEFAULT_SMALL')).to.be.false;
        expect(await evaluateExpr('DEFAULT_SMALL')).to.equal(0);
        expect(await evaluateCond('SYSTEM_NSH')).to.be.true;
        expect(await evaluateExpr('SYSTEM_NSH')).to.equal(2);
        expect(await evaluateCond('EXAMPLES_CAMERA')).to.be.false;
        expect(await evaluateExpr('EXAMPLES_CAMERA')).to.equal(0);
    });

    it('can evaluate expression with int type', async () => {
        // DEV_PIPE_SIZE (int) = 1024
        expect(await evaluateCond('DEV_PIPE_SIZE = 1024')).to.be.true;
        expect(await evaluateCond('DEV_PIPE_SIZE != 0')).to.be.true;
        expect(await evaluateCond('DEV_PIPE_SIZE < 1025')).to.be.true;
        expect(await evaluateCond('DEV_PIPE_SIZE < 1024')).to.be.false;
        expect(await evaluateCond('DEV_PIPE_SIZE > 1024')).to.be.false;
        expect(await evaluateCond('DEV_PIPE_SIZE > 1023')).to.be.true;
        expect(await evaluateCond('DEV_PIPE_SIZE <= 1023')).to.be.false;
        expect(await evaluateCond('DEV_PIPE_SIZE <= 1024')).to.be.true;
        expect(await evaluateCond('DEV_PIPE_SIZE <= 1025')).to.be.true;
        expect(await evaluateCond('DEV_PIPE_SIZE >= 1025')).to.be.false;
        expect(await evaluateCond('DEV_PIPE_SIZE >= 1024')).to.be.true;
        expect(await evaluateCond('DEV_PIPE_SIZE >= 1023')).to.be.true;
    });

    it('can evaluate expression with hex type', async () => {
        // RAM_START (hex) = "0x0d000000"
        expect(await evaluateCond('RAM_START = 0x0d000000')).to.be.true;
        expect(await evaluateCond('RAM_START != 0')).to.be.true;
        expect(await evaluateCond('RAM_START < 0x0d000001')).to.be.true;
        expect(await evaluateCond('RAM_START < 0x0d000000')).to.be.false;
        expect(await evaluateCond('RAM_START > 0x0d000000')).to.be.false;
        expect(await evaluateCond('RAM_START > 0x0cffffff')).to.be.true;
        expect(await evaluateCond('RAM_START <= 0x0cffffff')).to.be.false;
        expect(await evaluateCond('RAM_START <= 0x0d000000')).to.be.true;
        expect(await evaluateCond('RAM_START <= 0x0d000001')).to.be.true;
        expect(await evaluateCond('RAM_START >= 0x0d000001')).to.be.false;
        expect(await evaluateCond('RAM_START >= 0x0d000000')).to.be.true;
        expect(await evaluateCond('RAM_START >= 0x0cffffff')).to.be.true;
    });

    it('can evaluate NOT (!) syntax', async () => {
        expect(await evaluateCond('!DEFAULT_SMALL')).to.be.true;
        expect(await evaluateExpr('!DEFAULT_SMALL')).to.equal(2);
    });

    it('can evaluate within AND (&&) syntax', async () => {
        // SYSTEM_CLE (bool) = y
        // VIDEO (bool) = n
        expect(await evaluateCond('SYSTEM_NSH && SYSTEM_CLE')).to.be.true;
        expect(await evaluateExpr('SYSTEM_NSH && SYSTEM_CLE')).to.equal(2);
        expect(await evaluateCond('DEFAULT_SMALL && SYSTEM_NSH')).to.be.false;
        expect(await evaluateExpr('DEFAULT_SMALL && SYSTEM_NSH')).to.equal(0);
        expect(await evaluateCond('SYSTEM_NSH && DEFAULT_SMALL')).to.be.false;
        expect(await evaluateExpr('SYSTEM_NSH && DEFAULT_SMALL')).to.equal(0);
        expect(await evaluateCond('DEFAULT_SMALL && VIDEO')).to.be.false;
        expect(await evaluateExpr('DEFAULT_SMALL && VIDEO')).to.equal(0);
    });

    it('can evaluate within OR (||) syntax', async () => {
        expect(await evaluateCond('SYSTEM_NSH || SYSTEM_CLE')).to.be.true;
        expect(await evaluateExpr('SYSTEM_NSH || SYSTEM_CLE')).to.equal(2);
        expect(await evaluateCond('DEFAULT_SMALL || SYSTEM_NSH')).to.be.true;
        expect(await evaluateExpr('DEFAULT_SMALL || SYSTEM_NSH')).to.equal(2);
        expect(await evaluateCond('SYSTEM_NSH || DEFAULT_SMALL')).to.be.true;
        expect(await evaluateExpr('SYSTEM_NSH || DEFAULT_SMALL')).to.equal(2);
        expect(await evaluateCond('DEFAULT_SMALL || VIDEO')).to.be.false;
        expect(await evaluateExpr('DEFAULT_SMALL || VIDEO')).to.equal(0);
    });

    it('can evaluate within brackets', async () => {
        expect(await evaluateCond('(DEFAULT_SMALL && SYSTEM_NSH) || SYSTEM_CLE')).to.be.true;
        expect(await evaluateExpr('(DEFAULT_SMALL && SYSTEM_NSH) || SYSTEM_CLE')).to.equal(2);
        expect(await evaluateCond('SYSTEM_CLE || (DEFAULT_SMALL && SYSTEM_NSH)')).to.be.true;
        expect(await evaluateExpr('SYSTEM_CLE || (DEFAULT_SMALL && SYSTEM_NSH)')).to.equal(2);
    });

    it('can evaluate complex expressions', async () => {
        const complex1 = 'SYSTEM_NSH && (SYSTEM_CLE || VIDEO) && DEV_PIPE_SIZE = 1024';
        const complex2 = '(DEFAULT_SMALL || !BOARD_POWEROFF || !BOARD_RESET) && (BOARDCTL_POWEROFF || BOARDCTL_RESET) && NSH_LIBRARY';
        const complex3 = '(LC823450_IPL2 && ARCH_CHIP_LC823450 && ARCH_ARM) || (Z20X_W25_CHARDEV && y) || (EXAMPLES_MTDPART && MTD_PARTITION && BUILD_FLAT) || (EXAMPLES_MTDRWB && (MTD_WRBUFFER || MTD_READAHEAD) && BUILD_FLAT) || (FSUTILS_MKFATFS && FS_FAT && !DISABLE_PSEUDOFS_OPERATIONS) || (FSUTILS_MKSMARTFS && FS_SMARTFS && !DISABLE_PSEUDOFS_OPERATIONS)';
        const complex4 = "(ARCH_CHIP_CXD56XX && MMCSD && y) || (IMXRT_USDHC1 && ARCH_CHIP_IMXRT && ARCH_CHIP_IMXRT && ARCH_ARM) || (IMXRT_USDHC2 && ARCH_CHIP_IMXRT && ARCH_CHIP_IMXRT && ARCH_ARM) || (KINETIS_SDHC && ARCH_CHIP_KINETIS && ARCH_ARM) || (LPC17_40_SDCARD && (ARCH_FAMILY_LPC177X || ARCH_FAMILY_LPC178X || ARCH_FAMILY_LPC407X || ARCH_FAMILY_LPC408X) && ARCH_CHIP_LPC17XX_40XX && ARCH_ARM) || (LPC31_MCI && ARCH_CHIP_LPC31XX && ARCH_ARM) || (LPC43_SDMMC && ARCH_CHIP_LPC43XX && ARCH_ARM) || (LPC54_SDMMC && EXPERIMENTAL && ARCH_CHIP_LPC54XX && ARCH_ARM) || (SAMA5_SDMMC && SAMA5_HAVE_SDMMC && ARCH_CHIP_SAMA5 && ARCH_CHIP_SAMA5 && ARCH_ARM) || (SAMA5_HSMCI0 && ARCH_CHIP_SAMA5 && ARCH_CHIP_SAMA5 && ARCH_ARM) || (SAMA5_HSMCI1 && ARCH_CHIP_SAMA5 && ARCH_CHIP_SAMA5 && ARCH_ARM) || (SAMA5_HSMCI2 && SAMA5_HAVE_HSMCI2 && ARCH_CHIP_SAMA5 && ARCH_CHIP_SAMA5 && ARCH_ARM) || (SAMA5_SDMMC && ARCH_CHIP_SAMA5 && ARCH_CHIP_SAMA5 && ARCH_ARM) || (SAM34_HSMCI && (ARCH_CHIP_SAM3U || ARCH_CHIP_SAM3X || ARCH_CHIP_SAM3A || ARCH_CHIP_SAM4S || ARCH_CHIP_SAM4E) && ARCH_CHIP_SAM34 && ARCH_ARM) || (SAMV7_HSMCI0 && SAMV7_HAVE_HSMCI0 && ARCH_CHIP_SAMV7 && ARCH_CHIP_SAMV7 && ARCH_ARM) || (STM32_SDIO && !STM32_CONNECTIVITYLINE && !STM32_VALUELINE && ARCH_CHIP_STM32 && ARCH_ARM) || (STM32F0L0G0_SDIO && STM32F0L0G0_HAVE_SDIO && (ARCH_CHIP_STM32F0 || ARCH_CHIP_STM32L0 || ARCH_CHIP_STM32G0) && ARCH_ARM) || (STM32F7_SDMMC1 && ARCH_CHIP_STM32F7 && ARCH_CHIP_STM32F7 && ARCH_ARM) || (STM32F7_SDMMC2 && STM32F7_HAVE_SDMMC2 && ARCH_CHIP_STM32F7 && ARCH_CHIP_STM32F7 && ARCH_ARM) || (STM32H7_SDMMC1 && ARCH_CHIP_STM32H7 && ARCH_CHIP_STM32H7 && ARCH_ARM) || (STM32H7_SDMMC2 && ARCH_CHIP_STM32H7 && ARCH_CHIP_STM32H7 && ARCH_ARM) || (STM32L4_SDMMC1 && STM32L4_HAVE_SDMMC1 && ARCH_CHIP_STM32L4 && ARCH_CHIP_STM32L4 && ARCH_ARM) || (CXD56_SDIO && SCHED_HPWORK && ARCH_CHIP_CXD56XX && ARCH_ARM) || (SAMA5_SDMMC && ARCH_BOARD_SAMA5D2_XULT && ARCH_BOARD_SAMA5D2_XULT) || (SAMA5_SDMMC && ARCH_BOARD_GIANT_BOARD && ARCH_BOARD_GIANT_BOARD)";

        expect(await evaluateCond(complex1)).to.be.true;
        expect(await evaluateCond(complex2)).to.be.true;
        expect(await evaluateExpr(complex2)).to.equal(2);
        expect(await evaluateCond(complex3)).to.be.true;
        expect(await evaluateExpr(complex3)).to.equal(2);
        expect(await evaluateCond(complex4)).to.be.true;
        expect(await evaluateExpr(complex4)).to.equal(2);
    });
}
