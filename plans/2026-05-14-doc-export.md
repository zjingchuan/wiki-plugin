# Wiki Plugin 文档导出功能 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 wiki-plugin 增加文档导出功能，把 Markdown 文档（含图片、Mermaid 图、wikilink）转换为 Word（.docx）。

**Architecture:** 纯 Node 实现。`marked` 解析 MD 为 token 流，`docx` 库构造 Word 文档。预处理阶段把 Mermaid 代码块通过 `mermaid-cli` 渲染为 PNG，把 `[[wikilink]]` 转为纯文本，把 `![[xxx]]` 解析为图片路径。提供 `export_docx` MCP tool 和 `/wiki-export` skill。

**Tech Stack:** TypeScript + marked + docx + image-size + @mermaid-js/mermaid-cli (optional)

---

## 文件结构

**新增：**
- `src/lib/md-to-docx/styles.ts` — Word 样式常量与构造器
- `src/lib/md-to-docx/mermaid.ts` — mermaid-cli 调用与缓存
- `src/lib/md-to-docx/preprocess.ts` — 预处理 mermaid + wikilink + 图片路径
- `src/lib/md-to-docx/parser.ts` — MD token → docx 节点转换
- `src/lib/md-to-docx/index.ts` — 主入口 `convertToDocx`
- `src/mcp/tools/export-docx.ts` — MCP tool 注册
- `skills/wiki-export/SKILL.md` — 用户命令
- `src/lib/md-to-docx/__tests__/parser.test.ts` — 单元测试

**修改：**
- `src/mcp/server.ts` — 注册 export_docx
- `package.json` — 新增依赖
- `.claude-plugin/plugin.json` — 注册 wiki-export skill
- `README.md` — 补充导出说明

---

## Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装运行时依赖**

```bash
cd D:/WorkSpace/wiki-plugin && npm install marked docx image-size
```

- [ ] **Step 2: 把 mermaid-cli 安装为可选依赖**

```bash
cd D:/WorkSpace/wiki-plugin && npm install --save-optional @mermaid-js/mermaid-cli
```

- [ ] **Step 3: 验证 package.json**

打开 `package.json`，确认 `dependencies` 含 `marked`、`docx`、`image-size`，`optionalDependencies` 含 `@mermaid-js/mermaid-cli`。如果 mermaid-cli 被装到了 dependencies，手动移到 optionalDependencies：

```json
{
  "optionalDependencies": {
    "@mermaid-js/mermaid-cli": "^11.0.0"
  }
}
```

- [ ] **Step 4: 提交**

```bash
cd D:/WorkSpace/wiki-plugin && git add package.json package-lock.json && git commit -m "feat(export): add md-to-docx dependencies"
```

---

## Task 2: Word 样式模板

**Files:**
- Create: `src/lib/md-to-docx/styles.ts`

- [ ] **Step 1: 创建样式模块**

写入 `src/lib/md-to-docx/styles.ts`：

```typescript
import { AlignmentType, BorderStyle, HeadingLevel, IStylesOptions, ShadingType, convertInchesToTwip } from "docx";

export const FONTS = {
  body: "Microsoft YaHei",
  code: "Consolas",
};

export const COLORS = {
  codeBg: "F5F5F5",
  tableHeaderBg: "E7F0FA",
  tableBorder: "AAAAAA",
  quoteBorder: "888888",
};

export const PAGE = {
  marginTop: convertInchesToTwip(1),
  marginBottom: convertInchesToTwip(1),
  marginLeft: convertInchesToTwip(1.25),
  marginRight: convertInchesToTwip(1.25),
};

export const MAX_IMAGE_WIDTH_CM = 14;

export const STYLES: IStylesOptions = {
  default: {
    document: {
      run: { font: FONTS.body, size: 22 },
      paragraph: { spacing: { line: 360, after: 120 } },
    },
    heading1: {
      run: { font: FONTS.body, size: 36, bold: true },
      paragraph: { spacing: { before: 240, after: 120 } },
    },
    heading2: {
      run: { font: FONTS.body, size: 32, bold: true },
      paragraph: { spacing: { before: 200, after: 100 } },
    },
    heading3: {
      run: { font: FONTS.body, size: 28, bold: true },
      paragraph: { spacing: { before: 160, after: 80 } },
    },
    heading4: {
      run: { font: FONTS.body, size: 24, bold: true },
      paragraph: { spacing: { before: 120, after: 60 } },
    },
  },
};

export function tableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tableBorder },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tableBorder },
    left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tableBorder },
    right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tableBorder },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tableBorder },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tableBorder },
  };
}

export function tableHeaderShading() {
  return { type: ShadingType.CLEAR, fill: COLORS.tableHeaderBg, color: "auto" };
}

export function codeBlockShading() {
  return { type: ShadingType.CLEAR, fill: COLORS.codeBg, color: "auto" };
}
```

- [ ] **Step 2: 验证编译**

```bash
cd D:/WorkSpace/wiki-plugin && npx tsc --noEmit
```

预期：无错误。

- [ ] **Step 3: 提交**

```bash
cd D:/WorkSpace/wiki-plugin && git add src/lib/md-to-docx/styles.ts && git commit -m "feat(export): add docx styles template"
```

---

## Task 3: Mermaid 渲染封装

