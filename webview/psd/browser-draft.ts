import { applyPsdDraft, makePsdDraft } from "../../shared/psd-draft";
import type { PsdAsset } from "../../shared/psd-meta";
const key = (asset: PsdAsset) => `gameflow.psd-draft.v1:${encodeURIComponent(asset.name)}:${asset.sourceHash}`;
export function saveBrowserDraft(asset: PsdAsset) { localStorage.setItem(key(asset), JSON.stringify(makePsdDraft(asset))); }
export function restoreBrowserDraft(asset: PsdAsset): PsdAsset | null {
  const raw = localStorage.getItem(key(asset));
  return raw ? applyPsdDraft(asset, JSON.parse(raw), true) : null;
}
