import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rebuildIndexFromDisk, writeIndex } from "../../lib/index-store.js";

export function registerRebuildIndex(server: McpServer, rootDir: string) {
  server.registerTool(
    "rebuild_index",
    {
      description: "重新扫描所有 Markdown 文档，重建 .wiki/index.json 索引",
      inputSchema: z.object({}),
    },
    async () => {
      const index = rebuildIndexFromDisk(rootDir);

      // Compute incoming links from outgoing
      const incomingMap = new Map<string, string[]>();
      for (const doc of index.docs) {
        for (const target of doc.outgoing) {
          const targetDoc = index.docs.find(
            (d) => d.title === target || d.path.endsWith(`${target}.md`)
          );
          if (targetDoc) {
            const existing = incomingMap.get(targetDoc.path) || [];
            existing.push(doc.path);
            incomingMap.set(targetDoc.path, existing);
          }
        }
      }

      for (const doc of index.docs) {
        doc.incoming = incomingMap.get(doc.path) || [];
      }

      writeIndex(rootDir, index);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ count: index.docs.length }) }],
      };
    }
  );
}
