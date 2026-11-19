import { useEffect, useState } from "react";
import { builtinPath, imageSlotRequest, type ImageSlot, type BuiltinImage } from "../../shared/image-slots";
import { ResourceCanvas, useSliceResources, type RuntimeResource } from "./resource-context";
const cache = new Map<string, Promise<RuntimeResource>>();
function loadBuiltin(image: BuiltinImage) {
  if (!cache.has(image.id)) cache.set(image.id, new Promise<RuntimeResource>(resolve => {
    const pixels = new Image();
    pixels.onload = () => resolve({ status: "ready", pixels, description: { path: builtinPath(image.id), width: image.width, height: image.height, nineGrid: image.nineGrid,
      source: { documentId: "gameflow-builtin", psdName: "builtin.psd", sourceHash: "0".repeat(64) }, layerId: image.id, layerName: image.name, shared: true } });
    pixels.onerror = () => resolve({ status: "error", error: "内置图片读取失败：" + image.name }); pixels.src = image.dataUri;
  }));
  return cache.get(image.id)!;
}
export function SlotImage({ slot, width, height, label, fit = "fill", progress }: { slot: ImageSlot | null | undefined; width: number; height: number; label: string; fit?: "fill" | "contain" | "cover"; progress?: { ratio: number; mode: "horizontal" | "circular"; fullWidth: number } }) {
  const resources = useSliceResources(), request = imageSlotRequest(slot, resources.mode ?? "art");
  const id = request.kind === "builtin" ? request.image.id : undefined;
  const [loaded, setLoaded] = useState<{ id: string; resource: RuntimeResource }>();
  useEffect(() => { let cancelled = false; if (request.kind === "builtin") void loadBuiltin(request.image).then(resource => { if (!cancelled) setLoaded({ id: request.image.id, resource }); }); return () => { cancelled = true; }; }, [id]);
  if (request.kind === "empty") return null;
  const resource: RuntimeResource = request.kind === "error" ? { status: "error", error: request.error } : request.kind === "resource" ? resources.resolve(request.ref) : loaded && loaded.id === id ? loaded.resource : { status: "loading" };
  return resource.status === "ready" ? <ResourceCanvas resource={resource} width={width} height={height} label={label} fit={fit} progress={progress} />
    : <span className="slice-resource-placeholder" role="status" data-resource-status={resource.status} title={resource.status === "error" ? resource.error : "正在装载图片"}>{resource.status === "error" ? "图片异常\n" + resource.error : "装载中…"}</span>;
}
