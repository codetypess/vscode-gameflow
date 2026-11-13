import { ArrowLeft, Box, Check, ChevronDown, Focus, Hand, ImageIcon, Layers3, LayoutPanelTop, Minus, MousePointer2, MousePointerClick, PanelRight, Plus, RectangleHorizontal, Redo2, Save, Type, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Frame, GameFlowNode, GameFlowPage } from "../shared/model";
import { absoluteFrame, descendants, duplicateNode, duplicatePage, inheritedFlag, insertNode, makeNode, moveNode, NODE_LABELS, removeNode, removePage, resizeFrame, type Handle, type InsertType, type LayerDrop } from "../shared/editor-ops";
import { Button } from "./components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Separator } from "./components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { Inspector } from "./editor/inspector";
import { LayerTree } from "./editor/layer-tree";
import { NodeView, orderedNodes } from "./editor/node-view";
import { useDocument } from "./use-document";
import { isBrowserPreview } from "./vscode-api";
import { cn } from "./lib/utils";

type Tool = "select" | "hand" | InsertType;
type Camera = { x: number; y: number; zoom: number };
type Gesture = { kind: "pan" | "page" | "node" | "resize"; clientX: number; clientY: number; camera: Camera; pageId?: string; nodeId?: string; handle?: Handle; origin: Frame; next: Frame; moved: boolean };
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const TOOLS = [
  { type: "container", icon: Box, key: "F" }, { type: "rectangle", icon: RectangleHorizontal, key: "R" },
  { type: "text", icon: Type, key: "T" }, { type: "button", icon: MousePointerClick, key: "B" }, { type: "image", icon: ImageIcon, key: "I" }
] as const;
const uid = () => crypto.randomUUID();
const clampZoom = (value: number) => Math.max(0.1, Math.min(3, value));
const isField = (target: EventTarget | null) => target instanceof Element && !!target.closest("input, textarea, select, [contenteditable=true]");

function IconTool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick?: () => void; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><Button size="icon" variant={active ? "secondary" : "ghost"} className={cn("toolbar-button", active && "tool-active")} aria-label={label} disabled={disabled} onClick={onClick}>{children}</Button></TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>;
}

