---
name: wiki-import
description: 处理 docs/raw/ 下的原始文件，转换为 Markdown 并自动分类、建立双向链接
---

# /wiki-import

将 docs/raw/ 下的原始文件（Word/Excel/PDF）智能转换为 Markdown，自动分类并建立双向链接。

## 使用方式

- `/wiki-import` — 处理所有待处理文件
- `/wiki-import <文件名>` — 仅处理指定文件
- `/wiki-import --dry-run` — 预览模式：展示提议但不写文件

## 处理流程

1. 调用 `list_pending_files` 获取待处理文件清单
2. 对每个文件：
   a. **判断文件大小**：原始文件 > 5MB 或预估 MD > 15K 字时，调用 `read_raw_file` 时设 `chunkBy: "h1"` 或 `"h2"`，分块逐段整理后合并；否则一次性读取
   b. 智能转换为结构化 Markdown：
      - 保留标题层级、表格、列表、代码块
      - 图片自动嵌入为 `![[xxx]]`
      - 生成 YAML frontmatter（title, tags, category, date, source）
   c. 调用 `list_all_docs` 获取已配置的分类
   d. 分析内容，提议：分类（基于配置中的描述）、输出路径、tags
   e. 调用 `find_related_docs` 查找相关已有文档
   f. 在正文合适位置插入 `[[wikilink]]`
   g. **向用户展示提议：**
      - 输出路径、分类、tags
      - 关联文档列表
      - **如果是 --dry-run：到此为止，不写文件**
   h. 用户确认后：
      - 调用 `write_doc` 写入 MD
      - 调用 `mark_processed` 归档原文 + 更新状态（事务化）
        - **如果归档失败**（如 Obsidian 占用），提示用户关闭文件后重试，state 不会污染
      - 调用 `update_wikilinks` 更新被引用文档的关联

## Dry-run 流程

`--dry-run` 模式下：
- 完整执行 a-g 步骤（含图片提取到 assets/）
- **跳过** write_doc / mark_processed / update_wikilinks
- 输出"将要做什么"的预览（路径、分类、字数、链接数）
- 用户可基于预览决定是否真的导入（不带 --dry-run 重跑）

## 撤销

如果导入结果不理想，运行 `/wiki-undo <文件名>` 完整回滚。

## 注意事项

- 分类由 `docs/.wiki/config.json` 决定，首次使用请运行 `/wiki-init` 配置
- 大文档自动分块处理，避免 context 溢出
- 转换失败时跳过该文件，继续处理下一个
- 若用户拒绝某个提议，询问修改意见后重新生成