**Files:**
- Create: `src/lib/md-to-docx/mermaid.ts`
- Test: `src/lib/md-to-docx/__tests__/mermaid.test.ts`

- [ ] **Step 1: 写失败的测试**

写入 `src/lib/md-to-docx/__tests__/mermaid.test.ts`：

```typescript
import test from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { isMermaidAvailable, renderMermaidToPng } from "../mermaid.js";

test("isMermaidAvailable 返回布尔值", () => {
  const result = isMermaidAvailable();
  assert.strictEqual(typeof result, "boolean");
});

test("renderMermaidToPng 在 mermaid-cli 不存在时抛 NotInstalledError", async () => {
  if (isMermaidAvailable()) {
    return; // 已安装则跳过
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mmd-test-"));
  await assert.rejects(
    () => renderMermaidToPng("flowchart TD\nA-->B", tmpDir),
    /mermaid-cli/
  );
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd D:/WorkSpace/wiki-plugin && npx tsc && node --test dist/lib/md-to-docx/__tests__/mermaid.test.js
```

预期：测试失败，提示找不到模块。

- [ ] **Step 3: 实现 mermaid.ts**

写入 `src/lib/md-to-docx/mermaid.ts`：

```typescript
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export class MermaidNotInstalledError extends Error {
  constructor() {
    super("mermaid-cli 未安装。请运行: npm install --save-optional @mermaid-js/mermaid-cli");
    this.name = "MermaidNotInstalledError";
  }
}

let cachedAvailable: boolean | null = null;

export function isMermaidAvailable(): boolean {
  if (cachedAvailable !== null) return cachedAvailable;
  try {
    require.resolve("@mermaid-js/mermaid-cli");
    cachedAvailable = true;
  } catch {
    cachedAvailable = false;
  }
  return cachedAvailable;
}

export async function renderMermaidToPng(code: string, outputDir: string): Promise<string> {
  if (!isMermaidAvailable()) {
    throw new MermaidNotInstalledError();
  }

  const hash = crypto.createHash("md5").update(code).digest("hex").slice(0, 8);
  const mmdFile = path.join(outputDir, `mermaid_${hash}.mmd`);
  const pngFile = path.join(outputDir, `mermaid_${hash}.png`);

  if (fs.existsSync(pngFile)) return pngFile;

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(mmdFile, code, "utf-8");

  const mmdcBin = require.resolve("@mermaid-js/mermaid-cli/src/cli.js");
  execSync(`node "${mmdcBin}" -i "${mmdFile}" -o "${pngFile}" -b transparent`, {
    stdio: "pipe",
  });

  return pngFile;
}
```

- [ ] **Step 4: 编译并运行测试**

```bash
cd D:/WorkSpace/wiki-plugin && npx tsc && node --test dist/lib/md-to-docx/__tests__/mermaid.test.js
```

预期：测试通过。

- [ ] **Step 5: 提交**

```bash
cd D:/WorkSpace/wiki-plugin && git add src/lib/md-to-docx/mermaid.ts src/lib/md-to-docx/__tests__/mermaid.test.ts && git commit -m "feat(export): add mermaid renderer wrapper"
```

---

## Task 4: 预处理器

**Files:**
- Create: `src/lib/md-to-docx/preprocess.ts`
- Test: `src/lib/md-to-docx/__tests__/preprocess.test.ts`

- [ ] **Step 1: 写失败的测试**

写入 `src/lib/md-to-docx/__tests__/preprocess.test.ts`：

```typescript
import test from "node:test";
import assert from "node:assert";
import { stripFrontmatter, normalizeWikilinks, extractMermaidBlocks } from "../preprocess.js";

test("stripFrontmatter 移除 YAML frontmatter", () => {
  const input = "---\ntitle: 测试\ntags: [a]\n---\n\n# 标题\n正文";
  const out = stripFrontmatter(input);
  assert.strictEqual(out, "# 标题\n正文");
});

test("stripFrontmatter 无 frontmatter 时原样返回", () => {
  const input = "# 标题\n正文";
  assert.strictEqual(stripFrontmatter(input), "# 标题\n正文");
});

test("normalizeWikilinks 简单链接转纯文本", () => {
  const input = "参考 [[文档A]] 内容";
  assert.strictEqual(normalizeWikilinks(input), "参考 文档A 内容");
});

test("normalizeWikilinks 带 alias 用 alias", () => {
  const input = "参考 [[文档A|文档 A 标题]]";
  assert.strictEqual(normalizeWikilinks(input), "参考 文档 A 标题");
});

test("normalizeWikilinks 带路径取最后一段", () => {
  const input = "[[技术/接口/用户接口]]";
  assert.strictEqual(normalizeWikilinks(input), "用户接口");
});

test("extractMermaidBlocks 抽取 mermaid 代码块", () => {
  const input = "前\n```mermaid\nflowchart TD\nA-->B\n```\n后";
  const result = extractMermaidBlocks(input);
  assert.strictEqual(result.blocks.length, 1);
  assert.strictEqual(result.blocks[0].code, "flowchart TD\nA-->B");
  assert.match(result.text, /MERMAID_PLACEHOLDER_0/);
});

test("extractMermaidBlocks 无 mermaid 时 blocks 为空", () => {
  const input = "纯文本\n```js\nconst a = 1;\n```";
  const result = extractMermaidBlocks(input);
  assert.strictEqual(result.blocks.length, 0);
  assert.strictEqual(result.text, input);
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd D:/WorkSpace/wiki-plugin && npx tsc 2>&1 | head -20
```

