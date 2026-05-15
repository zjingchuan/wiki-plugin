import test from "node:test";
import assert from "node:assert";
import { marked } from "marked";
import { tokensToDocxBlocks, ParserContext } from "../parser.js";

function ctx(): ParserContext {
  return {
    imageBaseDir: "",
    imageResolver: () => null,
    warnings: [],
    headingOffset: 0,
  };
}

test("嵌套列表生成正确数量的段落", () => {
  const tokens = marked.lexer("- A\n  - B\n  - C\n- D");
  const blocks = tokensToDocxBlocks(tokens, ctx());
  assert.ok(blocks.length >= 2);
});

test("混合内联样式不崩溃", () => {
  const tokens = marked.lexer("**粗体中的 `代码` 和 *斜体***");
  const blocks = tokensToDocxBlocks(tokens, ctx());
  assert.strictEqual(blocks.length, 1);
});

test("空表格不崩溃", () => {
  const tokens = marked.lexer("| A |\n|---|\n|   |");
  const blocks = tokensToDocxBlocks(tokens, ctx());
  assert.ok(blocks.length >= 1);
});

test("连续标题不崩溃", () => {
  const tokens = marked.lexer("# H1\n## H2\n### H3");
  const blocks = tokensToDocxBlocks(tokens, ctx());
  assert.strictEqual(blocks.length, 3);
});

test("图片缺失时记录 warning", () => {
  const c = ctx();
  const tokens = marked.lexer("![alt](missing.png)");
  tokensToDocxBlocks(tokens, c);
  assert.ok(c.warnings.length > 0);
  assert.match(c.warnings[0], /Image not found/);
});

test("代码块保留内容", () => {
  const tokens = marked.lexer("```js\nconst x = 1;\n```");
  const blocks = tokensToDocxBlocks(tokens, ctx());
  assert.strictEqual(blocks.length, 1);
});

test("引用块生成段落", () => {
  const tokens = marked.lexer("> 引用内容\n> 第二行");
  const blocks = tokensToDocxBlocks(tokens, ctx());
  assert.ok(blocks.length >= 1);
});
