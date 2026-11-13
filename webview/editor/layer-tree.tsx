import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, LockKeyhole, UnlockKeyhole, Type, ImageIcon, RectangleHorizontal, Box, MousePointerClick, X } from "lucide-react";
import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { inheritedFlag, moveNode, type InsertType, type LayerDrop } from "../../shared/editor-ops";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { LayerMenu, type LayerMenuTarget } from "./layer-menu";

export function NodeIcon({ type }: { type: string }) {
  const Icon = type === "text" ? Type : type === "image" ? ImageIcon : type === "button" ? MousePointerClick : type === "container" ? Box : RectangleHorizontal;
  return <Icon size={14} />;
}

interface TreeDrag { id: string; pointerId: number; x: number; y: number; active: boolean; drop: LayerDrop | null }

export function LayerTree({ page, selectedId, onSelect, onPatch, onBack, onAdd, onDelete, onMove }: {
  page: GameFlowPage; selectedId: string | null; onSelect: (id: string | null) => void;
  onPatch: (id: string, patch: Partial<GameFlowNode>) => void; onBack: () => void;
  onAdd: (type: InsertType, parentId?: string, afterId?: string) => void;
  onDelete: (id: string) => void; onMove: (id: string, drop: LayerDrop) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<LayerMenuTarget | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<LayerDrop | null>(null);
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<TreeDrag | null>(null);
  const suppressClick = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const toggle = (id: string) => setCollapsed((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const expand = (id?: string) => { if (id) setCollapsed((previous) => { const next = new Set(previous); next.delete(id); return next; }); };
  const cancelDrag = () => {
    const current = drag.current;
    drag.current = null; setDragging(null); setDrop(null);
    if (current && panel.current?.hasPointerCapture(current.pointerId)) panel.current.releasePointerCapture(current.pointerId);
  };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && drag.current) { event.preventDefault(); event.stopPropagation(); cancelDrag(); } };
    window.addEventListener("keydown", escape, true); window.addEventListener("blur", cancelDrag);
    return () => { window.removeEventListener("keydown", escape, true); window.removeEventListener("blur", cancelDrag); };
  }, []);
  useEffect(() => { if (menu?.id && !page.nodes.some((item) => item.id === menu.id)) setMenu(null); }, [page, menu]);

  const openMenu = (event: MouseEvent, id: string | null) => {
    event.preventDefault(); event.stopPropagation(); cancelDrag();
    onSelect(id);
    const row = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-layer-id], [data-layer-root]") : null;
    returnFocus.current = row?.querySelector<HTMLElement>(".layer-name") ?? row ?? panel.current;
    const bounds = row?.getBoundingClientRect();
    setMenu({ id, x: event.clientX || (bounds?.left ?? 16) + 20, y: event.clientY || (bounds?.bottom ?? 100) });
  };
  const hitDrop = (event: ReactPointerEvent): LayerDrop | null => {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || !panel.current?.contains(target)) return null;
    const row = target.closest<HTMLElement>("[data-layer-id]");
    if (!row) return target.closest("[data-layer-root]") ? { position: "inside" } : null;
    const node = page.nodes.find((item) => item.id === row.dataset.layerId);
    if (!node) return null;
    const bounds = row.getBoundingClientRect();
    const fraction = (event.clientY - bounds.top) / bounds.height;
    const container = ["container", "rectangle"].includes(node.type);
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
  const branch = (parentId: string | undefined, depth: number): React.ReactNode => page.nodes.filter((node) => node.parentId === parentId).map((node) => {
    const hasChildren = page.nodes.some((item) => item.parentId === node.id);
    const locked = inheritedFlag(page, node, "locked");
    return <div key={node.id}>
      <div role="treeitem" data-layer-id={node.id} aria-selected={selectedId === node.id} aria-expanded={hasChildren ? !collapsed.has(node.id) : undefined}
        className={cn("layer-row", selectedId === node.id && "is-selected", inheritedFlag(page, node, "hidden") && "is-muted", dragging === node.id && "layer-drag-source", dropClass(node.id))}
        style={{ paddingLeft: 8 + depth * 14 }} onContextMenu={(event) => openMenu(event, node.id)}>
        <button className="tree-chevron" aria-label={`${collapsed.has(node.id) ? "展开" : "折叠"}${node.name}`} disabled={!hasChildren} onClick={() => toggle(node.id)}>
          {hasChildren ? collapsed.has(node.id) ? <ChevronRight size={12} /> : <ChevronDown size={12} /> : null}
        </button>
        <button className={cn("layer-name", !locked && "layer-draggable")} aria-haspopup="menu" title={`${node.name}${locked ? " · 已锁定" : " · 拖动排序或移入容器，右键添加/删除"}`}
          onPointerDown={(event) => {
            suppressClick.current = false;
            if (event.button !== 0 || menu || locked) return;
            onSelect(node.id); drag.current = { id: node.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false, drop: null };
          }} onClick={() => { if (!suppressClick.current) onSelect(node.id); }}><NodeIcon type={node.type} /><span>{node.name}</span></button>
        <button className="layer-action" aria-label={`${node.hidden ? "显示" : "隐藏"}${node.name}`} onClick={() => onPatch(node.id, { hidden: !node.hidden })}>{node.hidden ? <EyeOff size={12} /> : <Eye size={12} />}</button>
        <button className="layer-action" aria-label={`${node.locked ? "解锁" : "锁定"}${node.name}`} onClick={() => onPatch(node.id, { locked: !node.locked })}>{node.locked ? <LockKeyhole size={12} /> : <UnlockKeyhole size={12} />}</button>
      </div>
      {hasChildren && !collapsed.has(node.id) ? <div role="group">{branch(node.id, depth + 1)}</div> : null}
    </div>;
  });
  return <aside ref={panel} tabIndex={-1} className={cn("layer-panel floating-panel", dragging && "layer-dragging")} aria-label="控件层级树"
    onPointerDownCapture={() => { if (!drag.current?.active) suppressClick.current = false; }}
    onPointerDown={(event) => event.stopPropagation()} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
    onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
    <div className="floating-heading"><strong>图层</strong><span>{page.nodes.length}</span><Button variant="ghost" size="icon" aria-label="返回总览" onClick={onBack}><X size={14} /></Button></div>
    <button data-layer-root className={cn("tree-root", !selectedId && "is-selected", dropClass())} aria-haspopup="menu" onContextMenu={(event) => openMenu(event, null)} onClick={() => onSelect(null)}><Box size={15} /><strong>{page.name}</strong><small>页面</small></button>
    <div role="tree" aria-label={page.name} data-layer-root className="layer-tree" onContextMenu={(event) => openMenu(event, null)}>{branch(undefined, 0)}{page.nodes.length === 0 ? <p className="empty-layers">右键添加节点<br />或用底部工具条点击放置</p> : null}
      <div className={cn("tree-root-drop", drop && !drop.targetId && "layer-drop-inside")} data-layer-root>{dragging ? "移到页面根节点" : ""}</div>
    </div>
    <div className="layer-footer">右键添加/删除 · 拖动调整层级</div>
    <LayerMenu page={page} target={menu} onClose={() => setMenu(null)} onAdd={(type, parentId, afterId) => { expand(parentId); onAdd(type, parentId, afterId); }} onDelete={onDelete}
      onRestoreFocus={() => { if (returnFocus.current?.isConnected) returnFocus.current.focus(); else panel.current?.focus(); }} />
  </aside>;
}
