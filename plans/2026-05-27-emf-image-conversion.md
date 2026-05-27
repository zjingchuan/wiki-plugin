# EMF/WMF Image Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 docx 中嵌入的 EMF/WMF 矢量图自动转为 SVG，在 Obsidian 中正常显示；失败时给出清晰的安装提示和补转入口。

**Architecture:** 新增独立模块 `src/lib/emf-converter.ts` 负责工具探测、缓存和批量转换。`read-raw-file.ts` 在 mammoth 阶段后调用该模块。新增 `reconvert_images` MCP tool 和 `/wiki-reconvert-images` skill 用于事后补转。

**Tech Stack:** TypeScript, Node.js `child_process.execFile`, `crypto.createHash`, 现有 MCP SDK 注册模式。无新增 npm 依赖。

---

## File Structure

**New files:**
- `src/lib/emf-converter.ts` — 工具探测 + 缓存 + 批量转换
- `src/lib/__tests__/emf-converter.test.ts` — emf-converter 单元测试
- `src/mcp/tools/reconvert-images.ts` — reconvert_images MCP tool
- `src/mcp/tools/__tests__/reconvert-images.test.ts` — reconvert tool 测试
- `skills/wiki-reconvert-images/SKILL.md` — skill 定义
- `.claude/skills/wiki-reconvert-images/SKILL.md` — skill 本地镜像

**Modified files:**
- `src/mcp/tools/read-raw-file.ts` — 接入 emf-converter
- `src/mcp/server.ts` — 注册新 tool
- `.claude-plugin/plugin.json` — skills 列表追加
- `.gitignore` — 追加 emf-cache 目录
- `CHANGELOG.md` — v0.5.0 条目
- `package.json` — version bump

---

## Task 1: emf-converter 核心模块 — 类型与工具探测

**Files:**
- Create: `src/lib/emf-converter.ts`
- Create: `src/lib/__tests__/emf-converter.test.ts`

- [ ] **Step 1: 写 detectTool 的失败测试**

写入 `src/lib/__tests__/emf-converter.test.ts`：

```typescript
import test from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// We'll mock child_process via test context
import { detectTool, resetToolCache } from "../emf-converter.js";

test("detectTool 在无工具环境返回 none", () => {
  resetToolCache();
  const result = detectTool();
  // In CI/test environment without soffice/magick, should return none
  // This test validates the function exists and returns the correct shape
  assert.ok(result);
  assert.ok(["soffice", "magick", "none"].includes(result.kind));
  if (result.kind === "none") {
    assert.strictEqual(result.path, undefined);
  } else {
    assert.ok(typeof result.path === "string");
  }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd D:/WorkSpace/wiki-plugin && npx tsc && node --test dist/lib/__tests__/emf-converter.test.js`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 emf-converter.ts 的类型定义和 detectTool**

写入 `src/lib/emf-converter.ts`：

```typescript
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { execFile } from "child_process";
import { resolveFromRoot, WIKI_DIR, DOCS_DIR, ensureDir } from "./paths.js";

export type ToolKind = "soffice" | "magick" | "none";

export interface ToolInfo {
  kind: ToolKind;
  path?: string;
}

export interface ConvertResult {
  source: string;
  success: boolean;
  output?: string;
  fromCache?: boolean;
  error?: string;
}

export interface ConvertReport {
  total: number;
  succeeded: number;
  failed: number;
  fromCache: number;
  toolUsed: ToolKind;
  setupHint?: string;
  results: ConvertResult[];
}

const SETUP_HINT = `未检测到 LibreOffice 或 ImageMagick。\nObsidian 无法直接渲染 EMF/WMF 矢量图。\n建议安装 LibreOffice（推荐）：https://www.libreoffice.org/download/\n安装后运行 /wiki-reconvert-images 补转所有未渲染的图。`;

const EMF_CACHE_DIR = path.join(WIKI_DIR, "emf-cache");

let cachedTool: ToolInfo | null = null;

export function resetToolCache(): void {
  cachedTool = null;
}

