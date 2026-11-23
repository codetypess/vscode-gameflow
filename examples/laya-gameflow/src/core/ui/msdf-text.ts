import { LayoutError } from "./layout";
import type { TextGlyph, TextMeasuredPiece } from "./text-layout";

const reportedMissingGlyphs = new WeakMap<Laya.MSDFFont, Set<number>>();
const MISSING_GLYPH_CODE_POINT = 0x25a1;

function getGlyph(font: Laya.MSDFFont, text: string): Laya.MSDFFontGlyph | null {
    const code = text.codePointAt(0)!;
    let glyph = font.getGlyph(code);
    if (!glyph) {
        glyph = font.getGlyph(MISSING_GLYPH_CODE_POINT);
        let reported = reportedMissingGlyphs.get(font);
        if (!reported) {
            reported = new Set<number>();
            reportedMissingGlyphs.set(font, reported);
        }
        if (!reported.has(code)) {
            reported.add(code);
            console.warn(
                `UILabel MSDF font '${font.url}' has no glyph for ${JSON.stringify(text)} ` +
                    `(U+${code.toString(16).toUpperCase()}); ` +
                    (glyph ? "using □ (U+25A1)" : "skipped")
            );
        }
    }
    return glyph;
}

/** 测量结果直接交给现有文本布局；保留负字距的覆盖范围与有符号推进。 */
export function measureMSDFText(
    font: Laya.MSDFFont,
    text: string,
    size: number,
    spacing: number
): TextMeasuredPiece & { glyphs: TextGlyph[] } {
    const factor = size / font.metrics.emSize;
    const glyphs: TextGlyph[] = [];
    let advance = 0;
    let left = 0;
    let right = 0;
    let previous: number | null = null;
    for (const char of Array.from(text)) {
        const glyph = getGlyph(font, char);
        if (!glyph) {
            continue;
        }
        const kern = previous === null ? 0 : font.getKerning(previous, glyph.unicode) * factor;
        const x = advance + kern + (previous === null ? 0 : spacing);
        const width = glyph.advance * factor;
        if (!Number.isFinite(width) || width < 0) {
            throw new LayoutError("UILabel MSDF glyph advance must be finite and non-negative");
        }
        glyphs.push({ text: String.fromCodePoint(glyph.unicode), x, width });
        advance = x + width;
        left = Math.min(left, x);
        right = Math.max(right, advance);
        previous = glyph.unicode;
    }
    return {
        width: right - left,
        height: font.metrics.lineHeight * factor,
        advance,
        offsetX: left,
        glyphs,
    };
}

/** 在 UILabel 自身 Graphics 上绘制，不创建 MSDFText 节点。 */
export function drawMSDFText(
    graphics: Laya.Graphics,
    font: Laya.MSDFFont,
    glyphs: TextGlyph[],
    style: Laya.TextStyle,
    x: number,
    y: number,
    size: number,
    stroke: number
): void {
    const factor = size / font.metrics.emSize;
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const edge = Math.max(1, Math.min(255, Math.round(510 / (font.msdf.distanceRange * factor))));
    const baseline = y + font.metrics.ascender * factor;
    const skew = style.italic ? Math.tan(Math.PI / 15) : 0;

    const append = (offsetX: number, offsetY: number, color: string) => {
        const fill = Laya.ColorUtils.create(color).numColor;
        for (const position of glyphs) {
            const glyph = getGlyph(font, position.text);
            if (!glyph || glyph.empty) {
                continue;
            }
            const bounds = glyph.planeBounds;
            const x0 = x + position.x + bounds[0] * factor + offsetX;
            const x1 = x + position.x + bounds[2] * factor + offsetX;
            const y0 = baseline - bounds[3] * factor + offsetY;
            const y1 = baseline - bounds[1] * factor + offsetY;
            const topSkew = skew * (baseline - y0);
            const bottomSkew = skew * (baseline - y1);
            const base = vertices.length / 2;
            vertices.push(
                x0 + topSkew,
                y0,
                x1 + topSkew,
                y0,
                x1 + bottomSkew,
                y1,
                x0 + bottomSkew,
                y1
            );
            const uv = glyph.uv;
            const v0 = font.yOrigin === "bottom" ? 1 - uv[3] : uv[1];
            const v1 = font.yOrigin === "bottom" ? 1 - uv[1] : uv[3];
            uvs.push(uv[0], v0, uv[2], v0, uv[2], v1, uv[0], v1);
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
            colors.push(fill, fill, fill, fill);
        }
    };

    // 当前引擎 MSDF shader 没有可调描边宽度，偏移轮廓与主字形合并到一个网格。
    if (stroke > 0) {
        for (let index = 0; index < 8; index++) {
            const angle = (index * Math.PI) / 4;
            append(Math.cos(angle) * stroke, Math.sin(angle) * stroke, style.strokeColor);
        }
    }
    if (style.bold) {
        append(size / 32, 0, style.color);
    }
    append(0, 0, style.color);
    if (!vertices.length) {
        return;
    }
    const count = vertices.length / 2;
    const empty = new Uint32Array(count);
    graphics.drawTrianglesMSDF(
        font.atlas,
        0,
        0,
        new Float32Array(vertices),
        new Float32Array(uvs),
        new Uint32Array(indices),
        new Uint32Array(colors),
        empty,
        empty,
        empty,
        new Uint32Array(count).fill(edge),
        empty
    );
}
