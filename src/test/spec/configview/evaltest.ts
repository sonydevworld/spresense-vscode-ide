import { expect } from 'chai';
import { VSBrowser } from 'vscode-extension-tester';

async function evaluateExpr(expr: string) {
    return await VSBrowser.instance.driver.executeScript(`return evaluateExpr("${expr}");`);
}

export async function evaluationTests() {
    describe("can evaluate <symbol>", async () => {
        it("y", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_Y')).to.equal(2);
        });
        it("m", async () => {
            expect(await evaluateExpr('SYMBOL_TRI_M')).to.equal(1);
        });
        it("n", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_N')).to.equal(0);
        });
    });

    describe("can evaluate <symbol> '=' <symbol>", async () => {
        it("y = y", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_Y = SYMBOL_TRI_Y')).to.equal(2);
        });
        it("y = m", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_Y = SYMBOL_TRI_M')).to.equal(0);
        });
        it("y = n", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_Y = SYMBOL_TRI_N')).to.equal(0);
        });
        it("int value", async () => {
            expect(await evaluateExpr('SYMBOL_INT_1024 = 1024')).to.equal(2);
        });
        it("hex value", async () => {
            expect(await evaluateExpr('SYMBOL_HEX_0X100 = 0x100')).to.equal(2);
        });
    });

    describe("can evaluate <symbol> '!=' <symbol>", async () => {
        it("y != y", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_Y != SYMBOL_TRI_Y')).to.equal(0);
        });
        it("y != m", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_Y != SYMBOL_TRI_M')).to.equal(2);
        });
        it("y != n", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_Y != SYMBOL_TRI_N')).to.equal(2);
        });
        it("int value", async () => {
            expect(await evaluateExpr('SYMBOL_INT_1024 != 0')).to.equal(2);
        });
        it("hex value", async () => {
            expect(await evaluateExpr('SYMBOL_HEX_0X100 != 0')).to.equal(2);
        });
    });

    describe("can evaluate <symbol> '<' <symbol>", async () => {
        it("evaluate int symbol", async () => {
            expect(await evaluateExpr('SYMBOL_INT_1024 < SYMBOL_INT_1024')).to.equal(0);
            expect(await evaluateExpr('SYMBOL_INT_1024 < 1025')).to.equal(2);
            expect(await evaluateExpr('SYMBOL_INT_1024 < 1024')).to.equal(0);
        });
        it("evaluate hex symbol", async () => {
            expect(await evaluateExpr('SYMBOL_HEX_0X100 < SYMBOL_HEX_0X100')).to.equal(0);
            expect(await evaluateExpr('SYMBOL_HEX_0X100 < 0x101')).to.equal(2);
            expect(await evaluateExpr('SYMBOL_HEX_0X100 < 0x100')).to.equal(0);
        });
    });

    describe("can evaluate <symbol> '>' <symbol>", async () => {
        it("evaluate int symbol", async () => {
            expect(await evaluateExpr('SYMBOL_INT_1024 > SYMBOL_INT_1024')).to.equal(0);
            expect(await evaluateExpr('SYMBOL_INT_1024 > 1024')).to.equal(0);
            expect(await evaluateExpr('SYMBOL_INT_1024 > 1023')).to.equal(2);
        });
        it("evaluate hex symbol", async () => {
            expect(await evaluateExpr('SYMBOL_HEX_0X100 > SYMBOL_HEX_0X100')).to.equal(0);
            expect(await evaluateExpr('SYMBOL_HEX_0X100 > 0x100')).to.equal(0);
            expect(await evaluateExpr('SYMBOL_HEX_0X100 > 0xff')).to.equal(2);
        });
    });

    describe("can evaluate <symbol> '<=' <symbol>", async () => {
        it("evaluate int symbol", async () => {
            expect(await evaluateExpr('SYMBOL_INT_1024 <= SYMBOL_INT_1024')).to.equal(2);
            expect(await evaluateExpr('SYMBOL_INT_1024 <= 1023')).to.equal(0);
            expect(await evaluateExpr('SYMBOL_INT_1024 <= 1024')).to.equal(2);
            expect(await evaluateExpr('SYMBOL_INT_1024 <= 1025')).to.equal(2);
        });
        it("evaluate hex symbol", async () => {
            expect(await evaluateExpr('SYMBOL_HEX_0X100 <= SYMBOL_HEX_0X100')).to.equal(2);
            expect(await evaluateExpr('SYMBOL_HEX_0X100 <= 0xff')).to.equal(0);
            expect(await evaluateExpr('SYMBOL_HEX_0X100 <= 0x100')).to.equal(2);
            expect(await evaluateExpr('SYMBOL_HEX_0X100 <= 0x101')).to.equal(2);
        });
    });

    describe("can evaluate <symbol> '>=' <symbol>", async () => {
        it("evaluate int symbol", async () => {
            expect(await evaluateExpr('SYMBOL_INT_1024 >= SYMBOL_INT_1024')).to.equal(2);
            expect(await evaluateExpr('SYMBOL_INT_1024 >= 1023')).to.equal(2);
            expect(await evaluateExpr('SYMBOL_INT_1024 >= 1024')).to.equal(2);
            expect(await evaluateExpr('SYMBOL_INT_1024 >= 1025')).to.equal(0);
        });
        it("evaluate hex symbol", async () => {
            expect(await evaluateExpr('SYMBOL_HEX_0X100 >= SYMBOL_HEX_0X100')).to.equal(2);
            expect(await evaluateExpr('SYMBOL_HEX_0X100 >= 0xff')).to.equal(2);
            expect(await evaluateExpr('SYMBOL_HEX_0X100 >= 0x100')).to.equal(2);
            expect(await evaluateExpr('SYMBOL_HEX_0X100 >= 0x101')).to.equal(0);
        });
    });

    describe("can evaluate '(' <expr> ')'", async () => {
        it("SYMBOL_BOOL_Y && (SYMBOL_INT_1024 = 1024)", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_Y && (SYMBOL_INT_1024 = 1024)')).to.equal(2);
        });
    });

    describe("can evaluate <expr> '&&' <expr>", async () => {
        it("y && y", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_Y && SYMBOL_TRI_Y')).to.equal(2);
        });
        it("y && n", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_Y && SYMBOL_BOOL_N')).to.equal(0);
        });
        it("n && y", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_N && SYMBOL_BOOL_Y')).to.equal(0);
        });
        it("n && n", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_N && SYMBOL_TRI_N')).to.equal(0);
        });
    });

    describe("can evaluate <expr> '||' <expr>", async () => {
        it("y || y", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_Y || SYMBOL_TRI_Y')).to.equal(2);
        });
        it("y || n", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_Y || SYMBOL_BOOL_N')).to.equal(2);
        });
        it("n || y", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_N || SYMBOL_BOOL_Y')).to.equal(2);
        });
        it("n || n", async () => {
            expect(await evaluateExpr('SYMBOL_BOOL_N || SYMBOL_TRI_N')).to.equal(0);
        });
    });
}
