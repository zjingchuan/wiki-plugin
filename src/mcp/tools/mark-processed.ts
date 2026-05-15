import * as fs from "fs";
import * as path from "path";
import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveFromRoot, ARCHIVE_DIR, ensureDir } from "../../lib/paths.js";
import { readState, writeState, markProcessed as markEntry } from "../../lib/state.js";

export interface ArchiveResult {
  ok: boolean;
  archivedPath?: string;
  error?: string;
}

export function archiveRawFile(rootDir: string, rawRelPath: string): ArchiveResult {
  const srcFull = resolveFromRoot(rootDir, "docs", rawRelPath);
  if (!fs.existsSync(srcFull)) {
    return { ok: false, error: `源文件不存在: ${rawRelPath}` };
  }
  const archiveDir = resolveFromRoot(rootDir, ARCHIVE_DIR);
  ensureDir(archiveDir);
  const destFull = path.join(archiveDir, path.basename(srcFull));

  try {
    fs.renameSync(srcFull, destFull);
    return { ok: true, archivedPath: destFull };
  } catch (err: any) {
    if (err.code === "EXDEV" || err.code === "EPERM" || err.code === "EBUSY") {
      try {
        fs.copyFileSync(srcFull, destFull);
        fs.unlinkSync(srcFull);
        return { ok: true, archivedPath: destFull };
      } catch (e: any) {
        return { ok: false, error: `归档失败（文件可能被占用）: ${e.message}` };
      }
    }
    return { ok: false, error: `归档失败: ${err.message}` };
  }
}

export function registerMarkProcessed(server: McpServer, rootDir: string) {
  server.registerTool(
    "mark_processed",
    {
      description: "标记原始文件为已处理。先归档原文件，归档成功后再更新 state.json。归档失败时不会污染 state（事务性）",
      inputSchema: z.object({
        rawPath: z.string().describe("相对于 docs/ 的原始文件路径，如 raw/xxx.docx"),
        outputPath: z.string().describe("输出的 MD 文件路径，如 技术/接口设计/xxx.md"),
        hash: z.string().describe("原始文件的 sha256 hash"),
      }),
    },
    async ({ rawPath, outputPath, hash }) => {
      const archiveResult = archiveRawFile(rootDir, rawPath);
      if (!archiveResult.ok) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ok: false,
              error: archiveResult.error,
              hint: "如文件被 Obsidian/Word 占用，请关闭后重试",
            }),
          }],
        };
      }

      let state = readState(rootDir);
      state = markEntry(state, rawPath, hash, [outputPath]);
      writeState(rootDir, state);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: true, archivedPath: archiveResult.archivedPath }),
        }],
      };
    }
  );
}
