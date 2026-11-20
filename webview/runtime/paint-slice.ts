import { rasterSize } from "../../shared/image-rendering";
import { nineGridPatches } from "../../shared/nine-grid";
import type { NineGrid } from "../../shared/psd-meta";

/** Shared by assembled pages, product checks and PSD nine-grid editing. */
export function paintSlice(canvas: HTMLCanvasElement, source: CanvasImageSource, size: { width: number; height: number; nineGrid: NineGrid | null }, width: number, height: number, fit: "fill" | "contain" | "cover" = "fill") {
  const raster = rasterSize(width, height);
  canvas.width = raster.width; canvas.height = raster.height;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("无法创建资源渲染画布。");
  if (width <= 0 || height <= 0) return;
  ctx.scale(canvas.width / width, canvas.height / height);
  const grid = size.nineGrid;
  if (!grid || width === size.width && height === size.height) {
    if (fit === "fill" || grid) ctx.drawImage(source, 0, 0, width, height);
    else {
      const ratio = (fit === "contain" ? Math.min : Math.max)(width / size.width, height / size.height);
      const w = size.width * ratio, h = size.height * ratio;
      ctx.drawImage(source, (width - w) / 2, (height - h) / 2, w, h);
    }
    return;
  }
  let stretchPatch: HTMLCanvasElement | undefined;
  for (const p of nineGridPatches(size.width, size.height, width, height, grid)) {
    if (p.repeatX || p.repeatY) {
      const tile = document.createElement("canvas");
      tile.width = Math.max(1, Math.round(p.repeatX ? p.sw : p.width)); tile.height = Math.max(1, Math.round(p.repeatY ? p.sh : p.height));
      const tileContext = tile.getContext("2d"); if (!tileContext) throw new Error("无法创建九宫格重复纹理。");
      tileContext.drawImage(source, p.sx, p.sy, p.sw, p.sh, 0, 0, tile.width, tile.height);
      const pattern = ctx.createPattern(tile, "repeat"); if (!pattern) throw new Error("九宫格纹理读取失败。");
      ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = pattern; ctx.fillRect(0, 0, p.width, p.height); ctx.restore();
    } else if (p.sw !== p.width || p.sh !== p.height) {
      // Canvas filtering can sample beyond a source rectangle. Isolate the patch before scaling it.
      const tile = stretchPatch ??= document.createElement("canvas");
      tile.width = p.sw; tile.height = p.sh;
      const tileContext = tile.getContext("2d"); if (!tileContext) throw new Error("无法创建九宫格拉伸纹理。");
      tileContext.drawImage(source, p.sx, p.sy, p.sw, p.sh, 0, 0, p.sw, p.sh);
      ctx.drawImage(tile, p.x, p.y, p.width, p.height);
    } else ctx.drawImage(source, p.sx, p.sy, p.sw, p.sh, p.x, p.y, p.width, p.height);
  }
}
