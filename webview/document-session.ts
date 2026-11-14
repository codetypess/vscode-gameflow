import type { GameFlowDocument } from "../shared/model";
import { GAMEFLOW_SCHEMA_VERSION } from "../shared/model";
import { migrateDocumentElementIds } from "../shared/document-id-migration";
import type { HostToWebviewMessage, WebviewToHostMessage } from "../shared/protocol";

type Transform = (document: GameFlowDocument) => GameFlowDocument;
type Action = "save" | "undo" | "redo";
export interface DocumentState {
  document: GameFlowDocument | null;
  resourceName: string;
  dirty: boolean;
  pending: boolean;
  error: string | null;
}
const same = (a: GameFlowDocument | null, b: GameFlowDocument | null) => JSON.stringify(a) === JSON.stringify(b);

/** Serializes UI transactions against the host's document version. */
export class DocumentSession {
  state: DocumentState = { document: null, resourceName: "", dirty: false, pending: false, error: null };
  private version = 0;
  private inFlight: GameFlowDocument | null = null;
  private queued: GameFlowDocument | null = null;
  private action: Action | null = null;
  private actions: Action[] = [];
  private deferred: Transform[] = [];
  private refreshing = false;
  private initialized = false;
  constructor(private post: (message: WebviewToHostMessage) => void, private changed: (state: DocumentState) => void) {}

  private publish(patch: Partial<DocumentState>) { this.state = { ...this.state, ...patch }; this.changed(this.state); }
  private send(document: GameFlowDocument) {
    this.inFlight = document;
    this.publish({ pending: true });
    this.post({ type: "replaceDocument", baseVersion: this.version, document });
  }
  private nextAction() {
    if (this.inFlight || this.action || this.refreshing) return;
    const action = this.actions.shift();
    if (!action) { this.publish({ pending: false }); return; }
    this.action = action;
    this.publish({ pending: true });
    this.post(action === "save" ? { type: "save" } : { type: "history", action });
  }
  private reset() { this.inFlight = null; this.queued = null; this.action = null; this.actions = []; this.deferred = []; }

  receive(message: HostToWebviewMessage) {
    if (message.type === "psdOutputResult") return;
    if (message.type === "documentError") {
      this.reset(); this.refreshing = true;
      this.publish({ document: null, pending: false, error: [message.message, ...message.details].join("\n") });
      return;
    }
    if (message.type === "updateRejected") {
      this.reset(); this.refreshing = true;
      this.publish({ pending: false, error: message.reason }); this.post({ type: "ready" }); return;
    }
    if (message.type === "commandCompleted") {
      if (message.action !== this.action) return;
      this.action = null;
      const deferred = this.deferred; this.deferred = [];
      if (this.state.document && deferred.length) this.edit((document) => deferred.reduce((next, transform) => transform(next), document));
      this.nextAction(); return;
    }
    if (message.type !== "init" && message.documentVersion < this.version) return;
    const ownAck = this.inFlight !== null && same(message.document, this.inFlight);
    if (message.type !== "init" && message.documentVersion === this.version && this.inFlight && !ownAck) return;
    this.version = message.documentVersion;
    this.refreshing = false;
    if (message.type === "init") this.publish({ resourceName: message.resourceName });
    if (ownAck && this.queued && !same(this.queued, message.document)) {
      const next = this.queued; this.queued = null;
      this.publish({ dirty: true, error: null }); this.send(next); return;
    }
    if (this.action) {
      this.publish({ document: message.document, dirty: message.dirty, error: null }); return;
    }
    this.inFlight = null; this.queued = null;
    this.publish({ document: message.document, dirty: message.dirty, error: null });
    if (message.type === "init" && !this.initialized) {
      this.initialized = true;
      try { this.edit(migrateDocumentElementIds); }
      catch (error) { this.publish({ error: error instanceof Error ? error.message : String(error) }); }
    }
    this.nextAction();
  }

  edit(transform: Transform) {
    if (!this.state.document || this.refreshing) return;
    if (this.action) { this.deferred.push(transform); return; }
    const candidate = transform(this.state.document);
    if (same(candidate, this.state.document)) return;
    const next = { ...candidate, schemaVersion: GAMEFLOW_SCHEMA_VERSION };
    this.publish({ document: next, dirty: true });
    if (this.inFlight) this.queued = next; else this.send(next);
  }
  command(action: Action) {
    if (!this.state.document || this.refreshing) return;
    this.actions.push(action); this.nextAction();
  }
}
