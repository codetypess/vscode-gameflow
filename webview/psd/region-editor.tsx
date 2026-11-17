import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { X } from "lucide-react";
import { centerSliceRegion, MAX_SLICE_SIZE, moveSliceContent, sliceRegion, validGrid, validSliceRegion, type PsdLayer, type SliceRegion } from "../../shared/psd-meta";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function RegionEditor({ layer, onSave, onCancel }: { layer: PsdLayer; onSave: (region: SliceRegion | undefined) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), stage = useRef<HTMLDivElement>(null);
  const [region, setRegion] = useState(() => ({ ...sliceRegion(layer) }));
  const [viewport, setViewport] = useState({ width: 600, height: 300 });
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ pointerId: number; x: number; y: number; region: SliceRegion; zoom: number } | null>(null);
  const valid = validSliceRegion(region);
  const lastValid = useRef(sliceRegion(layer)); if (valid) lastValid.current = region;
  const preview = lastValid.current;
  const zoom = Math.max(.01, Math.min(2, (viewport.width - 48) / preview.width, (viewport.height - 48) / preview.height));
  const gridValid = !layer.config.nineGrid || validGrid(layer.config.nineGrid, region.width, region.height);
  const error = !valid ? "宽高须为 1–4096 的整数且总像素不超过 800 万；图片位置须为 -4096–4096 的整数。" : !gridValid ? "当前尺寸容纳不下已设置的九宫格，请增大区域或先调整九宫格。" : "";
  useEffect(() => {
    dialog.current?.showModal(); stage.current?.focus();
    const element = stage.current; if (!element) return;
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    measure(); const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const cancel = () => { const g = gesture.current; if (g) { gesture.current = null; setRegion(g.region); setDragging(false); if (stage.current?.hasPointerCapture(g.pointerId)) stage.current.releasePointerCapture(g.pointerId); } };
    window.addEventListener("blur", cancel); return () => window.removeEventListener("blur", cancel);
  }, []);
  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || gesture.current || !valid) return;
    event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, region: { ...region }, zoom }; setDragging(true);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return;
    setRegion(moveSliceContent(g.region, (event.clientX - g.x) / g.zoom, (event.clientY - g.y) / g.zoom));
  };
  const finish = (event: PointerEvent<HTMLDivElement>, cancel = false) => {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return;
    if (cancel) setRegion(g.region); else move(event);
    gesture.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keydown = (event: KeyboardEvent<HTMLDialogElement>) => {
    event.stopPropagation();
    if ((event.target as HTMLElement).closest("input,textarea") || event.ctrlKey || event.metaKey || event.altKey || gesture.current || !valid) return;
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta) return;
    event.preventDefault(); const step = event.shiftKey ? 10 : 1;
    setRegion(old => moveSliceContent(old, delta[0] * step, delta[1] * step));
  };
  const numeric = (value: number) => Number.isFinite(value) ? value : "";
  const read = (value: string) => value.trim() === "" ? NaN : Number(value);
  const save = () => {
    if (error) return;
    onSave(region.x === 0 && region.y === 0 && region.width === layer.width && region.height === layer.height ? undefined : region);
  };
  return <dialog ref={dialog} className="psd-dialog region-dialog" aria-label={`编辑区域 · ${layer.name}`} onCancel={e => { e.preventDefault(); onCancel(); }} onKeyDown={keydown}>
    <header><strong>编辑区域 · {layer.name}</strong><Button size="icon" variant="ghost" aria-label="关闭区域编辑" onClick={onCancel}><X size={16} /></Button></header>
    <p className="psd-hint">设置导出大小后拖动图片 · 方向键微调 1 px，Shift + 方向键移动 10 px · 留白透明，图片保持原尺寸</p>
    <div ref={stage} tabIndex={0} role="region" aria-label="区域预览，拖动图片或使用方向键调整位置" className={`region-stage ${dragging ? "is-dragging" : ""}`}
      onPointerDown={begin} onPointerMove={move} onPointerUp={e => finish(e)} onPointerCancel={e => finish(e, true)} onLostPointerCapture={e => finish(e, true)}>
      <div className="region-artboard checkerboard" style={{ width: preview.width * zoom, height: preview.height * zoom }}>
        <img src={layer.image} alt={`${layer.name} 区域内容`} draggable={false} style={{ left: -preview.x * zoom, top: -preview.y * zoom, width: layer.width * zoom, height: layer.height * zoom }} />
      </div>
      <span className="region-preview-size">{preview.width} × {preview.height} px · {Math.round(zoom * 100)}%</span>
    </div>
    <div className="region-settings">
      <div className="region-setting-row"><strong>导出大小</strong><label>宽<Input autoComplete="off" aria-label="导出宽度" type="number" min={1} max={MAX_SLICE_SIZE} step={1} value={numeric(region.width)} aria-invalid={!valid} onChange={e => setRegion({ ...region, width: read(e.target.value) })} /></label><label>高<Input autoComplete="off" aria-label="导出高度" type="number" min={1} max={MAX_SLICE_SIZE} step={1} value={numeric(region.height)} aria-invalid={!valid} onChange={e => setRegion({ ...region, height: read(e.target.value) })} /></label><span>px</span></div>
      <div className="region-setting-row"><strong>图片位置</strong><label>X<Input autoComplete="off" aria-label="图片 X 位置" type="number" min={-MAX_SLICE_SIZE} max={MAX_SLICE_SIZE} step={1} value={numeric(-region.x)} aria-invalid={!valid} onChange={e => setRegion({ ...region, x: -read(e.target.value) })} /></label><label>Y<Input autoComplete="off" aria-label="图片 Y 位置" type="number" min={-MAX_SLICE_SIZE} max={MAX_SLICE_SIZE} step={1} value={numeric(-region.y)} aria-invalid={!valid} onChange={e => setRegion({ ...region, y: -read(e.target.value) })} /></label><span>px</span></div>
      <div className="region-setting-actions"><Button variant="secondary" disabled={!valid} onClick={() => setRegion(centerSliceRegion(region, layer))}>居中</Button><Button variant="ghost" onClick={() => setRegion({ x: 0, y: 0, width: layer.width, height: layer.height })}>恢复原始区域</Button><small>原图 {layer.width} × {layer.height} px</small></div>
      {error ? <p className="psd-warning" role="alert">{error}</p> : null}
    </div>
    <footer><Button disabled={!!error} onClick={save}>确认</Button><Button variant="secondary" onClick={onCancel}>取消</Button></footer>
  </dialog>;
}
