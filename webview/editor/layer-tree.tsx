import type { CanvasComposition, CanvasOrphan } from "../../shared/canvas-instances";
import { skinOwner } from "../../shared/ui-parts";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Eye, EyeOff, LockKeyhole, UnlockKeyhole, Package, Plus, Search, X } from "lucide-react";
import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { inheritedFlag, type InsertType, type LayerDrop } from "../../shared/editor-ops";
import { excludedPrefabNodeIds } from "../../shared/prefab-node-export";
import { moveSelection } from "../../shared/selection-ops";
import { visibleLayerOrder, type SelectionIntent } from "../lib/node-selection";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { cn } from "../lib/utils";
import { LayerMenu, type LayerMenuTarget } from "./layer-menu";
import { LayerRoot, LayerRow, NodeIcon } from "./layer-row";
import { canHaveChildren, pageRootType } from "../../shared/ui-components";
import { searchLayers } from "../lib/layer-search";

export { NodeIcon } from "./layer-row";

export function componentLayerRoot(page: GameFlowPage) {
  return page.nodes.find(node=>node.id===page.componentRootId && node.type==="container" && !node.parentId && !node.prefab) ?? null;
}

interface TreeDrag { id: string; pointerId: number; x: number; y: number; active: boolean; drop: LayerDrop | null }

