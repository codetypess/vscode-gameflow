import * as vscode from "vscode";
import type { PsdDocument } from "./psd-editor-provider";
import { bytesHash } from "./psd-document-model";

export class WorkbenchDocument implements vscode.CustomDocument {
  version = 1;
  baseline: string;
  diskHash: string;
  readonly psds = new Map<string, PsdDocument>();
  currentPsd?: PsdDocument;
  attachment?: vscode.Disposable;
  readonly panels = new Set<vscode.WebviewPanel>();
  readonly refreshers = new Set<() => Promise<void>>();
  readonly flushes = new Map<string, () => void>();
  disposed = false;
  announced = false;
  private operations: Promise<unknown> = Promise.resolve();
  onDispose?: () => void;
  constructor(readonly uri: vscode.Uri, private text: string, readonly cache: vscode.Uri) {
    this.baseline = text; this.diskHash = bytesHash(new TextEncoder().encode(text));
  }
  getText() { return this.text; }
  get canvasDirty() { return this.text !== this.baseline; }
  get dirty() { return this.canvasDirty || [...this.psds.values()].some(psd => psd.model.dirty); }
  replace(text: string) { this.text = text; ++this.version; }
  enqueue<T>(operation: () => Promise<T>): Promise<T> { const result = this.operations.then(operation); this.operations = result.catch(() => {}); return result; }
  async refresh() { await Promise.all([...this.refreshers].map(refresh => refresh())); }
  dispose() {
    this.disposed = true; this.attachment?.dispose();
    for (const psd of this.psds.values()) psd.dispose();
    this.panels.clear(); this.refreshers.clear(); this.onDispose?.();
  }
}
