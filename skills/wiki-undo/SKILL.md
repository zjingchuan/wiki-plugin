---
name: wiki-undo
description: 撤销一次 /wiki-import 的处理结果，把原始文件移回 raw 目录、删除生成的 MD 和图片
---

# /wiki-undo

如果 /wiki-import 的结果不理想（分类错误、内容缺失等），用此命令完整回滚。

## 使用方式

- `/wiki-undo <文件名>` — 撤销指定原始文件的处理
- `/wiki-undo` — 列出可撤销的文件让用户选

## 处理流程

1. 读取 docs/.wiki/state.json 列出所有已处理的原始文件
2. 让用户确认要撤销哪个
3. 调用 `unprocess_doc`：
   - 删除生成的 MD 文件
   - 删除关联的 assets 子目录
   - 把原始文件从 archive 移回 raw
   - 清理 state.json 记录
4. 报告所有执行的动作和 warnings

## 注意

- 撤销后该文件会重新出现在 raw/ 中，下次 /wiki-import 会再次提示
- 撤销不可再撤销 — MD 文件被永久删除
- 如果原文件已被外部修改（hash 变了），仍会撤销 state 记录
