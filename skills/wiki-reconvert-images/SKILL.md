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
