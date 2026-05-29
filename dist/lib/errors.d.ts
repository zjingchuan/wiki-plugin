export declare class WikiError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare class ConvertError extends WikiError {
    constructor(message: string);
}
export declare class IndexError extends WikiError {
    constructor(message: string);
}
export declare class ConfigError extends WikiError {
    constructor(message: string);
}
export declare class ArchiveError extends WikiError {
    constructor(message: string);
}
