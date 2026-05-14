import * as path from "path";
import * as fs from "fs";

export const DOCS_DIR = "docs";
export const RAW_DIR = path.join(DOCS_DIR, "raw");
export const ARCHIVE_DIR = path.join(RAW_DIR, "archive");
export const WIKI_DIR = path.join(DOCS_DIR, ".wiki");
export const STATE_FILE = path.join(WIKI_DIR, "state.json");
export const INDEX_FILE = path.join(WIKI_DIR, "index.json");

export const CATEGORIES = ["产品", "技术", "运维"] as const;
export type Category = (typeof CATEGORIES)[number];

export function resolveFromRoot(rootDir: string, ...segments: string[]): string {
  return path.resolve(rootDir, ...segments);
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function isRawFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [".docx", ".doc", ".xlsx", ".xls", ".pdf", ".pptx", ".ppt"].includes(ext);
}

export function getRelativePath(rootDir: string, absPath: string): string {
  return path.relative(rootDir, absPath).replace(/\\/g, "/");
}
