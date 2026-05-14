import * as fs from "fs";
import * as path from "path";
import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveFromRoot, DOCS_DIR, ensureDir } from "../../lib/paths.js";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

export function registerReadRawFile(server: McpServer, rootDir: string) {
  server.registerTool(
    "read_raw_file",
    {
      description: "读取 docs/raw/ 下的原始文件，提取为 Markdown（含图片提取）",
      inputSchema: z.object({
        path: z.string().describe("相对于 docs/ 的文件路径，如 raw/xxx.docx"),
      }),
    },
    async ({ path: relPath }) => {
      const fullPath = resolveFromRoot(rootDir, "docs", relPath);
      if (!fs.existsSync(fullPath)) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "文件不存在" }) }] };
      }

      const ext = path.extname(fullPath).toLowerCase();
      const filename = path.basename(fullPath);
      const filenameNoExt = path.basename(fullPath, ext);
      const stat = fs.statSync(fullPath);

      try {
        let extractedText = "";
        const images: string[] = [];

        if (ext === ".docx" || ext === ".doc") {
          const assetsDir = resolveFromRoot(rootDir, DOCS_DIR, "assets", filenameNoExt);
          ensureDir(assetsDir);

          let imgIndex = 0;
          const result = await mammoth.convertToHtml(
            { path: fullPath },
            {
              convertImage: mammoth.images.imgElement(async (image) => {
                imgIndex++;
                const imgExt = image.contentType.split("/")[1] || "png";
                const imgName = `${filenameNoExt}_${String(imgIndex).padStart(3, "0")}.${imgExt}`;
                const imgPath = path.join(assetsDir, imgName);

                const buffer = await image.read();
                fs.writeFileSync(imgPath, buffer);

                images.push(imgName);
                return { src: `OBSIDIAN_WIKILINK::${imgName}` };
              }),
            }
          );

          let html = result.value;
          extractedText = turndown.turndown(html);
          extractedText = extractedText.replace(
            /!\[[^\]]*\]\(OBSIDIAN_WIKILINK::([^)]+)\)/g,
            (_match, name) => `![[${name}]]`
          );

          if (result.messages.length > 0) {
            const warnings = result.messages
              .filter((m) => m.type === "warning")
              .map((m) => m.message);
            if (warnings.length > 0) {
              extractedText += "\n\n<!-- 转换警告: " + warnings.join("; ") + " -->";
            }
          }
        } else if (ext === ".xlsx" || ext === ".xls") {
          const buffer = fs.readFileSync(fullPath);
          const workbook = XLSX.read(buffer);
          const sheets: string[] = [];
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            sheets.push(`## Sheet: ${sheetName}\n\n${csv}`);
          }
          extractedText = sheets.join("\n\n---\n\n");
        } else if (ext === ".pdf") {
          const { PDFParse } = await import("pdf-parse");
          const buffer = fs.readFileSync(fullPath);
          const pdf = new PDFParse(buffer);
          const result = await pdf.getText();
          extractedText = result.text;
        } else {
          extractedText = fs.readFileSync(fullPath, "utf-8");
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              filename,
              ext,
              size: stat.size,
              images: images.length,
              content: extractedText,
            }),
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              filename,
              ext,
              size: stat.size,
              error: `提取失败: ${err.message}`,
            }),
          }],
        };
      }
    }
  );
}
