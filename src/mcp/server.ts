import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerListPending } from "./tools/list-pending.js";
import { registerReadRawFile } from "./tools/read-raw-file.js";
import { registerWriteDoc } from "./tools/write-doc.js";
import { registerMarkProcessed } from "./tools/mark-processed.js";
import { registerFindRelated } from "./tools/find-related.js";
import { registerListAllDocs } from "./tools/list-all-docs.js";
import { registerUpdateWikilinks } from "./tools/update-wikilinks.js";
import { registerRebuildIndex } from "./tools/rebuild-index.js";
import { registerExportDocx } from "./tools/export-docx.js";
import { registerInitConfig } from "./tools/init-config.js";
import { registerUnprocessDoc } from "./tools/unprocess-doc.js";
import { registerReconvertImages } from "./tools/reconvert-images.js";
import { initLogger } from "../lib/logger.js";

const server = new McpServer({
  name: "wiki-plugin",
  version: "0.5.0",
});

const rootDir = process.cwd();
initLogger(rootDir);

registerListPending(server, rootDir);
registerReadRawFile(server, rootDir);
registerWriteDoc(server, rootDir);
registerMarkProcessed(server, rootDir);
registerFindRelated(server, rootDir);
registerListAllDocs(server, rootDir);
registerUpdateWikilinks(server, rootDir);
registerRebuildIndex(server, rootDir);
registerExportDocx(server, rootDir);
registerInitConfig(server, rootDir);
registerUnprocessDoc(server, rootDir);
registerReconvertImages(server, rootDir);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
