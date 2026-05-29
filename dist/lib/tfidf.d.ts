export interface TfidfDoc {
    id: string;
    terms: string[];
}
export interface TfidfIndex {
    docs: TfidfDoc[];
    idf: Map<string, number>;
    vectors: Map<string, Map<string, number>>;
}
export declare function tokenize(text: string): string[];
export declare function buildIndex(docs: Array<{
    id: string;
    text: string;
}>): TfidfIndex;
export declare function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number;
export declare function queryIndex(index: TfidfIndex, queryText: string, topK?: number): Array<{
    id: string;
    score: number;
}>;