预期：编译失败，找不到 preprocess 模块。

- [ ] **Step 3: 实现 preprocess.ts**

写入 `src/lib/md-to-docx/preprocess.ts`：

```typescript
export function stripFrontmatter(md: string): string {
  const match = md.match(/^---\n([\s\S]*?)\n---\n*/);
  if (!match) return md;
  return md.slice(match[0].length);
}

export function normalizeWikilinks(md: string): string {
  return md.replace(/\[\[([^\]]+)\]\]/g, (_match, inner) => {
    const aliasIdx = inner.indexOf("|");
    if (aliasIdx >= 0) {
      return inner.slice(aliasIdx + 1).trim();
    }
    const segments = inner.split("/");
    return segments[segments.length - 1].trim();
  });
}

export interface MermaidBlock {
  index: number;
  code: string;
}

export interface ExtractMermaidResult {
  text: string;
  blocks: MermaidBlock[];
}

export function extractMermaidBlocks(md: string): ExtractMermaidResult {
  const blocks: MermaidBlock[] = [];
  const text = md.replace(/```mermaid\n([\s\S]*?)\n```/g, (_match, code) => {
    const idx = blocks.length;
    blocks.push({ index: idx, code: code.trim() });
    return `<!--MERMAID_PLACEHOLDER_${idx}-->`;
  });
  return { text, blocks };
}
```

- [ ] **Step 4: 编译并运行测试**

```bash
cd D:/WorkSpace/wiki-plugin && npx tsc && node --test dist/lib/md-to-docx/__tests__/preprocess.test.js
```

预期：6 个测试全部通过。

- [ ] **Step 5: 提交**

```bash
cd D:/WorkSpace/wiki-plugin && git add src/lib/md-to-docx/preprocess.ts src/lib/md-to-docx/__tests__/preprocess.test.ts && git commit -m "feat(export): add markdown preprocessor"
```

---

## Task 5: Token → docx 解析器（基础元素）

**Files:**
- Create: `src/lib/md-to-docx/parser.ts`
- Test: `src/lib/md-to-docx/__tests__/parser.test.ts`

- [ ] **Step 1: 写失败的测试**

写入 `src/lib/md-to-docx/__tests__/parser.test.ts`：

```typescript
import test from "node:test";
import assert from "node:assert";
import { marked } from "marked";
import { Paragraph, TextRun, HeadingLevel } from "docx";
import { tokensToDocxBlocks, ParserContext } from "../parser.js";

function ctx(): ParserContext {
  return {
    imageBaseDir: "",
    imageResolver: () => null,
    warnings: [],
    headingOffset: 0,
  };
}

test("段落转为 Paragraph", () => {
  const tokens = marked.lexer("普通段落");
  const blocks = tokensToDocxBlocks(tokens, ctx());
  assert.strictEqual(blocks.length, 1);
  assert.ok(blocks[0] instanceof Paragraph);
});

test("一级标题转为 H1", () => {
  const tokens = marked.lexer("# 标题");
  const blocks = tokensToDocxBlocks(tokens, ctx());
  assert.strictEqual(blocks.length, 1);
  const para = blocks[0] as Paragraph;
  assert.strictEqual((para as any).options?.heading, HeadingLevel.HEADING_1);
});

test("headingOffset 让 H1 降级", () => {
  const tokens = marked.lexer("# 标题");
  const c = ctx();
  c.headingOffset = 1;
  const blocks = tokensToDocxBlocks(tokens, c);
  const para = blocks[0] as Paragraph;
  assert.strictEqual((para as any).options?.heading, HeadingLevel.HEADING_2);
});

test("粗体内联", () => {
  const tokens = marked.lexer("**粗** 文本");
  const blocks = tokensToDocxBlocks(tokens, ctx());
  assert.strictEqual(blocks.length, 1);
});

test("无序列表生成多个 Paragraph", () => {
  const tokens = marked.lexer("- A\n- B\n- C");
  const blocks = tokensToDocxBlocks(tokens, ctx());
  assert.strictEqual(blocks.length, 3);
});

test("分隔线生成一个 Paragraph", () => {
  const tokens = marked.lexer("---");
  const blocks = tokensToDocxBlocks(tokens, ctx());
  assert.strictEqual(blocks.length, 1);
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd D:/WorkSpace/wiki-plugin && npx tsc 2>&1 | head -10
```

预期：编译失败，找不到 parser 模块。

- [ ] **Step 3: 实现 parser.ts 基础版本**

写入 `src/lib/md-to-docx/parser.ts`：

