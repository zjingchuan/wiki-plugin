export declare function stripFrontmatter(md: string): string;
export declare function normalizeWikilinks(md: string): string;
export interface MermaidBlock {
    index: number;
    code: string;
}
export interface ExtractMermaidResult {
    text: string;
    blocks: MermaidBlock[];
}
export declare function extractMermaidBlocks(md: string): ExtractMermaidResult;
