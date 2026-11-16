import { sliderOwner } from "../shared/ui-parts";
import { ArrowLeft, Box, Check, ChevronDown, ChevronRight, Focus, GitMerge, Layers3, LayoutPanelTop, Minus, PanelRight, Plus, Redo2, Save, Scissors, SquareDashed, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Frame, GameFlowNode, GameFlowPage, PageRootType } from "../shared/model";
import { allocateElementId, reserveDocumentElementIds } from "../shared/element-id";
import { createControlParts, descendants, duplicatePage, inheritedFlag, insertNode, makeComponent, NODE_LABELS, removePage, type Handle, type InsertType, type LayerDrop } from "../shared/editor-ops";
import { convertNodeType, editNodeFrame, nodeDragFrame, nodeResizeFrame } from "../shared/ui-edit";
import { mapPoint, type Matrix } from "../shared/ui-transform";
import { pasteNode, type NodeClipboard } from "../shared/node-clipboard";
import { resolvePageLayout } from "../shared/ui-layout";
import { COMPONENTS, PAGE_ROOTS, PAGE_ROOT_TYPES } from "../shared/ui-components";
import { COMPONENT_TOOLS } from "./editor/component-tools";
import { Button } from "./components/ui/button";
import { CanvasDots } from "./components/canvas-dots";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Separator } from "./components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { Inspector } from "./editor/inspector";
import { LayerTree, NodeIcon } from "./editor/layer-tree";
import { NodeView, orderedNodes } from "./editor/node-view";
import { ContainerOutlines } from "./editor/container-outlines";
import { useDocument } from "./use-document";
import { isBrowserPreview } from "./vscode-api";
import { cn } from "./lib/utils";
import { PsdWorkspace, type WorkspaceMode } from "./psd/workspace";
import { PROTOTYPE_PANELS, useFollowingPanels } from "./editor/use-following-panels";
import { canvasPanelMetrics } from "./lib/canvas-panels";
import { canvasHitNode, canvasPasteTarget, canvasScopePath, placeCanvasComponent, reconcileCanvasScope } from "./lib/canvas-scope";
import { pickSelection, reconcileSelection, singleSelection, type NodeSelection, type SelectionIntent } from "./lib/node-selection";
import { commonSelectionParent, copySelection, duplicateSelection, moveSelection, removeSelection, translateSelection } from "../shared/selection-ops";
import { applyColorPreview, type ColorPreview } from "./lib/color-edit";

type Tool = "select" | "hand" | InsertType;
type Camera = { x: number; y: number; zoom: number };
type Gesture = { kind: "pan" | "page" | "node" | "resize"; clientX: number; clientY: number; camera: Camera; pageId?: string; nodeId?: string; nodeIds?: string[]; sourcePage?: GameFlowPage; collapseId?: string; handle?: Handle; origin: Frame; next: Frame; moved: boolean; transform?: { node: GameFlowNode; matrix: Matrix; parentMatrix: Matrix } };
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const TOOLS = COMPONENT_TOOLS;
const clampZoom = (value: number) => Math.max(0.1, Math.min(3, value));
const isField = (target: EventTarget | null) => target instanceof Element && !!target.closest("input, textarea, select, [contenteditable=true]");

function IconTool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick?: () => void; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><Button size="icon" variant={active ? "secondary" : "ghost"} className={cn("toolbar-button", active && "tool-active")} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</Button></TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>;
}

