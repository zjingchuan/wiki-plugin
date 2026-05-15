import * as fs from "fs";
import * as path from "path";
import { resolveFromRoot, WIKI_DIR, ensureDir } from "./paths.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";
let rootDir: string | null = null;

export function initLogger(root: string, level: LogLevel = "info"): void {
  rootDir = root;
  currentLevel = level;
}

export function log(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return;
  if (!rootDir) return;

  const logsDir = resolveFromRoot(rootDir, WIKI_DIR, "logs");
  ensureDir(logsDir);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toISOString().slice(11, 19);
  const logFile = path.join(logsDir, `${dateStr}.log`);

  const metaStr = meta ? " " + JSON.stringify(meta) : "";
  const line = `[${timeStr}] ${level.toUpperCase().padEnd(5)} ${message}${metaStr}\n`;

  fs.appendFileSync(logFile, line, "utf-8");
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) =>
    log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) =>
    log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) =>
    log("error", msg, meta),
};
