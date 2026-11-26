import { importedNodes, importSignature } from "./import-signature";
import { importPixels } from "./import-clipping";
import { stringFingerprint } from "../../shared/string-fingerprint";
import type { ImportedPixelCorrection } from "../../shared/psd-meta";
import type { Layer, LayerTextData, PixelData, Psd } from "ag-psd";
import { isImageData, type Frame, type GameFlowNode, type NodeStyle } from "../../shared/model";

type ImportedNode = Omit<GameFlowNode, "id" | "parentId">;
export type ImportedLayer = { node: ImportedNode; parent: number | null };
export type PsdPrototype = { width: number; height: number; layers: ImportedLayer[]; omitted: number; approximate: boolean; signature?: string; legacySignature?: string; corrections?: ImportedPixelCorrection[]; composite?: string };

export function needsImportComposite(layer: Layer): boolean {
  const text = layer.text;
  return !!(layer.artboard || layer.mask || layer.vectorMask || layer.effects || layer.clipping || layer.adjustment ||
    layer.blendMode && layer.blendMode !== "normal" && layer.blendMode !== "pass through" ||
    text && ((text.styleRuns?.length ?? 0) > 1 || (text.paragraphStyleRuns?.length ?? 0) > 1 ||
      text.warp?.style && text.warp.style !== "none"));
}

function pixelFrame(layer: Layer): Frame {
  const x = layer.left ?? 0, y = layer.top ?? 0;
  return { x, y, width: (layer.right ?? x) - x, height: (layer.bottom ?? y) - y };
}

function textStyle(text: LayerTextData): NodeStyle {
  const style = { ...text.style, ...text.styleRuns?.[0]?.style };
  const color = style.fillColor;
  const hex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  const align = text.paragraphStyleRuns?.[0]?.style.justification ?? text.paragraphStyle?.justification;
  const [x, y] = text.transform ?? [1, 0];
  const fontSize = (style.fontSize ?? 16) * Math.hypot(x, y);
  return {
    ...(color && "r" in color ? { color: "#" + [color.r, color.g, color.b].map(hex).join("") } : {}),
    ...(Number.isFinite(fontSize) ? { fontSize: Math.max(1, fontSize) } : {}),
    ...((style.fauxBold || /bold|black|heavy/i.test(style.font?.name ?? "")) ? { fontWeight: 700 } : {}),
    italic: style.fauxItalic || /italic|oblique/i.test(style.font?.name ?? ""),
    underline: style.underline,
    strikethrough: style.strikethrough,
    textAlign: align === "center" || align === "right" ? align : "left",
  };
}

function textLayoutFrame(text: LayerTextData, paragraph: boolean): Frame | undefined {
  if (!text.transform) return;
  const [scaleX, skewY, skewX, scaleY, x, y] = text.transform;
  if (skewX || skewY || scaleX <= 0 || scaleY <= 0) return;

  let box = text.boxBounds;
  if (!paragraph) {
    const bounds = text.bounds;
    if (!bounds) return;
    const edges = [bounds.left, bounds.top, bounds.right, bounds.bottom];
    if (!edges.every(edge => edge.units === "Points" || edge.units === "Pixels")) return;
    box = edges.map(edge => edge.value);
  }
  if (!box || ![...box, scaleX, scaleY, x, y].every(Number.isFinite)) return;
  const [left, top, right, bottom] = box;
  if (!(right > left && bottom > top)) return;
  return { x: x + left * scaleX, y: y + top * scaleY, width: (right - left) * scaleX, height: (bottom - top) * scaleY };
}

async function encodeImage(pixels: PixelData): Promise<{ imageData: string; approximate: boolean }> {
  const source = new OffscreenCanvas(pixels.width, pixels.height);
  const rgba = new Uint8ClampedArray(pixels.data);
  source.getContext("2d")!.putImageData(new ImageData(rgba, pixels.width, pixels.height), 0, 0);
  let canvas = source;
  for (;;) {
    const blob = await canvas.convertToBlob({ type: canvas === source ? "image/png" : "image/webp" });
    if (blob.size <= 5 * 1024 * 1024) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const imageData = `data:${blob.type};base64,${btoa(binary)}`;
      if (isImageData(imageData)) return { imageData, approximate: canvas !== source };
    }
    const scaled = new OffscreenCanvas(Math.max(1, Math.floor(canvas.width / 2)), Math.max(1, Math.floor(canvas.height / 2)));
    scaled.getContext("2d")!.drawImage(source, 0, 0, scaled.width, scaled.height);
    canvas = scaled;
  }
}

