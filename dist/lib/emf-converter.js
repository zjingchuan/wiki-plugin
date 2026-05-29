import * as path from "path";
import { execFileSync, execFile } from "child_process";
import * as fs from "fs";
import * as crypto from "crypto";
import { resolveFromRoot, WIKI_DIR, ensureDir } from "./paths.js";
function validatePath(filePath) {
    const normalized = path.normalize(filePath);
    if (normalized.includes('\0')) {
        throw new Error('Invalid file path: null byte detected');
    }
    // Allow relative paths but block suspicious patterns
    if (normalized.includes('..') && !path.isAbsolute(filePath)) {
        throw new Error('Invalid file path: directory traversal detected');
    }
}
export const SETUP_HINT = `未检测到 LibreOffice 或 ImageMagick。\nObsidian 无法直接渲染 EMF/WMF 矢量图。\n建议安装 LibreOffice（推荐）：https://www.libreoffice.org/download/\n安装后运行 /wiki-reconvert-images 补转所有未渲染的图。`;
const EMF_CACHE_DIR = path.join(WIKI_DIR, "emf-cache");
let cachedTool = null;
export function resetToolCache() {
    cachedTool = null;
}
/** Check if a binary exists on PATH by running `which` / `where`. */
function whichSync(bin) {
    try {
        const cmd = process.platform === "win32" ? "where" : "which";
        const result = execFileSync(cmd, [bin], {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        });
        // Windows `where` searches CWD before PATH, so a file named e.g. `soffice`
        // (no extension) dropped in CWD would shadow the real executable. Filter
        // to `.exe` results to avoid path-hijacking via CWD.
        const lines = result
            .trim()
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        const found = process.platform === "win32"
            ? lines.find((l) => l.toLowerCase().endsWith(".exe"))
            : lines[0];
        return found ?? null;
    }
    catch {
        return null;
    }
}
function findSoffice() {
    const platform = process.platform;
    if (platform === "win32") {
        const candidates = [
            "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
            "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
        ];
        for (const p of candidates) {
            if (fs.existsSync(p))
                return p;
        }
        return whichSync("soffice");
    }
    if (platform === "darwin") {
        const macPath = "/Applications/LibreOffice.app/Contents/MacOS/soffice";
        if (fs.existsSync(macPath))
            return macPath;
        return whichSync("soffice");
    }
    // Linux and others
    return whichSync("soffice");
}
function findMagick() {
    // Try ImageMagick v7 first
    const magick = whichSync("magick");
    if (magick)
        return magick;
    // v6 `convert` — skip on Windows (system convert.exe)
    if (process.platform !== "win32") {
        const convert = whichSync("convert");
        if (convert)
            return convert;
    }
    return null;
}
export function detectTool() {
    if (cachedTool)
        return cachedTool;
    const soffice = findSoffice();
    if (soffice) {
        cachedTool = { kind: "soffice", path: soffice };
        return cachedTool;
    }
    const magick = findMagick();
    if (magick) {
        cachedTool = { kind: "magick", path: magick };
        return cachedTool;
    }
    cachedTool = { kind: "none" };
    return cachedTool;
}
export function isEmfFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return [".x-emf", ".emf", ".wmf", ".x-wmf"].includes(ext);
}
// ============================================================================
// Helper functions for convertBatch
// ============================================================================
function computeHash(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
}
function getCacheDir(rootDir) {
    return resolveFromRoot(rootDir, EMF_CACHE_DIR);
}
function getCachePath(rootDir, hash) {
    return path.join(getCacheDir(rootDir), `${hash}.svg`);
}
function runSoffice(sofficePath, items, outDir, timeoutMs) {
    return new Promise((resolve) => {
        try {
            // Copy inputs to outDir with clean .emf extension to avoid soffice's
            // greedy extension stripping (e.g., "x.x-emf" -> "x.x.svg")
            const stagedInputs = [];
            for (const item of items) {
                const stagedPath = path.join(outDir, `${item.hash}.emf`);
                fs.copyFileSync(item.source, stagedPath);
                stagedInputs.push(stagedPath);
            }
            const args = [
                "--headless",
                "--convert-to",
                "svg",
                "--outdir",
                outDir,
                ...stagedInputs,
            ];
            execFile(sofficePath, args, { timeout: timeoutMs }, (error) => {
                if (error) {
                    resolve({ error: error.message });
                }
                else {
                    resolve({});
                }
            });
        }
        catch (e) {
            resolve({ error: e.message });
        }
    });
}
function runMagick(magickPath, items, outDir, timeoutMs) {
    const promises = items.map((item) => {
        return new Promise((resolve, reject) => {
            const basename = path.basename(item.source, path.extname(item.source));
            const outFile = path.join(outDir, `${basename}.svg`);
            const args = ["convert", item.source, outFile];
            execFile(magickPath, args, { timeout: timeoutMs }, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    });
    return Promise.all(promises)
        .then(() => ({}))
        .catch((error) => ({ error: error.message }));
}
// ============================================================================
// Main convertBatch function
// ============================================================================
export async function convertBatch(emfPaths, options) {
    const timeoutMs = options.timeoutMs ?? 60000;
    const results = [];
    let fromCacheCount = 0;
    // Empty input fast path
    if (emfPaths.length === 0) {
        return {
            total: 0,
            succeeded: 0,
            failed: 0,
            fromCache: 0,
            toolUsed: "none",
            results: [],
        };
    }
    // Cache directory setup
    const cacheDir = getCacheDir(options.rootDir);
    ensureDir(cacheDir);
    // Phase 1 — Cache check & validation
    const toConvert = [];
    for (const source of emfPaths) {
        validatePath(source);
        if (!fs.existsSync(source)) {
            results.push({ source, success: false, error: "文件不存在" });
            continue;
        }
        const stats = fs.statSync(source);
        if (stats.size === 0) {
            results.push({ source, success: false, error: "文件为空" });
            continue;
        }
        const hash = computeHash(source);
        const cachePath = getCachePath(options.rootDir, hash);
        const ext = path.extname(source);
        const targetSvg = source.slice(0, -ext.length) + ".svg";
        if (fs.existsSync(cachePath)) {
            // Cache hit
            try {
                fs.copyFileSync(cachePath, targetSvg);
                results.push({
                    source,
                    success: true,
                    output: targetSvg,
                    fromCache: true,
                });
                fromCacheCount++;
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                results.push({
                    source,
                    success: false,
                    error: `缓存读取失败: ${message}`,
                });
            }
        }
        else {
            // Cache miss
            toConvert.push({ source, targetSvg, hash });
        }
    }
    // Phase 2 — Tool detection
    const tool = detectTool();
    if (toConvert.length === 0) {
        // All hits or all errors
        return {
            total: emfPaths.length,
            succeeded: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            fromCache: fromCacheCount,
            toolUsed: tool.kind,
            setupHint: tool.kind === "none" ? SETUP_HINT : undefined,
            results,
        };
    }
    if (tool.kind === "none") {
        // No tool available
        for (const item of toConvert) {
            results.push({
                source: item.source,
                success: false,
                error: "未检测到 LibreOffice/ImageMagick",
            });
        }
        return {
            total: emfPaths.length,
            succeeded: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            fromCache: fromCacheCount,
            toolUsed: "none",
            setupHint: SETUP_HINT,
            results,
        };
    }
    // Phase 3 — Conversion
    const tmpOutDir = path.join(cacheDir, `_tmp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`);
    ensureDir(tmpOutDir);
    try {
        let convertResults;
        if (tool.kind === "soffice") {
            convertResults = await runSoffice(tool.path, toConvert.map((item) => ({ source: item.source, hash: item.hash })), tmpOutDir, timeoutMs);
        }
        else {
            // magick
            convertResults = await runMagick(tool.path, toConvert, tmpOutDir, timeoutMs);
        }
        // Process conversion results
        for (const item of toConvert) {
            // soffice writes <hash>.svg (we stage inputs as <hash>.emf to avoid
            // greedy extension stripping); magick writes <basename>.svg
            const tmpSvg = tool.kind === "soffice"
                ? path.join(tmpOutDir, `${item.hash}.svg`)
                : path.join(tmpOutDir, path.basename(item.source, path.extname(item.source)) + ".svg");
            if (fs.existsSync(tmpSvg)) {
                // Conversion succeeded
                try {
                    fs.copyFileSync(tmpSvg, item.targetSvg);
                    // Try to cache (non-blocking)
                    try {
                        const cachePath = getCachePath(options.rootDir, item.hash);
                        fs.copyFileSync(tmpSvg, cachePath);
                    }
                    catch (cacheErr) {
                        console.warn(`[emf-converter] Cache write failed for ${item.hash}: ${cacheErr.message}`);
                    }
                    results.push({
                        source: item.source,
                        success: true,
                        output: item.targetSvg,
                        fromCache: false,
                    });
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    results.push({
                        source: item.source,
                        success: false,
                        error: `文件写入失败: ${message}`,
                    });
                }
            }
            else {
                // Conversion failed
                results.push({
                    source: item.source,
                    success: false,
                    error: convertResults.error || "转换失败：未生成 SVG",
                });
            }
            options.onProgress?.(results.length, emfPaths.length);
        }
    }
    finally {
        fs.rmSync(tmpOutDir, { recursive: true, force: true });
    }
    // Final report
    return {
        total: emfPaths.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        fromCache: fromCacheCount,
        toolUsed: tool.kind,
        setupHint: undefined,
        results,
    };
}
