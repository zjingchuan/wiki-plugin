import * as fs from "fs";
import * as path from "path";
import { resolveFromRoot, WIKI_DIR, ensureDir } from "./paths.js";
const LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
let currentLevel = "info";
let rootDir = null;
export function initLogger(root, level = "info") {
    rootDir = root;
    currentLevel = level;
}
export function log(level, message, meta) {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel])
        return;
    if (!rootDir)
        return;
    const logsDir = resolveFromRoot(rootDir, WIKI_DIR, "logs");
    ensureDir(logsDir);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 19);
    const logFile = path.join(logsDir, `${dateStr}.log`);
    const metaStr = meta ? " " + JSON.stringify(meta) : "";
    const line = `[${timeStr}] ${level.toUpperCase().padEnd(5)} ${message}${metaStr}\n`;
    fs.appendFileSync(logFile, line, "utf-8");
}
export const logger = {
    debug: (msg, meta) => log("debug", msg, meta),
    info: (msg, meta) => log("info", msg, meta),
    warn: (msg, meta) => log("warn", msg, meta),
    error: (msg, meta) => log("error", msg, meta),
};
