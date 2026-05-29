export declare class MermaidNotInstalledError extends Error {
    constructor();
}
export declare function isMermaidAvailable(): boolean;
export declare function renderMermaidToPng(code: string, outputDir: string): Promise<string>;