export function LayerTree({ page, scopeId, selectedId, selectedIds, reveal, onSelect, onPatch, onBack, onAdd, onDelete, onMove, panelRef, panelStyle, hasClipboard, onCopy, onPaste, onDuplicate, onConvert, onSaveToCanvas, onOpenSource, onUnbind, composition, onRepair, onCopyOrphan }: {
  onUnbind?: (id: string, recursive: boolean) => void;
  composition?: CanvasComposition; onRepair?: (orphan: CanvasOrphan, parentId?: string) => void; onCopyOrphan?: (orphan: CanvasOrphan) => void;
  page: GameFlowPage; selectedId: string | null; selectedIds: string[]; reveal: number; onSelect: (id: string | null, intent?: SelectionIntent) => void;
  scopeId: string | null;
  panelRef?: (element: HTMLElement | null) => void; panelStyle?: CSSProperties;
  onPatch: (id: string, patch: Partial<GameFlowNode>) => void; onBack: () => void;
  onAdd: (type: InsertType, parentId?: string, afterId?: string) => void;
  onDelete: (id: string) => void; onMove: (id: string, drop: LayerDrop) => void;
  hasClipboard: boolean; onCopy: (id: string) => void; onPaste: (parentId?: string, afterId?: string) => void;
  onDuplicate: (id: string) => void; onConvert: (id: string, type: InsertType) => void;
  onSaveToCanvas: (id: string) => void; onOpenSource: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [searchCollapsed, setSearchCollapsed] = useState<Set<string>>(new Set());
  const searchInput = useRef<HTMLInputElement | null>(null);
  const filtering = !!query.trim();
  const { matches, visible } = searchLayers(page, query);
  const excludedFromExport = useMemo(() => excludedPrefabNodeIds(page), [page]);
  const componentRoot = componentLayerRoot(page);
  const activeCollapsed = filtering ? searchCollapsed : new Set(page.nodes.filter(node => !expanded.has(node.id)).map(node => node.id));
  const selectionOrder = visibleLayerOrder(page, visible, activeCollapsed).filter(id=>id!==componentRoot?.id);
  const [menu, setMenu] = useState<LayerMenuTarget | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<LayerDrop | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const renameInput = useRef<HTMLInputElement | null>(null);
  const renameCancelled = useRef(false);
  const panel = useRef<HTMLElement | null>(null);
  const treeViewport = useRef<HTMLDivElement | null>(null);
  const revealed = useRef(reveal);
  const attachPanel = useCallback((element: HTMLElement | null) => { panel.current = element; panelRef?.(element); }, [panelRef]);
  const drag = useRef<TreeDrag | null>(null);
  const suppressClick = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const toggle = (id: string) => (filtering ? setSearchCollapsed : setExpanded)((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const expand = (id?: string) => { if (id) (filtering ? setSearchCollapsed : setExpanded)((previous) => { const next = new Set(previous); if (filtering) next.delete(id); else next.add(id); return next; }); };
  const cancelDrag = () => {
    const current = drag.current;
    drag.current = null; setDragging(null); setDrop(null);
    if (current && panel.current?.hasPointerCapture(current.pointerId)) panel.current.releasePointerCapture(current.pointerId);
  };
  const changeQuery = (value: string) => {
    cancelDrag(); setMenu(null); setQuery(value); setSearchCollapsed(new Set());
    const tree = treeViewport.current;
    if (tree) tree.scrollTop = 0;
  };
  const clearSearch = () => { changeQuery(""); searchInput.current?.focus(); };
  // Keep the request pending across filter/expansion commits, then leave manual scrolling alone.
  useLayoutEffect(() => {
    if (revealed.current === reveal) return;
    const node = page.nodes.find((item) => item.id === selectedId);
    if (!node) { revealed.current = reveal; return; }
    if (node.id === componentRoot?.id) { revealed.current = reveal; return; }
    if (filtering && !visible.has(node.id)) { setQuery(""); setSearchCollapsed(new Set()); return; }
    const ancestors = new Set<string>();
    let parentId = node.parentId;
    while (parentId && !ancestors.has(parentId)) {
      ancestors.add(parentId);
      parentId = page.nodes.find((item) => item.id === parentId)?.parentId;
    }
    if ([...activeCollapsed].some((id) => ancestors.has(id))) {
      if (filtering) setSearchCollapsed(previous => new Set([...previous].filter(id => !ancestors.has(id))));
      else setExpanded(previous => new Set([...previous, ...ancestors]));
      return;
    }
    const tree = treeViewport.current;
    const row = tree?.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(node.id)}"]`);
    if (!tree || !row) return;
    const bounds = tree.getBoundingClientRect(), item = row.getBoundingClientRect();
    const top = bounds.top + tree.clientTop, bottom = top + tree.clientHeight;
    if (item.top < top) tree.scrollTop -= top - item.top;
    else if (item.bottom > bottom) tree.scrollTop += item.bottom - bottom;
    revealed.current = reveal;
  });
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && drag.current) { event.preventDefault(); event.stopPropagation(); cancelDrag(); } };
    window.addEventListener("keydown", escape, true); window.addEventListener("blur", cancelDrag);
    return () => { window.removeEventListener("keydown", escape, true); window.removeEventListener("blur", cancelDrag); };
  }, []);
  useEffect(() => { if (menu?.id && !page.nodes.some((item) => item.id === menu.id)) setMenu(null); }, [page, menu]);
  useEffect(() => { if (renaming) { renameInput.current?.focus(); renameInput.current?.select(); } }, [renaming?.id]);
  const beginRename = (id: string) => {
    const node = page.nodes.find((item) => item.id === id);
    if (!node || inheritedFlag(page, node, "locked")) return;
    renameCancelled.current = false; setRenaming({ id, value: node.name });
  };
  const finishRename = () => {
    if (renaming && !renameCancelled.current) {
      const node = page.nodes.find((item) => item.id === renaming.id);
      const name = renaming.value.trim();
      if (node && name && name !== node.name && !inheritedFlag(page, node, "locked")) onPatch(node.id, { name });
    }
    setRenaming(null);
  };

  const openMenu = (event: MouseEvent, id: string | null) => {
    event.preventDefault(); event.stopPropagation(); cancelDrag();
    onSelect(id, { preserve: true });
    const row = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-layer-id], [data-layer-root]") : null;
    returnFocus.current = event.clientX || event.clientY ? panel.current : row?.querySelector<HTMLElement>(".layer-name") ?? panel.current;
    const bounds = row?.getBoundingClientRect();
    setMenu({ id, x: event.clientX || (bounds?.left ?? 16) + 20, y: event.clientY || (bounds?.bottom ?? 100) });
  };
  const hitDrop = (event: ReactPointerEvent): LayerDrop | null => {
    if (filtering) return null;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || !panel.current?.contains(target)) return null;
    const row = target.closest<HTMLElement>("[data-layer-id]");
    if (!row) return target.closest("[data-layer-root]") ? { position: "inside" } : null;
    const node = page.nodes.find((item) => item.id === row.dataset.layerId);
    if (!node) return null;
    const bounds = row.getBoundingClientRect();
    const fraction = (event.clientY - bounds.top) / bounds.height;
    const container = canHaveChildren(node);
    return { targetId: node.id, position: container && fraction > 0.25 && fraction < 0.75 ? "inside" : fraction < 0.5 ? "before" : "after" };
  };
  const pointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!(event.buttons & 1)) { cancelDrag(); return; }
    if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 5) return;
    event.preventDefault();
    if (!current.active) { current.active = true; suppressClick.current = true; setDragging(current.id); event.currentTarget.setPointerCapture(event.pointerId); }
    const scrollArea = treeViewport.current;
    const bounds = scrollArea?.getBoundingClientRect();
    if (scrollArea && bounds && event.clientX >= bounds.left && event.clientX <= bounds.right) {
      if (event.clientY < bounds.top + 18) scrollArea.scrollTop -= 8;
      if (event.clientY > bounds.bottom - 18) scrollArea.scrollTop += 8;
    }
    const next = hitDrop(event);
    current.drop = next && moveSelection(page, selectedIds.includes(current.id) ? selectedIds : [current.id], next) !== page ? next : null;
    setDrop(current.drop);
  };
  const pointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const target = current.active ? hitDrop(event) : null;
    if (target && moveSelection(page, selectedIds.includes(current.id) ? selectedIds : [current.id], target) !== page) {
      onMove(current.id, target);
      expand(target.position === "inside" ? target.targetId : page.nodes.find((item) => item.id === target.targetId)?.parentId);
    }
    cancelDrag();
  };
  const dropClass = (id?: string) => drop && drop.targetId === id ? `layer-drop-${drop.position}` : undefined;
  const branch = (parentId: string | undefined, depth: number): React.ReactNode => page.nodes.filter((node) => node.parentId === parentId && visible.has(node.id)).map((node) => {
    const hasChildren = page.nodes.some((item) => item.parentId === node.id && visible.has(item.id));
    const locked = inheritedFlag(page, node, "locked");
    const meta = composition?.info.get(node.id);
    const protectedStructure = !!meta?.inherited;
    const owner = skinOwner(page, node), controlledVisibility = owner?.type === "checkbox" || owner?.type === "radio";
    const hidden = controlledVisibility ? inheritedFlag(page, node, "hidden") : node.hidden;
    const exportExcluded = excludedFromExport.has(node.id);
    return <div key={node.id}>
      <LayerRow data-layer-id={node.id} name={node.name} depth={depth} selected={selectedIds.includes(node.id)}
        expanded={hasChildren ? !activeCollapsed.has(node.id) : undefined} onToggle={() => toggle(node.id)}
        className={cn(filtering && matches.has(node.id) && "layer-search-match", inheritedFlag(page, node, "hidden") && "is-muted",
          exportExcluded && "is-export-excluded", dragging === node.id && "layer-drag-source", dropClass(node.id))}
        onContextMenu={(event) => openMenu(event, node.id)}>
        {renaming?.id === node.id ? <input ref={renameInput} className="layer-rename" aria-label="节点名称" value={renaming.value}
          onChange={(event) => setRenaming({ id: node.id, value: event.target.value })} onBlur={finishRename}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
            else if (event.key === "Escape") { event.preventDefault(); renameCancelled.current = true; event.currentTarget.blur(); }
          }} /> : <button className={cn("layer-name", (meta?.inherited || meta?.reference) && "layer-reference", !locked && !filtering && !protectedStructure && "layer-draggable")} aria-haspopup="menu"
          title={exportExcluded ? "此节点不导出到预制体" : undefined}
          onPointerDown={(event) => {
            suppressClick.current = false;
            if (event.button !== 0 || menu) return;
            event.preventDefault(); panel.current?.focus({ preventScroll: true });
            const modified = event.ctrlKey || event.metaKey || event.shiftKey;
            onSelect(node.id, { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey, order: selectionOrder, preserve: !modified });
            if (modified) { suppressClick.current = true; return; }
            if (!locked && !filtering && !protectedStructure) drag.current = { id: node.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false, drop: null };
          }} onClick={() => { if (!suppressClick.current) onSelect(node.id); }}><span className="layer-node-icon">{meta?.reference ? <Package size={14} /> : <NodeIcon type={node.type} />}{meta?.added ? <span className="layer-addition-badge" aria-label="本地附加节点" title="本实例附加节点"><Plus size={8} strokeWidth={3} /></span> : null}</span><span>{node.name}</span>{meta?.overrides.length ? <span className="layer-override-dot" title="此节点有本地属性覆盖" aria-label="有本地属性覆盖">●</span> : null}{node.variableName ? <code className="layer-variable" title={`变量：${node.variableName}`}>{node.variableName}</code> : null}</button>}
        <button className="layer-action" disabled={controlledVisibility} title={controlledVisibility ? "显示状态由所属控件的选中状态控制" : undefined} aria-label={`${hidden ? "显示" : "隐藏"}${node.name}`} onClick={() => onPatch(node.id, { hidden: !node.hidden })}>{hidden ? <EyeOff size={12} /> : <Eye size={12} />}</button>
        <button className="layer-action" disabled={protectedStructure} title={protectedStructure ? "源节点锁定状态请在源组件中修改" : undefined} aria-label={`${node.locked ? "解锁" : "锁定"}${node.name}`} onClick={() => onPatch(node.id, { locked: !node.locked })}>{node.locked ? <LockKeyhole size={12} /> : <UnlockKeyhole size={12} />}</button>
      </LayerRow>
      {hasChildren && !activeCollapsed.has(node.id) ? <div role="group">{branch(node.id, depth + 1)}</div> : null}
    </div>;
  });
  return <aside ref={attachPanel} style={panelStyle} tabIndex={-1} className={cn("layer-panel floating-panel", dragging && "layer-dragging")} aria-label="控件层级树"
    onContextMenu={event=>{event.preventDefault();event.stopPropagation();}}
    onKeyDown={(event) => { if (event.key === "F2" && selectedIds.length === 1 && selectedId && !renaming && !menu && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); event.stopPropagation(); beginRename(selectedId); } }}
    onPointerDownCapture={() => { if (!drag.current?.active) suppressClick.current = false; }}
    onPointerDown={(event) => event.stopPropagation()} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
    onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
    <div className="floating-heading"><strong>图层</strong><span aria-live="polite">{filtering ? `${matches.size-Number(!!componentRoot && matches.has(componentRoot.id))}/${page.nodes.length-Number(!!componentRoot)}` : page.nodes.length-Number(!!componentRoot)}</span><Button variant="ghost" size="icon" aria-label="返回总览" onClick={onBack}><X size={14} /></Button></div>
    <div className="layer-search"><Search size={13} aria-hidden="true" /><input ref={searchInput} type="search" aria-label="搜索图层" placeholder="搜索名称、变量、类型或 ID" value={query}
      onChange={(event) => changeQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); clearSearch(); } }} />
      {query ? <button aria-label="清除图层搜索" title="清除搜索 (Esc)" onClick={clearSearch}><X size={12} /></button> : null}
    </div>
    <LayerRoot name={page.name} rootType={pageRootType(page)} data-layer-root className={cn((componentRoot ? selectedId===componentRoot.id : !selectedId && !scopeId) && "is-selected", dropClass())} aria-haspopup="menu" onContextMenu={(event) => openMenu(event, null)}
      onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); panel.current?.focus({ preventScroll: true }); } }} onClick={() => onSelect(componentRoot?.id ?? null)} />
    <ScrollArea className="layer-tree-scroll" label="图层内容" viewportRef={treeViewport}><div role="tree" aria-multiselectable="true" aria-label={page.name} data-layer-root className="layer-tree" onContextMenu={(event) => openMenu(event, null)}>{branch(componentRoot?.id, 0)}{filtering && matches.size===Number(!!componentRoot && matches.has(componentRoot.id)) ? <p className="empty-layers" role="status">没有匹配的图层</p> : page.nodes.length===Number(!!componentRoot) ? <p className="empty-layers">当前页面暂无节点</p> : null}
      <div className={cn("tree-root-drop", drop && !drop.targetId && "layer-drop-inside")} data-layer-root>{dragging ? "移到页面根节点" : ""}</div>
    </div></ScrollArea>
    <div className="layer-footer">{filtering ? "搜索中 · 清除搜索后可拖动排序" : "右键编辑节点 · 拖动调整层级"}</div>
    {composition?.orphans.length ? <div className="canvas-orphans"><strong>待修复的实例编辑</strong>{composition.orphans.map((orphan,index) => <div key={`${orphan.ownerId}-${index}`} title={orphan.message}><span>{orphan.name} · {orphan.message}</span>{orphan.additionId ? <><select aria-label={`重新挂接${orphan.name}`} value="" onChange={event => { if(event.target.value) onRepair?.(orphan,event.target.value); }}><option value="">重新挂接…</option>{page.nodes.filter(node => canHaveChildren(node) && !inheritedFlag(page,node,"locked") && composition.info.get(node.id)?.ownerId === orphan.ownerId && node.id !== orphan.additionId).map(node => <option key={node.id} value={node.id}>{node.name}</option>)}</select><Button size="sm" variant="ghost" onClick={() => onCopyOrphan?.(orphan)}>复制</Button></> : null}<Button size="sm" variant="ghost" onClick={() => onRepair?.(orphan)}>{orphan.additionId ? "删除附加内容" : "清除失效覆盖"}</Button></div>)}</div> : null}
    <LayerMenu onUnbind={onUnbind} composition={composition} page={page} selectedIds={selectedIds} target={menu} onClose={() => setMenu(null)} onAdd={(type, parentId, afterId) => { expand(parentId); onAdd(type, parentId, afterId); }} onDelete={onDelete}
      hasClipboard={hasClipboard} onCopy={onCopy} onPaste={(parentId, afterId) => { expand(parentId); onPaste(parentId, afterId); }} onRename={beginRename} onDuplicate={onDuplicate} onConvert={onConvert} onSaveToCanvas={onSaveToCanvas} onOpenSource={onOpenSource}
      onRestoreFocus={() => { if (renameInput.current) { renameInput.current.focus(); renameInput.current.select(); } else if (returnFocus.current?.isConnected) returnFocus.current.focus(); else panel.current?.focus(); }} />
  </aside>;
}
