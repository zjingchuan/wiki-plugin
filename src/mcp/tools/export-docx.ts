import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { convertToDocx } from "../../lib/md-to-docx/index.js";
import { logger } from "../../lib/logger.js";

export function registerExportDocx(server: McpServer, rootDir: string) {
  server.registerTool(
    "export_docx",
    {
      description: "把指定的 Markdown 文档导出为 Word（.docx）。支持单文件分别导出或多文件合并。Mermaid 代码块会渲染为图片（需 mermaid-cli）",
      inputSchema: z.object({
        paths: z.array(z.string()).describe("相对于 docs/ 的 MD 路径数组，如 ['产品/使用手册/xxx.md']"),
        mode: z.enum(["single", "merged"]).describe("single=每个独立导出；merged=合并为一个 Word"),
        output: z.string().optional().describe("自定义输出文件名（不含扩展名）"),
      }),
    },
    async ({ paths, mode, output }) => {
      const result = await convertToDocx({ rootDir, inputs: paths, mode, output });
      logger.info("文档导出完成", { mode, paths, files: result.files });
      if (result.warnings.length > 0) {
        logger.warn("导出有警告", { warnings: result.warnings });
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result),
        }],
      };
    }
  );
}
