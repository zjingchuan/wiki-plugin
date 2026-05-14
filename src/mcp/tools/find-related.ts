import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readIndex, findRelated } from "../../lib/index-store.js";

export function registerFindRelated(server: McpServer, rootDir: string) {
  server.registerTool(
    "find_related_docs",
    {
      description: "基于关键词检索相关文档，辅助生成 wikilinks",
      inputSchema: z.object({
        query: z.string().describe("搜索关键词（空格分隔）"),
        topK: z.number().optional().describe("返回结果数量上限，默认 5"),
      }),
    },
    async ({ query, topK }) => {
      const index = readIndex(rootDir);
      const results = findRelated(index, query, topK ?? 5);
      const output = results.map((doc) => ({
        path: doc.path,
        title: doc.title,
        tags: doc.tags,
        category: doc.category,
      }));
      return { content: [{ type: "text" as const, text: JSON.stringify({ results: output }) }] };
    }
  );
}
