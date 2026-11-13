import { canvasPanelMetrics, placeCanvasPanels, type CanvasSize } from "../lib/canvas-panels";
export type { CanvasSize } from "../lib/canvas-panels";
export type PsdCamera = { x: number; y: number; zoom: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function psdPanelMetrics(viewport: CanvasSize) {
  return canvasPanelMetrics(viewport);
}

export function fitPsdCamera(viewport: CanvasSize, image: CanvasSize): PsdCamera {
  const m = psdPanelMetrics(viewport);
  const width = Math.max(1, viewport.width - 2 * m.margin - m.leftWidth - m.rightWidth - 2 * m.gap);
  const height = Math.max(1, m.maxHeight - 26);
  const zoom = clamp(Math.min(1, width / image.width, height / image.height), .05, 8);
  return { x: m.margin + m.leftWidth + m.gap + (width - image.width * zoom) / 2, y: m.margin + 26 + (height - image.height * zoom) / 2, zoom };
}

export function zoomPsdCamera(camera: PsdCamera, point: { x: number; y: number }, nextZoom: number): PsdCamera {
  const zoom = clamp(nextZoom, .05, 8);
  return { x: point.x - (point.x - camera.x) * zoom / camera.zoom, y: point.y - (point.y - camera.y) * zoom / camera.zoom, zoom };
}

export function placePsdPanels(viewport: CanvasSize, image: CanvasSize, camera: PsdCamera, heights: { left: number; right: number }) {
  return placeCanvasPanels(viewport, { x: camera.x, y: camera.y, width: image.width * camera.zoom }, heights);
}