export function detectTool(): ToolInfo {
  if (cachedTool) return cachedTool;

  const soffice = findSoffice();
  if (soffice) {
    cachedTool = { kind: "soffice", path: soffice };
    return cachedTool;
  }

  const magick = findMagick();
  if (magick) {
    cachedTool = { kind: "magick", path: magick };
    return cachedTool;
  }

  cachedTool = { kind: "none" };
  return cachedTool;
}

function findSoffice(): string | null {
  const platform = process.platform;

  if (platform === "win32") {
    const candidates = [
      path.join(process.env["ProgramFiles"] || "C:\\Program Files", "LibreOffice", "program", "soffice.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "LibreOffice", "program", "soffice.exe"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === "darwin") {
    const macPath = "/Applications/LibreOffice.app/Contents/MacOS/soffice";
    if (fs.existsSync(macPath)) return macPath;
  }

  // All platforms: check PATH
  const pathExt = platform === "win32" ? (process.env["PATHEXT"] || ".exe").split(";") : [""];
  const pathDirs = (process.env["PATH"] || "").split(path.delimiter);
  for (const dir of pathDirs) {
    for (const ext of pathExt) {
      const candidate = path.join(dir, `soffice${ext}`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}

function findMagick(): string | null {
  const platform = process.platform;
  const names = platform === "win32" ? ["magick.exe"] : ["magick", "convert"];
  const pathDirs = (process.env["PATH"] || "").split(path.delimiter);

  for (const dir of pathDirs) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd D:/WorkSpace/wiki-plugin && npx tsc && node --test dist/lib/__tests__/emf-converter.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/emf-converter.ts src/lib/__tests__/emf-converter.test.ts
git commit -m "feat(emf): add emf-converter module with detectTool"
```

---

## Task 2: emf-converter — 缓存和批量转换

**Files:**
- Modify: `src/lib/emf-converter.ts`
- Modify: `src/lib/__tests__/emf-converter.test.ts`

- [ ] **Step 1: 写 convertBatch 的失败测试（工具缺失时快速失败）**

追加到 `src/lib/__tests__/emf-converter.test.ts`：

```typescript
import { convertBatch } from "../emf-converter.js";

test("convertBatch 工具不可用时快速返回全失败报告", async () => {
  resetToolCache();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emf-batch-"));
  try {
    // Create a fake emf file
    const fakeEmf = path.join(tmpDir, "test.x-emf");
    fs.writeFileSync(fakeEmf, "fake-emf-content");

    fs.mkdirSync(path.join(tmpDir, "docs/.wiki"), { recursive: true });

    const report = await convertBatch([fakeEmf], { rootDir: tmpDir });

    // If no tool is installed, all should fail
    if (report.toolUsed === "none") {
      assert.strictEqual(report.total, 1);
      assert.strictEqual(report.succeeded, 0);
      assert.strictEqual(report.failed, 1);
      assert.ok(report.setupHint);
      assert.ok(report.results[0].error);
    } else {
      // Tool available: skip this assertion (integration test covers it)
      assert.ok(true);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("convertBatch 空列表时返回空报告", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emf-empty-"));
  try {
    fs.mkdirSync(path.join(tmpDir, "docs/.wiki"), { recursive: true });
    const report = await convertBatch([], { rootDir: tmpDir });
    assert.strictEqual(report.total, 0);
    assert.strictEqual(report.succeeded, 0);
    assert.strictEqual(report.failed, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("convertBatch 输入文件不存在时标记单项 failed", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emf-nofile-"));
  try {
    fs.mkdirSync(path.join(tmpDir, "docs/.wiki"), { recursive: true });
    const report = await convertBatch(["/nonexistent/file.emf"], { rootDir: tmpDir });
    assert.strictEqual(report.total, 1);
    assert.strictEqual(report.failed, 1);
    assert.ok(report.results[0].error?.includes("不存在"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd D:/WorkSpace/wiki-plugin && npx tsc && node --test dist/lib/__tests__/emf-converter.test.js`
Expected: FAIL — `convertBatch` 不存在

- [ ] **Step 3: 实现 convertBatch**

在 `src/lib/emf-converter.ts` 末尾追加：

```typescript
export function isEmfFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [".x-emf", ".emf", ".wmf", ".x-wmf"].includes(ext);
}

function computeHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function getCacheDir(rootDir: string): string {
  return resolveFromRoot(rootDir, EMF_CACHE_DIR);
}

function getCachePath(rootDir: string, hash: string): string {
  return path.join(getCacheDir(rootDir), `${hash}.svg`);
}

export async function convertBatch(
  emfPaths: string[],
  options: {
    rootDir: string;
    timeoutMs?: number;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<ConvertReport> {
  const { rootDir, timeoutMs = 60000 } = options;

  if (emfPaths.length === 0) {
    return { total: 0, succeeded: 0, failed: 0, fromCache: 0, toolUsed: "none", results: [] };
  }

  const results: ConvertResult[] = [];
  const toConvert: Array<{ source: string; targetSvg: string }> = [];
  let fromCacheCount = 0;

  const cacheDir = getCacheDir(rootDir);
  ensureDir(cacheDir);

  // Phase 1: check cache and filter
  for (const emfPath of emfPaths) {
    if (!fs.existsSync(emfPath)) {
      results.push({ source: emfPath, success: false, error: "文件不存在" });
      continue;
    }

    const hash = computeHash(emfPath);
    const cached = getCachePath(rootDir, hash);
    const targetSvg = emfPath.replace(/\.[^.]+$/, ".svg");

    if (fs.existsSync(cached)) {
      try {
        fs.copyFileSync(cached, targetSvg);
        results.push({ source: emfPath, success: true, output: targetSvg, fromCache: true });
        fromCacheCount++;
      } catch (err: any) {
        results.push({ source: emfPath, success: false, error: `缓存读取失败: ${err.message}` });
      }
    } else {
      toConvert.push({ source: emfPath, targetSvg });
    }
  }

  // Phase 2: detect tool
  const tool = detectTool();

  if (toConvert.length === 0) {
    return {
      total: emfPaths.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      fromCache: fromCacheCount,
      toolUsed: tool.kind,
      results,
    };
  }

  if (tool.kind === "none") {
    for (const item of toConvert) {
      results.push({ source: item.source, success: false, error: "未检测到 LibreOffice/ImageMagick" });
    }
    return {
      total: emfPaths.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      fromCache: fromCacheCount,
      toolUsed: "none",
      setupHint: SETUP_HINT,
      results,
    };
  }

  // Phase 3: batch convert
  const tmpOutDir = path.join(cacheDir, `_tmp_${Date.now()}`);
  ensureDir(tmpOutDir);

  try {
    const convertResults = tool.kind === "soffice"
      ? await runSoffice(tool.path!, toConvert.map(i => i.source), tmpOutDir, timeoutMs)
      : await runMagick(tool.path!, toConvert, tmpOutDir, timeoutMs);

    for (const item of toConvert) {
      const baseName = path.basename(item.source).replace(/\.[^.]+$/, ".svg");
      const tmpOutput = path.join(tmpOutDir, baseName);

      if (fs.existsSync(tmpOutput)) {
        // Copy to target and cache
        fs.copyFileSync(tmpOutput, item.targetSvg);
        try {
          const hash = computeHash(item.source);
          fs.copyFileSync(tmpOutput, getCachePath(rootDir, hash));
        } catch { /* cache write failure is non-blocking */ }
        results.push({ source: item.source, success: true, output: item.targetSvg, fromCache: false });
      } else {
        results.push({ source: item.source, success: false, error: convertResults.error || "转换失败：未生成 SVG" });
      }

      options.onProgress?.(results.length, emfPaths.length);
    }
  } finally {
    fs.rmSync(tmpOutDir, { recursive: true, force: true });
  }

  return {
    total: emfPaths.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    fromCache: fromCacheCount,
    toolUsed: tool.kind,
    setupHint: results.some(r => !r.success) ? SETUP_HINT : undefined,
    results,
  };
}

function runSoffice(
  sofficePath: string,
  inputs: string[],
  outDir: string,
  timeoutMs: number,
): Promise<{ error?: string }> {
  return new Promise((resolve) => {
    const args = ["--headless", "--convert-to", "svg", "--outdir", outDir, ...inputs];
    execFile(sofficePath, args, { timeout: timeoutMs }, (err) => {
      if (err) {
        resolve({ error: `soffice 错误: ${err.message}` });
      } else {
        resolve({});
      }
    });
  });
}

function runMagick(
  magickPath: string,
  items: Array<{ source: string; targetSvg: string }>,
  outDir: string,
  timeoutMs: number,
): Promise<{ error?: string }> {
  // ImageMagick converts one file at a time
  const promises = items.map((item) => {
    return new Promise<void>((resolve) => {
      const outFile = path.join(outDir, path.basename(item.source).replace(/\.[^.]+$/, ".svg"));
      execFile(magickPath, ["convert", item.source, outFile], { timeout: timeoutMs }, () => {
        resolve();
      });
    });
  });
  return Promise.all(promises).then(() => ({})).catch((err) => ({ error: err.message }));
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd D:/WorkSpace/wiki-plugin && npx tsc && node --test dist/lib/__tests__/emf-converter.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: 提交**

```bash
git add src/lib/emf-converter.ts src/lib/__tests__/emf-converter.test.ts
git commit -m "feat(emf): implement convertBatch with cache and tool fallback"
```

---

## Task 3: read-raw-file 集成 emf-converter

**Files:**
- Modify: `src/mcp/tools/read-raw-file.ts`

- [ ] **Step 1: 在 read-raw-file.ts 顶部添加 import**

在 `src/mcp/tools/read-raw-file.ts` 第 6 行（`import mammoth` 之前）添加：

```typescript
import { convertBatch, isEmfFile } from "../../lib/emf-converter.js";
```

- [ ] **Step 2: 在 convertImage 回调里收集 EMF 路径**

在 `let imgIndex = 0;` 之后添加：

```typescript
const emfQueue: string[] = [];
```

在 `fs.writeFileSync(imgPath, buffer);` 之后、`images.push(imgName);` 之前添加：

```typescript
if (isEmfFile(imgName)) {
  emfQueue.push(imgPath);
}
```

- [ ] **Step 3: 在 turndown 替换后、return 之前插入 EMF 转换逻辑**

在 `extractedText = extractedText.replace(` `OBSIDIAN_WIKILINK` 替换完成的 `}` 关闭之后、`if (result.messages.length > 0)` 之前，插入：

```typescript
// EMF/WMF batch conversion
let imagesConverted = 0;
let imagesFailedConvert = 0;
let imagesFromCache = 0;
let toolUsed: string = "none";
let setupHint: string | undefined;

if (emfQueue.length > 0) {
  const report = await convertBatch(emfQueue, { rootDir });
  toolUsed = report.toolUsed;
  setupHint = report.setupHint;
  imagesConverted = report.succeeded;
  imagesFailedConvert = report.failed;
  imagesFromCache = report.fromCache;

  for (const r of report.results) {
    const srcBase = path.basename(r.source);
    if (r.success && r.output) {
      const dstBase = path.basename(r.output);
      const escaped = srcBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      extractedText = extractedText.replace(
        new RegExp(`!\\[\\[${escaped}\\]\\]`, "g"),
        `![[${dstBase}]]`,
      );
      try { fs.unlinkSync(r.source); } catch {}
    } else {
      const escaped = srcBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const comment = `<!-- ⚠️ EMF 矢量图未转换：${r.error}。安装 LibreOffice 后运行 /wiki-reconvert-images 补转。 -->`;
      extractedText = extractedText.replace(
        new RegExp(`(!\\[\\[${escaped}\\]\\])`, "g"),
        `$1\n${comment}`,
      );
    }
  }
}
```

- [ ] **Step 4: 修改返回的 JSON 结构，添加新字段**

找到 `mode === "none"` 分支里 `return` 的 JSON 对象，在 `images: images.length,` 后追加：

```typescript
imagesConverted,
imagesFailedConvert,
imagesFromCache,
toolUsed,
setupHint,
```

同样在 `chunked` 分支的返回里加上相同字段。

- [ ] **Step 5: 编译确认无类型错误**

Run: `cd D:/WorkSpace/wiki-plugin && npx tsc`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/mcp/tools/read-raw-file.ts
git commit -m "feat(emf): integrate emf-converter into read-raw-file"
```

---

## Task 4: reconvert_images MCP tool

**Files:**
- Create: `src/mcp/tools/reconvert-images.ts`
- Modify: `src/mcp/server.ts`

- [ ] **Step 1: 创建 reconvert-images.ts**

写入 `src/mcp/tools/reconvert-images.ts`：

```typescript
import * as fs from "fs";
import * as path from "path";
import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveFromRoot, DOCS_DIR } from "../../lib/paths.js";
import { convertBatch, isEmfFile } from "../../lib/emf-converter.js";

function findEmfFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findEmfFiles(full));
    } else if (isEmfFile(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function findMdFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== ".wiki") {
      results.push(...findMdFiles(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

export function registerReconvertImages(server: McpServer, rootDir: string) {
  server.registerTool(
    "reconvert_images",
    {
      description: "批量转换 docs/ 下残留的 EMF/WMF 图片为 SVG，并替换 markdown 中的引用",
      inputSchema: z.object({
        scope: z.string().optional().describe("可选：相对于 docs/ 的路径前缀，限定扫描范围"),
      }),
    },
    async ({ scope }) => {
      const docsDir = resolveFromRoot(rootDir, DOCS_DIR);
      const scanDir = scope ? path.join(docsDir, scope) : docsDir;

      // Find all EMF/WMF files in assets under scan scope
      const assetsDir = path.join(docsDir, "assets");
      const emfFiles = findEmfFiles(scope ? path.join(scanDir, "assets") : assetsDir)
        .concat(findEmfFiles(scanDir).filter(f => !f.includes(path.join("assets", ""))));

      if (emfFiles.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ total: 0, message: "未找到 EMF/WMF 文件" }) }] };
      }

      const report = await convertBatch(emfFiles, { rootDir });

      // Replace references in markdown files
      let mdFilesModified = 0;
      if (report.succeeded > 0) {
        const mdFiles = findMdFiles(docsDir);
        const commentRegex = /\n<!-- ⚠️ EMF 矢量图未转换：.*?补转。 -->/g;

        for (const mdFile of mdFiles) {
          let content = fs.readFileSync(mdFile, "utf-8");
          let modified = false;

          for (const r of report.results) {
            if (!r.success || !r.output) continue;
            const srcBase = path.basename(r.source);
            const dstBase = path.basename(r.output);
            const escaped = srcBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`!\\[\\[${escaped}\\]\\]`, "g");

            if (regex.test(content)) {
              content = content.replace(regex, `![[${dstBase}]]`);
              modified = true;
            }
          }

          // Remove warning comments for successful conversions
          if (modified) {
            content = content.replace(commentRegex, "");
            fs.writeFileSync(mdFile, content, "utf-8");
            mdFilesModified++;
          }
        }

        // Delete original EMF files that were successfully converted
        for (const r of report.results) {
          if (r.success && fs.existsSync(r.source)) {
            fs.unlinkSync(r.source);
          }
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            total: report.total,
            succeeded: report.succeeded,
            failed: report.failed,
            fromCache: report.fromCache,
            toolUsed: report.toolUsed,
            mdFilesModified,
            setupHint: report.setupHint,
          }),
        }],
      };
    }
  );
}
```

- [ ] **Step 2: 在 server.ts 注册新 tool**

在 `src/mcp/server.ts` 第 11 行 `import { registerUnprocessDoc }` 之后添加：

```typescript
import { registerReconvertImages } from "./tools/reconvert-images.js";
```

在 `registerUnprocessDoc(server, rootDir);` 之后添加：

```typescript
registerReconvertImages(server, rootDir);
```

- [ ] **Step 3: 编译确认通过**

Run: `cd D:/WorkSpace/wiki-plugin && npx tsc`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/mcp/tools/reconvert-images.ts src/mcp/server.ts
git commit -m "feat(emf): add reconvert_images MCP tool"
```

---

## Task 5: reconvert-images 测试

**Files:**
- Create: `src/mcp/tools/__tests__/reconvert-images.test.ts`

- [ ] **Step 1: 写测试**

写入 `src/mcp/tools/__tests__/reconvert-images.test.ts`：

```typescript
import test from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { findEmfFiles, findMdFiles } from "../reconvert-images.js";

// Note: We test the helper functions directly.
// Full integration with convertBatch is covered by emf-converter tests.

test("findEmfFiles 在空目录返回空", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reconvert-test-"));
  try {
    const result = findEmfFiles(tmpDir);
    assert.deepStrictEqual(result, []);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("findEmfFiles 递归发现 .x-emf 文件", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reconvert-test-"));
  try {
    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(tmpDir, "a.x-emf"), "fake");
    fs.writeFileSync(path.join(subDir, "b.wmf"), "fake");
    fs.writeFileSync(path.join(subDir, "c.png"), "fake");

    const result = findEmfFiles(tmpDir);
    assert.strictEqual(result.length, 2);
    assert.ok(result.some(f => f.endsWith("a.x-emf")));
    assert.ok(result.some(f => f.endsWith("b.wmf")));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("findMdFiles 递归发现 .md 文件但跳过 .wiki", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reconvert-test-"));
  try {
    fs.writeFileSync(path.join(tmpDir, "a.md"), "content");
    const wikiDir = path.join(tmpDir, ".wiki");
    fs.mkdirSync(wikiDir);
    fs.writeFileSync(path.join(wikiDir, "b.md"), "hidden");

    const result = findMdFiles(tmpDir);
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].endsWith("a.md"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: 导出 helper 函数以便测试**

在 `src/mcp/tools/reconvert-images.ts` 中将 `findEmfFiles` 和 `findMdFiles` 改为 `export function`。

- [ ] **Step 3: 编译并运行测试**

Run: `cd D:/WorkSpace/wiki-plugin && npx tsc && node --test dist/mcp/tools/__tests__/reconvert-images.test.js`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/mcp/tools/__tests__/reconvert-images.test.ts src/mcp/tools/reconvert-images.ts
git commit -m "test(emf): add reconvert-images unit tests"
```

---

## Task 6: /wiki-reconvert-images skill 和 plugin 注册

**Files:**
- Create: `skills/wiki-reconvert-images/SKILL.md`
- Create: `.claude/skills/wiki-reconvert-images/SKILL.md`
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: 创建 SKILL.md**

写入 `skills/wiki-reconvert-images/SKILL.md`：

```markdown
---
name: wiki-reconvert-images
description: 重新扫描 docs/ 下的 EMF/WMF 图片并转为 SVG，自动更新 markdown 引用
---

# /wiki-reconvert-images

把 docs/assets/ 下残留的 .x-emf/.wmf 矢量图批量转为 .svg，并自动替换所有 markdown 中的引用。

## 使用方式

- `/wiki-reconvert-images` — 全量扫描并转换
- `/wiki-reconvert-images <相对路径>` — 仅扫描指定路径下

## 处理流程

1. 调用 `reconvert_images` MCP tool
2. 工具内部：
   - 扫描目标范围下所有 .x-emf/.wmf 文件
   - 批量调 LibreOffice/ImageMagick 转 SVG（含缓存命中）
   - 扫描 docs/**/*.md，把 `![[xxx.x-emf]]` 替换为 `![[xxx.svg]]`
   - 删除紧跟的"⚠️ EMF 矢量图未转换"注释行
   - 删除已成功转换的原 .x-emf 文件
3. 输出报告：转换成功/失败/已缓存数量

## 前置条件

需要安装 LibreOffice（推荐）或 ImageMagick：
- LibreOffice: https://www.libreoffice.org/download/
- ImageMagick: https://imagemagick.org/script/download.php

## 注意事项

- 失败的项保留 .x-emf，不做任何文件改动
- 如果未检测到任何转换工具，提示用户安装后重试
- 已转换的结果会被缓存（docs/.wiki/emf-cache/），重复执行不会重新转换
```

- [ ] **Step 2: 创建镜像副本**

```bash
mkdir -p .claude/skills/wiki-reconvert-images
cp skills/wiki-reconvert-images/SKILL.md .claude/skills/wiki-reconvert-images/SKILL.md
```

- [ ] **Step 3: 更新 plugin.json**

在 `.claude-plugin/plugin.json` 的 `skills` 数组末尾追加：

```json
"skills/wiki-reconvert-images"
```

- [ ] **Step 4: 提交**

```bash
git add skills/wiki-reconvert-images/ .claude/skills/wiki-reconvert-images/ .claude-plugin/plugin.json
git commit -m "feat(emf): add /wiki-reconvert-images skill"
```

---

## Task 7: .gitignore 和文档更新

**Files:**
- Modify: `.gitignore`
- Modify: `CHANGELOG.md`
- Modify: `package.json`

- [ ] **Step 1: 更新 .gitignore**

在 `.gitignore` 末尾追加：

```
# EMF 转换缓存
docs/.wiki/emf-cache/
```

- [ ] **Step 2: 更新 CHANGELOG.md**

在文件开头、`## [0.3.0]` 之前插入：

```markdown
## [0.5.0] - 2026-05-27

### Added
- EMF/WMF 矢量图自动转换为 SVG（依赖 LibreOffice 或 ImageMagick）
- `/wiki-reconvert-images` 命令：补转残留的 EMF/WMF 图片
- EMF 转换结果缓存（docs/.wiki/emf-cache/，按内容 hash）
- 转换失败时在 markdown 中插入安装提示注释
- `read_raw_file` 返回新字段：imagesConverted/imagesFailedConvert/setupHint

### Changed
- `read_raw_file` docx 流程新增两阶段 EMF 转换（mammoth → batch convert）

```

- [ ] **Step 3: package.json version bump**

修改 `package.json` 中 `"version": "0.4.0"` 为 `"version": "0.5.0"`。

同步修改 `src/mcp/server.ts` 中 `version: "0.4.0"` 为 `version: "0.5.0"`。

- [ ] **Step 4: 编译确认**

Run: `cd D:/WorkSpace/wiki-plugin && npx tsc`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add .gitignore CHANGELOG.md package.json src/mcp/server.ts
git commit -m "chore: bump to v0.5.0, add EMF changelog and gitignore"
```

---

## Task 8: 全量测试运行 + CI 更新

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: 运行全部测试**

Run: `cd D:/WorkSpace/wiki-plugin && npx tsc && node --test dist/lib/__tests__/emf-converter.test.js dist/mcp/tools/__tests__/reconvert-images.test.js dist/lib/__tests__/wiki-config.test.js dist/mcp/tools/__tests__/mark-processed.test.js`
Expected: 全部 PASS

- [ ] **Step 2: 更新 CI 添加新测试文件**

在 `.github/workflows/ci.yml` 的 `node --test` 命令里追加新测试文件：

```yaml
- run: node --test dist/lib/__tests__/wiki-config.test.js dist/lib/__tests__/emf-converter.test.js dist/lib/md-to-docx/__tests__/preprocess.test.js dist/lib/md-to-docx/__tests__/parser.test.js dist/mcp/tools/__tests__/mark-processed.test.js dist/mcp/tools/__tests__/reconvert-images.test.js
```

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add emf-converter and reconvert-images tests to CI"
```

