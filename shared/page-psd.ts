import type { GameFlowPage, PagePsdBinding } from "./model";
import type { PsdAsset } from "./psd-meta";
import { bindPrototypePsd } from "./psd-prototype";
import { prefabFileName } from "./prefab-export";
export const pagePsdKey = (binding?: PagePsdBinding) => binding ? JSON.stringify([binding.source, binding.documentId]) : "";
export const pagePsdFileName = (name: string) =>
  prefabFileName({ name: name.replace(/\.psd$/i, "").replace(/\.\.+/g, "_") }).replace(/\.lh$/, ".psd");
export function bindPagePsd(page: GameFlowPage, documentId: string, source: string, asset: PsdAsset): GameFlowPage {
  return { ...bindPrototypePsd(page, documentId, asset), artPsd: { source, documentId: asset.documentId } };
}
