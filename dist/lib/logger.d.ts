export type LogLevel = "debug" | "info" | "warn" | "error";
export declare function initLogger(root: string, level?: LogLevel): void;
export declare function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;
export declare const logger: {
    debug: (msg: string, meta?: Record<string, unknown>) => void;
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
};
