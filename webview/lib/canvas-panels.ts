export type CanvasSize = { width: number; height: number };
export interface PanelOptions {
  leftWidth: number; rightWidth: number; footer: number;
  /** Follow the content top, shrinking available height until this threshold. */
  minFollowHeight?: number;
}
const defaults: PanelOptions = { leftWidth: 278, rightWidth: 278, footer: 44 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function canvasPanelMetrics(viewport: CanvasSize, options: PanelOptions = defaults) {
  const margin = Math.min(12, viewport.width / 8, viewport.height / 8);
  const gap = Math.min(16, Math.max(0, viewport.width - 2 * margin) / 6);
  const total = options.leftWidth + options.rightWidth;
  const ratio = total ? Math.min(1, Math.max(0, viewport.width - 2 * margin - (options.leftWidth && options.rightWidth ? gap : 0)) / total) : 1;
  const footer = Math.min(options.footer, viewport.height / 4);
  return { margin, gap, leftWidth: options.leftWidth * ratio, rightWidth: options.rightWidth * ratio, maxHeight: Math.max(0, viewport.height - 2 * margin - footer), footer };
}

/** Anchors are viewport pixels; only the content scales, never panel controls. */
export function placeCanvasPanels(viewport: CanvasSize, content: { x: number; y: number; width: number }, heights: { left: number; right: number }, options: PanelOptions = defaults) {
  const m = canvasPanelMetrics(viewport, options);
  const left = clamp(content.x - m.gap - m.leftWidth, m.margin, viewport.width - m.margin - m.leftWidth - (m.rightWidth ? m.gap + m.rightWidth : 0));
  const right = clamp(content.x + content.width + m.gap, m.leftWidth ? left + m.leftWidth + m.gap : m.margin, viewport.width - m.margin - m.rightWidth);
  const bottom = viewport.height - m.footer - m.margin;
  const vertical = (height: number) => {
    if (options.minFollowHeight !== undefined) {
      const top = clamp(content.y, m.margin, bottom - Math.min(options.minFollowHeight, m.maxHeight));
      return { top, maxHeight: Math.max(0, bottom - top) };
    }
    return { top: clamp(content.y, m.margin, bottom - Math.min(height, m.maxHeight)), maxHeight: m.maxHeight };
  };
  return {
    left: { left, width: m.leftWidth, ...vertical(heights.left) },
    right: { left: right, width: m.rightWidth, ...vertical(heights.right) }
  };
}
