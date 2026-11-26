import { useEffect, useMemo, useRef, useState } from "react";
import { inheritLayerVisibility, type PsdAsset } from "../../shared/psd-meta";
import { hasPhotoCraftHost, requestRender } from "./photocraft";

/** Owned by the keyed slice canvas. Drafts and exports always use the original asset. */
export function useLayerVisibility(source: PsdAsset, active: boolean) {
  const [flipped, setFlipped] = useState<number[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ stamp: string; image?: string; error?: string }>();
  const queue = useRef(Promise.resolve());
  const preview = useMemo(() => {
    if (!flipped.length) return source;
    const keys = new Set(flipped);
    const layers = source.layers.map(layer => ({
      ...layer, hidden: (layer.sourceHidden ?? layer.hidden) !== keys.has(layer.key)
    }));
    return { ...source, layers: inheritLayerVisibility(layers) };
  }, [source, flipped]);
  const complex = flipped.length > 0 && preview.layers.some(l => !l.hidden) &&
    (source.hasArtboards || preview.layers.some(l => !l.hidden && !!l.limitation));
  const native = complex && hasPhotoCraftHost();
  const stamp = JSON.stringify([source.sourceHash, flipped, attempt]);
  useEffect(() => {
    if (!native || !active) return;
    let current = true;
    const timer = setTimeout(() => {
      // Keep one CLI job in flight and skip queued states superseded by later clicks.
      queue.current = queue.current.then(async () => {
        if (!current) return;
        try {
          const image = await requestRender(source.sourceHash, flipped, "psdRenderVisibility");
          if (current) setResult({ stamp, image });
        } catch (error) {
          if (current) setResult({ stamp, error: error instanceof Error ? error.message : String(error) });
        }
      });
    }, 90);
    return () => { current = false; clearTimeout(timer); };
  }, [active, native, stamp, source.sourceHash, flipped]);

  const current = native && result?.stamp === stamp ? result : undefined;
  const toggle = (key: number) => setFlipped(keys => keys.includes(key)
    ? keys.filter(item => item !== key) : [...keys, key].sort((a, b) => a - b));
  return { preview, toggle, image: flipped.length ? current?.image : source.preview,
    loading: native && !current, error: current?.error, approximate: complex && !native,
    retry: () => setAttempt(n => n + 1) };
}
