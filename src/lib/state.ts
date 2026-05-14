import * as fs from "fs";
import * as crypto from "crypto";
import { resolveFromRoot, ensureDir, STATE_FILE, WIKI_DIR } from "./paths.js";

export interface ProcessedEntry {
  hash: string;
  outputs: string[];
  processedAt: string;
}

export interface StateData {
  version: number;
  processed: Record<string, ProcessedEntry>;
}

function defaultState(): StateData {
  return { version: 1, processed: {} };
}

export function readState(rootDir: string): StateData {
  const filePath = resolveFromRoot(rootDir, STATE_FILE);
  if (!fs.existsSync(filePath)) return defaultState();
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as StateData;
}

export function writeState(rootDir: string, state: StateData): void {
  const filePath = resolveFromRoot(rootDir, STATE_FILE);
  ensureDir(resolveFromRoot(rootDir, WIKI_DIR));
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

export function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return "sha256:" + crypto.createHash("sha256").update(content).digest("hex");
}

export function isProcessed(state: StateData, rawRelPath: string, hash: string): boolean {
  const entry = state.processed[rawRelPath];
  return !!entry && entry.hash === hash;
}

export function markProcessed(
  state: StateData,
  rawRelPath: string,
  hash: string,
  outputs: string[]
): StateData {
  return {
    ...state,
    processed: {
      ...state.processed,
      [rawRelPath]: {
        hash,
        outputs,
        processedAt: new Date().toISOString(),
      },
    },
  };
}
