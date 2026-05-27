# EMF/WMF 图片转换功能设计

- **状态**: Draft
- **作者**: jczhang2 + Claude
- **创建日期**: 2026-05-27
- **关联问题**: 测试 wiki-plugin 时发现 docx 中嵌入的 .x-emf 流程图无法在 Obsidian 渲染

## 1. 背景

`/wiki-import` 通过 mammoth 把 docx 转成 markdown，docx 中嵌入的图片由 mammoth 的 `convertImage` 回调原样写到 `docs/assets/<文档名>/`。当 docx 含 EMF/WMF 矢量图时（中国移动等机构的技术文档大量使用 Visio 流程图，输出的 docx 内嵌格式就是 EMF），写盘后得到 `*.x-emf` 文件，markdown 里是 `![[xxx.x-emf]]`。

EMF 是 Windows 增强图元文件格式，浏览器和 Obsidian 都不支持渲染。本次测试的"一点计费能力外部接口设计说明书.docx"中含 11 张 EMF 流程图，全部无法显示。

## 2. 目标

让 docx 中嵌入的 EMF/WMF 矢量图在 Obsidian 和浏览器中正常显示，且失败时给用户清晰的引导。

### 范围内
- docx 导入流程（`read_raw_file`）中自动调用外部工具转 SVG
- 新增 `/wiki-reconvert-images` 用于事后补转
- 转换结果缓存（按内容 hash）
- 失败时保留 .x-emf 引用 + 行内注释 + 工具安装引导

### 范围外
- WASM 纯 JS 降级路径（推迟到 v2）
- 反向转换（svg → emf）
- EMF 之外的非主流矢量格式（CGM 等）

## 3. 决策摘要

| 维度 | 决策 | 理由 |
|------|------|------|
| 依赖策略 | 优先外部工具 → 失败保留原图（两层） | 外部工具质量稳定；公开的 WASM EMF 库（emf2svg-wasm 等）对带中文文字的 Visio 流程图普遍存在丢字/错位问题，先不引入，YAGNI |
| 工具优先级 | LibreOffice → ImageMagick | LibreOffice 对带文字 EMF 保真度更好；批量转换可摊薄启动成本 |
| 输出格式 | SVG | 矢量、Obsidian 原生支持、文件小；LibreOffice 默认把字体转路径解决跨机字体问题 |
| 转换时机 | 两阶段：mammoth 全跑完 → 一次批量调 soffice | 一次启动转 N 张，11 张图从 ~55 秒降到 ~10 秒 |
| 失败处理 | 保留 `![[xxx.x-emf]]` + 紧贴下一行 HTML 注释 + 返回 setupHint | 用户能看到提示；注释不污染索引；重转时可精准替换 |
| 缓存 | sha256 内容 hash → `docs/.wiki/emf-cache/<hash>.svg` | 反复测试同一 docx 时秒回；源文件变了 hash 自动失效；零维护 |
| 重转入口 | 新增 `/wiki-reconvert-images` skill | 不破坏用户已编辑的 markdown（vs 重导入） |

## 4. 架构

```
┌─────────────────────────────────────────────────────────┐
│  read_raw_file（mammoth 阶段）                            │
│  1. mammoth 提取所有图（含 .x-emf）→ 写入 assets/         │
│  2. 收集刚写入的 .x-emf/.wmf 清单                         │
│  3. 调 emfConverter.convertBatch(清单)                   │
│  4. 把 markdown 里的 ![[xxx.x-emf]] 替换成 ![[xxx.svg]]   │
│  5. 失败的图：保留 .x-emf 引用 + 紧贴下一行 HTML 注释      │
│  6. 返回结果含 imagesConverted/Failed/setupHint 字段     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  /wiki-reconvert-images（新 skill）                       │
│  → 调 reconvert_images MCP tool                          │
│  1. 扫描 docs/assets/**/*.x-emf  和  *.wmf               │
│  2. 调 emfConverter.convertBatch(清单)                   │
│  3. 扫描 docs/**/*.md：替换图片引用 + 删除提示注释         │
│  4. 删除已成功转换的原 .x-emf 文件                         │
│  5. 报告：转换成功/失败/已缓存数                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  src/lib/emf-converter.ts（新模块）                       │
│  • detectTool()                                          │
│  • convertBatch(emfPaths, options)                       │
│  • 内部：缓存命中检查 → soffice 调用 → 缓存写入            │
└─────────────────────────────────────────────────────────┘
```

