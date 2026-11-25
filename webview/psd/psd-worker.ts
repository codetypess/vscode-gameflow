import { initializeCanvas, readPsd, type Layer, type PixelData } from "ag-psd";
import { createPsdStructure } from "../../shared/psd-structure";
import { verifyBuiltinOrigin } from "../../shared/psd-builtin";
import { parsePsdBinary, patchPsdMetadata } from "../../shared/psd-binary";
import { type PsdAsset, type PsdEmbeddedLayer, type PsdLayer, type PsdLayerMeta } from "../../shared/psd-meta";
import { embeddedPsdFiles, psdContentHash } from "../runtime/psd-smart-object";
import { maskedCellPixels, readableCellMask } from "./list-cell-mask";
import { readPrototypeLayers } from "./prototype-import";

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
function embeddedLayers(bytes: Uint8Array): PsdEmbeddedLayer[] | undefined {
  try {
    const { layers } = parsePsdBinary(bytes);
    const nodes = new Map<number, PsdEmbeddedLayer>();
    const roots: PsdEmbeddedLayer[] = [];
    for (const layer of layers) {
      const group = layer.divider === 1 || layer.divider === 2;
      const kind = group ? "group" : layer.blocks.some(block => block.key === "TySh") ? "text"
        : layer.blocks.some(block => block.key === "SoLd" || block.key === "SoLE" || block.key === "PlLd") ? "smartObject" : "image";
      const item: PsdEmbeddedLayer = { key: layer.key, name: layer.name, kind, children: [] };
      const parent = layer.parentKey !== null ? nodes.get(layer.parentKey) : undefined;
      (parent?.children ?? roots).push(item);
      nodes.set(layer.key, item);
    }
    return roots;
  } catch {
    // The containing PSD can still display a cached smart-object image.
    return undefined;
  }
}
scope.onmessage = async ({ data }: MessageEvent<{ id: number; type: "read" | "patch" | "importPrototype"; bytes: ArrayBuffer; name: string; updates?: [number, PsdLayerMeta][] }>) => {
  try {
    const bytes = new Uint8Array(data.bytes);
    if (data.type === "patch") {
      const patched = patchPsdMetadata(bytes, new Map(data.updates));
      scope.postMessage({ id: data.id, result: patched.buffer }, [patched.buffer]); return;
    }
    const raw = parsePsdBinary(bytes);
    if (data.type === "importPrototype") {
      const decoded = readPsd(bytes, { useImageData: true, skipThumbnail: true, skipCompositeImageData: true,
        skipLinkedFilesData: true, totalMemoryLimit: 384 * 1024 * 1024 });
      scope.postMessage({ id: data.id, result: await readPrototypeLayers(decoded) });
      return;
    }
    const sourceHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", data.bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
    const structure = createPsdStructure(raw, data.name, sourceHash);
    const decoded = readPsd(bytes, { useImageData: true, skipThumbnail: true, useRawThumbnail: true, totalMemoryLimit: 384 * 1024 * 1024 });
    const ordered: { layer: Layer; inheritedLimitation: boolean }[] = [];
    const cells = new Set(structure.layers.filter(layer => Number.isInteger(layer.metadata.listCellIndex)).map(layer => layer.nativeId));
    const objects = new Set([...cells, ...structure.layers.filter(layer => layer.metadata.componentSmartObject === true).map(layer => layer.nativeId)]);
    const files = embeddedPsdFiles(decoded.linkedFiles);
    const embeddedTrees = new Map<string, PsdLayer["smartObject"]>();
    const smartObject = async (layer: Layer): Promise<PsdLayer["smartObject"]> => {
      const placed = layer.placedLayer;
      if (!placed) return undefined;
      if (placed.external) return {};
      if (!embeddedTrees.has(placed.id)) {
        const bytes = files.get(placed.id)?.data;
        embeddedTrees.set(placed.id, bytes ? { contents: embeddedLayers(bytes), hash: await psdContentHash(bytes) } : {});
      }
      return embeddedTrees.get(placed.id);
    };
    const supportedObject = (layer: Layer) => layer.id !== undefined && objects.has(layer.id) &&
      layer.placedLayer && !layer.placedLayer.external && files.has(layer.placedLayer.id) && !!layer.imageData;
    const hasCellMask = (layer: Layer) => layer.id !== undefined && cells.has(layer.id) && readableCellMask(layer);
    const unsupported = (layer: Layer): boolean => !!layer.mask && !hasCellMask(layer) || !!layer.vectorMask || !!layer.effects || !!layer.clipping ||
      !!layer.adjustment || (!!layer.placedLayer && !supportedObject(layer)) || layer.opacity !== 1 || (layer.fillOpacity ?? 1) !== 1 ||
      (layer.blendMode !== "normal" && layer.blendMode !== "pass through");
    const walk = (children: Layer[], inherited = false) => { for (const l of [...children].reverse()) {
      const limitation = inherited || unsupported(l);
      if (l.imageData && l.mask?.imageData && hasCellMask(l)) l.imageData = maskedCellPixels(l.imageData, l.mask.imageData);
      ordered.push({ layer: l, inheritedLimitation: limitation }); if (l.children) walk(l.children, limitation);
    } };
    walk(decoded.children ?? []);
    if (ordered.length !== raw.layers.length) throw new Error("PSD 图层结构解析不一致，已停止读取。");
    let groupPixelsUsed = 0;
    const groupPixels = (group: Layer, bounds: PsdLayer): PixelData | undefined => {
      if (!bounds.width || !bounds.height || (groupPixelsUsed += bounds.width * bounds.height) > 24_000_000) return undefined;
      const canvas=new OffscreenCanvas(bounds.width,bounds.height),ctx=canvas.getContext("2d")!;
      // Compose with source-over so transparent pixels preserve lower layers.
      const compose=(layer:Layer)=>{if(layer.hidden)return;if(layer.children){for(const child of layer.children)compose(child);}else if(layer.imageData){const pixels=layer.imageData,temp=new OffscreenCanvas(pixels.width,pixels.height);temp.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height),0,0);ctx.drawImage(temp,(layer.left??0)-bounds.left,(layer.top??0)-bounds.top);}};
      for(const child of group.children??[])compose(child);return ctx.getImageData(0,0,bounds.width,bounds.height);
    };
    const layers: PsdLayer[] = [];
    for (let i = 0; i < raw.layers.length; i++) {
      const r = raw.layers[i], { layer: l, inheritedLimitation } = ordered[i];
      if (l.name !== r.name || (l.id ?? null) !== r.nativeId) throw new Error("PSD 图层对应关系无法确认。");
      const unsupportedChild = (child:Layer):boolean => !child.hidden && (unsupported(child) || !!child.children?.some(unsupportedChild));
      const flatUnsupported = inheritedLimitation || !!l.children?.some(unsupportedChild);
      const verifiedBuiltin = !flatUnsupported && !l.children && !l.text && l.imageData
        ? await verifyBuiltinOrigin(structure.layers[i].metadata.builtinOrigin, l.imageData) : undefined;
      layers.push({ ...structure.layers[i], smartObject: await smartObject(l), verifiedBuiltin, image: await png(l.children ? groupPixels(l, structure.layers[i]) : l.imageData), text: !!l.text, textContent: l.text?.text?.replace(/\r\n?/g,"\n"), limitation: flatUnsupported ? "此层含效果、蒙版、剪贴或特殊混合，单层图仅显示保存的基础像素。" : undefined });
    }
    const result: PsdAsset = { ...structure, layers, preview: await png(decoded.imageData) };
    scope.postMessage({ id: data.id, result });
  } catch (error) { scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) }); }
};
