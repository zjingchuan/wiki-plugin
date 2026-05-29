export class WikiError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "WikiError";
    }
}
export class ConvertError extends WikiError {
    constructor(message) {
        super(message, "CONVERT_ERROR");
        this.name = "ConvertError";
    }
}
export class IndexError extends WikiError {
    constructor(message) {
        super(message, "INDEX_ERROR");
        this.name = "IndexError";
    }
}
export class ConfigError extends WikiError {
    constructor(message) {
        super(message, "CONFIG_ERROR");
        this.name = "ConfigError";
    }
}
export class ArchiveError extends WikiError {
    constructor(message) {
        super(message, "ARCHIVE_ERROR");
        this.name = "ArchiveError";
    }
}
