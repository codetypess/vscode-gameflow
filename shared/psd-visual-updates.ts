import type { CanvasSources } from "./canvas-references";
import { listCellPositions, resolveCellPage } from "./list-cell";
import type { GameFlowDocument, GameFlowPage } from "./model";
import type { PsdVisualUpdate, SyncNode } from "./page-sync";
import { isPreviousDefaultSlice } from "./psd-builtin";
import type { PsdAsset } from "./psd-meta";
import { prototypeLayerRef } from "./psd-prototype";
import { resolvePageLayout } from "./ui-layout";

/** Upgrade generated visuals only while their original identity and content are recognizable. */
export function psdVisualUpdates(doc: GameFlowDocument, page: GameFlowPage, asset: PsdAsset, tree: SyncNode[], sources: CanvasSources) {
  const updates = new Map<string, PsdVisualUpdate>();
  const geometry = resolvePageLayout(page);
  for (const mapped of tree) {
    const layer = asset.layers.find(item => item.metadata.layerId === mapped.layer);
    const node = page.nodes.find(item => item.id === mapped.id);
    const ref = layer?.metadata.prototype;
    if (!node || !layer || layer.limitation || !prototypeLayerRef(ref) || ref.nodeId !== node.id ||
        ref.pageId !== page.id || ref.documentId !== doc.documentId) continue;
    if (node.type === "image" && ref.slot === "image" && (node.image === undefined || node.image?.builtin === "image/default") &&
        isPreviousDefaultSlice(layer)) updates.set(node.id, "psd-default-image");
    if (node.type !== "list" || !node.cellPrefab || !("source" in node.cellPrefab) || !layer.group ||
        layer.metadata.listCellsGenerated === true || asset.layers.some(item => item.parentKey === layer.key)) continue;
    const layout = geometry.nodes.get(node.id);
    if (!layout?.inverse) continue;
    try {
      const target = resolveCellPage(doc, sources, node.cellPrefab);
      const grid = listCellPositions(node, layout.local, target.page);
      if (target.page.nodes.length && grid.rows && grid.columns) updates.set(node.id, "psd-list-cells");
    } catch { /* Only resolved templates have content to add. */ }
  }
  return updates;
}
