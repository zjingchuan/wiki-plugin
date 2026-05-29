import type { Token } from "marked";
import { type FileChild } from "docx";
export interface ParserContext {
    imageBaseDir: string;
    imageResolver: (href: string) => {
        path: string;
        buffer: Buffer;
        width: number;
        height: number;
    } | null;
    warnings: string[];
    headingOffset: number;
}
/**
 * Convert marked tokens into an array of docx FileChild elements.
 */
export declare function tokensToDocxBlocks(tokens: Token[], ctx: ParserContext): FileChild[];
