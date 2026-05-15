import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { writeWikiConfig, readWikiConfig } from "../../lib/wiki-config.js";

export function registerInitConfig(server: McpServer, rootDir: string) {
  server.registerTool(
    "init_wiki_config",
    {
      description: "初始化或更新 docs/.wiki/config.json，配置文档分类",
      inputSchema: z.object({
        categories: z.array(z.object({
          name: z.string(),
          description: z.string(),
        })).describe("分类列表，每项含名称和描述（描述会用于 Claude 智能分类）"),
      }),
    },
    async ({ categories }) => {
      writeWikiConfig(rootDir, { version: 1, categories });
      const cfg = readWikiConfig(rootDir);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ success: true, categories: cfg.categories }),
        }],
      };
    }
  );
}
