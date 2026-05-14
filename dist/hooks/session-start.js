import * as fs from "fs";
import * as path from "path";
import { resolveFromRoot, RAW_DIR, isRawFile } from "../lib/paths.js";
import { readState, computeFileHash, isProcessed } from "../lib/state.js";
import { getRelativePath } from "../lib/paths.js";
const rootDir = process.cwd();
const rawDir = resolveFromRoot(rootDir, RAW_DIR);
if (fs.existsSync(rawDir)) {
    const state = readState(rootDir);
    const pending = [];
    const entries = fs.readdirSync(rawDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory())
            continue;
        const fullPath = path.join(rawDir, entry.name);
        if (!isRawFile(fullPath))
            continue;
        const relPath = getRelativePath(resolveFromRoot(rootDir, "docs"), fullPath);
        const hash = computeFileHash(fullPath);
        if (!isProcessed(state, relPath, hash)) {
            pending.push(entry.name);
        }
    }
    if (pending.length > 0) {
        const fileList = pending.map((f) => `  - ${f}`).join("\n");
        const message = `检测到 ${pending.length} 个未处理的原始文件：\n${fileList}\n\n运行 /wiki-import 开始处理。`;
        // Hook output goes to stdout as JSON
        console.log(JSON.stringify({ message }));
    }
}
