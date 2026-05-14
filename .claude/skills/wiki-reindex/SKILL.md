---
name: wiki-reindex
description: 强制重建 .wiki/index.json 文档索引
---

# /wiki-reindex

强制重新扫描 docs/ 下所有分类目录中的 Markdown 文件，重建 `.wiki/index.json` 索引。

## 使用场景

- 手动编辑了文档后索引不同步
- 索引文件损坏或丢失
- 从其他来源导入了文档

## 处理流程

1. 调用 `rebuild_index` 工具
2. 报告扫描结果：文档总数、各分类数量

## 注意事项

- 这是一个幂等操作，可以安全地重复执行
- 会覆盖现有的 index.json
- 不会修改任何 Markdown 文件内容
