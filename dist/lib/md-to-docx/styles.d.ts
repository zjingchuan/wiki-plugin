import { IStylesOptions } from "docx";
export declare const FONTS: {
    body: string;
    code: string;
};
export declare const COLORS: {
    codeBg: string;
    tableHeaderBg: string;
    tableBorder: string;
    quoteBorder: string;
};
export declare const PAGE: {
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
};
export declare const MAX_IMAGE_WIDTH_CM = 14;
export declare const STYLES: IStylesOptions;
export declare function tableBorders(): {
    top: {
        style: "single";
        size: number;
        color: string;
    };
    bottom: {
        style: "single";
        size: number;
        color: string;
    };
    left: {
        style: "single";
        size: number;
        color: string;
    };
    right: {
        style: "single";
        size: number;
        color: string;
    };
    insideHorizontal: {
        style: "single";
        size: number;
        color: string;
    };
    insideVertical: {
        style: "single";
        size: number;
        color: string;
    };
};
export declare function tableHeaderShading(): {
    type: "clear";
    fill: string;
    color: string;
};
export declare function codeBlockShading(): {
    type: "clear";
    fill: string;
    color: string;
};
