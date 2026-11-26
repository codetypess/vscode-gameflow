import * as vscode from "vscode";
import { parsePsdBinary, patchPsdMetadata } from "../shared/psd-binary";
import { createPsdStructure } from "../shared/psd-structure";
import { applySidecar, makeSidecar, sidecarName, type PsdAsset } from "../shared/psd-meta";
import { applyPsdDraft, draftStamp, isPsdDraft, makePsdDraft, type PsdDraft } from "../shared/psd-draft";
import { isPsdEditorRequest, type PsdEditorMessage, type PsdEditorState } from "../shared/psd-editor-protocol";
import { isWebviewToHostMessage, type HostToWebviewMessage } from "../shared/protocol";
import { psdExportDirectory, SliceExportConflict } from "../shared/psd-export";
import { PsdDocumentModel, bytesHash } from "./psd-document-model";
import { PsdExportController } from "./psd-export-controller";
import { configureGameFlowWebview } from "./webview-html";
import { WorkbenchSettingsController } from "./workbench-settings-controller";
import { atomicWrite } from "./psd-file-io";
import { renderPhotoCraft } from "./photocraft-render";

export const PSD_EDITOR_VIEW_TYPE = "gameflow.psdEditor";
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const nameOf = (uri: vscode.Uri) => uri.path.split("/").pop()!;
const configUri = (uri: vscode.Uri) => vscode.Uri.joinPath(uri, "..", sidecarName(nameOf(uri)));
const cancelled = (token: vscode.CancellationToken) => { if (token.isCancellationRequested) throw new vscode.CancellationError(); };
async function readOptional(uri: vscode.Uri, limit: number): Promise<Uint8Array | null> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.type !== vscode.FileType.File || stat.size > limit) throw new Error(`${nameOf(uri)} 不是支持的文件或超过大小限制。`);
    return await vscode.workspace.fs.readFile(uri);
  } catch (e) { if (e instanceof vscode.FileSystemError && e.code === "FileNotFound") return null; throw e; }
}
async function removeIfPresent(uri: vscode.Uri) { try { await vscode.workspace.fs.delete(uri); } catch (e) { if (!(e instanceof vscode.FileSystemError && e.code === "FileNotFound")) throw e; } }
interface Backup {
  schema: "gameflow.psd-draft"; version: 1; source: string; sourceHash: string;
  draft: PsdDraft; baseline: PsdDraft; configHash: string | null; needsSave: boolean; sourceBase64?: string; configReadIssue?: string;
}
function parseBackup(bytes: Uint8Array, uri: vscode.Uri): Backup {
  const raw = JSON.parse(new TextDecoder().decode(bytes)) as Backup;
  if (raw?.configReadIssue !== undefined && (typeof raw.configReadIssue !== "string" || raw.configReadIssue.length > 4096)) throw new Error("PSD 草稿诊断格式无效。");
  if (raw?.schema !== "gameflow.psd-draft" || raw.version !== 1 || raw.source !== uri.toString() || !/^[a-f0-9]{64}$/.test(raw.sourceHash) || !isPsdDraft(raw.draft) || !isPsdDraft(raw.baseline) || raw.draft.sourceHash !== raw.sourceHash || raw.baseline.sourceHash !== raw.sourceHash || typeof raw.needsSave !== "boolean" || (raw.configHash !== null && !/^[a-f0-9]{64}$/.test(raw.configHash))) throw new Error("PSD 草稿备份无效，已保留备份文件。");
  return raw;
}

