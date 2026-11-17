import type { GameFlowNode } from "./model";
import { layoutText, type TextMeasure } from "./label-layout";
import { labelTextStyle, parseLabelRuns } from "./label-syntax";

/** Deterministic fallback for headless layout; the canvas view supplies real font widths. */
export const estimateLabelText: TextMeasure = (text, style, scale) => ({
  width: [...text].reduce((sum, char) => sum + (char.codePointAt(0)! > 255 ? 1 : .56) * style.fontSize * scale, 0),
  height: style.fontSize * scale * 1.35
});

export function layoutLabel(node: GameFlowNode, width: number | null, height: number | null, measure: TextMeasure = estimateLabelText) {
  const widget = node.widget ?? {};
  return layoutText(parseLabelRuns(node), { width, height, style: labelTextStyle(node), measure,
    wordWrap: widget.wordWrap ?? true, overflow: widget.overflow ?? "hidden",
    leading: widget.leading ?? 0, letterSpacing: widget.letterSpacing ?? 0, singleCharRender: false });
}
