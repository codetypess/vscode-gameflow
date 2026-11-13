export type CanvasSize = { width: number; height: number };
export type PsdCamera = { x: number; y: number; zoom: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function psdPanelMetrics(viewport: CanvasSize) {
  const margin = Math.min(12, viewport.width / 8, viewport.height / 8);
  const gap = Math.min(16, Math.max(0, viewport.width - 2 * margin) / 6);
  const panelWidth = Math.min(278, Math.max(0, viewport.width - 2 * margin - gap) / 2);
  const footer = Math.min(44, viewport.height / 4);
  return { margin, gap, leftWidth: panelWidth, rightWidth: panelWidth, maxHeight: Math.max(0, viewport.height - 2 * margin - footer), footer };
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
  const m = psdPanelMetrics(viewport);
  // Reserve the other panel's width even when the entire PSD is panned off screen.
  const left = clamp(camera.x - m.gap - m.leftWidth, m.margin, viewport.width - m.margin - m.leftWidth - m.gap - m.rightWidth);
  const right = clamp(camera.x + image.width * camera.zoom + m.gap, left + m.leftWidth + m.gap, viewport.width - m.margin - m.rightWidth);
  const top = (height: number) => clamp(camera.y, m.margin, viewport.height - m.footer - m.margin - Math.min(height, m.maxHeight));
  return {
    left: { left, top: top(heights.left), width: m.leftWidth, maxHeight: m.maxHeight },
    right: { left: right, top: top(heights.right), width: m.rightWidth, maxHeight: m.maxHeight }
  };
}
