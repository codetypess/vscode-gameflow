import { DialogHeading } from "./components/dialog-heading";
import { GAMEFLOW_SCHEMA_VERSION, validateGameFlowDocument, type GameFlowDocument } from "../shared/model";
import type { OverrideActions } from "./editor/override-properties";
import { canvasPropertyLabel } from "./editor/override-properties";
import type { CanvasOverrideGroup, CanvasOverrideManager } from "./editor/override-panel";
import { sliderOwner } from "../shared/ui-parts";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, Box, Check, ChevronDown, ChevronRight, Focus, FileImage, FileInput, GitMerge, Layers3, LayoutDashboard, LayoutPanelTop, Link2, Minus, MousePointerClick, Plus, Redo2, Save, Scissors, SquareDashed, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Frame, GameFlowNode, GameFlowPage, PageRootType } from "../shared/model";
import { allocateElementId, reserveDocumentElementIds } from "../shared/element-id";
import { createControlParts, descendants, duplicatePage, inheritedFlag, insertNode, NODE_LABELS, removeNode, removePage, type Handle, type InsertType, type LayerDrop } from "../shared/editor-ops";
import { convertNodeType, editNodeFrame, nodeDragFrame, nodeResizeFrame } from "../shared/ui-edit";
import { mapPoint, type Matrix } from "../shared/ui-transform";
import { pasteNode, type NodeClipboard } from "../shared/node-clipboard";
import { resolvePageLayout } from "../shared/ui-layout";
import { canHaveChildren, COMPONENTS, PAGE_ROOTS, PAGE_ROOT_TYPES } from "../shared/ui-components";
import { findCanvasTarget, makeCanvasInstance, type CanvasSources } from "../shared/canvas-references";
import type { HostToWebviewMessage } from "../shared/protocol";
import { COMPONENT_TOOLS } from "./editor/component-tools";
import { Button } from "./components/ui/button";
import { CanvasDots } from "./components/canvas-dots";
import { PrototypeIcon } from "./components/prototype-icon";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Separator } from "./components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { ListCells } from "./editor/list-cell-context";
import { psdComponentInstances } from "../shared/page-sync";
import { cellKey, listScrollType, resolveCellPage, type CellReference } from "../shared/list-cell";
import { CanvasExportActions } from "./editor/canvas-export-actions";
import { Inspector } from "./editor/inspector";
import { CanvasReferencePicker } from "./editor/canvas-reference-picker";
import { LayerTree, NodeIcon } from "./editor/layer-tree";
import { LayerMenu, type LayerMenuTarget } from "./editor/layer-menu";
import { CanvasOverviewMenu, CanvasViewItems } from "./editor/canvas-menu";
import { RenameDialog } from "./editor/rename-dialog";
import { NodeView, orderedNodes } from "./editor/node-view";
import { ContainerOutlines } from "./editor/container-outlines";
import { useDocument } from "./use-document";
import { useToolbarChoice } from "./lib/use-toolbar-choice";
import { isBrowserPreview, postHostMessage } from "./vscode-api";
import { cn } from "./lib/utils";
import { PsdWorkspace, type OpenBoundSlice, type WorkspaceMode } from "./psd/workspace";
import { usePsdEditor } from "./psd/use-psd-editor";
import { importPsdPrototype } from "./psd/io";
import { useWorkbenchSettings, WorkbenchSettingsButton, WorkbenchSettingsPanel } from "./workbench-settings";
import { PROTOTYPE_PANELS, useFollowingPanels } from "./editor/use-following-panels";
import { canvasPanelMetrics } from "./lib/canvas-panels";
import { canvasContextTarget, canvasHitNode, canvasPasteTarget, canvasScopePath, insertCanvasComponent, placeCanvasComponent, reconcileCanvasScope } from "./lib/canvas-scope";
import { pickSelection, reconcileSelection, singleSelection, type NodeSelection, type SelectionIntent } from "./lib/node-selection";
import { commonSelectionParent, copySelection, duplicateSelection, moveSelection, removeSelection, translateSelection } from "../shared/selection-ops";
import { applyColorPreview, type ColorPreview } from "./lib/color-edit";
import { unbindCanvasInstance, composeCanvasPage, editCanvasPage, canvasStructureIssue, findOwnedCanvasNode, revertCanvasProperties, revertCanvasSelections, planCanvasApply, changeCanvasAddition, canvasFingerprint, type CanvasApplyRequest, type CanvasOrphan, copyCanvasSelection, copyCanvasOrphan, extractCanvasSelection } from "../shared/canvas-instances";
import { readProperty, sameTarget, type CanvasTarget, type CanvasPropertySelection } from "../shared/canvas-instance-data";
import type { PsdAsset } from "../shared/psd-meta";
import { sliceGenerationStamp } from "./psd/slice-render";
import { useRuntimeResources } from "./runtime/resources";
import { SliceResourcesProvider } from "./runtime/resource-context";
import { bindPrototypePsd } from "../shared/psd-prototype";
import { pagePsdKey } from "../shared/page-psd";
import { requestPsd, sourceBytes, usePagePsds } from "./runtime/page-psd";
import { PageSyncDialog, type SyncSession } from "./editor/page-sync-dialog";
import { componentPsdTargets } from "./runtime/component-psd";
import { PageArtState, pagePreviewBlocked } from "./editor/page-art-state";

type Tool = "select" | "hand";
type Camera = { x: number; y: number; zoom: number };
type CanvasMenuState = { kind: "nodes" | "overview"; pageId: string | null; target: LayerMenuTarget; backgroundParentId?: string; point: { x: number; y: number } };
type Gesture = { kind: "pan" | "page" | "node" | "resize"; clientX: number; clientY: number; camera: Camera; pageId?: string; nodeId?: string; nodeIds?: string[]; sourcePage?: GameFlowPage; collapseId?: string; handle?: Handle; origin: Frame; next: Frame; moved: boolean; transform?: { node: GameFlowNode; matrix: Matrix; parentMatrix: Matrix } };
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const TOOLS = COMPONENT_TOOLS;
const WORKSPACE_MODES = [
  { id: "prototype", label: "原型", icon: LayoutPanelTop },
  { id: "merge", label: "PSD 合并", icon: GitMerge },
  { id: "slice", label: "PSD 切图", icon: Scissors },
] as const;
const clampZoom = (value: number) => Math.max(0.1, Math.min(3, value));
const isField = (target: EventTarget | null) => target instanceof Element && !!target.closest("input, textarea, select, [contenteditable=true]");

function IconTool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick?: () => void; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><Button size="icon" variant={active ? "secondary" : "ghost"} className={cn("toolbar-button", active && "tool-active")} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</Button></TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>;
}

