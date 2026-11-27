import * as vscode from "vscode";

type Documents = Pick<ReadonlyMap<string, { panels: ReadonlySet<vscode.WebviewPanel> }>, "get">;

/** Restart Extensions can leave a resolved custom tab with no panel in the new host. */
export function restoreRetainedEditors(providers: Readonly<Record<string, Documents>>, groups = vscode.window.tabGroups): vscode.Disposable {
  const retained = new Set(groups.all.flatMap(group => group.tabs.filter(tab =>
    tab.input instanceof vscode.TabInputCustom && Object.hasOwn(providers, tab.input.viewType))));
  const checking = new Set<vscode.Tab>();
  const reopening = new Set<vscode.TabGroup>();
  let disposed = false;

  async function restore(tab: vscode.Tab, input: vscode.TabInputCustom) {
    const group = tab.group;
    const documents = providers[input.viewType];
    const attached = () => Array.from(documents.get(input.uri.toString())?.panels ?? [])
      .some(panel => panel.viewType === input.viewType && panel.viewColumn === group.viewColumn);
    if (attached()) return;
    const options = { viewColumn: group.viewColumn, preview: tab.isPreview, preserveFocus: true };
    const open = () => vscode.commands.executeCommand("vscode.openWith", input.uri, input.viewType, options);
    // Allow a cold window or a background tab being revealed to resolve its real panel first.
    await open();
    if (disposed || attached() || group.activeTab !== tab) return;
    await vscode.workspace.fs.stat(input.uri);
    if (disposed || attached() || !groups.all.includes(group) || group.activeTab !== tab || group.viewColumn !== options.viewColumn) return;
    if (tab.isDirty || tab.isPinned || (groups.all.length > 1 && tab.group.tabs.length === 1)) {
      const reload = "重载窗口";
      const choice = await vscode.window.showWarningMessage(
        `「${tab.label}」与重启后的插件已断开。可通过重载窗口恢复工作台连接。`, reload);
      if (choice === reload && !disposed && groups.all.some(group => group.tabs.includes(tab)) && !attached()) {
        await vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
      return;
    }
    // Closing the old tab briefly selects its neighbour. Leave that tab in the background.
    reopening.add(group);
    try {
      if (await groups.close(tab, true)) await open();
    } finally {
      reopening.delete(group);
      if (!disposed) inspect();
    }
  }

  function inspect() {
    for (const tab of retained) {
      if (!tab.isActive || checking.has(tab) || reopening.has(tab.group) || !(tab.input instanceof vscode.TabInputCustom)) continue;
      checking.add(tab);
      void restore(tab, tab.input).catch(error => {
        if (!disposed) void vscode.window.showErrorMessage(`恢复工作台「${tab.label}」失败：${String(error)}`);
      }).finally(() => {
        checking.delete(tab);
        if (tab.isActive || !groups.all.some(group => group.tabs.includes(tab))) retained.delete(tab);
      });
    }
  }
  const listener = groups.onDidChangeTabs(event => {
    for (const tab of event.closed) retained.delete(tab);
    inspect();
  });
  inspect();
  return new vscode.Disposable(() => { disposed = true; listener.dispose(); retained.clear(); });
}
