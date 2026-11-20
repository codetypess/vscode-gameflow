import type { GameFlowPage, PagePsdBinding } from "./model";
import type { PsdAsset } from "./psd-meta";
import { bindPrototypePsd } from "./psd-prototype";
export const pagePsdKey = (binding?: PagePsdBinding) => binding ? JSON.stringify([binding.source, binding.documentId]) : "";
export function bindPagePsd(page: GameFlowPage, documentId: string, source: string, asset: PsdAsset): GameFlowPage {
  return { ...bindPrototypePsd(page, documentId, asset), artPsd: { source, documentId: asset.documentId } };
}
