---
name: wiki-relink
description: 重新扫描所有文档，识别并补全缺失的 [[wikilink]] 双向链接
---

# /wiki-relink

重新分析所有已整理的文档，识别语义相关但尚未建立链接的文档对，提议补全 [[wikilink]]。

## 使用方式

- `/wiki-relink` — 扫描全部文档
- `/wiki-relink <分类>` — 仅扫描指定分类（产品/技术/运维）

## 处理流程

1. 调用 `list_all_docs` 获取所有文档列表
2. 调用 `rebuild_index` 确保索引最新
3. 对每个文档：
   a. 读取文档内容
   b. 调用 `find_related_docs` 基于标题和 tags 查找潜在关联
   c. 对比当前已有的 outgoing links，识别缺失的关联
   d. 如果发现新的关联，向用户展示提议
   e. 用户确认后调用 `update_wikilinks` 插入链接

## 注意事项

- 只提议高相关度的链接，避免过度关联
- 用户可以逐条确认或批量确认
- 不会删除已有的链接，只做增量补全
