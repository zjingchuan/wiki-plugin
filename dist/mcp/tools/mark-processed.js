import * as fs from "fs";
import * as path from "path";
import { z } from "zod/v4";
import { resolveFromRoot, ARCHIVE_DIR, ensureDir } from "../../lib/paths.js";
import { readState, writeState, markProcessed as markEntry } from "../../lib/state.js";
import { logger } from "../../lib/logger.js";
import { appendHistory } from "../../lib/history.js";
export function archiveRawFile(rootDir, rawRelPath) {
    const srcFull = resolveFromRoot(rootDir, "docs", rawRelPath);
    if (!fs.existsSync(srcFull)) {
        return { ok: false, error: `源文件不存在: ${rawRelPath}` };
    }
    const archiveDir = resolveFromRoot(rootDir, ARCHIVE_DIR);
    ensureDir(archiveDir);
    const destFull = path.join(archiveDir, path.basename(srcFull));
    try {
        fs.renameSync(srcFull, destFull);
        logger.info("归档成功", { rawPath: rawRelPath, dest: destFull });
        return { ok: true, archivedPath: destFull };
    }
    catch (err) {
        if (err.code === "EXDEV" || err.code === "EPERM" || err.code === "EBUSY") {
            try {
                fs.copyFileSync(srcFull, destFull);
                fs.unlinkSync(srcFull);
                logger.info("归档成功（copy+delete）", { rawPath: rawRelPath });
                return { ok: true, archivedPath: destFull };
            }
            catch (e) {
                logger.error("归档失败", { rawPath: rawRelPath, error: e.message });
                return { ok: false, error: `归档失败（文件可能被占用）: ${e.message}` };
            }
        }
        logger.error("归档失败", { rawPath: rawRelPath, error: err.message });
        return { ok: false, error: `归档失败: ${err.message}` };
    }
}
export function registerMarkProcessed(server, rootDir) {
    server.registerTool("mark_processed", {
        description: "标记原始文件为已处理。先归档原文件，归档成功后再更新 state.json。归档失败时不会污染 state（事务性）",
        inputSchema: z.object({
            rawPath: z.string().describe("相对于 docs/ 的原始文件路径，如 raw/xxx.docx"),
            outputPath: z.string().describe("输出的 MD 文件路径，如 技术/接口设计/xxx.md"),
            hash: z.string().describe("原始文件的 sha256 hash"),
        }),
    }, async ({ rawPath, outputPath, hash }) => {
        const archiveResult = archiveRawFile(rootDir, rawPath);
        if (!archiveResult.ok) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            ok: false,
                            error: archiveResult.error,
                            hint: "如文件被 Obsidian/Word 占用，请关闭后重试",
                        }),
                    }],
            };
        }
        let state = readState(rootDir);
        state = markEntry(state, rawPath, hash, [outputPath]);
        writeState(rootDir, state);
        appendHistory(rootDir, "import", { rawPath, outputPath, hash });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({ ok: true, archivedPath: archiveResult.archivedPath }),
                }],
        };
    });
}