export class PsdDocument implements vscode.CustomDocument {
  readonly panels = new Set<vscode.WebviewPanel>();
  readonly flushes = new Map<string, () => void>();
  backup: PsdEditorState["backup"] = "none";
  error?: string; notice?: string; warning?: string; configReadIssue?: string; disposed = false; announced = false;
  onDispose?: () => void;
  private operations: Promise<unknown> = Promise.resolve();
  constructor(readonly uri: vscode.Uri, public bytes: Uint8Array, readonly model: PsdDocumentModel, readonly cache: vscode.Uri) {}
  enqueue<T>(operation: () => Promise<T>): Promise<T> { const result = this.operations.then(operation); this.operations = result.catch(() => {}); return result; }
  state(extra: Partial<PsdEditorState> = {}): PsdEditorState { return { type: "psdEditorState", version: this.model.version, draft: makePsdDraft(this.model.asset), dirty: this.model.dirty, backup: this.backup, error: this.error, warning: this.warning ?? (this.configReadIssue ? `已有配置未能自动读取：${this.configReadIssue}。原文件已保留，请修复后保存或导出 PSD 副本。` : undefined), ...extra }; }
  async broadcast(extra: Partial<PsdEditorState> = {}) { await Promise.all([...this.panels].map(panel => panel.webview.postMessage(this.state(extra)))); }
  envelope(): Backup { return { schema: "gameflow.psd-draft", version: 1, source: this.uri.toString(), sourceHash: this.model.asset.sourceHash, draft: makePsdDraft(this.model.asset), baseline: this.model.baseline, configHash: this.model.configHash, needsSave: this.model.needsSave, configReadIssue: this.configReadIssue }; }
  dispose() { this.disposed = true; this.panels.clear(); this.onDispose?.(); }
}

