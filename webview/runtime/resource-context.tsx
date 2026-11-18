import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { resolveSliceResource, type SliceResourceRef, type SliceResourceState } from "../../shared/slice-resources";
import { paintSlice } from "./paint-slice";

export type RuntimeResource = SliceResourceState<HTMLCanvasElement | HTMLImageElement>;
export interface Resources {
  entries: ReadonlyMap<string, RuntimeResource>;
  sizes: ReadonlyMap<string, { width: number; height: number }>;
  resolve(ref: SliceResourceRef): RuntimeResource;
  refresh(): void;
}
const empty: Resources = { entries: new Map(), sizes: new Map(), resolve: ref => resolveSliceResource(ref, new Map()), refresh() {} };
const Context = createContext<Resources>(empty);
export const useSliceResources = () => useContext(Context);
export function SliceResourcesProvider({ value, children }: { value: Resources; children: ReactNode }) { return <Context.Provider value={value}>{children}</Context.Provider>; }

export function ResourceCanvas({ resource, width, height, fit = "fill", label, raw = false }: { resource: Extract<RuntimeResource, { status: "ready" }>; width: number; height: number; fit?: "fill" | "contain" | "cover"; label: string; raw?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null), [error, setError] = useState("");
  useEffect(() => {
    try { paintSlice(canvas.current!, resource.pixels, { ...resource.description, nineGrid: raw ? null : resource.description.nineGrid }, width, height, fit); setError(""); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  }, [resource, width, height, fit, raw]);
  return <>{error ? <span className="slice-resource-error" role="status">{error}</span> : null}<canvas ref={canvas} role="img" aria-label={label} data-resource-path={resource.description.path} style={{ width: "100%", height: "100%", display: error ? "none" : "block" }} /></>;
}
