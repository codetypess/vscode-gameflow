import type { GameFlowNode, GameFlowPage } from "./model";
import { CONSTRAINTS } from "./ui-config";

export const NODE_SKIN_TYPES = ["checkbox", "radio", "slider"] as const;
export const supportsNodeSkin = (node: Pick<GameFlowNode, "type">) => NODE_SKIN_TYPES.some(type => type === node.type);
export const hasNodeSkin = (node: GameFlowNode) => supportsNodeSkin(node) && node.widget?.skinNodeId !== undefined;
export function skinOwner(page: GameFlowPage, node: GameFlowNode): GameFlowNode | undefined {
  return page.nodes.find(parent => parent.id === node.parentId && supportsNodeSkin(parent) && parent.widget?.skinNodeId === node.id);
}
export const sliderOwner = (page: GameFlowPage, node: GameFlowNode) => {
  const owner = skinOwner(page, node); return owner?.type === "slider" ? owner : undefined;
};
export const radioGroupFor = (page: GameFlowPage, id: string) => page.nodes.find(node => node.type === "radioGroup" && node.widget?.optionNodeIds?.includes(id));
export function controlSelected(page: GameFlowPage, node: GameFlowNode): boolean {
  const group = node.type === "radio" ? radioGroupFor(page, node.id) : undefined;
  return group ? group.widget?.optionNodeIds?.[group.widget?.selectedIndex ?? -1] === node.id : node.widget?.selected ?? false;
}

/** Runtime-owned visibility is derived, never persisted into a skin's hidden flag. */
export function controlHidden(page: GameFlowPage, node: GameFlowNode): boolean {
  const seen = new Set<string>();
  let current: GameFlowNode | undefined = node;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const owner = skinOwner(page, current);
    if (owner && (owner.type === "checkbox" || owner.type === "radio")) {
      if (!controlSelected(page, owner)) return true;
    } else if (current.hidden) return true;
    const parentId: string | undefined = current.parentId;
    current = page.nodes.find(item => item.id === parentId);
  }
  return false;
}

export function validateControlReferences(page: GameFlowPage, errors: string[]): void {
  const byId = new Map(page.nodes.map(node => [node.id, node]));
  const memberships = new Map<string, string>();
  for (const node of page.nodes) {
    const skinId = node.widget?.skinNodeId;
    if (skinId) {
      const skin = byId.get(skinId);
      if (!skin || skin.parentId !== node.id) errors.push(`node ${node.id} skinNodeId must reference a direct child`);
      else if (node.type === "slider" && CONSTRAINTS.some(key => skin.layout?.[key] != null)) errors.push(`node ${node.id} slider skin must not have relative constraints`);
    }
    if (node.type !== "radioGroup") continue;
    const options = node.widget?.optionNodeIds ?? [], index = node.widget?.selectedIndex ?? -1;
    if (index >= options.length || (index >= 0 && !options[index])) errors.push(`node ${node.id} selectedIndex must reference a non-empty radio option or -1`);
    for (const id of options) {
      if (!id) continue;
      if (byId.get(id)?.type !== "radio") errors.push(`node ${node.id} option ${id} must reference a radio in this page`);
      if (memberships.has(id)) errors.push(`radio ${id} is repeated in groups ${memberships.get(id)} and ${node.id}`);
      memberships.set(id, node.id);
    }
  }
}

/** Copies only references inside the copied identity scope. */
export function remapControlReferences(node: GameFlowNode, ids: Map<string, string>): GameFlowNode {
  const widget = node.widget;
  if (!widget || (widget.skinNodeId === undefined && widget.optionNodeIds === undefined)) return node;
  const next = { ...widget };
  if (widget.skinNodeId !== undefined) next.skinNodeId = widget.skinNodeId ? ids.get(widget.skinNodeId) ?? null : null;
  if (widget.optionNodeIds !== undefined) {
    next.optionNodeIds = widget.optionNodeIds.map(id => id ? ids.get(id) ?? null : null);
    if (!next.optionNodeIds[next.selectedIndex ?? -1]) next.selectedIndex = -1;
  }
  return { ...node, widget: next };
}

function locked(page: GameFlowPage, node: GameFlowNode): boolean {
  const seen = new Set<string>();
  let current: GameFlowNode | undefined = node;
  while (current && !seen.has(current.id)) {
    if (current.locked) return true;
    seen.add(current.id);
    const parentId: string | undefined = current.parentId;
    current = page.nodes.find(item => item.id === parentId);
  }
  return false;
}

/** Structural edits detach invalidated bindings in the same undo transaction. */
export function reconcileControlReferences(before: GameFlowPage, after: GameFlowPage): GameFlowPage {
  const byId = new Map(after.nodes.map(node => [node.id, node]));
  const nodes = after.nodes.map(node => {
    const widget = { ...node.widget };
    if (widget.skinNodeId !== undefined) {
      if (!supportsNodeSkin(node)) delete widget.skinNodeId;
      else if (widget.skinNodeId) {
        const skin = byId.get(widget.skinNodeId);
        if (skin?.parentId !== node.id || (node.type === "slider" && CONSTRAINTS.some(key => skin?.layout?.[key] != null))) widget.skinNodeId = null;
      }
    }
    if (widget.optionNodeIds !== undefined) {
      if (node.type !== "radioGroup") { delete widget.optionNodeIds; delete widget.selectedIndex; }
      else {
        widget.optionNodeIds = widget.optionNodeIds.map(id => id && byId.get(id)?.type === "radio" ? id : null);
        if (!widget.optionNodeIds[widget.selectedIndex ?? -1]) widget.selectedIndex = -1;
      }
    }
    const old = before.nodes.find(item => item.id === node.id);
    if (node.type === "radio" && old && radioGroupFor(before, node.id) && !after.nodes.some(group => group.type === "radioGroup" && group.widget?.optionNodeIds?.includes(node.id))) widget.selected = controlSelected(before, old);
    return JSON.stringify(widget) === JSON.stringify(node.widget ?? {}) ? node : { ...node, widget };
  });
  if (nodes.some((node, i) => node !== after.nodes[i] && before.nodes.some(old => old.id === node.id && locked(before, old)))) return before;
  return { ...after, nodes };
}

export function setControlSelection(page: GameFlowPage, id: string, selected: boolean): GameFlowPage {
  const node = page.nodes.find(item => item.id === id);
  if (!node || locked(page, node)) return page;
  const group = node.type === "radio" ? radioGroupFor(page, id) : undefined;
  if (group && locked(page, group)) return page;
  const selectedIndex = group ? selected ? group.widget!.optionNodeIds!.indexOf(id) : controlSelected(page, node) ? -1 : group.widget?.selectedIndex ?? -1 : -1;
  return { ...page, nodes: page.nodes.map(item => item.id === (group?.id ?? id) ? {
    ...item, widget: { ...item.widget, ...(group ? { selectedIndex } : { selected }) }
  } : item) };
}

export function setRadioOptions(page: GameFlowPage, id: string, options: (string | null)[]): GameFlowPage {
  const group = page.nodes.find(node => node.id === id && node.type === "radioGroup");
  if (!group || locked(page, group)) return page;
  const selected = group.widget?.optionNodeIds?.[group.widget?.selectedIndex ?? -1];
  const after = { ...page, nodes: page.nodes.map(node => node.id === id ? { ...node, widget: { ...node.widget, optionNodeIds: options, selectedIndex: selected ? options.indexOf(selected) : -1 } } : node) };
  const errors: string[] = []; validateControlReferences(after, errors);
  return errors.length ? page : reconcileControlReferences(page, after);
}