export function App() {
  const { document: canvasDocument, resourceName, dirty, pending, error, edit, read, history, save } = useDocument();
  const viewport = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importTarget = useRef<{ pageId: string; nodeId: string } | null>(null);
  const initialized = useRef(false);
  const gesture = useRef<Gesture | null>(null);
  const overviewCamera = useRef<Camera>({ x: 80, y: 80, zoom: 0.6 });
  const [camera, setCamera] = useState<Camera>(overviewCamera.current);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [spaceHand, setSpaceHand] = useState(false);
  const [preview, setPreview] = useState<Gesture | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [insertOpen, setInsertOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const page = canvasDocument?.pages.find((item) => item.id === (editingId ?? selectedPageId)) ?? null;
  const selectedNode = editingId ? page?.nodes.find((item) => item.id === selectedNodeId) ?? null : null;
  const updatePage = (id: string, transform: (page: GameFlowPage) => GameFlowPage) => edit((document) => ({ ...document, pages: document.pages.map((item) => item.id === id ? transform(item) : item) }));
  const patchNode = (id: string, patch: Partial<GameFlowNode>) => { if (page) updatePage(page.id, (item) => ({ ...item, nodes: item.nodes.map((node) => node.id === id ? { ...node, ...patch } : node) })); };

  const fit = (pages: GameFlowPage[], internal: boolean) => {
    const bounds = viewport.current?.getBoundingClientRect();
    if (!bounds || !pages.length) { setCamera({ x: 80, y: 80, zoom: 0.6 }); return; }
    const left = internal && bounds.width >= 900 ? 248 : 40;
    const right = internal && bounds.width >= 900 ? 302 : 40;
    const minX = internal ? 0 : Math.min(...pages.map((item) => item.frame.x));
    const minY = internal ? 0 : Math.min(...pages.map((item) => item.frame.y));
    const maxX = Math.max(...pages.map((item) => (internal ? 0 : item.frame.x) + item.frame.width));
    const maxY = Math.max(...pages.map((item) => (internal ? 0 : item.frame.y) + item.frame.height));
    const zoom = Math.max(0.1, Math.min(1, (bounds.width - left - right) / (maxX - minX), (bounds.height - 160) / (maxY - minY)));
    setCamera({ x: left + (bounds.width - left - right - (maxX - minX) * zoom) / 2 - minX * zoom, y: 56 + (bounds.height - 160 - (maxY - minY) * zoom) / 2 - minY * zoom, zoom });
  };
  const enter = (target: GameFlowPage) => {
    if (!editingId) overviewCamera.current = camera;
    setEditingId(target.id); setSelectedPageId(target.id); setSelectedNodeId(null);
    setTool("select"); setInspectorOpen(true); fit([target], true);
  };
  const back = () => { gesture.current = null; setPreview(null); setEditingId(null); setSelectedNodeId(null); setTool("select"); setCamera(overviewCamera.current); };
  useEffect(() => {
    if (canvasDocument && !initialized.current && viewport.current) { initialized.current = true; fit(canvasDocument.pages, false); }
    if (editingId && canvasDocument && !canvasDocument.pages.some((item) => item.id === editingId)) back();
  }, [canvasDocument, editingId]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 4500); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest(".floating-panel, .canvas-toolbar, .canvas-zoom")) return;
      event.preventDefault();
      if (gesture.current) return;
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      setCamera((previous) => { const zoom = clampZoom(previous.zoom * Math.exp(-delta * 0.0018)); return { x: x - (x - previous.x) / previous.zoom * zoom, y: y - (y - previous.y) / previous.zoom * zoom, zoom }; });
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [!!canvasDocument]);
  const selectNode = (id: string | null) => { setSelectedNodeId(id); setInspectorOpen(true); setTool("select"); };
  const addPage = () => {
    if (!canvasDocument) return;
    if (editingId) back();
    const id = uid();
    const x = canvasDocument.pages.length ? Math.max(...canvasDocument.pages.map((item) => item.frame.x + item.frame.width)) + 80 : 0;
    const next: GameFlowPage = { id, name: `页面 ${canvasDocument.pages.length + 1}`, kind: "screen", frame: { x, y: 0, width: 390, height: 844 }, nodes: [] };
    edit((document) => ({ ...document, pages: [...document.pages, next] }));
    setSelectedPageId(id); setSelectedNodeId(null); setInspectorOpen(true); setInsertOpen(false); fit([...canvasDocument.pages, next], false);
  };
  const placeNode = (type: InsertType, x: number, y: number) => {
    if (!editingId || !page) return;
    const node = makeNode(type, uid(), x, y);
    updatePage(page.id, (item) => ({ ...item, nodes: [...item.nodes, node] }));
    setSelectedNodeId(node.id); setInspectorOpen(true); setTool("select");
  };
  const addLayer = (type: InsertType, parentId?: string, afterId?: string) => {
    if (!editingId) return;
    const id = uid();
    updatePage(editingId, (item) => {
      const parent = item.nodes.find((node) => node.id === parentId);
      const bounds = parent?.frame ?? item.frame;
      const offset = item.nodes.filter((node) => node.parentId === parentId).length % 4 * 12;
      return insertNode(item, makeNode(type, id, bounds.width / 2 + offset, bounds.height / 2 + offset), parentId, afterId);
    });
    selectNode(id);
  };
  const deleteLayer = (id: string) => {
    if (!editingId) return;
    const currentPage = read()?.pages.find((item) => item.id === editingId);
    const node = currentPage?.nodes.find((item) => item.id === id);
    if (!currentPage || !node || inheritedFlag(currentPage, node, "locked")) return;
    const removed = descendants(currentPage, id);
    updatePage(editingId, (item) => {
      const current = item.nodes.find((entry) => entry.id === id);
      return current && !inheritedFlag(item, current, "locked") ? removeNode(item, id) : item;
    });
    setSelectedNodeId((selected) => selected && removed.has(selected) ? null : selected);
  };
  const moveLayer = (id: string, target: LayerDrop) => { if (editingId) updatePage(editingId, (item) => moveNode(item, id, target)); };
  const duplicate = () => {
    if (!page || (selectedNode && inheritedFlag(page, selectedNode, "locked"))) return;
    if (selectedNode) { const result = duplicateNode(page, selectedNode.id, uid); updatePage(page.id, () => result.page); setSelectedNodeId(result.id); }
    else { const next = duplicatePage(page, uid); edit((document) => ({ ...document, pages: [...document.pages, next] })); if (editingId) back(); setSelectedPageId(next.id); fit([...(canvasDocument?.pages ?? []), next], false); }
  };
  const remove = () => {
    if (!page || (selectedNode && inheritedFlag(page, selectedNode, "locked"))) return;
    if (selectedNode) { updatePage(page.id, (item) => removeNode(item, selectedNode.id)); setSelectedNodeId(null); }
    else { edit((document) => removePage(document, page.id)); if (editingId) back(); setSelectedPageId(null); }
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as Element).closest("[role=menu]")) return;
      const command = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      if (isField(event.target)) {
        if (command && key === "s") { event.preventDefault(); (event.target as HTMLElement).blur(); save(); }
        return;
      }
      if (key === "escape") { if (gesture.current) { gesture.current = null; setPreview(null); } else { setTool("select"); setSelectedNodeId(null); setInsertOpen(false); } return; }
      if (command && ["z", "y", "s", "d"].includes(key)) {
        event.preventDefault(); if (gesture.current) return;
        if (key === "s") save(); else if (key === "d") duplicate(); else history(key === "y" || event.shiftKey ? "redo" : "undo"); return;
      }
      if (key === " " && !(event.target as Element).closest("button")) { event.preventDefault(); setSpaceHand(true); return; }
      if (key === "delete" || key === "backspace") { event.preventDefault(); if (!gesture.current) remove(); return; }
      if (key.startsWith("arrow") && page && !gesture.current) {
        event.preventDefault(); const node = selectedNode;
        if (node && inheritedFlag(page, node, "locked")) return;
        const frame = node?.frame ?? page.frame, step = event.shiftKey ? 10 : 1;
        const next = { ...frame, x: frame.x + (key === "arrowleft" ? -step : key === "arrowright" ? step : 0), y: frame.y + (key === "arrowup" ? -step : key === "arrowdown" ? step : 0) };
        if (node) patchNode(node.id, { frame: next }); else if (!editingId) updatePage(page.id, (item) => ({ ...item, frame: next })); return;
      }
      if (command || event.altKey) return;
      if (key === "+") { event.preventDefault(); addPage(); return; }
      if (key === "v") setTool("select"); if (key === "h") setTool("hand");
      const next = TOOLS.find((item) => item.key.toLowerCase() === key); if (next && editingId) setTool(next.type);
    };
    const keyup = (event: KeyboardEvent) => { if (event.key === " ") setSpaceHand(false); };
    const blur = () => { setSpaceHand(false); gesture.current = null; setPreview(null); };
    window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); window.removeEventListener("blur", blur); };
  });
  const startGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.button !== 0 && event.button !== 1) || !canvasDocument) return;
    const target = event.target as Element;
    if (target.closest("button:not(.resize-handle), input, select, .floating-panel, .canvas-toolbar, .canvas-zoom")) return;
    if (isField(document.activeElement)) (document.activeElement as HTMLElement).blur();
    const latest = read();
    const latestPage = latest?.pages.find((item) => item.id === editingId);
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const world = { x: (event.clientX - bounds.left - camera.x) / camera.zoom, y: (event.clientY - bounds.top - camera.y) / camera.zoom };
    const hitPageId = target.closest<HTMLElement>("[data-page-id]")?.dataset.pageId;
    const hitNodeId = target.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
    const handle = target.closest<HTMLElement>("[data-handle]")?.dataset.handle as Handle | undefined;
    let kind: Gesture["kind"] = "pan", frame: Frame = { x: camera.x, y: camera.y, width: 0, height: 0 };
    let nodeId: string | undefined, pageId: string | undefined;
    if (event.button === 1 || tool === "hand" || spaceHand) { /* Pan over any object. */ }
    else if (editingId && latestPage) {
      if (tool !== "select") { if (hitPageId) placeNode(tool, world.x, world.y); return; }
      const node = latestPage.nodes.find((item) => item.id === (handle ? selectedNodeId : hitNodeId));
      if (node) { selectNode(node.id); if (inheritedFlag(latestPage, node, "locked")) return; kind = handle ? "resize" : "node"; frame = node.frame; nodeId = node.id; pageId = latestPage.id; }
      else { setSelectedNodeId(null); if (hitPageId) setInspectorOpen(true); }
    } else if (hitPageId) { const hit = latest?.pages.find((item) => item.id === hitPageId); if (!hit) return; setSelectedPageId(hit.id); setInspectorOpen(true); kind = "page"; frame = hit.frame; pageId = hit.id; }
    else setSelectedPageId(null);
    gesture.current = { kind, pageId, nodeId, handle, clientX: event.clientX, clientY: event.clientY, camera, origin: frame, next: frame, moved: false };
  };
  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current; if (!current) return;
    const screenX = event.clientX - current.clientX, screenY = event.clientY - current.clientY;
    if (!current.moved && Math.hypot(screenX, screenY) < 3) return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    const dx = screenX / current.camera.zoom, dy = screenY / current.camera.zoom;
    const next = current.kind === "resize" ? resizeFrame(current.origin, current.handle!, dx, dy) : { ...current.origin, x: current.origin.x + (current.kind === "pan" ? screenX : dx), y: current.origin.y + (current.kind === "pan" ? screenY : dy) };
    const updated = { ...current, next, moved: true }; gesture.current = updated; setPreview(updated);
  };
  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>, cancel = false) => {
    const current = gesture.current; gesture.current = null; setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current?.moved || cancel) return;
    if (current.kind === "pan") setCamera({ ...current.camera, x: current.next.x, y: current.next.y });
    else if (current.pageId) updatePage(current.pageId, (item) => current.kind === "page" ? { ...item, frame: current.next } : { ...item, nodes: item.nodes.map((node) => node.id === current.nodeId ? { ...node, frame: current.next } : node) });
  };
  const requestImport = () => { if (page && selectedNode?.type === "image") { importTarget.current = { pageId: page.id, nodeId: selectedNode.id }; fileInput.current?.click(); } };
  const importImage = async (file?: File) => {
    const target = importTarget.current; if (!file || !target) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) { setNotice("请选择 5 MB 以内的 PNG、JPEG、WebP 或 GIF 图片"); return; }
    try {
      const imageData = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      updatePage(target.pageId, (item) => ({ ...item, nodes: item.nodes.map((node) => node.id === target.nodeId && !inheritedFlag(item, node, "locked") ? { ...node, imageData } : node) }));
    } catch { setNotice("图片读取失败，请重试"); }
  };
  const visibleCamera = preview?.kind === "pan" ? { ...camera, x: preview.next.x, y: preview.next.y } : camera;
  let renderPage = page;
  if (renderPage && preview?.nodeId && preview.pageId === renderPage.id) renderPage = { ...renderPage, nodes: renderPage.nodes.map((node) => node.id === preview.nodeId ? { ...node, frame: preview.next } : node) };
  const renderedNode = renderPage?.nodes.find((node) => node.id === selectedNodeId);
  const selectedFrame = editingId && renderPage && renderedNode && !inheritedFlag(renderPage, renderedNode, "hidden") ? absoluteFrame(renderPage, renderedNode) : null;
  const unlocked = renderPage && renderedNode && !inheritedFlag(renderPage, renderedNode, "locked");
  const zoomAtCenter = (factor: number) => { const rect = viewport.current?.getBoundingClientRect(); if (!rect) return; setCamera((previous) => { const zoom = clampZoom(previous.zoom * factor), x = rect.width / 2, y = rect.height / 2; return { x: x - (x - previous.x) / previous.zoom * zoom, y: y - (y - previous.y) / previous.zoom * zoom, zoom }; }); };

  return <TooltipProvider delayDuration={300}><main className="app-shell">
    <header className="topbar"><span className="brand-mark"><Layers3 size={18} /></span><strong>GameFlow</strong><Separator orientation="vertical" className="topbar-separator" />
      {editingId && page ? <><Button size="sm" variant="ghost" onClick={back}><ArrowLeft size={14} />总览</Button><span className="breadcrumb">/</span></> : null}
      <span className="document-title">{editingId ? page?.name : canvasDocument?.title ?? "正在打开画布"}</span>
      <span className="sync-status" title={resourceName}>{pending ? "同步中…" : dirty ? "未保存" : <><Check size={12} />{isBrowserPreview ? "已存于浏览器" : "已保存"}</>}</span>
      <IconTool label="保存 (Ctrl+S)" disabled={pending || !canvasDocument} onClick={save}><Save size={15} /></IconTool>
    </header>
    <div ref={viewport} className={cn("canvas-viewport", (tool === "hand" || spaceHand) && "hand-tool", preview?.kind === "pan" && "is-panning", (preview?.kind === "node" || preview?.kind === "page") && "is-moving")} aria-label={editingId ? "页面编辑画布" : "页面总览画布"}
      onPointerDown={startGesture} onPointerMove={moveGesture} onPointerUp={(event) => finishGesture(event)} onPointerCancel={(event) => finishGesture(event, true)}
      onDoubleClick={(event) => {
        if (tool === "hand" || spaceHand || (event.target as Element).closest(".floating-panel")) return;
        const id = (event.target as Element).closest<HTMLElement>("[data-page-id]")?.dataset.pageId;
        if (!editingId && id) { const target = canvasDocument?.pages.find((item) => item.id === id); if (target) enter(target); }
        else if (selectedNode && ["text", "button", "input"].includes(selectedNode.type)) viewport.current?.querySelector<HTMLInputElement>('input[aria-label="文字内容"]')?.focus();
      }}>
      <div className="canvas-dots" style={{ backgroundSize: `${24 * visibleCamera.zoom}px ${24 * visibleCamera.zoom}px`, backgroundPosition: `${visibleCamera.x}px ${visibleCamera.y}px` }} />
      {!canvasDocument ? <div className="loading-state">{error ?? "正在载入画布…"}</div> : <>
        <div className="canvas-world" style={{ transform: `translate(${visibleCamera.x}px, ${visibleCamera.y}px) scale(${visibleCamera.zoom})` }}>
          {(editingId ? renderPage ? [renderPage] : [] : canvasDocument.pages).map((item) => {
            const frame = preview?.kind === "page" && preview.pageId === item.id ? preview.next : item.frame;
            return <article key={item.id} className={cn("page-group", !editingId && selectedPageId === item.id && "page-selected", editingId && "page-editing")} data-page-id={item.id} style={{ left: editingId ? 0 : frame.x, top: editingId ? 0 : frame.y, width: frame.width, height: frame.height }}>
              <div className="page-caption"><LayoutPanelTop size={14} /><span>{item.name}</span><small>{Math.round(frame.width)} × {Math.round(frame.height)}</small></div>
              <div className="page-surface" style={{ background: item.background ?? "#ffffff" }}>{orderedNodes(item).map((node) => <NodeView key={node.id} page={item} node={node} />)}</div>
            </article>;
          })}
        </div>
        {selectedFrame ? <div className="selection-box" style={{ left: visibleCamera.x + selectedFrame.x * visibleCamera.zoom, top: visibleCamera.y + selectedFrame.y * visibleCamera.zoom, width: selectedFrame.width * visibleCamera.zoom, height: selectedFrame.height * visibleCamera.zoom }}>
          <span className="selection-label">{renderedNode?.name}{!unlocked ? " · 已锁定" : ""}</span>
          {unlocked ? HANDLES.map((handle) => <button key={handle} className={`resize-handle handle-${handle}`} data-handle={handle} aria-label={`缩放控件 ${handle}`} />) : null}
          <span className="selection-size">{Math.round(selectedFrame.width)} × {Math.round(selectedFrame.height)}</span>
        </div> : null}
        {editingId && page ? <LayerTree key={page.id} page={page} selectedId={selectedNode?.id ?? null} onSelect={selectNode} onPatch={patchNode} onBack={back} onAdd={addLayer} onDelete={deleteLayer} onMove={moveLayer} /> : null}
        {page && inspectorOpen ? <Inspector page={page} node={selectedNode} onNode={patchNode} onPage={(transform) => updatePage(page.id, transform)} onDuplicate={duplicate} onDelete={remove} onClose={() => setInspectorOpen(false)} onEnter={() => enter(page)} onImport={requestImport} /> : null}
        <div className="canvas-context">{editingId ? "页面编辑" : `${canvasDocument.pages.length} 个页面`}<span>{tool === "select" ? editingId ? "拖动控件 · 双击文字修改内容" : "双击页面进入编辑" : tool === "hand" || spaceHand ? "拖动画布" : `点击页面放置${NODE_LABELS[tool]}`}</span></div>
        {canvasDocument.pages.length === 0 ? <div className="empty-canvas"><LayoutPanelTop size={32} /><strong>从第一个页面开始</strong><p>用底部 + 添加游戏界面</p><Button onClick={addPage}><Plus size={15} />添加页面</Button></div> : null}
        <div className="canvas-toolbar floating-panel" onPointerDown={(event) => event.stopPropagation()}>
          <IconTool label="选择 (V)" active={tool === "select"} onClick={() => setTool("select")}><MousePointer2 size={19} /></IconTool>
          <IconTool label="抓手 (H / 空格)" active={tool === "hand" || spaceHand} onClick={() => setTool("hand")}><Hand size={19} /></IconTool>
          <Separator orientation="vertical" /><Popover open={insertOpen} onOpenChange={setInsertOpen}><PopoverTrigger asChild><Button size="icon" variant="ghost" className="toolbar-button insert-trigger" aria-label="添加页面或控件"><Plus size={20} /><ChevronDown size={9} /></Button></PopoverTrigger><PopoverContent side="top" align="start" className="insert-menu">
            <div className="menu-heading">添加到画布</div><button onClick={addPage}><LayoutPanelTop size={16} /><span>页面</span><kbd>+</kbd></button><Separator /><div className="menu-heading">{editingId ? "选择工具后点击页面放置" : "双击进入页面后添加控件"}</div>
            {TOOLS.map(({ type, icon: Icon, key }) => <button key={type} disabled={!editingId} onClick={() => { setTool(type); setInsertOpen(false); }}><Icon size={16} /><span>{NODE_LABELS[type]}</span><kbd>{key}</kbd></button>)}
          </PopoverContent></Popover>
          <div className="direct-tools">{TOOLS.map(({ type, icon: Icon, key }) => <IconTool key={type} label={`${NODE_LABELS[type]} (${key})`} disabled={!editingId} active={tool === type} onClick={() => setTool(type)}><Icon size={19} /></IconTool>)}</div>
          <Separator orientation="vertical" /><IconTool label="撤销 (Ctrl+Z)" disabled={pending} onClick={() => history("undo")}><Undo2 size={17} /></IconTool><IconTool label="重做 (Ctrl+Shift+Z)" disabled={pending} onClick={() => history("redo")}><Redo2 size={17} /></IconTool>
          <Separator orientation="vertical" /><IconTool label={inspectorOpen ? "隐藏属性面板" : "显示属性面板"} disabled={!page} active={!!page && inspectorOpen} onClick={() => setInspectorOpen(!inspectorOpen)}><PanelRight size={18} /></IconTool>
        </div>
        <div className="canvas-zoom floating-panel" onPointerDown={(event) => event.stopPropagation()}><IconTool label="缩小" onClick={() => zoomAtCenter(1 / 1.2)}><Minus size={14} /></IconTool><span>{Math.round(camera.zoom * 100)}%</span><IconTool label="放大" onClick={() => zoomAtCenter(1.2)}><Plus size={14} /></IconTool><Separator orientation="vertical" /><IconTool label="适应画布" onClick={() => fit(editingId && page ? [page] : canvasDocument.pages, !!editingId)}><Focus size={16} /></IconTool></div>
      </>}
      {notice || (canvasDocument && error) ? <div className="editor-notice" role="status">{notice || error}</div> : null}
      <input ref={fileInput} className="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="导入控件图片" onChange={(event) => { void importImage(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
  </main></TooltipProvider>;
}
