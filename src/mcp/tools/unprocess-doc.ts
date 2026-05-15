import * as fs from "fs";
import * as path from "path";
import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveFromRoot, DOCS_DIR, ARCHIVE_DIR } from "../../lib/paths.js";
import { readState, writeState } from "../../lib/state.js";
import { appendHistory } from "../../lib/history.js";

export function registerUnprocessDoc(server: McpServer, rootDir: string) {
  server.registerTool(
    "unprocess_doc",
    {
      description: "撤销一次 /wiki-import：把原始文件从 archive 移回 raw，删除生成的 MD 和 assets，清理 state.json 记录",
      inputSchema: z.object({
        rawPath: z.string().describe("相对于 docs/ 的原始文件路径（archive 前的路径），如 raw/xxx.docx"),
      }),
    },
    async ({ rawPath }) => {
      const warnings: string[] = [];
      const actions: string[] = [];

      const state = readState(rootDir);
      const entry = state.processed[rawPath];
      if (!entry) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ok: false, error: `state 中无此记录: ${rawPath}` }),
          }],
        };
      }

      // 1. 删除生成的 MD 文件
      for (const output of entry.outputs) {
        const outFull = resolveFromRoot(rootDir, DOCS_DIR, output);
        if (fs.existsSync(outFull)) {
          fs.unlinkSync(outFull);
          actions.push(`删除 MD: ${output}`);
        } else {
          warnings.push(`MD 不存在（已删？）: ${output}`);
        }
      }

      // 2. 删除关联的 assets 目录（按文件名规则推断）
      const filename = path.basename(rawPath);
      const ext = path.extname(filename);
      const filenameNoExt = path.basename(filename, ext);
      const assetsDir = resolveFromRoot(rootDir, DOCS_DIR, "assets", filenameNoExt);
      if (fs.existsSync(assetsDir)) {
        fs.rmSync(assetsDir, { recursive: true, force: true });
        actions.push(`删除 assets: assets/${filenameNoExt}/`);
      }

      // 3. 把原文从 archive 移回 raw
      const archivePath = path.join(resolveFromRoot(rootDir, ARCHIVE_DIR), filename);
      const rawFull = resolveFromRoot(rootDir, DOCS_DIR, rawPath);
      if (fs.existsSync(archivePath)) {
        try {
          fs.renameSync(archivePath, rawFull);
          actions.push(`恢复原文: ${rawPath}`);
        } catch (err: any) {
          fs.copyFileSync(archivePath, rawFull);
          fs.unlinkSync(archivePath);
          actions.push(`恢复原文（copy+delete）: ${rawPath}`);
        }
      } else {
        warnings.push(`archive 中无原文: ${filename}`);
      }

      // 4. 清理 state
      delete state.processed[rawPath];
      writeState(rootDir, state);
      actions.push(`清理 state.json 记录`);

      appendHistory(rootDir, "undo", { rawPath, actions, warnings });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ ok: true, actions, warnings }),
        }],
      };
    }
  );
}