## 5. 核心模块: `src/lib/emf-converter.ts`

### 5.1 公开接口

```ts
export type ToolKind = "soffice" | "magick" | "none";

export interface ConvertResult {
  source: string;           // 输入的 .x-emf/.wmf 绝对路径
  success: boolean;
  output?: string;          // 成功时：生成的 .svg 绝对路径
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

export function detectTool(): { kind: ToolKind; path?: string };

export async function convertBatch(
  emfPaths: string[],
  options: {
    rootDir: string;
    timeoutMs?: number;     // 默认 60000
    onProgress?: (done: number, total: number) => void;
  }
): Promise<ConvertReport>;
```

### 5.2 工具探测

按平台查找：

- **Windows**: 先查 PATH（`where soffice`），再查
  - `C:\Program Files\LibreOffice\program\soffice.exe`
  - `C:\Program Files (x86)\LibreOffice\program\soffice.exe`
- **macOS**: PATH 中的 `soffice`，再查 `/Applications/LibreOffice.app/Contents/MacOS/soffice`
- **Linux**: PATH 中的 `soffice` 或 `libreoffice`
- LibreOffice 找不到 → 尝试 `magick` (ImageMagick 7+) 或 `convert` (ImageMagick 6)
- 都没找到 → 返回 `{ kind: "none" }`

探测结果在模块级缓存（首次调用后保存），避免每次启动 child_process 开销。

### 5.3 缓存

- **目录**: `docs/.wiki/emf-cache/`
- **键**: 输入 emf 文件内容的 sha256 hex
- **文件名**: `<sha256>.svg`
- **命中流程**:
  1. 计算输入文件 sha256
  2. 查 `<cache-dir>/<sha256>.svg` 是否存在
  3. 命中 → 复制到目标路径，标记 `fromCache: true`
  4. 未命中 → 走转换路径，转完后既写目标也写缓存
- **失效**: 源 emf 内容变 → hash 变 → 自然 miss
- **gitignore**: `docs/.wiki/emf-cache/`

### 5.4 LibreOffice 调用

批量转换：

```bash
soffice --headless --convert-to svg --outdir <out-dir> <emf1> <emf2> ... <emfN>
```

实现细节：
- `child_process.execFile`（不走 shell，避免引号/路径转义坑）
- 默认超时 60 秒
- Windows 上使用绝对路径，统一用 `/` 分隔（soffice 兼容）
- 输出目录里 SVG 文件名 = 输入 EMF 文件 basename + `.svg`
- 临时输出到一个独立 tmp 目录，转换完原子拷贝到目标 + 缓存（避免半成品）
- 单次 batch 内会过滤已缓存命中的项，仅对真正未命中的调 soffice

### 5.5 失败处理

| 场景 | 处理 |
|------|------|
| `detectTool()` 返回 none | `convertBatch` 直接返回 toolUsed: "none"，所有 result.success = false，error 统一为 "未检测到 LibreOffice/ImageMagick"，并填充 setupHint |
| soffice 进程超时（execFile timeout） | 杀进程，所有结果标 failed，error 含 "转换超时" |
| soffice 返回非 0 退出码 | 检查输出目录中实际生成的 SVG 文件，存在的标 success，缺失的标 failed |
| 输入文件不存在 / 无读权限 | 单项标 failed，不阻塞其他项 |
| 缓存写失败（磁盘满等） | 不阻塞，标 fromCache: false 但 success: true |

### 5.6 setupHint 文案

```
未检测到 LibreOffice 或 ImageMagick。
Obsidian 无法直接渲染 EMF/WMF 矢量图。
建议安装 LibreOffice（推荐）：https://www.libreoffice.org/download/
安装后运行 /wiki-reconvert-images 补转所有未渲染的图。
```

## 6. read_raw_file 集成

### 6.1 流程改动

修改 `src/mcp/tools/read-raw-file.ts` 第 40-77 行的 docx 分支：

