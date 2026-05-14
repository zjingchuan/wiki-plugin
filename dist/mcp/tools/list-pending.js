import * as fs from "fs";
import * as path from "path";
import { z } from "zod/v4";
import { resolveFromRoot, RAW_DIR, isRawFile, getRelativePath } from "../../lib/paths.js";
import { readState, computeFileHash, isProcessed } from "../../lib/state.js";
export function registerListPending(server, rootDir) {
    server.registerTool("list_pending_files", {
        description: "列出 docs/raw/ 下未处理的原始文件",
        inputSchema: z.object({}),
    }, async () => {
        const rawDir = resolveFromRoot(rootDir, RAW_DIR);
        if (!fs.existsSync(rawDir)) {
            return { content: [{ type: "text", text: JSON.stringify({ files: [] }) }] };
        }
        const state = readState(rootDir);
        const files = [];
        const entries = fs.readdirSync(rawDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory())
                continue;
            const fullPath = path.join(rawDir, entry.name);
            if (!isRawFile(fullPath))
                continue;
            const relPath = getRelativePath(resolveFromRoot(rootDir, "docs"), fullPath);
            const hash = computeFileHash(fullPath);
            if (isProcessed(state, relPath, hash))
                continue;
            const stat = fs.statSync(fullPath);
            files.push({
                path: relPath,
                ext: path.extname(entry.name).toLowerCase(),
                size: stat.size,
                mtime: stat.mtime.toISOString(),
            });
        }
        return { content: [{ type: "text", text: JSON.stringify({ files }) }] };
    });
}