```typescript
import { marked, Tokens } from "marked";
import {
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from "docx";
import { codeBlockShading, tableBorders, tableHeaderShading, COLORS, FONTS } from "./styles.js";

export interface ParserContext {
  imageBaseDir: string;
  imageResolver: (name: string) => { path: string; buffer: Buffer; width: number; height: number } | null;
  warnings: string[];
  headingOffset: number;
}

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

export function tokensToDocxBlocks(tokens: marked.TokensList | marked.Token[], ctx: ParserContext): (Paragraph | Table)[] {
  const blocks: (Paragraph | Table)[] = [];
  for (const token of tokens) {
    const result = tokenToBlock(token, ctx);
    if (Array.isArray(result)) {
      blocks.push(...result);
    } else if (result) {
      blocks.push(result);
    }
  }
  return blocks;
}

function tokenToBlock(token: marked.Token, ctx: ParserContext): Paragraph | Table | (Paragraph | Table)[] | null {
  switch (token.type) {
    case "heading":
      return headingToParagraph(token as Tokens.Heading, ctx);
    case "paragraph":
      return paragraphToBlock(token as Tokens.Paragraph, ctx);
    case "list":
      return listToBlocks(token as Tokens.List, ctx);
    case "code":
      return codeBlockToParagraph(token as Tokens.Code);
    case "blockquote":
      return blockquoteToBlocks(token as Tokens.Blockquote, ctx);
    case "table":
      return tableTokenToTable(token as Tokens.Table, ctx);
    case "hr":
      return hrParagraph();
    case "html":
    case "space":
      return null;
    default:
      return null;
  }
}

function headingToParagraph(token: Tokens.Heading, ctx: ParserContext): Paragraph {
  const adjustedDepth = Math.min(6, token.depth + ctx.headingOffset);
  const level = HEADING_LEVELS[adjustedDepth - 1];
  return new Paragraph({
    heading: level,
    children: inlineTokensToRuns(token.tokens || [], ctx),
  });
}

function paragraphToBlock(token: Tokens.Paragraph, ctx: ParserContext): Paragraph | (Paragraph | Table)[] {
  return new Paragraph({
    children: inlineTokensToRuns(token.tokens || [], ctx),
  });
}

function inlineTokensToRuns(tokens: marked.Token[], ctx: ParserContext): (TextRun | ImageRun)[] {
  const runs: (TextRun | ImageRun)[] = [];
  for (const t of tokens) {
    runs.push(...inlineTokenToRuns(t, ctx, {}));
  }
  return runs;
}

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
}

function inlineTokenToRuns(token: marked.Token, ctx: ParserContext, style: InlineStyle): (TextRun | ImageRun)[] {
  switch (token.type) {
    case "text": {
      const text = (token as Tokens.Text).text;
      return [new TextRun({ text, ...textRunStyle(style) })];
    }
    case "strong": {
      const inner = (token as Tokens.Strong).tokens || [];
      return inner.flatMap((t) => inlineTokenToRuns(t, ctx, { ...style, bold: true }));
    }
    case "em": {
      const inner = (token as Tokens.Em).tokens || [];
      return inner.flatMap((t) => inlineTokenToRuns(t, ctx, { ...style, italics: true }));
    }
    case "codespan": {
      const text = (token as Tokens.Codespan).text;
      return [new TextRun({ text, font: FONTS.code, ...textRunStyle(style) })];
    }
    case "link": {
      const link = token as Tokens.Link;
      const inner = link.tokens || [{ type: "text", text: link.text } as Tokens.Text];
      return inner.flatMap((t) => inlineTokenToRuns(t, ctx, style));
    }
    case "image": {
      const img = token as Tokens.Image;
      return [imageRunOrPlaceholder(img.href, img.text, ctx)];
    }
    case "br":
      return [new TextRun({ break: 1 })];
    case "del": {
      const inner = (token as Tokens.Del).tokens || [];
      return inner.flatMap((t) => inlineTokenToRuns(t, ctx, style));
    }
    case "html":
      return [];
    default:
      return [];
  }
}

function textRunStyle(style: InlineStyle) {
  return {
    bold: style.bold,
    italics: style.italics,
  };
}

function imageRunOrPlaceholder(href: string, alt: string, ctx: ParserContext): TextRun | ImageRun {
  const resolved = ctx.imageResolver(href);
  if (!resolved) {
    ctx.warnings.push(`图片缺失: ${href}`);
    return new TextRun({ text: `[图片缺失: ${alt || href}]`, italics: true });
  }
  const maxWidthEmu = 14 * 360000; // 14cm
  const aspect = resolved.height / resolved.width;
  const widthPx = Math.min(resolved.width, 14 * 96 / 2.54);
  const heightPx = widthPx * aspect;
  return new ImageRun({
    data: resolved.buffer,
    transformation: {
      width: Math.round(widthPx),
      height: Math.round(heightPx),
    },
  });
}

function listToBlocks(token: Tokens.List, ctx: ParserContext): Paragraph[] {
  const blocks: Paragraph[] = [];
  token.items.forEach((item, idx) => {
    const runs = inlineTokensToRuns((item.tokens?.[0] as any)?.tokens || [], ctx);
    if (token.ordered) {
      blocks.push(new Paragraph({
        children: [new TextRun({ text: `${idx + 1}. ` }), ...runs],
        indent: { left: 360 },
      }));
    } else {
      blocks.push(new Paragraph({
        children: [new TextRun({ text: "• " }), ...runs],
        indent: { left: 360 },
      }));
    }
  });
  return blocks;
}

function codeBlockToParagraph(token: Tokens.Code): Paragraph {
  return new Paragraph({
    shading: codeBlockShading(),
    children: [new TextRun({ text: token.text, font: FONTS.code, size: 20 })],
    spacing: { before: 80, after: 80 },
  });
}

function blockquoteToBlocks(token: Tokens.Blockquote, ctx: ParserContext): Paragraph[] {
  const inner = tokensToDocxBlocks(token.tokens || [], ctx);
  return inner.filter((b): b is Paragraph => b instanceof Paragraph).map((p) => {
    return new Paragraph({
      ...((p as any).options || {}),
      indent: { left: 360 },
      border: {
        left: { style: BorderStyle.SINGLE, size: 12, color: COLORS.quoteBorder, space: 8 },
      },
    });
  });
}

function tableTokenToTable(token: Tokens.Table, ctx: ParserContext): Table {
  const rows: TableRow[] = [];

  rows.push(new TableRow({
    children: token.header.map((cell) => new TableCell({
      shading: tableHeaderShading(),
      children: [new Paragraph({ children: inlineTokensToRuns(cell.tokens || [], ctx) })],
    })),
    tableHeader: true,
  }));

  for (const row of token.rows) {
    rows.push(new TableRow({
      children: row.map((cell) => new TableCell({
        children: [new Paragraph({ children: inlineTokensToRuns(cell.tokens || [], ctx) })],
      })),
    }));
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders(),
  });
}

function hrParagraph(): Paragraph {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "888888", space: 1 },
    },
  });
}
```

