# Wiki Plugin 文档导出功能设计

**日期**: 2026-05-14
**状态**: 设计批准，待实施

## 一、Context

wiki-plugin 当前已实现把 Word/Excel/PDF 转换为 Markdown 并整理到 Obsidian 兼容的知识库。但有些 Markdown 文档（如 AI 生成的代码文档、设计方案）没有原始的 Word 版本，又需要发给不使用 Obsidian 的外部人员。

本次新增"文档导出"功能：把指定的 Markdown 文档导出为 Word 格式（.docx），同时正确处理图片、Mermaid UML 图和 wikilink。

## 二、需求要点

| 项目 | 决策 |
|------|------|
| 输出格式 | Word（.docx） |
| 输入来源 | `docs/` 下的 Markdown 文档 |
| Mermaid 处理 | 渲染为 PNG 后嵌入 Word（本地 mermaid-cli） |
| 多文件支持 | 单文件分别导出 + 多文件合并为一份 |
| Wikilink 处理 | `[[xxx]]` → 纯文本，不展开被引用文档 |
| 输出位置 | `docs/exports/` |
| 样式 | 内置中文友好模板（微软雅黑、表格边框等） |
| 触发方式 | `/wiki-export` slash 命令 |

## 三、技术方案

**方案 A：纯 Node 实现**（已选定）

| 库 | 用途 | 依赖类型 |
|----|------|---------|
| `marked` | MD → token 流 | dependencies |
| `docx` | 构造 .docx 文件 | dependencies |
| `image-size` | 读取图片尺寸 | dependencies |
| `@mermaid-js/mermaid-cli` | 渲染 Mermaid 为 PNG（含 Chromium 约 150MB） | optionalDependencies |

未选 Pandoc（方案 B）的原因：用户偏好零外部系统依赖，先尝试纯 Node 方案，效果不理想再切换。

## 四、文件结构

新增：

```
wiki-plugin/
├── src/
│   ├── lib/
│   │   └── md-to-docx/
│   │       ├── index.ts          # convertToDocx 主入口
│   │       ├── preprocess.ts     # mermaid 渲染 + wikilink 处理 + 图片路径解析
│   │       ├── mermaid.ts        # mmdc 调用封装
│   │       ├── parser.ts         # MD token → docx 节点的转换器
│   │       └── styles.ts         # Word 样式模板
│   └── mcp/tools/
│       └── export-docx.ts        # 新 MCP tool：export_docx
└── skills/
    └── wiki-export/
        └── SKILL.md              # /wiki-export 命令
```

## 五、MCP Tool: `export_docx`

**输入：**

```typescript
{
  paths: string[];              // 相对 docs/ 的 MD 文件路径
  mode: "single" | "merged";    // single=每个独立导出；merged=合并为一个
  output?: string;              // 自定义输出文件名（不含扩展名）
}
```

**输出：**

```typescript
{
  success: boolean;
  files: string[];              // 生成的 .docx 路径
  warnings: string[];           // 警告（mermaid 失败、图片缺失等）
}
```

**行为：**

- `single` 模式：每个 MD 生成独立 .docx，文件名取 frontmatter `title`，无则用文件名
- `merged` 模式：所有文档合并为一个，按 paths 顺序排列，每篇前加分页符；文件名优先用 `output` 参数，未提供时取 `导出_<YYYYMMDD-HHmmss>.docx`
- 输出位置 `docs/exports/`（不存在则创建）
- 文件重名时追加时间戳

## 六、Skill: `/wiki-export`

**工作流：**

1. 调用 `list_all_docs` 列出全部文档
2. 根据用户输入匹配文档（无输入则让用户多选）
3. 询问导出模式（单文件 / 合并）
4. 合并模式下询问报告标题
5. 调用 `export_docx`
6. 报告输出路径与 warnings

**命令示例：**

| 输入 | 行为 |
|------|------|
| `/wiki-export` | 列出全部，让用户多选 |
| `/wiki-export 接口设计` | 匹配标题/路径包含"接口设计"的文档 |
| `/wiki-export 产品/` | 匹配产品分类下所有文档 |

## 七、转换器细节

### MD 元素映射

