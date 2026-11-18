import { useEffect, useMemo, useState } from "react";
import type { GameFlowPage } from "../../shared/model";
import { effectiveExportName, psdSliceDirectory } from "../../shared/psd-export";
import type { PsdAsset } from "../../shared/psd-meta";
import { resolveSliceResource, sliceResourcePath, sourceKey, type SliceResourceDescription, type SliceResourceRef } from "../../shared/slice-resources";
import { generateSliceProducts, loadSliceImage, sliceGenerationStamp } from "../psd/slice-render";
import type { Resources, RuntimeResource } from "./resource-context";


function description(asset: PsdAsset, layer: PsdAsset["layers"][number]): SliceResourceDescription {
  const region = layer.config.region ?? layer;
  return { path: sliceResourcePath(psdSliceDirectory(asset, layer.config.shared), effectiveExportName(asset, layer)), width: region.width, height: region.height, nineGrid: layer.config.nineGrid,
    source: { documentId: asset.documentId, psdName: asset.name, sourceHash: asset.sourceHash }, layerId: layer.metadata.layerId, layerName: layer.name, shared: layer.config.shared === true };
}
function merge(entries: Map<string, RuntimeResource>, entry: RuntimeResource) {
  const d = entry.description; if (!d) return;
  const previous = entries.get(d.path)?.description;
  entries.set(d.path, previous && previous.source.documentId !== d.source.documentId && !d.shared
    ? { status: "error", description: d, error: `同名资源由 ${previous.source.psdName} 生成，当前图层未标记共享。` } : entry);
}

export function useRuntimeResources(assets: PsdAsset[], pages: GameFlowPage[], root?: string) {
  const [revision, setRevision] = useState(0);
  const stamp = useMemo(() => JSON.stringify(assets.map(sliceGenerationStamp)), [assets]);
  const pending = useMemo(() => {
    const entries = new Map<string, RuntimeResource>();
    for (const asset of assets) for (const layer of asset.layers.filter(l => l.config.enabled)) {
      try { merge(entries, { status: "loading", description: description(asset, layer) }); } catch { /* Invalid names have no selectable resource path; PSD tree diagnoses them. */ }
    }
    return entries;
  }, [stamp]);
  const [generated, setGenerated] = useState<{ stamp: string; entries: Map<string, RuntimeResource> }>({ stamp: "", entries: new Map() });
  useEffect(() => {
    let cancelled = false;
    void Promise.all(assets.map(generateSliceProducts)).then(batches => {
      if (cancelled) return;
      const entries = new Map<string, RuntimeResource>();
      batches.forEach((batch, index) => { for (const [key, entry] of batch) {
        const layer = assets[index].layers.find(l => l.key === key)!;
        try {
          const placeholder = description(assets[index], layer);
          merge(entries, { ...entry, description: { ...(entry.description ?? placeholder), path: placeholder.path } });
        } catch { /* Name errors are reported at their source. */ }
      } });
      setGenerated({ stamp, entries });
    });
    return () => { cancelled = true; };
  }, [stamp]);
  const memory = generated.stamp === stamp ? generated.entries : pending;
  const paths = useMemo(() => [...new Set([...memory.keys(), ...pages.flatMap(p => p.nodes.flatMap(n => n.sliceResource ? [n.sliceResource.path] : []))])].sort(), [memory, pages]);
  const pathsKey = JSON.stringify(paths), diskStamp = JSON.stringify([pathsKey, root, revision]);
  const [disk, setDisk] = useState<{ stamp: string; entries: Map<string, RuntimeResource>; owners: Map<string, { exists: boolean; documentId?: string }> }>({ stamp: "", entries: new Map(), owners: new Map() });
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const entries = new Map<string, RuntimeResource>(), owners = new Map<string, { exists: boolean; documentId?: string }>();
      try {
        const { loadExportedSlices } = await import("./resource-io");
        for (let offset = 0; offset < paths.length; offset += 128) {
          const batch = await loadExportedSlices(paths.slice(offset, offset + 128), controller.signal);
          for (const result of batch) {
            owners.set(result.path, { exists: result.exists, documentId: result.description?.source.documentId });
            try {
              if (result.error || !result.description || !result.base64) throw new Error(result.error ?? "资源描述缺失。");
              const pixels = await loadSliceImage(`data:image/png;base64,${result.base64}`);
              if (pixels.naturalWidth !== result.description.width || pixels.naturalHeight !== result.description.height) throw new Error("图片实际尺寸与资源描述不一致。");
              entries.set(result.path, { status: "ready", description: result.description, pixels });
            } catch (error) { entries.set(result.path, { status: "error", error: error instanceof Error ? error.message : String(error) }); }
          }
        }
      } catch (error) { for (const path of paths) entries.set(path, { status: "error", error: error instanceof Error ? error.message : String(error) }); }
      if (!controller.signal.aborted) setDisk({ stamp: diskStamp, entries, owners });
    })();
    return () => controller.abort();
  }, [diskStamp]);
  return useMemo<Resources>(() => {
    const sources = new Map<string, string | null>();
    for (const asset of assets) {
      for (const page of pages) for (const node of page.nodes) if (node.sliceResource?.source?.documentId === asset.documentId) sources.set(sourceKey(node.sliceResource.source), null);
      for (const layer of asset.layers) {
        let path: string | null = null;
        try { if (layer.config.enabled) path = description(asset, layer).path; } catch { /* Invalid output name remains unavailable. */ }
        sources.set(sourceKey({ documentId: asset.documentId, layerId: layer.metadata.layerId }), path);
      }
    }
    const entries = new Map<string, RuntimeResource>();
    for (const path of paths) {
      let entry: RuntimeResource = disk.stamp === diskStamp ? disk.entries.get(path) ?? { status: "error", error: "资源没有返回装载结果。" } : { status: "loading" };
      const current = memory.get(path);
      if (current) {
        entry = current;
        const owner = disk.stamp === diskStamp ? disk.owners.get(path) : undefined;
        if (current.status === "ready" && owner?.exists && owner.documentId !== current.description.source.documentId && !current.description.shared)
          entry = { status: "error", description: current.description, error: "导出目录存在其他 PSD 或未登记的同名资源，当前图层未标记共享。" };
        else if (root && disk.stamp !== diskStamp && current.status === "ready") entry = { status: "loading", description: current.description };
      }
      entries.set(path, entry);
    }
    const resolve = (ref: SliceResourceRef) => resolveSliceResource(ref, entries, sources);
    const sizes = new Map<string, { width: number; height: number }>();
    for (const [path, entry] of entries) if (entry.status === "ready") sizes.set(path, entry.description.logicalSize ?? entry.description);
    return { entries, sizes, resolve, refresh: () => setRevision(n => n + 1) };
  }, [memory, disk, diskStamp, pathsKey, assets, pages, root]);
}
