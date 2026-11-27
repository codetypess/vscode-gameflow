import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { ArrowLeft, Camera, ChevronRight, CopyPlus, Focus, LayoutDashboard, LayoutPanelTop, Pencil, Plus, Trash2 } from "lucide-react";
import type { GameFlowPage, PageRootType } from "../../shared/model";
import { PAGE_ROOTS, PAGE_ROOT_TYPES } from "../../shared/ui-components";

export function CanvasViewItems({ onFit, onBack, backLabel = "返回总览" }: { onFit: () => void; onBack?: () => void; backLabel?: string }) {
  return <><Menu.Separator className="layer-menu-separator" />
    <Menu.Item onSelect={onFit}><Focus size={14} /><span>适应画布</span></Menu.Item>
    {onBack ? <Menu.Item onSelect={onBack}><ArrowLeft size={14} /><span>{backLabel}</span></Menu.Item> : null}
  </>;
}

export function CanvasOverviewMenu({ target, page, importPsdItem, pageActions, onClose, onRestoreFocus, onEnter, onRename, onSnapshot, savingSnapshot, onDuplicate, onDelete, onAddPage, onFit }: {
  target: { x: number; y: number } | null; page?: GameFlowPage;
  importPsdItem: ReactNode; pageActions: ReactNode;
  onClose: () => void; onRestoreFocus: () => void; onEnter: () => void; onRename: () => void;
  onSnapshot: (page: GameFlowPage) => void; savingSnapshot: boolean;
  onDuplicate: () => void; onDelete: () => void; onAddPage: (type: PageRootType) => void; onFit: () => void;
}) {
  const action = (run: () => void) => () => { onClose(); run(); };
  return <Menu.Root open={!!target} modal={false} onOpenChange={open => { if (!open) onClose(); }}>
    <Menu.Trigger tabIndex={-1} aria-hidden="true" className="layer-menu-anchor" style={{left:target?.x ?? 0,top:target?.y ?? 0}} />
    <Menu.Portal><Menu.Content loop side="bottom" align="start" sideOffset={0} collisionPadding={6} className="layer-context-menu" aria-label="画板右键菜单"
      onContextMenu={event=>event.preventDefault()} onPointerDown={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}
      onCloseAutoFocus={event=>{event.preventDefault();onRestoreFocus();}}>
      <Menu.Label className="menu-heading">{page?.name ?? "画布"}</Menu.Label>
      {page ? <>
        <Menu.Item onSelect={action(onEnter)}><LayoutPanelTop size={14}/><span>进入画板编辑</span></Menu.Item>
        <Menu.Item onSelect={action(onRename)}><Pencil size={14}/><span>重命名画板</span></Menu.Item>
        <Menu.Item disabled={savingSnapshot} onSelect={action(() => onSnapshot(page))}><Camera size={14}/><span>另存为 PNG 快照…</span></Menu.Item>
        <Menu.Separator className="layer-menu-separator" />
        {pageActions}
        <Menu.Separator className="layer-menu-separator" />
        <Menu.Item onSelect={action(onDuplicate)}><CopyPlus size={14}/><span>生成画板副本</span></Menu.Item>
        <Menu.Item className="delete-menu-item" onSelect={action(onDelete)}><Trash2 size={14}/><span>删除画板</span></Menu.Item>
        <Menu.Separator className="layer-menu-separator" />
      </> : null}
      <Menu.Sub><Menu.SubTrigger><Plus size={14}/><span>新建画板</span><ChevronRight size={14}/></Menu.SubTrigger>
        <Menu.Portal><Menu.SubContent loop sideOffset={2} alignOffset={-4} collisionPadding={6} className="layer-context-menu layer-context-submenu" aria-label="新建画板菜单"
          onContextMenu={event=>event.preventDefault()} onPointerDown={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
          {PAGE_ROOT_TYPES.map(type=>{const Icon=type === "UIBox" ? LayoutDashboard : LayoutPanelTop;return <Menu.Item key={type} onSelect={action(()=>onAddPage(type))}><Icon size={14}/><span>{PAGE_ROOTS[type].label} <small className="menu-class">({type})</small></span></Menu.Item>;})}
        </Menu.SubContent></Menu.Portal>
      </Menu.Sub>
      {!page && importPsdItem}
      <CanvasViewItems onFit={action(onFit)} />
    </Menu.Content></Menu.Portal>
  </Menu.Root>;
}
