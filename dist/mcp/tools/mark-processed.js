import * as fs from "fs";
import * as path from "path";
import { z } from "zod/v4";
import { resolveFromRoot, ARCHIVE_DIR, ensureDir } from "../../lib/paths.js";
import { readState, writeState, markProcessed as markEntry } from "../../lib/state.js";
export function registerMarkProcessed(server, rootDir) {
    server.registerTool("mark_processed", {
        description: "标记原始文件为已处理，移动到 archive/ 并更新 state.json",
        inputSchema: z.object({
            rawPath: z.string().describe("相对于 docs/ 的原始文件路径，如 raw/xxx.docx"),
            outputPath: z.string().describe("输出的 MD 文件路径，如 技术/接口设计/xxx.md"),
            hash: z.string().describe("原始文件的 sha256 hash"),
        }),
    }, async ({ rawPath, outputPath, hash }) => {
        let state = readState(rootDir);
        state = markEntry(state, rawPath, hash, [outputPath]);
        writeState(rootDir, state);
        const srcFull = resolveFromRoot(rootDir, "docs", rawPath);
        const archiveDir = resolveFromRoot(rootDir, ARCHIVE_DIR);
        ensureDir(archiveDir);
        const destFull = path.join(archiveDir, path.basename(srcFull));
        if (fs.existsSync(srcFull)) {
            fs.renameSync(srcFull, destFull);
        }
        return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
    });
}
