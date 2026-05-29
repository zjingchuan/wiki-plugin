export function stripFrontmatter(md) {
    const match = md.match(/^---\n([\s\S]*?)\n---\n*/);
    if (!match)
        return md;
    return md.slice(match[0].length);
}
export function normalizeWikilinks(md) {
    return md.replace(/\[\[([^\]]+)\]\]/g, (_match, inner) => {
        const aliasIdx = inner.indexOf("|");
        if (aliasIdx >= 0) {
            return inner.slice(aliasIdx + 1).trim();
        }
        const segments = inner.split("/");
        return segments[segments.length - 1].trim();
    });
}
export function extractMermaidBlocks(md) {
    const blocks = [];
    const text = md.replace(/```mermaid\n([\s\S]*?)\n```/g, (_match, code) => {
        const idx = blocks.length;
        blocks.push({ index: idx, code: code.trim() });
        return `<!--MERMAID_PLACEHOLDER_${idx}-->`;
    });
    return { text, blocks };
}
