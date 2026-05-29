export interface HistoryEntry {
    timestamp: string;
    action: string;
    details: Record<string, unknown>;
}
export interface HistoryData {
    entries: HistoryEntry[];
}
export declare function readHistory(rootDir: string): HistoryData;
export declare function appendHistory(rootDir: string, action: string, details: Record<string, unknown>): void;
