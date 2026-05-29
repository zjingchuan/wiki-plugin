import test from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { isMermaidAvailable, renderMermaidToPng } from "../mermaid.js";
test("isMermaidAvailable returns boolean", () => {
    const result = isMermaidAvailable();
    assert.strictEqual(typeof result, "boolean");
});
test("renderMermaidToPng generates PNG when mermaid-cli is available", async () => {
    if (!isMermaidAvailable()) {
        return; // skip if not installed
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mmd-test-"));
    try {
        const code = `flowchart TD
A-->B`;
        const pngPath = await renderMermaidToPng(code, tmpDir);
        assert.ok(fs.existsSync(pngPath), "PNG file should exist");
        assert.ok(pngPath.endsWith(".png"));
    }
    finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
test("renderMermaidToPng caches result for same code", async () => {
    if (!isMermaidAvailable()) {
        return;
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mmd-test-"));
    try {
        const code = `flowchart LR
X-->Y`;
        const path1 = await renderMermaidToPng(code, tmpDir);
        const path2 = await renderMermaidToPng(code, tmpDir);
        assert.strictEqual(path1, path2);
    }
    finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
