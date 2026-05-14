import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readIndex } from "../../lib/index-store.js";
import { CATEGORIES } from "../../lib/paths.js";

export function registerListAllDocs(server: McpServer, rootDir: string) {
  server.registerTool(
    "list_all_docs",
    {
      description: "列出全部已整理的文档（可按分类过滤）",
      inputSchema: z.object({
        category: z.enum(CATEGORIES).optional().describe("可选：按分类过滤"),
      }),
    },
    async ({ category }) => {
      const index = readIndex(rootDir);
      let docs = index.docs;
      if (category) {
        docs = docs.filter((d) => d.category === category);
      }
      const output = docs.map((d) => ({
        path: d.path,
        title: d.title,
        category: d.category,
        tags: d.tags,
        outgoing: d.outgoing,
      }));
      return { content: [{ type: "text" as const, text: JSON.stringify({ docs: output }) }] };
    }
  );
}
