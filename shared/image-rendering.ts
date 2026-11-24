import type { GameFlowNode, GameFlowPage } from "./model";
import type { LayoutResult } from "./ui-layout";

export function rasterSize(width: number, height: number) {
  const scale = Math.min(1, 4096 / Math.max(1, width, height), Math.sqrt(8_000_000 / Math.max(1, width * height)));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Progress skins are authored at full size; value only clips their display. */
export function imageRenderSize(page: GameFlowPage, node: GameFlowNode, layout: LayoutResult) {
  const local = layout.nodes.get(node.id)!.local;
  const owner = page.nodes.find(n => n.type === "progress" && n.widget?.skinNodeId === node.id);
  const parent = owner && layout.nodes.get(owner.id);
  return { width: owner && parent ? Math.max(0, parent.local.width - (owner.layout?.paddingLeft ?? 0) - (owner.layout?.paddingRight ?? 0)) : local.width, height: local.height };
}
