export interface ProcessedEntry {
    hash: string;
    outputs: string[];
    processedAt: string;
}
export interface StateData {
    version: number;
    processed: Record<string, ProcessedEntry>;
}
export declare function readState(rootDir: string): StateData;
export declare function writeState(rootDir: string, state: StateData): void;
export declare function computeFileHash(filePath: string): string;
export declare function isProcessed(state: StateData, rawRelPath: string, hash: string): boolean;
export declare function markProcessed(state: StateData, rawRelPath: string, hash: string, outputs: string[]): StateData;
