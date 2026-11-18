import { canvasPanelMetrics, placeCanvasPanels, type CanvasSize } from "../lib/canvas-panels";
export type { CanvasSize } from "../lib/canvas-panels";
export type PsdCamera = { x: number; y: number; zoom: number };
// Match prototype panels: preserve the content top and scroll within tall panels.
const panelOptions = { leftWidth: 278, rightWidth: 278, footer: 44, minFollowHeight: 400 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const panelViewport = (viewport: CanvasSize) => {
  const topInset = Math.min(48, Math.max(0, viewport.height));
  return { size: { ...viewport, height: Math.max(0, viewport.height - topInset) }, topInset };
};

export function psdPanelMetrics(viewport: CanvasSize) {
  const { size, topInset } = panelViewport(viewport);
  return { ...canvasPanelMetrics(size, panelOptions), topInset };
}

export function fitPsdCamera(viewport: CanvasSize, image: CanvasSize): PsdCamera {
  const m = psdPanelMetrics(viewport);
  const width = Math.max(1, viewport.width - 2 * m.margin - m.leftWidth - m.rightWidth - 2 * m.gap);
  const height = Math.max(1, m.maxHeight - 26);
  const zoom = clamp(Math.min(1, width / image.width, height / image.height), .05, 8);
  return { x: m.margin + m.leftWidth + m.gap + (width - image.width * zoom) / 2, y: m.topInset + m.margin + 26 + (height - image.height * zoom) / 2, zoom };
}

export function zoomPsdCamera(camera: PsdCamera, point: { x: number; y: number }, nextZoom: number): PsdCamera {
  const zoom = clamp(nextZoom, .05, 8);
  return { x: point.x - (point.x - camera.x) * zoom / camera.zoom, y: point.y - (point.y - camera.y) * zoom / camera.zoom, zoom };
}

export function placePsdPanels(viewport: CanvasSize, image: CanvasSize, camera: PsdCamera, heights: { left: number; right: number }) {
  const { size, topInset } = panelViewport(viewport);
  const panels = placeCanvasPanels(size, { x: camera.x, y: camera.y - topInset, width: image.width * camera.zoom }, heights, panelOptions);
  return { left: { ...panels.left, top: panels.left.top + topInset }, right: { ...panels.right, top: panels.right.top + topInset } };
}
