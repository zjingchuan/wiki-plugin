export interface CategoryConfig {
    name: string;
    description: string;
}
export interface WikiConfig {
    version: number;
    categories: CategoryConfig[];
}
export declare function defaultConfig(): WikiConfig;
export declare function readWikiConfig(rootDir: string): WikiConfig;
export declare function writeWikiConfig(rootDir: string, config: WikiConfig): void;
export declare function getCategories(rootDir: string): string[];
export declare function getCategoriesWithDescription(rootDir: string): CategoryConfig[];
