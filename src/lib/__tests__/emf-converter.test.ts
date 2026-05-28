import test from "node:test";
import assert from "node:assert";
import {
  detectTool,
  isEmfFile,
  resetToolCache,
  SETUP_HINT,
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
