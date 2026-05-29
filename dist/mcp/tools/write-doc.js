import * as fs from "fs";
import * as path from "path";
import { z } from "zod/v4";
import { resolveFromRoot, DOCS_DIR, ensureDir } from "../../lib/paths.js";
import { getCategories } from "../../lib/wiki-config.js";
export function registerWriteDoc(server, rootDir) {
    server.registerTool("write_doc", {
        description: "将转换后的 Markdown 文档写入分类目录",
        inputSchema: z.object({
            category: z.string().describe("文档分类（运行时校验配置中是否存在）"),
            relPath: z.string().describe("分类目录下的相对路径，如 接口设计/用户接口.md"),
            content: z.string().describe("完整的 Markdown 内容（含 frontmatter）"),
        }),
    }, async ({ category, relPath, content }) => {
        const validCats = getCategories(rootDir);
        if (!validCats.includes(category)) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({ error: `未知分类: ${category}。已配置分类: ${validCats.join(", ")}` }),
                    }],
            };
        }
        const fullPath = resolveFromRoot(rootDir, DOCS_DIR, category, relPath);
        ensureDir(path.dirname(fullPath));
        fs.writeFileSync(fullPath, content, "utf-8");
        const absPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
        return { content: [{ type: "text", text: JSON.stringify({ absPath }) }] };
    });
}
