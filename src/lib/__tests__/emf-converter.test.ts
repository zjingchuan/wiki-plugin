import test from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  detectTool,
  isEmfFile,
  resetToolCache,
  SETUP_HINT,
  convertBatch,
  type ToolInfo,
} from "../emf-converter.js";

test("detectTool 返回合法的 ToolInfo 形状", () => {
  resetToolCache();
  const info: ToolInfo = detectTool();
  assert.ok(
    info.kind === "soffice" || info.kind === "magick" || info.kind === "none",
    `unexpected kind: ${info.kind}`,
  );
  if (info.kind === "none") {
    assert.strictEqual(info.path, undefined);
  } else {
    assert.strictEqual(typeof info.path, "string");
    assert.ok(info.path && info.path.length > 0, "path should not be empty");
  }
});

test("detectTool 缓存：连续调用返回相同实例", () => {
  resetToolCache();
  const first = detectTool();
  const second = detectTool();
  assert.strictEqual(first, second, "should return cached instance");
});

test("resetToolCache 清空缓存后可重新检测", () => {
  resetToolCache();
  const first = detectTool();
  resetToolCache();
  const second = detectTool();
  // After reset, kind should still be the same (system unchanged)
  // but the object must be a fresh reference (proves cache was cleared).
  assert.notStrictEqual(first, second, "应返回新的对象实例（缓存已清空）");
  assert.strictEqual(first.kind, second.kind);
  assert.strictEqual(first.path, second.path);
});

test("isEmfFile 正确识别 EMF/WMF 扩展名", () => {
  assert.strictEqual(isEmfFile("foo.emf"), true);
  assert.strictEqual(isEmfFile("foo.EMF"), true);
  assert.strictEqual(isEmfFile("foo.wmf"), true);
  assert.strictEqual(isEmfFile("foo.WMF"), true);
  assert.strictEqual(isEmfFile("foo.x-emf"), true);
  assert.strictEqual(isEmfFile("foo.x-wmf"), true);
  assert.strictEqual(isEmfFile("path/to/image.emf"), true);
});

test("isEmfFile 拒绝非 EMF 扩展名", () => {
  assert.strictEqual(isEmfFile("foo.png"), false);
  assert.strictEqual(isEmfFile("foo.jpg"), false);
  assert.strictEqual(isEmfFile("foo.svg"), false);
  assert.strictEqual(isEmfFile("foo.docx"), false);
  assert.strictEqual(isEmfFile("foo"), false);
  assert.strictEqual(isEmfFile(""), false);
});

test("SETUP_HINT 包含关键安装提示信息", () => {
  assert.ok(SETUP_HINT.includes("LibreOffice"));
  assert.ok(SETUP_HINT.includes("ImageMagick"));
  assert.ok(SETUP_HINT.includes("https://www.libreoffice.org/"));
});

test("convertBatch 空列表返回空报告", async () => {
  const report = await convertBatch([], { rootDir: process.cwd() });
  assert.strictEqual(report.total, 0);
  assert.strictEqual(report.succeeded, 0);
  assert.strictEqual(report.failed, 0);
  assert.strictEqual(report.fromCache, 0);
  assert.strictEqual(report.toolUsed, "none");
  assert.strictEqual(report.results.length, 0);
});

test("convertBatch 输入文件不存在时标记单项 failed 但不阻塞", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emf-test-"));
  try {
    const nonexistent = path.join(tmpDir, "nonexistent-file.x-emf");
    const report = await convertBatch([nonexistent], { rootDir: tmpDir });

    assert.strictEqual(report.total, 1);
    assert.strictEqual(report.failed, 1);
    assert.strictEqual(report.results.length, 1);
    assert.strictEqual(report.results[0].success, false);
    assert.ok(report.results[0].error);
    assert.match(report.results[0].error, /不存在/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("convertBatch 工具不可用时所有未命中项标 failed", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emf-test-"));
  try {
    const fakeEmf = path.join(tmpDir, "fake.x-emf");
    fs.writeFileSync(fakeEmf, Buffer.from([0x01, 0x02, 0x03, 0x04]));

    const report = await convertBatch([fakeEmf], { rootDir: tmpDir });

    if (report.toolUsed === "none") {
      assert.strictEqual(report.failed, 1);
      assert.ok(report.setupHint);
      assert.ok(report.results[0].error);
    } else {
      // Tool was available — skip the failure-path assertion. Just confirm shape.
      assert.strictEqual(report.total, 1);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("convertBatch 并发调用不冲突", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emf-concurrent-"));
  try {
    fs.mkdirSync(path.join(tmpDir, "docs/.wiki"), { recursive: true });
    const file1 = path.join(tmpDir, "file1.x-emf");
    const file2 = path.join(tmpDir, "file2.x-emf");
    fs.writeFileSync(file1, Buffer.from([0x01, 0x02, 0x03]));
    fs.writeFileSync(file2, Buffer.from([0x04, 0x05, 0x06]));

    const [report1, report2] = await Promise.all([
      convertBatch([file1], { rootDir: tmpDir }),
      convertBatch([file2], { rootDir: tmpDir }),
    ]);

    assert.strictEqual(report1.total, 1);
    assert.strictEqual(report2.total, 1);
    // Both should complete without temp dir collision
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("convertBatch setupHint 仅在工具不可用时设置", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emf-hint-"));
  try {
    fs.mkdirSync(path.join(tmpDir, "docs/.wiki"), { recursive: true });
    // empty list, no tool needed
    const report = await convertBatch([], { rootDir: tmpDir });
    assert.strictEqual(report.setupHint, undefined);

    // file not found, but tool may or may not be available
    const reportMissing = await convertBatch(
      [path.join(tmpDir, "missing.x-emf")],
      { rootDir: tmpDir },
    );
    if (reportMissing.toolUsed === "none") {
      assert.ok(reportMissing.setupHint, "工具不可用时应有 setupHint");
    } else {
      // tool present, missing file - should NOT have setupHint
      assert.strictEqual(
        reportMissing.setupHint,
        undefined,
        "工具可用但单项失败不应有 setupHint",
      );
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

