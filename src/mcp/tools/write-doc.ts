import * as fs from "fs";
import * as path from "path";
import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveFromRoot, DOCS_DIR, CATEGORIES, ensureDir, type Category } from "../../lib/paths.js";

export function registerWriteDoc(server: McpServer, rootDir: string) {
  server.registerTool(
    "write_doc",
    {
      description: "将转换后的 Markdown 文档写入分类目录",
      inputSchema: z.object({
        category: z.enum(CATEGORIES).describe("文档分类：产品、技术、运维"),
        relPath: z.string().describe("分类目录下的相对路径，如 接口设计/用户接口.md"),
        content: z.string().describe("完整的 Markdown 内容（含 frontmatter）"),
      }),
    },
    async ({ category, relPath, content }) => {
      const fullPath = resolveFromRoot(rootDir, DOCS_DIR, category, relPath);
      ensureDir(path.dirname(fullPath));
      fs.writeFileSync(fullPath, content, "utf-8");

      const absPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      return { content: [{ type: "text" as const, text: JSON.stringify({ absPath }) }] };
    }
  );
}
