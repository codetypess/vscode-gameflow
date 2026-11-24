import type { CanvasComposition } from "../../shared/canvas-instances";
import type { ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowRightLeft, Check, ChevronRight, Copy, CopyPlus, Package, Pencil, ClipboardPaste, Plus, Trash2 } from "lucide-react";
import type { GameFlowPage } from "../../shared/model";
import { inheritedFlag, NODE_LABELS, type InsertType } from "../../shared/editor-ops";
import { COMPONENT_TOOLS } from "./component-tools";
import { canHaveChildren, COMPONENTS } from "../../shared/ui-components";
import { canConvertNodeType } from "../../shared/ui-edit";
import { selectionRoots } from "../../shared/selection-ops";
import { canvasExtractionIssue } from "../../shared/canvas-references";
import { useSliceResources } from "../runtime/resource-context";

export interface LayerMenuTarget { x: number; y: number; id: string | null }
const TYPES = COMPONENT_TOOLS;

export function LayerMenu({ page, selectedIds, target, onClose, onAdd, onDelete, onRestoreFocus, hasClipboard, onCopy, onPaste, onRename, onDuplicate, onConvert, onSaveToCanvas, onOpenSource, onUnbind, composition, backgroundParentId, menuLabel = "图层右键菜单", children }: {
  backgroundParentId?: string; menuLabel?: string; children?: ReactNode;
  onUnbind?: (id: string, recursive: boolean) => void;
  composition?: CanvasComposition;
  page: GameFlowPage; target: LayerMenuTarget | null; onClose: () => void;
  selectedIds: string[];
  onAdd: (type: InsertType, parentId?: string, afterId?: string) => void;
  onDelete: (id: string) => void; onRestoreFocus: () => void;
  hasClipboard: boolean; onCopy: (id: string) => void; onPaste: (parentId?: string, afterId?: string) => void;
  onRename: (id: string) => void; onDuplicate: (id: string) => void; onConvert: (id: string, type: InsertType) => void;
  onSaveToCanvas: (id: string) => void; onOpenSource: (id: string) => void;
}) {
  const resources = useSliceResources();
  const node = page.nodes.find((item) => item.id === target?.id);
  const meta = node ? composition?.info.get(node.id) : undefined;
  const protectedStructure = multiProtected();
  function multiProtected() { return !!node && (selectedIds.includes(node.id) ? selectedIds : [node.id]).some(id => composition?.info.get(id)?.inherited); }
  const container = node && canHaveChildren(node);
  const parentId = node ? container ? node.id : node.parentId : backgroundParentId;
  const parent = page.nodes.find((item) => item.id === parentId);
  const addDisabled = !!(parent && inheritedFlag(page, parent, "locked"));
  const multi = !!node && selectedIds.includes(node.id) && selectedIds.length > 1;
  const deleteDisabled = protectedStructure || !node || (multi ? selectionRoots(page, selectedIds).some(item => inheritedFlag(page, item, "locked")) : inheritedFlag(page, node, "locked"));
  const addLabel = container || (!node && parent) ? "添加子节点" : node ? "添加同级节点" : "添加节点";
  const command = /Mac/.test(navigator.platform) ? "⌘" : "Ctrl+";
  const action = (run: () => void) => () => { run(); onClose(); };
  return <DropdownMenu.Root open={!!target} modal={false} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DropdownMenu.Trigger tabIndex={-1} aria-hidden="true" className="layer-menu-anchor" style={{ left: target?.x ?? 0, top: target?.y ?? 0 }} />
    <DropdownMenu.Portal><DropdownMenu.Content loop side="bottom" align="start" sideOffset={0} collisionPadding={6} className="layer-context-menu" aria-label={menuLabel}
      onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}
      onKeyDown={(event) => event.stopPropagation()}>
      <DropdownMenu.Label className="menu-heading">{parent?.name ?? page.name}</DropdownMenu.Label>
      {node ? <DropdownMenu.Item onSelect={action(() => onCopy(node.id))}><Copy size={14} /><span>复制</span><kbd>{command}C</kbd></DropdownMenu.Item> : null}
      <DropdownMenu.Item disabled={!hasClipboard || addDisabled} onSelect={action(() => onPaste(parentId, !container ? node?.id : undefined))}><ClipboardPaste size={14} /><span>粘贴</span><kbd>{command}V</kbd></DropdownMenu.Item>
      {node ? <><DropdownMenu.Separator className="layer-menu-separator" />
        <DropdownMenu.Item disabled={!node || inheritedFlag(page,node,"locked") || multi} onSelect={action(() => onRename(node.id))}><Pencil size={14} /><span>重命名</span><kbd>F2</kbd></DropdownMenu.Item>
        <DropdownMenu.Item disabled={!node || inheritedFlag(page,node,"locked")} onSelect={action(() => onDuplicate(node.id))}><CopyPlus size={14} /><span>生成副本</span><kbd>{command}D</kbd></DropdownMenu.Item>
        <DropdownMenu.Item className="delete-menu-item" disabled={deleteDisabled} onSelect={action(() => onDelete(node.id))}><Trash2 size={14} /><span>{multi ? `删除 ${selectedIds.length} 个节点` : `删除${page.nodes.some((item) => item.parentId === node.id) ? "节点及子节点" : "节点"}`}</span><kbd>Delete</kbd></DropdownMenu.Item>
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
        <DropdownMenu.Sub><DropdownMenu.SubTrigger disabled={deleteDisabled || !!meta?.reference || multi || page.nodes.some((item) => item.parentId === node.id && item.locked)}><ArrowRightLeft size={14} /><span>转换节点类型</span><ChevronRight size={14} /></DropdownMenu.SubTrigger>
          <DropdownMenu.Portal><DropdownMenu.SubContent loop sideOffset={2} alignOffset={-4} collisionPadding={6} className="layer-context-menu layer-context-submenu" aria-label="转换节点类型菜单"
            onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()} onKeyDown={(event) => event.stopPropagation()}>
            {TYPES.map(({ type, icon: Icon }) => <DropdownMenu.Item key={type} disabled={!canConvertNodeType(page, node.id, type)} onSelect={action(() => onConvert(node.id, type))}><Icon size={14} /><span>{NODE_LABELS[type]} <small className="menu-class">({COMPONENTS[type].laya})</small></span>{node.type === type ? <Check size={14} /> : null}</DropdownMenu.Item>)}
          </DropdownMenu.SubContent></DropdownMenu.Portal>
        </DropdownMenu.Sub>
        {onUnbind ? <DropdownMenu.Sub><DropdownMenu.SubTrigger><Package size={14} /><span>原型组件</span><ChevronRight size={14} /></DropdownMenu.SubTrigger>
          <DropdownMenu.Portal><DropdownMenu.SubContent loop sideOffset={2} collisionPadding={6} className="layer-context-menu layer-context-submenu" aria-label="原型组件菜单" onPointerDown={event => event.stopPropagation()} onContextMenu={event => event.preventDefault()} onKeyDown={event => event.stopPropagation()}>
            <DropdownMenu.Item disabled={multi || !meta?.reference || !!meta.inherited || inheritedFlag(page,node,"locked") || !!meta.added} onSelect={action(() => onUnbind(node.id, false))}>解除当前等级的原型组件绑定</DropdownMenu.Item>
            <DropdownMenu.Item disabled={multi || !meta?.reference || !!meta.inherited || inheritedFlag(page,node,"locked") || !!meta.added} onSelect={action(() => onUnbind(node.id, true))}>解除全部（包含嵌套）原型组件绑定</DropdownMenu.Item>
          </DropdownMenu.SubContent></DropdownMenu.Portal>
        </DropdownMenu.Sub> : null}
        {meta?.inherited || meta?.reference || node.prefab ? <DropdownMenu.Item onSelect={action(() => onOpenSource(node.id))}><Package size={14} /><span>编辑源组件</span></DropdownMenu.Item> : <>
          <DropdownMenu.Item disabled={multi || !!meta?.inherited || !!canvasExtractionIssue(page, node.id, resources.sizes)} title={canvasExtractionIssue(page, node.id, resources.sizes) ?? "保存为组件并保留关联引用"} onSelect={action(() => onSaveToCanvas(node.id))}><Package size={14} /><span>存到画布</span></DropdownMenu.Item>
          {canvasExtractionIssue(page, node.id, resources.sizes) ? <div className="menu-hint">{canvasExtractionIssue(page, node.id, resources.sizes)}</div> : null}
        </>}
      </> : null}
      {protectedStructure ? <div className="menu-hint">源组件节点不能删除、剪切、换父或转换类型；可隐藏或编辑源组件。</div> : null}
      {addDisabled || (node && deleteDisabled && !protectedStructure) ? <div className="menu-hint">已锁定，请先在图层树中解锁</div> : null}
      {children}
    </DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
