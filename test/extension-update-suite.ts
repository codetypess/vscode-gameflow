import assert from "node:assert/strict";
import type * as vscode from "vscode";
import { attachExtensionUpdates, type SelfUpdateClient } from "../src/extension-updates";
import { isWebviewToHostMessage } from "../shared/protocol";
import type { ExtensionUpdateState } from "../shared/extension-update";

export const extensionUpdateTests = [{
  name: "update panels receive current snapshots and broadcasts; disposed panels cannot install",
  async run() {
    let state: ExtensionUpdateState = { status: "available", version: "1.2.3" };
    let installs = 0;
    const listeners = new Set<(state: ExtensionUpdateState) => void>();
    const client: SelfUpdateClient = {
      async check() {}, getState: () => state,
      subscribe(listener) { listeners.add(listener); return { dispose() { listeners.delete(listener); } }; },
      async install() { installs++; state = { status: "pending", version: "1.2.3" }; for (const fn of listeners) fn(state); }
    };
    const makePanel = () => {
      const received: unknown[] = [];
      let receive: ((raw: unknown) => Promise<void>) | undefined;
      const panel = { webview: {
        async postMessage(message: unknown) { received.push(message); return true; },
        onDidReceiveMessage(fn: typeof receive) { receive = fn; return { dispose() { receive = undefined; } }; }
      } } as unknown as vscode.WebviewPanel;
      return { panel, received, send: (raw: unknown) => receive?.(raw) };
    };
    const first = makePanel(), second = makePanel();
    const one = attachExtensionUpdates(first.panel, client), two = attachExtensionUpdates(second.panel, client);
    await first.send({ type: "extensionUpdateReady" });
    assert.deepEqual(first.received, [{ type: "extensionUpdateState", state }]);
    await first.send({ type: "installExtensionUpdate", url: "https://other.invalid/file.vsix" });
    assert.equal(installs, 0);
    await second.send({ type: "installExtensionUpdate" });
    assert.equal(installs, 1);
    assert.deepEqual(first.received.at(-1), { type: "extensionUpdateState", state });
    one.dispose(); two.dispose();
    assert.equal(listeners.size, 0);
    await first.send({ type: "installExtensionUpdate" });
    assert.equal(installs, 1);
  }
}, {
  name: "update protocol accepts only fixed requests without injected commands or URLs",
  run() {
    for (const type of ["extensionUpdateReady", "installExtensionUpdate"]) {
      assert.equal(isWebviewToHostMessage({ type }), true);
      assert.equal(isWebviewToHostMessage({ type, command: "workbench.action.reloadWindow" }), false);
      assert.equal(isWebviewToHostMessage({ type, version: "9.0.0" }), false);
    }
  }
}];
