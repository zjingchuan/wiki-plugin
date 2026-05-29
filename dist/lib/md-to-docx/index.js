import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { marked } from "marked";
import { Document, Packer, Paragraph, PageBreak, HeadingLevel, TextRun } from "docx";
import { imageSize } from "image-size";
import { STYLES, PAGE } from "./styles.js";
import { isMermaidAvailable, renderMermaidToPng } from "./mermaid.js";
import { stripFrontmatter, normalizeWikilinks, extractMermaidBlocks } from "./preprocess.js";
import { tokensToDocxBlocks } from "./parser.js";
import { resolveFromRoot, DOCS_DIR, ensureDir } from "../paths.js";
export async function convertToDocx(options) {
    const { rootDir, inputs, mode } = options;
    const warnings = [];
    const files = [];
    const exportsDir = resolveFromRoot(rootDir, DOCS_DIR, "exports");
    ensureDir(exportsDir);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-docx-"));
    try {
        const processed = [];
        for (const input of inputs) {
            const doc = await processMarkdownFile(rootDir, input, tempDir);
            warnings.push(...doc.warnings);
            processed.push(doc);
        }
        if (mode === "single") {
            for (const doc of processed) {
                const outputPath = await buildDocx(doc, exportsDir, 0);
                files.push(path.relative(rootDir, outputPath).replace(/\\/g, "/"));
            }
        }
        else {
            const outputPath = await buildMergedDocx(processed, exportsDir, options.output);
            files.push(path.relative(rootDir, outputPath).replace(/\\/g, "/"));
        }
        return { success: true, files, warnings };
    }
    catch (err) {
        warnings.push(`转换失败: ${err instanceof Error ? err.message : String(err)}`);
        return { success: false, files, warnings };
    }
    finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}
async function processMarkdownFile(rootDir, input, tempDir) {
    const warnings = [];
    const mdPath = resolveFromRoot(rootDir, DOCS_DIR, input);
    const mdFileDir = path.dirname(mdPath);
    const content = fs.readFileSync(mdPath, "utf-8");
    // Extract title from frontmatter
    const title = extractTitle(content, input);
    // Pipeline
    const stripped = stripFrontmatter(content);
    const normalized = normalizeWikilinks(stripped);
    const { text, blocks } = extractMermaidBlocks(normalized);
    // Render mermaid blocks
    const mermaidImages = new Map();
    for (const block of blocks) {
        if (isMermaidAvailable()) {
            try {
                const pngPath = await renderMermaidToPng(block.code, tempDir);
                mermaidImages.set(block.index, pngPath);
            }
            catch (err) {
                warnings.push(`Mermaid 渲染失败 (block ${block.index}): ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        else {
            warnings.push(`Mermaid CLI 未安装，跳过图表渲染 (block ${block.index})`);
        }
    }
    // Restore placeholders
    const processedText = restoreMermaidPlaceholders(text, blocks, mermaidImages);
    // Parse
    const tokens = marked.lexer(processedText);
    return { title, tokens, mermaidImages, mdFileDir, warnings };
}
function extractTitle(content, input) {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
        const titleMatch = fmMatch[1].match(/^title:\s*(.+)$/m);
        if (titleMatch)
            return titleMatch[1].trim();
    }
    return path.basename(input, path.extname(input));
}
function restoreMermaidPlaceholders(text, blocks, mermaidImages) {
    let result = text;
    for (const block of blocks) {
        const placeholder = `<!--MERMAID_PLACEHOLDER_${block.index}-->`;
        if (mermaidImages.has(block.index)) {
            result = result.replace(placeholder, `![mermaid](MERMAID_IMG::${block.index})`);
        }
        else {
            result = result.replace(placeholder, "```\n" + block.code + "\n```");
        }
    }
    return result;
}
function createImageResolver(rootDir, mdFileDir, mermaidImages) {
    return (href) => {
        // Handle mermaid image markers
        const mermaidMatch = href.match(/^MERMAID_IMG::(\d+)$/);
        if (mermaidMatch) {
            const idx = parseInt(mermaidMatch[1], 10);
            const pngPath = mermaidImages.get(idx);
            if (!pngPath || !fs.existsSync(pngPath))
                return null;
            const buffer = fs.readFileSync(pngPath);
            const dims = imageSize(buffer);
            return {
                path: pngPath,
                buffer,
                width: dims.width ?? 400,
                height: dims.height ?? 300,
            };
        }
        // Regular image resolution
        const candidates = [
            path.resolve(mdFileDir, href),
            resolveFromRoot(rootDir, DOCS_DIR, "assets", href),
            resolveFromRoot(rootDir, DOCS_DIR, href),
        ];
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                const buffer = fs.readFileSync(candidate);
                const dims = imageSize(buffer);
                return {
                    path: candidate,
                    buffer,
                    width: dims.width ?? 400,
                    height: dims.height ?? 300,
                };
            }
        }
        return null;
    };
}
async function buildDocx(doc, exportsDir, headingOffset) {
    const ctx = {
        imageBaseDir: doc.mdFileDir,
        imageResolver: createImageResolver(path.resolve(exportsDir, "..", ".."), doc.mdFileDir, doc.mermaidImages),
        warnings: doc.warnings,
        headingOffset,
    };
    const children = tokensToDocxBlocks(doc.tokens, ctx);
    const document = new Document({
        styles: STYLES,
        sections: [{
                properties: {
                    page: {
                        margin: {
                            top: PAGE.marginTop,
                            bottom: PAGE.marginBottom,
                            left: PAGE.marginLeft,
                            right: PAGE.marginRight,
                        },
                    },
                },
                children,
            }],
    });
    const outputName = sanitizeFilename(doc.title);
    const outputPath = uniquePath(exportsDir, outputName, ".docx");
    const buffer = await Packer.toBuffer(document);
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    return outputPath;
}
async function buildMergedDocx(docs, exportsDir, outputName) {
    const allChildren = [];
    const rootDir = path.resolve(exportsDir, "..", "..");
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        // Page break before each doc (except first)
        if (i > 0) {
            allChildren.push(new Paragraph({ children: [new PageBreak()] }));
        }
        // Insert H1 title for each doc
        allChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: doc.title })],
        }));
        const ctx = {
            imageBaseDir: doc.mdFileDir,
            imageResolver: createImageResolver(rootDir, doc.mdFileDir, doc.mermaidImages),
            warnings: doc.warnings,
            headingOffset: 1,
        };
        const children = tokensToDocxBlocks(doc.tokens, ctx);
        allChildren.push(...children);
    }
    const document = new Document({
        styles: STYLES,
        sections: [{
                properties: {
                    page: {
                        margin: {
                            top: PAGE.marginTop,
                            bottom: PAGE.marginBottom,
                            left: PAGE.marginLeft,
                            right: PAGE.marginRight,
                        },
                    },
                },
                children: allChildren,
            }],
    });
    const name = outputName || `导出_${formatTimestamp()}`;
    const outputPath = uniquePath(exportsDir, sanitizeFilename(name), ".docx");
    const buffer = await Packer.toBuffer(document);
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    return outputPath;
}
function formatTimestamp() {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    return `${y}${mo}${d}-${h}${mi}${s}`;
}
function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]/g, "_").trim() || "untitled";
}
function uniquePath(dir, name, ext) {
    const candidate = path.join(dir, `${name}${ext}`);
    if (!fs.existsSync(candidate))
        return candidate;
    const ts = formatTimestamp();
    return path.join(dir, `${name}_${ts}${ext}`);
}
