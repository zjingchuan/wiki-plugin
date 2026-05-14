---
name: wiki-import
description: 处理 docs/raw/ 下的原始文件，转换为 Markdown 并自动分类、建立双向链接
---

# /wiki-import

将 `docs/raw/` 目录下的原始文件（Word/Excel/PDF）智能转换为 Markdown 文档，自动分类并建立 Obsidian 兼容的 [[wikilink]] 双向链接。

## 使用方式

- `/wiki-import` — 处理所有待处理文件
- `/wiki-import <文件名>` — 仅处理指定文件

## 处理流程

对每个待处理文件，逐个执行以下步骤：

1. 调用 `list_pending_files` 获取待处理文件清单
2. 对每个文件：
   a. 调用 `read_raw_file` 读取原始内容
   b. 将内容智能转换为结构化 Markdown：
      - 保留标题层级、表格、列表、代码块
      - 去除冗余样式信息
      - 生成 YAML frontmatter（title, tags, category, date）
   c. 分析内容，提议分类（产品/技术/运维）和输出路径
   d. 调用 `find_related_docs` 查找相关已有文档
   e. 在正文合适位置插入 [[wikilink]] 链接
   f. 向用户展示提议：
      - 分类和输出路径
      - 生成的 tags
      - 关联的文档列表
   g. 等待用户确认或修改
   h. 确认后：
      - 调用 `write_doc` 写入 MD 文件
      - 调用 `mark_processed` 归档原文并更新状态
      - 调用 `update_wikilinks` 更新被引用文档的关联

## Frontmatter 格式

```yaml
---
title: 文档标题
tags: [标签1, 标签2]
category: 技术
source: 原始文件名.docx
created: 2026-05-14
---
```

## 注意事项

- 逐个文件处理并确认，不批量自动写入
- 如果用户拒绝某个提议，询问修改意见后重新生成
- 转换失败时跳过该文件，继续处理下一个
