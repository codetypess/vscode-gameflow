import { useEffect, useMemo, useState } from "react";
import { nodeArtRefs, IMAGE_SLOT_FIELDS, builtinPath, builtinImage, nodeImageSlot, imageSlotRequest, type ResourceMode } from "../../shared/image-slots";
import type { GameFlowPage } from "../../shared/model";
import { legacyDefaultPath } from "../../shared/builtin-image";
import { exportLayerName, psdLayerPath } from "../../shared/psd-export";
import { builtinSlice, builtinSliceDescription } from "../../shared/psd-builtin";
import type { PsdAsset } from "../../shared/psd-meta";
import { resolveSliceResource, sourceKey, type SliceResourceDescription, type SliceResourceRef } from "../../shared/slice-resources";
import { generateSliceProducts, loadSliceImage, sliceGenerationStamp } from "../psd/slice-render";
import type { Resources, RuntimeResource } from "./resource-context";


function description(asset: PsdAsset, layer: PsdAsset["layers"][number]): SliceResourceDescription {
  const builtin = builtinSlice(layer);
  if (builtin) return builtinSliceDescription(builtin);
  const region = layer.config.region ?? layer;
  return { path: psdLayerPath(asset, layer), width: region.width, height: region.height, nineGrid: layer.config.nineGrid,
    source: { documentId: asset.documentId, psdName: asset.name, sourceHash: asset.sourceHash }, layerId: layer.metadata.layerId, layerName: exportLayerName(asset, layer), shared: layer.config.shared === true };
}
function merge(entries: Map<string, RuntimeResource>, entry: RuntimeResource, owner: number) {
  if (entry.description) entries.set(owner + ":" + entry.description.path, entry);
}

export function useRuntimeResources(observedAssets: PsdAsset[], pages: GameFlowPage[], root?: string, mode: ResourceMode = "art", pageAssets: Record<string, PsdAsset> = {}) {
  const assets = useMemo(() => Array.from(new Set([...observedAssets, ...Object.values(pageAssets)])), [observedAssets, pageAssets]);
  const [revision, setRevision] = useState(0);
  const stamp = useMemo(() => JSON.stringify(assets.map(sliceGenerationStamp)), [assets]);
  const pending = useMemo(() => {
    const entries = new Map<string, RuntimeResource>();
    for (const asset of assets) for (const layer of asset.layers.filter(l => l.config.enabled)) {
      try { merge(entries, { status: "loading", description: description(asset, layer) }, assets.indexOf(asset)); } catch { /* Invalid names have no selectable resource path; PSD tree diagnoses them. */ }
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
          merge(entries, { ...entry, description: { ...(entry.description ?? placeholder), path: placeholder.path } }, index);
        } catch { /* Name errors are reported at their source. */ }
      } });
      setGenerated({ stamp, entries });
    });
    return () => { cancelled = true; };
  }, [stamp]);
  const memory = generated.stamp === stamp ? generated.entries : pending;
  const [disk, setDisk] = useState<{ stamp: string; root?: string; entries: Map<string, RuntimeResource>; owners: Map<string, { exists: boolean; documentId?: string }> }>({ stamp: "", entries: new Map(), owners: new Map() });
  const paths = useMemo(() => {
    return [...new Set([...Array.from(memory.values(), entry => entry.description!.path), ...pages.flatMap(page => {
      return page.nodes.flatMap(node => [...nodeArtRefs(node).map(ref => ref.path), ...IMAGE_SLOT_FIELDS.flatMap(field => node[field]?.builtin ? [builtinPath(node[field]!.builtin!)] : [])]);
    })])].sort();
  }, [memory, pages]);
  const pathsKey = JSON.stringify(paths), diskStamp = JSON.stringify([pathsKey, root, revision]);
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
      if (!controller.signal.aborted) setDisk({ stamp: diskStamp, root, entries, owners });
    })();
    return () => controller.abort();
  }, [diskStamp]);
  return useMemo<Resources>(() => {
    const diskEntries = disk.stamp === diskStamp ? disk.entries : new Map<string, RuntimeResource>(paths.map(path => [path, { status: "loading" }]));
    const forPage = (page: GameFlowPage): Resources => {
      const scoped = new Map<string, RuntimeResource>();
      const scopedAsset = pageAssets[page.id], owner = scopedAsset ? assets.indexOf(scopedAsset) : -1;
      for (const [key, entry] of memory) if (key.startsWith(owner + ":") && entry.description && page.artPsd && scopedAsset?.documentId === page.artPsd.documentId) scoped.set(entry.description.path, entry);
      const sources = new Map<string, string | null>();
      for (const asset of assets.filter(item => item === scopedAsset && item.documentId === page.artPsd?.documentId)) {
        for (const node of page.nodes) for (const ref of nodeArtRefs(node)) if (ref.source?.documentId === asset.documentId) sources.set(sourceKey(ref.source), null);
        for (const layer of asset.layers) {
          let path: string | null = null;
          try { if (layer.config.enabled) path = description(asset, layer).path; } catch { /* Invalid names remain unavailable. */ }
          sources.set(sourceKey({ documentId: asset.documentId, layerId: layer.metadata.layerId }), path);
        }
      }
      const entries = mode === "prefab" ? diskEntries : scoped;
      const resolve = (ref: SliceResourceRef) => mode === "prefab" ? resolveSliceResource(ref, diskEntries) : resolveSliceResource(ref, scoped, sources);
      const sizes = new Map<string, { width: number; height: number }>();
      for (const node of page.nodes) for (const field of IMAGE_SLOT_FIELDS) { const slot = node[field]; if (slot?.builtin) { const image = builtinImage(slot.builtin); if (image) sizes.set(builtinPath(image.id), image); } }
      for (const [path, entry] of entries) if (entry.status === "ready") sizes.set(path, entry.description.logicalSize ?? entry.description);
      for (const node of page.nodes) {
        const request = imageSlotRequest(nodeImageSlot(node, mode), mode);
        if (request.kind === "builtin") sizes.set("@node:" + node.id, request.image);
        if (request.kind === "resource") { const resource = resolve(request.ref); if (resource.status === "ready") sizes.set("@node:" + node.id, resource.description.logicalSize ?? resource.description); }
      }
      const resolveForExport = (ref: SliceResourceRef) => {
        if (ref.source && legacyDefaultPath(ref.path) && sources.get(sourceKey(ref.source)) === builtinPath("image/default"))
          return resolveSliceResource({ ...ref, path: builtinPath("image/default") }, scoped, sources);
        return scoped.has(ref.path) || ref.source && sources.has(sourceKey(ref.source)) ? resolveSliceResource(ref, scoped, sources) : resolveSliceResource(ref, diskEntries);
      };
      return { mode, entries, memoryEntries: scoped, diskEntries, sizes, resolve, resolveForExport, refresh: () => setRevision(n => n + 1) };
    };
    const scoped = pages.map(forPage), base = scoped[0];
    const sizes = new Map<string, { width: number; height: number }>();
    for (const resources of scoped) for (const [key, value] of resources.sizes) sizes.set(key, value);
    return { ...(base ?? { mode, entries: new Map(), resolve: (ref: SliceResourceRef) => resolveSliceResource(ref, new Map()), refresh: () => setRevision(n => n + 1) }), sizes, forPage };
  }, [memory, disk, diskStamp, pathsKey, assets, pageAssets, pages, root, mode]);
}
