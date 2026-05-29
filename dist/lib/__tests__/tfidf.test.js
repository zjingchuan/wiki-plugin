import test from "node:test";
import assert from "node:assert";
import { tokenize, buildIndex, queryIndex } from "../tfidf.js";
test("tokenize 中文生成 unigrams + bigrams", () => {
    const tokens = tokenize("用户接口");
    assert.ok(tokens.includes("用"));
    assert.ok(tokens.includes("用户"));
    assert.ok(tokens.includes("户接"));
    assert.ok(tokens.includes("接口"));
});
test("tokenize 英文保留完整单词", () => {
    const tokens = tokenize("hello world API");
    assert.ok(tokens.includes("hello"));
    assert.ok(tokens.includes("world"));
    assert.ok(tokens.includes("api"));
});
test("buildIndex + queryIndex 基本相似度", () => {
    const index = buildIndex([
        { id: "doc1", text: "用户登录接口设计" },
        { id: "doc2", text: "数据库备份方案" },
        { id: "doc3", text: "用户注册接口" },
    ]);
    const results = queryIndex(index, "用户接口");
    assert.ok(results.length >= 2);
    // doc1 和 doc3 应该比 doc2 排名高
    const ids = results.map((r) => r.id);
    const doc2Idx = ids.indexOf("doc2");
    const doc1Idx = ids.indexOf("doc1");
    if (doc2Idx >= 0 && doc1Idx >= 0) {
        assert.ok(doc1Idx < doc2Idx);
    }
});
test("queryIndex 无匹配返回空", () => {
    const index = buildIndex([
        { id: "doc1", text: "完全不相关的内容" },
    ]);
    const results = queryIndex(index, "xyz123");
    assert.strictEqual(results.length, 0);
});
