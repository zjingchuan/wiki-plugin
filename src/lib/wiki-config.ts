import * as fs from "fs";
import * as path from "path";
import { resolveFromRoot, ensureDir, WIKI_DIR } from "./paths.js";

export interface CategoryConfig {
  name: string;
  description: string;
}

export interface WikiConfig {
  version: number;
  categories: CategoryConfig[];
}

const CONFIG_FILE = path.join(WIKI_DIR, "config.json");

export function defaultConfig(): WikiConfig {
  return {
    version: 1,
    categories: [
      { name: "产品", description: "需求、PRD、用户手册、产品介绍" },
      { name: "技术", description: "架构、接口、数据库、技术方案" },
      { name: "运维", description: "部署、监控、安全、合规" },
    ],
  };
}

export function readWikiConfig(rootDir: string): WikiConfig {
  const filePath = resolveFromRoot(rootDir, CONFIG_FILE);
  if (!fs.existsSync(filePath)) return defaultConfig();
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as WikiConfig;
}

export function writeWikiConfig(rootDir: string, config: WikiConfig): void {
  const filePath = resolveFromRoot(rootDir, CONFIG_FILE);
  ensureDir(resolveFromRoot(rootDir, WIKI_DIR));
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
}

export function getCategories(rootDir: string): string[] {
  return readWikiConfig(rootDir).categories.map((c) => c.name);
}

export function getCategoriesWithDescription(rootDir: string): CategoryConfig[] {
  return readWikiConfig(rootDir).categories;
}
