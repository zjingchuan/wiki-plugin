# Wiki Plugin

一个 Claude Code 插件，用于自动管理软件项目的文档知识库。把 Word、Excel、PDF 等原始文档智能转换为 Markdown，自动分类整理并建立 Obsidian 兼容的双向链接。

## 特性

- **智能转换**：自动把 Word（.docx）、Excel（.xlsx）、PDF 转换为 Markdown，保留表格、标题层级、图片
- **图片提取**：Word 文档中的嵌入图片自动保存到 `docs/assets/`，使用 Obsidian wiki-link 格式 `![[xxx]]`
- **智能分类**：Claude 分析内容后提议分类（产品/技术/运维），用户确认后写入对应目录
- **双向链接**：自动识别相关文档，插入 `[[wikilink]]` 双向链接，与 Obsidian 完美兼容
- **状态管理**：通过 hash 防止重复处理；支持原始文件归档
- **会话提示**：启动 Claude Code 时自动检测未处理文件并提示

## 目录结构

插件运行后，你的项目会变成这样：

```
<你的项目>/docs/
├── raw/                      # 原始文件放这里
│   ├── 需求文档.docx
│   ├── 数据清单.xlsx
│   └── archive/              # 已处理的原始文件归档
├── 产品/                     # 产品文档（自动分类）
├── 技术/                     # 技术文档
├── 运维/                     # 运维文档
├── assets/                   # 图片资源
│   └── 需求文档/
│       ├── 需求文档_001.png
│       └── 需求文档_002.png
└── .wiki/
    ├── state.json            # 处理状态（hash 记录）
    └── index.json            # 文档索引
```

## 安装

### 方式 1：本地链接（开发/测试）

```bash
# 1. 进入插件目录构建
cd /path/to/wiki-plugin
npm install
npm run build

# 2. 在你的项目中创建 .claude/settings.json，注册 MCP server
{
  "mcpServers": {
    "wiki": {
      "command": "node",
      "args": ["/path/to/wiki-plugin/dist/mcp/server.js"],
      "cwd": "/path/to/your-project"
    }
  }
}

# 3. 复制 skills 到项目
cp -r /path/to/wiki-plugin/skills/* /path/to/your-project/.claude/skills/
```

### 方式 2：作为 Claude Code Plugin 使用

把整个 `wiki-plugin` 目录作为插件，目录中已包含 `.claude-plugin/plugin.json` 配置。

## 使用方法

### 第一步：放入原始文件

把 Word/Excel/PDF 文件放到项目的 `docs/raw/` 目录下。

### 第二步：启动 Claude Code

在项目根目录运行 `claude`。如果检测到未处理文件，会自动提示。

### 第三步：运行命令

| 命令 | 用途 |
|------|------|
| `/wiki-import` | 处理 `docs/raw/` 下所有待处理文件 |
| `/wiki-import <文件名>` | 仅处理指定文件 |
| `/wiki-relink` | 重新扫描所有文档，补全 wikilinks 关联 |
| `/wiki-reindex` | 强制重建 `.wiki/index.json` 索引 |
| `/wiki-export` | 把 MD 文档导出为 Word（.docx） |

### 处理流程

执行 `/wiki-import` 时，对每个文件 Claude 会：

1. 读取原始文件内容（含图片提取）
2. 智能转换为结构化 Markdown
3. 分析内容提议分类（产品/技术/运维）和路径
4. 查找相关已有文档建议关联
5. **向用户展示提议，等待确认**
6. 确认后写入 MD 文件、归档原文、更新索引

### 文档导出

把整理好的 Markdown 文档导出为 Word，便于发给不使用 Obsidian 的同事。

```
/wiki-export                    # 列出全部，让用户选
/wiki-export 接口设计           # 模糊匹配
/wiki-export 产品/              # 按分类
```

支持两种模式：
- **single**：每个 MD 单独导出为一个 .docx
- **merged**：多个 MD 合并为一份完整报告（带分页符）

输出位置：`docs/exports/`

**Mermaid 图表**：如果文档包含 mermaid 代码块，需要安装 mermaid-cli 才能渲染为图片：

```bash
npm install --save-optional @mermaid-js/mermaid-cli
```

未安装时 mermaid 块会保留为代码块文本。

## 在 Obsidian 中使用

把项目的 `docs/` 目录作为 Obsidian Vault 打开即可：

- 正向链接 `[[文档名]]` 直接显示
- 双向链接通过 Obsidian 的 Backlinks 面板自动显示
- 关系图谱（Graph View）展示文档关联
- 图片以 `![[xxx.png]]` 格式引用，自动渲染

## MCP Tools

插件提供以下 MCP 工具供 Claude 调用：

| Tool | 用途 |
|------|------|
| `list_pending_files` | 列出未处理文件 |
| `read_raw_file` | 提取原始文件内容（文本+图片） |
| `write_doc` | 写入分类后的 MD 文件 |
| `mark_processed` | 标记已处理 + 归档 |
| `find_related_docs` | 检索相关文档 |
| `list_all_docs` | 列出全部已整理文档 |
| `update_wikilinks` | 插入/更新 wikilinks |
| `rebuild_index` | 重建索引 |
| `export_docx` | 导出 Markdown 为 Word（.docx） |

## 技术栈

- TypeScript + Node.js
- @modelcontextprotocol/sdk - MCP Server
- mammoth - Word 文档解析
- xlsx - Excel 文档解析
- pdf-parse - PDF 文档解析
- turndown - HTML 转 Markdown

## 许可证

ISC
