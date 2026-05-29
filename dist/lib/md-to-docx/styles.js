import { BorderStyle, ShadingType, convertInchesToTwip } from "docx";
export const FONTS = {
    body: "Microsoft YaHei",
    code: "Consolas",
};
export const COLORS = {
    codeBg: "F5F5F5",
    tableHeaderBg: "E7F0FA",
    tableBorder: "AAAAAA",
    quoteBorder: "888888",
};
export const PAGE = {
    marginTop: convertInchesToTwip(1),
    marginBottom: convertInchesToTwip(1),
    marginLeft: convertInchesToTwip(1.25),
    marginRight: convertInchesToTwip(1.25),
};
export const MAX_IMAGE_WIDTH_CM = 14;
export const STYLES = {
    default: {
        document: {
            run: { font: FONTS.body, size: 22 },
            paragraph: { spacing: { line: 360, after: 120 } },
        },
        heading1: {
            run: { font: FONTS.body, size: 36, bold: true },
            paragraph: { spacing: { before: 240, after: 120 } },
        },
        heading2: {
            run: { font: FONTS.body, size: 32, bold: true },
            paragraph: { spacing: { before: 200, after: 100 } },
        },
        heading3: {
            run: { font: FONTS.body, size: 28, bold: true },
            paragraph: { spacing: { before: 160, after: 80 } },
        },
        heading4: {
            run: { font: FONTS.body, size: 24, bold: true },
            paragraph: { spacing: { before: 120, after: 60 } },
        },
    },
};
export function tableBorders() {
    return {
        top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tableBorder },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tableBorder },
        left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tableBorder },
        right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tableBorder },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tableBorder },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tableBorder },
    };
}
export function tableHeaderShading() {
    return { type: ShadingType.CLEAR, fill: COLORS.tableHeaderBg, color: "auto" };
}
export function codeBlockShading() {
    return { type: ShadingType.CLEAR, fill: COLORS.codeBg, color: "auto" };
}