export async function readPrototypeLayers(psd: Psd, includeComposite = true): Promise<PsdPrototype> {
  const layers: ImportedLayer[] = [];
  const originals = new Map<number, string>();
  const corrections: ImportedPixelCorrection[] = [];
  let omitted = 0, approximate = false;

  async function visit(layer: Layer, parent: number | null, clipBase?: Layer): Promise<Frame | undefined> {
    const name = layer.name?.trim() || "未命名图层";
    const frame = pixelFrame(layer);
    const opacity = (layer.opacity ?? 1) * (layer.fillOpacity ?? 1);
    const style = opacity < 1 ? { opacity } : undefined;
    const base = { name, frame, ...(layer.hidden && { hidden: true }), ...(style && { style }) };
    approximate ||= needsImportComposite(layer);
    if (layer.children) {
      const index = layers.push({ node: { ...base, type: "container" }, parent }) - 1;
      const children: Frame[] = [];
      await visitSiblings(layer.children, index, children);
      if (children.length) {
        frame.x = Math.min(...children.map(child => child.x));
        frame.y = Math.min(...children.map(child => child.y));
        frame.width = Math.max(...children.map(child => child.x + child.width)) - frame.x;
        frame.height = Math.max(...children.map(child => child.y + child.height)) - frame.y;
      }
    } else if (layer.text) {
      const text = layer.text.text.replace(/\r\n?/g, "\n");
      const appearance = textStyle(layer.text);
      const size = appearance.fontSize ?? 16;
      const paragraph = layer.text.shapeType ? layer.text.shapeType === "box" : !!layer.text.boxBounds;
      const layoutFrame = textLayoutFrame(layer.text, paragraph);
      if (layoutFrame) Object.assign(frame, layoutFrame);
      else if (!frame.width || !frame.height) {
        const box = paragraph ? layer.text.boxBounds : undefined;
        frame.x = layer.text.transform?.[4] ?? frame.x;
        frame.y = (layer.text.transform?.[5] ?? frame.y) - (paragraph ? 0 : size);
        frame.width ||= box ? box[2] - box[0] : Math.max(...text.split("\n").map(line => line.length)) * size;
        frame.height ||= box ? box[3] - box[1] : text.split("\n").length * size * 1.35;
      }
      layers.push({ node: { ...base, type: "text", text, style: { ...style, ...appearance },
        widget: paragraph ? { wordWrap: true } : { wordWrap: false, overflow: "visible", ...(layoutFrame && { valign: "middle" }) } }, parent });
    } else if (layer.imageData?.width && layer.imageData.height && !layer.adjustment) {
      const pixels = importPixels(layer, clipBase);
      const image = await encodeImage(pixels);
      if (!includeComposite && pixels !== layer.imageData) {
        const original = (await encodeImage(layer.imageData)).imageData;
        originals.set(layers.length, original);
        corrections.push({ index: layers.length, name, original: stringFingerprint(original), image: image.imageData });
      }
      approximate ||= image.approximate;
      layers.push({ node: { ...base, type: "image", imageData: image.imageData }, parent });
    } else {
      omitted++;
      return;
    }
    frame.width = Math.max(1, frame.width);
    frame.height = Math.max(1, frame.height);
    return frame;
  }

  async function visitSiblings(siblings: Layer[], parent: number | null, frames?: Frame[]) {
    let base: Layer | undefined;
    for (const layer of siblings) {
      if (!layer.clipping) base = layer;
      const frame = await visit(layer, parent, base);
      if (frame) frames?.push(frame);
    }
  }
  await visitSiblings(psd.children ?? [], null);
  if (!layers.length) throw new Error("PSD 中没有可导入的图层。");
  const { width, height } = psd;
  const nodes = importedNodes(layers, layers.map((_, i) => String(i)));
  const frame = { x: 0, y: 0, width, height };
  const merged = psd.imageData;
  const hasComposite = approximate && merged && psd.imageResources?.versionInfo?.hasRealMergedData !== false &&
    merged.data.some((value, i) => i % 4 === 3 && value > 0);
  const signature = hasComposite ? importSignature({ frame, nodes }) : undefined;
  const legacySignature = hasComposite && originals.size ? importSignature({ frame, nodes: nodes.map((node, i) =>
    originals.has(i) ? { ...node, imageData: originals.get(i) } : node) }) : undefined;
  const composite = includeComposite && hasComposite ? (await encodeImage(merged)).imageData : undefined;
  return { width, height, layers, omitted, approximate, signature, legacySignature, corrections, composite };
}
