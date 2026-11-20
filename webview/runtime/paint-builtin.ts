import type { BuiltinImage } from "../../shared/image-slots";
import { DEFAULT_IMAGE_ID, DEFAULT_IMAGE_BACKGROUND, DEFAULT_IMAGE_INK, rasterSize } from "../../shared/image-rendering";
import { paintSlice } from "./paint-slice";

export function paintBuiltin(canvas: HTMLCanvasElement, source: CanvasImageSource, image: BuiltinImage, width: number, height: number, fit: "fill" | "contain" | "cover" = "fill") {
  if (image.id !== DEFAULT_IMAGE_ID) return paintSlice(canvas, source, image, width, height, fit);
  const size = rasterSize(width, height);
  canvas.width = size.width; canvas.height = size.height;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("无法创建资源渲染画布。");
  if (width <= 0 || height <= 0) return;
  ctx.scale(canvas.width / width, canvas.height / height);
  ctx.fillStyle = DEFAULT_IMAGE_BACKGROUND; ctx.fillRect(0, 0, width, height);
  const iconWidth = Math.min(32, width / 2, height / 2 * 28 / 24), scale = iconWidth / 28;
  ctx.translate((width - iconWidth) / 2, (height - scale * 24) / 2); ctx.scale(scale, scale);
  ctx.strokeStyle = DEFAULT_IMAGE_INK; ctx.fillStyle = DEFAULT_IMAGE_INK;
  ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath(); ctx.roundRect(1, 1, 26, 22, 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(8, 8, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2, 21); ctx.lineTo(11, 12); ctx.lineTo(17, 18); ctx.lineTo(22, 13); ctx.lineTo(26, 17); ctx.stroke();
}