- [ ] **Step 4: 编译并运行测试**

```bash
cd D:/WorkSpace/wiki-plugin && npx tsc && node --test dist/lib/md-to-docx/__tests__/parser.test.js
```

预期：6 个测试全部通过。

- [ ] **Step 5: 提交**

```bash
cd D:/WorkSpace/wiki-plugin && git add src/lib/md-to-docx/parser.ts src/lib/md-to-docx/__tests__/parser.test.ts && git commit -m "feat(export): add markdown to docx parser"
```

---

## Task 6: 主入口 convertToDocx

**Files:**
- Create: `src/lib/md-to-docx/index.ts`

- [ ] **Step 1: 创建主入口**

写入 `src/lib/md-to-docx/index.ts`：

```typescript
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { marked } from "marked";
import { Document, Packer, PageBreak, Paragraph, HeadingLevel } from "docx";
import imageSize from "image-size";
import { stripFrontmatter, normalizeWikilinks, extractMermaidBlocks } from "./preprocess.js";
import { renderMermaidToPng, isMermaidAvailable } from "./mermaid.js";
import { tokensToDocxBlocks, ParserContext } from "./parser.js";
import { STYLES, PAGE } from "./styles.js";
import { resolveFromRoot, DOCS_DIR, ensureDir } from "../paths.js";

export interface ConvertOptions {
  rootDir: string;
  inputs: string[];                  // 相对于 docs/ 的 MD 路径
  mode: "single" | "merged";
  output?: string;                   // 自定义输出文件名（不含扩展名）
}

export interface ConvertResult {
  success: boolean;
  files: string[];
  warnings: string[];
}

const EXPORTS_DIR = path.join(DOCS_DIR, "exports");

export async function convertToDocx(options: ConvertOptions): Promise<ConvertResult> {
  const { rootDir, inputs, mode, output } = options;
  const warnings: string[] = [];
  const exportsDir = resolveFromRoot(rootDir, EXPORTS_DIR);
  ensureDir(exportsDir);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-export-"));

  try {
    if (mode === "single") {
      const files: string[] = [];
      for (const input of inputs) {
        const file = await processOne(rootDir, input, exportsDir, tempDir, warnings, 0, output);
        if (file) files.push(file);
      }
      return { success: true, files, warnings };
    } else {
      const file = await processMerged(rootDir, inputs, exportsDir, tempDir, warnings, output);
      return { success: true, files: file ? [file] : [], warnings };
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function processOne(
  rootDir: string,
  input: string,
  exportsDir: string,
  tempDir: string,
  warnings: string[],
  headingOffset: number,
  customName?: string
): Promise<string | null> {
  const mdPath = resolveFromRoot(rootDir, DOCS_DIR, input);
  if (!fs.existsSync(mdPath)) {
    warnings.push(`MD 文件不存在: ${input}`);
    return null;
  }

  const raw = fs.readFileSync(mdPath, "utf-8");
  const { title, blocks } = await mdToBlocks(rawToContext(rootDir, mdPath, raw, tempDir, warnings, headingOffset));

  const doc = new Document({
    styles: STYLES,
    sections: [{
      properties: { page: { margin: PAGE } },
      children: blocks,
    }],
  });

  const baseName = customName || title || path.basename(input, ".md");
  const filePath = await writeDocx(doc, exportsDir, baseName);
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

async function processMerged(
  rootDir: string,
  inputs: string[],
  exportsDir: string,
  tempDir: string,
  warnings: string[],
  customName?: string
): Promise<string | null> {
  if (inputs.length === 0) {
    warnings.push("未指定要导出的文档");
    return null;
  }

  const allBlocks: any[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const mdPath = resolveFromRoot(rootDir, DOCS_DIR, inputs[i]);
    if (!fs.existsSync(mdPath)) {
      warnings.push(`MD 文件不存在: ${inputs[i]}`);
      continue;
    }
    const raw = fs.readFileSync(mdPath, "utf-8");
    const { title, blocks } = await mdToBlocks(rawToContext(rootDir, mdPath, raw, tempDir, warnings, 1));

    if (i > 0) {
      allBlocks.push(new Paragraph({ children: [new PageBreak()] }));
    }
    allBlocks.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: title || path.basename(inputs[i], ".md") }));
    allBlocks.push(...blocks);
  }

  const doc = new Document({
    styles: STYLES,
    sections: [{
      properties: { page: { margin: PAGE } },
      children: allBlocks,
    }],
  });

  const baseName = customName || `导出_${timestamp()}`;
  const filePath = await writeDocx(doc, exportsDir, baseName);
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

interface MdContext {
  rootDir: string;
  mdPath: string;
  raw: string;
  tempDir: string;
  warnings: string[];
  headingOffset: number;
}

function rawToContext(rootDir: string, mdPath: string, raw: string, tempDir: string, warnings: string[], headingOffset: number): MdContext {
  return { rootDir, mdPath, raw, tempDir, warnings, headingOffset };
}

async function mdToBlocks(c: MdContext): Promise<{ title: string; blocks: any[] }> {
  const { title, body } = parseTitleAndBody(c.raw);
  const stripped = stripFrontmatter(body);
  const wikilinkProcessed = normalizeWikilinks(stripped);
  const { text: mermaidPlaceholdered, blocks: mermaidBlocks } = extractMermaidBlocks(wikilinkProcessed);

  const mermaidImages = new Map<number, { path: string; buffer: Buffer; width: number; height: number }>();
  if (mermaidBlocks.length > 0) {
    if (!isMermaidAvailable()) {
      c.warnings.push(`检测到 ${mermaidBlocks.length} 个 mermaid 代码块但 mermaid-cli 未安装，已保留为代码块`);
    } else {
      for (const block of mermaidBlocks) {
        try {
          const png = await renderMermaidToPng(block.code, c.tempDir);
          const buf = fs.readFileSync(png);
          const dim = imageSize(buf);
          mermaidImages.set(block.index, {
            path: png,
            buffer: buf,
            width: dim.width || 600,
            height: dim.height || 400,
          });
        } catch (err: any) {
          c.warnings.push(`Mermaid 渲染失败（块 ${block.index}）: ${err.message}`);
        }
      }
    }
  }

  const restored = restoreMermaidPlaceholders(mermaidPlaceholdered, mermaidBlocks, mermaidImages);

  const ctx: ParserContext = {
    imageBaseDir: path.dirname(c.mdPath),
    imageResolver: (name) => resolveImage(name, c.rootDir, c.mdPath, mermaidImages),
    warnings: c.warnings,
    headingOffset: c.headingOffset,
  };

  const tokens = marked.lexer(restored);
  const blocks = tokensToDocxBlocks(tokens, ctx);
  return { title, blocks };
}

function parseTitleAndBody(raw: string): { title: string; body: string } {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  let title = "";
  if (fmMatch) {
    const titleMatch = fmMatch[1].match(/^title:\s*(.+)$/m);
    if (titleMatch) title = titleMatch[1].trim();
  }
  return { title, body: raw };
}

function restoreMermaidPlaceholders(
  text: string,
  blocks: { index: number; code: string }[],
  images: Map<number, { path: string; buffer: Buffer; width: number; height: number }>
): string {
  return text.replace(/<!--MERMAID_PLACEHOLDER_(\d+)-->/g, (_match, idxStr) => {
    const idx = parseInt(idxStr, 10);
    const img = images.get(idx);
    if (img) {
      return `\n\n![mermaid](MERMAID_IMG::${idx})\n\n`;
    }
    const code = blocks[idx]?.code || "";
    return "\n\n```\n" + code + "\n```\n\n";
  });
}

function resolveImage(
  href: string,
  rootDir: string,
  mdPath: string,
  mermaidImages: Map<number, { path: string; buffer: Buffer; width: number; height: number }>
): { path: string; buffer: Buffer; width: number; height: number } | null {
  if (href.startsWith("MERMAID_IMG::")) {
    const idx = parseInt(href.slice("MERMAID_IMG::".length), 10);
    return mermaidImages.get(idx) || null;
  }

  const candidates: string[] = [];
  if (path.isAbsolute(href)) {
    candidates.push(href);
  } else {
    candidates.push(path.resolve(path.dirname(mdPath), href));
    candidates.push(path.resolve(rootDir, "docs/assets", path.basename(href)));
    candidates.push(path.resolve(rootDir, "docs", href));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const buf = fs.readFileSync(candidate);
      try {
        const dim = imageSize(buf);
        return {
          path: candidate,
          buffer: buf,
          width: dim.width || 600,
          height: dim.height || 400,
        };
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function writeDocx(doc: Document, exportsDir: string, baseName: string): Promise<string> {
  const sanitized = baseName.replace(/[\\/:*?"<>|]/g, "_");
  let filePath = path.join(exportsDir, `${sanitized}.docx`);
  if (fs.existsSync(filePath)) {
    filePath = path.join(exportsDir, `${sanitized}_${timestamp()}.docx`);
  }
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function timestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
}
```

