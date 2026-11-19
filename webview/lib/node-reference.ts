import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { inheritedFlag } from "../../shared/editor-ops";
import { CONSTRAINTS } from "../../shared/ui-config";
import { radioGroupFor } from "../../shared/ui-parts";
import { searchLayers } from "./layer-search";

export type NodeReferenceKind = "skin" | "radioOption" | "textLabel";

/** Explain the existing binding contract without hiding the surrounding hierarchy. */
export function referenceUnavailableReason(page: GameFlowPage, owner: GameFlowNode, kind: NodeReferenceKind, currentId: string | null, targetId: string | null): string | undefined {
  if (inheritedFlag(page, owner, "locked")) return "正在设置的控件已锁定";
  const target = page.nodes.find(node => node.id === targetId);
  if (targetId && !target) return "节点已不存在";
  if (kind === "textLabel") {
    if (!target) return undefined;
    if (target.parentId !== owner.id || target.type !== "text") return "只能选择当前下拉框的直接 UILabel 子节点";
    return undefined;
  }
  if (kind === "skin") {
    if (!target) return undefined;
    if (target.parentId !== owner.id) return "只能选择该控件的直接子节点";
    if (owner.type === "progress" && target.type !== "image") return "进度填充需要 UIImage 子节点";
    if (["slider", "progress"].includes(owner.type) && CONSTRAINTS.some(key => target.layout?.[key] != null)) return "滑块节点不能设置相对约束";
    return undefined;
  }
  const current = page.nodes.find(node => node.id === currentId);
  if (targetId !== currentId && current && inheritedFlag(page, current, "locked")) return "当前成员已锁定，无法解除关联";
  if (!target) return undefined;
  if (target.type !== "radio") return "只能选择 UIRadio 节点";
  const group = radioGroupFor(page, target.id);
  if (target.id !== currentId && group) return group.id === owner.id ? "已用于本组的其他选项" : `已属于「${group.name}」`;
  return undefined;
}

export function nodeReferencePath(page: GameFlowPage, id: string): string {
  const byId = new Map(page.nodes.map(node => [node.id, node]));
  const names: string[] = [], seen = new Set<string>();
  let node = byId.get(id);
  while (node && !seen.has(node.id)) {
    seen.add(node.id); names.unshift(node.name);
    node = node.parentId ? byId.get(node.parentId) : undefined;
  }
  return [page.name, ...names].join(" / ");
}

export interface NodeReferenceRow { node: GameFlowNode; depth: number; hasChildren: boolean; expanded: boolean; position: number; size: number }

export function nodeReferenceRows(page: GameFlowPage, query: string, collapsed: ReadonlySet<string>): NodeReferenceRow[] {
  const { visible } = searchLayers(page, query);
  const children = new Map<string | undefined, GameFlowNode[]>();
  for (const node of page.nodes) {
    if (!visible.has(node.id)) continue;
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node); children.set(node.parentId, siblings);
  }
  const rows: NodeReferenceRow[] = [];
  const visit = (parentId: string | undefined, depth: number) => {
    const siblings = children.get(parentId) ?? [];
    siblings.forEach((node, index) => {
      const hasChildren = !!children.get(node.id)?.length, expanded = hasChildren && !collapsed.has(node.id);
      rows.push({ node, depth, hasChildren, expanded, position: index + 1, size: siblings.length });
      if (expanded) visit(node.id, depth + 1);
    });
  };
  visit(undefined, 0);
  return rows;
}
