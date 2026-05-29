import * as fs from "fs";
import * as path from "path";
import { resolveFromRoot, ensureDir, INDEX_FILE, WIKI_DIR, DOCS_DIR } from "./paths.js";
import { getCategories } from "./wiki-config.js";
import { buildIndex as buildTfidfIndex, queryIndex as queryTfidf } from "./tfidf.js";
function defaultIndex() {
    return { docs: [] };
}
export function readIndex(rootDir) {
    const filePath = resolveFromRoot(rootDir, INDEX_FILE);
    if (!fs.existsSync(filePath))
        return defaultIndex();
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
}
export function writeIndex(rootDir, index) {
    const filePath = resolveFromRoot(rootDir, INDEX_FILE);
    ensureDir(resolveFromRoot(rootDir, WIKI_DIR));
    fs.writeFileSync(filePath, JSON.stringify(index, null, 2), "utf-8");
}
export function upsertDoc(index, entry) {
    const existing = index.docs.findIndex((d) => d.path === entry.path);
    const docs = [...index.docs];
    if (existing >= 0) {
        docs[existing] = entry;
    }
    else {
        docs.push(entry);
    }
    return { docs };
}
export function removeDoc(index, docPath) {
    return { docs: index.docs.filter((d) => d.path !== docPath) };
}
export function findRelated(index, query, topK = 5) {
    if (index.docs.length === 0)
        return [];
    const tfidfDocs = index.docs.map((doc) => ({
        id: doc.path,
        text: `${doc.title} ${doc.tags.join(" ")} ${doc.category}`,
    }));
    const tfidfIndex = buildTfidfIndex(tfidfDocs);
    const results = queryTfidf(tfidfIndex, query, topK);
    return results
        .map((r) => index.docs.find((d) => d.path === r.id))
        .filter((d) => d !== undefined);
}
export function updateDocMetadata(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!fmMatch)
        return;
    const fmBlock = fmMatch[1];
    const body = content.slice(fmMatch[0].length);
    const wordCount = body.replace(/\s/g, "").length;
    const today = new Date().toISOString().slice(0, 10);
    let updatedFm = fmBlock;
    if (/^updated:/m.test(updatedFm)) {
        updatedFm = updatedFm.replace(/^updated:.*$/m, `updated: ${today}`);
    }
    else {
        updatedFm += `\nupdated: ${today}`;
    }
    if (/^word_count:/m.test(updatedFm)) {
        updatedFm = updatedFm.replace(/^word_count:.*$/m, `word_count: ${wordCount}`);
    }
    else {
        updatedFm += `\nword_count: ${wordCount}`;
    }
    const newContent = `---\n${updatedFm}\n---\n${body}`;
    fs.writeFileSync(filePath, newContent, "utf-8");
}
export function rebuildIndexFromDisk(rootDir) {
    const docsRoot = resolveFromRoot(rootDir, DOCS_DIR);
    const docs = [];
    const categories = getCategories(rootDir);
    for (const category of categories) {
        const catDir = path.join(docsRoot, category);
        if (!fs.existsSync(catDir))
            continue;
        scanDir(catDir, docsRoot, category, docs);
    }
    return { docs };
}
function scanDir(dir, docsRoot, category, docs) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            scanDir(fullPath, docsRoot, category, docs);
        }
        else if (entry.name.endsWith(".md")) {
            updateDocMetadata(fullPath);
            const relPath = path.relative(docsRoot, fullPath).replace(/\\/g, "/");
            const content = fs.readFileSync(fullPath, "utf-8");
            const doc = parseDocEntry(relPath, category, content);
            docs.push(doc);
        }
    }
}
function parseDocEntry(relPath, category, content) {
    let title = path.basename(relPath, ".md");
    let tags = [];
    const outgoing = [];
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
        const fm = frontmatterMatch[1];
        const titleMatch = fm.match(/^title:\s*(.+)$/m);
        if (titleMatch)
            title = titleMatch[1].trim();
        const tagsMatch = fm.match(/^tags:\s*\[(.+)\]$/m);
        if (tagsMatch)
            tags = tagsMatch[1].split(",").map((t) => t.trim());
    }
    // Extract wikilinks, handling [[target|alias]] syntax
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = wikiLinkRegex.exec(content)) !== null) {
        const inner = match[1];
        const target = inner.split("|")[0]; // Take part before | (if any)
        const segments = target.split("/");
        outgoing.push(segments[segments.length - 1].trim()); // Last path segment
    }
    return { path: relPath, title, category, tags, outgoing, incoming: [] };
}