- [ ] **Step 2: 编译验证**

```bash
cd D:/WorkSpace/wiki-plugin && npx tsc 2>&1
```

预期：无错误。如有 docx 类型错误（如 Heading1 字面量）需要按报错调整为正确的 HeadingLevel 引用。

- [ ] **Step 3: 提交**

```bash
cd D:/WorkSpace/wiki-plugin && git add src/lib/md-to-docx/index.ts && git commit -m "feat(export): add convertToDocx main entry"
```

---

## Task 7: 注册 MCP Tool

**Files:**
- Create: `src/mcp/tools/export-docx.ts`
- Modify: `src/mcp/server.ts`

- [ ] **Step 1: 创建 export-docx tool**

写入 `src/mcp/tools/export-docx.ts`：

```typescript
import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { convertToDocx } from "../../lib/md-to-docx/index.js";

export function registerExportDocx(server: McpServer, rootDir: string) {
  server.registerTool(
    "export_docx",
    {
      description: "把指定的 Markdown 文档导出为 Word（.docx）。支持单文件分别导出或多文件合并。Mermaid 代码块会渲染为图片（需 mermaid-cli）",
      inputSchema: z.object({
        paths: z.array(z.string()).describe("相对于 docs/ 的 MD 路径数组，如 ['产品/使用手册/xxx.md']"),
        mode: z.enum(["single", "merged"]).describe("single=每个独立导出；merged=合并为一个 Word"),
        output: z.string().optional().describe("自定义输出文件名（不含扩展名）"),
      }),
    },
    async ({ paths, mode, output }) => {
      const result = await convertToDocx({ rootDir, inputs: paths, mode, output });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result),
        }],
      };
    }
  );
}
```

