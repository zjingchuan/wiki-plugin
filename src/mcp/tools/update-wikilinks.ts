import * as fs from "fs";
import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveFromRoot, DOCS_DIR } from "../../lib/paths.js";
import { readIndex, upsertDoc, writeIndex, type DocEntry } from "../../lib/index-store.js";

export function registerUpdateWikilinks(server: McpServer, rootDir: string) {
  server.registerTool(
    "update_wikilinks",
    {
      description: "在指定文档中插入或更新 [[wikilink]] 链接",
      inputSchema: z.object({
        path: z.string().describe("相对于 docs/ 的文档路径，如 技术/接口设计/xxx.md"),
        links: z.array(z.string()).describe("要关联的文档标题列表"),
      }),
    },
    async ({ path: docPath, links }) => {
      const fullPath = resolveFromRoot(rootDir, DOCS_DIR, docPath);
      if (!fs.existsSync(fullPath)) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "文档不存在" }) }] };
      }

      let content = fs.readFileSync(fullPath, "utf-8");

      const existingLinks = new Set<string>();
      const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
      let match: RegExpExecArray | null;
      while ((match = wikiLinkRegex.exec(content)) !== null) {
        existingLinks.add(match[1]);
      }

      const newLinks = links.filter((l) => !existingLinks.has(l));
      if (newLinks.length > 0) {
        const linkSection = "\n\n## 相关文档\n\n" + newLinks.map((l) => `- [[${l}]]`).join("\n") + "\n";

        const existingSectionRegex = /\n\n## 相关文档\n\n([\s\S]*?)(?=\n\n## |\n*$)/;
        if (existingSectionRegex.test(content)) {
          content = content.replace(existingSectionRegex, (matched: string) => {
            return matched.trimEnd() + "\n" + newLinks.map((l) => `- [[${l}]]`).join("\n");
          });
        } else {
          content = content.trimEnd() + linkSection;
        }

        fs.writeFileSync(fullPath, content, "utf-8");
      }

      // Update index
      const index = readIndex(rootDir);
      const allLinks = [...existingLinks, ...newLinks];
      const existing = index.docs.find((d) => d.path === docPath);
      if (existing) {
        const updated: DocEntry = { ...existing, outgoing: allLinks };
        const newIndex = upsertDoc(index, updated);
        writeIndex(rootDir, newIndex);
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ added: newLinks.length, total: existingLinks.size + newLinks.length }) }],
      };
    }
  );
}