export class PsdEditorProvider implements vscode.CustomEditorProvider<PsdDocument> {
  readonly settings: WorkbenchSettingsController;
  readonly documents = new Map<string, PsdDocument>();
  private readonly changes = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<PsdDocument>>();
  readonly onDidChangeCustomDocument = this.changes.event;
  constructor(private readonly context: vscode.ExtensionContext) { this.settings = new WorkbenchSettingsController(context); context.subscriptions.push(this.changes, this.settings); }
  async open(uri?: vscode.Uri) {
    if (!uri) uri = (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Photoshop: ["psd"] }, openLabel: "打开 PSD 配置" }))?.[0];
    if (!uri) return;
    if (!/\.psd$/i.test(uri.path)) throw new Error("请选择 PSD 文件。");
    await vscode.commands.executeCommand("vscode.openWith", uri, PSD_EDITOR_VIEW_TYPE, { preview: false });
  }
  async openCustomDocument(uri: vscode.Uri, context: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken, options?: { preview?: boolean; acceptChangedSource?: boolean }): Promise<PsdDocument> {
    if (this.documents.has(uri.toString())) throw new Error("此 PSD 已在工作台或配置编辑器中打开，请先关闭原会话。");
    const cache = vscode.Uri.joinPath(this.context.globalStorageUri, "psd-drafts", bytesHash(new TextEncoder().encode(uri.toString())));
    let backup: Backup | undefined;
    if (context.backupId) {
      const raw = await readOptional(vscode.Uri.parse(context.backupId), 48 * 1024 * 1024);
      if (!raw) throw new Error("PSD 恢复备份不存在。");
      backup = parseBackup(raw, uri);
    } else {
      const raw = await readOptional(vscode.Uri.joinPath(cache, "draft.json"), 3 * 1024 * 1024);
      if (raw) backup = parseBackup(raw, uri);
    }
    cancelled(token);
    let bytes = backup?.sourceBase64 ? new Uint8Array(Buffer.from(backup.sourceBase64, "base64")) : await readOptional(uri, 32 * 1024 * 1024);
    if (!bytes && backup) bytes = await readOptional(vscode.Uri.joinPath(cache, "source.psd"), 32 * 1024 * 1024);
    if (!bytes) throw new Error("PSD 源文件不存在。");
    if (backup && bytesHash(bytes) !== backup.sourceHash) {
      const cached = await readOptional(vscode.Uri.joinPath(cache, "source.psd"), 32 * 1024 * 1024);
      if (!cached || bytesHash(cached) !== backup.sourceHash) throw new Error("源 PSD 已变化，草稿快照无法恢复；原草稿已保留。");
      bytes = cached;
    }
    let asset = createPsdStructure(parsePsdBinary(bytes), nameOf(uri), bytesHash(bytes));
    const savedBytes = await readOptional(configUri(uri), 1024 * 1024);
    let notice: string | undefined, configReadIssue: string | undefined;
    if (savedBytes && !backup) {
      let matched: PsdAsset | undefined, changedSource = false;
      try {
        const raw = JSON.parse(new TextDecoder().decode(savedBytes));
        matched = applySidecar(asset, raw); changedSource = raw.source.sha256 !== asset.sourceHash;
      } catch (error) { configReadIssue = message(error); notice = `已有配置未能自动读取：${configReadIssue} 原文件已保留。可修复身份后读取配置，或另存为 PSD 副本。`; }
      if (matched) {
        if (changedSource) {
          if (options?.preview && !options.acceptChangedSource) throw new Error("PSD 已变化，请重新绑定并确认采用已有配置。");
          const answer = await vscode.window.showWarningMessage("PSD 已变化，是否按图层身份采用已有配置？", { modal: true }, "采用配置");
          if (answer !== "采用配置") throw new vscode.CancellationError();
          notice = "已按图层身份读取配置，请检查后保存。";
        }
        asset = matched;
      }
    }
    const model = new PsdDocumentModel(asset, savedBytes ? bytesHash(savedBytes) : null, !savedBytes || !!notice);
    if (backup) { model.restore(backup.draft, backup.baseline); model.configHash = backup.configHash; model.needsSave = backup.needsSave; configReadIssue = backup.configReadIssue; notice = "已恢复未保存草稿，请检查后保存配置。"; }
    else if (!savedBytes) notice = "已新建切图配置，Ctrl+S 保存到 PSD 同目录。";
    if (options?.preview && !backup && !savedBytes && asset.hasEmbeddedIdentity) { model.needsSave = false; notice = undefined; }
    const doc = new PsdDocument(uri, bytes, model, cache); doc.notice = notice; doc.configReadIssue = configReadIssue;
    if (backup) doc.backup = "saved";
    cancelled(token); this.documents.set(uri.toString(), doc);
    doc.onDispose = () => { if (this.documents.get(uri.toString()) === doc) this.documents.delete(uri.toString()); };
    return doc;
  }
  private editEvent(doc: PsdDocument, before: PsdDraft, after: PsdDraft, label = "修改 PSD 配置", initial = false) {
    const needsSave = doc.model.needsSave;
    this.changes.fire({ document: doc, label,
      undo: async () => { doc.model.restore(before); if (initial) doc.model.needsSave = false; await doc.broadcast(); this.backupSoon(doc); },
      redo: async () => { doc.model.restore(after); if (initial) doc.model.needsSave = needsSave; await doc.broadcast(); this.backupSoon(doc); }
    });
  }
  private backupSoon(doc: PsdDocument) {
    doc.backup = doc.model.dirty ? "pending" : "none";
    void doc.enqueue(async () => {
      await vscode.workspace.fs.createDirectory(doc.cache);
      if (!doc.model.dirty) { await this.clearDraft(doc); doc.backup = "none"; }
      else {
        const revision = doc.model.version, payload = doc.envelope();
        const sourceUri = vscode.Uri.joinPath(doc.cache, "source.psd");
        const existing = await readOptional(sourceUri, 32 * 1024 * 1024);
        if (!existing || bytesHash(existing) !== payload.sourceHash) await atomicWrite(sourceUri, doc.bytes);
        await atomicWrite(vscode.Uri.joinPath(doc.cache, "draft.json"), new TextEncoder().encode(JSON.stringify(payload)));
        if (doc.model.version === revision) { doc.backup = "saved"; if (doc.error?.startsWith("草稿备份失败")) doc.error = undefined; }
      }
      if (!doc.disposed) await doc.broadcast();
    }).catch(error => { doc.backup = "error"; doc.error = `草稿备份失败：${message(error)}`; if (!doc.disposed) void doc.broadcast(); });
  }
  private async clearDraft(doc: PsdDocument) {
    await removeIfPresent(vscode.Uri.joinPath(doc.cache, "draft.json"));
    await removeIfPresent(vscode.Uri.joinPath(doc.cache, "source.psd"));
  }
  async edit(doc: PsdDocument, draft: PsdDraft, baseVersion: number) {
    const before = makePsdDraft(doc.model.asset);
    if (doc.model.update(draft, baseVersion)) { this.editEvent(doc, before, makePsdDraft(doc.model.asset)); this.backupSoon(doc); }
  }
  async resolveCustomEditor(doc: PsdDocument, panel: vscode.WebviewPanel): Promise<void> {
    configureGameFlowWebview(panel.webview, this.context.extensionUri, `${nameOf(doc.uri)} · 切图配置`, "psd");
    const attachment = this.attach(doc, panel, () => this.open());
    this.attachRenderer(panel, hash => hash === doc.model.asset.sourceHash ? doc.bytes : undefined);
    const settings = this.settings.attach(panel, doc.uri);
    panel.onDidDispose(() => { attachment.dispose(); settings.dispose(); });
  }
  attachRenderer(panel: vscode.WebviewPanel, source: (hash: string) => Uint8Array | undefined | Promise<Uint8Array | undefined>) {
    const listener = panel.webview.onDidReceiveMessage(async raw => {
      if (raw?.type !== "psdRenderSlice" || !isWebviewToHostMessage(raw) || raw.type !== "psdRenderSlice") return;
      try {
        const bytes = await source(raw.sourceHash);
        if (!bytes || bytesHash(bytes) !== raw.sourceHash) throw new Error("PSD 快照已变化，请重新打开切图。");
        const executable = vscode.workspace.getConfiguration("gameflow").get<string>("photoCraftCliPath", "").trim();
        const image = await renderPhotoCraft(bytes, raw.keys, executable);
        await panel.webview.postMessage({ type: "psdRenderSliceResult", requestId: raw.requestId, image } satisfies HostToWebviewMessage);
      } catch (error) {
        await panel.webview.postMessage({ type: "psdRenderSliceResult", requestId: raw.requestId, error: message(error) } satisfies HostToWebviewMessage);
      }
    });
    panel.onDidDispose(() => listener.dispose());
  }
  async initialize(doc: PsdDocument, panel: vscode.WebviewPanel) {
    await panel.webview.postMessage({ type: "psdEditorInit", sourceUri: doc.uri.toString(), name: nameOf(doc.uri), base64: Buffer.from(doc.bytes).toString("base64"), state: doc.state(), configPath: configUri(doc.uri).fsPath, notice: doc.notice } satisfies PsdEditorMessage);
    this.announce(doc);
  }
  announce(doc: PsdDocument) {
    if (doc.model.dirty && !doc.announced) { doc.announced = true; this.editEvent(doc, doc.model.baseline, makePsdDraft(doc.model.asset), "打开未保存 PSD 配置", true); this.backupSoon(doc); }
  }
  attach(doc: PsdDocument, panel: vscode.WebviewPanel, open: () => Promise<unknown>): vscode.Disposable {
    doc.panels.add(panel);
    const exports = new PsdExportController(this.settings, { uri: doc.uri }, () => psdExportDirectory(doc.model.asset));
    const subscription = panel.webview.onDidReceiveMessage(async (raw: unknown) => {
      if (isPsdEditorRequest(raw)) {
        if (raw.type === "psdEditorReady") {
          await this.initialize(doc, panel);
        } else if (raw.type === "psdEditorFlushed") { doc.flushes.get(raw.requestId)?.(); }
        else if (raw.type === "psdEditorEdit") {
          try {
            await this.edit(doc, raw.draft, raw.baseVersion);
            await doc.broadcast({ requestId: raw.requestId });
          } catch (error) { await panel.webview.postMessage(doc.state({ requestId: raw.requestId, rejected: true, error: message(error) })); }
        } else {
          try {
            if (raw.action === "save") await vscode.commands.executeCommand("workbench.action.files.save");
            else if (raw.action === "copy") await this.copy(doc);
            else await vscode.commands.executeCommand(raw.action);
            await panel.webview.postMessage({ type: "psdEditorCommandResult", requestId: raw.requestId, ...(raw.action === "save" && doc.error ? { error: doc.error } : {}) } satisfies PsdEditorMessage);
          } catch (error) { await panel.webview.postMessage({ type: "psdEditorCommandResult", requestId: raw.requestId, error: message(error) } satisfies PsdEditorMessage); }
        }
      } else if (isWebviewToHostMessage(raw) && raw.type === "openPsdEditor") { try { await open(); } catch (error) { void vscode.window.showErrorMessage(message(error)); } }
      else if (isWebviewToHostMessage(raw) && raw.type === "psdResourceExport") {
        try {
          const count = raw.action === "export" ? await exports.export(raw.batch!) : undefined;
          const wasCancelled = raw.action === "choose" ? !await exports.choose() : count === null;
          await panel.webview.postMessage({ type: "psdResourceExportResult", requestId: raw.requestId, directory: exports.directoryLabel, ...(typeof count === "number" ? { count } : {}), cancelled: wasCancelled } satisfies HostToWebviewMessage);
        } catch (error) { await panel.webview.postMessage({ type: "psdResourceExportResult", requestId: raw.requestId, error: message(error), ...(error instanceof SliceExportConflict ? { conflicts: error.conflicts } : {}) } satisfies HostToWebviewMessage); }
      }
    });
    return new vscode.Disposable(() => { subscription.dispose(); doc.panels.delete(panel); });
  }
  async flush(doc: PsdDocument) {
    if (!doc.panels.size) return;
    const requestId = crypto.randomUUID();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        doc.flushes.set(requestId, resolve);
        timeout = setTimeout(() => reject(new Error("PSD 修改尚未完成同步，请稍后重试；当前草稿已保留。")), 10000);
        for (const panel of doc.panels) void panel.webview.postMessage({ type: "psdEditorFlush", requestId } satisfies PsdEditorMessage);
      });
    } finally { if (timeout) clearTimeout(timeout); doc.flushes.delete(requestId); }
  }
  async saveCustomDocument(doc: PsdDocument, token: vscode.CancellationToken): Promise<void> {
    await this.flush(doc);
    await doc.enqueue(async () => {
      cancelled(token);
      try {
        makeSidecar(doc.model.asset);
        if (doc.configReadIssue) {
          const answer = await vscode.window.showWarningMessage(`已有配置未能读取：${doc.configReadIssue}。是否用当前配置替换？`, { modal: true }, "用当前配置替换");
          if (answer !== "用当前配置替换") throw new vscode.CancellationError();
        }
        await doc.model.save({
          readSource: async () => { const data = await readOptional(doc.uri, 32 * 1024 * 1024); if (!data) throw new Error("源 PSD 不存在。"); return data; },
          readConfig: async () => {
            if (vscode.workspace.textDocuments.some(d => d.uri.toString() === configUri(doc.uri).toString() && d.isDirty)) throw new Error("配置文件在文本编辑器中有未保存修改。");
            return readOptional(configUri(doc.uri), 1024 * 1024);
          },
          writeConfig: async bytes => { cancelled(token); await atomicWrite(configUri(doc.uri), bytes); }
        });
        doc.error = undefined; doc.configReadIssue = undefined; doc.notice = undefined; doc.warning = undefined;
        if (!doc.model.dirty) { await this.clearDraft(doc); doc.backup = "none"; }
        await doc.broadcast();
      } catch (error) { doc.error = message(error); await doc.broadcast(); throw error; }
    });
    if (doc.model.dirty) this.backupSoon(doc);
  }
  async revertCustomDocument(doc: PsdDocument, token: vscode.CancellationToken): Promise<void> {
    await doc.enqueue(async () => {
      cancelled(token);
      try {
        const bytes = await readOptional(doc.uri, 32 * 1024 * 1024); if (!bytes) throw new Error("源 PSD 不存在。");
        const config = await readOptional(configUri(doc.uri), 1024 * 1024);
        let asset = createPsdStructure(parsePsdBinary(bytes), nameOf(doc.uri), bytesHash(bytes));
        if (config) asset = applySidecar(asset, JSON.parse(new TextDecoder().decode(config)));
        else if (asset.sourceHash === doc.model.asset.sourceHash) asset = applyPsdDraft(asset, doc.model.baseline, true);
        doc.bytes = bytes; doc.model.reset(asset, config ? bytesHash(config) : null); doc.notice = undefined; doc.warning = undefined; doc.configReadIssue = undefined;
      } catch (error) {
        // Explicit discard must remain possible even if an external file was removed/damaged.
        doc.model.reset(applyPsdDraft(doc.model.asset, doc.model.baseline), doc.model.configHash);
        doc.warning = `已放弃本次修改；外部文件暂时无法读取：${message(error)}。请重新打开后核对。`;
      }
      doc.error = undefined; doc.backup = "none"; await this.clearDraft(doc);
      for (const panel of doc.panels) await panel.webview.postMessage({ type: "psdEditorInit", name: nameOf(doc.uri), base64: Buffer.from(doc.bytes).toString("base64"), state: doc.state(), configPath: configUri(doc.uri).fsPath, notice: doc.notice } satisfies PsdEditorMessage);
    });
  }
  async backupCustomDocument(doc: PsdDocument, context: vscode.CustomDocumentBackupContext, token: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
    await this.flush(doc);
    await doc.enqueue(async () => {
      cancelled(token);
      const payload: Backup = { ...doc.envelope(), sourceBase64: Buffer.from(doc.bytes).toString("base64") };
      await atomicWrite(context.destination, new TextEncoder().encode(JSON.stringify(payload)));
    });
    return { id: context.destination.toString(), delete: async () => { await removeIfPresent(context.destination); } };
  }
  async saveCustomDocumentAs(doc: PsdDocument, destination: vscode.Uri, token: vscode.CancellationToken): Promise<void> {
    if (destination.toString() === doc.uri.toString()) return this.saveCustomDocument(doc, token);
    const stamp = await this.writeCopy(doc, destination, token);
    await doc.enqueue(async () => {
      if (draftStamp(doc.model.asset) === stamp) { doc.model.reset(doc.model.asset, doc.model.configHash); await this.clearDraft(doc); }
    });
    if (doc.model.dirty) this.backupSoon(doc);
  }
  private async writeCopy(doc: PsdDocument, destination: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
    cancelled(token);
    if (!/\.psd$/i.test(destination.path)) throw new Error("PSD 配置另存为需要 .psd 后缀。");
    await this.flush(doc);
    if (vscode.workspace.textDocuments.some(d => d.uri.toString() === destination.toString() && d.isDirty)) throw new Error("目标 PSD 有未保存修改，请另选路径。");
    if (await readOptional(configUri(destination), 1024 * 1024)) throw new Error("目标 PSD 已有同名配置，请另选副本路径，避免旧配置覆盖副本元数据。");
    // Embed the current metadata so a newly opened copy can reconstruct its identities.
    const stamp = draftStamp(doc.model.asset), meta = makeSidecar(doc.model.asset);
    const bytes = patchPsdMetadata(doc.bytes, new Map(meta.layers.map(l => [l.sourceKey, l.metadata])));
    const config = makeSidecar(createPsdStructure(parsePsdBinary(bytes), nameOf(destination), bytesHash(bytes)));
    const before = await readOptional(destination, 32 * 1024 * 1024);
    cancelled(token); await atomicWrite(destination, bytes);
    try { await atomicWrite(configUri(destination), new TextEncoder().encode(JSON.stringify(config, null, 2) + "\n")); }
    catch (error) {
      try { if (before) await atomicWrite(destination, before); else await removeIfPresent(destination); }
      catch (rollback) { throw new Error(`副本配置写入失败：${message(error)}；PSD 恢复失败：${message(rollback)}`); }
      throw error;
    }
    return stamp;
  }
  private async copy(doc: PsdDocument) {
    const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(doc.uri, "..", nameOf(doc.uri).replace(/\.psd$/i, "-configured.psd")), filters: { Photoshop: ["psd"] }, saveLabel: "写入 PSD 副本" });
    if (!target) return;
    if (target.toString() === doc.uri.toString()) throw new Error("请另选 PSD 副本路径，常规保存使用 .meta.json。");
    const cancellation = new vscode.CancellationTokenSource();
    try { await this.writeCopy(doc, target, cancellation.token); } finally { cancellation.dispose(); }
  }
}