| MD 元素 | docx 映射 |
|---------|-----------|
| `# 标题` | `Paragraph` + `HeadingLevel.HEADING_1`（最多 6 级） |
| 段落 | `Paragraph` |
| `**粗体**` `*斜体*` `` `代码` `` | `TextRun({bold/italics/font: "Consolas"})` |
| ```` ``` 代码块 ```` | `Paragraph` + 灰底 + 等宽字体 |
| `- 列表` `1. 列表` | `Paragraph` + bullet/numbering |
| `> 引用` | `Paragraph` + 左边框 + 缩进 |
| `[文本](url)` | `ExternalHyperlink` |
| `[[wikilink]]` `[[link\|alias]]` | 纯文本（有 alias 用 alias，否则用 link 本身；保留路径分隔符外的最后一段） |
| `![alt](path)` `![[name.png]]` | `ImageRun`，宽度 ≤ 14cm 按比例缩放 |
| 表格 | `Table` + `TableRow` + `TableCell`（表头加粗 + 浅蓝背景） |
| `---` | `Paragraph` + 下边框 |

### 中文样式模板

| 项 | 值 |
|----|-----|
| 正文 | 微软雅黑 11pt，1.5 倍行距 |
| 标题 | 微软雅黑 加粗，H1=18pt / H2=16pt / H3=14pt |
| 代码 | Consolas，灰底 #F5F5F5 |
| 表格 | 0.5pt 灰边框，表头浅蓝 #E7F0FA |
| 段间距 | 6pt |
| 页边距 | 上下 2.54cm，左右 3.17cm |

### Mermaid 处理流程

1. 正则匹配 \`\`\`mermaid 代码块
2. 写入临时文件 `temp/mermaid_<hash>.mmd`
3. 调用 `mmdc -i temp.mmd -o temp.png -b transparent`
4. 替换为图片引用
5. 完成后清理 temp 目录

**首次使用：** 检测到 mermaid 代码块但 mermaid-cli 未安装时，抛出友好错误并提示 `npm install -D @mermaid-js/mermaid-cli`。

### 图片处理

- `![[name.png]]` 在 docs/assets/ 下查找
- `image-size` 读像素，按 96 DPI 转 cm
- 宽度 > 14cm 等比缩放到 14cm
- 找不到时插入 `[图片缺失: name.png]` 占位符 + warning

### 合并模式

- 按 paths 顺序处理
- 每篇前插入分页符
- 文档内 H1 自动降级为 H2（避免与新加的章节标题冲突）
- frontmatter 忽略

## 八、错误处理

| 情况 | 处理 |
|------|------|
| MD 不存在 | 跳过 + warning |
| Mermaid 语法错 | 保留为代码块 + warning |
| mermaid-cli 未装 | 抛错并提示安装命令 |
| 图片缺失 | 占位符 + warning |
| 输出目录不存在 | 自动创建 |
| 输出文件重名 | 追加时间戳 |
| docx 库报错 | 整体失败，返回错误信息 |
| paths 为空 | 报错 |

## 九、验证

**端到端测试用例：**

1. 纯文本 + 标题 → 验证标题层级
2. 含图片 MD（用现有"使用手册"，147 张图片）→ 验证图片嵌入
3. 含 Mermaid 的测试 MD → 验证渲染
4. 含表格 MD（"数据资产清单"）→ 验证表格结构
5. 含 wikilink MD → 验证转为纯文本
6. 合并模式选 3 个文档 → 验证分页符 + 标题降级
7. Mermaid 语法错 → 验证 warning + 代码块保留

**单元测试：**

- `src/lib/md-to-docx/__tests__/parser.test.ts` 覆盖核心元素映射
- 测试框架用 Node 内置 `node:test`，避免新依赖

## 十、关键文件

新建：
- `src/lib/md-to-docx/index.ts`
- `src/lib/md-to-docx/preprocess.ts`
- `src/lib/md-to-docx/mermaid.ts`
- `src/lib/md-to-docx/parser.ts`
- `src/lib/md-to-docx/styles.ts`
- `src/mcp/tools/export-docx.ts`
- `skills/wiki-export/SKILL.md`

修改：
- `src/mcp/server.ts` — 注册 export_docx tool
- `package.json` — 新增依赖
- `.claude-plugin/plugin.json` — 添加 wiki-export skill
- `README.md` — 补充导出功能说明
