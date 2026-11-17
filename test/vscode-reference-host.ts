/** Minimal VS Code test adapter for the file-reference controller's host lifecycle. */
import { posix } from "node:path";
export class Uri {
  scheme = "file"; authority = "";
  constructor(public path: string) {}
  static joinPath(uri: Uri, ...parts: string[]) { return new Uri(posix.join(uri.path, ...parts)); }
  toString() { return `file://${this.path}`; }
}
export class Disposable {
  constructor(private run: () => void) {}
  dispose() { this.run(); }
  static from(...items: { dispose: () => void }[]) { return new Disposable(() => items.forEach(item => item.dispose())); }
}
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
  files: new Map<string, string>(), watchers: [] as Watcher[], picked: undefined as Uri | undefined,
  reads: [] as string[], commands: [] as { command: string; uri: Uri }[],
  readOverride: undefined as undefined | ((uri: Uri) => Promise<Uint8Array>),
  fireText(document: TestTextDocument) { change.fire({ document }); },
  reset() {
    this.files.clear(); this.watchers = []; this.picked = undefined; this.reads = []; this.commands = []; this.readOverride = undefined;
    workspace.textDocuments = []; change.listeners.clear();
  }
};
export const workspace = {
  textDocuments: [] as TestTextDocument[], onDidChangeTextDocument: change.subscribe,
  fs: { async readFile(uri: Uri) {
    referenceHost.reads.push(uri.path);
    if (referenceHost.readOverride) return referenceHost.readOverride(uri);
    const text = referenceHost.files.get(uri.path);
    if (text === undefined) throw new Error("文件不存在");
    return Buffer.from(text);
  } },
  createFileSystemWatcher(pattern: RelativePattern) { const watcher = new Watcher(pattern); referenceHost.watchers.push(watcher); return watcher; },
  async openTextDocument(uri: Uri) {
    let document = workspace.textDocuments.find(d => d.uri.path === uri.path);
    if (!document) { const bytes = await workspace.fs.readFile(uri); document = new TestTextDocument(uri, Buffer.from(bytes).toString()); workspace.textDocuments.push(document); }
    return document;
  },
  async applyEdit(edit: WorkspaceEdit) {
    for (const item of edit.edits) {
      const document = workspace.textDocuments.find(d => d.uri.path === item.uri.path)!;
      document.text = item.text; document.isDirty = true; ++document.version; referenceHost.fireText(document);
    }
    return true;
  }
};
export const window = { async showOpenDialog() { return referenceHost.picked ? [referenceHost.picked] : undefined; } };
export const commands = { async executeCommand(command: string, uri: Uri) { referenceHost.commands.push({ command, uri }); } };
