import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Focus, Minus, Plus, X } from "lucide-react";
import { EMPTY_GRID, setGridEdge, validGrid, type NineGrid, type PsdLayer } from "../../shared/psd-meta";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

type Edge = "top" | "right" | "bottom" | "left";
const EDGES: { edge: Edge; label: string }[] = [{ edge: "top", label: "上" }, { edge: "right", label: "右" }, { edge: "bottom", label: "下" }, { edge: "left", label: "左" }];
const clampZoom = (n: number) => Math.max(0.1, Math.min(16, n));

export function NineGridPreview({ image, width, height, grid }: { image: string; width: number; height: number; grid: NineGrid }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [target, setTarget] = useState({ width: 400, height: 100 });
  const dw = Math.max(grid.left + grid.right + 1, target.width), dh = Math.max(grid.top + grid.bottom + 1, target.height);
  useEffect(() => {
    let cancelled = false; const source = new Image();
    source.onload = () => {
      const element = canvas.current; if (!element || cancelled) return;
      element.width = dw; element.height = dh; const ctx = element.getContext("2d")!; ctx.clearRect(0, 0, dw, dh);
      const sx = [0, grid.left, width - grid.right, width], sy = [0, grid.top, height - grid.bottom, height];
      const dx = [0, grid.left, dw - grid.right, dw], dy = [0, grid.top, dh - grid.bottom, dh];
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
        const sw = sx[x + 1] - sx[x], sh = sy[y + 1] - sy[y], tw = dx[x + 1] - dx[x], th = dy[y + 1] - dy[y];
        if (sw <= 0 || sh <= 0 || tw <= 0 || th <= 0) continue;
        if (grid.repeat && (x === 1 || y === 1)) {
          const tile = document.createElement("canvas"); tile.width = x === 1 ? sw : tw; tile.height = y === 1 ? sh : th;
          tile.getContext("2d")!.drawImage(source, sx[x], sy[y], sw, sh, 0, 0, tile.width, tile.height);
          ctx.save(); ctx.translate(dx[x], dy[y]); ctx.fillStyle = ctx.createPattern(tile, "repeat")!; ctx.fillRect(0, 0, tw, th); ctx.restore();
        } else ctx.drawImage(source, sx[x], sy[y], sw, sh, dx[x], dy[y], tw, th);
      }
    };
    source.src = image; return () => { cancelled = true; };
  }, [image, width, height, grid, dw, dh]);
  return <section className="nine-preview"><div className="psd-section-heading"><strong>拉伸预览</strong><div><Input aria-label="预览宽度" type="number" min={1} max={800} value={target.width} onChange={e => setTarget({ ...target, width: Math.max(1, Math.min(800, Number(e.target.value))) })} /><span>×</span><Input aria-label="预览高度" type="number" min={1} max={400} value={target.height} onChange={e => setTarget({ ...target, height: Math.max(1, Math.min(400, Number(e.target.value))) })} /></div></div><div className="nine-preview-surface checkerboard"><canvas ref={canvas} style={{ maxWidth: "100%", maxHeight: 120, objectFit: "contain" }} /></div></section>;
}

