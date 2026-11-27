export const FilePermission = { Readonly: 1 };
export class FileSystemError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
/** Minimal VS Code adapter for host tests outside the extension runtime. */
import { posix } from "node:path";
export class Uri {
  scheme = "file"; authority = "";
  constructor(public path: string) {}
  get fsPath() { return this.path; }
  with(change: { path: string }) { return new Uri(change.path); }
  static joinPath(uri: Uri, ...parts: string[]) { return new Uri(posix.join(uri.path, ...parts)); }
  toString() { return `file://${this.path}`; }
}
export class Disposable {
  constructor(private run: () => void) {}
  dispose() { this.run(); }
  static from(...items: { dispose: () => void }[]) { return new Disposable(() => items.forEach(item => item.dispose())); }
}
export class TabInputCustom {
  constructor(readonly uri: Uri, readonly viewType: string) {}
}
export class CancellationTokenSource { token = { isCancellationRequested: false }; dispose() {} }
export class RelativePattern { constructor(public base: Uri, public pattern: string) {} }
export class Range { constructor(public start: unknown, public end: unknown) {} }
export class WorkspaceEdit {
  edits: { uri: Uri; text: string }[] = [];
  replace(uri: Uri, _range: Range, text: string) { this.edits.push({ uri, text }); }
}
type Listener = (...args: any[]) => void;
class Event {
  listeners = new Set<Listener>();
  subscribe = (listener: Listener) => { this.listeners.add(listener); return new Disposable(() => this.listeners.delete(listener)); };
  fire(...args: unknown[]) { for (const listener of this.listeners) listener(...args); }
}
class Watcher {
  change = new Event(); create = new Event(); delete = new Event(); disposed = false;
  onDidChange = this.change.subscribe; onDidCreate = this.create.subscribe; onDidDelete = this.delete.subscribe;
  constructor(public pattern: RelativePattern) {}
  dispose() { this.disposed = true; }
}
export class TestTextDocument {
  isDirty = false; version = 1;
  constructor(public uri: Uri, public text: string) {}
  getText() { return this.text; }
  positionAt(offset: number) { return offset; }
}
const change = new Event();
export const referenceHost = {
  files: new Map<string, string | Uint8Array>(), watchers: [] as Watcher[], picked: undefined as Uri | undefined,
  reads: [] as string[], commands: [] as { command: string; uri: Uri; viewType?: string }[],
  readOnly: new Set<string>(), rejectApply: false, edits: [] as WorkspaceEdit[],
  readOverride: undefined as undefined | ((uri: Uri) => Promise<Uint8Array>),
  beforeRename: undefined as undefined | ((target: Uri) => void),
  saveSelections: [] as (Uri | undefined)[],
  warnings: [] as string[],
  warningResponse: undefined as string | undefined,
  fireText(document: TestTextDocument) { change.fire({ document }); },
  reset() {
    this.files.clear(); this.watchers = []; this.picked = undefined; this.reads = []; this.commands = []; this.readOverride = undefined; this.readOnly.clear(); this.rejectApply = false; this.edits=[];
    this.saveSelections = []; this.warnings = []; this.warningResponse = undefined; this.beforeRename = undefined;
    workspace.textDocuments = []; change.listeners.clear();
  }
};
export const workspace = {
  textDocuments: [] as TestTextDocument[], onDidChangeTextDocument: change.subscribe,
  fs: { async writeFile(uri: Uri, bytes: Uint8Array) { referenceHost.files.set(uri.path, Buffer.from(bytes)); }, async rename(from: Uri, to: Uri, options: { overwrite: boolean }) {
    referenceHost.beforeRename?.(to);
    const bytes = referenceHost.files.get(from.path);
    if (bytes === undefined) throw new FileSystemError("FileNotFound", from.path);
    if (!options.overwrite && referenceHost.files.has(to.path)) throw new FileSystemError("FileExists", to.path + " already exists at destination.");
    referenceHost.files.set(to.path, bytes);
    referenceHost.files.delete(from.path);
  }, async delete(uri: Uri) { referenceHost.files.delete(uri.path); }, isWritableFileSystem: (_scheme: string) => true, async stat(uri: Uri) { return {permissions:referenceHost.readOnly.has(uri.path)?1:0}; }, async readFile(uri: Uri) {
    referenceHost.reads.push(uri.path);
    if (referenceHost.readOverride) return referenceHost.readOverride(uri);
    const text = referenceHost.files.get(uri.path);
    if (text === undefined) throw new FileSystemError("FileNotFound", "文件不存在");
    return typeof text === "string" ? Buffer.from(text) : text;
  } },
  createFileSystemWatcher(pattern: RelativePattern) { const watcher = new Watcher(pattern); referenceHost.watchers.push(watcher); return watcher; },
  async openTextDocument(uri: Uri) {
    let document = workspace.textDocuments.find(d => d.uri.path === uri.path);
    if (!document) { const bytes = await workspace.fs.readFile(uri); document = new TestTextDocument(uri, Buffer.from(bytes).toString()); workspace.textDocuments.push(document); }
    return document;
  },
  async applyEdit(edit: WorkspaceEdit) {
    referenceHost.edits.push(edit);
    if(referenceHost.rejectApply)return false;
    for (const item of edit.edits) {
      const document = workspace.textDocuments.find(d => d.uri.path === item.uri.path)!;
      document.text = item.text; document.isDirty = true; ++document.version; referenceHost.fireText(document);
    }
    return true;
  }
};
export const window = {
  async showSaveDialog() { return referenceHost.saveSelections.length ? referenceHost.saveSelections.shift() : referenceHost.picked; },
  async showOpenDialog() { return referenceHost.picked ? [referenceHost.picked] : undefined; },
  async showWarningMessage(message: string) { referenceHost.warnings.push(message); return referenceHost.warningResponse; }
};
export const commands = { async executeCommand(command: string, uri: Uri, viewType?: string) { referenceHost.commands.push({ command, uri, viewType }); } };
