import type { GameFlowPage, PagePsdBinding } from "./model";
import type { PsdAsset } from "./psd-meta";
import { bindPrototypePsd } from "./psd-prototype";
export const pagePsdKey = (binding?: PagePsdBinding) => binding ? JSON.stringify([binding.source, binding.documentId]) : "";
export function bindPagePsd(page: GameFlowPage, documentId: string, source: string, asset: PsdAsset): GameFlowPage {
  // Art from a previous file must not survive a replacement binding. Builtins remain authored.
  const samePsd = page.artPsd?.documentId === asset.documentId;
  const nodes = page.nodes.map(node => {
    if (samePsd) return node;
    const next = { ...node };
    for (const field of ["image", "normalSkin", "selectedSkin", "disabledSkin"] as const) {
      if (next[field]?.art) { const { art, ...slot } = next[field]!; next[field] = Object.keys(slot).length ? slot : null; }
    }
    return next;
  });
  return { ...bindPrototypePsd({ ...page, nodes }, documentId, asset), artPsd: { source, documentId: asset.documentId } };
}
