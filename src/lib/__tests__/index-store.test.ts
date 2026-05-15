import test from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { rebuildIndexFromDisk, readIndex, writeIndex } from "../index-store.js";
import { writeWikiConfig } from "../wiki-config.js";

function tmpRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "index-test-"));
  fs.mkdirSync(path.join(root, "docs/.wiki"), { recursive: true });
  return root;
}

test("rebuildIndexFromDisk 空目录返回空 docs", () => {
  const root = tmpRoot();
  try {
    writeWikiConfig(root, {
      version: 1,
      categories: [{ name: "技术", description: "" }],
    });
    const index = rebuildIndexFromDisk(root);
    assert.deepStrictEqual(index.docs, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rebuildIndexFromDisk 扫描到 MD 文件", () => {
  const root = tmpRoot();
  try {
    writeWikiConfig(root, {
      version: 1,
      categories: [{ name: "技术", description: "" }],
    });
    const techDir = path.join(root, "docs/技术");
    fs.mkdirSync(techDir, { recursive: true });
    fs.writeFileSync(
      path.join(techDir, "test.md"),
      "---\ntitle: 测试\ntags: [a]\n---\n# 测试\n内容",
      "utf-8",
    );
    const index = rebuildIndexFromDisk(root);
    assert.strictEqual(index.docs.length, 1);
    assert.strictEqual(index.docs[0].title, "测试");
    assert.strictEqual(index.docs[0].category, "技术");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("writeIndex + readIndex 往返", () => {
  const root = tmpRoot();
  try {
    const index = {
      docs: [
        {
          path: "技术/a.md",
          title: "A",
          category: "技术",
          tags: [],
          outgoing: [],
          incoming: [],
        },
      ],
    };
    writeIndex(root, index);
    const read = readIndex(root);
    assert.deepStrictEqual(read, index);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
