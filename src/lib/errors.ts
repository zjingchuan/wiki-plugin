export class WikiError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "WikiError";
  }
}

export class ConvertError extends WikiError {
  constructor(message: string) {
    super(message, "CONVERT_ERROR");
    this.name = "ConvertError";
  }
}

export class IndexError extends WikiError {
  constructor(message: string) {
    super(message, "INDEX_ERROR");
    this.name = "IndexError";
  }
}

export class ConfigError extends WikiError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class ArchiveError extends WikiError {
  constructor(message: string) {
    super(message, "ARCHIVE_ERROR");
    this.name = "ArchiveError";
  }
}
