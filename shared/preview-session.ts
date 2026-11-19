import type { GameFlowPage } from "./model";
import { radioGroupFor } from "./ui-parts";

/** Pure session edits: callers retain the authored page as reset baseline. */
export function previewControl(page: GameFlowPage, id: string, value?: number): GameFlowPage {
  const node = page.nodes.find(n => n.id === id);
  if (!node || node.widget?.disabled) return page;
  const group = node.type === "radio" ? radioGroupFor(page, id) : undefined;
  if (group?.widget?.disabled) return page;
  return { ...page, nodes: page.nodes.map(n => {
    if (n.id === group?.id) return { ...n, widget: { ...n.widget, selectedIndex: n.widget!.optionNodeIds!.indexOf(id) } };
    if (n.id !== id) return n;
    if (n.type === "checkbox" || n.type === "radio" && !group) return { ...n, widget: { ...n.widget, selected: n.type === "radio" || !n.widget?.selected } };
    if (["slider", "progress"].includes(n.type) && value !== undefined && Number.isFinite(value)) {
      const min = n.widget?.min ?? 0, max = n.widget?.max ?? 1;
      return { ...n, widget: { ...n.widget, value: Math.max(min, Math.min(max, value)) } };
    }
    return n;
  }) };
}
