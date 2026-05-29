import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export interface ArchiveResult {
    ok: boolean;
    archivedPath?: string;
    error?: string;
}
export declare function archiveRawFile(rootDir: string, rawRelPath: string): ArchiveResult;
export declare function registerMarkProcessed(server: McpServer, rootDir: string): void;
