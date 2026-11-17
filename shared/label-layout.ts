import type { LabelTextStyle } from "./label-syntax";

// Adapted from xq-client text-layout.ts (a39a700); font metrics stay injectable.

/** 排版不依赖显示树；字体测量由 UILabel 提供。 */
export type TextRun =
    | {
          text: string;
          style: LabelTextStyle;
          link?: string;
      }
    | {
          image: string;
          width: number;
          height: number;
          style: LabelTextStyle;
          link?: string;
      };

export type TextGlyph = { text: string; x: number; width: number };
export type TextPiece = {
    run: TextRun;
    width: number;
    height: number;
    /** 分段绘制起点，允许相对行起笔点为负。 */
    x: number;
    /** 覆盖范围的左边界，相对分段起笔点。 */
    offsetX: number;
    /** 最后一个字符末端的推进量，不含尾随字距，允许为负。 */
    advance: number;
    glyphs: TextGlyph[] | null;
};
export type TextLine = {
    pieces: TextPiece[];
    width: number;
    height: number;
    y: number;
    offsetX: number;
};
export type TextLayout = { lines: TextLine[]; width: number; height: number; scale: number };
export type TextMeasuredPiece = Pick<
    TextPiece,
    "width" | "height" | "advance" | "offsetX" | "glyphs"
>;
export type TextMeasurement =
    | { width: number; height: number; glyphs?: never }
    | (TextMeasuredPiece & { glyphs: TextGlyph[] });
export type TextMeasure = (text: string, style: LabelTextStyle, scale: number) => TextMeasurement;
export type TextLayoutOptions = {
    width: number | null;
    height: number | null;
    wordWrap: boolean;
    leading: number;
    letterSpacing: number;
    singleCharRender: boolean;
    overflow: string;
    style: LabelTextStyle;
    measure: TextMeasure;
};

function measurePiece(run: TextRun, scale: number, options: TextLayoutOptions): TextPiece {
    if (!("text" in run)) {
        const width = run.width * scale;
        return {
            run,
            width,
            height: run.height * scale,
            x: 0,
            offsetX: 0,
            advance: width,
            glyphs: null,
        };
    }
    const measured = options.measure(run.text, run.style, scale);
    if (measured.glyphs) {
        return {
            run,
            width: measured.width,
            height: measured.height,
            x: 0,
            offsetX: measured.offsetX,
            advance: measured.advance,
            glyphs: measured.glyphs,
        };
    }
    if (options.letterSpacing === 0 && !options.singleCharRender) {
        return { run, ...measured, x: 0, offsetX: 0, advance: measured.width, glyphs: null };
    }
    const glyphs: TextGlyph[] = [];
    let advance = 0,
        minX = 0,
        maxX = 0;
    let height = options.measure("", run.style, scale).height;
    for (const text of Array.from(run.text)) {
        const size = options.measure(text, run.style, scale);
        const x = advance + (glyphs.length ? options.letterSpacing * scale : 0);
        glyphs.push({ text, x, width: size.width });
        advance = x + size.width;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, advance);
        height = Math.max(height, size.height);
    }
    if (!Number.isFinite(advance) || !Number.isFinite(maxX - minX)) {
        throw new Error("UILabel text metrics must remain finite");
    }
    return { run, width: maxX - minX, height, x: 0, offsetX: minX, advance, glyphs };
}

function updateLine(line: TextLine, spacing: number): void {
    let advance = 0,
        minX = 0,
        maxX = 0;
    for (const [index, piece] of line.pieces.entries()) {
        piece.x = advance + (index ? spacing : 0);
        minX = Math.min(minX, piece.x + piece.offsetX);
        maxX = Math.max(maxX, piece.x + piece.offsetX + piece.width);
        advance = piece.x + piece.advance;
    }
    if (!Number.isFinite(advance) || !Number.isFinite(maxX - minX)) {
        throw new Error("UILabel line metrics must remain finite");
    }
    line.offsetX = minX;
    line.width = maxX - minX;
    if (line.pieces.length) {
        line.height = Math.max(...line.pieces.map((piece) => piece.height));
    }
}

function append(line: TextLine, run: TextRun, scale: number, options: TextLayoutOptions): void {
    const last = line.pieces[line.pieces.length - 1];
    if (
        last &&
        "text" in last.run &&
        "text" in run &&
        last.run.style === run.style &&
        last.run.link === run.link
    ) {
        line.pieces[line.pieces.length - 1] = measurePiece(
            { ...run, text: last.run.text + run.text },
            scale,
            options
        );
    } else {
        line.pieces.push(measurePiece(run, scale, options));
    }
    updateLine(line, options.letterSpacing * scale);
}

