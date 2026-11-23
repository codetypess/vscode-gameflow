import { DialogHeading } from "../components/dialog-heading";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Focus, LocateFixed, Minus, Plus, RotateCcw } from "lucide-react";
import { centerSliceRegion, MAX_SLICE_SIZE, moveSliceContent, sliceRegion, validGrid, validSliceRegion, type PsdLayer, type SliceRegion } from "../../shared/psd-meta";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { fitRegionCamera, REGION_EDGES, resizedRegionCamera, resizeSliceRegion, zoomRegionCamera, type RegionCamera, type RegionEdge } from "./region-geometry";

import { useRegionDialog } from "./use-region-dialog";

export function RegionEditor({ layer, onSave, onCancel }: { layer: PsdLayer; onSave: (region: SliceRegion | undefined) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), stage = useRef<HTMLDivElement>(null);
  const [region, setRegion] = useState(() => ({ ...sliceRegion(layer) }));
  const viewport = useRef({ width: 0, height: 0 });
  const [camera, setCamera] = useState<RegionCamera>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ pointerId: number; x: number; y: number; region: SliceRegion; camera: RegionCamera; edge?: RegionEdge; pan: boolean } | null>(null);
  const valid = validSliceRegion(region);
  const lastValid = useRef(sliceRegion(layer)); if (valid) lastValid.current = region;
  const preview = lastValid.current;
  const { zoom } = camera;
  const minimum = { width: (layer.config.nineGrid?.left ?? 0) + (layer.config.nineGrid?.right ?? 0) + 1, height: (layer.config.nineGrid?.top ?? 0) + (layer.config.nineGrid?.bottom ?? 0) + 1 };
  const fit = (next = lastValid.current) => setCamera(fitRegionCamera(viewport.current, next));
  const gridValid = !layer.config.nineGrid || validGrid(layer.config.nineGrid, region.width, region.height);
  const error = !valid ? "宽高须为 1–4096 的整数且总像素不超过 800 万；图片位置须为 -4096–4096 的整数。" : !gridValid ? "当前尺寸容纳不下已设置的九宫格，请增大区域或先调整九宫格。" : "";
  useEffect(() => {
    dialog.current?.showModal(); stage.current?.focus();
    const element = stage.current; if (!element) return;
    const measure = () => {
      const size = { width: element.clientWidth, height: element.clientHeight }; if (!size.width || !size.height) return;
      const before = viewport.current; viewport.current = size;
      setCamera(old => before.width ? { ...old, x: old.x + (size.width - before.width) / 2, y: old.y + (size.height - before.height) / 2 } : fitRegionCamera(size, lastValid.current));
    };
    measure(); const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const cancel = () => { const g = gesture.current; if (g) { gesture.current = null; setRegion(g.region); setCamera(g.camera); setDragging(false); if (stage.current?.hasPointerCapture(g.pointerId)) stage.current.releasePointerCapture(g.pointerId); } };
    window.addEventListener("blur", cancel); return () => window.removeEventListener("blur", cancel);
  }, []);
  useEffect(() => {
    const element = stage.current; if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); if (gesture.current) return;
      const rect = element.getBoundingClientRect(), point = { x: event.clientX - rect.left - element.clientLeft, y: event.clientY - rect.top - element.clientTop };
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      setCamera(old => zoomRegionCamera(old, point, old.zoom * Math.exp(-delta * .0018)));
    };
    element.addEventListener("wheel", wheel, { passive: false }); return () => element.removeEventListener("wheel", wheel);
  }, []);
  const windowLayout = useRegionDialog(dialog);
  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (![0, 2].includes(event.button) || gesture.current || !valid || (event.target as HTMLElement).closest(".nine-zoom")) return;
    event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    const edge = (event.target as HTMLElement).closest<HTMLElement>("[data-region-edge]")?.dataset.regionEdge as RegionEdge | undefined;
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, region: { ...region }, camera: { ...camera }, edge: event.button === 0 ? edge : undefined, pan: event.button === 2 }; setDragging(true);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return;
    const dx = event.clientX - g.x, dy = event.clientY - g.y;
    if (g.pan) { setCamera({ ...g.camera, x: g.camera.x + dx, y: g.camera.y + dy }); return; }
    if (g.edge) {
      const next = resizeSliceRegion(g.region, g.edge, (g.edge === "left" || g.edge === "right" ? dx : dy) / g.camera.zoom, minimum);
      setRegion(next); setCamera(resizedRegionCamera(g.camera, g.region, next));
    } else setRegion(moveSliceContent(g.region, dx / g.camera.zoom, dy / g.camera.zoom));
  };
  const finish = (event: PointerEvent<HTMLDivElement>, cancel = false) => {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return;
    if (cancel) { setRegion(g.region); setCamera(g.camera); } else move(event);
    gesture.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keydown = (event: KeyboardEvent<HTMLDialogElement>) => {
    event.stopPropagation();
    if ((event.target as HTMLElement).closest("input,textarea") || event.ctrlKey || event.metaKey || event.altKey || gesture.current || windowLayout.active || !valid) return;
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta) return;
    event.preventDefault(); const step = event.shiftKey ? 10 : 1;
    const edge = (event.target as HTMLElement).closest<HTMLElement>("[data-region-edge]")?.dataset.regionEdge as RegionEdge | undefined;
    if (edge) {
      const next = resizeSliceRegion(region, edge, (edge === "left" || edge === "right" ? delta[0] : delta[1]) * step, minimum);
      setRegion(next); setCamera(resizedRegionCamera(camera, region, next));
    } else setRegion(old => moveSliceContent(old, delta[0] * step, delta[1] * step));
  };
  const numeric = (value: number) => Number.isFinite(value) ? value : "";
  const read = (value: string) => value.trim() === "" ? NaN : Number(value);
  const setSize = (key: "width" | "height", value: string) => { const next = { ...region, [key]: read(value) }; setRegion(next); if (validSliceRegion(next)) fit(next); };
  const zoomBy = (factor: number) => setCamera(old => zoomRegionCamera(old, { x: viewport.current.width / 2, y: viewport.current.height / 2 }, old.zoom * factor));
  const save = () => {
    if (error) return;
    onSave(region.x === 0 && region.y === 0 && region.width === layer.width && region.height === layer.height ? undefined : region);
  };
  return <dialog ref={dialog} className="floating-panel workbench-dialog psd-dialog region-dialog" style={windowLayout.style} aria-label={`编辑区域 · ${layer.name}`} onCancel={e => { e.preventDefault(); onCancel(); }} onKeyDown={keydown}>
    <DialogHeading heading={`编辑区域 · ${layer.name}`} closeLabel="关闭区域编辑" onClose={onCancel} {...windowLayout.titleEvents} />
    <p className="psd-hint">拖动虚线调整区域，拖动图片调整位置 · 滚轮缩放，右键平移 · 方向键微调 1 px，Shift + 方向键 10 px</p>
    <div ref={stage} tabIndex={0} role="region" aria-label="区域预览，拖动图片或使用方向键调整位置" className={`region-stage ${dragging ? "is-dragging" : ""}`}
      onContextMenu={e => e.preventDefault()} onPointerDown={begin} onPointerMove={move} onPointerUp={e => finish(e)} onPointerCancel={e => finish(e, true)} onLostPointerCapture={e => finish(e, true)}>
      <div className="region-artboard checkerboard" style={{ left: camera.x, top: camera.y, width: preview.width * zoom, height: preview.height * zoom }}>
        <img src={layer.image} alt={`${layer.name} 区域内容`} draggable={false} style={{ left: -preview.x * zoom, top: -preview.y * zoom, width: layer.width * zoom, height: layer.height * zoom }} />
      </div>
      {REGION_EDGES.map(({ edge, label }) => {
        const vertical = edge === "left" || edge === "right";
        return <div key={edge} className={`region-edge nine-guide ${vertical ? "vertical" : "horizontal"}`} data-region-edge={edge} role="slider" tabIndex={0} aria-label={`导出区域${label}边线`} aria-orientation={vertical ? "horizontal" : "vertical"} aria-valuenow={vertical ? preview.width : preview.height} aria-valuemin={vertical ? minimum.width : minimum.height} aria-valuemax={MAX_SLICE_SIZE} style={vertical ? { left: camera.x + (edge === "right" ? preview.width * zoom : 0) } : { top: camera.y + (edge === "bottom" ? preview.height * zoom : 0) }} />;
      })}
      <span className="region-preview-size">{preview.width} × {preview.height} px</span>
      <div className="nine-zoom" role="toolbar" aria-label="区域编辑工具" onPointerDown={e => e.stopPropagation()}>
        <Button size="icon" variant="ghost" aria-label="图片居中" title="图片居中" disabled={!valid} onClick={() => setRegion(centerSliceRegion(region, layer))}><LocateFixed size={14} /></Button>
        <Button size="icon" variant="ghost" aria-label="恢复原始区域" title="恢复原始区域" onClick={() => { const next = { x: 0, y: 0, width: layer.width, height: layer.height }; setRegion(next); fit(next); }}><RotateCcw size={14} /></Button>
        <span className="region-tool-divider" aria-hidden="true" />
        <Button size="icon" variant="ghost" aria-label="区域缩小" title="缩小" onClick={() => zoomBy(1 / 1.2)}><Minus size={14} /></Button><span>{Math.round(zoom * 100)}%</span>
        <Button size="icon" variant="ghost" aria-label="区域放大" title="放大" onClick={() => zoomBy(1.2)}><Plus size={14} /></Button>
        <Button size="icon" variant="ghost" aria-label="区域适应窗口" title="适应窗口" onClick={() => fit()}><Focus size={14} /></Button>
      </div>
    </div>
    <div className="region-settings">
      <div className="region-setting-row"><strong>导出大小</strong><label>宽<Input autoComplete="off" aria-label="导出宽度" type="number" min={1} max={MAX_SLICE_SIZE} step={1} value={numeric(region.width)} aria-invalid={!valid} onChange={e => setSize("width", e.target.value)} /></label><label>高<Input autoComplete="off" aria-label="导出高度" type="number" min={1} max={MAX_SLICE_SIZE} step={1} value={numeric(region.height)} aria-invalid={!valid} onChange={e => setSize("height", e.target.value)} /></label><span>px</span></div>
      <div className="region-setting-row"><strong>图片位置</strong><label>X<Input autoComplete="off" aria-label="图片 X 位置" type="number" min={-MAX_SLICE_SIZE} max={MAX_SLICE_SIZE} step={1} value={numeric(-region.x)} aria-invalid={!valid} onChange={e => setRegion({ ...region, x: -read(e.target.value) })} /></label><label>Y<Input autoComplete="off" aria-label="图片 Y 位置" type="number" min={-MAX_SLICE_SIZE} max={MAX_SLICE_SIZE} step={1} value={numeric(-region.y)} aria-invalid={!valid} onChange={e => setRegion({ ...region, y: -read(e.target.value) })} /></label><span>px</span></div>
      {error ? <p className="psd-warning" role="alert">{error}</p> : null}
    </div>
    <footer><span>原图 {layer.width} × {layer.height} px</span><Button disabled={!!error} onClick={save}>确认</Button><Button variant="secondary" onClick={onCancel}>取消</Button></footer>
    <button type="button" className="region-window-resize" aria-label="调整区域编辑窗口大小" title="拖动调整窗口大小；方向键微调" {...windowLayout.resizeEvents} onKeyDown={windowLayout.resizeKeydown}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="m4 12 8-8m-4 8 4-4" /></svg></button>
  </dialog>;
}
