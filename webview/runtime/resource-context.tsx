import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { resolveSliceResource, type SliceResourceRef, type SliceResourceState } from "../../shared/slice-resources";
import type { ResourceMode } from "../../shared/image-slots";
import { paintSlice } from "./paint-slice";

export type RuntimeResource = SliceResourceState<HTMLCanvasElement | HTMLImageElement>;
export interface Resources {
  mode?: ResourceMode;
  memoryEntries?: ReadonlyMap<string, RuntimeResource>;
  diskEntries?: ReadonlyMap<string, RuntimeResource>;
  entries: ReadonlyMap<string, RuntimeResource>;
  sizes: ReadonlyMap<string, { width: number; height: number }>;
  resolve(ref: SliceResourceRef): RuntimeResource;
  resolveForExport?(ref: SliceResourceRef): RuntimeResource;
  refresh(): void;
}
const empty: Resources = { entries: new Map(), sizes: new Map(), resolve: ref => resolveSliceResource(ref, new Map()), refresh() {} };
const Context = createContext<Resources>(empty);
export const useSliceResources = () => useContext(Context);
export function SliceResourcesProvider({ value, children }: { value: Resources; children: ReactNode }) { return <Context.Provider value={value}>{children}</Context.Provider>; }

export function ResourceCanvas({ resource, width, height, fit = "fill", label, raw = false, progress }: { resource: Extract<RuntimeResource, { status: "ready" }>; width: number; height: number; fit?: "fill" | "contain" | "cover"; label: string; raw?: boolean; progress?: { ratio: number; mode: "horizontal" | "circular"; fullWidth: number } }) {
  const canvas = useRef<HTMLCanvasElement>(null), [error, setError] = useState("");
  useEffect(() => {
    try {
      const target = canvas.current!;
      if (progress && (progress.mode === "circular" || !resource.description.nineGrid)) {
        const source = document.createElement("canvas");
        paintSlice(source, resource.pixels, { ...resource.description, nineGrid: raw || progress.mode === "circular" ? null : resource.description.nineGrid }, progress.fullWidth, height, fit);
        const scale = Math.min(1, 4096 / Math.max(1,width,height), Math.sqrt(8_000_000 / Math.max(1,width*height)));
        target.width = Math.max(1, Math.round(width*scale)); target.height = Math.max(1, Math.round(height*scale));
        const context = target.getContext("2d")!;
        context.save(); context.scale(target.width / Math.max(1,width),target.height / Math.max(1,height));
        if (progress.mode === "circular") {
          context.beginPath(); context.moveTo(width / 2, height / 2);
          context.arc(width / 2, height / 2, Math.hypot(width, height), -Math.PI / 2, -Math.PI / 2 + progress.ratio * Math.PI * 2);
          context.closePath(); context.clip();
        }
        if (progress.ratio > 0) context.drawImage(source, 0, 0, progress.fullWidth, height);
        context.restore();
      } else paintSlice(target, resource.pixels, { ...resource.description, nineGrid: raw ? null : resource.description.nineGrid }, width, height, fit);
      setError("");
    }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  }, [resource, width, height, fit, raw, progress?.ratio, progress?.mode, progress?.fullWidth]);
  return <>{error ? <span className="slice-resource-error" role="status">{error}</span> : null}<canvas ref={canvas} role="img" aria-label={label} data-resource-path={resource.description.path} style={{ width: "100%", height: "100%", display: error ? "none" : "block" }} /></>;
}
