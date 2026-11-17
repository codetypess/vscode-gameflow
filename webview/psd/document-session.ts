import type { PsdDraft } from "../../shared/psd-draft";
import type { PsdEditorMessage, PsdEditorRequest, PsdEditorState } from "../../shared/psd-editor-protocol";

type Command = Extract<PsdEditorRequest, { type: "psdEditorCommand" }>["action"];
export class PsdDocumentSession {
  state: PsdEditorState | null = null;
  draft: PsdDraft | null = null;
  error?: string;
  private flight?: { requestId: string; draft: PsdDraft };
  private queued?: PsdDraft;
  private sequence = 0;
  private rejected = false;
  private commands: { action: Command; resolve: () => void; reject: (error: Error) => void }[] = [];
  private command?: { requestId: string; resolve: () => void; reject: (error: Error) => void };
  private flushRequests: string[] = [];
  private earlyStates: PsdEditorState[] = [];
  constructor(private readonly post: (message: PsdEditorRequest) => void, private readonly changed: () => void) {}
  get pending() { return !!this.flight || !!this.queued; }
  get unsent() { return this.rejected; }
  get busy() { return !!this.command || this.commands.length > 0; }
  initialize(state: PsdEditorState) { this.state = state; this.draft = state.draft; for (const message of this.earlyStates.splice(0)) this.receive(message); this.pump(); this.changed(); }
  edit(draft: PsdDraft) {
    if (!this.state || this.busy) return;
    this.draft = draft; this.queued = draft; this.rejected = false; this.error = undefined; this.pump(); this.changed();
  }
  retry() { if (this.draft) this.edit(this.draft); }
  run(action: Command) {
    return new Promise<void>((resolve, reject) => {
      if (this.rejected) { reject(new Error(this.error ?? "请先重新提交未同步的修改。")); return; }
      this.commands.push({ action, resolve, reject }); this.pump(); this.changed();
    });
  }
  private pump() {
    if (!this.state || this.flight) return;
    if (this.queued) {
      const draft = this.queued; this.queued = undefined;
      const requestId = `psd-edit-${++this.sequence}`; this.flight = { requestId, draft };
      this.post({ type: "psdEditorEdit", requestId, baseVersion: this.state.version, draft }); return;
    }
    if (!this.rejected) for (const requestId of this.flushRequests.splice(0)) this.post({ type: "psdEditorFlushed", requestId });
    if (!this.command && this.commands.length) {
      const next = this.commands.shift()!, requestId = `psd-command-${++this.sequence}`;
      this.command = { requestId, resolve: next.resolve, reject: next.reject };
      this.post({ type: "psdEditorCommand", requestId, action: next.action });
    }
  }
  receive(message: PsdEditorMessage) {
    if (message.type === "psdEditorFlush") { this.flushRequests.push(message.requestId); this.pump(); return; }
    if (message.type === "psdEditorCommandResult") {
      if (message.requestId !== this.command?.requestId) return;
      const command = this.command; this.command = undefined;
      if (message.error) { this.error = message.error; command.reject(new Error(message.error)); } else command.resolve();
      this.pump(); this.changed(); return;
    }
    if (message.type !== "psdEditorState") return;
    if (!this.state) { this.earlyStates.push(message); return; }
    if (message.version >= this.state.version) this.state = message;
    if (message.requestId && this.flight?.requestId === message.requestId) {
      this.flight = undefined;
      if (message.rejected) {
        this.rejected = true; this.queued = undefined; this.error = message.error;
        for (const command of this.commands.splice(0)) command.reject(new Error(this.error));
      }
    }
    if (!this.pending && !this.rejected) this.draft = this.state.draft;
    this.pump(); this.changed();
  }
  dispose() {
    const error = new Error("PSD 编辑器已关闭。");
    this.command?.reject(error); for (const command of this.commands) command.reject(error);
  }
}
