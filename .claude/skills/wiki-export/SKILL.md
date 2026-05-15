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
