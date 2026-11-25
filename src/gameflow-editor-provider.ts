import * as vscode from "vscode";
import { rename } from "node:fs/promises";
import { parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument } from "../shared/model";
import { isWebviewToHostMessage, type HostToWebviewMessage } from "../shared/protocol";
import { isPsdEditorRequest, type PsdEditorMessage } from "../shared/psd-editor-protocol";
import { configureGameFlowWebview } from "./webview-html";
import { CanvasReferenceController, type CanvasDocumentAccess, type CanvasText } from "./canvas-reference-controller";
import { PsdEditorProvider } from "./psd-editor-provider";
import { bytesHash } from "./psd-document-model";
import { WorkbenchDocument } from "./workbench-document";
import { readWorkbenchSlices } from "./slice-resource-controller";

import { PagePsdController, rebasePagePsds } from "./page-psd-controller";
import { exportPrefab, inspectPrefabFile } from "./prefab-export-controller";

export const GAMEFLOW_EDITOR_VIEW_TYPE = "gameflow.canvasEditor";
const explain = (error: unknown) => error instanceof Error ? error.message : String(error);
interface Checkpoint {
  schema: "gameflow.workbench-draft"; version: 1; source: string;
  text: string; baseline: string; diskHash: string; psds: string[]; currentPsd?: string;
  backups?: { source: string; id: string }[];
}
async function read(uri: vscode.Uri) { return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)); }
async function optional(uri: vscode.Uri) { try { return await read(uri); } catch (error) { if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") return undefined; throw error; } }
async function remove(uri: vscode.Uri) { try { await vscode.workspace.fs.delete(uri); } catch (error) { if (!(error instanceof vscode.FileSystemError && error.code === "FileNotFound")) throw error; } }
async function write(uri: vscode.Uri, text: string) {
  const temp = uri.with({ path: `${uri.path}.${crypto.randomUUID()}.tmp` });
  try { await vscode.workspace.fs.writeFile(temp, new TextEncoder().encode(text)); await vscode.workspace.fs.rename(temp, uri, { overwrite: true }); }
  finally { await remove(temp); }
}
async function writeCanvas(uri: vscode.Uri, text: string) {
  // workspace.fs.rename emits a workbench file-move operation. Replacing the
  // active custom resource that way disposes/recreates it from a stale backup.
  if (uri.scheme !== "file") { await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text)); return; }
  const temp = uri.with({ path: `${uri.path}.${crypto.randomUUID()}.tmp` });
  try { await vscode.workspace.fs.writeFile(temp, new TextEncoder().encode(text)); await rename(temp.fsPath, uri.fsPath); }
  finally { await remove(temp); }
}

