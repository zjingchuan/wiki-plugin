import * as fs from "fs";
import { resolveFromRoot, WIKI_DIR, ensureDir } from "./paths.js";

export interface HistoryEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export interface HistoryData {
  entries: HistoryEntry[];
}

const HISTORY_FILE = "docs/.wiki/history.json";
const MAX_ENTRIES = 500;

export function readHistory(rootDir: string): HistoryData {
  const filePath = resolveFromRoot(rootDir, HISTORY_FILE);
  if (!fs.existsSync(filePath)) return { entries: [] };
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as HistoryData;
}

export function appendHistory(rootDir: string, action: string, details: Record<string, unknown>): void {
  ensureDir(resolveFromRoot(rootDir, WIKI_DIR));
  const history = readHistory(rootDir);
  history.entries.push({
    timestamp: new Date().toISOString(),
    action,
    details,
  });
  if (history.entries.length > MAX_ENTRIES) {
    history.entries = history.entries.slice(-MAX_ENTRIES);
  }
  const filePath = resolveFromRoot(rootDir, HISTORY_FILE);
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2), "utf-8");
}
