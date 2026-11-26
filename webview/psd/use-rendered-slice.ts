import { useEffect, useState } from "react";
import { needsPhotoCraft, renderedSliceLayer, type SlicePixels } from "../../shared/psd-slice-source";
import type { PsdAsset, PsdLayer } from "../../shared/psd-meta";
import { isBrowserPreview } from "../vscode-api";
import { photoCraftPixels } from "./photocraft";

export function useRenderedSlice(asset: PsdAsset | undefined, layer: PsdLayer | null, active: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; pixels?: SlicePixels; error?: string }>();
  const needsRender = !!layer && needsPhotoCraft(layer, !isBrowserPreview);
  const native = active && !!asset && !!layer && needsRender && !isBrowserPreview;
  const key = native ? JSON.stringify([asset.sourceHash, layer.key, attempt]) : "";
  useEffect(() => {
    if (!key || !asset || !layer) return;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const pixels = await photoCraftPixels(asset, layer);
        if (alive) setResult({ key, pixels });
      } catch (error) {
        if (alive) setResult({ key, error: error instanceof Error ? error.message : String(error) });
      }
    }, 80);
    return () => { alive = false; clearTimeout(timer); };
  }, [key]);
  const current = result?.key === key ? result : undefined;
  return { layer: layer && current?.pixels ? renderedSliceLayer(layer, current.pixels) : layer,
    ready: native ? !!current?.pixels : !!layer?.image && !needsRender,
    loading: native && !current, error: current?.error, retry: () => setAttempt(n => n + 1) };
}