```
mammoth.convertToHtml
  └─ convertImage 回调：写文件，返回占位符；
                        如 contentType ∈ {image/x-emf, image/x-wmf, image/emf, image/wmf}，
                        把刚写入的路径加入 emfQueue
↓
turndown → 替换 OBSIDIAN_WIKILINK 占位符（保持现状）
↓
if emfQueue.length > 0:
    report = await emfConverter.convertBatch(emfQueue, { rootDir })
    for each result in report.results:
        srcBase = basename(result.source)        // xxx.x-emf
        if result.success:
            dstBase = basename(result.output)    // xxx.svg
            extractedText = extractedText.replace(`![[${srcBase}]]`, `![[${dstBase}]]`)
            unlink(result.source)                // 删除原 .x-emf
        else:
            commentLine = `<!-- ⚠️ EMF 矢量图未转换：${result.error}。安装 LibreOffice 后运行 /wiki-reconvert-images 补转。 -->`
            extractedText = extractedText.replace(
                `![[${srcBase}]]`,
                `![[${srcBase}]]\n${commentLine}`
            )
↓
返回结果（见下）
```

### 6.2 返回字段扩展

```ts
{
  filename, ext, size, content, images,
  
  // 新增
  imagesConverted: number,        // 成功转换数（含缓存命中）
  imagesFailedConvert: number,    // 失败数
  imagesFromCache: number,
  toolUsed: "soffice" | "magick" | "none",
  setupHint?: string,             // 仅在工具缺失且 emfQueue 非空时填充
}
```

Claude 在 `/wiki-import` 流程里读这些字段，向用户展示提议时主动告知"⚠️ N 张 EMF 图未能转换"，并附上 setupHint。

### 6.3 占位符替换的精确性

要避免：文档里 `![[xxx.x-emf]]` 在不同地方多次出现时，第一次替换成 .svg 后剩下的也会被替换（其实是想要的行为）。但要小心：

- 不能用简单 `replace`，需用正则 + 全局替换
- 替换时要 escape 文件名中的特殊字符（点号、括号等）

实现时用 `replaceAll` + escapeRegExp 工具函数。

## 7. 新 skill: `/wiki-reconvert-images`

### 7.1 文件

```
skills/wiki-reconvert-images/SKILL.md
.claude/skills/wiki-reconvert-images/SKILL.md   # 镜像，由现有约定维护
```

并在 `.claude-plugin/plugin.json` 的 skills 列表中追加。

### 7.2 SKILL.md 主要内容

```markdown
---
name: wiki-reconvert-images
description: 重新扫描 docs/ 下的 EMF/WMF 图片并转为 SVG，自动更新 markdown 引用
---

# /wiki-reconvert-images

把 docs/assets/ 下残留的 .x-emf/.wmf 矢量图批量转为 .svg，并自动替换所有 markdown 中的引用。

## 使用方式

- `/wiki-reconvert-images` — 全量扫描并转换
- `/wiki-reconvert-images <相对路径>` — 仅扫描指定路径下（如 docs/技术/接口设计/）

## 处理流程

1. 调用 `reconvert_images` MCP tool
2. 工具内部：
   - 扫描目标范围下所有 .x-emf/.wmf 文件
   - 批量调 LibreOffice/ImageMagick 转 SVG
   - 扫描 docs/**/*.md，把 ![[xxx.x-emf]] 替换为 ![[xxx.svg]]，并删除紧跟的注释行
   - 删除已成功转换的原 .x-emf 文件
3. 输出报告：转换成功/失败/已缓存数量

## 注意事项

- 失败的项保留 .x-emf，注释中的错误原因会更新为最新的失败信息
- 如果未检测到 LibreOffice，提示用户安装后重试，本次不做任何改动
```

### 7.3 MCP tool: `reconvert_images`

```ts
// src/mcp/tools/reconvert-images.ts
inputSchema: {
  scope: z.string().optional()
    .describe("可选：相对于 docs/ 的路径前缀，限定扫描范围"),
}

逻辑：
1. 扫描 docs/<scope or '*'>/ 下所有 .x-emf/.wmf
2. 调 emfConverter.convertBatch
3. 对每个 success 的 result：
   - 用 ripgrep / fs.readdir + readFile 扫所有 docs/**/*.md
   - 替换 ![[<basename>.x-emf]] → ![[<basename>.svg]]
   - 删除紧贴下一行的「⚠️ EMF 矢量图未转换」注释（用正则匹配整行）
   - unlink 原 .x-emf
4. 返回 ConvertReport + markdown 文件改动数
```

