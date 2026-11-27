import { panelMinimum, type PanelSide, type PanelWidths } from "../../shared/panel-width";
export type CanvasSize = { width: number; height: number };
interface PanelAnchors {
  viewportWidth: number; contentX: number; contentWidth: number;
  left: number; right: number;
}
export interface PanelPreferences {
  preferredWidths?: PanelWidths;
  resizeAnchor?: { edges: PanelAnchors; side: PanelSide; otherWidth: number };
}
export interface PanelOptions extends PanelPreferences {
  leftWidth: number; rightWidth: number; footer: number;
  /** Follow the content top, shrinking available height until this threshold. */
  minFollowHeight?: number;
}
const defaults: PanelOptions = { leftWidth: panelMinimum.slice, rightWidth: panelMinimum.slice, footer: 44 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function canvasPanelMetrics(viewport: CanvasSize, options: PanelOptions = defaults) {
  const margin = Math.min(12, viewport.width / 8, viewport.height / 8);
  const gap = Math.min(16, Math.max(0, viewport.width - 2 * margin) / 6);
  const total = options.leftWidth + options.rightWidth;
  const available = Math.max(0, viewport.width - 2 * margin - (options.leftWidth && options.rightWidth ? gap : 0));
  const ratio = total ? Math.min(1, available / total) : 1;
  const extra = (side: PanelSide, base: number) => base ? Math.max(0, (options.preferredWidths?.[side] ?? base) - base) : 0;
  const extraLeft = extra("left", options.leftWidth), extraRight = extra("right", options.rightWidth);
  const extraRatio = Math.min(1, Math.max(0, available - total) / (extraLeft + extraRight || 1));
  const footer = Math.min(options.footer, viewport.height / 4);
  return { margin, gap, leftWidth: options.leftWidth * ratio + extraLeft * extraRatio, rightWidth: options.rightWidth * ratio + extraRight * extraRatio, maxHeight: Math.max(0, viewport.height - 2 * margin - footer), footer };
}

/** Anchors are viewport pixels; only the content scales, never panel controls. */
export function placeCanvasPanels(viewport: CanvasSize, content: { x: number; y: number; width: number }, heights: { left: number; right: number }, options: PanelOptions = defaults) {
  // During a resize gesture keep the opposite edge still as the handle follows the pointer.
  const anchor = options.resizeAnchor;
  const otherVisible = anchor?.side === "left" ? options.rightWidth > 0 : options.leftWidth > 0;
  const pinned = anchor && otherVisible === (anchor.otherWidth > 0) && anchor.edges.viewportWidth === viewport.width
    && anchor.edges.contentX === content.x && anchor.edges.contentWidth === content.width ? anchor : undefined;
  const other = pinned?.side === "left" ? "right" : "left";
  const m = canvasPanelMetrics(viewport, pinned && options.preferredWidths ? { ...options, preferredWidths: { ...options.preferredWidths, [other]: pinned.otherWidth } } : options);
  const separation = m.leftWidth && m.rightWidth ? m.gap : 0;
  const end = viewport.width - m.margin;
  const rightStart = clamp(pinned ? pinned.edges.right - m.rightWidth : content.x + content.width + m.gap, m.margin + m.leftWidth + separation, end - m.rightWidth);
  const leftLimit = pinned?.side === "right" ? rightStart : end - m.rightWidth;
  const left = clamp(pinned?.edges.left ?? content.x - m.gap - m.leftWidth, m.margin, leftLimit - separation - m.leftWidth);
  const right = Math.max(rightStart, left + m.leftWidth + separation);
  const bottom = viewport.height - m.footer - m.margin;
  const vertical = (height: number) => {
    if (options.minFollowHeight !== undefined) {
      const top = clamp(content.y, m.margin, bottom - Math.min(options.minFollowHeight, m.maxHeight));
      return { top, maxHeight: Math.max(0, bottom - top) };
    }
    return { top: clamp(content.y, m.margin, bottom - Math.min(height, m.maxHeight)), maxHeight: m.maxHeight };
  };
  return {
    edges: { viewportWidth: viewport.width, contentX: content.x, contentWidth: content.width, left, right: right + m.rightWidth },
    margin: m.margin, separation,
    left: { left, width: m.leftWidth, ...vertical(heights.left) },
    right: { left: right, width: m.rightWidth, ...vertical(heights.right) }
  };
}
