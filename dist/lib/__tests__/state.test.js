import test from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { readState, writeState, markProcessed } from "../state.js";
function tmpRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "state-test-"));
    fs.mkdirSync(path.join(root, "docs/.wiki"), { recursive: true });
    return root;
}
test("readState 文件不存在返回空 state", () => {
    const root = tmpRoot();
    try {
        const state = readState(root);
        assert.strictEqual(state.version, 1);
        assert.deepStrictEqual(state.processed, {});
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test("writeState + readState 往返", () => {
    const root = tmpRoot();
    try {
        const state = {
            version: 1,
            processed: {
                "raw/test.docx": {
                    hash: "abc",
                    outputs: ["技术/test.md"],
                    processedAt: "2026-01-01",
                },
            },
        };
        writeState(root, state);
        const read = readState(root);
        assert.deepStrictEqual(read, state);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test("markProcessed 添加记录", () => {
    const state = { version: 1, processed: {} };
    const updated = markProcessed(state, "raw/a.docx", "hash123", ["产品/a.md"]);
    assert.ok(updated.processed["raw/a.docx"]);
    assert.strictEqual(updated.processed["raw/a.docx"].hash, "hash123");
    assert.deepStrictEqual(updated.processed["raw/a.docx"].outputs, ["产品/a.md"]);
});
