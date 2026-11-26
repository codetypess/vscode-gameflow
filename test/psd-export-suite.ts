import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, writeFile, unlink, rmdir, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultExportName, effectiveExportName, exportNameError, isSliceExportBatch, makeSliceExportBatch, parseResourceManifest, RESOURCE_MANIFEST, sliceExportPath, sliceExportIssues, SliceExportConflict, type SliceExportBatch } from "../shared/psd-export";
import { exportSlicesToDirectory, type ResourceDirectory } from "../shared/psd-export-directory";
import { applySidecar, makeSidecar, validConfig, type PsdAsset, type PsdLayer } from "../shared/psd-meta";
import { isWebviewToHostMessage } from "../shared/protocol";
import { DocumentSession } from "../webview/document-session";
import { builtinImage } from "../shared/builtin-image";

const png = readFileSync("examples/star-sea-login/assets/status_dot.png");
const otherPng = readFileSync("examples/star-sea-login/assets/emblem.png");
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const codec = { decode: (value: string) => Buffer.from(value, "base64"), hash: async (bytes: Uint8Array) => sha(bytes) };
const layer = (key = 0, name = "按钮底图"): PsdLayer => ({ key, nativeId: key, parentKey: null, name, group: false, left: 0, top: 0, width: 10, height: 10, hidden: false, identityOrigin: "embedded", metadata: { namespace: "com.codetypes.gameflow", version: 1, documentId: "psd-a", layerId: `layer${key}` }, config: { enabled: true, name, nineGrid: null }, image: `data:image/png;base64,${png.toString("base64")}` });
const asset = (...layers: PsdLayer[]): PsdAsset => ({ name: "登录页面.psd", sourceHash: "a".repeat(64), documentId: "psd-a", hasEmbeddedIdentity: true, width: 100, height: 100, preview: "", layers: layers.length ? layers : [layer()] });
function batch(source = "psd-a", shared = false): SliceExportBatch {
  const result = makeSliceExportBatch(asset()); result.source.documentId = source; result.source.psdName = `${source}.psd`; result.items[0].shared = shared; return result;
}
class MemoryDirectory implements ResourceDirectory {
  files = new Map<string, Uint8Array>(); writes: string[] = []; fail?: string;
  folders = new Set<string>();
  async mkdir(folder: string) { this.folders.add(folder); }
  async list(folder?: string) {
    const prefix = folder ? folder + "/" : "";
    return [...new Set([...this.files.keys(), ...this.folders].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length).split("/")[0]).filter(Boolean))];
  }
  async read(name: string) { return this.files.get(name)?.slice() ?? null; }
  async write(name: string, bytes: Uint8Array) {
    this.writes.push(name);
    if (name === this.fail) { this.fail = undefined; this.files.set(name, new Uint8Array([0])); throw new Error("模拟写入失败"); }
    this.files.set(name, new Uint8Array(bytes));
  }
  async remove(name: string) { this.files.delete(name); }
  manifest() { return parseResourceManifest(JSON.parse(new TextDecoder().decode(this.files.get(RESOURCE_MANIFEST)))); }
}
export const psdExportTests: { name: string; run: () => void | Promise<void> }[] = [
  { name: "a composite button state owns its slice and retains covered settings on reopen", run() {
    const button = layer(0, "Start"), normal = layer(1, "@normal");
    button.group = normal.group = true;
    button.config.enabled = false;
    normal.parentKey = button.key;
    normal.config.composite = true;
    const stroke = layer(2, "描边"), highlight = layer(3, "高光"), selected = layer(4, "@selected");
    stroke.parentKey = highlight.parentKey = normal.key;
    selected.parentKey = button.key;
    // Both covered layers have conflicting export names until the group is unpacked.
    stroke.config.variableName = highlight.config.variableName = "glow";
    const source = asset(button, normal, stroke, highlight, selected);
    const saved = applySidecar(source, JSON.parse(JSON.stringify(makeSidecar(source))));
    assert.deepEqual(makeSliceExportBatch(saved).items.map(item => item.name), ["dlym_start_normal", "dlym_start_selected"]);
    saved.layers[1].config.enabled = false;
    assert.deepEqual(makeSliceExportBatch(saved).items.map(item => item.layerId), [selected.metadata.layerId]);
    saved.layers[1].config.composite = false;
    assert.deepEqual(sliceExportIssues(saved).map(issue => issue.keys), [[stroke.key, highlight.key]]);
  } },
  { name: "two PSDs reuse the catalog PNG while edited layers export independently", async run() {
    const directory = new MemoryDirectory(), close = builtinImage("icon/close")!;
    const first = layer(), second = layer(1);
    first.verifiedBuiltin = second.verifiedBuiltin = { id: close.id, width: 10, height: 10 };
    const product = makeSliceExportBatch(asset(first, second));
    assert.equal(product.items.length, 1);
    assert.equal(product.items[0].base64, close.dataUri.split(",")[1]);
    await exportSlicesToDirectory(directory, product, codec);
    const another = { ...product, source: { ...product.source, documentId: "another-window" } };
    directory.writes = [];
    await exportSlicesToDirectory(directory, another, codec);
    const path = "builtin/icon/close.png";
    assert.ok(!directory.writes.includes(path));
    assert.equal(directory.manifest().resources[0].source.documentId, "gameflow-builtin");
    delete second.verifiedBuiltin;
    const mixed = makeSliceExportBatch(asset(first, second));
    await exportSlicesToDirectory(directory, mixed, codec);
    assert.deepEqual(directory.manifest().resources.map(r => r.file), [path, "unclassified/dlym_andt.png"]);
    assert.equal(Buffer.from(directory.files.get(path)!).toString("base64"), close.dataUri.split(",")[1]);
    first.config.region = { x: 1, y: 0, width: 9, height: 10 };
    assert.equal(effectiveExportName(asset(first), first), "dlym_andt");
    delete first.config.region;
    first.config.nineGrid = { top: 1, left: 1, right: 1, bottom: 1, repeat: false };
    assert.equal(effectiveExportName(asset(first), first), "dlym_andt");
    directory.files.set(path, new Uint8Array([0]));
    await assert.rejects(exportSlicesToDirectory(directory, product, codec), /已有不同内容/);
    assert.deepEqual([...directory.files.get(path)!], [0]);
  } },
  { name: "PSD default names combine atlas and public layer initials without type prefixes", run() {
    for (const [psd, layerName, atlas, expected] of [
      ["登录页面.PSD", "按钮底图", undefined, "dlym_andt"],
      ["重庆登录.psd", "按钮2", undefined, "cqdl_an2"],
      ["Login-UI2.psd", "确认 OK", undefined, "login_ui2_qr_ok"],
      ["登录页面.psd", "底部提示 (UILabel)", "login", "login_dbts"],
      ["按钮页面.psd", "图标", undefined, "anym_tb"],
      ["登录页面.psd", "按钮底图", "Common", "common_andt"],
      ["登录页面.psd", "服务器底板", "公共资源", "ggzy_fwqdb"],
      [".psd", "按钮", "Common", "common_an"],
      ["登录页面.psd", "★", "Common", ""], [".psd", "按钮", undefined, ""]
    ]) assert.equal(defaultExportName(psd!, layerName!, atlas), expected);
    assert.equal(exportNameError("btn_01"), null);
    for (const name of ["", "中文", "a.png", "a/b", "a b", "CON", "a".repeat(121)]) assert.ok(exportNameError(name));
  } },
  { name: "PSD variable overrides compose with the atlas, preserve typed prefixes and clear legacy fallback", run() {
    const l = layer(), a = asset(l);
    assert.equal(effectiveExportName(a, l), "dlym_andt"); assert.equal(l.config.variableName, undefined);
    l.config.exportName = "CUSTOM_01"; assert.equal(effectiveExportName(a, l), "dlym_custom_01");
    l.config.variableName = "BTN_Start"; assert.equal(effectiveExportName(a, l), "dlym_btn_start");
    l.config.shared = true; assert.equal(effectiveExportName(a, l), "btn_start");
    a.atlasName = "Common"; assert.equal(effectiveExportName(a, l), "btn_start");
    l.config.variableName = "img_icon"; assert.equal(effectiveExportName(a, l), "img_icon");
    l.config.variableName = ""; assert.equal(effectiveExportName(a, l), "andt");
    l.config.shared = false; assert.equal(effectiveExportName(a, l), "common_andt");
    l.name = "底部提示 (UILabel)"; assert.equal(effectiveExportName(a, l), "common_dbts");
    l.config.variableName = "bad/name"; assert.ok(sliceExportIssues(a).some(issue => issue.message.includes("导出名称")));
    l.config.variableName = "a".repeat(115); assert.throws(() => makeSliceExportBatch(a), /120/);
  } },
  { name: "PSD name/shared settings roundtrip through sidecar and empty override remains empty", run() {
    const a = asset(); a.layers[0].config = { ...a.layers[0].config, exportName: "", shared: true };
    assert.deepEqual(applySidecar(asset(), JSON.parse(JSON.stringify(makeSidecar(a)))).layers[0].config, a.layers[0].config);
    assert.equal(validConfig({ ...a.layers[0].config, shared: "true" }, 10, 10), false);
    assert.equal(validConfig({ ...a.layers[0].config, exportName: 5 }, 10, 10), false);
  } },
  { name: "PSD duplicate layer names conflict even with different custom names and sharing", run() {
    const one = layer(), two = layer(1); one.config.exportName = "first"; two.config.exportName = "second"; two.config.shared = true;
    const a = asset(one, two); assert.ok(sliceExportIssues(a).some(i => i.message.includes("同名图层") && i.keys.length === 2));
    assert.throws(() => makeSliceExportBatch(a), /同名图层/);
    two.config.enabled = false; assert.equal(sliceExportIssues(a).length, 0);
  } },
  { name: "PSD abbreviation and custom case collisions reject the whole candidate batch", run() {
    const one = layer(0, "按钮底图"), two = layer(1, "按钮地图");
    assert.ok(sliceExportIssues(asset(one, two)).some(i => i.message.includes("导出名称")));
    one.config.exportName = "OK"; two.config.exportName = "ok";
    assert.throws(() => makeSliceExportBatch(asset(one, two)), /导出名称/);
    two.config.exportName = "cancel"; assert.equal(makeSliceExportBatch(asset(one, two)).items.length, 2);
  } },
  { name: "PSD export validates protocol payloads and isolates replies from prototype sessions", run() {
    const b = batch(); assert.ok(isSliceExportBatch(b));
    const msg = { type: "psdResourceExport", requestId: "req", action: "export", batch: b };
    assert.ok(isWebviewToHostMessage(msg));
    assert.ok(isWebviewToHostMessage({ type: "psdResourceExport", requestId: "req", action: "choose" }));
    for (const value of [{ ...b, items: [] }, { ...b, items: [b.items[0], b.items[0]] }, { ...b, items: [{ ...b.items[0], name: "../oops" }] }, { ...b, items: [{ ...b.items[0], base64: "!!!" }] }]) assert.equal(isWebviewToHostMessage({ ...msg, batch: value }), false);
    const session = new DocumentSession(() => {}, () => {}), before = session.state;
    session.receive({ type: "psdResourceExportResult", requestId: "req", count: 1 }); assert.equal(session.state, before);
  } },
  { name: "PSD export writes actual PNG bytes and traceable nine-grid metadata together", async run() {
    const d = new MemoryDirectory(), b = batch(); b.items[0].nineGrid = { top: 1, right: 2, bottom: 3, left: 4, repeat: true };
    assert.equal(await exportSlicesToDirectory(d, b, codec), 1);
    assert.deepEqual(d.files.get(sliceExportPath(b, b.items[0])), new Uint8Array(png));
    const entry = d.manifest().resources[0];
    assert.deepEqual(entry.source, b.source); assert.equal(entry.layerId, b.items[0].layerId);
    assert.deepEqual(entry.nineGrid, b.items[0].nineGrid); assert.equal(entry.sha256, sha(png));
    const metaPath=entry.file+".meta";
    const first=JSON.parse(new TextDecoder().decode(d.files.get(metaPath)));
    assert.match(first.uuid,/^[a-f0-9-]{36}$/);
    assert.deepEqual(first.importer,{textureType:2,sizeGrid:[1,2,3,4,1]});
    const uuid="8044e91d-d121-4bd3-b149-21a8f8e48a64";
    d.files.set(metaPath,Buffer.from(JSON.stringify({uuid,custom:"from Laya",importer:{filterMode:0,sizeGrid:[1,2,3,4,1]}})));
    b.items[0].nineGrid=null;
    await exportSlicesToDirectory(d,b,codec);
    assert.deepEqual(JSON.parse(new TextDecoder().decode(d.files.get(metaPath))),{uuid,custom:"from Laya",importer:{textureType:2,filterMode:0,sizeGrid:[0,0,0,0,0]}});
    assert.equal(d.writes.at(-1), RESOURCE_MANIFEST);
  } },
  { name: "PSD sidecar failures and invalid importer metadata preserve existing files", async run() {
    const d=new MemoryDirectory(), b=batch(), metaPath=sliceExportPath(b,b.items[0])+".meta";
    d.files.set(metaPath,new TextEncoder().encode('{"importer":{"filterMode":1}}'));
    const before=new Map(d.files);
    d.fail=metaPath;
    await assert.rejects(exportSlicesToDirectory(d,b,codec),/已恢复/);
    assert.deepEqual(d.files,before);
    for(const bad of ["broken","[]",'{"uuid":"bad"}','{"importer":[]}']) {
      d.files.set(metaPath,Buffer.from(bad));
      const count=d.writes.length;
      await assert.rejects(exportSlicesToDirectory(d,b,codec),/\.meta/);
      assert.equal(d.writes.length,count);
    }
    d.files.delete(metaPath);
    d.files.set(metaPath.toUpperCase().replace("UNCLASSIFIED","unclassified"),Buffer.from("{}"));
    await assert.rejects(exportSlicesToDirectory(d,b,codec),/大小写冲突/);
  } },
  { name: "PSD same-source reexport updates one resource while nonshared foreign export never writes", async run() {
    const d = new MemoryDirectory(), b = batch(); await exportSlicesToDirectory(d, b, codec);
    b.items[0].nineGrid = { top: 1, right: 1, bottom: 1, left: 1, repeat: false };
    await exportSlicesToDirectory(d, b, codec); assert.equal(d.manifest().resources.length, 1);
    const count = d.writes.length, before = d.files.get(RESOURCE_MANIFEST)?.slice();
    await assert.rejects(exportSlicesToDirectory(d, batch("psd-b"), codec), (e: unknown) => e instanceof SliceExportConflict && e.conflicts[0].name === b.items[0].name && e.conflicts[0].message.includes("psd-a.psd"));
    assert.equal(d.writes.length, count); assert.deepEqual(d.files.get(RESOURCE_MANIFEST), before);
  } },
  { name: "PSD shared export overwrites another source and transfers provenance", async run() {
    const d = new MemoryDirectory(); await exportSlicesToDirectory(d, batch("psd-a", true), codec);
    const b = batch("psd-b", true); b.items[0] = { ...b.items[0], width: 216, height: 80, base64: otherPng.toString("base64") };
    await exportSlicesToDirectory(d, b, codec);
    assert.deepEqual(d.files.get(sliceExportPath(b, b.items[0])), new Uint8Array(otherPng));
    assert.equal(d.manifest().resources.length, 1); assert.equal(d.manifest().resources[0].source.documentId, "psd-b");
    await exportSlicesToDirectory(d, batch(), codec);
    assert.equal(d.manifest().resources.length, 2);
  } },
  { name: "PSDs with different atlases export the same shared variable to one path and transfer provenance", async run() {
    const d = new MemoryDirectory(), first = asset(); first.layers[0].config.shared = true;
    const second = asset(); second.name = "设置界面.psd"; second.documentId = "psd-b"; second.layers[0].config.shared = true;
    first.atlasName = "Login UI"; second.atlasName = "Settings UI";
    const a = makeSliceExportBatch(first), b = makeSliceExportBatch(second);
    assert.equal(sliceExportPath(a, a.items[0]), "shared/andt.png");
    assert.equal(sliceExportPath(b, b.items[0]), "shared/andt.png");
    await exportSlicesToDirectory(d, a, codec); await exportSlicesToDirectory(d, b, codec);
    assert.equal(d.manifest().resources.length, 1);
    assert.equal(d.manifest().resources[0].source.psdName, "设置界面.psd");
    second.layers[0].config.variableName = "custom_button";
    assert.equal(makeSliceExportBatch(second).items[0].name, "custom_button");
    second.layers[0].config.variableName = ""; second.layers[0].config.shared = false;
    assert.equal(makeSliceExportBatch(second).items[0].name, "settings_ui_andt");
  } },
  { name: "PSD unmanaged files require explicit sharing and malformed provenance is rejected", async run() {
    const d = new MemoryDirectory(), b = batch(); d.files.set(sliceExportPath(b, b.items[0]), png);
    await assert.rejects(exportSlicesToDirectory(d, b, codec), /没有来源/); assert.equal(d.writes.length, 0);
    b.items[0].shared = true; d.files.set(sliceExportPath(b, b.items[0]), png); await exportSlicesToDirectory(d, b, codec); assert.equal(d.manifest().resources.length, 1);
    const m = d.manifest(); m.resources.push(m.resources[0]);
    assert.throws(() => parseResourceManifest(m), /重复资源/);
    d.files.set(RESOURCE_MANIFEST, new TextEncoder().encode('{"schema":"other"}'));
    const count = d.writes.length; await assert.rejects(exportSlicesToDirectory(d, b, codec), /清单格式/); assert.equal(d.writes.length, count);
  } },
  { name: "PSD export rejects PNG mismatch and directory case conflicts before writing", async run() {
    const d = new MemoryDirectory(), b = batch(); b.items[0].width = 9;
    await assert.rejects(exportSlicesToDirectory(d, b, codec), /PNG/); assert.equal(d.writes.length, 0);
    b.items[0].width = 10; d.files.set(`unclassified/${b.items[0].name.toUpperCase()}.png`, png);
    await assert.rejects(exportSlicesToDirectory(d, b, codec), /大小写冲突/); assert.equal(d.writes.length, 0);
  } },
  { name: "PSD export rolls back PNG and manifest if final metadata write fails", async run() {
    const d = new MemoryDirectory(), b = batch("psd-a", true); await exportSlicesToDirectory(d, b, codec);
    const before = structuredClone(d.files); d.fail = RESOURCE_MANIFEST;
    const next = batch("psd-b", true); next.items[0] = { ...next.items[0], width: 216, height: 80, base64: otherPng.toString("base64") };
    await assert.rejects(exportSlicesToDirectory(d, next, codec), /已恢复本次写入/);
    assert.deepEqual(d.files, before);
    const empty = new MemoryDirectory(); empty.fail = RESOURCE_MANIFEST;
    await assert.rejects(exportSlicesToDirectory(empty, b, codec), /已恢复/); assert.equal(empty.files.size, 0);
  } },
  { name: "PSD concurrent target changes abort before any writes", async run() {
    const d = new MemoryDirectory(), b = batch(); await exportSlicesToDirectory(d, b, codec);
    const read = d.read.bind(d); let calls = 0; d.read = async name => { const result = await read(name); if (name.endsWith(".png") && ++calls === 2) return new Uint8Array([1, 2, 3]); return result; };
    const count = d.writes.length;
    await assert.rejects(exportSlicesToDirectory(d, b, codec), /检查期间被修改/); assert.equal(d.writes.length, count);
  } },
  { name: "PSD files appearing after directory scanning cannot bypass overwrite checks", async run() {
    const d = new MemoryDirectory(), b = batch(), target = sliceExportPath(b, b.items[0]);
    const list = d.list.bind(d); let scanned = false;
    d.list = async folder => { const names = await list(folder); if (folder && !scanned) { scanned = true; d.files.set(target, new Uint8Array(otherPng)); } return names; };
    await assert.rejects(exportSlicesToDirectory(d, b, codec), /检查期间/);
    assert.equal(d.writes.length, 0); assert.deepEqual(d.files.get(target), new Uint8Array(otherPng));
  } },
  { name: "PSD directory export writes readable PNGs and one manifest to a real folder", async run() {
    const root = await mkdtemp(join(tmpdir(), "gameflow-export-test-")), b = batch();
    const directory: ResourceDirectory = {
      list: async folder => { try { return await readdir(join(root, folder ?? "")); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; } },
      mkdir: async folder => { await mkdir(join(root, folder), { recursive: true }); },
      read: async name => { try { return await readFile(join(root, name)); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; } },
      write: (name, bytes) => writeFile(join(root, name), bytes), remove: name => unlink(join(root, name))
    };
    try {
      await exportSlicesToDirectory(directory, b, codec);
      assert.deepEqual((await readdir(root)).sort(), ["builtin", "shared", "unclassified", RESOURCE_MANIFEST].sort());
      assert.equal(sha(await readFile(join(root, sliceExportPath(b, b.items[0])))), sha(png));
      const metadata = JSON.parse(await readFile(join(root, RESOURCE_MANIFEST), "utf8"));
      assert.equal(metadata.resources[0].source.psdName, "psd-a.psd");
      await assert.rejects(exportSlicesToDirectory(directory, batch("psd-b"), codec), /未标记/);
      await exportSlicesToDirectory(directory, batch("psd-b", true), codec);
      assert.equal(JSON.parse(await readFile(join(root, RESOURCE_MANIFEST), "utf8")).resources.find((r: { shared: boolean }) => r.shared).source.psdName, "psd-b.psd");
    } finally { for (const entry of await readdir(root, { withFileTypes: true })) { if (entry.isDirectory()) { for (const name of await readdir(join(root, entry.name))) await unlink(join(root, entry.name, name)); await rmdir(join(root, entry.name)); } else await unlink(join(root, entry.name)); } await rmdir(root); }
  } },
  { name: "PSD root ledger distinguishes equal basenames across shared atlas and unclassified directories", async run() {
    const one = layer(0, "普通图标"), two = layer(1, "共享图标");
    one.config.exportName = "img_same"; two.config.exportName = "common_ui_img_same"; two.config.shared = true;
    const a: PsdAsset = { ...asset(one, two), independentDirectory: true, atlasName: "Common UI" };
    const b = makeSliceExportBatch(a), d = new MemoryDirectory();
    assert.equal(b.directory, "common_ui"); assert.equal(isSliceExportBatch(b), true);
    await exportSlicesToDirectory(d, b, codec);
    assert.deepEqual(d.manifest().resources.map(r => r.file), ["common_ui/common_ui_img_same.png", "shared/common_ui_img_same.png"]);
    assert.equal(d.manifest().version, 2);
    assert.ok(["builtin", "shared", "unclassified", "common_ui"].every(folder => d.folders.has(folder)));
    delete a.independentDirectory;
    await exportSlicesToDirectory(d, makeSliceExportBatch(a), codec);
    assert.deepEqual(d.manifest().resources.map(r => r.file), ["common_ui/common_ui_img_same.png", "shared/common_ui_img_same.png", "unclassified/common_ui_img_same.png"]);
    assert.deepEqual(d.files.get("common_ui/common_ui_img_same.png"), new Uint8Array(png));
  } },
  { name: "PSD mixed-folder batch restores both folders when an image or root ledger write fails", async run() {
    for (const failed of ["shared/img_two.png", RESOURCE_MANIFEST]) {
      const one = layer(0, "图标一"), two = layer(1, "图标二");
      one.config.exportName = "img_one"; two.config.exportName = "img_two"; two.config.shared = true;
      const b = makeSliceExportBatch({ ...asset(one, two), atlasName: "common", independentDirectory: true }), d = new MemoryDirectory();
      await exportSlicesToDirectory(d, b, codec); const before = structuredClone(d.files);
      b.items = b.items.map(item => ({ ...item, base64: otherPng.toString("base64"), width: 216, height: 80 }));
      d.fail = failed;
      await assert.rejects(exportSlicesToDirectory(d, b, codec), /已恢复本次写入/);
      assert.deepEqual(d.files, before);
    }
  } },
  { name: "PSD export rejects case aliases for category folders and root ledger before writes", async run() {
    for (const name of ["Shared", "BUILTIN", "Unclassified", "IMAGE-FILES.META.JSON"]) {
      const d = new MemoryDirectory(); d.files.set(name, new Uint8Array([1]));
      await assert.rejects(exportSlicesToDirectory(d, batch(), codec), /大小写冲突/);
      assert.equal(d.writes.length, 0);
    }
  } },
  { name: "PSD root ledger rejects traversal mismatched basenames and case duplicate paths", async run() {
    const d = new MemoryDirectory(); await exportSlicesToDirectory(d, batch(), codec);
    const manifest = d.manifest(), entry = manifest.resources[0];
    for (const file of ["../" + entry.name + ".png", "shared/other.png", "/shared/" + entry.name + ".png", "shared/../" + entry.name + ".png"]) {
      assert.throws(() => parseResourceManifest({ ...manifest, resources: [{ ...entry, file }] }), /无效或重复/);
    }
    assert.throws(() => parseResourceManifest({ ...manifest, resources: [entry, { ...entry, file: entry.file.replace("unclassified/", "Unclassified/") }] }), /重复/);
  } }
];
