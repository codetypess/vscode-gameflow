import { importedNodes, importSignature } from "./import-signature";
import { importPixels } from "./import-clipping";
import { stringFingerprint } from "../../shared/string-fingerprint";
import { PSD_BLEND_MODES, type PsdPaintEffect, type PsdPaint } from "../../shared/psd-paint";
import { paintContent } from "./import-signature";
import type { Color } from "ag-psd";
import type { ImportedPixelCorrection, ImportLayerFlag } from "../../shared/psd-meta";
import type { Layer, LayerTextData, PixelData, Psd } from "ag-psd";
import { isImageData, type Frame, type GameFlowNode, type NodeStyle } from "../../shared/model";

type ImportedNode = Omit<GameFlowNode, "id" | "parentId">;
export type ImportedLayer = { node: ImportedNode; parent: number | null; rasterEffect?: boolean };
export type PsdPrototype = { width: number; height: number; layers: ImportedLayer[]; omitted: number; approximate: boolean; signature?: string; legacySignature?: string; flags: ImportLayerFlag[]; corrections?: ImportedPixelCorrection[]; composite?: string };

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

export async function readPrototypeLayers(psd: Psd, records: readonly { key: number; name: string; nativeId: number | null }[], includeComposite = true): Promise<PsdPrototype> {
  const layers: ImportedLayer[] = [];
  const originals = new Map<number, string>();
  const corrections: ImportedPixelCorrection[] = [];
  const keys = new Map<Layer, number>();
  const indexSource = (siblings: Layer[]) => {
    for (const layer of [...siblings].reverse()) {
      const record = records[keys.size];
      if (!record || record.name !== layer.name || record.nativeId !== (layer.id ?? null)) throw new Error("无法确认 PSD 图层顺序。");
      keys.set(layer, record.key);
      if (layer.children) indexSource(layer.children);
    }
  };
  indexSource(psd.children ?? []);
  const flags: ImportLayerFlag[] = [];
  let omitted = 0, approximate = false;

  async function visit(layer: Layer, parent: number | null, clipBase?: Layer): Promise<Frame | undefined> {
    const index = layers.length;
    const name = layer.name?.trim() || "未命名图层";
    const frame = pixelFrame(layer), originalFrame = { ...frame };
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
    const paint: PsdPaint = { key: keys.get(layer)! };
    const blend = layer.blendMode?.replaceAll(" ", "-");
    if (blend && PSD_BLEND_MODES.includes(blend)) paint.blend = blend;
    if (layer.clipping && clipBase) paint.clipBase = keys.get(clipBase);
    const effects = paintEffects(layer, psd.imageResources?.globalAngle ?? 120);
    if (effects.length) paint.effects = effects;
    if (!layer.children && !layer.clipping && layer.effects && !layer.effects.disabled) {
      layers[index].rasterEffect = Object.entries(layer.effects).some(([kind, value]) =>
        !["stroke", "innerShadow", "dropShadow"].includes(kind) && [value].flat().some(fx => fx?.enabled) ||
        kind === "stroke" && [value].flat().some(fx => fx?.enabled && fx.fillType !== "color"));
    }
    if (layer.text && layer.imageData?.width && layer.imageData.height && originalFrame.width > 0 && originalFrame.height > 0) {
      const image = await encodeImage(importPixels(layer, clipBase));
      paint.bitmap = { image: image.imageData, content: paintContent(layers[index].node),
        frame: { x: (originalFrame.x - frame.x) / frame.width, y: (originalFrame.y - frame.y) / frame.height,
          width: originalFrame.width / frame.width, height: originalFrame.height / frame.height } };
    }
    layers[index].node.psdPaint = paint;
    flags[index] = { key: paint.key, hidden: !!layer.hidden, name, paint };
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
  if (!hasComposite && !approximate) for (const entry of layers) delete entry.node.psdPaint;
  return { width, height, layers, flags, omitted, approximate, signature, legacySignature, corrections, composite };
}

function paintEffects(layer: Layer, globalAngle: number): PsdPaintEffect[] {
  const fx = layer.effects, result: PsdPaintEffect[] = [];
  if (!fx || fx.disabled) return result;
  const color = (c?: Color) => c && "r" in c ? "#" + [c.r,c.g,c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2,"0")).join("") : "#000000";
  for (const stroke of fx.stroke ?? []) if (stroke.enabled && stroke.fillType === "color") {
    result.push({ kind: stroke.position ?? "outside", color: color(stroke.color), radius: Math.min(250, stroke.size?.value ?? 1), x: 0, y: 0, opacity: stroke.opacity ?? 1 });
  }
  for (const kind of ["innerShadow", "shadow"] as const) {
    for (const shadow of (kind === "shadow" ? fx.dropShadow : fx.innerShadow) ?? []) if (shadow.enabled) {
      const angle = (shadow.useGlobalLight ? globalAngle : shadow.angle ?? 120) * Math.PI / 180;
      const d = shadow.distance?.value ?? 0;
      result.push({ kind, color: color(shadow.color), radius: Math.min(250, (shadow.size?.value ?? 0) / 2),
        x: -Math.cos(angle) * d, y: Math.sin(angle) * d, opacity: shadow.opacity ?? 1 });
    }
  }
  return result;
}
