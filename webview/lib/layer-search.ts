import type { GameFlowPage } from "../../shared/model";
import { COMPONENTS } from "../../shared/ui-components";

/** Keep direct matches and their ancestor paths, without adding unrelated children. */
export function searchLayers(page: GameFlowPage, query: string): { matches: Set<string>; visible: Set<string> } {
  const term = query.trim().toLowerCase();
  const matches = new Set(page.nodes.filter((node) => {
    const component = COMPONENTS[node.type];
    return [node.name, node.variableName ?? "", node.id, node.type, component.label, component.laya].some((value) => value.toLowerCase().includes(term));
  }).map((node) => node.id));
  const visible = new Set<string>();
  const byId = new Map(page.nodes.map((node) => [node.id, node]));
  for (const id of matches) {
    let node = byId.get(id);
    while (node && !visible.has(node.id)) {
      visible.add(node.id);
      node = node.parentId ? byId.get(node.parentId) : undefined;
    }
  }
  return { matches, visible };
}
