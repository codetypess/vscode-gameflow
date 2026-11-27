import assert from "node:assert/strict";
import type * as vscode from "vscode";
import { attachExtensionUpdates, type SelfUpdateClient } from "../src/extension-updates";
import { isWebviewToHostMessage } from "../shared/protocol";
import type { ExtensionUpdateState } from "../shared/extension-update";
import { restoreRetainedEditors } from "../src/retained-editors";
import { referenceHost, TabInputCustom, Uri } from "./vscode-reference-host";

export const extensionUpdateTests = [{
  name: "restart restores only selected orphaned custom editors and keeps dirty tabs open",
  async run() {
    const untilSettled = () => new Promise<void>(resolve => setImmediate(resolve));
    const type = "gameflow.canvasEditor";
    const uri = new Uri("/sample.gameflow.json");
    for (const scenario of ["orphan", "cold", "dirty", "hidden"]) {
      referenceHost.reset();
      const panels = new Set<vscode.WebviewPanel>();
      const input = new TabInputCustom(uri, type);
      const group = { viewColumn: 1, get tabs() { return [tab]; }, get activeTab() { return tab.isActive ? tab : undefined; } };
      const tab = { input, group, label: "sample.gameflow.json", isActive: scenario !== "hidden", isDirty: scenario === "dirty" };
      let closes = 0;
      let change: ((event: { closed: unknown[] }) => void) | undefined;
      const groups = { all: [group], async close(target: unknown) { assert.equal(target, tab); closes++; return true; },
        onDidChangeTabs(listener: typeof change) { change = listener; return { dispose() { change = undefined; } }; } };
      const recovery = restoreRetainedEditors({ [type]: new Map([[uri.toString(), { panels }]]) }, groups as unknown as vscode.TabGroups);
      try {
        if (scenario === "cold") panels.add({ viewType: type, viewColumn: 1 } as vscode.WebviewPanel);
        if (scenario === "hidden") {
          await untilSettled();
          assert.equal(referenceHost.commands.length, 0, "background tabs must not take focus");
          tab.isActive = true;
          change?.({ closed: [] });
        }
        await untilSettled();
        const orphan = scenario === "orphan" || scenario === "hidden";
        assert.equal(closes, orphan ? 1 : 0, scenario);
        assert.deepEqual(referenceHost.commands.map(item => item.command), orphan ? ["vscode.openWith", "vscode.openWith"] : ["vscode.openWith"]);
        assert.equal(referenceHost.warnings.length, scenario === "dirty" ? 1 : 0);
        change?.({ closed: [] });
        await untilSettled();
        assert.equal(closes, orphan ? 1 : 0, "each retained tab is recovered once");
      } finally { recovery.dispose(); referenceHost.reset(); }
    }
  }
}, {
  name: "retained pending workbench receives current state immediately when a new host attaches",
  async run() {
    let displayed: ExtensionUpdateState = { status: "pending", version: "1.2.3" };
    const currentDisplay = (): ExtensionUpdateState => displayed;
    let state: ExtensionUpdateState = { status: "current" };
    let reveal: (() => void) | undefined;
    const changes = new Set<(state: ExtensionUpdateState) => void>();
    const panel = { visible: true, webview: {
      async postMessage(message: { state: ExtensionUpdateState }) { displayed = message.state; return true; },
      onDidReceiveMessage() { return { dispose() {} }; }
    }, onDidChangeViewState(listener: () => void) { reveal = listener; return { dispose() { reveal = undefined; } }; }
    } as unknown as vscode.WebviewPanel;
    const updates: SelfUpdateClient = { async check() {}, async install() {}, getState: () => state,
      subscribe(listener) { changes.add(listener); return { dispose() { changes.delete(listener); } }; }
    };
    const attachment = attachExtensionUpdates(panel, updates);
    assert.equal(currentDisplay().status, "current", "a retained webview does not send a second mount-ready request");
    state = { status: "pending", version: "1.3.0" };
    reveal?.();
    assert.equal(currentDisplay().status, "pending", "reveal must read the latest snapshot even if a hidden update was missed");
    state = { status: "current" };
    attachment.dispose();
    reveal?.();
    assert.equal(currentDisplay().status, "pending");
    assert.equal(changes.size, 0);
  }
}, {
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
      const panel = { onDidChangeViewState() { return { dispose() {} }; }, webview: {
        async postMessage(message: unknown) { received.push(message); return true; },
        onDidReceiveMessage(fn: typeof receive) { receive = fn; return { dispose() { receive = undefined; } }; }
      } } as unknown as vscode.WebviewPanel;
      return { panel, received, send: (raw: unknown) => receive?.(raw) };
    };
    const first = makePanel(), second = makePanel();
    const one = attachExtensionUpdates(first.panel, client), two = attachExtensionUpdates(second.panel, client);
    assert.deepEqual(first.received, [{ type: "extensionUpdateState", state }]);
    first.received.length = 0;
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
