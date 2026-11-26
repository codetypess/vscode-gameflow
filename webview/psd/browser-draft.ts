import { applyPsdDraft, makePsdDraft } from "../../shared/psd-draft";
import type { PsdAsset } from "../../shared/psd-meta";
const key = (asset: PsdAsset) => `gameflow.psd-draft.v1:${encodeURIComponent(asset.name)}:${asset.sourceHash}`;
export function saveBrowserDraft(asset: PsdAsset) { localStorage.setItem(key(asset), JSON.stringify(makePsdDraft(asset))); }
export function discardBrowserDraft(asset: PsdAsset) { localStorage.removeItem(key(asset)); }
export function markBrowserConfigSaved(asset: PsdAsset) {
  localStorage.setItem(key(asset) + ":saved", JSON.stringify(makePsdDraft(asset)));
  discardBrowserDraft(asset);
}
export function restoreBrowserDraft(asset: PsdAsset) {
  const draft = localStorage.getItem(key(asset));
  const raw = draft ?? localStorage.getItem(key(asset) + ":saved");
  return raw ? { asset: applyPsdDraft(asset, JSON.parse(raw), true), dirty: draft !== null } : null;
}
