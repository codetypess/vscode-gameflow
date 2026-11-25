import { orderedNodes } from "./editor-ops";
import type { GameFlowNode, GameFlowPage } from "./model";

export function excludedPrefabNodeIds(page: GameFlowPage) {
  const excluded = new Set<string>();
  for (const node of orderedNodes(page)) {
    if (node.id === page.componentRootId) continue;
    if (node.exportEnabled === false || (node.parentId && excluded.has(node.parentId))) excluded.add(node.id);
  }
  return excluded;
}

function omitControlReferences(node: GameFlowNode, excluded: ReadonlySet<string>): GameFlowNode {
  const widget = node.widget;
  if (!widget) return node;
  const { skinNodeId, textLabelNodeId, optionNodeIds, selectedIndex } = widget;
  const exclude = (id?: string | null) => !!id && excluded.has(id);
  const excludesOption = optionNodeIds?.some(exclude);
  if (!exclude(skinNodeId) && !exclude(textLabelNodeId) && !excludesOption) return node;
  return { ...node, widget: {
    ...widget,
    ...(exclude(skinNodeId) ? { skinNodeId: null } : {}),
    ...(exclude(textLabelNodeId) ? { textLabelNodeId: null } : {}),
    ...(excludesOption ? { optionNodeIds: optionNodeIds!.map(id => exclude(id) ? null : id),
      ...(exclude(optionNodeIds![selectedIndex ?? -1]) ? { selectedIndex: -1 } : {}) } : {})
  } };
}

export function prefabExportPage(page: GameFlowPage, excluded = excludedPrefabNodeIds(page)): GameFlowPage {
  if (!excluded.size || !page.nodes.some(node => excluded.has(node.id))) return page;
  return { ...page, nodes: page.nodes.filter(node => !excluded.has(node.id)).map(node => omitControlReferences(node, excluded)) };
}