- [ ] **Step 2: 在 server.ts 注册**

打开 `src/mcp/server.ts`，在已有 import 区添加：

```typescript
import { registerExportDocx } from "./tools/export-docx.js";
```

在已有的 `registerXxx(server, rootDir)` 调用列表末尾添加：

```typescript
registerExportDocx(server, rootDir);
```

- [ ] **Step 3: 编译验证**

```bash
cd D:/WorkSpace/wiki-plugin && npx tsc
```

预期：无错误。

- [ ] **Step 4: 启动验证 server 能初始化**

```bash
cd D:/WorkSpace/wiki-plugin && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | timeout 5 node dist/mcp/server.js
```

预期：返回 `serverInfo`，无报错。

- [ ] **Step 5: 提交**

```bash
cd D:/WorkSpace/wiki-plugin && git add src/mcp/tools/export-docx.ts src/mcp/server.ts && git commit -m "feat(export): register export_docx mcp tool"
```

---

## Task 8: Skill 与插件清单

**Files:**
- Create: `skills/wiki-export/SKILL.md`
- Create: `.claude/skills/wiki-export/SKILL.md`（本项目测试用）
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: 写 SKILL.md**

写入 `skills/wiki-export/SKILL.md`：

```markdown
---
name: wiki-export
description: 把指定的 Markdown 文档导出为 Word（.docx），支持图片、Mermaid 图、wikilink 处理
---

# /wiki-export

把 docs/ 下的 Markdown 文档导出为 Word。

## 使用方式

- `/wiki-export` — 列出全部文档让用户选
- `/wiki-export <关键词>` — 匹配标题/路径含关键词的文档
- `/wiki-export <分类>/` — 该分类下所有文档

## 处理流程

1. 调用 `list_all_docs` 获取所有文档
2. 按用户输入匹配候选文档：
   - 无输入：列出全部供用户多选
   - 关键词：在 title 和 path 中模糊匹配
3. 询问导出模式：
   - 单文件分别导出（每个文档一个 .docx）
   - 多文件合并为一份报告（merged）
4. merged 模式下询问报告标题（作为输出文件名，可选）
5. 调用 `export_docx` 工具
6. 报告输出位置和 warnings

## 注意

- 多文件合并时按用户选择顺序排列，每篇前自动加分页符
- 文档中的 `[[wikilink]]` 会转为纯文本（不展开被引用文档）
- Mermaid 代码块需要安装 mermaid-cli 才能渲染（可选依赖）
- 输出固定到 `docs/exports/`，重名自动追加时间戳
```

- [ ] **Step 2: 复制到本项目 .claude/skills/ 用于测试**

```bash
mkdir -p "D:/WorkSpace/wiki-plugin/.claude/skills/wiki-export" && cp "D:/WorkSpace/wiki-plugin/skills/wiki-export/SKILL.md" "D:/WorkSpace/wiki-plugin/.claude/skills/wiki-export/SKILL.md"
```

- [ ] **Step 3: 更新 plugin.json**

打开 `.claude-plugin/plugin.json`，在 `skills` 数组末尾添加：

```json
"skills/wiki-export"
```

完整数组应为：
```json
"skills": [
  "skills/wiki-import",
  "skills/wiki-relink",
  "skills/wiki-reindex",
  "skills/wiki-export"
]
```

- [ ] **Step 4: 提交**

```bash
cd D:/WorkSpace/wiki-plugin && git add skills/wiki-export/ .claude/skills/wiki-export/ .claude-plugin/plugin.json && git commit -m "feat(export): add wiki-export skill"
```

---

## Task 9: 端到端验证

**Files:**
- 无新建，只验证

- [ ] **Step 1: 准备测试 MD（含 mermaid + 图片 + 表格）**

