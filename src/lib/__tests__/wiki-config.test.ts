import test from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { readWikiConfig, writeWikiConfig, defaultConfig, getCategories } from "../wiki-config.js";

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wiki-config-test-"));
}

test("readWikiConfig 文件不存在返回 default", () => {
  const root = tmpRoot();
  try {
    const cfg = readWikiConfig(root);
    assert.deepStrictEqual(cfg, defaultConfig());
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("writeWikiConfig + readWikiConfig 往返", () => {
  const root = tmpRoot();
  try {
    const cfg = {
      version: 1,
      categories: [
        { name: "前端", description: "UI 与组件" },
        { name: "后端", description: "API 与数据库" },
      ],
    };
    writeWikiConfig(root, cfg);
    const read = readWikiConfig(root);
    assert.deepStrictEqual(read, cfg);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("getCategories 返回名称数组", () => {
  const root = tmpRoot();
  try {
    writeWikiConfig(root, {
      version: 1,
      categories: [
        { name: "A", description: "" },
        { name: "B", description: "" },
      ],
    });
    assert.deepStrictEqual(getCategories(root), ["A", "B"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("defaultConfig 包含 产品 技术 运维", () => {
  const cfg = defaultConfig();
  const names = cfg.categories.map((c) => c.name);
  assert.deepStrictEqual(names, ["产品", "技术", "运维"]);
});
