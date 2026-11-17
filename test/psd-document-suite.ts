import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePsdBinary } from "../shared/psd-binary";
import { createPsdStructure } from "../shared/psd-structure";
import { applySidecar, makeSidecar } from "../shared/psd-meta";
import { applyPsdDraft, makePsdDraft } from "../shared/psd-draft";
import { isPsdEditorRequest, type PsdEditorRequest, type PsdEditorState } from "../shared/psd-editor-protocol";
import { bytesHash, PsdDocumentModel, type PsdConfigIO } from "../src/psd-document-model";
import { PsdDocumentSession } from "../webview/psd/document-session";

const bytes = readFileSync("examples/psd-metadata/GameFlow-PSD-Metadata-Sample.psd");
const structure = () => createPsdStructure(parsePsdBinary(bytes), "sample.psd", bytesHash(bytes));
function fixture() {
  const asset = structure(), model = new PsdDocumentModel(asset, null);
  const draft = makePsdDraft(asset); draft.layers[0].config.exportName = "new_name"; draft.layers[0].config.shared = true;
  let config: Uint8Array | null = null, writes = 0;
  const io: PsdConfigIO = { readSource: async () => bytes, readConfig: async () => config, writeConfig: async value => { config = value; writes++; } };
  return { model, draft, io, config: () => config, writes: () => writes };
}
function sessionFixture() {
  const asset = structure(), draft = makePsdDraft(asset), posted: PsdEditorRequest[] = [];
  const state: PsdEditorState = { type: "psdEditorState", version: 1, draft, dirty: false, backup: "none" };
  const session = new PsdDocumentSession(message => posted.push(message), () => {}); session.initialize(state);
  const edited = structuredClone(draft); edited.layers[0].config.exportName = "first";
  return { session, state, posted, edited };
}
export const psdDocumentTests = [
  { name: "PSD drafts are independent snapshots of metadata and saved state", run() {
    const asset = structure(), draft = makePsdDraft(asset), original = asset.layers[0].config.exportName;
    draft.layers[0].config.exportName = "candidate";
    assert.equal(asset.layers[0].config.exportName, original);
    const model = new PsdDocumentModel(asset, null, true); assert.equal(model.dirty, true);
    const baseline = model.baseline; baseline.layers[0].metadata.layerId = "changed";
    assert.notEqual(model.baseline.layers[0].metadata.layerId, "changed");
  } },
  { name: "PSD draft roundtrip preserves unfinished duplicate identities without permitting formal save", run() {
    const asset = structure(); asset.layers[1].metadata.layerId = asset.layers[0].metadata.layerId;
    asset.layers[0].config.exportName = "unsaved";
    const restored = applyPsdDraft(structure(), JSON.parse(JSON.stringify(makePsdDraft(asset))), true);
    assert.equal(restored.layers[0].config.exportName, "unsaved");
    assert.equal(restored.layers[1].metadata.layerId, restored.layers[0].metadata.layerId);
    assert.throws(() => makeSidecar(restored), /重复 ID/);
  } },
  { name: "PSD draft rejects foreign files, missing layers and invalid geometry settings", run() {
    const asset = structure(), draft = makePsdDraft(asset);
    assert.throws(() => applyPsdDraft(asset, { ...draft, sourceHash: "0".repeat(64) }), /源文件/);
    assert.throws(() => applyPsdDraft(asset, { ...draft, documentId: "other" }), /无效/);
    assert.throws(() => applyPsdDraft(asset, { ...draft, layers: draft.layers.slice(1) }), /无效/);
    const invalid = structuredClone(draft); invalid.layers[0].config.nineGrid = { top: 4096, bottom: 4096, left: 0, right: 0, repeat: false };
    assert.throws(() => applyPsdDraft(asset, invalid), /无效/);
    assert.equal(isPsdEditorRequest({ type: "psdEditorEdit", requestId: "a", baseVersion: 1, draft: invalid }), false);
  } },
  { name: "PSD metadata edit becomes dirty and saved sidecar reopens with settings", async run() {
    const f = fixture(); assert.equal(f.model.dirty, false);
    f.model.update(f.draft, 1); assert.equal(f.model.dirty, true);
    await f.model.save(f.io); assert.equal(f.model.dirty, false); assert.equal(f.writes(), 1);
    const restored = applySidecar(structure(), JSON.parse(new TextDecoder().decode(f.config()!)));
    assert.equal(restored.layers[0].config.exportName, "new_name"); assert.equal(restored.layers[0].config.shared, true);
    assert.equal(bytesHash(bytes), f.model.asset.sourceHash);
  } },
  { name: "PSD failed save retains unsaved metadata and previous file fingerprint", async run() {
    const f = fixture(); f.model.update(f.draft, 1);
    f.io.writeConfig = async () => { throw new Error("disk full"); };
    await assert.rejects(f.model.save(f.io), /disk full/);
    assert.equal(f.model.dirty, true); assert.equal(f.model.configHash, null); assert.equal(f.model.asset.layers[0].config.exportName, "new_name");
  } },
  { name: "PSD save completion does not clear edits made while the write was pending", async run() {
    const f = fixture(); f.model.update(f.draft, 1);
    let started!: () => void, finish!: () => void;
    const writing = new Promise<void>(resolve => { started = resolve; });
    const wait = new Promise<void>(resolve => { finish = resolve; });
    const originalWrite = f.io.writeConfig; f.io.writeConfig = async value => { started(); await wait; await originalWrite(value); };
    const save = f.model.save(f.io); await writing;
    const next = structuredClone(f.draft); next.layers[0].config.exportName = "newer_name"; f.model.update(next, f.model.version);
    finish(); await save;
    assert.equal(f.model.dirty, true); assert.equal(f.model.asset.layers[0].config.exportName, "newer_name");
    assert.equal(JSON.parse(new TextDecoder().decode(f.config()!)).layers[0].config.exportName, "new_name");
    await f.model.save(f.io); assert.equal(f.model.dirty, false);
  } },
  { name: "PSD external source and sidecar changes abort saving before any write", async run() {
    for (const target of ["source", "config"]) {
      const f = fixture(); f.model.update(f.draft, 1);
      if (target === "source") f.io.readSource = async () => new Uint8Array([1]);
      else f.io.readConfig = async () => new TextEncoder().encode("externally changed");
      await assert.rejects(f.model.save(f.io), /外部修改/); assert.equal(f.writes(), 0); assert.equal(f.model.dirty, true);
    }
  } },
  { name: "PSD history and backup restoration retain the saved baseline and reject stale edits", run() {
    const f = fixture(), before = f.model.baseline; f.model.update(f.draft, 1);
    assert.throws(() => f.model.update(before, 1), /版本/);
    f.model.restore(before); assert.equal(f.model.dirty, false);
    f.model.restore(f.draft); assert.equal(f.model.dirty, true);
    const recovered = new PsdDocumentModel(structure(), null); recovered.restore(makePsdDraft(f.model.asset), before);
    assert.equal(recovered.dirty, true); assert.equal(recovered.asset.layers[0].config.exportName, "new_name");
  } },
  { name: "PSD session serializes typing before save and flush acknowledgements", async run() {
    const f = sessionFixture(); f.session.edit(f.edited);
    const first = f.posted[0] as Extract<PsdEditorRequest, { type: "psdEditorEdit" }>;
    const next = structuredClone(f.edited); next.layers[0].config.exportName = "second"; f.session.edit(next);
    const saving = f.session.run("save"); f.session.receive({ type: "psdEditorFlush", requestId: "flush" });
    assert.equal(f.posted.length, 1);
    f.session.receive({ ...f.state, version: 2, draft: f.edited, dirty: true, requestId: first.requestId });
    const second = f.posted[1] as typeof first; assert.equal(second.baseVersion, 2); assert.equal(second.draft.layers[0].config.exportName, "second");
    assert.equal(f.session.draft?.layers[0].config.exportName, "second");
    f.session.receive({ ...f.state, version: 3, draft: next, dirty: true, requestId: second.requestId });
    assert.equal(f.posted[2].type, "psdEditorFlushed"); assert.equal(f.posted[3].type, "psdEditorCommand");
    f.session.receive({ type: "psdEditorCommandResult", requestId: (f.posted[3] as { requestId: string }).requestId }); await saving;
  } },
  { name: "PSD session preserves rejected candidate edits until explicit retry", async run() {
    const f = sessionFixture(); f.session.edit(f.edited);
    f.session.receive({ ...f.state, version: 3, requestId: (f.posted[0] as { requestId: string }).requestId, rejected: true, error: "stale" });
    assert.equal(f.session.draft?.layers[0].config.exportName, "first"); assert.equal(f.session.unsent, true);
    await assert.rejects(f.session.run("save"), /stale/);
    f.session.retry(); assert.equal((f.posted[1] as { baseVersion: number }).baseVersion, 3);
  } },
  { name: "PSD backup status and old replies cannot acknowledge a newer edit", run() {
    const f = sessionFixture(); f.session.edit(f.edited);
    f.session.receive({ ...f.state, backup: "saved" }); assert.equal(f.session.pending, true);
    const id = (f.posted[0] as { requestId: string }).requestId;
    f.session.receive({ ...f.state, version: 2, draft: f.edited, dirty: true, requestId: id });
    f.session.receive({ ...f.state }); assert.equal(f.session.state?.version, 2); assert.equal(f.session.draft?.layers[0].config.exportName, "first");
  } },
  { name: "PSD initialization retains native changes and flushes requested during pixel decoding", run() {
    const f = sessionFixture(), posted: PsdEditorRequest[] = [];
    const session = new PsdDocumentSession(message => posted.push(message), () => {});
    session.receive({ ...f.state, version: 2, draft: f.edited, dirty: true, backup: "saved" });
    session.receive({ type: "psdEditorFlush", requestId: "loading-save" });
    session.initialize(f.state);
    assert.equal(session.state?.version, 2); assert.equal(session.draft?.layers[0].config.exportName, "first");
    assert.deepEqual(posted, [{ type: "psdEditorFlushed", requestId: "loading-save" }]);
  } }
];
