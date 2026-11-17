import { createHash } from "node:crypto";
import { applyPsdDraft, draftStamp, makePsdDraft, type PsdDraft } from "../shared/psd-draft";
import { makeSidecar, type PsdAsset } from "../shared/psd-meta";

export const bytesHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export interface PsdConfigIO {
  readSource(): Promise<Uint8Array>;
  readConfig(): Promise<Uint8Array | null>;
  writeConfig(bytes: Uint8Array): Promise<void>;
}
/** Owns metadata revisions; pixel assets and view state never enter its history. */
export class PsdDocumentModel {
  version = 1;
  private saved: PsdDraft;
  constructor(public asset: PsdAsset, public configHash: string | null, public needsSave = false) { this.saved = makePsdDraft(asset); }
  get dirty() { return this.needsSave || draftStamp(this.asset) !== JSON.stringify(this.saved); }
  get baseline() { return structuredClone(this.saved); }
  update(draft: unknown, version: number) {
    if (version !== this.version) throw new Error("PSD 配置版本已变化，请重试。");
    const next = applyPsdDraft(this.asset, draft);
    if (draftStamp(next) === draftStamp(this.asset)) return false;
    this.asset = next; this.version++; return true;
  }
  restore(draft: PsdDraft, baseline?: PsdDraft) {
    if (baseline) { const saved = applyPsdDraft(this.asset, baseline, true); this.saved = makePsdDraft(saved); }
    this.asset = applyPsdDraft(this.asset, draft, true); this.version++;
  }
  async save(io: PsdConfigIO) {
    const snapshot = this.asset, saved = makePsdDraft(snapshot);
    const bytes = new TextEncoder().encode(JSON.stringify(makeSidecar(snapshot), null, 2) + "\n");
    if (bytes.length > 1024 * 1024) throw new Error("PSD 配置超过 1 MB。");
    if (bytesHash(await io.readSource()) !== snapshot.sourceHash) throw new Error("源 PSD 已在外部修改，请重新打开并核对配置；当前草稿已保留。");
    const current = await io.readConfig();
    if ((current ? bytesHash(current) : null) !== this.configHash) throw new Error("配置文件已在外部修改，请重新打开并核对；当前草稿已保留。");
    await io.writeConfig(bytes);
    this.saved = saved; this.configHash = bytesHash(bytes); this.needsSave = false;
  }
  reset(asset: PsdAsset, configHash: string | null) { this.asset = asset; this.saved = makePsdDraft(asset); this.configHash = configHash; this.needsSave = false; this.version++; }
}
