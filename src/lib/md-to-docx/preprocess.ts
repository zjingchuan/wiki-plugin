export function stripFrontmatter(md: string): string {
  const match = md.match(/^---\n([\s\S]*?)\n---\n*/);
  if (!match) return md;
  return md.slice(match[0].length);
}

export function normalizeWikilinks(md: string): string {
  return md.replace(/\[\[([^\]]+)\]\]/g, (_match, inner) => {
    const aliasIdx = inner.indexOf("|");
    if (aliasIdx >= 0) {
      return inner.slice(aliasIdx + 1).trim();
    }
    const segments = inner.split("/");
    return segments[segments.length - 1].trim();
  });
}

export interface MermaidBlock {
  index: number;
  code: string;
}

export interface ExtractMermaidResult {
  text: string;
  blocks: MermaidBlock[];
}

export function extractMermaidBlocks(md: string): ExtractMermaidResult {
  const blocks: MermaidBlock[] = [];
  const text = md.replace(/```mermaid\n([\s\S]*?)\n```/g, (_match, code) => {
    const idx = blocks.length;
    blocks.push({ index: idx, code: code.trim() });
    return `<!--MERMAID_PLACEHOLDER_${idx}-->`;
  });
  return { text, blocks };
}
