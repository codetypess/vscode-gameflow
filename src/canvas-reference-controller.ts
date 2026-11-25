import * as vscode from "vscode";
import * as path from "node:path";
import { isCanvasReferenceSource, parseGameFlowDocument, serializeGameFlowDocument, type GameFlowDocument } from "../shared/model";
import { loadCanvasSources, type CanvasSources } from "../shared/canvas-references";
import { migrateDocumentElementIds } from "../shared/document-id-migration";
import type { HostToWebviewMessage } from "../shared/protocol";
import { canvasFingerprint, findOwnedCanvasNode, planCanvasApply, type CanvasApplyRequest } from "../shared/canvas-instances";

export type CanvasText = Pick<vscode.TextDocument, "uri" | "version" | "getText">;
export interface CanvasDocumentAccess {
  open(uri: vscode.Uri): Promise<CanvasText>;
  apply(updates: { document: CanvasText; version: number; text: string }[]): Promise<void>;
  onDidChange: vscode.Event<vscode.Uri>;
}

/** Per-editor dependency lifecycle; source refreshes never replace the edited document. */
export class CanvasReferenceController implements vscode.Disposable {
  private epoch = 0;
  private disposed = false;
  private sources: CanvasSources = {};
  private extra = new Set<string>();
  private watchers = new Map<string, vscode.Disposable>();
  private picked: string | undefined;
  private subscription: vscode.Disposable;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private document: CanvasText, private webview: vscode.Webview, private access?: CanvasDocumentAccess) {
    const textSubscription = vscode.workspace.onDidChangeTextDocument(event => {
      if (Object.keys(this.sources).some(source => this.uri(source).toString() === event.document.uri.toString())) this.schedule();
    });
    this.subscription = access ? vscode.Disposable.from(textSubscription, access.onDidChange(uri => { if (Object.keys(this.sources).some(source => this.uri(source).toString() === uri.toString())) this.schedule(); })) : textSubscription;
  }
  private uri(source: string) { return vscode.Uri.joinPath(this.document.uri, "..", source); }
  private post(message: HostToWebviewMessage) { if (!this.disposed) void this.webview.postMessage(message); }
  private schedule = () => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.refresh(); }, 50);
  };
  async refresh(current?: GameFlowDocument): Promise<void> {
    if (this.disposed) return;
    const epoch = ++this.epoch;
    try {
      const root = current ?? parseGameFlowDocument(this.document.getText());
      const sources = await loadCanvasSources(root, async source => {
        const uri = this.uri(source);
        if (this.access) return parseGameFlowDocument((await this.access.open(uri)).getText());
        const opened = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
        const text = opened?.isDirty ? opened.getText() : Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
        return parseGameFlowDocument(text);
      }, [...this.extra]);
      await Promise.all(Object.entries(sources).map(async ([source,entry])=>{try {const stat=await vscode.workspace.fs.stat(this.uri(source));entry.readOnly=!!(stat.permissions && stat.permissions & vscode.FilePermission.Readonly) || vscode.workspace.fs.isWritableFileSystem(this.document.uri.scheme) === false;} catch { /* Unavailable sources already carry their read diagnostic. */ }}));
      if (this.disposed || epoch !== this.epoch) return;
      this.sources = sources;
      for (const [source, watcher] of this.watchers) if (!sources[source]) { watcher.dispose(); this.watchers.delete(source); }
      for (const source of Object.keys(sources)) if (!this.watchers.has(source)) {
        const uri = this.uri(source);
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.joinPath(uri, ".."), path.posix.basename(uri.path)));
        const subscriptions = [watcher, watcher.onDidChange(this.schedule), watcher.onDidCreate(this.schedule), watcher.onDidDelete(this.schedule)];
        this.watchers.set(source, vscode.Disposable.from(...subscriptions));
      }
      const pickedSource = this.picked; this.picked = undefined;
      this.post({ type: "canvasSources", sources, ...(pickedSource !== undefined ? { pickedSource } : {}) });
    } catch { /* The document snapshot reports errors for the active file. */ }
  }
  async choose(): Promise<void> {
    try {
      const files = await vscode.window.showOpenDialog({ canSelectMany: false, openLabel: "引用画布", filters: { "GameFlow 画布": ["gameflow.json"] } });
      if (this.disposed || !files?.[0]) return;
      const uri = files[0];
      if (!/\.gameflow\.json$/i.test(uri.path) || uri.scheme !== this.document.uri.scheme || uri.authority !== this.document.uri.authority) throw new Error("请选择同一文件系统中的 .gameflow.json 画布。");
      const source = uri.toString() === this.document.uri.toString() ? "" : path.posix.relative(path.posix.dirname(this.document.uri.path), uri.path);
      if (!isCanvasReferenceSource(source)) throw new Error("无法保存此相对引用路径；请使用同一磁盘中名称不含特殊字符的 .gameflow.json 文件。");
      if (this.extra.size >= 64 && !this.extra.has(source)) throw new Error("本次会话已载入 64 个源画布文件，请重新打开编辑器后再选择。");
      // Complete the existing one-time identity migration before issuing references to a legacy source.
      const text = this.access ? await this.access.open(uri) : await vscode.workspace.openTextDocument(uri);
      const original = parseGameFlowDocument(text.getText());
      const migrated = migrateDocumentElementIds(original);
      if (migrated !== original) {
        if (this.access) await this.access.apply([{ document: text, version: text.version, text: serializeGameFlowDocument(migrated) }]);
        else {
        const edit = new vscode.WorkspaceEdit();
        const sourceText = text as vscode.TextDocument;
        edit.replace(uri, new vscode.Range(sourceText.positionAt(0), sourceText.positionAt(text.getText().length)), serializeGameFlowDocument(migrated));
        if (!await vscode.workspace.applyEdit(edit)) throw new Error("源画布的节点身份迁移未能完成。");
        }
      }
      if (source) this.extra.add(source);
      this.picked = source;
      await this.refresh();
    } catch (error) { this.post({ type: "canvasSources", sources: this.sources, error: error instanceof Error ? error.message : String(error) }); }
  }
  async open(source: string): Promise<void> {
    if (!Object.hasOwn(this.sources, source)) return;
    try { await vscode.commands.executeCommand("vscode.openWith", this.uri(source), "gameflow.canvasEditor"); }
    catch (error) { this.post({ type: "canvasSources", sources: this.sources, error: String(error) }); }
  }
  componentPsdAccess() {
    const access = this.access;
    if (!access) return;
    return {
      ...access,
      openSource: (source: string) => {
        if (!Object.hasOwn(this.sources, source)) throw new Error("组件画布未载入，请刷新画布引用。");
        return access.open(this.uri(source));
      },
    };
  }
  async apply(request: CanvasApplyRequest, expectedSources: Record<string,string>, baseVersion: number): Promise<void> {
    if (baseVersion !== this.document.version) throw new Error("实例文档已变化，请刷新后重新应用。");
    const current = parseGameFlowDocument(this.document.getText());
    const page = current.pages.find(page => page.id === request.pageId);
    if (!page || !findOwnedCanvasNode({ ...current, pages: [page] }, request.ownerId)?.prefab) throw new Error("引用实例不属于当前页面。");
    const opened = new Map<string, { document: CanvasText; version: number }>();
    const sources = await loadCanvasSources(current, async source => {
      if (!Object.hasOwn(this.sources, source)) throw new Error("来源不在已登记依赖中，请刷新后重试。");
      const document = this.access ? await this.access.open(this.uri(source)) : await vscode.workspace.openTextDocument(this.uri(source));
      opened.set(source, { document, version: document.version });
      return parseGameFlowDocument(document.getText());
    });
    for (const [source, entry] of Object.entries(sources)) if (entry.document && expectedSources[source] !== canvasFingerprint(entry.document)) throw new Error("源组件已变化，请查看最新源值后重新应用。");
    const plan = planCanvasApply(current, sources, request);
    for (const uri of [this.document.uri,...plan.source?[this.uri(plan.source)]:[]]) {
      const stat=await vscode.workspace.fs.stat(uri);
      if (stat.permissions && stat.permissions & vscode.FilePermission.Readonly || vscode.workspace.fs.isWritableFileSystem(uri.scheme) === false) throw new Error("源或实例文件只读，属性覆盖已保留。");
    }
    if (this.access) {
      const updates = [{ document: this.document, version: baseVersion, text: serializeGameFlowDocument(plan.document) }];
      if (plan.source) { const source = opened.get(plan.source); if (!source) throw new Error("源文档尚未就绪。"); updates.push({ ...source, text: serializeGameFlowDocument(plan.sourceDocument) }); }
      await this.access.apply(updates); await this.refresh(); return;
    }
    const edit = new vscode.WorkspaceEdit();
    const replace = (document: vscode.TextDocument, candidate: GameFlowDocument) => edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), serializeGameFlowDocument(candidate));
    replace(this.document as vscode.TextDocument, plan.document);
    if (plan.source) {
      const source = opened.get(plan.source);
      if (!source) throw new Error("源文档尚未就绪。");
      replace(source.document as vscode.TextDocument, plan.sourceDocument);
    }
    if (this.document.version !== baseVersion || [...opened.values()].some(item => item.document.version !== item.version)) throw new Error("文档在应用期间变化，请重试。");
    // A text-only WorkspaceEdit is applied as one native all-or-nothing undo unit.
    if (!await vscode.workspace.applyEdit(edit)) throw new Error("未能应用到源组件，本地覆盖已保留。请检查源文件是否只读。");
    await this.refresh();
  }
  dispose() {
    this.disposed = true; ++this.epoch;
    if (this.timer) clearTimeout(this.timer);
    this.subscription.dispose();
    for (const watcher of this.watchers.values()) watcher.dispose();
    this.watchers.clear();
  }
}
