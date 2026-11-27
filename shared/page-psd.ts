import type { GameFlowPage, PagePsdBinding } from "./model";
import type { PsdAsset } from "./psd-meta";
import { bindPrototypePsd } from "./psd-prototype";
import { prefabFileName } from "./prefab-export";
export const pagePsdKey = (binding?: PagePsdBinding) => binding ? JSON.stringify([binding.source, binding.documentId]) : "";
export function pageImageFileName(name: string, format: "psd" | "png") {
  const stem = name.toLowerCase().endsWith("." + format) ? name.slice(0, -4) : name;
  return prefabFileName({ name: stem.replace(/\.\.+/g, "_") }).replace(/[ .]*\.lh$/, "." + format);
}
export const pagePsdFileName = (name: string) => pageImageFileName(name, "psd");
export function bindPagePsd(page: GameFlowPage, documentId: string, source: string, asset: PsdAsset): GameFlowPage {
  return { ...bindPrototypePsd(page, documentId, asset), artPsd: { source, documentId: asset.documentId } };
}
