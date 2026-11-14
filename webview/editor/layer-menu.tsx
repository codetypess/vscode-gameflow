import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowRightLeft, Check, ChevronRight, Copy, CopyPlus, Package, Pencil, ClipboardPaste, Plus, Trash2 } from "lucide-react";
import type { GameFlowPage } from "../../shared/model";
import { inheritedFlag, NODE_LABELS, type InsertType } from "../../shared/editor-ops";
import { COMPONENT_TOOLS } from "./component-tools";
import { canHaveChildren, COMPONENTS } from "../../shared/ui-components";
import { canConvertNodeType } from "../../shared/ui-edit";

export interface LayerMenuTarget { x: number; y: number; id: string | null }
const TYPES = COMPONENT_TOOLS;

export function LayerMenu({ page, target, onClose, onAdd, onDelete, onRestoreFocus, hasClipboard, onCopy, onPaste, onRename, onDuplicate, onConvert }: {
  page: GameFlowPage; target: LayerMenuTarget | null; onClose: () => void;
  onAdd: (type: InsertType, parentId?: string, afterId?: string) => void;
  onDelete: (id: string) => void; onRestoreFocus: () => void;
  hasClipboard: boolean; onCopy: (id: string) => void; onPaste: (parentId?: string, afterId?: string) => void;
  onRename: (id: string) => void; onDuplicate: (id: string) => void; onConvert: (id: string, type: InsertType) => void;
}) {
  const node = page.nodes.find((item) => item.id === target?.id);
  const container = node && canHaveChildren(node);
  const parentId = container ? node.id : node?.parentId;
  const parent = page.nodes.find((item) => item.id === parentId);
  const addDisabled = !!(parent && inheritedFlag(page, parent, "locked"));
  const deleteDisabled = !node || inheritedFlag(page, node, "locked");
  const addLabel = container ? "添加子节点" : node ? "添加同级节点" : "添加节点";
  const command = /Mac/.test(navigator.platform) ? "⌘" : "Ctrl+";
  const action = (run: () => void) => () => { run(); onClose(); };
  return <DropdownMenu.Root open={!!target} modal={false} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DropdownMenu.Trigger tabIndex={-1} aria-hidden="true" className="layer-menu-anchor" style={{ left: target?.x ?? 0, top: target?.y ?? 0 }} />
    <DropdownMenu.Portal><DropdownMenu.Content loop side="bottom" align="start" sideOffset={0} collisionPadding={6} className="layer-context-menu" aria-label="图层右键菜单"
      onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}
      onKeyDown={(event) => event.stopPropagation()}>
      <DropdownMenu.Label className="menu-heading">{parent?.name ?? page.name}</DropdownMenu.Label>
      {node ? <DropdownMenu.Item onSelect={action(() => onCopy(node.id))}><Copy size={14} /><span>复制</span><kbd>{command}C</kbd></DropdownMenu.Item> : null}
      <DropdownMenu.Item disabled={!hasClipboard || addDisabled} onSelect={action(() => onPaste(parentId, !container ? node?.id : undefined))}><ClipboardPaste size={14} /><span>粘贴</span><kbd>{command}V</kbd></DropdownMenu.Item>
      {node ? <><DropdownMenu.Separator className="layer-menu-separator" />
        <DropdownMenu.Item disabled={deleteDisabled} onSelect={action(() => onRename(node.id))}><Pencil size={14} /><span>重命名</span><kbd>F2</kbd></DropdownMenu.Item>
        <DropdownMenu.Item disabled={deleteDisabled} onSelect={action(() => onDuplicate(node.id))}><CopyPlus size={14} /><span>生成副本</span><kbd>{command}D</kbd></DropdownMenu.Item>
        <DropdownMenu.Item className="delete-menu-item" disabled={deleteDisabled} onSelect={action(() => onDelete(node.id))}><Trash2 size={14} /><span>删除{page.nodes.some((item) => item.parentId === node.id) ? "节点及子节点" : "节点"}</span><kbd>Delete</kbd></DropdownMenu.Item>
      </> : null}
      <DropdownMenu.Separator className="layer-menu-separator" />
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger disabled={addDisabled}><Plus size={14} /><span>{addLabel}</span><ChevronRight size={14} /></DropdownMenu.SubTrigger>
        <DropdownMenu.Portal><DropdownMenu.SubContent loop sideOffset={2} alignOffset={-4} collisionPadding={6} className="layer-context-menu layer-context-submenu" aria-label={`${addLabel}菜单`}
          onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()} onKeyDown={(event) => event.stopPropagation()}>
          {TYPES.map(({ type, icon: Icon }) => <DropdownMenu.Item key={type} onSelect={action(() => onAdd(type, parentId, !container ? node?.id : undefined))}><Icon size={14} /><span>{NODE_LABELS[type]} <small className="menu-class">({COMPONENTS[type].laya})</small></span></DropdownMenu.Item>)}
        </DropdownMenu.SubContent></DropdownMenu.Portal>
      </DropdownMenu.Sub>
      {node ? <><DropdownMenu.Separator className="layer-menu-separator" />
        <DropdownMenu.Sub><DropdownMenu.SubTrigger disabled={deleteDisabled || page.nodes.some((item) => item.parentId === node.id && item.locked)}><ArrowRightLeft size={14} /><span>转换节点类型</span><ChevronRight size={14} /></DropdownMenu.SubTrigger>
          <DropdownMenu.Portal><DropdownMenu.SubContent loop sideOffset={2} alignOffset={-4} collisionPadding={6} className="layer-context-menu layer-context-submenu" aria-label="转换节点类型菜单"
            onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()} onKeyDown={(event) => event.stopPropagation()}>
            {TYPES.map(({ type, icon: Icon }) => <DropdownMenu.Item key={type} disabled={!canConvertNodeType(page, node.id, type)} onSelect={action(() => onConvert(node.id, type))}><Icon size={14} /><span>{NODE_LABELS[type]} <small className="menu-class">({COMPONENTS[type].laya})</small></span>{node.type === type ? <Check size={14} /> : null}</DropdownMenu.Item>)}
          </DropdownMenu.SubContent></DropdownMenu.Portal>
        </DropdownMenu.Sub>
        <DropdownMenu.Item disabled title="尚未接入预制体资源与节点关联"><Package size={14} /><span>替换预制体</span><small>未接入</small></DropdownMenu.Item>
      </> : null}
      {addDisabled || (node && deleteDisabled) ? <div className="menu-hint">已锁定，请先在图层树中解锁</div> : null}
    </DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
