# Changelog

## [0.5.1] - 2026-05-28

### Fixed
- docx 表格转换：启用 turndown-plugin-gfm，并新增自定义规则处理无 thead 的表格（mammoth 输出的多数表格无 thead 标签）
- 真实文档验证：145 个表格从 0 转换成功 → 145 全部转换成功，0 个 HTML 残留

## [0.5.0] - 2026-05-28

### Added
- `/wiki-reconvert-images` command to batch convert EMF/WMF images to SVG
- Automatic EMF/WMF → SVG conversion during `/wiki-import` (requires LibreOffice or ImageMagick)
- Conversion result cache at `docs/.wiki/emf-cache/` (sha256 keyed, gitignored)
- Setup hint with install link when no conversion tool detected
- Path validation to block null bytes and directory traversal
- Empty file detection in conversion pipeline

### Changed
- `read_raw_file` returns `imagesConverted`, `imagesFailedConvert`, `imagesFromCache`, `toolUsed`, `setupHint` fields

## [0.3.0] - 2026-05-15

### Added
- `/wiki-init` command for configurable document categories
- `/wiki-undo` command to reverse a wiki-import
- `/wiki-import --dry-run` preview mode
- Large document chunked processing (`chunkBy` parameter)
- TF-IDF based semantic search for related documents
- Unified error types and file logger (`docs/.wiki/logs/`)
- Operation history audit log (`docs/.wiki/history.json`)
- Auto-update `word_count` and `updated` metadata on reindex
- CI/CD with GitHub Actions
- ESLint and Prettier configs

### Changed
- Categories now configurable via `docs/.wiki/config.json` (was hardcoded)
- `mark_processed` is now transactional (archive-first, handles locked files)
- xlsx conversion uses `sheet_to_html` for better table preservation
- `find_related_docs` uses TF-IDF cosine similarity instead of substring matching
- Wikilink extraction handles `[[target|alias]]` and path segments correctly

## [0.2.0] - 2026-05-14

### Added
- `/wiki-export` command for Markdown to Word (.docx) export
- Single-file and merged export modes
- Mermaid diagram rendering to PNG (optional mermaid-cli)
- Chinese-friendly Word styles (Microsoft YaHei, table borders, code blocks)
- Image embedding with proportional scaling
- Wikilink to plain text conversion in exports

## [0.1.0] - 2026-05-14

### Added
- Initial release
- Word/Excel/PDF to Markdown conversion
- Smart categorization (产品/技术/运维)
- Obsidian-compatible wikilinks
- Image extraction from Word documents
- Session-start hook for pending file detection
- MCP tools: list_pending, read_raw_file, write_doc, mark_processed, find_related, list_all_docs, update_wikilinks, rebuild_index
