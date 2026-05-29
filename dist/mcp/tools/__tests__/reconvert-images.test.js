import test from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { findEmfFiles, findMdFiles } from "../reconvert-images.js";
test("findEmfFiles 在空目录返回空", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reconvert-test-"));
    try {
        const result = findEmfFiles(tmpDir);
        assert.deepStrictEqual(result, []);
    }
    finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
test("findEmfFiles 递归发现 .x-emf 和 .wmf 文件", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reconvert-test-"));
    try {
        const subDir = path.join(tmpDir, "sub");
        fs.mkdirSync(subDir);
        fs.writeFileSync(path.join(tmpDir, "a.x-emf"), "fake");
        fs.writeFileSync(path.join(subDir, "b.wmf"), "fake");
        fs.writeFileSync(path.join(subDir, "c.png"), "fake");
        const result = findEmfFiles(tmpDir);
        assert.strictEqual(result.length, 2);
        assert.ok(result.some(f => f.endsWith("a.x-emf")));
        assert.ok(result.some(f => f.endsWith("b.wmf")));
    }
    finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
test("findEmfFiles 不存在的目录返回空", () => {
    const result = findEmfFiles("/nonexistent/path/that/does/not/exist");
    assert.deepStrictEqual(result, []);
});
test("findMdFiles 递归发现 .md 文件但跳过 .wiki", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reconvert-test-"));
    try {
        fs.writeFileSync(path.join(tmpDir, "a.md"), "content");
        const subDir = path.join(tmpDir, "sub");
        fs.mkdirSync(subDir);
        fs.writeFileSync(path.join(subDir, "b.md"), "content");
        const wikiDir = path.join(tmpDir, ".wiki");
        fs.mkdirSync(wikiDir);
        fs.writeFileSync(path.join(wikiDir, "hidden.md"), "hidden");
        const result = findMdFiles(tmpDir);
        assert.strictEqual(result.length, 2);
        assert.ok(result.some(f => f.endsWith("a.md")));
        assert.ok(result.some(f => f.endsWith("b.md")));
        assert.ok(!result.some(f => f.includes(".wiki")));
    }
    finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
test("findMdFiles 不存在的目录返回空", () => {
    const result = findMdFiles("/nonexistent/path/that/does/not/exist");
    assert.deepStrictEqual(result, []);
});
