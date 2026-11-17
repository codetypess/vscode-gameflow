import * as vscode from "vscode";
import { EXPORT_SETTINGS_KEY, LEGACY_RESOURCE_DIRECTORY_KEY, isWorkbenchSettingsRequest, readExportSettings, type ExportDirectoryKind, type WorkbenchSettings, type WorkbenchSettingsResult } from "../shared/workbench-settings";

/** Local workspace memento; paths never enter shared project documents. */
export class WorkbenchSettingsController implements vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<WorkbenchSettings>();
  private operations: Promise<unknown> = Promise.resolve();
  constructor(private readonly context: Pick<vscode.ExtensionContext, "workspaceState">, private readonly pickDirectory: typeof vscode.window.showOpenDialog = options => vscode.window.showOpenDialog(options)) {}
  private stored() { return readExportSettings(this.context.workspaceState.get(EXPORT_SETTINGS_KEY), this.context.workspaceState.get<string>(LEGACY_RESOURCE_DIRECTORY_KEY)); }
  directory(kind: ExportDirectoryKind): vscode.Uri | undefined {
    const value = this.stored()[kind];
    if (!value) return undefined;
    const uri = vscode.Uri.parse(value, true);
    if (!uri.scheme || !uri.path || uri.query || uri.fragment) throw new Error("工作台导出目录路径无效，请重新选择目录。");
    return uri;
  }
  snapshot(): WorkbenchSettings { return { resourceDirectory: this.directory("resources")?.fsPath, prefabDirectory: this.directory("prefabs")?.fsPath }; }
  async set(kind: ExportDirectoryKind, uri?: vscode.Uri) {
    const operation = this.operations.then(async () => {
      if (uri && !((await vscode.workspace.fs.stat(uri)).type & vscode.FileType.Directory)) throw new Error("请选择一个文件夹作为导出目录。");
      const settings = this.stored();
      if (uri) settings[kind] = uri.toString(); else delete settings[kind];
      await this.context.workspaceState.update(EXPORT_SETTINGS_KEY, settings);
      this.changes.fire(this.snapshot());
    });
    this.operations = operation.catch(() => {}); return operation;
  }
  async choose(kind: ExportDirectoryKind, source: vscode.Uri): Promise<boolean> {
    const selected = await this.pickDirectory({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: kind === "resources" ? "选择资源导出根目录" : "选择预制体导出根目录", defaultUri: this.directory(kind) ?? vscode.Uri.joinPath(source, "..") });
    if (!selected?.[0]) return false;
    await this.set(kind, selected[0]); return true;
  }
  attach(panel: vscode.WebviewPanel, source: vscode.Uri): vscode.Disposable {
    const changes = this.changes.event(settings => { void panel.webview.postMessage({ type: "workbenchSettingsResult", settings } satisfies WorkbenchSettingsResult); });
    const requests = panel.webview.onDidReceiveMessage(async (raw: unknown) => {
      if (!isWorkbenchSettingsRequest(raw)) return;
      try {
        let cancelled = false;
        if (raw.action === "choose") cancelled = !await this.choose(raw.directory, source);
        else if (raw.action === "clear") await this.set(raw.directory);
        await panel.webview.postMessage({ type: "workbenchSettingsResult", requestId: raw.requestId, settings: this.snapshot(), cancelled } satisfies WorkbenchSettingsResult);
      } catch (error) {
        let settings: WorkbenchSettings = {}; try { settings = this.snapshot(); } catch { /* Preserve the original settings diagnostic. */ }
        await panel.webview.postMessage({ type: "workbenchSettingsResult", requestId: raw.requestId, settings, error: error instanceof Error ? error.message : String(error) } satisfies WorkbenchSettingsResult);
      }
    });
    return vscode.Disposable.from(changes, requests);
  }
  dispose() { this.changes.dispose(); }
}
