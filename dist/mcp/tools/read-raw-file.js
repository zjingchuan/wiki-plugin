import * as fs from "fs";
import * as path from "path";
import { z } from "zod/v4";
import { resolveFromRoot, DOCS_DIR, ensureDir } from "../../lib/paths.js";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import TurndownService from "turndown";
import { tables as gfmTables } from "turndown-plugin-gfm";
import { convertBatch, isEmfFile } from "../../lib/emf-converter.js";
const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
});
turndown.use(gfmTables);
// Custom rule: convert tables without <thead> by treating first row as header
turndown.addRule("table-without-thead", {
    filter(node) {
        return (node.nodeName === "TABLE" && !node.querySelector("thead"));
    },
    replacement(_content, node) {
        const tableEl = node;
        const rows = tableEl.querySelectorAll("tr");
        if (rows.length === 0)
            return "";
        const getCells = (tr) => {
            const cells = tr.querySelectorAll("td, th");
            const result = [];
            for (let i = 0; i < cells.length; i++) {
                let text = cells[i].innerHTML
                    .replace(/<br\s*\/?>/gi, " ")
                    .replace(/<[^>]+>/g, "")
                    .replace(/\|/g, "\\|")
                    .replace(/\n/g, " ")
                    .trim();
                result.push(text);
            }
            return result;
        };
        const headerCells = getCells(rows[0]);
        if (headerCells.length === 0)
            return "";
        const lines = [];
        lines.push("| " + headerCells.join(" | ") + " |");
        lines.push("| " + headerCells.map(() => "---").join(" | ") + " |");
        for (let i = 1; i < rows.length; i++) {
            const cells = getCells(rows[i]);
            while (cells.length < headerCells.length)
                cells.push("");
            lines.push("| " + cells.slice(0, headerCells.length).join(" | ") + " |");
        }
        return "\n\n" + lines.join("\n") + "\n\n";
    },
});
export function registerReadRawFile(server, rootDir) {
    server.registerTool("read_raw_file", {
        description: "读取 docs/raw/ 下的原始文件，提取为 Markdown（含图片提取）",
        inputSchema: z.object({
            path: z.string().describe("相对于 docs/ 的文件路径，如 raw/xxx.docx"),
            chunkBy: z.enum(["none", "h1", "h2"]).optional().describe("分块策略：none=整篇返回（默认），h1/h2=按标题分块"),
        }),
    }, async ({ path: relPath, chunkBy }) => {
        const fullPath = resolveFromRoot(rootDir, "docs", relPath);
        if (!fs.existsSync(fullPath)) {
            return { content: [{ type: "text", text: JSON.stringify({ error: "文件不存在" }) }] };
        }
        const ext = path.extname(fullPath).toLowerCase();
        const filename = path.basename(fullPath);
        const filenameNoExt = path.basename(fullPath, ext);
        const stat = fs.statSync(fullPath);
        try {
            let extractedText = "";
            const images = [];
            let imagesConverted = 0;
            let imagesFailedConvert = 0;
            let imagesFromCache = 0;
            let toolUsed = "none";
            let setupHint;
            if (ext === ".docx" || ext === ".doc") {
                const assetsDir = resolveFromRoot(rootDir, DOCS_DIR, "assets", filenameNoExt);
                ensureDir(assetsDir);
                let imgIndex = 0;
                const emfQueue = [];
                const result = await mammoth.convertToHtml({ path: fullPath }, {
                    convertImage: mammoth.images.imgElement(async (image) => {
                        imgIndex++;
                        const imgExt = image.contentType.split("/")[1] || "png";
                        const imgName = `${filenameNoExt}_${String(imgIndex).padStart(3, "0")}.${imgExt}`;
                        const imgPath = path.join(assetsDir, imgName);
                        const buffer = await image.read();
                        fs.writeFileSync(imgPath, buffer);
                        images.push(imgName);
                        if (isEmfFile(imgName)) {
                            emfQueue.push(imgPath);
                        }
                        return { src: `OBSIDIAN_WIKILINK::${imgName}` };
                    }),
                });
                let html = result.value;
                extractedText = turndown.turndown(html);
                extractedText = extractedText.replace(/!\[[^\]]*\]\(OBSIDIAN_WIKILINK::([^)]+)\)/g, (_match, name) => `![[${name}]]`);
                // EMF/WMF batch conversion
                if (emfQueue.length > 0) {
                    const report = await convertBatch(emfQueue, { rootDir });
                    toolUsed = report.toolUsed;
                    setupHint = report.setupHint;
                    imagesConverted = report.succeeded;
                    imagesFailedConvert = report.failed;
                    imagesFromCache = report.fromCache;
                    for (const r of report.results) {
                        const srcBase = path.basename(r.source);
                        if (r.success && r.output) {
                            const dstBase = path.basename(r.output);
                            const escaped = srcBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                            extractedText = extractedText.replace(new RegExp(`!\\[\\[${escaped}\\]\\]`, "g"), `![[${dstBase}]]`);
                            try {
                                fs.unlinkSync(r.source);
                            }
                            catch { }
                        }
                        else {
                            const escaped = srcBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                            const comment = `<!-- ⚠️ EMF 矢量图未转换：${r.error}。安装 LibreOffice 后运行 /wiki-reconvert-images 补转。 -->`;
                            extractedText = extractedText.replace(new RegExp(`(!\\[\\[${escaped}\\]\\])`, "g"), `$1\n${comment}`);
                        }
                    }
                }
                if (result.messages.length > 0) {
                    const warnings = result.messages
                        .filter((m) => m.type === "warning")
                        .map((m) => m.message);
                    if (warnings.length > 0) {
                        extractedText += "\n\n<!-- 转换警告: " + warnings.join("; ") + " -->";
                    }
                }
            }
            else if (ext === ".xlsx" || ext === ".xls") {
                const buffer = fs.readFileSync(fullPath);
                const workbook = XLSX.read(buffer);
                const sheets = [];
                for (const sheetName of workbook.SheetNames) {
                    const sheet = workbook.Sheets[sheetName];
                    const html = XLSX.utils.sheet_to_html(sheet, { id: sheetName });
                    const md = turndown.turndown(html);
                    sheets.push(`## Sheet: ${sheetName}\n\n${md}`);
                }
                extractedText = sheets.join("\n\n---\n\n");
            }
            else if (ext === ".pdf") {
                const { PDFParse } = await import("pdf-parse");
                const buffer = fs.readFileSync(fullPath);
                const pdf = new PDFParse({ data: new Uint8Array(buffer) });
                const result = await pdf.getText();
                extractedText = result.text;
            }
            else {
                extractedText = fs.readFileSync(fullPath, "utf-8");
            }
            const mode = chunkBy ?? "none";
            if (mode === "none") {
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                filename,
                                ext,
                                size: stat.size,
                                images: images.length,
                                imagesConverted,
                                imagesFailedConvert,
                                imagesFromCache,
                                toolUsed,
                                setupHint,
                                content: extractedText,
                            }),
                        }],
                };
            }
            const chunks = splitByHeading(extractedText, mode);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            filename,
                            ext,
                            size: stat.size,
                            images: images.length,
                            imagesConverted,
                            imagesFailedConvert,
                            imagesFromCache,
                            toolUsed,
                            setupHint,
                            chunked: true,
                            chunks,
                        }),
                    }],
            };
        }
        catch (err) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            filename,
                            ext,
                            size: stat.size,
                            error: `提取失败: ${err.message}`,
                        }),
                    }],
            };
        }
    });
}
function splitByHeading(md, level) {
    const headingRegex = level === "h1" ? /^# (.+)$/ : /^## (.+)$/;
    const lines = md.split("\n");
    const chunks = [];
    let currentTitle = "前言";
    let currentLines = [];
    for (const line of lines) {
        const m = line.match(headingRegex);
        if (m) {
            if (currentLines.length > 0 || currentTitle !== "前言") {
                chunks.push({ title: currentTitle, content: currentLines.join("\n").trim() });
            }
            currentTitle = m[1].trim();
            currentLines = [];
        }
        else {
            currentLines.push(line);
        }
    }
    if (currentLines.length > 0 || chunks.length === 0) {
        chunks.push({ title: currentTitle, content: currentLines.join("\n").trim() });
    }
    return chunks.filter((c) => c.content.length > 0);
}
