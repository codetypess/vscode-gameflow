import type { Layer, LayerTextData, PixelData, Psd } from "ag-psd";
import { isImageData, type Frame, type GameFlowNode, type NodeStyle } from "../../shared/model";

type ImportedNode = Omit<GameFlowNode, "id" | "parentId">;
export type ImportedLayer = { node: ImportedNode; parent: number | null };
export type PsdPrototype = { width: number; height: number; layers: ImportedLayer[]; omitted: number; approximate: boolean };

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

export async function readPrototypeLayers(psd: Psd): Promise<PsdPrototype> {
  const layers: ImportedLayer[] = [];
  let omitted = 0, approximate = false;

  async function visit(layer: Layer, parent: number | null): Promise<Frame | undefined> {
    const name = layer.name?.trim() || "未命名图层";
    const frame = pixelFrame(layer);
    const opacity = (layer.opacity ?? 1) * (layer.fillOpacity ?? 1);
    const style = opacity < 1 ? { opacity } : undefined;
    const base = { name, frame, ...(layer.hidden && { hidden: true }), ...(style && { style }) };
    approximate ||= !!(layer.mask || layer.vectorMask || layer.effects || layer.clipping || layer.adjustment ||
      layer.blendMode && layer.blendMode !== "normal" && layer.blendMode !== "pass through");
    if (layer.children) {
      const index = layers.push({ node: { ...base, type: "container" }, parent }) - 1;
      const children: Frame[] = [];
      for (const child of layer.children) {
        const bounds = await visit(child, index);
        if (bounds) children.push(bounds);
      }
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
      const box = layer.text.boxBounds;
      if (!frame.width || !frame.height) {
        frame.x = layer.text.transform?.[4] ?? frame.x;
        frame.y = (layer.text.transform?.[5] ?? frame.y) - (box ? 0 : size);
        frame.width ||= box ? box[2] - box[0] : Math.max(...text.split("\n").map(line => line.length)) * size;
        frame.height ||= box ? box[3] - box[1] : text.split("\n").length * size * 1.35;
      }
      approximate ||= (layer.text.styleRuns?.length ?? 0) > 1 || (layer.text.paragraphStyleRuns?.length ?? 0) > 1 ||
        !!layer.text.warp?.style && layer.text.warp.style !== "none";
      layers.push({ node: { ...base, type: "text", text, style: { ...style, ...appearance },
        widget: box ? { wordWrap: true } : { overflow: "visible" } }, parent });
    } else if (layer.imageData?.width && layer.imageData.height && !layer.adjustment) {
      const image = await encodeImage(layer.imageData);
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

  for (const layer of psd.children ?? []) await visit(layer, null);
  if (!layers.length) throw new Error("PSD 中没有可导入的图层。");
  return { width: psd.width, height: psd.height, layers, omitted, approximate };
}