export function App() {
  const [mode, setMode] = useState<WorkspaceMode>("prototype");
  const [resourceMode, setResourceMode] = useToolbarChoice("resourceMode", ["prototype", "art", "prefab"]);
  const psdEditor = usePsdEditor(() => switchMode("slice"));
  const openBrowserSlice = useRef<OpenBoundSlice>(null);
  const [openingSlice, setOpeningSlice] = useState(false);
  const settings = useWorkbenchSettings();
  const [documentActions, setDocumentActions] = useState<HTMLDivElement | null>(null);
  const { document: canvasDocument, resourceName, dirty, pending, error, edit, read, history, save, applyCanvas } = useDocument();
  const viewport = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const psdImportInput = useRef<HTMLInputElement>(null);
  const [importingPsd, setImportingPsd] = useState(false);
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
  const [directSelection, setDirectSelection] = useToolbarChoice("directSelection", [false, true]);
  const [showContainerOutlines, setShowContainerOutlines] = useToolbarChoice("containerOutlines", [false, true]);
  const [spaceHand, setSpaceHand] = useState(false);
  const [preview, setPreview] = useState<Gesture | null>(null);
  const [colorPreview, setColorPreview] = useState<ColorPreview | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [insertOpen, setInsertOpen] = useState(false);
  const [canvasMenu, setCanvasMenu] = useState<CanvasMenuState | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ pageId: string; nodeId?: string; name: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [applyReview, setApplyReview] = useState<{request:CanvasApplyRequest; expected:Record<string,string>;source:string;fields:{target:string;field:string;value:unknown}[]}|null>(null);
  const [sources, setSources] = useState<CanvasSources>({});
  const [cellPicker, setCellPicker] = useState<{pageId:string; nodeId:string} | null>(null);
  const [pickerSource, setPickerSource] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<NodeClipboard | null>(null);
  const [syncSession,setSyncSession]=useState<SyncSession|null>(null);
  const [psdAssets, setPsdAssets] = useState<PsdAsset[]>([]);
  const observePsd = useCallback((asset: PsdAsset) => setPsdAssets(previous => {
    const index = previous.findIndex(a => a.documentId === asset.documentId);
    if (index >= 0 && sliceGenerationStamp(previous[index]) === sliceGenerationStamp(asset)) return previous;
    return [...previous.filter(a => a.documentId !== asset.documentId), asset];
  }), []);
  const compositions = useMemo(() => new Map(canvasDocument?.pages.map(p => [p.id, composeCanvasPage(canvasDocument, p, sources)])), [canvasDocument, sources]);
  const updatePage = (id: string, transform: (page: GameFlowPage) => GameFlowPage) => edit(document => { try { return editCanvasPage(document, id, sources, transform); } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); return document; } });
  const loadedPsds = usePagePsds(canvasDocument, read, edit, observePsd, setNotice, (document, page) => composeCanvasPage(document, page, sources), sources);
  const listCells = useMemo(() => {
    const pages = new Map<string,GameFlowPage>();
    return {
      resolve(ref: CellReference) {
        if (!canvasDocument || "uuid" in ref) throw new Error("未定位到列表项模板" + ("uuid" in ref ? " " + ref.uuid : ""));
        const key = cellKey(ref);
        if (!pages.has(key)) {
          const target = resolveCellPage(canvasDocument, sources, ref);
          const asset = !ref.source && loadedPsds.assets[ref.pageId];
          pages.set(key, asset ? bindPrototypePsd(target.page,target.document.documentId,asset) : target.page);
        }
        return pages.get(key)!;
      },
      choose(nodeId:string, binding?: CellReference) {
        if (editingId) {
          setCellPicker({pageId:editingId,nodeId});
          setPickerSource(binding && "source" in binding && sources[binding.source] ? binding.source : "");
        }
      }
    };
  }, [canvasDocument, sources, editingId, loadedPsds.assets]);
  const { resourcePages, mappingErrors } = useMemo(() => {
    const mappingErrors: typeof loadedPsds.states = {};
    const resourcePages = Array.from(compositions.values(), ({ page }) => {
      const asset = loadedPsds.assets[page.id];
      if (!asset || !canvasDocument) return page;
      try { return bindPrototypePsd(page, canvasDocument.documentId, asset); }
      catch (error) {
        mappingErrors[page.id] = { key: pagePsdKey(page.artPsd), status: "error", error: String(error) };
        return page;
      }
    });
    return { resourcePages, mappingErrors };
  }, [compositions, loadedPsds.assets, canvasDocument]);
  const pagePsds = { ...loadedPsds, states: { ...loadedPsds.states, ...mappingErrors } };
  const canonicalPage = canvasDocument?.pages.find((item) => item.id === (editingId ?? selectedPageId)) ?? null;
  const composition = canonicalPage ? compositions.get(canonicalPage.id) : undefined;
  const page = resourcePages.find(item => item.id === canonicalPage?.id) ?? null;
  const readPage = (id: string | null) => { const current = read(), target = current?.pages.find(item => item.id === id); return current && target ? composeCanvasPage(current, target, sources).page : undefined; };
  const currentSelection = page && editingId ? reconcileSelection(page, selection) : singleSelection(null);
  const selectedNodeIds = currentSelection.ids, selectedNodeId = currentSelection.primaryId;
  const selectedNode = editingId ? page?.nodes.find((item) => item.id === selectedNodeId) ?? null : null;
  const selectedMeta = selectedNode ? composition?.info.get(selectedNode.id) : undefined;
  const scopePath = page && editingId ? selectedNodeIds.length ? canvasScopePath(page, commonSelectionParent(page, selectedNodeIds)) : reconcileCanvasScope(page, scopeIds, null).path : [];
  const scopeId = scopePath.at(-1)?.id ?? null;
  const resourceInputs = useMemo(() => {
    const pages = [...resourcePages], seen = new Set<string>();
    for (const item of pages) for (const node of item.nodes) {
      const ref = node.cellPrefab;
      if (!ref || "uuid" in ref || !ref.source || seen.has(cellKey(ref))) continue;
      seen.add(cellKey(ref));
      try { pages.push(listCells.resolve(ref)); } catch { /* The list displays the source error. */ }
    }
    return pages;
  }, [resourcePages,listCells]);
  const runtimeResources = useRuntimeResources(psdAssets, resourceInputs, settings.settings.resourceDirectory, resourceMode, pagePsds.assets);
  const pageLayout = (page: GameFlowPage) => resolvePageLayout(page, (runtimeResources.forPage?.(page) ?? runtimeResources).sizes);
  const selectedResources = page ? runtimeResources.forPage?.(page) ?? runtimeResources : runtimeResources;
  const patchNode = (id: string, patch: Partial<GameFlowNode>) => { if (page) updatePage(page.id, (item) => ({ ...item, nodes: item.nodes.map((node) => node.id === id ? { ...node, ...patch } : node) })); };
  const newIds = (current = read()) => {
    if (current) reserveDocumentElementIds(current, allocatedIds.current);
    return () => allocateElementId(allocatedIds.current);
  };
  const changeOverrides = (fields?: string[], apply = false, all = false) => {
    const meta = selectedMeta, current = read();
    if (!meta?.ownerId || !current || !page || pending) return;
    try {
      if (!apply) { edit(document => revertCanvasProperties(document, meta.ownerId!, all ? undefined : meta.target, fields)); return; }
      const request = { pageId: page.id, ownerId: meta.ownerId, target: all ? undefined : meta.target, fields };
      const plan = planCanvasApply(current, sources, request);
      if (isBrowserPreview && plan.source) throw new Error("外部源是导入快照，请在 VS Code 中应用到源文件。");
      const expected = Object.fromEntries(Object.entries(sources).flatMap(([key,entry]) => entry.document ? [[key,canvasFingerprint(entry.document)]] : []));
      if (!fields || fields.length > 1) {
        const patches = findOwnedCanvasNode(current,meta.ownerId)!.instanceEdits?.overrides ?? [];
        const rows = patches.filter(patch=>all || sameTarget(patch.target,meta.target)).flatMap(patch=>[...Object.keys(patch.set),...patch.unset].filter(field=>!fields || fields.includes(field)).map(field=>({target:patch.target.path.at(-1)?.nodeId ?? "组件根",field,value:patch.unset.includes(field)?"移除此属性":patch.set[field]})));
        setApplyReview({request,expected,source:plan.source || "当前文件",fields:rows});
      } else applyCanvas(request,expected);
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
  };
  const repairOrphan = (orphan: CanvasOrphan, parentId?: string) => {
    edit(document=>{try {
      if (!orphan.additionId) return revertCanvasProperties(document,orphan.ownerId,orphan.target);
      const parent=parentId?composition?.info.get(parentId):undefined;
      return changeCanvasAddition(document,orphan.ownerId,orphan.additionId,parent?.target);
    } catch(error) {setNotice(error instanceof Error?error.message:String(error));return document;}});
  };
  const changeOverrideSelection = (selections: CanvasPropertySelection[], apply: boolean) => {
    const current=read(), ownerId=selectedMeta?.ownerId;
    if(!current || !ownerId || !page || pending)return;
    try {
      if(!apply){edit(document=>revertCanvasSelections(document,ownerId,selections));return;}
      const request={pageId:page.id,ownerId,selections},plan=planCanvasApply(current,sources,request);
      if(isBrowserPreview && plan.source)throw new Error("外部源是导入快照，请在 VS Code 中应用到源文件。");
      applyCanvas(request,Object.fromEntries(Object.entries(sources).flatMap(([key,entry])=>entry.document ? [[key,canvasFingerprint(entry.document)]] : [])));
    }catch(error){setNotice(error instanceof Error ? error.message : String(error));}
  };
  const copyOrphan = (orphan: CanvasOrphan) => {
    const current=read();if(!current)return;
    try {const copy=copyCanvasOrphan(current,orphan);if(copy) {setClipboard(copy);setNotice("已复制保留的附加内容。");}}
    catch(error) {setNotice(error instanceof Error?error.message:String(error));}
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
    setCanvasMenu(null);
    if (!editingId) overviewCamera.current = camera;
    setEditingId(target.id); setSelectedPageId(target.id); setSelectedNodeId(null); setScopeIds([]);
    setTool("select"); setInspectorOpen(true); fit([target], true);
  };
  const leavePage = (nextCamera: Camera) => { setCanvasMenu(null); gesture.current = null; setPreview(null); setEditingId(null); setSelectedNodeId(null); setScopeIds([]); setTool("select"); setCamera(nextCamera); };
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
    if (!canvasMenu) return;
    const target = canvasDocument?.pages.find(item=>item.id===canvasMenu.pageId);
    if (mode !== "prototype" || (canvasMenu.kind === "nodes" ? editingId !== canvasMenu.pageId || !page || !!canvasMenu.target.id && !page.nodes.some(node=>node.id===canvasMenu.target.id) : !!editingId || !!canvasMenu.pageId && !target)) setCanvasMenu(null);
  }, [canvasMenu,canvasDocument,page,mode,editingId]);
  useEffect(() => {
    const listener = (event: MessageEvent<HostToWebviewMessage>) => {
      const message = event.data;
      if (message?.type === "commandCompleted" && message.action === "applyCanvas") setNotice(isBrowserPreview ? "已应用到源组件。" : "已应用到源组件，源文件待保存。");
      if (message?.type !== "canvasSources") return;
      setSources(message.sources);
      if (message.pickedSource !== undefined) setPickerSource(message.pickedSource);
      if (message.error) setNotice(message.error);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
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
    setCanvasMenu(null);
    const currentPage = readPage(editingId);
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
    const currentPage = readPage(editingId);
    if (currentPage) applyNodeSelection({ ids, primaryId: ids.at(-1) ?? null, anchorId: ids.at(-1) ?? null }, currentPage);
  };
  const selectNode = (id: string | null, intent: SelectionIntent = {}) => {
    const currentPage = readPage(editingId);
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
  const addLayer = (type: InsertType, parentId?: string, afterId?: string) => {
    if (!editingId) return;
    if (page?.nodes.some(node => node.id === page.componentRootId)) parentId ??= page.componentRootId;
    const makeId = newIds();
    const id = makeId();
    updatePage(editingId, item => insertCanvasComponent(item,parentId,type,id,makeId,afterId).page);
    selectNode(id);
  };
  const addFromToolbar = (type: InsertType) => {
    if (!editingId) return;
    addLayer(type,scopeId ?? undefined); setInsertOpen(false);
  };
  const deleteLayer = (id: string) => {
    if (!editingId) return;
    const currentPage = readPage(editingId);
    if (!currentPage) return;
    const issue = composition && canvasStructureIssue(composition, selectedNodeIds.includes(id) ? selectedNodeIds : [id], "delete");
    if (issue) { setNotice(issue); return; }
    const next = removeSelection(currentPage, selectedNodeIds.includes(id) ? selectedNodeIds : [id]);
    if (next === currentPage) return;
    updatePage(editingId, () => next);
    setSelection(previous => reconcileSelection(next, previous));
  };
  const moveLayer = (id: string, target: LayerDrop) => { if (editingId) updatePage(editingId, item => moveSelection(item, selectedNodeIds.includes(id) ? selectedNodeIds : [id], target, runtimeResources.sizes)); };
  const copyLayer = (id: string) => {
    const currentPage = readPage(editingId);
    if (currentPage && composition) { try { setClipboard(copyCanvasSelection(read()!, composition, selectedNodeIds.includes(id) ? selectedNodeIds : [id], runtimeResources.sizes)); } catch(error) {setNotice(String(error));} }
  };
  const pasteLayer = (parentId?: string, afterId?: string) => {
    const currentPage = readPage(editingId);
    if (!currentPage || !clipboard) return;
    const result = pasteNode(currentPage, clipboard, newIds(), parentId, afterId);
    if (result.id) { updatePage(currentPage.id, () => result.page); selectNodes(result.ids ?? [result.id]); }
  };
  const duplicateLayer = (id: string) => {
    const currentPage = readPage(editingId);
    const node = currentPage?.nodes.find((item) => item.id === id);
    if (!currentPage || !node || inheritedFlag(currentPage, node, "locked")) return;
    const ids = selectedNodeIds.includes(id) ? selectedNodeIds : [id];
    const copies = composition && read() ? copyCanvasSelection(read()!,composition,ids,runtimeResources.sizes) : null;
    const result = copies && copies.nodes.some(node => node.prefab) ? pasteNode(currentPage,copies,newIds(),commonSelectionParent(currentPage,ids) ?? undefined) : duplicateSelection(currentPage,ids,newIds());
    if (result.ids?.length) { updatePage(currentPage.id, () => result.page); selectNodes(result.ids); }
  };
  const convertLayer = (id: string, type: InsertType) => { if (editingId) updatePage(editingId, (item) => convertNodeType(item, id, type, runtimeResources.sizes)); };
  const unbindPrefab = (id: string, recursive: boolean) => {
    if (!editingId) return;
    const makeId = newIds();
    edit(document => {
      try { return unbindCanvasInstance(document, editingId, sources, id, recursive, makeId); }
      catch (error) { setNotice(error instanceof Error ? error.message : String(error)); return document; }
    });
  };
  const saveToCanvas = (id: string) => {
    if (!editingId) return;
    const makeId = newIds();
    edit(document => {
      try {
        const next = extractCanvasSelection(document, editingId, sources, id, makeId, runtimeResources.sizes);
        setNotice("已存为画布组件，原位置保留关联引用。"); return next;
      } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); return document; }
    });
    setSelectedNodeId(id); setScopeIds([]);
  };
  const openSource = (id: string) => {
    const document = read(), meta = composition?.info.get(id);
    if (!document || !meta?.ownerId) return;
    const owner = findOwnedCanvasNode(document, meta.ownerId);
    if (!owner?.prefab) return;
    const target = meta.sourcePageId ? { key: meta.source, page: (meta.source ? sources[meta.source]?.document : document)?.pages.find(p => p.id === meta.sourcePageId), error: undefined } : findCanvasTarget(document, sources, owner.prefab);
    if (target.key) { postHostMessage({ type: "openCanvasSource", source: target.key }); return; }
    if (!target.page) { setNotice(target.error ?? "源画布不存在。"); return; }
    enter(target.page);
    if (target.page.componentRootId) { setSelectedNodeId(target.page.componentRootId); setCanvasSelection(value => value + 1); }
  };
  const insertReference = (source: string, pageId: string) => {
    const document = read(), current = readPage(editingId);
    const sourceDocument = source ? sources[source]?.document : document;
    const definition = sourceDocument?.pages.find(p => p.id === pageId);
    if (!document || !current || !sourceDocument || !definition) { setNotice("请先进入目标页面。"); return; }
    if (cellPicker) {
      const node = current.nodes.find(item => item.id === cellPicker.nodeId);
      if (definition.rootType !== "UIBox" || current.id !== cellPicker.pageId || node?.type !== "list" || inheritedFlag(current,node,"locked")) return;
      const oldItems = descendants(current,node.id);
      if (current.nodes.some(item=>oldItems.has(item.id) && inheritedFlag(current,item,"locked"))) {setNotice("请先解锁要替换的列表项。"); return;}
      updatePage(current.id, item=>{
        let changed = item;
        for (const child of item.nodes.filter(n=>n.parentId === node.id)) changed = removeNode(changed,child.id);
        return {...changed,nodes:changed.nodes.map(n=>n.id===node.id ? {...n,layout:{...n.layout,scrollType:listScrollType(n)},cellPrefab:{source,documentId:sourceDocument.documentId,pageId}} : n)};
      });
      setCellPicker(null); setPickerSource(null); return;
    }
    const node = makeCanvasInstance(sourceDocument, definition, source, newIds()(), runtimeResources.sizes);
    const next = insertNode(current, node, scopeId ?? undefined);
    if (next === current) { setNotice("当前容器已锁定，无法添加引用。"); return; }
    updatePage(current.id, () => next); selectNode(node.id); setPickerSource(null); setTool("select");
  };
  const duplicate = () => {
    if (!page || (selectedNode && inheritedFlag(page, selectedNode, "locked"))) return;
    if (editingId && !selectedNode) return;
    const makeId = newIds();
    if (selectedNode) duplicateLayer(selectedNode.id);
    else { const next = duplicatePage(canonicalPage ?? page, makeId); edit((document) => ({ ...document, pages: [...document.pages, next] })); if (editingId) back(); setSelectedPageId(next.id); fit([...(canvasDocument?.pages ?? []), next], false); }
  };
  const remove = () => {
    if (!page || (selectedNode && inheritedFlag(page, selectedNode, "locked"))) return;
    if (editingId && !selectedNode) return;
    if (selectedNode) deleteLayer(selectedNode.id);
    else { edit((document) => removePage(document, page.id)); if (editingId) back(); setSelectedPageId(null); }
  };
  const restoreCanvasFocus = () => {
    const input = viewport.current?.querySelector<HTMLInputElement>('[role="dialog"] input');
    (input ?? viewport.current)?.focus({preventScroll:true});
    input?.select();
  };
  const openCanvasMenu = (x: number, y: number, hitPageId?: string, hitNodeId?: string) => {
    if (!canvasDocument || renameTarget || pickerSource !== null || applyReview) return;
    if (isField(document.activeElement)) (document.activeElement as HTMLElement).blur();
    gesture.current=null;setPreview(null);setInsertOpen(false);
    viewport.current?.focus({preventScroll:true});
    const bounds=viewport.current!.getBoundingClientRect();
    const point={x:(x-bounds.left-camera.x)/camera.zoom,y:(y-bounds.top-camera.y)/camera.zoom};
    const currentPage=readPage(editingId);
    if (editingId && currentPage) {
      const target=canvasContextTarget(currentPage,scopeId,hitNodeId,selectedNodeIds,directSelection);
      if (target.id) {selectNode(target.id,{preserve:true});setCanvasSelection(value=>value+1);}
      else setSelectedNodeId(null);
      setCanvasMenu({kind:"nodes",pageId:editingId,target:{id:target.id,x,y},backgroundParentId:target.backgroundParentId,point});
    } else {
      const target=read()?.pages.find(item=>item.id===hitPageId);
      setSelectedPageId(target?.id ?? null);setInspectorOpen(true);
      setCanvasMenu({kind:"overview",pageId:target?.id ?? null,target:{id:null,x,y},point});
    }
  };
  const canvasContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target=event.target as Element;
    event.preventDefault();
    if (target.closest('.floating-panel, .canvas-toolbar, .canvas-top-controls, [role="dialog"], input, textarea, select')) return;
    event.stopPropagation();
    openCanvasMenu(event.clientX,event.clientY,target.closest<HTMLElement>('[data-page-id]')?.dataset.pageId,
      target.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId ?? (target.closest('.selection-box') ? selectedNodeId ?? undefined : undefined));
  };
  const addCanvasLayer = (type: InsertType, parentId?: string, afterId?: string) => {
    const currentPage=readPage(editingId);
    if (!currentPage || !canvasMenu) return;
    const result=placeCanvasComponent(currentPage,parentId ?? null,type,canvasMenu.point,newIds(),afterId);
    if (result.id) {updatePage(currentPage.id,()=>result.page);selectNode(result.id);setCanvasSelection(value=>value+1);}
  };
  const beginCanvasRename = (nodeId?: string) => {
    const currentPage=readPage(editingId ?? canvasMenu?.pageId ?? null);
    const node=currentPage?.nodes.find(item=>item.id===nodeId);
    if (!currentPage || nodeId && (!node || inheritedFlag(currentPage,node,"locked"))) return;
    setRenameTarget({pageId:currentPage.id,nodeId,name:node?.name ?? currentPage.name});
  };
  const renameCanvasTarget = (name: string) => {
    if (!renameTarget) return;
    updatePage(renameTarget.pageId,item=>{
      if (!renameTarget.nodeId) return item.name===name ? item : {...item,name};
      const node=item.nodes.find(node=>node.id===renameTarget.nodeId);
      return !node || node.name===name || inheritedFlag(item,node,"locked") ? item : {...item,nodes:item.nodes.map(node=>node.id===renameTarget.nodeId ? {...node,name} : node)};
    });
  };
  useEffect(() => {
    if (mode !== "prototype") return;
    const keydown = (event: KeyboardEvent) => {
      if (pickerSource !== null) return;
      if ((event.target as Element).closest("[role=menu], dialog[open]")) return;
      const command = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      if (isField(event.target)) {
        if (command && key === "s") { event.preventDefault(); (event.target as HTMLElement).blur(); save(); }
        return;
      }
      if ((event.key === "ContextMenu" || event.shiftKey && event.key === "F10") && viewport.current?.contains(event.target as Node) && !(event.target as Element).closest('.floating-panel, .canvas-toolbar, [role="dialog"]')) {
        event.preventDefault();
        const element=selectedNodeId ? viewport.current.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(selectedNodeId)}"]`) : viewport.current.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(editingId ?? selectedPageId ?? "")}"]`);
        const bounds=(element ?? viewport.current).getBoundingClientRect(), view=viewport.current.getBoundingClientRect();
        openCanvasMenu(Math.max(view.left+8,Math.min(view.right-8,bounds.left+bounds.width/2)),Math.max(view.top+8,Math.min(view.bottom-8,bounds.top+bounds.height/2)),editingId ?? selectedPageId ?? undefined,selectedNodeId ?? undefined);return;
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
          updatePage(page.id, item => translateSelection(item, selectedNodeIds, key === "arrowleft" ? -step : key === "arrowright" ? step : 0, key === "arrowup" ? -step : key === "arrowdown" ? step : 0, "nudge", runtimeResources.sizes)); return;
        }
        if (node && inheritedFlag(page, node, "locked")) return;
        const frame = node ? pageLayout(page).nodes.get(node.id)!.local : page.frame, step = event.shiftKey ? 10 : 1;
        const next = { ...frame, x: frame.x + (key === "arrowleft" ? -step : key === "arrowright" ? step : 0), y: frame.y + (key === "arrowup" ? -step : key === "arrowdown" ? step : 0) };
        if (node) updatePage(page.id, (item) => editNodeFrame(item, node.id, next, "nudge", runtimeResources.sizes)); else if (!editingId) updatePage(page.id, (item) => ({ ...item, frame: { ...next, x: Math.round(next.x), y: Math.round(next.y) } })); return;
      }
      if (command || event.altKey) return;
      if (key === "+") { event.preventDefault(); addPage(); return; }
      if (key === "v") setTool("select"); if (key === "h") setTool("hand");
      const next = TOOLS.find((item) => item.key.toLowerCase() === key); if (next && !event.repeat) {event.preventDefault();addFromToolbar(next.type);}
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
    setCanvasMenu(null);
    if (isField(document.activeElement)) (document.activeElement as HTMLElement).blur();
    const latest = read();
    const latestPage = readPage(editingId);
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const hitPageId = target.closest<HTMLElement>("[data-page-id]")?.dataset.pageId;
    const hitNodeId = target.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
    const handle = target.closest<HTMLElement>("[data-handle]")?.dataset.handle as Handle | undefined;
    let kind: Gesture["kind"] = "pan", frame: Frame = { x: camera.x, y: camera.y, width: 0, height: 0 };
    let nodeId: string | undefined, pageId: string | undefined, nodeIds: string[] | undefined, sourcePage: GameFlowPage | undefined, collapseId: string | undefined;
    let transform: Gesture["transform"];
    if (event.button === 1 || tool === "hand" || spaceHand) { /* Pan over any object. */ }
    else if (editingId && latestPage) {
      const node = handle || (selectedNodeIds.length > 1 && selectedNodeIds.includes(hitNodeId ?? "")) ? latestPage.nodes.find(item => item.id === (handle ? selectedNodeId : hitNodeId)) : canvasHitNode(latestPage, scopeId, hitNodeId, directSelection);
      if (node) {
        if (!handle) setCanvasSelection(previous => previous + 1);
        if (event.ctrlKey || event.metaKey || event.shiftKey) { selectNode(node.id, { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey, order: orderedNodes(latestPage).filter(item => (item.parentId ?? null) === (directSelection ? node.parentId ?? null : scopeId) && (!directSelection || !inheritedFlag(latestPage, item, "hidden"))).map(item => item.id) }); return; }
        if (!handle && selectedNodeIds.length > 1 && selectedNodeIds.includes(node.id)) {
          kind = "node"; frame = { x: 0, y: 0, width: 0, height: 0 }; nodeIds = selectedNodeIds; sourcePage = latestPage; collapseId = node.id; pageId = latestPage.id;
        } else {
          selectNode(node.id);
          if (inheritedFlag(latestPage, node, "locked") || (!handle && sliderOwner(latestPage, node))) return;
          const g = pageLayout(latestPage).nodes.get(node.id)!; if (!g.inverse) return;
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
    else if (current.pageId) updatePage(current.pageId, (item) => current.kind === "page" ? { ...item, frame: current.next } : current.nodeIds ? translateSelection(item, current.nodeIds, current.next.x, current.next.y, "move", runtimeResources.sizes) : editNodeFrame(item, current.nodeId!, current.next, current.kind === "resize" ? "resize" : "move", runtimeResources.sizes));
  };
  const requestImport = () => { if (page && selectedNode?.type === "image") { importTarget.current = { pageId: page.id, nodeId: selectedNode.id }; fileInput.current?.click(); } };
  const importImage = async (file?: File) => {
    const target = importTarget.current; if (!file || !target) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) { setNotice("请选择 5 MB 以内的 PNG、JPEG、WebP 或 GIF 图片"); return; }
    try {
      const imageData = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      updatePage(target.pageId, (item) => ({ ...item, nodes: item.nodes.map((node) => node.id === target.nodeId && !inheritedFlag(item, node, "locked") ? { ...node, imageData, sliceResource: undefined } : node) }));
    } catch { setNotice("图片读取失败，请重试"); }
  };
  const visibleCamera = preview?.kind === "pan" ? { ...camera, x: preview.next.x, y: preview.next.y } : camera;
  const panelPageFrame = preview?.kind === "page" && preview.pageId === page?.id ? preview.next : page?.frame;
  const panels = useFollowingPanels(viewport, mode === "prototype", panelPageFrame ? {
    x: visibleCamera.x + (editingId ? 0 : panelPageFrame.x * visibleCamera.zoom),
    y: visibleCamera.y + (editingId ? 0 : panelPageFrame.y * visibleCamera.zoom),
    width: panelPageFrame.width * visibleCamera.zoom
  } : null, !!editingId, inspectorOpen, 48);
  let renderPage = page;
  if (preview?.nodeIds && preview.sourcePage) renderPage = translateSelection(preview.sourcePage, preview.nodeIds, preview.next.x, preview.next.y, "move", runtimeResources.sizes);
  if (renderPage && preview?.nodeId && preview.pageId === renderPage.id) renderPage = editNodeFrame(renderPage, preview.nodeId, preview.next, preview.kind === "resize" ? "resize" : "move", runtimeResources.sizes);
  if (renderPage) renderPage = applyColorPreview(renderPage, colorPreview);
  const renderedNode = renderPage?.nodes.find((node) => node.id === selectedNodeId);
  const selectionBlocked = !editingId && !!renderPage && pagePreviewBlocked(renderPage, pagePsds, resourceMode);
  const selectionLayout = renderPage ? pageLayout(renderPage) : null;
  const selectedGeometry = !selectionBlocked && selectedNodeIds.length === 1 && editingId && renderPage && renderedNode && !inheritedFlag(renderPage, renderedNode, "hidden") ? selectionLayout!.nodes.get(renderedNode.id)! : null;
  const selectionX = selectedGeometry ? Math.hypot(selectedGeometry.matrix[0], selectedGeometry.matrix[1]) : 1;
  const selectionY = selectedGeometry ? Math.hypot(selectedGeometry.matrix[2], selectedGeometry.matrix[3]) : 1;
  const selectionWidth = (selectedGeometry?.local.width ?? 0)*selectionX*visibleCamera.zoom;
  const selectionHeight = (selectedGeometry?.local.height ?? 0)*selectionY*visibleCamera.zoom;
  const selectionAnchor = selectedGeometry ? mapPoint(selectedGeometry.matrix, { x: (renderedNode?.transform?.anchorX ?? 0)*selectedGeometry.local.width, y: (renderedNode?.transform?.anchorY ?? 0)*selectedGeometry.local.height }) : null;
  const unlocked = renderPage && renderedNode && !inheritedFlag(renderPage, renderedNode, "locked");
  const zoomAtCenter = (factor: number) => { const rect = viewport.current?.getBoundingClientRect(); if (!rect) return; setCamera((previous) => { const zoom = clampZoom(previous.zoom * factor), x = rect.width / 2, y = rect.height / 2; return { x: x - (x - previous.x) / previous.zoom * zoom, y: y - (y - previous.y) / previous.zoom * zoom, zoom }; }); };
  const switchResourceMode = (next: import("../shared/image-slots").ResourceMode) => {
    if (next !== resourceMode) {
      setSelectedNodeId(null); setCanvasMenu(null); gesture.current = null; setPreview(null);
    }
    setResourceMode(next);
    runtimeResources.refresh();
  };
  const switchMode = (next: WorkspaceMode) => { setCanvasMenu(null); setRenameTarget(null); gesture.current = null; setPreview(null); setSpaceHand(false); setInsertOpen(false); setMode(next); };

  const importPrototype = async (file?: File) => {
    const documentId = read()?.documentId;
    if (!file || !documentId || importingPsd) return;
    setImportingPsd(true);
    setNotice("");
    const failed = (error: unknown) => setNotice("导入 PSD 失败。" + (error instanceof Error ? error.message : String(error)));
    try {
      const { width, height, layers, omitted, approximate } = await importPsdPrototype(file);
      if (!read()) throw new Error("当前画布不可用，请重新导入。");
      edit(current => {
        try {
          if (current.documentId !== documentId) throw new Error("画布已切换，请重新导入。");
          const makeId = newIds(current);
          const id = makeId();
          const ids = layers.map(() => makeId());
          const nodes = layers.map(({ node, parent }, index) => {
            if (parent === null) return { ...node, id: ids[index] };
            const { x, y } = layers[parent].node.frame;
            return { ...node, id: ids[index], parentId: ids[parent], frame: { ...node.frame, x: node.frame.x - x, y: node.frame.y - y } };
          });
          const x = current.pages.reduce((right, { frame }) => Math.max(right, frame.x + frame.width + 80), 0);
          const imported: GameFlowPage = { id, name: file.name.slice(0, -4).trim() || "PSD 原型", kind: "screen", rootType: "UIStack",
            frame: { x: Math.ceil(x), y: 0, width, height }, nodes };
          const candidate = { ...current, schemaVersion: GAMEFLOW_SCHEMA_VERSION, pages: [...current.pages, imported] };
          const valid = validateGameFlowDocument(candidate);
          if (!valid.ok) throw new Error(valid.errors.join("；"));
          switchMode("prototype");
          switchResourceMode("prototype");
          enter(imported);
          setNotice([`已导入 ${nodes.length} 个图层`, omitted ? `跳过 ${omitted} 个无可用像素的图层` : "",
            approximate ? "部分图层使用近似显示" : ""].filter(Boolean).join("，") + "。");
          return candidate;
        } catch (error) {
          failed(error);
          return current;
        }
      });
    } catch (error) {
      failed(error);
    } finally {
      setImportingPsd(false);
    }
  };

  const referenceOwner=canvasDocument && selectedMeta?.ownerId ? findOwnedCanvasNode(canvasDocument,selectedMeta.ownerId) : undefined;
  const sourceTarget=canvasDocument && referenceOwner?.prefab ? findCanvasTarget(canvasDocument,sources,referenceOwner.prefab) : undefined;
  const referenceName=(selectedMeta?.source ? sources[selectedMeta.source]?.document : canvasDocument)?.pages.find(item=>item.id===selectedMeta?.sourcePageId)?.name ?? sourceTarget?.page?.name;
  const overrideActions: OverrideActions | undefined = selectedMeta?.ownerId && (selectedMeta.inherited || selectedMeta.reference) ? {
    meta:selectedMeta, current:selectedNode ?? undefined,
    disabled:pending || !!(selectedNode && page && inheritedFlag(page,selectedNode,"locked")),
    applyReason:isBrowserPreview && referenceOwner?.prefab?.source ? "外部快照需在 VS Code 中应用" : sourceTarget && sources[sourceTarget.key]?.readOnly ? "源文件只读" : composition?.errors.get(selectedMeta.ownerId),
    applyIssue:fields=>{try {if(canvasDocument && page) planCanvasApply(canvasDocument,sources,{pageId:page.id,ownerId:selectedMeta.ownerId!,target:selectedMeta.target,fields});return undefined;}catch(error) {return error instanceof Error?error.message:String(error);}},
    targetName:sourceTarget?.page?.name, targetSource:referenceOwner?.prefab?.source,
    onRevert:fields=>changeOverrides(fields), onApply:fields=>changeOverrides(fields,true)
  } : undefined;
  const overrideGroups: CanvasOverrideGroup[] = (referenceOwner?.instanceEdits?.overrides ?? []).map(patch=>{
    const entry=[...composition?.info ?? []].find(([,meta])=>meta.ownerId===referenceOwner?.id && sameTarget(meta.target,patch.target));
    const node=page?.nodes.find(node=>node.id===entry?.[0]);
    const name=node?.name ?? (patch.target.path.length ? "已失效节点" : referenceOwner?.name ?? "组件根");
    return {target:patch.target,name,path:node && page ? [...canvasScopePath(page,node.parentId ?? null).map(parent=>parent.name),name].join(" / ") : patch.target.path.map(part=>part.nodeId).join(" / "),fields:[...Object.keys(patch.set),...patch.unset].map(field=>({path:field,label:canvasPropertyLabel(field),sourceValue:readProperty(entry?.[1].base,field),localValue:patch.set[field],unset:patch.unset.includes(field)}))};
  }).filter(group=>group.fields.length);
  const overrideManager: CanvasOverrideManager | undefined=overrideActions && selectedMeta && page && canvasDocument ? {
    groups:overrideGroups,initialTarget:selectedMeta.target,sourceName:sourceTarget?.page?.name,sourcePath:referenceOwner?.prefab?.source,
    disabled:overrideActions.disabled,applyReason:overrideActions.applyReason,
    applyIssue:selections=>{try{planCanvasApply(canvasDocument,sources,{pageId:page.id,ownerId:selectedMeta.ownerId!,selections});return undefined;}catch(error){return error instanceof Error?error.message:String(error);}},
    onRevert:selections=>changeOverrideSelection(selections,false),onApply:selections=>changeOverrideSelection(selections,true)
  } : undefined;

  const pageActionBusy = importingPsd || openingSlice || pending || pagePsds.busy.size > 0;
  const psdActionDisabled = !page || pageActionBusy || !!composition?.errors.size;
  function openPsdSync(source?: SyncSession["source"]) {
    if (!canvasDocument || !composition || psdActionDisabled) return;
    if (composition.page.artPsd) setSyncSession({document:canvasDocument,page:composition.page,components:psdComponentInstances(composition),
      componentTargets:componentPsdTargets(canvasDocument,sources,composition),sources,makeId:newIds(),source});
    else if (source === "proto") void pagePsds.run(composition.page.id, "generate");
  }
  const openPageSlice = async () => {
    if (!canonicalPage?.artPsd || pageActionBusy) return;
    if (!isBrowserPreview && !document.querySelector('meta[name="gameflow-page-psd-slice"][content="1"]')) {
      setNotice("请按 F1 执行「Developer: Reload Window」（重新加载窗口），以启用当前页面的 PSD 切图。");
      return;
    }
    setOpeningSlice(true);
    try {
      const result = await requestPsd({ action: "slice", pageId: canonicalPage.id, expected: canonicalPage.artPsd });
      if (result) openBrowserSlice.current?.({ asset: result.asset, bytes: sourceBytes(result.asset).slice().buffer });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setOpeningSlice(false);
    }
  };

  const selectWorkspace = (next: WorkspaceMode) => {
    if (mode === "prototype" && next === "slice" && canonicalPage?.artPsd) void openPageSlice();
    else switchMode(next);
  };
  const currentWorkspace = WORKSPACE_MODES.find(item => item.id === mode) ?? WORKSPACE_MODES[0];
  const CurrentWorkspaceIcon = currentWorkspace.icon;

  return <ListCells.Provider value={listCells}><SliceResourcesProvider value={{ ...selectedResources, forPage: runtimeResources.forPage }}><TooltipProvider delayDuration={300}><main className="app-shell">
    <header className="topbar"><DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild><Button size="sm" variant="ghost" className="workspace-mode-trigger" aria-label={`工作台模式：${currentWorkspace.label}`}><CurrentWorkspaceIcon size={17} aria-hidden="true" /><span>{currentWorkspace.label}</span><ChevronDown size={13} aria-hidden="true" /></Button></DropdownMenu.Trigger>
      <DropdownMenu.Portal><DropdownMenu.Content loop side="bottom" align="start" sideOffset={5} collisionPadding={6} className="layer-context-menu workspace-mode-menu" aria-label="工作模式" onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
        {WORKSPACE_MODES.map(({ id, label, icon: Icon }) => <DropdownMenu.Item key={id} aria-current={mode === id ? "page" : undefined} disabled={id === "slice" && mode === "prototype" && !!canonicalPage?.artPsd && pageActionBusy} onSelect={() => selectWorkspace(id)}><Icon size={15} aria-hidden="true" /><span>{label}</span>{mode === id ? <Check size={14} aria-hidden="true" /> : null}</DropdownMenu.Item>)}
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root><Separator orientation="vertical" className="topbar-separator" />
      <div ref={setDocumentActions} className="workbench-document-actions" role="group" aria-label="文档操作">{mode === "prototype" ? <>
        <IconTool label="撤销 (Ctrl+Z)" disabled={pending || !canvasDocument} onClick={() => history("undo")}><Undo2 size={15} /></IconTool>
        <IconTool label="重做 (Ctrl+Shift+Z)" disabled={pending || !canvasDocument} onClick={() => history("redo")}><Redo2 size={15} /></IconTool>
        <IconTool label="保存 (Ctrl+S)" disabled={pending || !canvasDocument} onClick={save}><Save size={15} /></IconTool>
      </> : null}{mode !== "slice" ? <WorkbenchSettingsButton settings={settings} /> : null}</div>
      <Separator orientation="vertical" className="topbar-separator" />
      {mode === "prototype" && editingId && page ? <><Button size="sm" variant="ghost" onClick={back}><ArrowLeft size={14} />总览</Button><span className="breadcrumb">/</span></> : null}
      <span className="document-title">{mode === "prototype" ? editingId ? page?.name : canvasDocument?.title ?? "正在打开画布" : "美术工作区"}</span>
    </header>
    <WorkbenchSettingsPanel settings={settings} file={canvasDocument ? { directory: canvasDocument.exportDirectory, name: resourceName || canvasDocument.title, change: exportDirectory => edit(document => ({ ...document, exportDirectory })) } : undefined} />
    <div ref={viewport} tabIndex={-1} hidden={mode !== "prototype"} className={cn("canvas-viewport", (tool === "hand" || spaceHand) && "hand-tool", preview?.kind === "pan" && "is-panning", (preview?.kind === "node" || preview?.kind === "page") && "is-moving")} aria-label={editingId ? "页面编辑画布" : "页面总览画布"}
      onContextMenu={canvasContextMenu}
      onPointerDown={startGesture} onPointerMove={moveGesture} onPointerUp={(event) => finishGesture(event)} onPointerCancel={(event) => finishGesture(event, true)}
      onDoubleClick={(event) => {
        const element = event.target as Element;
        if (tool !== "select" || spaceHand || event.ctrlKey || event.metaKey || event.shiftKey || element.closest("button, input, select, .floating-panel")) return;
        const id = element.closest<HTMLElement>("[data-page-id]")?.dataset.pageId;
        if (!editingId && id) { const target = canvasDocument?.pages.find((item) => item.id === id); if (target) enter(target); }
        else if (editingId && page) {
          const node = canvasHitNode(page, scopeId, element.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId, directSelection);
          if (node && canHaveChildren(node)) navigateScope(node.id);
          else if (node && ["text", "input"].includes(node.type)) viewport.current?.querySelector<HTMLInputElement>('input[aria-label="文字内容"]')?.focus();
          else if (!node && scopeId) { const current = scopePath.at(-1)!; navigateScope(current.parentId ?? null, current.id); }
        }
      }}>
      <CanvasDots camera={visibleCamera} />
      {scopeId && !directSelection ? <div className="canvas-scope-dimmer" aria-hidden="true" /> : null}
      {!canvasDocument ? <div className="loading-state">{error ?? "正在载入画布…"}</div> : <>
        <div className="canvas-world" style={{ transform: `translate(${visibleCamera.x}px, ${visibleCamera.y}px) scale(${visibleCamera.zoom})` }}>
          {(editingId ? renderPage ? [renderPage] : [] : resourcePages.map(item => applyColorPreview(item, colorPreview))).map((item) => {
            const frame = preview?.kind === "page" && preview.pageId === item.id ? preview.next : item.frame;
            const visualPage = item, projection = compositions.get(item.id);
            const geometry = pageLayout(visualPage), artBlocked = pagePreviewBlocked(visualPage, pagePsds, resourceMode);
            const nodes = orderedNodes(visualPage), activeNodes = editingId && scopeId && !directSelection ? descendants(visualPage, scopeId) : null;
            const backgroundNodes = nodes.filter(node => !activeNodes?.has(node.id));
            const foregroundNodes = activeNodes ? nodes.filter(node => activeNodes.has(node.id)) : [];
            return <article key={item.id} className={cn("page-group", !editingId && selectedPageId === item.id && "page-selected", editingId && "page-editing")} data-page-id={item.id} style={{ left: editingId ? 0 : frame.x, top: editingId ? 0 : frame.y, width: frame.width, height: frame.height }}>
              <div className="page-caption"><LayoutPanelTop size={14} /><span>{item.name}</span><small>{Math.round(frame.width)} × {Math.round(frame.height)}</small></div>
              <SliceResourcesProvider value={{...(runtimeResources.forPage?.(visualPage) ?? runtimeResources),forPage:runtimeResources.forPage}}><div className={cn("page-surface", artBlocked && "page-art-blocked")} style={{ background: item.background ?? "#ffffff" }}>
                {backgroundNodes.map(node => <NodeView key={node.id} page={visualPage} node={node} referenceError={(projection ?? composition)?.errors.get(node.id)} geometry={geometry.nodes.get(node.id)} />)}
                {showContainerOutlines ? <ContainerOutlines page={visualPage} nodes={backgroundNodes} geometry={geometry} /> : null}
                {activeNodes ? <div className="canvas-scope-dimmer" aria-hidden="true" /> : null}
                {foregroundNodes.map(node => <NodeView key={node.id} page={visualPage} node={node} referenceError={(projection ?? composition)?.errors.get(node.id)} geometry={geometry.nodes.get(node.id)} />)}
                {showContainerOutlines && activeNodes ? <ContainerOutlines page={visualPage} nodes={foregroundNodes} geometry={geometry} /> : null}
                {artBlocked ? <PageArtState page={visualPage} actions={pagePsds} zoom={visibleCamera.zoom}/> : null}
              </div></SliceResourcesProvider>
            </article>;
          })}
        </div>
        <div className="canvas-top-controls" onPointerDown={event => event.stopPropagation()}>
          <div className="canvas-zoom floating-panel"><IconTool label="缩小" onClick={() => zoomAtCenter(1 / 1.2)}><Minus size={14} /></IconTool><span>{Math.round(camera.zoom * 100)}%</span><IconTool label="放大" onClick={() => zoomAtCenter(1.2)}><Plus size={14} /></IconTool><Separator orientation="vertical" /><IconTool label="适应画布" onClick={() => fit(editingId && page ? [page] : canvasDocument.pages, !!editingId)}><Focus size={16} /></IconTool></div>
          {editingId && page ? <nav className="canvas-scope-nav floating-panel" aria-label="编辑层级导航">
            <button type="button" title={`返回页面层：${page.name}`} aria-current={!scopeId ? "location" : undefined} onClick={() => navigateScope(null)}><LayoutPanelTop size={14} /><span>{page.name}</span></button>
            {scopePath.map((node, index) => <span className="canvas-scope-step" key={node.id}><ChevronRight size={12} aria-hidden="true" /><button type="button" title={`编辑 ${node.name} 的子节点 · ${COMPONENTS[node.type].laya}`} aria-current={index === scopePath.length - 1 ? "location" : undefined} onClick={() => navigateScope(node.id)}><NodeIcon type={node.type} /><span>{node.name}</span></button></span>)}
          </nav> : null}
        </div>
        {!selectionBlocked && selectedNodeIds.length > 1 && renderPage ? selectedNodeIds.map(id => {
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
        {editingId && page ? <LayerTree composition={composition ?? undefined} onRepair={repairOrphan} onCopyOrphan={copyOrphan} key={page.id} panelRef={panels.leftRef} panelStyle={panels.leftStyle} page={page} scopeId={scopeId} selectedIds={selectedNodeIds} selectedId={selectedNode?.id ?? null} reveal={canvasSelection} onSelect={selectNode} onPatch={patchNode} onBack={back} onAdd={addLayer} onDelete={deleteLayer} onMove={moveLayer}
          hasClipboard={!!clipboard} onCopy={copyLayer} onPaste={pasteLayer} onDuplicate={duplicateLayer} onConvert={convertLayer} onSaveToCanvas={saveToCanvas} onOpenSource={openSource} onUnbind={unbindPrefab} /> : null}
        {editingId && page ? <LayerMenu page={page} composition={composition ?? undefined} selectedIds={selectedNodeIds} target={canvasMenu?.kind === "nodes" ? canvasMenu.target : null} backgroundParentId={canvasMenu?.backgroundParentId} menuLabel="画布节点右键菜单"
          onClose={()=>setCanvasMenu(null)} onRestoreFocus={restoreCanvasFocus} hasClipboard={!!clipboard} onAdd={addCanvasLayer} onDelete={deleteLayer} onCopy={copyLayer} onPaste={pasteLayer} onRename={beginCanvasRename} onDuplicate={duplicateLayer} onConvert={convertLayer} onSaveToCanvas={saveToCanvas} onOpenSource={openSource} onUnbind={unbindPrefab}>
          <CanvasViewItems onFit={()=>{setCanvasMenu(null);fit([page],true);}} onBack={()=>{setCanvasMenu(null);if(scopeId){const current=scopePath.at(-1)!;navigateScope(current.parentId ?? null,current.id);}else back();}} backLabel={scopeId ? "返回上一级" : "返回总览"}/>
        </LayerMenu> : <CanvasOverviewMenu target={canvasMenu?.kind === "overview" ? canvasMenu.target : null} page={canvasDocument.pages.find(item=>item.id===canvasMenu?.pageId)} onClose={()=>setCanvasMenu(null)} onRestoreFocus={restoreCanvasFocus}
          onEnter={()=>{const target=canvasDocument.pages.find(item=>item.id===canvasMenu?.pageId);if(target)enter(target);}} onRename={()=>beginCanvasRename()} onDuplicate={duplicate} onDelete={remove} onAddPage={addPage} onFit={()=>fit(canvasDocument.pages,false)} />}
        {page && inspectorOpen ? <Inspector makeId={newIds()} variablePage={{...page,nodes:page.nodes.filter(node=>composition?.info.get(node.id)?.scope===selectedMeta?.scope)}} referenceMeta={selectedMeta} referenceName={referenceName} overrideManager={overrideManager} overrideActions={overrideActions} onOpenSource={() => { if (selectedNode) openSource(selectedNode.id); }} referenceError={selectedMeta?.ownerId ? composition?.errors.get(selectedMeta.ownerId) : undefined} onColorPreview={setColorPreview} selectedNodes={selectionBlocked ? [] : page.nodes.filter(node => selectedNodeIds.includes(node.id))} onCreateParts={() => { if (editingId && selectedNodeId) { const makeId = newIds(); updatePage(editingId, item => createControlParts(item, selectedNodeId, makeId)); } }} panelRef={panels.rightRef} panelStyle={panels.rightStyle} page={page} node={selectionBlocked ? null : selectedNode} editingPage={!!editingId} onNode={patchNode} onPage={(transform) => updatePage(page.id, transform)} onClose={() => setInspectorOpen(false)} onEnter={() => enter(page)} onImport={requestImport} /> : null}
        {canvasDocument.pages.length === 0 ? <div className="empty-canvas"><LayoutPanelTop size={32} /><strong>从第一个页面开始</strong><p>用底部 + 添加游戏界面</p><Button onClick={() => addPage()}><Plus size={15} />添加页面</Button></div> : null}
        <div className="canvas-toolbar floating-panel" onPointerDown={(event) => event.stopPropagation()}>
          <IconTool label="直选模式" active={directSelection} onClick={() => setDirectSelection(!directSelection)}><MousePointerClick size={19} /></IconTool>
          <IconTool label="虚线框" active={showContainerOutlines} onClick={() => setShowContainerOutlines(!showContainerOutlines)}><SquareDashed size={19} /></IconTool>
          <Separator orientation="vertical" /><div className="resource-mode-tools" role="group" aria-label="资源显示模式">{([{ id: "prototype", label: "原型", icon: PrototypeIcon }, { id: "art", label: "美术 PSD", icon: Layers3 }, { id: "prefab", label: "预制体", icon: Box }] as const).map(({ id, label, icon: Icon }) => <IconTool key={id} label={label + "资源"} active={resourceMode === id} onClick={() => switchResourceMode(id)}><Icon size={17} /></IconTool>)}</div>
          <Separator orientation="vertical" /><Popover open={insertOpen} onOpenChange={setInsertOpen}><PopoverTrigger asChild><Button size="icon" variant="ghost" className="toolbar-button insert-trigger" aria-label="添加页面或控件"><Plus size={20} /><ChevronDown size={9} /></Button></PopoverTrigger><PopoverContent side="top" align="start" collisionPadding={12} className="insert-menu" aria-label="添加页面或控件菜单">
            <div className="menu-heading">添加到画布</div>
            <div className="insert-grid" role="group" aria-label="添加到画布">{PAGE_ROOT_TYPES.map((type) => { const Icon = type === "UIBox" ? LayoutDashboard : LayoutPanelTop; return <button key={type} onClick={() => addPage(type)}><Icon size={16} /><span>{PAGE_ROOTS[type].label} <small className="menu-class">({type})</small></span></button>; })}</div>
            <Separator /><div className="insert-grid"><button disabled={!editingId} onClick={() => { setInsertOpen(false); setCellPicker(null); setPickerSource(""); }}><Box size={16} /><span>引用画布组件…</span></button></div>
            <Separator /><div className="menu-heading">{editingId ? "添加到当前层" : "双击进入页面后添加控件"}</div>
            <div className="insert-grid" role="group" aria-label="添加控件">{TOOLS.map(({ type, icon: Icon }) => <button key={type} disabled={!editingId} onClick={() => addFromToolbar(type)}><Icon size={16} /><span>{NODE_LABELS[type]} <small className="menu-class">({COMPONENTS[type].laya})</small></span></button>)}</div>
          </PopoverContent></Popover>
          <div className="direct-tools">{TOOLS.filter((item) => item.key).map(({ type, icon: Icon, key }) => <IconTool key={type} label={`${NODE_LABELS[type]} (${key})`} disabled={!editingId} onClick={() => addFromToolbar(type)}><Icon size={19} /></IconTool>)}</div>
          <Separator orientation="vertical" /><CanvasExportActions sources={sources} document={canvasDocument} page={page} sourcePage={composition?.page}
            prepare={(expected,source,updated)=>{
              const current=read(), canonical=current?.pages.find(p=>p.id===source.id);
              if(!current || JSON.stringify(current)!==JSON.stringify(expected) || !canonical || JSON.stringify(composeCanvasPage(current,canonical,sources).page)!==JSON.stringify(source)) throw new Error("原型已变化，请重新比较。");
              const next=editCanvasPage(current,source.id,sources,()=>updated), valid=validateGameFlowDocument(next);
              if(!valid.ok) throw new Error(valid.errors.join("；"));
              return next;
            }} applyBrowser={(expected,next)=>{if(JSON.stringify(read())!==JSON.stringify(expected)) throw new Error("原型已变化，请重新比较。");if(next!==expected) edit(()=>next);}}
            resources={runtimeResources} settings={settings} disabled={psdActionDisabled} mappingError={!!page && !!mappingErrors[page.id]} onNotice={setNotice} onPsdSync={()=>openPsdSync()} onPushPsd={()=>openPsdSync("proto")} onPullPsd={()=>openPsdSync("psd")}>
              <DropdownMenu.Item disabled={pageActionBusy} onSelect={() => psdImportInput.current?.click()}><FileInput size={15} /><span>{importingPsd ? "正在导入 PSD…" : "从 PSD 导入原型…"}</span></DropdownMenu.Item>
              <DropdownMenu.Item disabled={!canonicalPage?.artPsd || pageActionBusy} onSelect={() => void openPageSlice()}><Scissors size={15} /><span>PSD 切图</span></DropdownMenu.Item>
              <DropdownMenu.Item disabled={psdActionDisabled} onSelect={() => { if (page && !psdActionDisabled) void pagePsds.run(page.id, "generate"); }}><FileImage size={15} /><span>生成 PSD</span></DropdownMenu.Item>
              <DropdownMenu.Item disabled={psdActionDisabled} onSelect={() => { if (page && !psdActionDisabled) void pagePsds.run(page.id, "choose"); }}><Link2 size={15} /><span>{page?.artPsd ? "重新绑定 PSD" : "绑定 PSD"}</span></DropdownMenu.Item>
          </CanvasExportActions>
        </div>
      </>}
      {notice || (canvasDocument && error) ? <div className="editor-notice" role="status">{notice || error}</div> : null}
      <input ref={fileInput} className="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="导入控件图片" onChange={(event) => { void importImage(event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={psdImportInput} className="hidden" type="file" accept=".psd" aria-label="从 PSD 导入原型" onChange={(event) => { void importPrototype(event.target.files?.[0]); event.target.value = ""; }} />
      {renameTarget ? <RenameDialog key={`${renameTarget.pageId}/${renameTarget.nodeId ?? ""}`} name={renameTarget.name} kind={renameTarget.nodeId ? "节点" : "画板"} onRename={renameCanvasTarget} onClose={()=>{setRenameTarget(null);viewport.current?.focus({preventScroll:true});}} /> : null}
      {applyReview ? <div className="canvas-apply-backdrop" onPointerDown={event=>event.stopPropagation()}><section role="dialog" aria-modal="true" aria-label="应用属性到源组件" className="canvas-apply-dialog floating-panel workbench-dialog">
        <DialogHeading heading="应用属性到源组件" onClose={()=>setApplyReview(null)} />
        <div className="dialog-body"><p>目标：{applyReview.source}。其他未覆盖实例将同步。</p>
        <div className="canvas-apply-fields"><table><thead><tr><th>节点</th><th>属性</th><th>应用值</th></tr></thead><tbody>{applyReview.fields.map((row,i)=><tr key={i}><td>{row.target}</td><td>{row.field}</td><td>{JSON.stringify(row.value)}</td></tr>)}</tbody></table></div>
        </div><footer><Button variant="outline" onClick={()=>setApplyReview(null)}>取消</Button><Button disabled={pending} onClick={()=>{applyCanvas(applyReview.request,applyReview.expected);setApplyReview(null);}}>应用这些属性</Button></footer>
      </section></div> : null}
      {canvasDocument && pickerSource !== null ? <CanvasReferencePicker cellsOnly={!!cellPicker} replacedChildren={cellPicker && page ? descendants(page,cellPicker.nodeId).size-1 : 0} document={canvasDocument} sources={sources} source={pickerSource} currentPageId={editingId ?? undefined} onSource={setPickerSource} onPick={insertReference}
        onClear={cellPicker && page?.id === cellPicker.pageId && selectedNode?.id === cellPicker.nodeId && selectedNode.cellPrefab && !inheritedFlag(page,selectedNode,"locked") ? () => {
          patchNode(selectedNode.id,{cellPrefab:undefined}); setPickerSource(null); setCellPicker(null);
        } : undefined}
        onClose={() => {setPickerSource(null);setCellPicker(null);}} /> : null}
    </div>
    <PsdWorkspace mode="merge" active={mode === "merge"} settings={settings} />
    <PsdWorkspace mode="slice" active={mode === "slice"} binding={psdEditor.binding} openBoundRef={openBrowserSlice} onReveal={() => switchMode("slice")} documentActions={documentActions} settings={settings} exportPending={pending} onAsset={observePsd} />
    {syncSession && <PageSyncDialog session={syncSession} loadedAsset={
      canvasDocument?.documentId === syncSession.document.documentId && loadedPsds.states[syncSession.page.id]?.key === pagePsdKey(syncSession.page.artPsd)
        ? loadedPsds.assets[syncSession.page.id] : undefined
    } close={()=>setSyncSession(null)} apply={(updated,checkOnly)=>{
      const current=read();
      const prepare=(document:GameFlowDocument)=>{
        const target=document.pages.find(p=>p.id===updated.id);
        if(document.documentId!==syncSession.document.documentId || !target || JSON.stringify(composeCanvasPage(document,target,sources).page)!==JSON.stringify(syncSession.page))
          throw new Error("原型页面已变化，请关闭并重新打开同步窗。");
        const next=editCanvasPage(document,updated.id,sources,()=>updated);
        const valid=validateGameFlowDocument(next);
        if(!valid.ok) throw new Error(valid.errors.join("；"));
        return next;
      };
      if(!current) throw new Error("文档已关闭。");
      const next=prepare(current);
      if(!checkOnly) {edit(()=>next);pagePsds.retry(updated.id);setNotice("已应用文字与结构同步");}
    }}/>}
    {psdEditor.initialError && mode === "slice" ? <div className="psd-status psd-warning" role="alert">{psdEditor.initialError}</div> : null}
  </main></TooltipProvider></SliceResourcesProvider></ListCells.Provider>;
}
