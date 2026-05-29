import * as fs from "fs";
import * as path from "path";
import { z } from "zod/v4";
import { resolveFromRoot, DOCS_DIR } from "../../lib/paths.js";
import { convertBatch, isEmfFile } from "../../lib/emf-converter.js";
export function findEmfFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir))
        return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findEmfFiles(full));
        }
        else if (isEmfFile(entry.name)) {
            results.push(full);
        }
    }
    return results;
}
export function findMdFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir))
        return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== ".wiki") {
            results.push(...findMdFiles(full));
        }
        else if (entry.name.endsWith(".md")) {
            results.push(full);
        }
    }
    return results;
}
export function registerReconvertImages(server, rootDir) {
    server.registerTool("reconvert_images", {
        description: "批量转换 docs/ 下残留的 EMF/WMF 图片为 SVG，并替换 markdown 中的引用",
        inputSchema: z.object({
            scope: z.string().optional().describe("可选：相对于 docs/ 的路径前缀，限定扫描范围"),
        }),
    }, async ({ scope }) => {
        const docsDir = resolveFromRoot(rootDir, DOCS_DIR);
        const assetsDir = path.join(docsDir, "assets");
        // Determine scan scope
        let emfFiles;
        if (scope) {
            const scopeDir = path.resolve(docsDir, scope);
            const docsResolved = path.resolve(docsDir);
            if (!scopeDir.startsWith(docsResolved + path.sep) &&
                scopeDir !== docsResolved) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ error: "scope 必须在 docs/ 目录下" }),
                        },
                    ],
                };
            }
            emfFiles = findEmfFiles(scopeDir);
        }
        else {
            emfFiles = findEmfFiles(assetsDir);
        }
        if (emfFiles.length === 0) {
            return { content: [{ type: "text", text: JSON.stringify({ total: 0, message: "未找到 EMF/WMF 文件" }) }] };
        }
        const report = await convertBatch(emfFiles, { rootDir });
        // Replace references in markdown files
        let mdFilesModified = 0;
        if (report.succeeded > 0) {
            const mdFiles = findMdFiles(docsDir);
            const commentRegex = /\n<!-- ⚠️ EMF 矢量图未转换：.*?补转。 -->/gs;
            for (const mdFile of mdFiles) {
                let content = fs.readFileSync(mdFile, "utf-8");
                let modified = false;
                for (const r of report.results) {
                    if (!r.success || !r.output)
                        continue;
                    const srcBase = path.basename(r.source);
                    const dstBase = path.basename(r.output);
                    const escaped = srcBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    const regex = new RegExp(`!\\[\\[${escaped}\\]\\]`, "g");
                    if (regex.test(content)) {
                        regex.lastIndex = 0;
                        content = content.replace(regex, `![[${dstBase}]]`);
                        modified = true;
                    }
                }
                if (modified) {
                    content = content.replace(commentRegex, "");
                    fs.writeFileSync(mdFile, content, "utf-8");
                    mdFilesModified++;
                }
            }
            // Delete original EMF files that were successfully converted
            for (const r of report.results) {
                if (r.success && fs.existsSync(r.source)) {
                    fs.unlinkSync(r.source);
                }
            }
        }
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        total: report.total,
                        succeeded: report.succeeded,
                        failed: report.failed,
                        fromCache: report.fromCache,
                        toolUsed: report.toolUsed,
                        mdFilesModified,
                        setupHint: report.setupHint,
                    }),
                }],
        };
    });
}