/** One native working copy owns the prototype and its PSD configuration sessions. */
export class GameFlowEditorProvider implements vscode.CustomEditorProvider<WorkbenchDocument> {
  readonly documents = new Map<string, WorkbenchDocument>();
  private readonly pagePsds: PagePsdController;
  private readonly changes = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<WorkbenchDocument>>();
  private readonly uriChanges = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChangeCustomDocument = this.changes.event;
  constructor(private readonly context: vscode.ExtensionContext, readonly psd: PsdEditorProvider) {
    this.pagePsds = new PagePsdController(psd, (doc, uri, checkBinding) => this.openPsd(doc, uri, checkBinding));
    context.subscriptions.push(this.changes, this.uriChanges, psd.onDidChangeCustomDocument(event => {
      const owner = [...this.documents.values()].find(doc => doc.psds.get(event.document.uri.toString()) === event.document);
      if (!owner) return;
      this.changes.fire({ document: owner, label: event.label,
        undo: async () => { await event.undo(); for (const panel of owner.panels) void panel.webview.postMessage({ type: "pagePsdChanged", documentId: event.document.model.asset.documentId } satisfies HostToWebviewMessage); await owner.refresh(); this.checkpoint(owner); },
        redo: async () => { await event.redo(); for (const panel of owner.panels) void panel.webview.postMessage({ type: "pagePsdChanged", documentId: event.document.model.asset.documentId } satisfies HostToWebviewMessage); await owner.refresh(); this.checkpoint(owner); }
      });
      for (const panel of owner.panels) void panel.webview.postMessage({ type: "pagePsdChanged", documentId: event.document.model.asset.documentId } satisfies HostToWebviewMessage);
      void owner.refresh(); this.checkpoint(owner);
    }));
  }
  get activeDocument() { return [...this.documents.values()].find(doc => [...doc.panels].some(panel => panel.active)); }
  private stateKey(uri: vscode.Uri) { return `gameflow.workbench.psd.${uri.toString()}`; }
  private envelope(doc: WorkbenchDocument): Checkpoint {
    return { schema: "gameflow.workbench-draft", version: 1, source: doc.uri.toString(), text: doc.getText(), baseline: doc.baseline, diskHash: doc.diskHash, psds: [...doc.psds.keys()], currentPsd: doc.currentPsd?.uri.toString() };
  }
  private checkpoint(doc: WorkbenchDocument) {
    void doc.enqueue(async () => {
      if (!doc.dirty) { await remove(doc.cache); return; }
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(doc.cache, ".."));
      await write(doc.cache, JSON.stringify(this.envelope(doc)));
    }).catch(error => { if (!doc.disposed) void vscode.window.showErrorMessage(`工作台草稿备份失败：${explain(error)}`); });
  }
  async openCustomDocument(uri: vscode.Uri, context: vscode.CustomDocumentOpenContext, cancellation: vscode.CancellationToken): Promise<WorkbenchDocument> {
    const cache = vscode.Uri.joinPath(this.context.globalStorageUri, "workbench-drafts", `${bytesHash(new TextEncoder().encode(uri.toString()))}.json`);
    const raw = await optional(context.backupId ? vscode.Uri.parse(context.backupId) : cache);
    let recovery: Checkpoint | undefined;
    if (raw) {
      const value = JSON.parse(raw) as Checkpoint;
      if (value.schema !== "gameflow.workbench-draft" || value.version !== 1 || value.source !== uri.toString() || typeof value.text !== "string" || typeof value.baseline !== "string" || !/^[a-f0-9]{64}$/.test(value.diskHash) || !Array.isArray(value.psds) || value.psds.length > 32 || value.psds.some(source => typeof source !== "string" || !/\.psd$/i.test(vscode.Uri.parse(source).path))) throw new Error("工作台恢复草稿格式无效，原草稿已保留。");
      parseGameFlowDocument(value.text); recovery = value;
    }
    const doc = new WorkbenchDocument(uri, recovery?.text ?? await read(uri), cache);
    if (recovery) { doc.baseline = recovery.baseline; doc.diskHash = recovery.diskHash; }
    this.documents.set(uri.toString(), doc);
    doc.onDispose = () => { if (this.documents.get(uri.toString()) === doc) this.documents.delete(uri.toString()); };
    try {
      const last = recovery?.currentPsd ?? this.context.workspaceState.get<string>(this.stateKey(uri));
      for (const source of new Set([...(recovery?.psds ?? []), ...(last ? [last] : [])])) {
        const existing = this.psd.documents.get(source);
        if (existing && !existing.disposed) { if (recovery) throw new Error("恢复的 PSD 已在另一会话打开，草稿已保留。"); void vscode.window.showWarningMessage("上次的 PSD 已在其他工作台中打开，请在那里编辑或先关闭该工作台。"); continue; }
        try {
          const psd = await this.psd.openCustomDocument(vscode.Uri.parse(source), { backupId: recovery?.backups?.find(item => item.source === source)?.id, untitledDocumentData: undefined }, cancellation);
          doc.psds.set(source, psd); if (source === last) doc.currentPsd = psd;
        } catch (error) { if (recovery) throw error; void vscode.window.showWarningMessage(`未能重开上次的 PSD：${explain(error)}`); }
      }
      if (cancellation.isCancellationRequested) throw new vscode.CancellationError();
      return doc;
    } catch (error) { doc.dispose(); throw error; }
  }
  private access(owner: WorkbenchDocument): CanvasDocumentAccess {
    return { onDidChange: this.uriChanges.event, open: async uri => this.documents.get(uri.toString()) ?? vscode.workspace.openTextDocument(uri), apply: updates => this.apply(owner, updates) };
  }
  async apply(owner: WorkbenchDocument, updates: { document: CanvasText; version: number; text: string }[]) {
    const changes = updates.filter(update => update.text !== update.document.getText()).map(update => ({ ...update, before: update.document.getText() }));
    if (!changes.length) return;
    const set = async (forward: boolean, initial = false) => {
      const desired = (change: typeof changes[number]) => forward ? change.text : change.before;
      if (!initial && changes.every(change => change.document.getText() === desired(change))) return;
      for (const change of changes) {
        if (change.document.getText() !== (forward ? change.before : change.text) || initial && change.document.version !== change.version) throw new Error("文档在应用期间变化，本次修改未覆盖新内容。");
      }
      const edit = new vscode.WorkspaceEdit();
      for (const change of changes) if (!(change.document instanceof WorkbenchDocument)) {
        const document = change.document as vscode.TextDocument;
        edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), desired(change));
      }
      if (edit.size && !await vscode.workspace.applyEdit(edit)) throw new Error("未能应用到源组件，本地覆盖已保留。");
      for (const change of changes) if (change.document instanceof WorkbenchDocument) {
        change.document.replace(desired(change)); this.uriChanges.fire(change.document.uri);
        if (!initial) { await change.document.refresh(); this.checkpoint(change.document); }
      }
    };
    await set(true, true);
    this.changes.fire({ document: owner, label: "修改工作台", undo: () => set(false), redo: () => set(true) });
    for (const change of changes) if (change.document instanceof WorkbenchDocument && change.document !== owner) this.changes.fire({ document: change.document, label: "应用源组件修改", undo: () => set(false), redo: () => set(true) });
    for (const change of changes) if (change.document instanceof WorkbenchDocument) { await change.document.refresh(); this.checkpoint(change.document); }
    this.checkpoint(owner);
  }
  async openPsd(doc: WorkbenchDocument, uri?: vscode.Uri, checkBinding?: () => void) {
    if (!uri) uri = (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Photoshop: ["psd"] }, openLabel: "在工作台打开 PSD" }))?.[0];
    if (!uri || doc.disposed) return;
    if (!/\.psd$/i.test(uri.path)) throw new Error("请选择 PSD 文件。");
    const source = uri.toString();
    if (source === doc.currentPsd?.uri.toString()) {
      for (const panel of doc.panels) await panel.webview.postMessage({ type: "psdEditorReveal" } satisfies PsdEditorMessage);
      return;
    }
    if (this.psd.documents.has(source) && !doc.psds.has(source)) throw new Error("此 PSD 已在其他工作台或编辑器中打开，请先关闭该会话。");
    if (doc.currentPsd) {
      await this.psd.flush(doc.currentPsd);
      if (doc.currentPsd.model.dirty) {
        const answer = await vscode.window.showWarningMessage("当前 PSD 配置尚未保存。打开其他 PSD 前如何处理？", { modal: true }, "保存并打开", "不保存并打开");
        if (!answer) return;
        checkBinding?.();
        const cancellation = new vscode.CancellationTokenSource();
        try {
          if (answer === "保存并打开") { await vscode.commands.executeCommand("workbench.action.files.save"); if (doc.currentPsd.model.dirty) throw new Error("PSD 配置尚未保存，请处理保存错误后重试。"); }
          else await this.psd.revertCustomDocument(doc.currentPsd, cancellation.token);
        } finally { cancellation.dispose(); }
      }
    }
    if (doc.psds.size >= 32 && !doc.psds.has(source)) throw new Error("本工作台已打开过 32 份 PSD，请保存并重新打开工作台。");
    const cancellation = new vscode.CancellationTokenSource();
    let psd = doc.psds.get(source);
    try { psd ??= await this.psd.openCustomDocument(uri, { backupId: undefined, untitledDocumentData: undefined }, cancellation.token); }
    finally { cancellation.dispose(); }
    if (doc.disposed) { psd.dispose(); return; }
    checkBinding?.();
    doc.attachment?.dispose(); doc.psds.set(source, psd); doc.currentPsd = psd;
    for (const panel of doc.panels) {
      doc.attachment = this.psd.attach(psd, panel, () => this.openPsd(doc));
      await panel.webview.postMessage({ type: "psdEditorReveal" } satisfies PsdEditorMessage);
      await this.psd.initialize(psd, panel);
    }
    await this.context.workspaceState.update(this.stateKey(doc.uri), source); this.checkpoint(doc);
  }
  async resolveCustomEditor(doc: WorkbenchDocument, panel: vscode.WebviewPanel): Promise<void> {
    configureGameFlowWebview(panel.webview, this.context.extensionUri, doc.uri.fsPath);
    doc.panels.add(panel);
    const settings = this.psd.settings.attach(panel, doc.uri);
    const references = new CanvasReferenceController(doc, panel.webview, this.access(doc));
    const snapshot = async (kind: "init" | "documentChanged" = "documentChanged") => {
      try {
        const document = parseGameFlowDocument(doc.getText());
        await panel.webview.postMessage({ type: kind, document, documentVersion: doc.version, dirty: doc.dirty, ...(kind === "init" ? { resourceName: doc.uri.path.split("/").pop()! } : {}) } as HostToWebviewMessage);
        void references.refresh(document);
      } catch (error) { await panel.webview.postMessage({ type: "documentError", message: "当前文档不是有效的 GameFlow 文档。", details: [explain(error)] } satisfies HostToWebviewMessage); }
    };
    doc.refreshers.add(snapshot);
    if (doc.currentPsd) doc.attachment = this.psd.attach(doc.currentPsd, panel, () => this.openPsd(doc));
    const subscription = panel.webview.onDidReceiveMessage(async (raw: unknown) => {
      if (isPsdEditorRequest(raw) || !isWebviewToHostMessage(raw)) return;
      try {
        if (raw.type === "ready") {
          await snapshot("init");
          if (doc.canvasDirty && !doc.announced) {
            doc.announced = true; const recovered = doc.getText();
            const restore = async (text: string) => { doc.replace(text); await doc.refresh(); this.checkpoint(doc); };
            this.changes.fire({ document: doc, label: "恢复工作台草稿", undo: () => restore(doc.baseline), redo: () => restore(recovered) }); this.checkpoint(doc);
          }
          for (const psd of doc.psds.values()) if (psd !== doc.currentPsd) this.psd.announce(psd);
        } else if (raw.type === "pagePsd") {
          const result = await this.pagePsds.handle(doc, raw, references.componentPsdAccess());
          if (raw.action === "syncCopy" && result.draft && result.source === raw.expected?.source) {
            for (const owner of this.documents.values()) for (const view of owner.panels)
              void view.webview.postMessage({ type: "pagePsdChanged", documentId: result.draft.documentId } satisfies HostToWebviewMessage);
          }
          await panel.webview.postMessage(result);
        } else if (raw.type === "psdOutput") {
          try {
            const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(doc.uri, "..", raw.name), filters: raw.kind === "psd" ? { Photoshop: ["psd"] } : { JSON: ["json"] } });
            if (uri) { if ([...doc.psds.values()].some(psd=>psd.uri.toString()===uri.toString()&&psd.model.dirty)) throw new Error("目标 PSD 有未保存修改。"); if (vscode.workspace.textDocuments.some(d=>d.uri.toString()===uri.toString() && d.isDirty)) throw new Error("目标文件有未保存修改。"); await vscode.workspace.fs.writeFile(uri,Buffer.from(raw.base64,"base64")); }
            await panel.webview.postMessage({ type:"psdOutputResult",requestId:raw.requestId,saved:!!uri } satisfies HostToWebviewMessage);
          } catch (error) { await panel.webview.postMessage({ type:"psdOutputResult",requestId:raw.requestId,saved:false,error:explain(error) } satisfies HostToWebviewMessage); }
        } else if(raw.type==="prefabInspect") {
          try {
            const version=doc.version;
            const snapshot=await inspectPrefabFile(this.psd.settings,raw.target,raw.images);
            await panel.webview.postMessage({type:"prefabInspectResult",requestId:raw.requestId,snapshot:{...snapshot,version}} satisfies HostToWebviewMessage);
          } catch(error) {await panel.webview.postMessage({type:"prefabInspectResult",requestId:raw.requestId,error:explain(error)} satisfies HostToWebviewMessage);}
        } else if(raw.type==="prefabCommit") {
          try {
            const check=()=>{if(doc.disposed || doc.version!==raw.baseVersion || raw.document.documentId!==parseGameFlowDocument(doc.getText()).documentId) throw new Error("原型已变化，请重新比较。");};
            check();
            const text=serializeGameFlowDocument(raw.document);
            const count=await exportPrefab(this.psd.settings,raw.batch,raw.guard,raw.root,async()=>{
              check();
              if(raw.guard.source!=="psd") await this.apply(doc,[{document:doc,version:raw.baseVersion,text}]);
            });
            await panel.webview.postMessage({type:"prefabExportResult",requestId:raw.requestId,count} satisfies HostToWebviewMessage);
          } catch(error) {await panel.webview.postMessage({type:"prefabExportResult",requestId:raw.requestId,error:explain(error)} satisfies HostToWebviewMessage);}
        } else if (raw.type === "prefabExport") {
          try { await panel.webview.postMessage({ type: "prefabExportResult", requestId: raw.requestId, count: await exportPrefab(this.psd.settings, raw.batch) } satisfies HostToWebviewMessage); }
          catch (error) { await panel.webview.postMessage({ type: "prefabExportResult", requestId: raw.requestId, error: explain(error) } satisfies HostToWebviewMessage); }
        } else if (raw.type === "sliceResources") {
          await panel.webview.postMessage({ type: "sliceResourcesResult", requestId: raw.requestId, resources: await readWorkbenchSlices(this.psd.settings, raw.paths) } satisfies HostToWebviewMessage);
        } else if (raw.type === "workbenchFlushed") doc.flushes.get(raw.requestId)?.();
        else if (raw.type === "openPsdEditor") { if (!doc.currentPsd) await this.openPsd(doc); }
        else if (raw.type === "chooseCanvasSource") await references.choose();
        else if (raw.type === "openCanvasSource") await references.open(raw.source);
        else if (raw.type === "applyCanvasOverrides") {
          await references.apply(raw.request, raw.expectedSources, raw.baseVersion); await snapshot();
          await panel.webview.postMessage({ type: "commandCompleted", action: "applyCanvas", requestId: raw.requestId } satisfies HostToWebviewMessage);
        } else if (raw.type === "save" || raw.type === "history") {
          await vscode.commands.executeCommand(raw.type === "save" ? "workbench.action.files.save" : raw.action);
          await snapshot(); await panel.webview.postMessage({ type: "commandCompleted", action: raw.type === "save" ? "save" : raw.action } satisfies HostToWebviewMessage);
        } else if (raw.type === "replaceDocument") {
          if (raw.baseVersion !== doc.version) throw new Error("文档已在其他位置更新，画布已刷新到最新版本。");
          const validation = validateGameFlowDocument(raw.document);
          if (!validation.ok) throw new Error(validation.errors.join("；"));
          await this.apply(doc, [{ document: doc, version: raw.baseVersion, text: serializeGameFlowDocument(validation.document) }]); await snapshot();
        }
      } catch (error) {
        await panel.webview.postMessage({ type: "updateRejected", reason: explain(error), currentVersion: doc.version } satisfies HostToWebviewMessage);
        void vscode.window.showErrorMessage(explain(error));
      }
    });
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.joinPath(doc.uri, ".."), doc.uri.path.split("/").pop()!));
    const changed = watcher.onDidChange(async () => {
      try {
        const text = await read(doc.uri), hash = bytesHash(new TextEncoder().encode(text));
        if (hash === doc.diskHash) return;
        if (!doc.canvasDirty) { doc.replace(text); doc.baseline = text; doc.diskHash = hash; this.uriChanges.fire(doc.uri); await doc.refresh(); }
      } catch { /* Save reports conflicts without replacing the in-memory draft. */ }
    });
    panel.onDidDispose(() => { settings.dispose(); subscription.dispose(); watcher.dispose(); changed.dispose(); references.dispose(); doc.refreshers.delete(snapshot); doc.panels.delete(panel); });
  }
  private async flush(doc: WorkbenchDocument) {
    if (doc.panels.size) {
      const requestId = crypto.randomUUID(); let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await new Promise<void>((resolve, reject) => {
          doc.flushes.set(requestId, resolve); timeout = setTimeout(() => reject(new Error("工作台修改尚未完成同步，草稿已保留。")), 10000);
          for (const panel of doc.panels) void panel.webview.postMessage({ type: "workbenchFlush", requestId } satisfies HostToWebviewMessage);
        });
      } finally { if (timeout) clearTimeout(timeout); doc.flushes.delete(requestId); }
    }
    if (doc.currentPsd) await this.psd.flush(doc.currentPsd);
  }
  async saveCustomDocument(doc: WorkbenchDocument, cancellation: vscode.CancellationToken): Promise<void> {
    await this.flush(doc);
    await doc.enqueue(async () => {
      if (cancellation.isCancellationRequested) throw new vscode.CancellationError();
      if (doc.canvasDirty) {
        parseGameFlowDocument(doc.getText());
        if (vscode.workspace.textDocuments.some(text => text.uri.toString() === doc.uri.toString() && text.isDirty)) throw new Error("原型在文本编辑器中有未保存修改，请先处理后重试。");
        if (bytesHash(new TextEncoder().encode(await read(doc.uri))) !== doc.diskHash) throw new Error("原型文件已被外部修改，未覆盖外部内容，工作台草稿已保留。");
      }
      for (const psd of doc.psds.values()) if (psd.model.dirty) await this.psd.saveCustomDocument(psd, cancellation);
      if (doc.canvasDirty) {
        const saved = doc.getText(); await writeCanvas(doc.uri, saved); doc.baseline = saved; doc.diskHash = bytesHash(new TextEncoder().encode(saved));
      }
      if (doc.dirty) throw new Error("保存期间出现了新修改，请再次保存。");
      await remove(doc.cache); await doc.refresh();
    });
  }
  async revertCustomDocument(doc: WorkbenchDocument, cancellation: vscode.CancellationToken): Promise<void> {
    await doc.enqueue(async () => {
      const text = await optional(doc.uri) ?? doc.baseline; doc.replace(text); doc.baseline = text; doc.diskHash = bytesHash(new TextEncoder().encode(text));
      for (const psd of doc.psds.values()) await this.psd.revertCustomDocument(psd, cancellation);
      await remove(doc.cache); this.uriChanges.fire(doc.uri); await doc.refresh();
    });
  }
  async saveCustomDocumentAs(doc: WorkbenchDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
    if (destination.toString() === doc.uri.toString()) return this.saveCustomDocument(doc, cancellation);
    if (!/\.gameflow\.json$/i.test(destination.path)) throw new Error("工作台另存为需要 .gameflow.json 后缀。");
    await this.flush(doc);
    if (cancellation.isCancellationRequested) throw new vscode.CancellationError();
    if (vscode.workspace.textDocuments.some(text => text.uri.toString() === destination.toString() && text.isDirty) || this.documents.get(destination.toString())?.dirty) throw new Error("目标文件有未保存修改。");
    for (const psd of doc.psds.values()) if (psd.model.dirty) await this.psd.saveCustomDocument(psd, cancellation);
    const saved = serializeGameFlowDocument(rebasePagePsds(parseGameFlowDocument(doc.getText()), doc.uri, destination)); await write(destination, saved); doc.baseline = doc.getText();
    await this.context.workspaceState.update(this.stateKey(destination), doc.currentPsd?.uri.toString()); await remove(doc.cache);
  }
  async backupCustomDocument(doc: WorkbenchDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
    await this.flush(doc);
    const backups: { source: string; id: string }[] = [];
    try {
      for (const psd of doc.psds.values()) {
        const backup = await this.psd.backupCustomDocument(psd, { destination: context.destination.with({ path: `${context.destination.path}.psd-${backups.length}` }) }, cancellation);
        backups.push({ source: psd.uri.toString(), id: backup.id });
      }
      await write(context.destination, JSON.stringify({ ...this.envelope(doc), backups } satisfies Checkpoint));
    } catch (error) { for (const backup of backups) await remove(vscode.Uri.parse(backup.id)); throw error; }
    return { id: context.destination.toString(), delete: async () => { for (const backup of backups) await remove(vscode.Uri.parse(backup.id)); await remove(context.destination); } };
  }
}
