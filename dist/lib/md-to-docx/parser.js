import { Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, HeadingLevel, BorderStyle, WidthType, ExternalHyperlink, } from "docx";
import { FONTS, COLORS, codeBlockShading, tableBorders, tableHeaderShading } from "./styles.js";
const HEADING_LEVELS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
];
const MAX_IMAGE_WIDTH_PX = 530;
/**
 * Convert marked tokens into an array of docx FileChild elements.
 */
export function tokensToDocxBlocks(tokens, ctx) {
    const blocks = [];
    for (const token of tokens) {
        const result = convertBlock(token, ctx);
        if (result) {
            if (Array.isArray(result)) {
                blocks.push(...result);
            }
            else {
                blocks.push(result);
            }
        }
    }
    return blocks;
}
function convertBlock(token, ctx) {
    switch (token.type) {
        case "heading":
            return convertHeading(token, ctx);
        case "paragraph":
            return convertParagraph(token, ctx);
        case "list":
            return convertList(token, ctx);
        case "code":
            return convertCode(token);
        case "blockquote":
            return convertBlockquote(token, ctx);
        case "table":
            return convertTable(token, ctx);
        case "hr":
            return convertHr();
        case "space":
            return null;
        default:
            return null;
    }
}
function convertHeading(token, ctx) {
    const level = Math.min(token.depth + ctx.headingOffset, 6) - 1;
    const heading = HEADING_LEVELS[Math.max(0, Math.min(level, 5))];
    return new Paragraph({
        heading,
        children: inlineTokensToRuns(token.tokens ?? [], ctx),
    });
}
function convertParagraph(token, ctx) {
    return new Paragraph({
        children: inlineTokensToRuns(token.tokens ?? [], ctx),
    });
}
function convertList(token, ctx) {
    const paragraphs = [];
    token.items.forEach((item, idx) => {
        const prefix = token.ordered ? `${(token.start || 1) + idx}. ` : "• ";
        const runs = inlineTokensFromListItem(item, ctx);
        paragraphs.push(new Paragraph({
            indent: { left: 360 },
            children: [new TextRun({ text: prefix }), ...runs],
        }));
    });
    return paragraphs;
}
function convertCode(token) {
    return new Paragraph({
        shading: codeBlockShading(),
        children: [
            new TextRun({
                text: token.text,
                font: FONTS.code,
                size: 20,
            }),
        ],
    });
}
function convertBlockquote(token, ctx) {
    // Flatten blockquote tokens into inline runs
    const runs = [];
    for (const child of token.tokens ?? []) {
        if (child.type === "paragraph") {
            runs.push(...inlineTokensToRuns(child.tokens ?? [], ctx));
        }
    }
    return new Paragraph({
        indent: { left: 360 },
        border: {
            left: { style: BorderStyle.SINGLE, size: 12, color: COLORS.quoteBorder },
        },
        children: runs,
    });
}
function convertTable(token, ctx) {
    const colCount = token.header.length;
    const colWidth = Math.floor(100 / colCount);
    // Header row
    const headerCells = token.header.map((cell) => new TableCell({
        shading: tableHeaderShading(),
        width: { size: colWidth, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: inlineTokensToRuns(cell.tokens, ctx) })],
    }));
    const headerRow = new TableRow({ children: headerCells });
    // Data rows
    const dataRows = token.rows.map((row) => {
        const cells = row.map((cell) => new TableCell({
            width: { size: colWidth, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: inlineTokensToRuns(cell.tokens, ctx) })],
        }));
        return new TableRow({ children: cells });
    });
    return new Table({
        rows: [headerRow, ...dataRows],
        borders: tableBorders(),
        width: { size: 100, type: WidthType.PERCENTAGE },
    });
}
function convertHr() {
    return new Paragraph({
        border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999" },
        },
        children: [],
    });
}
function inlineTokensToRuns(tokens, ctx) {
    const runs = [];
    for (const token of tokens) {
        runs.push(...convertInline(token, ctx, {}));
    }
    return runs;
}
function inlineTokensFromListItem(item, ctx) {
    const runs = [];
    for (const child of item.tokens ?? []) {
        if (child.type === "text") {
            const textToken = child;
            if (textToken.tokens) {
                runs.push(...inlineTokensToRuns(textToken.tokens, ctx));
            }
            else {
                runs.push(new TextRun({ text: textToken.text }));
            }
        }
        else {
            runs.push(...convertInline(child, ctx, {}));
        }
    }
    return runs;
}
function convertInline(token, ctx, style) {
    switch (token.type) {
        case "text": {
            const t = token;
            if (t.tokens) {
                return t.tokens.flatMap((child) => convertInline(child, ctx, style));
            }
            return [new TextRun({ text: t.text, ...style })];
        }
        case "strong": {
            const t = token;
            return (t.tokens ?? []).flatMap((child) => convertInline(child, ctx, { ...style, bold: true }));
        }
        case "em": {
            const t = token;
            return (t.tokens ?? []).flatMap((child) => convertInline(child, ctx, { ...style, italics: true }));
        }
        case "codespan": {
            const t = token;
            return [new TextRun({ text: t.text, font: FONTS.code, ...style })];
        }
        case "link": {
            const t = token;
            return [
                new ExternalHyperlink({
                    link: t.href,
                    children: [new TextRun({ text: t.text, color: "0563C1" })],
                }),
            ];
        }
        case "image":
            return convertImageInline(token, ctx);
        case "br":
            return [new TextRun({ text: "", break: 1 })];
        default:
            if ("text" in token && typeof token.text === "string") {
                return [new TextRun({ text: token.text, ...style })];
            }
            return [];
    }
}
function convertImageInline(token, ctx) {
    const resolved = ctx.imageResolver(token.href);
    if (!resolved) {
        ctx.warnings.push(`Image not found: ${token.href}`);
        return [new TextRun({ text: `[图片缺失: ${token.href}]`, italics: true })];
    }
    // Scale proportionally to fit max width
    let { width, height } = resolved;
    if (width > MAX_IMAGE_WIDTH_PX) {
        const ratio = MAX_IMAGE_WIDTH_PX / width;
        width = MAX_IMAGE_WIDTH_PX;
        height = Math.round(height * ratio);
    }
    return [
        new ImageRun({
            data: resolved.buffer,
            transformation: { width, height },
            type: "png",
        }),
    ];
}
