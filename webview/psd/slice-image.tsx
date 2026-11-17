import { useEffect, useRef, type CSSProperties } from "react";
import { sliceRegion, type PsdLayer } from "../../shared/psd-meta";
import { loadSliceImage, sliceImageCanvas } from "./slice-render";
export function SliceImage({ layer, style }: { layer: PsdLayer; style?: CSSProperties }) {
  const canvas = useRef<HTMLCanvasElement>(null), region = sliceRegion(layer);
  useEffect(() => {
    let cancelled = false;
    const element = canvas.current; if (element) { element.width = region.width; element.height = region.height; }
    if (layer.image) void loadSliceImage(layer.image).then(source => {
      if (cancelled || !element) return;
      sliceImageCanvas(source, region, element);
    }).catch(() => { /* Keep a transparent preview; export reports decode failures. */ });
    return () => { cancelled = true; };
  }, [layer.image, region.x, region.y, region.width, region.height]);
  return <canvas ref={canvas} role="img" aria-label={`${layer.name} 导出预览`} style={style} />;
}
