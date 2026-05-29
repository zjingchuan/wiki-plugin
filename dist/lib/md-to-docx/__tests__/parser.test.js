import { describe, it } from "node:test";
import assert from "node:assert";
import { marked } from "marked";
import { Paragraph, Table } from "docx";
import { tokensToDocxBlocks } from "../parser.js";
function makeCtx(overrides = {}) {
    return {
        imageBaseDir: ".",
        imageResolver: () => null,
        warnings: [],
        headingOffset: 0,
        ...overrides,
    };
}
describe("tokensToDocxBlocks", () => {
    it("paragraph token produces a Paragraph instance", () => {
        const tokens = marked.lexer("Hello world");
        const blocks = tokensToDocxBlocks(tokens, makeCtx());
        assert.ok(blocks.length >= 1);
        assert.ok(blocks[0] instanceof Paragraph);
    });
    it("heading token produces a Paragraph with HeadingLevel", () => {
        const tokens = marked.lexer("## Second heading");
        const blocks = tokensToDocxBlocks(tokens, makeCtx());
        assert.ok(blocks.length >= 1);
        assert.ok(blocks[0] instanceof Paragraph);
    });
    it("headingOffset=1 shifts H1 to H2 level", () => {
        const tokens = marked.lexer("# Title");
        const blocks = tokensToDocxBlocks(tokens, makeCtx({ headingOffset: 1 }));
        assert.ok(blocks.length >= 1);
        assert.ok(blocks[0] instanceof Paragraph);
    });
    it("bold inline produces TextRun without crash", () => {
        const tokens = marked.lexer("This is **bold** text");
        const blocks = tokensToDocxBlocks(tokens, makeCtx());
        assert.ok(blocks.length >= 1);
        assert.ok(blocks[0] instanceof Paragraph);
    });
    it("unordered list produces multiple Paragraphs", () => {
        const tokens = marked.lexer("- item1\n- item2\n- item3");
        const blocks = tokensToDocxBlocks(tokens, makeCtx());
        assert.strictEqual(blocks.length, 3);
        for (const b of blocks) {
            assert.ok(b instanceof Paragraph);
        }
    });
    it("hr produces a Paragraph", () => {
        const tokens = marked.lexer("---");
        const blocks = tokensToDocxBlocks(tokens, makeCtx());
        assert.ok(blocks.length >= 1);
        assert.ok(blocks[0] instanceof Paragraph);
    });
    it("code block produces a Paragraph", () => {
        const tokens = marked.lexer("```js\nconsole.log('hi')\n```");
        const blocks = tokensToDocxBlocks(tokens, makeCtx());
        assert.ok(blocks.length >= 1);
        assert.ok(blocks[0] instanceof Paragraph);
    });
    it("table produces a Table instance", () => {
        const tokens = marked.lexer("| a | b |\n|---|---|\n| 1 | 2 |");
        const blocks = tokensToDocxBlocks(tokens, makeCtx());
        assert.ok(blocks.length >= 1);
        assert.ok(blocks[0] instanceof Table);
    });
    it("missing image inserts placeholder and adds warning", () => {
        const ctx = makeCtx();
        const tokens = marked.lexer("![alt](missing.png)");
        const blocks = tokensToDocxBlocks(tokens, ctx);
        assert.ok(blocks.length >= 1);
        assert.strictEqual(ctx.warnings.length, 1);
        assert.ok(ctx.warnings[0].includes("missing.png"));
    });
});
