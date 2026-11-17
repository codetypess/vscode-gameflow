/// <reference lib="dom" />
import type { CSSProperties } from "react";
import type { GameFlowNode } from "../../shared/model";
import { estimateLabelText, layoutLabel } from "../../shared/label-text";
import type { TextMeasure } from "../../shared/label-layout";

let context: CanvasRenderingContext2D | null | undefined;
const measure: TextMeasure = (text, style, scale) => {
  if (context === undefined) context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!context) return estimateLabelText(text, style, scale);
  context.font = `${style.italic ? "italic " : ""}${style.fontWeight} ${style.fontSize * scale}px "Segoe UI", "Microsoft YaHei", sans-serif`;
  return { width: context.measureText(text).width, height: style.fontSize * scale * 1.35 };
};
const alignOffset = (align: string | undefined, space: number) => space * (align === "middle" || align === "center" ? .5 : align === "right" || align === "bottom" ? 1 : 0);

export function LabelView({ node, width, height }: { node: GameFlowNode; width: number; height: number }) {
  const widget = node.widget ?? {};
  try {
    const result = layoutLabel(node, width, height, measure);
    const scrollX = widget.overflow === "scroll" ? Math.min(widget.scrollX ?? 0, Math.max(0, result.width - width)) : 0;
    const scrollY = widget.overflow === "scroll" ? Math.min(widget.scrollY ?? 0, Math.max(0, result.height - height)) : 0;
    const offsetY = alignOffset(widget.valign ?? "top", height - result.height) - scrollY;
    return <span className="label-content" data-text-scale={result.scale}>{result.lines.flatMap((line, row) => {
      const left = alignOffset(node.style?.textAlign ?? "left", width - line.width) - line.offsetX - scrollX;
      return line.pieces.map((piece, index) => {
        const run = piece.run, textStyle = run.style;
        const style: CSSProperties = { position: "absolute", left: left + piece.x, top: offsetY + line.y + Math.max(0, line.height - piece.height) * .5,
          fontSize: textStyle.fontSize * result.scale, fontWeight: textStyle.fontWeight, fontStyle: textStyle.italic ? "italic" : "normal", color: textStyle.color,
          lineHeight: `${piece.height}px`, whiteSpace: "pre", textDecorationLine: [textStyle.underline && "underline", textStyle.strikethrough && "line-through"].filter(Boolean).join(" ") || "none",
          WebkitTextStroke: textStyle.stroke ? `${textStyle.stroke * result.scale}px ${textStyle.strokeColor ?? "#000000"}` : undefined };
        if (!("text" in run)) return <span key={`${row}-${index}`} className="label-inline-image" style={{ ...style, width: piece.width, height: piece.height }} title={`内联图片：${run.image}`}>▧</span>;
        return <span key={`${row}-${index}`} style={style}>{piece.glyphs ? piece.glyphs.map((glyph, i) => <span key={i} style={{ position: "absolute", left: glyph.x, textDecorationLine: style.textDecorationLine }}>{glyph.text}</span>) : run.text}</span>;
      });
    })}</span>;
  } catch (error) {
    return <span className="label-layout-error" title={String(error)} role="status">文字排版错误</span>;
  }
}