export function App() {
  const [mode, setMode] = useState<WorkspaceMode>("prototype");
  const { document: canvasDocument, resourceName, dirty, pending, error, edit, read, history, save } = useDocument();
  const viewport = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importTarget = useRef<{ pageId: string; nodeId: string } | null>(null);
  const initialized = useRef(false);
  const allocatedIds = useRef(new Set<string>());
  const gesture = useRef<Gesture | null>(null);
  const overviewCamera = useRef<Camera>({ x: 80, y: 80, zoom: 0.6 });
  const [camera, setCamera] = useState<Camera>(overviewCamera.current);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selection, setSelection] = useState<NodeSelection>(singleSelection(null));
  const setSelectedNodeId = (id: string | null) => setSelection(singleSelection(id));
  const [scopeIds, setScopeIds] = useState<string[]>([]);
  const [canvasSelection, setCanvasSelection] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [showContainerOutlines, setShowContainerOutlines] = useState(false);
  const [spaceHand, setSpaceHand] = useState(false);
  const [preview, setPreview] = useState<Gesture | null>(null);
  const [colorPreview, setColorPreview] = useState<ColorPreview | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [insertOpen, setInsertOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [clipboard, setClipboard] = useState<NodeClipboard | null>(null);
  const page = canvasDocument?.pages.find((item) => item.id === (editingId ?? selectedPageId)) ?? null;
  const currentSelection = page && editingId ? reconcileSelection(page, selection) : singleSelection(null);
  const selectedNodeIds = currentSelection.ids, selectedNodeId = currentSelection.primaryId;
  const selectedNode = editingId ? page?.nodes.find((item) => item.id === selectedNodeId) ?? null : null;
  const scopePath = page && editingId ? selectedNodeIds.length ? canvasScopePath(page, commonSelectionParent(page, selectedNodeIds)) : reconcileCanvasScope(page, scopeIds, null).path : [];
  const scopeId = scopePath.at(-1)?.id ?? null;
  const updatePage = (id: string, transform: (page: GameFlowPage) => GameFlowPage) => edit((document) => ({ ...document, pages: document.pages.map((item) => item.id === id ? transform(item) : item) }));
  const patchNode = (id: string, patch: Partial<GameFlowNode>) => { if (page) updatePage(page.id, (item) => ({ ...item, nodes: item.nodes.map((node) => node.id === id ? { ...node, ...patch } : node) })); };
  const newIds = () => {
    const current = read();
    if (current) reserveDocumentElementIds(current, allocatedIds.current);
    return () => allocateElementId(allocatedIds.current);
  };

  const fit = (pages: GameFlowPage[], internal: boolean) => {
    const bounds = viewport.current?.getBoundingClientRect();
    if (!bounds || !pages.length) { setCamera({ x: 80, y: 80, zoom: 0.6 }); return; }
    const panels = canvasPanelMetrics(bounds, PROTOTYPE_PANELS);
    const left = internal ? panels.margin + panels.leftWidth + panels.gap : 40;
    const right = internal ? panels.margin + panels.rightWidth + panels.gap : 40;
    const minX = internal ? 0 : Math.min(...pages.map((item) => item.frame.x));
    const minY = internal ? 0 : Math.min(...pages.map((item) => item.frame.y));
    const maxX = Math.max(...pages.map((item) => (internal ? 0 : item.frame.x) + item.frame.width));
    const maxY = Math.max(...pages.map((item) => (internal ? 0 : item.frame.y) + item.frame.height));
    const zoom = Math.max(0.1, Math.min(1, (bounds.width - left - right) / (maxX - minX), (bounds.height - 160) / (maxY - minY)));
    setCamera({ x: left + (bounds.width - left - right - (maxX - minX) * zoom) / 2 - minX * zoom, y: 56 + (bounds.height - 160 - (maxY - minY) * zoom) / 2 - minY * zoom, zoom });
  };
  const enter = (target: GameFlowPage) => {
    if (!editingId) overviewCamera.current = camera;
    setEditingId(target.id); setSelectedPageId(target.id); setSelectedNodeId(null); setScopeIds([]);
    setTool("select"); setInspectorOpen(true); fit([target], true);
  };
  const leavePage = (nextCamera: Camera) => { gesture.current = null; setPreview(null); setEditingId(null); setSelectedNodeId(null); setScopeIds([]); setTool("select"); setCamera(nextCamera); };
  const back = () => leavePage(overviewCamera.current);
  useEffect(() => {
    if (canvasDocument) reserveDocumentElementIds(canvasDocument, allocatedIds.current);
    if (canvasDocument && !initialized.current && viewport.current) { initialized.current = true; fit(canvasDocument.pages, false); }
    if (editingId && canvasDocument && !canvasDocument.pages.some((item) => item.id === editingId)) back();
  }, [canvasDocument, editingId]);
  useEffect(() => {
    if (!page || !editingId) return;
    const next = reconcileSelection(page, selection);
    const ids = (next.ids.length ? canvasScopePath(page, commonSelectionParent(page, next.ids)) : reconcileCanvasScope(page, scopeIds, null).path).map(node => node.id);
    if (ids.length !== scopeIds.length || ids.some((id, index) => id !== scopeIds[index])) setScopeIds(ids);
    if (JSON.stringify(next) !== JSON.stringify(selection)) setSelection(next);
  }, [page, editingId, scopeIds, selection]);
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
  const navigateScope = (id: string | null, selected: string | null = null) => {
    const currentPage = read()?.pages.find(item => item.id === editingId);
    if (!currentPage) return;
    gesture.current = null; setPreview(null);
    setScopeIds(canvasScopePath(currentPage, id).map(node => node.id));
    setSelectedNodeId(selected); setInspectorOpen(true); setTool("select");
    if (selected) setCanvasSelection(previous => previous + 1);
  };
  const applyNodeSelection = (next: NodeSelection, currentPage: GameFlowPage) => {
    if (next.ids.length) setScopeIds(canvasScopePath(currentPage, commonSelectionParent(currentPage, next.ids)).map(item => item.id));
    setSelection(next); setInspectorOpen(true); setTool("select");
  };
  const selectNodes = (ids: string[]) => {
    const currentPage = read()?.pages.find(item => item.id === editingId);
    if (currentPage) applyNodeSelection({ ids, primaryId: ids.at(-1) ?? null, anchorId: ids.at(-1) ?? null }, currentPage);
  };
  const selectNode = (id: string | null, intent: SelectionIntent = {}) => {
    const currentPage = read()?.pages.find(item => item.id === editingId);
    const node = currentPage?.nodes.find(item => item.id === id);
    if (id && !node) return;
    if (!id) { setScopeIds([]); setSelectedNodeId(null); setInspectorOpen(true); setTool("select"); }
    else if (currentPage) applyNodeSelection(pickSelection(currentSelection, id, intent), currentPage);
  };
  const addPage = (rootType: PageRootType = "UIStack") => {
    if (!canvasDocument) return;
    // Convert the current page-local view to overview coordinates without moving the page on screen.
    if (editingId) leavePage(page ? { ...camera, x: camera.x - page.frame.x * camera.zoom, y: camera.y - page.frame.y * camera.zoom } : camera);
    const makeId = newIds();
    const id = makeId();
    const x = canvasDocument.pages.length ? Math.round(Math.max(...canvasDocument.pages.map((item) => item.frame.x + item.frame.width)) + 80) : 0;
    const size = rootType === "UIBox" ? { width: 320, height: 240 } : { width: 750, height: 1334 };
    const next: GameFlowPage = { id, name: `${PAGE_ROOTS[rootType].label} ${canvasDocument.pages.length + 1}`, kind: "screen", rootType, frame: { x, y: 0, ...size }, nodes: [] };
    edit((document) => ({ ...document, pages: [...document.pages, next] }));
    setSelectedPageId(id); setSelectedNodeId(null); setInspectorOpen(true); setInsertOpen(false);
  };
  const chooseInsertTool = (type: InsertType) => {
    if (!editingId) return;
    setTool(type); setInsertOpen(false);
  };
  const placeNode = (type: InsertType, x: number, y: number) => {
    const currentPage = read()?.pages.find(item => item.id === editingId);
    if (!currentPage) return;
    const result = placeCanvasComponent(currentPage, scopeId, type, { x, y }, newIds());
    if (!result.id) return;
    updatePage(currentPage.id, () => result.page); selectNode(result.id);
    setCanvasSelection(previous => previous + 1);
  };
  const addLayer = (type: InsertType, parentId?: string, afterId?: string) => {
    if (!editingId) return;
    const makeId = newIds();
    const id = makeId();
    updatePage(editingId, (item) => {
      const parent = item.nodes.find((node) => node.id === parentId);
      const bounds = parent ? resolvePageLayout(item).nodes.get(parent.id)!.local : item.frame;
      const offset = item.nodes.filter((node) => node.parentId === parentId).length % 4 * 12;
      const nodes = makeComponent(type, id, bounds.width / 2 + offset, bounds.height / 2 + offset, makeId);
      const inserted = insertNode(item, nodes[0], parentId, afterId);
      return inserted === item ? item : { ...inserted, nodes: [...inserted.nodes, ...nodes.slice(1)] };
    });
    selectNode(id);
  };
  const deleteLayer = (id: string) => {
    if (!editingId) return;
    const currentPage = read()?.pages.find((item) => item.id === editingId);
    if (!currentPage) return;
    const next = removeSelection(currentPage, selectedNodeIds.includes(id) ? selectedNodeIds : [id]);
    if (next === currentPage) return;
    updatePage(editingId, () => next);
    setSelection(previous => reconcileSelection(next, previous));
  };
  const moveLayer = (id: string, target: LayerDrop) => { if (editingId) updatePage(editingId, item => moveSelection(item, selectedNodeIds.includes(id) ? selectedNodeIds : [id], target)); };
  const copyLayer = (id: string) => {
    const currentPage = read()?.pages.find((item) => item.id === editingId);
    if (currentPage) setClipboard(copySelection(currentPage, selectedNodeIds.includes(id) ? selectedNodeIds : [id]));
  };
  const pasteLayer = (parentId?: string, afterId?: string) => {
    const currentPage = read()?.pages.find((item) => item.id === editingId);
    if (!currentPage || !clipboard) return;
    const result = pasteNode(currentPage, clipboard, newIds(), parentId, afterId);
    if (result.id) { updatePage(currentPage.id, () => result.page); selectNodes(result.ids ?? [result.id]); }
  };
  const duplicateLayer = (id: string) => {
    const currentPage = read()?.pages.find((item) => item.id === editingId);
    const node = currentPage?.nodes.find((item) => item.id === id);
    if (!currentPage || !node || inheritedFlag(currentPage, node, "locked")) return;
    const result = duplicateSelection(currentPage, selectedNodeIds.includes(id) ? selectedNodeIds : [id], newIds());
    if (result.ids.length) { updatePage(currentPage.id, () => result.page); selectNodes(result.ids); }
  };
  const convertLayer = (id: string, type: InsertType) => { if (editingId) updatePage(editingId, (item) => convertNodeType(item, id, type)); };
  const duplicate = () => {
    if (!page || (selectedNode && inheritedFlag(page, selectedNode, "locked"))) return;
    if (editingId && !selectedNode) return;
    const makeId = newIds();
    if (selectedNode) duplicateLayer(selectedNode.id);
    else { const next = duplicatePage(page, makeId); edit((document) => ({ ...document, pages: [...document.pages, next] })); if (editingId) back(); setSelectedPageId(next.id); fit([...(canvasDocument?.pages ?? []), next], false); }
  };
  const remove = () => {
    if (!page || (selectedNode && inheritedFlag(page, selectedNode, "locked"))) return;
    if (editingId && !selectedNode) return;
    if (selectedNode) deleteLayer(selectedNode.id);
    else { edit((document) => removePage(document, page.id)); if (editingId) back(); setSelectedPageId(null); }
  };
  useEffect(() => {
    if (mode !== "prototype") return;
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as Element).closest("[role=menu], dialog[open]")) return;
      const command = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      if (isField(event.target)) {
        if (command && key === "s") { event.preventDefault(); (event.target as HTMLElement).blur(); save(); }
        return;
      }
      if (key === "escape") { if (gesture.current) { gesture.current = null; setPreview(null); } else { setTool("select"); setSelectedNodeId(null); setInsertOpen(false); } return; }
      if (command && ["z", "y", "s", "d", ...(editingId ? ["c", "v"] : [])].includes(key)) {
        event.preventDefault(); if (gesture.current) return;
        if (key === "s") save(); else if (key === "d") duplicate();
        else if (key === "c") { if (selectedNode) copyLayer(selectedNode.id); }
        else if (key === "v") { if (page) { const target = canvasPasteTarget(page, scopeId, selectedNodeIds.length > 1 ? null : selectedNodeId); pasteLayer(target.parentId, target.afterId); } }
        else history(key === "y" || event.shiftKey ? "redo" : "undo"); return;
      }
      if (key === " " && !(event.target as Element).closest("button")) { event.preventDefault(); setSpaceHand(true); return; }
      if (key === "delete" || key === "backspace") { event.preventDefault(); if (!gesture.current) remove(); return; }
      if (key.startsWith("arrow") && page && !gesture.current) {
        event.preventDefault(); const node = selectedNode;
        if (selectedNodeIds.length > 1) {
          const step = event.shiftKey ? 10 : 1;
          updatePage(page.id, item => translateSelection(item, selectedNodeIds, key === "arrowleft" ? -step : key === "arrowright" ? step : 0, key === "arrowup" ? -step : key === "arrowdown" ? step : 0, "nudge")); return;
        }
        if (node && inheritedFlag(page, node, "locked")) return;
        const frame = node ? resolvePageLayout(page).nodes.get(node.id)!.local : page.frame, step = event.shiftKey ? 10 : 1;
        const next = { ...frame, x: frame.x + (key === "arrowleft" ? -step : key === "arrowright" ? step : 0), y: frame.y + (key === "arrowup" ? -step : key === "arrowdown" ? step : 0) };
        if (node) updatePage(page.id, (item) => editNodeFrame(item, node.id, next, "nudge")); else if (!editingId) updatePage(page.id, (item) => ({ ...item, frame: { ...next, x: Math.round(next.x), y: Math.round(next.y) } })); return;
      }
      if (command || event.altKey) return;
      if (key === "+") { event.preventDefault(); addPage(); return; }
      if (key === "v") setTool("select"); if (key === "h") setTool("hand");
      const next = TOOLS.find((item) => item.key.toLowerCase() === key); if (next && !event.repeat) chooseInsertTool(next.type);
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
    event.currentTarget.focus({ preventScroll: true });
    const bounds = event.currentTarget.getBoundingClientRect();
    const world = { x: (event.clientX - bounds.left - camera.x) / camera.zoom, y: (event.clientY - bounds.top - camera.y) / camera.zoom };
    const hitPageId = target.closest<HTMLElement>("[data-page-id]")?.dataset.pageId;
    const hitNodeId = target.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
    const handle = target.closest<HTMLElement>("[data-handle]")?.dataset.handle as Handle | undefined;
    let kind: Gesture["kind"] = "pan", frame: Frame = { x: camera.x, y: camera.y, width: 0, height: 0 };
    let nodeId: string | undefined, pageId: string | undefined, nodeIds: string[] | undefined, sourcePage: GameFlowPage | undefined, collapseId: string | undefined;
    let transform: Gesture["transform"];
    if (event.button === 1 || tool === "hand" || spaceHand) { /* Pan over any object. */ }
    else if (editingId && latestPage) {
      if (tool !== "select") { if (hitPageId) placeNode(tool, world.x, world.y); return; }
      const node = handle || (selectedNodeIds.length > 1 && selectedNodeIds.includes(hitNodeId ?? "")) ? latestPage.nodes.find(item => item.id === (handle ? selectedNodeId : hitNodeId)) : canvasHitNode(latestPage, scopeId, hitNodeId);
      if (node) {
        if (!handle) setCanvasSelection(previous => previous + 1);
        if (event.ctrlKey || event.metaKey || event.shiftKey) { selectNode(node.id, { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey, order: orderedNodes(latestPage).filter(item => (item.parentId ?? null) === scopeId).map(item => item.id) }); return; }
        if (!handle && selectedNodeIds.length > 1 && selectedNodeIds.includes(node.id)) {
          kind = "node"; frame = { x: 0, y: 0, width: 0, height: 0 }; nodeIds = selectedNodeIds; sourcePage = latestPage; collapseId = node.id; pageId = latestPage.id;
        } else {
          selectNode(node.id);
          if (inheritedFlag(latestPage, node, "locked") || (!handle && sliderOwner(latestPage, node))) return;
          const g = resolvePageLayout(latestPage).nodes.get(node.id)!; if (!g.inverse) return;
          kind = handle ? "resize" : "node"; frame = g.local; transform = { node, matrix: g.matrix, parentMatrix: g.parentMatrix }; nodeId = node.id; pageId = latestPage.id;
        }
      }
      else { setSelectedNodeId(null); if (hitPageId) setInspectorOpen(true); }
    } else if (hitPageId) { const hit = latest?.pages.find((item) => item.id === hitPageId); if (!hit) return; setSelectedPageId(hit.id); setInspectorOpen(true); kind = "page"; frame = hit.frame; pageId = hit.id; }
    else setSelectedPageId(null);
    gesture.current = { kind, pageId, nodeId, nodeIds, sourcePage, collapseId, handle, transform, clientX: event.clientX, clientY: event.clientY, camera, origin: frame, next: frame, moved: false };
  };
  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current; if (!current) return;
    const screenX = event.clientX - current.clientX, screenY = event.clientY - current.clientY;
    if (!current.moved && Math.hypot(screenX, screenY) < 3) return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    const dx = screenX / current.camera.zoom, dy = screenY / current.camera.zoom;
    const next = current.kind === "resize" && current.transform ? nodeResizeFrame(current.transform.node, current.origin, current.transform.matrix, current.handle!, dx, dy) : current.kind === "node" && current.transform ? nodeDragFrame(current.origin, current.transform.parentMatrix, dx, dy) : { ...current.origin, x: current.origin.x + (current.kind === "pan" ? screenX : dx), y: current.origin.y + (current.kind === "pan" ? screenY : dy) };
    if (current.kind === "page") { next.x = Math.round(next.x); next.y = Math.round(next.y); }
    const updated = { ...current, next, moved: true }; gesture.current = updated; setPreview(updated);
  };
  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>, cancel = false) => {
    const current = gesture.current; gesture.current = null; setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current || cancel) return;
    if (!current.moved) { if (current.collapseId) selectNode(current.collapseId); return; }
    if (current.kind === "pan") setCamera({ ...current.camera, x: current.next.x, y: current.next.y });
    else if (current.pageId) updatePage(current.pageId, (item) => current.kind === "page" ? { ...item, frame: current.next } : current.nodeIds ? translateSelection(item, current.nodeIds, current.next.x, current.next.y) : editNodeFrame(item, current.nodeId!, current.next, current.kind === "resize" ? "resize" : "move"));
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
  const panelPageFrame = preview?.kind === "page" && preview.pageId === page?.id ? preview.next : page?.frame;
  const panels = useFollowingPanels(viewport, mode === "prototype", panelPageFrame ? {
    x: visibleCamera.x + (editingId ? 0 : panelPageFrame.x * visibleCamera.zoom),
    y: visibleCamera.y + (editingId ? 0 : panelPageFrame.y * visibleCamera.zoom),
    width: panelPageFrame.width * visibleCamera.zoom
  } : null, !!editingId, inspectorOpen, editingId ? 48 : 0);
  let renderPage = page;
  if (preview?.nodeIds && preview.sourcePage) renderPage = translateSelection(preview.sourcePage, preview.nodeIds, preview.next.x, preview.next.y);
  if (renderPage && preview?.nodeId && preview.pageId === renderPage.id) renderPage = editNodeFrame(renderPage, preview.nodeId, preview.next, preview.kind === "resize" ? "resize" : "move");
  if (renderPage) renderPage = applyColorPreview(renderPage, colorPreview);
  const renderedNode = renderPage?.nodes.find((node) => node.id === selectedNodeId);
  const selectionLayout = renderPage ? resolvePageLayout(renderPage) : null;
  const selectedGeometry = selectedNodeIds.length === 1 && editingId && renderPage && renderedNode && !inheritedFlag(renderPage, renderedNode, "hidden") ? selectionLayout!.nodes.get(renderedNode.id)! : null;
  const selectionX = selectedGeometry ? Math.hypot(selectedGeometry.matrix[0], selectedGeometry.matrix[1]) : 1;
  const selectionY = selectedGeometry ? Math.hypot(selectedGeometry.matrix[2], selectedGeometry.matrix[3]) : 1;
  const selectionWidth = (selectedGeometry?.local.width ?? 0)*selectionX*visibleCamera.zoom;
  const selectionHeight = (selectedGeometry?.local.height ?? 0)*selectionY*visibleCamera.zoom;
  const selectionAnchor = selectedGeometry ? mapPoint(selectedGeometry.matrix, { x: (renderedNode?.transform?.anchorX ?? 0)*selectedGeometry.local.width, y: (renderedNode?.transform?.anchorY ?? 0)*selectedGeometry.local.height }) : null;
  const unlocked = renderPage && renderedNode && !inheritedFlag(renderPage, renderedNode, "locked");
  const zoomAtCenter = (factor: number) => { const rect = viewport.current?.getBoundingClientRect(); if (!rect) return; setCamera((previous) => { const zoom = clampZoom(previous.zoom * factor), x = rect.width / 2, y = rect.height / 2; return { x: x - (x - previous.x) / previous.zoom * zoom, y: y - (y - previous.y) / previous.zoom * zoom, zoom }; }); };
  const switchMode = (next: WorkspaceMode) => { gesture.current = null; setPreview(null); setSpaceHand(false); setInsertOpen(false); setMode(next); };

  return <TooltipProvider delayDuration={300}><main className="app-shell">
    <header className="topbar"><span className="brand-mark"><Layers3 size={18} /></span><strong>GameFlow</strong><Separator orientation="vertical" className="topbar-separator" />
      {mode === "prototype" ? <div className="topbar-actions" role="group" aria-label="文档操作">
        <IconTool label="撤销 (Ctrl+Z)" disabled={pending || !canvasDocument} onClick={() => history("undo")}><Undo2 size={15} /></IconTool>
        <IconTool label="重做 (Ctrl+Shift+Z)" disabled={pending || !canvasDocument} onClick={() => history("redo")}><Redo2 size={15} /></IconTool>
        <IconTool label="保存 (Ctrl+S)" disabled={pending || !canvasDocument} onClick={save}><Save size={15} /></IconTool>
      </div> : null}
      {mode === "prototype" ? <Separator orientation="vertical" className="topbar-separator" /> : null}
      {mode === "prototype" && editingId && page ? <><Button size="sm" variant="ghost" onClick={back}><ArrowLeft size={14} />总览</Button><span className="breadcrumb">/</span></> : null}
      <span className="document-title">{mode === "prototype" ? editingId ? page?.name : canvasDocument?.title ?? "正在打开画布" : "美术工作区"}</span>
      <nav className="mode-switcher" aria-label="工作模式">{([{ id: "prototype", label: "原型", icon: LayoutPanelTop }, { id: "merge", label: "PSD 合并", icon: GitMerge }, { id: "slice", label: "PSD 切图", icon: Scissors }] as const).map(({ icon: Icon, ...item }) => <Tooltip key={item.id}><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label={item.label} aria-pressed={mode === item.id} className={mode === item.id ? "mode-active" : ""} onClick={() => switchMode(item.id)}><Icon size={16} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent side="bottom">{item.label}</TooltipContent></Tooltip>)}</nav>
      {mode === "prototype" ? pending || dirty || !isBrowserPreview ? <span className="sync-status" title={resourceName}>{pending ? "同步中…" : dirty ? "未保存" : <><Check size={12} />已保存</>}</span> : null : <span className="sync-status">PSD 与原型独立保存</span>}
    </header>
    <div ref={viewport} tabIndex={-1} hidden={mode !== "prototype"} className={cn("canvas-viewport", (tool === "hand" || spaceHand) && "hand-tool", preview?.kind === "pan" && "is-panning", (preview?.kind === "node" || preview?.kind === "page") && "is-moving")} aria-label={editingId ? "页面编辑画布" : "页面总览画布"}
      onPointerDown={startGesture} onPointerMove={moveGesture} onPointerUp={(event) => finishGesture(event)} onPointerCancel={(event) => finishGesture(event, true)}
      onDoubleClick={(event) => {
        const element = event.target as Element;
        if (tool !== "select" || spaceHand || event.ctrlKey || event.metaKey || event.shiftKey || element.closest("button, input, select, .floating-panel")) return;
        const id = element.closest<HTMLElement>("[data-page-id]")?.dataset.pageId;
        if (!editingId && id) { const target = canvasDocument?.pages.find((item) => item.id === id); if (target) enter(target); }
        else if (editingId && page) {
          const node = canvasHitNode(page, scopeId, element.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId);
          if (node && COMPONENTS[node.type].children) navigateScope(node.id);
          else if (node && ["text", "input"].includes(node.type)) viewport.current?.querySelector<HTMLInputElement>('input[aria-label="文字内容"]')?.focus();
          else if (!node && scopeId) { const current = scopePath.at(-1)!; navigateScope(current.parentId ?? null, current.id); }
        }
      }}>
      <CanvasDots camera={visibleCamera} />
      {scopeId ? <div className="canvas-scope-dimmer" aria-hidden="true" /> : null}
      {!canvasDocument ? <div className="loading-state">{error ?? "正在载入画布…"}</div> : <>
        <div className="canvas-world" style={{ transform: `translate(${visibleCamera.x}px, ${visibleCamera.y}px) scale(${visibleCamera.zoom})` }}>
          {(editingId ? renderPage ? [renderPage] : [] : canvasDocument.pages.map(item => applyColorPreview(item, colorPreview))).map((item) => {
            const frame = preview?.kind === "page" && preview.pageId === item.id ? preview.next : item.frame;
            const geometry = resolvePageLayout(item);
            const nodes = orderedNodes(item), activeNodes = editingId && scopeId ? descendants(item, scopeId) : null;
            const backgroundNodes = nodes.filter(node => !activeNodes?.has(node.id));
            const foregroundNodes = activeNodes ? nodes.filter(node => activeNodes.has(node.id)) : [];
            return <article key={item.id} className={cn("page-group", !editingId && selectedPageId === item.id && "page-selected", editingId && "page-editing")} data-page-id={item.id} style={{ left: editingId ? 0 : frame.x, top: editingId ? 0 : frame.y, width: frame.width, height: frame.height }}>
              <div className="page-caption"><LayoutPanelTop size={14} /><span>{item.name}</span><small>{Math.round(frame.width)} × {Math.round(frame.height)}</small></div>
              <div className="page-surface" style={{ background: item.background ?? "#ffffff" }}>
                {backgroundNodes.map(node => <NodeView key={node.id} page={item} node={node} geometry={geometry.nodes.get(node.id)} />)}
                {showContainerOutlines ? <ContainerOutlines page={item} nodes={backgroundNodes} geometry={geometry} /> : null}
                {activeNodes ? <div className="canvas-scope-dimmer" aria-hidden="true" /> : null}
                {foregroundNodes.map(node => <NodeView key={node.id} page={item} node={node} geometry={geometry.nodes.get(node.id)} />)}
                {showContainerOutlines && activeNodes ? <ContainerOutlines page={item} nodes={foregroundNodes} geometry={geometry} /> : null}
              </div>
            </article>;
          })}
        </div>
        {editingId && page ? <nav className="canvas-scope-nav floating-panel" aria-label="编辑层级导航" onPointerDown={event => event.stopPropagation()}>
          <button type="button" title={`返回页面层：${page.name}`} aria-current={!scopeId ? "location" : undefined} onClick={() => navigateScope(null)}><LayoutPanelTop size={14} /><span>{page.name}</span></button>
          {scopePath.map((node, index) => <span className="canvas-scope-step" key={node.id}><ChevronRight size={12} aria-hidden="true" /><button type="button" title={`编辑 ${node.name} 的子节点 · ${COMPONENTS[node.type].laya}`} aria-current={index === scopePath.length - 1 ? "location" : undefined} onClick={() => navigateScope(node.id)}><NodeIcon type={node.type} /><span>{node.name}</span></button></span>)}
        </nav> : null}
        {selectedNodeIds.length > 1 && renderPage ? selectedNodeIds.map(id => {
          const node = renderPage!.nodes.find(item => item.id === id)!, g = selectionLayout!.nodes.get(id)!;
          if (!g.inverse || inheritedFlag(renderPage!, node, "hidden")) return null;
          return <div key={id} className="selection-box multi-selection-box" data-selected-node-id={id} style={{ left: 0, top: 0, width: g.local.width, height: g.local.height, transformOrigin: "0 0", transform: `matrix(${g.matrix.slice(0,4).map(v => v * visibleCamera.zoom).join(",")},${visibleCamera.x+g.matrix[4]*visibleCamera.zoom},${visibleCamera.y+g.matrix[5]*visibleCamera.zoom})` }} />;
        }) : null}
        {selectedGeometry?.inverse ? <div className="selection-box" style={{ left: 0, top: 0, width: selectionWidth, height: selectionHeight, transformOrigin: "0 0", transform: `matrix(${selectedGeometry.matrix[0]/selectionX},${selectedGeometry.matrix[1]/selectionX},${selectedGeometry.matrix[2]/selectionY},${selectedGeometry.matrix[3]/selectionY},${visibleCamera.x+selectedGeometry.matrix[4]*visibleCamera.zoom},${visibleCamera.y+selectedGeometry.matrix[5]*visibleCamera.zoom})` }}>
          <span className="selection-label">{renderedNode?.name}{!unlocked ? " · 已锁定" : ""}</span>
          {unlocked ? HANDLES.map((handle) => <button key={handle} className={`resize-handle handle-${handle}`} data-handle={handle} aria-label={`缩放控件 ${handle}`} />) : null}
          <span className="selection-size">{Math.round(selectedGeometry.local.width)} × {Math.round(selectedGeometry.local.height)}</span>
        </div> : null}
        {selectedGeometry?.inverse && selectionAnchor ? <span className="selection-anchor" aria-hidden="true" style={{ left: visibleCamera.x+selectionAnchor.x*visibleCamera.zoom, top: visibleCamera.y+selectionAnchor.y*visibleCamera.zoom }} /> : null}
        {editingId && page ? <LayerTree key={page.id} panelRef={panels.leftRef} panelStyle={panels.leftStyle} page={page} scopeId={scopeId} selectedIds={selectedNodeIds} selectedId={selectedNode?.id ?? null} reveal={canvasSelection} onSelect={selectNode} onPatch={patchNode} onBack={back} onAdd={addLayer} onDelete={deleteLayer} onMove={moveLayer}
          hasClipboard={!!clipboard} onCopy={copyLayer} onPaste={pasteLayer} onDuplicate={duplicateLayer} onConvert={convertLayer} /> : null}
        {page && inspectorOpen ? <Inspector onColorPreview={setColorPreview} selectedNodes={page.nodes.filter(node => selectedNodeIds.includes(node.id))} onCreateParts={() => { if (editingId && selectedNodeId) { const makeId = newIds(); updatePage(editingId, item => createControlParts(item, selectedNodeId, makeId)); } }} panelRef={panels.rightRef} panelStyle={panels.rightStyle} page={page} node={selectedNode} editingPage={!!editingId} onNode={patchNode} onPage={(transform) => updatePage(page.id, transform)} onClose={() => setInspectorOpen(false)} onEnter={() => enter(page)} onImport={requestImport} /> : null}
        <div className="canvas-context">{editingId ? scopePath.at(-1) ? `编辑 ${scopePath.at(-1)!.name} 的子节点` : "页面编辑" : `${canvasDocument.pages.length} 个页面`}<span>{tool === "select" ? editingId ? "双击容器进入 · 双击空白退一级" : "双击页面进入编辑" : tool === "hand" || spaceHand ? "拖动画布" : `点击页面放置${NODE_LABELS[tool]}`}</span></div>
        {canvasDocument.pages.length === 0 ? <div className="empty-canvas"><LayoutPanelTop size={32} /><strong>从第一个页面开始</strong><p>用底部 + 添加游戏界面</p><Button onClick={() => addPage()}><Plus size={15} />添加页面</Button></div> : null}
        <div className="canvas-toolbar floating-panel" onPointerDown={(event) => event.stopPropagation()}>
          <IconTool label="虚线框" active={showContainerOutlines} onClick={() => setShowContainerOutlines(value => !value)}><SquareDashed size={19} /></IconTool>
          <Separator orientation="vertical" /><Popover open={insertOpen} onOpenChange={setInsertOpen}><PopoverTrigger asChild><Button size="icon" variant="ghost" className="toolbar-button insert-trigger" aria-label="添加页面或控件"><Plus size={20} /><ChevronDown size={9} /></Button></PopoverTrigger><PopoverContent side="top" align="start" collisionPadding={12} className="insert-menu" aria-label="添加页面或控件菜单">
            <div className="menu-heading">添加到画布</div>
            <div className="insert-grid" role="group" aria-label="添加到画布">{PAGE_ROOT_TYPES.map((type) => { const Icon = type === "UIBox" ? Box : LayoutPanelTop; return <button key={type} onClick={() => addPage(type)}><Icon size={16} /><span>{PAGE_ROOTS[type].label} <small className="menu-class">({type})</small></span></button>; })}</div>
            <Separator /><div className="menu-heading">{editingId ? "选择工具后点击页面放置" : "双击进入页面后添加控件"}</div>
            <div className="insert-grid" role="group" aria-label="添加控件">{TOOLS.map(({ type, icon: Icon }) => <button key={type} disabled={!editingId} onClick={() => chooseInsertTool(type)}><Icon size={16} /><span>{NODE_LABELS[type]} <small className="menu-class">({COMPONENTS[type].laya})</small></span></button>)}</div>
          </PopoverContent></Popover>
          <div className="direct-tools">{TOOLS.filter((item) => item.key).map(({ type, icon: Icon, key }) => <IconTool key={type} label={`${NODE_LABELS[type]} (${key})`} disabled={!editingId} active={tool === type} onClick={() => chooseInsertTool(type)}><Icon size={19} /></IconTool>)}</div>
          <Separator orientation="vertical" /><IconTool label={inspectorOpen ? "隐藏属性面板" : "显示属性面板"} disabled={!page} active={!!page && inspectorOpen} onClick={() => setInspectorOpen(!inspectorOpen)}><PanelRight size={18} /></IconTool>
        </div>
        <div className="canvas-zoom floating-panel" onPointerDown={(event) => event.stopPropagation()}><IconTool label="缩小" onClick={() => zoomAtCenter(1 / 1.2)}><Minus size={14} /></IconTool><span>{Math.round(camera.zoom * 100)}%</span><IconTool label="放大" onClick={() => zoomAtCenter(1.2)}><Plus size={14} /></IconTool><Separator orientation="vertical" /><IconTool label="适应画布" onClick={() => fit(editingId && page ? [page] : canvasDocument.pages, !!editingId)}><Focus size={16} /></IconTool></div>
      </>}
      {notice || (canvasDocument && error) ? <div className="editor-notice" role="status">{notice || error}</div> : null}
      <input ref={fileInput} className="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="导入控件图片" onChange={(event) => { void importImage(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
    <PsdWorkspace mode="merge" active={mode === "merge"} />
    <PsdWorkspace mode="slice" active={mode === "slice"} />
  </main></TooltipProvider>;
}
