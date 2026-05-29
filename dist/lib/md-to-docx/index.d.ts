export interface ConvertOptions {
    rootDir: string;
    inputs: string[];
    mode: "single" | "merged";
    output?: string;
}
export interface ConvertResult {
    success: boolean;
    files: string[];
    warnings: string[];
}
export declare function convertToDocx(options: ConvertOptions): Promise<ConvertResult>;
