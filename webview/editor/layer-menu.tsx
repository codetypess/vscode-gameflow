import { useRef } from "react";
import { Trash2 } from "lucide-react";
import type { GameFlowPage } from "../../shared/model";
import { inheritedFlag, NODE_LABELS, type InsertType } from "../../shared/editor-ops";
import { Popover, PopoverAnchor, PopoverContent } from "../components/ui/popover";
import { Separator } from "../components/ui/separator";
import { COMPONENT_TOOLS } from "./component-tools";
import { canHaveChildren, COMPONENTS } from "../../shared/ui-components";

export interface LayerMenuTarget { x: number; y: number; id: string | null }
const TYPES = COMPONENT_TOOLS;

export function LayerMenu({ page, target, onClose, onAdd, onDelete, onRestoreFocus }: {
  page: GameFlowPage; target: LayerMenuTarget | null; onClose: () => void;
  onAdd: (type: InsertType, parentId?: string, afterId?: string) => void;
  onDelete: (id: string) => void; onRestoreFocus: () => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const node = page.nodes.find((item) => item.id === target?.id);
  const container = node && canHaveChildren(node);
  const parentId = container ? node.id : node?.parentId;
  const parent = page.nodes.find((item) => item.id === parentId);
  const addDisabled = !!(parent && inheritedFlag(page, parent, "locked"));
  const deleteDisabled = !node || inheritedFlag(page, node, "locked");
  return <Popover open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
    <PopoverAnchor asChild><span className="layer-menu-anchor" style={{ left: target?.x ?? 0, top: target?.y ?? 0 }} /></PopoverAnchor>
    <PopoverContent ref={content} tabIndex={-1} side="bottom" align="start" sideOffset={0} collisionPadding={6} className="layer-context-menu" role="menu" aria-label="图层右键菜单"
      onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}
      onOpenAutoFocus={(event) => { event.preventDefault(); (content.current?.querySelector<HTMLButtonElement>("button:not(:disabled)") ?? content.current)?.focus(); }}
      onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const items = [...(content.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
        items[index]?.focus();
      }}>
      <div className="menu-heading">{container ? "添加子节点" : node ? "添加同级节点" : "添加节点"}<span>{parent?.name ?? page.name}</span></div>
      {TYPES.map(({ type, icon: Icon }) => <button key={type} role="menuitem" disabled={addDisabled} onClick={() => { onAdd(type, parentId, !container ? node?.id : undefined); onClose(); }}><Icon size={14} /><span>{NODE_LABELS[type]} <small className="menu-class">({COMPONENTS[type].laya})</small></span></button>)}
      {node ? <><Separator /><button role="menuitem" className="delete-menu-item" disabled={deleteDisabled} onClick={() => { onDelete(node.id); onClose(); }}><Trash2 size={14} /><span>删除{page.nodes.some((item) => item.parentId === node.id) ? "节点及子节点" : "节点"}</span><kbd>Delete</kbd></button></> : null}
      {addDisabled || (node && deleteDisabled) ? <div className="menu-hint">已锁定，请先在图层树中解锁</div> : null}
    </PopoverContent>
  </Popover>;
}
