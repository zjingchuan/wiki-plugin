import * as path from "path";
import { execFileSync } from "child_process";
import * as fs from "fs";

export type ToolKind = "soffice" | "magick" | "none";

export interface ToolInfo {
  kind: ToolKind;
  path?: string;
}

export interface ConvertResult {
  source: string;
  success: boolean;
  output?: string;
  fromCache?: boolean;
  error?: string;
}

export interface ConvertReport {
  total: number;
  succeeded: number;
  failed: number;
  fromCache: number;
  toolUsed: ToolKind;
  setupHint?: string;
  results: ConvertResult[];
}

export const SETUP_HINT = `未检测到 LibreOffice 或 ImageMagick。\nObsidian 无法直接渲染 EMF/WMF 矢量图。\n建议安装 LibreOffice（推荐）：https://www.libreoffice.org/download/\n安装后运行 /wiki-reconvert-images 补转所有未渲染的图。`;

let cachedTool: ToolInfo | null = null;

export function resetToolCache(): void {
  cachedTool = null;
}

/** Check if a binary exists on PATH by running `which` / `where`. */
function whichSync(bin: string): string | null {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const result = execFileSync(cmd, [bin], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    // Windows `where` searches CWD before PATH, so a file named e.g. `soffice`
    // (no extension) dropped in CWD would shadow the real executable. Filter
    // to `.exe` results to avoid path-hijacking via CWD.
    const lines = result
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const found =
      process.platform === "win32"
        ? lines.find((l) => l.toLowerCase().endsWith(".exe"))
        : lines[0];
    return found ?? null;
  } catch {
    return null;
  }
}

function findSoffice(): string | null {
  const platform = process.platform;
  if (platform === "win32") {
    const candidates = [
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return whichSync("soffice");
  }
  if (platform === "darwin") {
    const macPath =
      "/Applications/LibreOffice.app/Contents/MacOS/soffice";
    if (fs.existsSync(macPath)) return macPath;
    return whichSync("soffice");
  }
  // Linux and others
  return whichSync("soffice");
}

function findMagick(): string | null {
  // Try ImageMagick v7 first
  const magick = whichSync("magick");
  if (magick) return magick;
  // v6 `convert` — skip on Windows (system convert.exe)
  if (process.platform !== "win32") {
    const convert = whichSync("convert");
    if (convert) return convert;
  }
  return null;
}

export function detectTool(): ToolInfo {
  if (cachedTool) return cachedTool;

  const soffice = findSoffice();
  if (soffice) {
    cachedTool = { kind: "soffice", path: soffice };
    return cachedTool;
  }

  const magick = findMagick();
  if (magick) {
    cachedTool = { kind: "magick", path: magick };
    return cachedTool;
  }

  cachedTool = { kind: "none" };
  return cachedTool;
}

export function isEmfFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [".x-emf", ".emf", ".wmf", ".x-wmf"].includes(ext);
}
