import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, LockKeyhole, UnlockKeyhole, Box, Search, X } from "lucide-react";
import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { inheritedFlag, moveNode, type InsertType, type LayerDrop } from "../../shared/editor-ops";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { LayerMenu, type LayerMenuTarget } from "./layer-menu";
import { COMPONENT_TOOLS } from "./component-tools";
import { canHaveChildren, pageRootType } from "../../shared/ui-components";
import { searchLayers } from "../lib/layer-search";

export function NodeIcon({ type }: { type: string }) {
  const Icon = COMPONENT_TOOLS.find((item) => item.type === type)?.icon ?? Box;
  return <Icon size={14} />;
}

interface TreeDrag { id: string; pointerId: number; x: number; y: number; active: boolean; drop: LayerDrop | null }

export function LayerTree({ page, selectedId, reveal, onSelect, onPatch, onBack, onAdd, onDelete, onMove, panelRef, panelStyle, hasClipboard, onCopy, onPaste, onDuplicate, onConvert }: {
  page: GameFlowPage; selectedId: string | null; reveal: number; onSelect: (id: string | null) => void;
  panelRef?: (element: HTMLElement | null) => void; panelStyle?: CSSProperties;
  onPatch: (id: string, patch: Partial<GameFlowNode>) => void; onBack: () => void;
  onAdd: (type: InsertType, parentId?: string, afterId?: string) => void;
  onDelete: (id: string) => void; onMove: (id: string, drop: LayerDrop) => void;
  hasClipboard: boolean; onCopy: (id: string) => void; onPaste: (parentId?: string, afterId?: string) => void;
  onDuplicate: (id: string) => void; onConvert: (id: string, type: InsertType) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [searchCollapsed, setSearchCollapsed] = useState<Set<string>>(new Set());
  const searchInput = useRef<HTMLInputElement | null>(null);
  const filtering = !!query.trim();
  const { matches, visible } = searchLayers(page, query);
  const activeCollapsed = filtering ? searchCollapsed : collapsed;
  const [menu, setMenu] = useState<LayerMenuTarget | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<LayerDrop | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const renameInput = useRef<HTMLInputElement | null>(null);
  const renameCancelled = useRef(false);
  const panel = useRef<HTMLElement | null>(null);
  const revealed = useRef(reveal);
  const attachPanel = useCallback((element: HTMLElement | null) => { panel.current = element; panelRef?.(element); }, [panelRef]);
  const drag = useRef<TreeDrag | null>(null);
  const suppressClick = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const setActiveCollapsed = filtering ? setSearchCollapsed : setCollapsed;
  const toggle = (id: string) => setActiveCollapsed((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const expand = (id?: string) => { if (id) setActiveCollapsed((previous) => { const next = new Set(previous); next.delete(id); return next; }); };
  const cancelDrag = () => {
    const current = drag.current;
    drag.current = null; setDragging(null); setDrop(null);
    if (current && panel.current?.hasPointerCapture(current.pointerId)) panel.current.releasePointerCapture(current.pointerId);
  };
  const changeQuery = (value: string) => {
    cancelDrag(); setMenu(null); setQuery(value); setSearchCollapsed(new Set());
    const tree = panel.current?.querySelector<HTMLElement>(".layer-tree");
    if (tree) tree.scrollTop = 0;
  };
  const clearSearch = () => { changeQuery(""); searchInput.current?.focus(); };
  // Keep the request pending across filter/expansion commits, then leave manual scrolling alone.
  useLayoutEffect(() => {
    if (revealed.current === reveal) return;
    const node = page.nodes.find((item) => item.id === selectedId);
    if (!node) { revealed.current = reveal; return; }
    if (filtering && !visible.has(node.id)) { setQuery(""); setSearchCollapsed(new Set()); return; }
    const ancestors = new Set<string>();
    let parentId = node.parentId;
    while (parentId && !ancestors.has(parentId)) {
      ancestors.add(parentId);
      parentId = page.nodes.find((item) => item.id === parentId)?.parentId;
    }
    if ([...activeCollapsed].some((id) => ancestors.has(id))) {
      setActiveCollapsed(new Set([...activeCollapsed].filter((id) => !ancestors.has(id))));
      return;
    }
    const tree = panel.current?.querySelector<HTMLElement>(".layer-tree");
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
    onSelect(id);
    const row = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-layer-id], [data-layer-root]") : null;
    returnFocus.current = row?.querySelector<HTMLElement>(".layer-name") ?? row ?? panel.current;
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
    const scrollArea = panel.current?.querySelector<HTMLElement>(".layer-tree");
    const bounds = scrollArea?.getBoundingClientRect();
    if (scrollArea && bounds && event.clientX >= bounds.left && event.clientX <= bounds.right) {
      if (event.clientY < bounds.top + 18) scrollArea.scrollTop -= 8;
      if (event.clientY > bounds.bottom - 18) scrollArea.scrollTop += 8;
    }
    const next = hitDrop(event);
    current.drop = next && moveNode(page, current.id, next) !== page ? next : null;
    setDrop(current.drop);
  };
  const pointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const target = current.active ? hitDrop(event) : null;
    if (target && moveNode(page, current.id, target) !== page) {
      onMove(current.id, target); onSelect(current.id);
      expand(target.position === "inside" ? target.targetId : page.nodes.find((item) => item.id === target.targetId)?.parentId);
    }
    cancelDrag();
  };
  const dropClass = (id?: string) => drop && drop.targetId === id ? `layer-drop-${drop.position}` : undefined;
  const branch = (parentId: string | undefined, depth: number): React.ReactNode => page.nodes.filter((node) => node.parentId === parentId && visible.has(node.id)).map((node) => {
    const hasChildren = page.nodes.some((item) => item.parentId === node.id && visible.has(item.id));
    const locked = inheritedFlag(page, node, "locked");
    return <div key={node.id}>
      <div role="treeitem" data-layer-id={node.id} aria-selected={selectedId === node.id} aria-expanded={hasChildren ? !activeCollapsed.has(node.id) : undefined}
        className={cn("layer-row", filtering && matches.has(node.id) && "layer-search-match", selectedId === node.id && "is-selected", inheritedFlag(page, node, "hidden") && "is-muted", dragging === node.id && "layer-drag-source", dropClass(node.id))}
        style={{ paddingLeft: 8 + depth * 10 }} onContextMenu={(event) => openMenu(event, node.id)}>
        <button className="tree-chevron" aria-label={`${activeCollapsed.has(node.id) ? "展开" : "折叠"}${node.name}`} disabled={!hasChildren} onClick={() => toggle(node.id)}>
          {hasChildren ? activeCollapsed.has(node.id) ? <ChevronRight size={12} /> : <ChevronDown size={12} /> : null}
        </button>
        {renaming?.id === node.id ? <input ref={renameInput} className="layer-rename" aria-label="节点名称" value={renaming.value}
          onChange={(event) => setRenaming({ id: node.id, value: event.target.value })} onBlur={finishRename}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
            else if (event.key === "Escape") { event.preventDefault(); renameCancelled.current = true; event.currentTarget.blur(); }
          }} /> : <button className={cn("layer-name", !locked && !filtering && "layer-draggable")} aria-haspopup="menu" title={`${node.name}${node.variableName ? ` · 变量：${node.variableName}` : ""}${locked ? " · 已锁定" : filtering ? " · 右键编辑，清除搜索后可拖动排序" : " · 拖动排序或移入容器，右键编辑"}`}
          onPointerDown={(event) => {
            suppressClick.current = false;
            if (event.button !== 0 || menu || locked || filtering) return;
            onSelect(node.id); drag.current = { id: node.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false, drop: null };
          }} onClick={() => { if (!suppressClick.current) onSelect(node.id); }}><NodeIcon type={node.type} /><span>{node.name}</span>{node.variableName ? <code className="layer-variable" title={`变量：${node.variableName}`}>{node.variableName}</code> : null}</button>}
        <button className="layer-action" aria-label={`${node.hidden ? "显示" : "隐藏"}${node.name}`} onClick={() => onPatch(node.id, { hidden: !node.hidden })}>{node.hidden ? <EyeOff size={12} /> : <Eye size={12} />}</button>
        <button className="layer-action" aria-label={`${node.locked ? "解锁" : "锁定"}${node.name}`} onClick={() => onPatch(node.id, { locked: !node.locked })}>{node.locked ? <LockKeyhole size={12} /> : <UnlockKeyhole size={12} />}</button>
      </div>
      {hasChildren && !activeCollapsed.has(node.id) ? <div role="group">{branch(node.id, depth + 1)}</div> : null}
    </div>;
  });
  return <aside ref={attachPanel} style={panelStyle} tabIndex={-1} className={cn("layer-panel floating-panel", dragging && "layer-dragging")} aria-label="控件层级树"
    onKeyDown={(event) => { if (event.key === "F2" && selectedId && !renaming && !menu && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); event.stopPropagation(); beginRename(selectedId); } }}
    onPointerDownCapture={() => { if (!drag.current?.active) suppressClick.current = false; }}
    onPointerDown={(event) => event.stopPropagation()} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
    onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
    <div className="floating-heading"><strong>图层</strong><span aria-live="polite">{filtering ? `${matches.size}/${page.nodes.length}` : page.nodes.length}</span><Button variant="ghost" size="icon" aria-label="返回总览" onClick={onBack}><X size={14} /></Button></div>
    <div className="layer-search"><Search size={13} aria-hidden="true" /><input ref={searchInput} type="search" aria-label="搜索图层" placeholder="搜索名称、变量、类型或 ID" value={query}
      onChange={(event) => changeQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); clearSearch(); } }} />
      {query ? <button aria-label="清除图层搜索" title="清除搜索 (Esc)" onClick={clearSearch}><X size={12} /></button> : null}
    </div>
    <button data-layer-root className={cn("tree-root", !selectedId && "is-selected", dropClass())} aria-haspopup="menu" onContextMenu={(event) => openMenu(event, null)} onClick={() => onSelect(null)}><Box size={15} /><strong>{page.name}</strong><small>{pageRootType(page)}</small></button>
    <div role="tree" aria-label={page.name} data-layer-root className="layer-tree" onContextMenu={(event) => openMenu(event, null)}>{branch(undefined, 0)}{filtering && !matches.size ? <p className="empty-layers" role="status">没有匹配的图层</p> : page.nodes.length === 0 ? <p className="empty-layers">右键添加节点<br />或用底部工具条点击放置</p> : null}
      <div className={cn("tree-root-drop", drop && !drop.targetId && "layer-drop-inside")} data-layer-root>{dragging ? "移到页面根节点" : ""}</div>
    </div>
    <div className="layer-footer">{filtering ? "搜索中 · 清除搜索后可拖动排序" : "右键编辑节点 · 拖动调整层级"}</div>
    <LayerMenu page={page} target={menu} onClose={() => setMenu(null)} onAdd={(type, parentId, afterId) => { expand(parentId); onAdd(type, parentId, afterId); }} onDelete={onDelete}
      hasClipboard={hasClipboard} onCopy={onCopy} onPaste={(parentId, afterId) => { expand(parentId); onPaste(parentId, afterId); }} onRename={beginRename} onDuplicate={onDuplicate} onConvert={onConvert}
      onRestoreFocus={() => { if (renameInput.current) { renameInput.current.focus(); renameInput.current.select(); } else if (returnFocus.current?.isConnected) returnFocus.current.focus(); else panel.current?.focus(); }} />
  </aside>;
}
