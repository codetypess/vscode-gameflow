import type { Layer, LinkedFile } from "ag-psd";
import { listCellOffset, listCellPositions, listScrollType } from "../../shared/list-cell";
import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import type { ResolvedNode } from "../../shared/ui-layout";
import { framePolygon, intersectPolygons, multiply, polygonBounds, translation, type Point } from "../../shared/ui-transform";

export interface PsdCellTemplate { page: GameFlowPage; file: LinkedFile; bitmap: HTMLCanvasElement }

function trace(context: CanvasRenderingContext2D, points: Point[]) {
  context.beginPath();
  points.forEach(({ x, y }, i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
  context.closePath();
}

export function placeListCells(list: GameFlowNode, geometry: ResolvedNode, template: PsdCellTemplate,
  composite: CanvasRenderingContext2D, hidden: boolean, add: (layer: Layer, index: number) => void) {
  const grid = listCellPositions(list, geometry.local, template.page);
  const { width, height } = template.page.frame;
  const content = multiply(geometry.matrix, translation(grid.left, grid.top));
  let clip = geometry.clipPolygon;
  if (listScrollType(list) !== 0) {
    const viewport = framePolygon(content, grid.width, grid.height);
    clip = clip ? intersectPolygons(viewport, clip) : viewport;
  }
  if (!geometry.inverse || !grid.rows || !grid.columns || !template.page.nodes.length) return;
  if (grid.rows * grid.columns * template.page.nodes.length > 5000) throw new Error("列表项预览超过节点数量上限。");
  for (let index = 0; index < grid.rows * grid.columns; index++) {
    const offset = listCellOffset(grid, index);
    const matrix = multiply(content, translation(offset.x, offset.y));
    const corners = framePolygon(matrix, width, height);
    const visible = clip ? intersectPolygons(corners, clip) : corners;
    const bounds = polygonBounds(visible);
    if (bounds.width < 1e-8 || bounds.height < 1e-8) continue;
    const left = Math.floor(bounds.x), top = Math.floor(bounds.y);
    const w = Math.ceil(bounds.x + bounds.width) - left, h = Math.ceil(bounds.y + bounds.height) - top;
    if (w > 4096 || h > 4096 || w * h > 8_000_000) throw new Error("列表项智能对象超出图层尺寸范围。");
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const paint = canvas.getContext("2d")!;
    paint.translate(-left, -top);
    paint.transform(...matrix);
    paint.drawImage(template.bitmap, 0, 0, width, height);
    const layer: Layer = { name: template.page.name + " " + (index + 1), left, top, canvas,
      placedLayer: { id: template.file.id, placed: crypto.randomUUID(), type: "raster",
        width: template.bitmap.width, height: template.bitmap.height, transform: corners.flatMap(p => [p.x, p.y]) } };
    const cropped = corners.length !== visible.length || corners.some((p,i) =>
      Math.abs(p.x - visible[i].x) > 1e-7 || Math.abs(p.y - visible[i].y) > 1e-7);
    if (cropped) {
      const mask = document.createElement("canvas");
      mask.width = w; mask.height = h;
      const context = mask.getContext("2d")!;
      context.fillRect(0, 0, w, h);
      context.translate(-left, -top);
      trace(context, visible);
      context.fillStyle = "white";
      context.fill();
      layer.mask = { left, top, defaultColor: 0, canvas: mask };
    }
    add(layer, index);
    if (!hidden) {
      composite.save();
      if (cropped) { trace(composite, visible); composite.clip(); }
      composite.drawImage(canvas, left, top);
      composite.restore();
    }
  }
}
