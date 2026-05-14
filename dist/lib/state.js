import * as fs from "fs";
import * as crypto from "crypto";
import { resolveFromRoot, ensureDir, STATE_FILE, WIKI_DIR } from "./paths.js";
function defaultState() {
    return { version: 1, processed: {} };
}
export function readState(rootDir) {
    const filePath = resolveFromRoot(rootDir, STATE_FILE);
    if (!fs.existsSync(filePath))
        return defaultState();
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
}
export function writeState(rootDir, state) {
    const filePath = resolveFromRoot(rootDir, STATE_FILE);
    ensureDir(resolveFromRoot(rootDir, WIKI_DIR));
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}
export function computeFileHash(filePath) {
    const content = fs.readFileSync(filePath);
    return "sha256:" + crypto.createHash("sha256").update(content).digest("hex");
}
export function isProcessed(state, rawRelPath, hash) {
    const entry = state.processed[rawRelPath];
    return !!entry && entry.hash === hash;
}
export function markProcessed(state, rawRelPath, hash, outputs) {
    return {
        ...state,
        processed: {
            ...state.processed,
            [rawRelPath]: {
                hash,
                outputs,
                processedAt: new Date().toISOString(),
            },
        },
    };
}
