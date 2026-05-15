import test from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { archiveRawFile } from "../mark-processed.js";
import { readState } from "../../../lib/state.js";

test("初始 state 为空", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mark-test-"));
  try {
    fs.mkdirSync(path.join(root, "docs/raw"), { recursive: true });
    const rawFile = path.join(root, "docs/raw/test.docx");
    fs.writeFileSync(rawFile, "fake content");

    const state = readState(root);
    assert.strictEqual(Object.keys(state.processed).length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("archiveRawFile 成功时返回 ok=true 并移动文件", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mark-test-"));
  try {
    fs.mkdirSync(path.join(root, "docs/raw"), { recursive: true });
    const rawFile = path.join(root, "docs/raw/test.docx");
    fs.writeFileSync(rawFile, "content");

    const result = archiveRawFile(root, "raw/test.docx");
    assert.strictEqual(result.ok, true);
    assert.ok(fs.existsSync(path.join(root, "docs/raw/archive/test.docx")));
    assert.ok(!fs.existsSync(rawFile));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("archiveRawFile 文件不存在时返回 ok=false", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mark-test-"));
  try {
    const result = archiveRawFile(root, "raw/nonexistent.docx");
    assert.strictEqual(result.ok, false);
    assert.match(result.error || "", /不存在|ENOENT/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
