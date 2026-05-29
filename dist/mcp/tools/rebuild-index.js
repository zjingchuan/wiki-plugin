import { z } from "zod/v4";
import { rebuildIndexFromDisk, writeIndex } from "../../lib/index-store.js";
import { appendHistory } from "../../lib/history.js";
export function registerRebuildIndex(server, rootDir) {
    server.registerTool("rebuild_index", {
        description: "重新扫描所有 Markdown 文档，重建 .wiki/index.json 索引",
        inputSchema: z.object({}),
    }, async () => {
        const index = rebuildIndexFromDisk(rootDir);
        // Compute incoming links from outgoing
        const incomingMap = new Map();
        for (const doc of index.docs) {
            for (const target of doc.outgoing) {
                const targetDoc = index.docs.find((d) => d.title === target || d.path.endsWith(`${target}.md`));
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
        appendHistory(rootDir, "reindex", { docCount: index.docs.length });
        return {
            content: [{ type: "text", text: JSON.stringify({ count: index.docs.length }) }],
        };
    });
}
