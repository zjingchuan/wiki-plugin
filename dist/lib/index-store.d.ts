export interface DocEntry {
    path: string;
    title: string;
    category: string;
    tags: string[];
    outgoing: string[];
    incoming: string[];
}
export interface IndexData {
    docs: DocEntry[];
}
export declare function readIndex(rootDir: string): IndexData;
export declare function writeIndex(rootDir: string, index: IndexData): void;
export declare function upsertDoc(index: IndexData, entry: DocEntry): IndexData;
export declare function removeDoc(index: IndexData, docPath: string): IndexData;
export declare function findRelated(index: IndexData, query: string, topK?: number): DocEntry[];
export declare function rebuildIndexFromDisk(rootDir: string): IndexData;