## 8. 测试策略

### 8.1 新增测试

- `src/lib/__tests__/emf-converter.test.ts`
  - `detectTool` 在三个平台 mock 文件存在/不存在的组合
  - 缓存命中/未命中
  - 工具不存在时 `convertBatch` 的快速失败行为
  - 通过 mock `child_process.execFile` 验证调用参数
  - 超时处理（mock 长时间不返回的 child_process）
  
- `src/mcp/tools/__tests__/reconvert-images.test.ts`
  - 端到端：fixture 目录含 emf + 引用它的 md → 验证 svg 输出 + md 替换 + 注释删除 + 原 emf 删除
  - scope 参数过滤
  - 工具缺失时不修改任何文件

### 8.2 修改/新增测试

- `src/mcp/tools/__tests__/read-raw-file.test.ts`（如不存在则新建）
  - fixture: 含 1 张 EMF 的小 docx
  - 在工具可用 mock 下：md 中是 .svg，imagesConverted=1
  - 在工具不可用 mock 下：md 中是 .x-emf + 注释，imagesFailedConvert=1，setupHint 非空

### 8.3 真实环境集成验证

- CI 上不依赖真实 LibreOffice（mock 子进程），但提供一个手动跑的 `npm run test:integration:emf` 脚本，要求本地装了 soffice 时跑
- 用本仓库现有的「一点计费」docx 当 fixture 之一

## 9. 文件影响清单

### 新增

- `src/lib/emf-converter.ts`
- `src/lib/__tests__/emf-converter.test.ts`
- `src/mcp/tools/reconvert-images.ts`
- `src/mcp/tools/__tests__/reconvert-images.test.ts`
- `skills/wiki-reconvert-images/SKILL.md`
- `.claude/skills/wiki-reconvert-images/SKILL.md`
- `src/mcp/tools/__tests__/fixtures/sample-with-emf.docx`（小型 fixture）

### 修改

- `src/mcp/tools/read-raw-file.ts`：接入 emf-converter，返回扩展字段
- `src/mcp/server.ts`：注册 `reconvert_images` tool
- `.claude-plugin/plugin.json`：skills 列表追加 `skills/wiki-reconvert-images`
- `.gitignore`：追加 `docs/.wiki/emf-cache/`
- `README.md`：可选依赖章节说明 LibreOffice
- `CHANGELOG.md`：v0.5.0 条目

### 不需要新增 npm 依赖

`child_process`、`fs`、`crypto`、`path` 全部 Node 内置。

## 10. 风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| LibreOffice 在 CI 上行为不一致（不同发行版） | 中 | CI 全部 mock child_process，仅本地集成测试调真实 soffice |
| 中文路径在 Windows 下传给 soffice 失败 | 中 | 实施时在本仓库的"一点计费"docx（assets 目录含中文）上做端到端验证；如失败，在 emf-converter 中加入"先 copy 到 emf-cache 临时 ASCII 路径，转换后再回写目标位置"的兜底 |
| 同名图片跨文档碰撞缓存（不会，但要确认） | 低 | 缓存键是 emf 内容 hash，不是文件名，不会碰撞 |
| 用户重命名 docx 后 assets 目录残留旧文件 | 中 | 不属本设计范围，由现有 wiki-undo + reimport 流程处理 |
| 转换出来的 SVG 字体尺寸异常（中文流程图常见） | 中 | LibreOffice 默认把文字转路径，已知能解决；测试时验证 |

## 11. 里程碑（不是实现计划，仅参考）

- M1 emf-converter 模块 + 单元测试通过（含 mock）
- M2 read_raw_file 接入，端到端在本仓库的"一点计费"docx 上跑通
- M3 wiki-reconvert-images skill + tool，本仓库残留的 11 张 .x-emf 能一键全部转好
- M4 文档更新（README / CHANGELOG），bump 到 v0.5.0

---

设计就是以上内容。详细的实施计划（任务拆分、依赖顺序、并行机会）由后续的 writing-plans 阶段产出。