export function NineGridEditor({ layer, onSave, onCancel }: { layer: PsdLayer; onSave: (grid: NineGrid) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), stage = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<NineGrid>(() => validGrid(layer.config.nineGrid, layer.width, layer.height) ? { ...layer.config.nineGrid } : { ...EMPTY_GRID });
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ edge?: Edge; x: number; y: number; camera: typeof camera; grid: NineGrid } | null>(null);
  const fit = () => { const bounds = stage.current?.getBoundingClientRect(); if (!bounds) return; const zoom = clampZoom(Math.min(2, (bounds.width - 120) / layer.width, (bounds.height - 80) / layer.height)); setCamera({ x: (bounds.width - layer.width * zoom) / 2, y: (bounds.height - layer.height * zoom) / 2, zoom }); };
  useEffect(() => { dialog.current?.showModal(); fit(); const element = stage.current; if (!element) return; const resize = new ResizeObserver(() => { if (!gesture.current) fit(); }); resize.observe(element); return () => resize.disconnect(); }, []);
  useEffect(() => {
    const element = stage.current; if (!element) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); if (gesture.current) return; const rect = element.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top; const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1); setCamera(old => { const zoom = clampZoom(old.zoom * Math.exp(-delta * 0.0018)); return { x: x - (x - old.x) / old.zoom * zoom, y: y - (y - old.y) / old.zoom * zoom, zoom }; }); };
    element.addEventListener("wheel", wheel, { passive: false }); return () => element.removeEventListener("wheel", wheel);
  }, []);
  const begin = (event: PointerEvent<HTMLDivElement>) => {
    const edge = (event.target as HTMLElement).dataset.edge as Edge | undefined;
    if (event.button !== 2 && !(event.button === 0 && edge)) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { edge: event.button === 2 ? undefined : edge, x: event.clientX, y: event.clientY, camera, grid }; setDragging(true);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current; if (!g) return;
    if (!g.edge) { setCamera({ ...g.camera, x: g.camera.x + event.clientX - g.x, y: g.camera.y + event.clientY - g.y }); return; }
    const delta = (g.edge === "left" || g.edge === "right" ? event.clientX - g.x : event.clientY - g.y) / g.camera.zoom;
    setGrid(setGridEdge(g.grid, g.edge, g.grid[g.edge] + (g.edge === "right" || g.edge === "bottom" ? -delta : delta), layer.width, layer.height));
  };
  const finish = (event: PointerEvent<HTMLDivElement>, cancel = false) => { if (cancel && gesture.current) { setGrid(gesture.current.grid); setCamera(gesture.current.camera); } gesture.current = null; setDragging(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  return <dialog ref={dialog} className="psd-dialog nine-dialog" onCancel={e => { e.preventDefault(); onCancel(); }} onKeyDown={e => e.stopPropagation()}>
    <header><strong>九宫格 · {layer.name}</strong><Button size="icon" variant="ghost" aria-label="关闭九宫格编辑" onClick={onCancel}><X size={16} /></Button></header>
    <p className="psd-hint">拖动虚线调整边距 · 滚轮缩放 · 按住鼠标右键平移</p>
    <div className={`nine-stage checkerboard ${dragging ? "is-dragging" : ""}`} ref={stage} onContextMenu={e => e.preventDefault()} onPointerDown={begin} onPointerMove={move} onPointerUp={e => finish(e)} onPointerCancel={e => finish(e, true)}>
      <img src={layer.image} alt={layer.name} draggable={false} style={{ left: camera.x, top: camera.y, width: layer.width * camera.zoom, height: layer.height * camera.zoom }} />
      {EDGES.map(({ edge, label }) => {
        const vertical = edge === "left" || edge === "right";
        const position = vertical ? camera.x + (edge === "left" ? grid.left : layer.width - grid.right) * camera.zoom : camera.y + (edge === "top" ? grid.top : layer.height - grid.bottom) * camera.zoom;
        return <div key={edge} className={`nine-guide ${vertical ? "vertical" : "horizontal"}`} data-edge={edge} role="slider" tabIndex={0} aria-label={`${label}边距虚线`} aria-valuenow={grid[edge]} aria-valuemin={0} aria-valuemax={(vertical ? layer.width : layer.height) - 1} style={vertical ? { left: position } : { top: position }} onKeyDown={e => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); const direction = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1; setGrid(setGridEdge(grid, edge, grid[edge] + direction * (e.shiftKey ? 10 : 1), layer.width, layer.height)); } }}><span>{label} {grid[edge]}</span></div>;
      })}
      <div className="nine-zoom"><Button size="icon" variant="ghost" aria-label="九宫格缩小" onClick={() => setCamera({ ...camera, zoom: clampZoom(camera.zoom / 1.2) })}><Minus size={14} /></Button><span>{Math.round(camera.zoom * 100)}%</span><Button size="icon" variant="ghost" aria-label="九宫格放大" onClick={() => setCamera({ ...camera, zoom: clampZoom(camera.zoom * 1.2) })}><Plus size={14} /></Button><Button size="icon" variant="ghost" aria-label="九宫格适应窗口" onClick={fit}><Focus size={14} /></Button></div>
    </div>
    <div className="nine-inputs">{EDGES.map(({ edge, label }) => <label key={edge}><span>{label}</span><Input aria-label={`九宫格${label}边距`} type="number" min={0} value={grid[edge]} onChange={e => setGrid(setGridEdge(grid, edge, Number(e.target.value), layer.width, layer.height))} /></label>)}<label className="repeat-toggle"><input type="checkbox" checked={grid.repeat} onChange={e => setGrid({ ...grid, repeat: e.target.checked })} />重复填充</label></div>
    <NineGridPreview image={layer.image!} width={layer.width} height={layer.height} grid={grid} />
    <footer><span>{layer.width} × {layer.height} px</span><Button onClick={() => onSave(grid)}>确认</Button><Button variant="secondary" onClick={onCancel}>取消</Button></footer>
  </dialog>;
}
