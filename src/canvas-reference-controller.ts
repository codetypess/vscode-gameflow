import * as vscode from "vscode";
import * as path from "node:path";
import { isCanvasReferenceSource, parseGameFlowDocument, serializeGameFlowDocument, type GameFlowDocument } from "../shared/model";
import { loadCanvasSources, type CanvasSources } from "../shared/canvas-references";
import { migrateDocumentElementIds } from "../shared/document-id-migration";
import type { HostToWebviewMessage } from "../shared/protocol";

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
  constructor(private document: vscode.TextDocument, private webview: vscode.Webview) {
    this.subscription = vscode.workspace.onDidChangeTextDocument(event => {
      if (Object.keys(this.sources).some(source => this.uri(source).toString() === event.document.uri.toString())) this.schedule();
    });
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
        const opened = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
        const text = opened?.isDirty ? opened.getText() : Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
        return parseGameFlowDocument(text);
      }, [...this.extra]);
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
      const text = await vscode.workspace.openTextDocument(uri);
      const original = parseGameFlowDocument(text.getText());
      const migrated = migrateDocumentElementIds(original);
      if (migrated !== original) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(uri, new vscode.Range(text.positionAt(0), text.positionAt(text.getText().length)), serializeGameFlowDocument(migrated));
        if (!await vscode.workspace.applyEdit(edit)) throw new Error("源画布的节点身份迁移未能完成。");
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
  dispose() {
    this.disposed = true; ++this.epoch;
    if (this.timer) clearTimeout(this.timer);
    this.subscription.dispose();
    for (const watcher of this.watchers.values()) watcher.dispose();
    this.watchers.clear();
  }
}
