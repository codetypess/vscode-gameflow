import { initializeCanvas, readPsd, type Layer, type PixelData } from "ag-psd";
import { allocateElementId } from "../../shared/element-id";
import { parsePsdBinary, patchPsdMetadata } from "../../shared/psd-binary";
import { inheritLayerVisibility, validConfig, type PsdAsset, type PsdLayer, type PsdLayerMeta, type SliceConfig } from "../../shared/psd-meta";

initializeCanvas(() => { throw new Error("图层需要当前不支持的 Canvas 解码。"); }, (width, height) => new ImageData(width, height));
const scope = globalThis as unknown as { onmessage: (event: MessageEvent) => void; postMessage: (data: unknown, transfer?: Transferable[]) => void };
async function png(pixels?: PixelData): Promise<string> {
  if (!pixels?.width || !pixels.height) return "";
  const canvas = new OffscreenCanvas(pixels.width, pixels.height), ctx = canvas.getContext("2d")!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
  let binary = ""; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return "data:image/png;base64," + btoa(binary);
}
function metadata(value: unknown): PsdLayerMeta | null {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("GameFlow 图层元数据格式损坏。");
  const m = value as PsdLayerMeta;
  if (m.namespace !== "com.codetypes.gameflow" || m.version !== 1 || typeof m.documentId !== "string" || !m.documentId || typeof m.layerId !== "string" || !m.layerId || m.layerId.length > 128) throw new Error("GameFlow 元数据版本或身份格式不支持。");
  return m;
}
scope.onmessage = async ({ data }: MessageEvent<{ id: number; type: "read" | "patch"; bytes: ArrayBuffer; name: string; updates?: [number, PsdLayerMeta][] }>) => {
  try {
    const bytes = new Uint8Array(data.bytes);
    if (data.type === "patch") {
      const patched = patchPsdMetadata(bytes, new Map(data.updates));
      scope.postMessage({ id: data.id, result: patched.buffer }, [patched.buffer]); return;
    }
    const raw = parsePsdBinary(bytes), existing = raw.layers.map(r => metadata(r.metadata));
    const documentIds = new Set(existing.filter(Boolean).map(m => m!.documentId));
    if (documentIds.size > 1) throw new Error("此 PSD 含多个文档谱系，请先处理跨文档身份。");
    const documentId = documentIds.values().next().value ?? crypto.randomUUID();
    const reserved = new Set(existing.filter(Boolean).map(m => m!.layerId));
    const decoded = readPsd(bytes, { useImageData: true, skipThumbnail: true, useRawThumbnail: true, totalMemoryLimit: 384 * 1024 * 1024 });
    const ordered: { layer: Layer; inheritedLimitation: boolean }[] = [];
    const walk = (children: Layer[], inherited = false) => { for (const l of [...children].reverse()) { const limitation = inherited || !!l.mask || !!l.vectorMask || !!l.effects || !!l.clipping || !!l.adjustment || !!l.placedLayer || l.opacity !== 1 || (l.blendMode !== "normal" && l.blendMode !== "pass through"); ordered.push({ layer: l, inheritedLimitation: limitation }); if (l.children) walk(l.children, limitation); } };
    walk(decoded.children ?? []);
    if (ordered.length !== raw.layers.length) throw new Error("PSD 图层结构解析不一致，已停止读取。");
    const layers: PsdLayer[] = [];
    for (let i = 0; i < raw.layers.length; i++) {
      const r = raw.layers[i], { layer: l, inheritedLimitation } = ordered[i], embedded = existing[i];
      if (l.name !== r.name || (l.id ?? null) !== r.nativeId) throw new Error("PSD 图层对应关系无法确认。");
      const m: PsdLayerMeta = embedded ?? { namespace: "com.codetypes.gameflow", version: 1, documentId, layerId: allocateElementId(reserved) };
      let config: SliceConfig = { enabled: false, name: r.name, nineGrid: null };
      if (m.slicing !== undefined) {
        if (!validConfig(m.slicing, r.width, r.height)) throw new Error(`${r.name} 的切图配置无效或超出当前图片。`);
        config = m.slicing;
      } else if (m.slice && typeof m.slice === "object") {
        const old = m.slice as Record<string, unknown>, candidate = { enabled: true, name: r.name, nineGrid: { ...old, repeat: false } };
        if (validConfig(candidate, r.width, r.height)) config = candidate;
      }
      layers.push({ key: r.key, nativeId: r.nativeId, parentKey: r.parentKey, name: r.name, group: r.divider === 1 || r.divider === 2, left: r.left, top: r.top, width: r.width, height: r.height, hidden: r.hidden, identityOrigin: embedded ? "embedded" : "new", metadata: m, config, image: await png(l.imageData), text: !!l.text, limitation: inheritedLimitation ? "此层含效果、蒙版、剪贴或特殊混合，单层图仅显示保存的基础像素。" : undefined });
    }
    const sourceHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", data.bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
    const result: PsdAsset = { name: data.name, sourceHash, documentId, hasEmbeddedIdentity: !!documentIds.size, width: raw.width, height: raw.height, layers: inheritLayerVisibility(layers), preview: await png(decoded.imageData) };
    scope.postMessage({ id: data.id, result });
  } catch (error) { scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) }); }
};
