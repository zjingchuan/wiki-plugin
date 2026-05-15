import * as fs from "fs";
import * as path from "path";
import { resolveFromRoot, ensureDir, INDEX_FILE, WIKI_DIR, DOCS_DIR } from "./paths.js";
import { getCategories } from "./wiki-config.js";

export interface DocEntry {
  path: string;
  title: string;
  category: string;
  tags: string[];
  outgoing: string[];
  incoming: string[];
}

export interface IndexData {
  docs: DocEntry[];
}

function defaultIndex(): IndexData {
  return { docs: [] };
}

export function readIndex(rootDir: string): IndexData {
  const filePath = resolveFromRoot(rootDir, INDEX_FILE);
  if (!fs.existsSync(filePath)) return defaultIndex();
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as IndexData;
}

export function writeIndex(rootDir: string, index: IndexData): void {
  const filePath = resolveFromRoot(rootDir, INDEX_FILE);
  ensureDir(resolveFromRoot(rootDir, WIKI_DIR));
  fs.writeFileSync(filePath, JSON.stringify(index, null, 2), "utf-8");
}

export function upsertDoc(index: IndexData, entry: DocEntry): IndexData {
  const existing = index.docs.findIndex((d) => d.path === entry.path);
  const docs = [...index.docs];
  if (existing >= 0) {
    docs[existing] = entry;
  } else {
    docs.push(entry);
  }
  return { docs };
}

export function removeDoc(index: IndexData, docPath: string): IndexData {
  return { docs: index.docs.filter((d) => d.path !== docPath) };
}

export function findRelated(index: IndexData, query: string, topK = 5): DocEntry[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = index.docs.map((doc) => {
    const text = `${doc.title} ${doc.tags.join(" ")} ${doc.path}`.toLowerCase();
    const score = keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
    return { doc, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.doc);
}

export function rebuildIndexFromDisk(rootDir: string): IndexData {
  const docsRoot = resolveFromRoot(rootDir, DOCS_DIR);
  const docs: DocEntry[] = [];

  const categories = getCategories(rootDir);
  for (const category of categories) {
    const catDir = path.join(docsRoot, category);
    if (!fs.existsSync(catDir)) continue;
    scanDir(catDir, docsRoot, category, docs);
  }
  return { docs };
}

function scanDir(dir: string, docsRoot: string, category: string, docs: DocEntry[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, docsRoot, category, docs);
    } else if (entry.name.endsWith(".md")) {
      const relPath = path.relative(docsRoot, fullPath).replace(/\\/g, "/");
      const content = fs.readFileSync(fullPath, "utf-8");
      const doc = parseDocEntry(relPath, category, content);
      docs.push(doc);
    }
  }
}

function parseDocEntry(relPath: string, category: string, content: string): DocEntry {
  let title = path.basename(relPath, ".md");
  let tags: string[] = [];
  const outgoing: string[] = [];

  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const fm = frontmatterMatch[1];
    const titleMatch = fm.match(/^title:\s*(.+)$/m);
    if (titleMatch) title = titleMatch[1].trim();
    const tagsMatch = fm.match(/^tags:\s*\[(.+)\]$/m);
    if (tagsMatch) tags = tagsMatch[1].split(",").map((t) => t.trim());
  }

  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    outgoing.push(match[1]);
  }

  return { path: relPath, title, category, tags, outgoing, incoming: [] };
}