```bash
cat > "D:/WorkSpace/wiki-plugin/docs/技术/测试导出.md" << 'EOF'
---
title: 测试导出
tags: [test]
category: 技术
---

# 测试导出

这是一份测试文档，验证 **粗体**、*斜体*、`代码片段` 都能正常导出。

## 一级章节

- 列表项 1
- 列表项 2
- 列表项 3

### 子章节

| 列1 | 列2 |
|-----|-----|
| A   | B   |
| C   | D   |

## 流程图

\`\`\`mermaid
flowchart TD
A[开始] --> B[处理]
B --> C[结束]
\`\`\`

## 代码块

\`\`\`javascript
const x = 1;
console.log(x);
\`\`\`

## 引用

> 这是引用块。

## 链接

参考 [[测试导出]] 文档。
EOF
```

- [ ] **Step 2: 通过 MCP 调用 export_docx**

```bash
cd D:/WorkSpace/wiki-plugin && printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"export_docx","arguments":{"paths":["技术/测试导出.md"],"mode":"single"}}}\n' | node dist/mcp/server.js 2>&1 | tail -1
```

预期输出：含 `"success":true` 和 `files` 数组指向 `docs/exports/测试导出.docx`。

- [ ] **Step 3: 验证 docx 文件存在并能打开**

```bash
ls -la "D:/WorkSpace/wiki-plugin/docs/exports/"
```

预期：看到 `测试导出.docx`，大小 > 5KB。

手动用 Word/WPS 打开，验证：
- 标题层级正确（H1/H2/H3）
- 表格有边框且表头有浅蓝背景
- 代码块有灰色背景
- 列表渲染正确
- 引用有左侧竖线
- `[[测试导出]]` 显示为纯文本"测试导出"
- 如果安装了 mermaid-cli：流程图显示为图片
- 如果没装：流程图保留为代码块，warnings 中有提示

- [ ] **Step 4: 测试合并模式（用现有文档）**

```bash
cd D:/WorkSpace/wiki-plugin && printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"export_docx","arguments":{"paths":["技术/用户迁移/和留言音频秘书存量用户升级方案.md","运维/数据资产/和留言数据资产清单.md"],"mode":"merged","output":"和留言项目交付包"}}}\n' | node dist/mcp/server.js 2>&1 | tail -1
```

预期：生成 `docs/exports/和留言项目交付包.docx`，包含两个文档以分页符分隔。

- [ ] **Step 5: 清理测试文件**

```bash
rm "D:/WorkSpace/wiki-plugin/docs/技术/测试导出.md"
```

- [ ] **Step 6: 提交（如有遗留修复）**

```bash
cd D:/WorkSpace/wiki-plugin && git status
# 如有未提交的修复，提交它们
```

---

## Task 10: 更新 README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在 README 的"使用方法"表格后追加导出章节**

打开 `README.md`，找到"### 第三步：运行命令"的命令表格，在表格中加一行：

```markdown
| `/wiki-export` | 把 MD 文档导出为 Word（.docx） |
```

在"## 使用方法"章节末尾追加新段落：

```markdown
### 文档导出

把整理好的 Markdown 文档导出为 Word，便于发给不使用 Obsidian 的同事。

\`\`\`
/wiki-export                    # 列出全部，让用户选
/wiki-export 接口设计           # 模糊匹配
/wiki-export 产品/              # 按分类
\`\`\`

支持两种模式：
- **single**：每个 MD 单独导出为一个 .docx
- **merged**：多个 MD 合并为一份完整报告（带分页符）

输出位置：`docs/exports/`

**Mermaid 图表**：如果文档包含 \`\`\`mermaid 代码块，需要安装 mermaid-cli 才能渲染为图片：

\`\`\`bash
npm install --save-optional @mermaid-js/mermaid-cli
\`\`\`

未安装时 mermaid 块会保留为代码块文本。
```

在"## MCP Tools"表格末尾加一行：

```markdown
| `export_docx` | 导出 Markdown 为 Word（.docx） |
```

- [ ] **Step 2: 提交**

```bash
cd D:/WorkSpace/wiki-plugin && git add README.md && git commit -m "docs(export): document wiki-export feature"
```

---

## Task 11: 重新打包发布

**Files:**
- Generate: `wiki-plugin-0.2.0.tgz` `wiki-plugin-0.2.0.zip`

- [ ] **Step 1: 升级版本号**

打开 `package.json` 和 `.claude-plugin/plugin.json`，把 `version` 改为 `0.2.0`。

- [ ] **Step 2: 清理旧产物并重新构建**

```bash
cd D:/WorkSpace/wiki-plugin && rm -rf dist wiki-plugin-*.tgz wiki-plugin-*.zip && npm run build
```

预期：编译无错误。

- [ ] **Step 3: 生成 tarball**

```bash
cd D:/WorkSpace/wiki-plugin && npm pack
```

预期：生成 `wiki-plugin-0.2.0.tgz`。

- [ ] **Step 4: 生成 zip**

```bash
cd D:/WorkSpace/wiki-plugin && zip -r wiki-plugin-0.2.0.zip .claude-plugin dist skills README.md package.json -x "*.map"
```

预期：生成 `wiki-plugin-0.2.0.zip`。

- [ ] **Step 5: 验证产物**

```bash
ls -lh "D:/WorkSpace/wiki-plugin/wiki-plugin-0.2.0."*
```

预期：两个文件都存在。

- [ ] **Step 6: 提交版本号变更**

```bash
cd D:/WorkSpace/wiki-plugin && git add package.json .claude-plugin/plugin.json && git commit -m "chore: bump version to 0.2.0"
```
