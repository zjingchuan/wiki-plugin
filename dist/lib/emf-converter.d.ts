export type ToolKind = "soffice" | "magick" | "none";
export interface ToolInfo {
    kind: ToolKind;
    path?: string;
}
export interface ConvertResult {
    source: string;
    success: boolean;
    output?: string;
    fromCache?: boolean;
    error?: string;
}
export interface ConvertReport {
    total: number;
    succeeded: number;
    failed: number;
    fromCache: number;
    toolUsed: ToolKind;
    setupHint?: string;
    results: ConvertResult[];
}
export declare const SETUP_HINT = "\u672A\u68C0\u6D4B\u5230 LibreOffice \u6216 ImageMagick\u3002\nObsidian \u65E0\u6CD5\u76F4\u63A5\u6E32\u67D3 EMF/WMF \u77E2\u91CF\u56FE\u3002\n\u5EFA\u8BAE\u5B89\u88C5 LibreOffice\uFF08\u63A8\u8350\uFF09\uFF1Ahttps://www.libreoffice.org/download/\n\u5B89\u88C5\u540E\u8FD0\u884C /wiki-reconvert-images \u8865\u8F6C\u6240\u6709\u672A\u6E32\u67D3\u7684\u56FE\u3002";
export declare function resetToolCache(): void;
export declare function detectTool(): ToolInfo;
export declare function isEmfFile(filePath: string): boolean;
export declare function convertBatch(emfPaths: string[], options: {
    rootDir: string;
    timeoutMs?: number;
    onProgress?: (done: number, total: number) => void;
}): Promise<ConvertReport>;
