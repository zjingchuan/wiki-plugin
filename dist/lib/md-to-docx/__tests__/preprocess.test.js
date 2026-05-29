import test from "node:test";
import assert from "node:assert";
import { stripFrontmatter, normalizeWikilinks, extractMermaidBlocks } from "../preprocess.js";
test("stripFrontmatter removes YAML frontmatter", () => {
    const input = "---\ntitle: 测试\ntags: [a]\n---\n\n# 标题\n正文";
    const out = stripFrontmatter(input);
    assert.strictEqual(out, "# 标题\n正文");
});
test("stripFrontmatter returns unchanged when no frontmatter", () => {
    const input = "# 标题\n正文";
    assert.strictEqual(stripFrontmatter(input), "# 标题\n正文");
});
test("normalizeWikilinks simple link to plain text", () => {
    const input = "参考 [[文档A]] 内容";
    assert.strictEqual(normalizeWikilinks(input), "参考 文档A 内容");
});
test("normalizeWikilinks with alias uses alias", () => {
    const input = "参考 [[文档A|文档 A 标题]]";
    assert.strictEqual(normalizeWikilinks(input), "参考 文档 A 标题");
});
test("normalizeWikilinks with path takes last segment", () => {
    const input = "[[技术/接口/用户接口]]";
    assert.strictEqual(normalizeWikilinks(input), "用户接口");
});
test("extractMermaidBlocks extracts mermaid code blocks", () => {
    const input = "前\n```mermaid\nflowchart TD\nA-->B\n```\n后";
    const result = extractMermaidBlocks(input);
    assert.strictEqual(result.blocks.length, 1);
    assert.strictEqual(result.blocks[0].code, "flowchart TD\nA-->B");
    assert.match(result.text, /MERMAID_PLACEHOLDER_0/);
});
test("extractMermaidBlocks no mermaid returns empty blocks", () => {
    const input = "纯文本\n```js\nconst a = 1;\n```";
    const result = extractMermaidBlocks(input);
    assert.strictEqual(result.blocks.length, 0);
    assert.strictEqual(result.text, input);
});
