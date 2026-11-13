import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Focus, Minus, Plus } from "lucide-react";
import type { PsdAsset, PsdLayer } from "../../shared/psd-meta";
import { Button } from "../components/ui/button";
import { fitPsdCamera, placePsdPanels, zoomPsdCamera, type CanvasSize, type PsdCamera } from "./canvas-layout";
import { isCanvasDrag, pickPsdLayer, psdPoint } from "./layer-hit-test";
import { createPixelHitCache } from "./pixel-hit-cache";

const isPanel = (target: EventTarget | null) => target instanceof Element && !!target.closest(".psd-follow-panel, .psd-canvas-controls");

export function PsdSliceCanvas({ asset, selected, onSelect, active, tree, properties }: {
  asset: PsdAsset; selected: PsdLayer | null; onSelect: (key: number | null) => void; active: boolean; tree: ReactNode; properties: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null), leftPanel = useRef<HTMLElement>(null), rightPanel = useRef<HTMLElement>(null);
  const [view, setView] = useState<{ size: CanvasSize; camera: PsdCamera; ready: boolean }>({ size: { width: 0, height: 0 }, camera: { x: 0, y: 0, zoom: 1 }, ready: false });
  const [heights, setHeights] = useState({ left: 0, right: 0 });
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ pointerId: number; button: number; moved: boolean; x: number; y: number; camera: PsdCamera } | null>(null);
  const [hasPixel] = useState(createPixelHitCache);
  const selectionRequest = useRef(0);
  useEffect(() => { selectionRequest.current++; }, [selected?.key]);

  useLayoutEffect(() => {
    const element = stage.current; if (!element) return;
    const measure = () => {
      const width = element.clientWidth, height = element.clientHeight;
      if (!width || !height) return; // A hidden mode must not reset its camera.
      setView(old => {
        if (old.ready && old.size.width === width && old.size.height === height) return old;
        const size = { width, height };
        const camera = old.ready ? { ...old.camera, x: old.camera.x + (width - old.size.width) / 2, y: old.camera.y + (height - old.size.height) / 2 } : fitPsdCamera(size, asset);
        return { size, camera, ready: true };
      });
      const left = leftPanel.current?.getBoundingClientRect().height ?? 0, right = rightPanel.current?.getBoundingClientRect().height ?? 0;
      setHeights(old => old.left === left && old.right === right ? old : { left, right });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (leftPanel.current) observer.observe(leftPanel.current);
    if (rightPanel.current) observer.observe(rightPanel.current);
    return () => observer.disconnect();
  }, [asset.width, asset.height, active]);

  useEffect(() => {
    const element = stage.current; if (!element || !active) return;
    const wheel = (event: WheelEvent) => {
      if (isPanel(event.target)) return;
      event.preventDefault(); if (gesture.current) return;
      selectionRequest.current++;
      const bounds = element.getBoundingClientRect(), point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1);
      setView(old => ({ ...old, camera: zoomPsdCamera(old.camera, point, old.camera.zoom * Math.exp(-delta * .0018)) }));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [active]);

  useEffect(() => {
    const stop = () => {
      selectionRequest.current++;
      const g = gesture.current; gesture.current = null; setDragging(false);
      if (g && stage.current?.hasPointerCapture(g.pointerId)) stage.current.releasePointerCapture(g.pointerId);
    };
    if (!active) stop();
    window.addEventListener("blur", stop);
    return () => { window.removeEventListener("blur", stop); stop(); };
  }, [active]);

  const begin = (event: PointerEvent<HTMLDivElement>) => {
    selectionRequest.current++;
    if (!active || isPanel(event.target) || ![0, 1, 2].includes(event.button) || gesture.current) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, button: event.button, moved: false, x: event.clientX, y: event.clientY, camera: view.camera };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return;
    g.moved ||= isCanvasDrag(g, { x: event.clientX, y: event.clientY });
    if (!g.moved) return;
    setDragging(true);
    setView(old => ({ ...old, camera: { ...g.camera, x: g.camera.x + event.clientX - g.x, y: g.camera.y + event.clientY - g.y } }));
  };
  const finish = (event: PointerEvent<HTMLDivElement>, reason: "up" | "cancel" | "lost" = "up") => {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return;
    if (reason === "cancel") setView(old => ({ ...old, camera: g.camera }));
    if (reason === "up") {
      g.moved ||= isCanvasDrag(g, { x: event.clientX, y: event.clientY });
      if (g.moved) setView(old => ({ ...old, camera: { ...g.camera, x: g.camera.x + event.clientX - g.x, y: g.camera.y + event.clientY - g.y } }));
      else if (g.button === 0) {
        const bounds = event.currentTarget.getBoundingClientRect();
        const point = psdPoint({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, g.camera);
        const request = ++selectionRequest.current;
        void pickPsdLayer(asset, point, hasPixel).then(key => { if (selectionRequest.current === request) onSelect(key); });
      }
    }
    gesture.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const zoom = (factor: number | "actual") => { selectionRequest.current++; setView(old => ({ ...old, camera: zoomPsdCamera(old.camera, { x: old.size.width / 2, y: old.size.height / 2 }, factor === "actual" ? 1 : old.camera.zoom * factor) })); };
  const panels = placePsdPanels(view.size, asset, view.camera, heights), camera = view.camera;

  return <div ref={stage} className={`psd-slice-canvas ${dragging ? "is-dragging" : ""}`} role="region" aria-label="PSD 画布"
    onPointerDown={begin} onPointerMove={move} onPointerUp={e => finish(e)} onPointerCancel={e => finish(e, "cancel")} onLostPointerCapture={e => finish(e, "lost")}
    onContextMenu={e => { if (!isPanel(e.target)) e.preventDefault(); }}>
    <div className="psd-page-preview" style={{ left: camera.x, top: camera.y, width: asset.width * camera.zoom, height: asset.height * camera.zoom, visibility: view.ready ? "visible" : "hidden" }}>
      <div className="psd-page-caption"><span>{asset.name}</span><small>{asset.width} × {asset.height}</small></div>
      <div className="psd-preview-world checkerboard" style={{ width: asset.width, height: asset.height, transform: `scale(${camera.zoom})` }}>
        <img className="psd-composite" src={asset.preview} alt={`${asset.name} 整图预览`} draggable={false} />
        {selected && !selected.group ? <div className="psd-selected-outline" style={{ left: selected.left, top: selected.top, width: selected.width, height: selected.height, borderWidth: 1 / camera.zoom }} /> : null}
      </div>
    </div>
    <aside ref={leftPanel} aria-label="PSD 图层面板" className="psd-tree-panel psd-follow-panel floating-panel" style={{ ...panels.left, visibility: view.ready ? "visible" : "hidden" }}>{tree}</aside>
    <aside ref={rightPanel} aria-label="PSD 切图属性面板" className="psd-properties psd-follow-panel floating-panel" style={{ ...panels.right, visibility: view.ready ? "visible" : "hidden" }}>{properties}</aside>
    <div className="psd-canvas-controls floating-panel" aria-label="PSD 视图控制">
      <Button size="icon" variant="ghost" aria-label="PSD 缩小" title="缩小" onClick={() => zoom(1 / 1.2)}><Minus size={14} /></Button>
      <Button variant="ghost" aria-label="PSD 实际大小" title="恢复 100%" onClick={() => zoom("actual")}>{Math.round(camera.zoom * 100)}%</Button>
      <Button size="icon" variant="ghost" aria-label="PSD 放大" title="放大" onClick={() => zoom(1.2)}><Plus size={14} /></Button>
      <Button size="icon" variant="ghost" aria-label="PSD 适应窗口" title="适应窗口" onClick={() => { selectionRequest.current++; setView(old => ({ ...old, camera: fitPsdCamera(old.size, asset) })); }}><Focus size={14} /></Button>
    </div>
  </div>;
}