function buildLines(runs: TextRun[], scale: number, options: TextLayoutOptions): TextLayout {
    const lines: TextLine[] = [];
    const emptyHeight = options.measure("", options.style, scale).height;
    let line: TextLine = { pieces: [], width: 0, height: emptyHeight, y: 0, offsetX: 0 };
    let hasContent = false;
    let wrapped = false;
    const finish = (wrap: boolean) => {
        if (wrap) {
            const last = line.pieces[line.pieces.length - 1];
            if (last && "text" in last.run) {
                const text = last.run.text.replace(/\s+$/u, "");
                if (text) {
                    line.pieces[line.pieces.length - 1] = measurePiece(
                        { ...last.run, text },
                        scale,
                        options
                    );
                } else {
                    line.pieces.pop();
                }
                updateLine(line, options.letterSpacing * scale);
            }
        }
        lines.push(line);
        line = { pieces: [], width: 0, height: emptyHeight, y: 0, offsetX: 0 };
        wrapped = wrap;
    };
    const fits = (run: TextRun): boolean => {
        if (!options.wordWrap || options.width === null) {
            return true;
        }
        const trial = { ...line, pieces: line.pieces.map((piece) => ({ ...piece })) };
        append(trial, run, scale, options);
        return trial.width <= options.width;
    };
    for (const run of runs) {
        if (!("text" in run)) {
            if (line.pieces.length && !fits(run)) {
                finish(true);
            }
            append(line, run, scale, options);
            hasContent = true;
            continue;
        }
        // 英文单词整体换行，中文和超长单词按 Unicode 字符拆分。
        const text = run.text.replace(/\r\n?/g, "\n");
        const tokens =
            text.match(
                options.wordWrap && options.width !== null
                    ? /\n|[^\S\n]+|[a-zA-Z0-9_'’-]+|[^\sa-zA-Z0-9_'’-]+/gu
                    : /\n|[^\n]+/gu
            ) || [];
        for (const token of tokens) {
            hasContent = true;
            if (token === "\n") {
                if (!line.pieces.length) {
                    line.height = options.measure("", run.style, scale).height;
                }
                finish(false);
                line.height = options.measure("", run.style, scale).height;
                continue;
            }
            const fragment = { ...run, text: token };
            if (wrapped && !line.pieces.length && /^\s+$/.test(token)) {
                continue;
            }
            if (!fits(fragment) && line.pieces.length && /^[\sa-zA-Z0-9_'’-]+$/u.test(token)) {
                finish(true);
                if (/^\s+$/.test(token)) {
                    continue;
                }
            }
            if (fits(fragment)) {
                append(line, fragment, scale, options);
            } else {
                const chars = Array.from(token);
                let start = 0;
                while (start < chars.length) {
                    let low = 0,
                        high = chars.length - start;
                    while (low < high) {
                        const count = Math.ceil((low + high) / 2);
                        if (fits({ ...run, text: chars.slice(start, start + count).join("") })) {
                            low = count;
                        } else {
                            high = count - 1;
                        }
                    }
                    if (!low && line.pieces.length) {
                        finish(true);
                        continue;
                    }
                    const count = Math.max(1, low);
                    append(
                        line,
                        { ...run, text: chars.slice(start, start + count).join("") },
                        scale,
                        options
                    );
                    start += count;
                    if (start < chars.length) {
                        finish(true);
                    }
                }
            }
        }
    }
    if (hasContent) {
        lines.push(line);
    }
    let y = 0;
    for (const row of lines) {
        if (y < 0) {
            throw new Error("UILabel leading leaves a negative line position");
        }
        row.y = y;
        y += row.height + options.leading * scale;
    }
    return {
        lines,
        width: Math.max(0, ...lines.map((row) => row.width)),
        height: lines.length ? Math.max(0, y - options.leading * scale) : 0,
        scale,
    };
}

function removeLastCharacter(line: TextLine, scale: number, options: TextLayoutOptions): void {
    const last = line.pieces[line.pieces.length - 1];
    if ("text" in last.run && Array.from(last.run.text).length > 1) {
        line.pieces[line.pieces.length - 1] = measurePiece(
            { ...last.run, text: Array.from(last.run.text).slice(0, -1).join("") },
            scale,
            options
        );
    } else {
        line.pieces.pop();
    }
    updateLine(line, options.letterSpacing * scale);
}

/** 省略与缩小均在原测量管线上处理，绘制阶段只消费最终结果。 */
export function layoutText(runs: TextRun[], options: TextLayoutOptions): TextLayout {
    let result = buildLines(runs, 1, options);
    if (options.overflow === "shrink") {
        const fits = (layout: TextLayout) =>
            (options.width === null || layout.width <= options.width) &&
            (options.height === null || layout.height <= options.height);
        if (!fits(result)) {
            let low = 0,
                high = 1;
            for (let i = 0; i < 18; i++) {
                const scale = (low + high) / 2;
                const trial = buildLines(runs, scale, options);
                if (fits(trial)) {
                    low = scale;
                } else {
                    high = scale;
                }
            }
            result =
                low > 0
                    ? buildLines(runs, low, options)
                    : { lines: [], width: 0, height: 0, scale: 0 };
        }
    } else if (options.overflow === "ellipsis") {
        const originalCount = result.lines.length;
        if (options.height !== null) {
            result.lines = result.lines.filter((line) => line.y + line.height <= options.height!);
        }
        result.lines.forEach((line, index) => {
            if (
                (options.width === null || line.width <= options.width) &&
                !(index === result.lines.length - 1 && originalCount > result.lines.length)
            ) {
                return;
            }
            const last = line.pieces[line.pieces.length - 1];
            const marker: TextRun = {
                text: "…",
                style: last?.run.style || options.style,
                link: last?.run.link,
            };
            while (line.pieces.length) {
                const trial = { ...line, pieces: line.pieces.map((piece) => ({ ...piece })) };
                append(trial, marker, 1, options);
                if (options.width === null || trial.width <= options.width) {
                    break;
                }
                removeLastCharacter(line, 1, options);
            }
            if (options.width === null || measurePiece(marker, 1, options).width <= options.width) {
                append(line, marker, 1, options);
            }
        });
        result.width = Math.max(0, ...result.lines.map((line) => line.width));
        const last = result.lines[result.lines.length - 1];
        result.height = last ? last.y + last.height : 0;
    }
    return result;
}
