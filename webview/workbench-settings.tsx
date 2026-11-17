import { useEffect, useRef, useState } from "react";
import { FolderOpen, Settings, X } from "lucide-react";
import type { ExportDirectoryKind, WorkbenchSettings, WorkbenchSettingsRequest, WorkbenchSettingsResult } from "../shared/workbench-settings";
import { isBrowserPreview, postHostMessage } from "./vscode-api";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import "./workbench-settings.css";

export function useWorkbenchSettings() {
  const [settings, setSettings] = useState<WorkbenchSettings>({});
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [focus, setFocus] = useState<ExportDirectoryKind>("resources");
  const requests = useRef(new Map<string, (result: WorkbenchSettingsResult) => void>());
  const request = (action: WorkbenchSettingsRequest["action"], directory?: ExportDirectoryKind) => new Promise<WorkbenchSettingsResult>(resolve => {
    const requestId = crypto.randomUUID(); requests.current.set(requestId, resolve);
    postHostMessage(action === "read" ? { type: "workbenchSettings", requestId, action } : { type: "workbenchSettings", requestId, action, directory: directory! });
  });
  useEffect(() => {
    const listener = ({ data }: MessageEvent<WorkbenchSettingsResult>) => {
      if (data?.type !== "workbenchSettingsResult") return;
      setSettings(data.settings); if (data.error) setError(data.error);
      if (data.requestId) { requests.current.get(data.requestId)?.(data); requests.current.delete(data.requestId); }
    };
    window.addEventListener("message", listener); void request("read");
    return () => { window.removeEventListener("message", listener); requests.current.clear(); };
  }, []);
  return {
    settings, open, busy, error, focus,
    show: () => { setFocus("resources"); setOpen(true); }, close: () => setOpen(false),
    ensureResources: () => { if (settings.resourceDirectory) return true; setFocus("resources"); setOpen(true); return false; },
    choose: async (directory: ExportDirectoryKind) => {
      if (busy) return;
      setBusy(true); setError("");
      try { await request("choose", directory); } finally { setBusy(false); }
    }
  };
}
export type WorkbenchSettingsUI = ReturnType<typeof useWorkbenchSettings>;
export function WorkbenchSettingsButton({ settings }: { settings: WorkbenchSettingsUI }) {
  return <Button size="icon" variant="ghost" className="workbench-icon" aria-label="工作台设置" title="工作台设置" onClick={settings.show}><Settings size={15} /></Button>;
}
export function WorkbenchSettingsPanel({ settings }: { settings: WorkbenchSettingsUI }) {
  return settings.open ? <SettingsDialog settings={settings} /> : null;
}
function SettingsDialog({ settings }: { settings: WorkbenchSettingsUI }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const resources = useRef<HTMLButtonElement>(null);
  useEffect(() => { dialog.current?.showModal(); resources.current?.focus(); }, []);
  return <dialog ref={dialog} className="workbench-settings-dialog" aria-labelledby="workbench-settings-title" onCancel={event => { event.preventDefault(); settings.close(); }} onKeyDown={event => event.stopPropagation()}>
    <header><strong id="workbench-settings-title">工作台设置</strong><Button size="icon" variant="ghost" aria-label="关闭工作台设置" onClick={settings.close}><X size={16} /></Button></header>
    <div className="workbench-settings-body">
      {([{ kind: "resources", label: "资源导出目录", path: settings.settings.resourceDirectory }, { kind: "prefabs", label: "预制体导出目录", path: settings.settings.prefabDirectory }] as const).map(field => <div className="workbench-setting" key={field.kind}>
        <label htmlFor={`workbench-${field.kind}`}>{field.label}</label>
        <div className="workbench-directory"><Input id={`workbench-${field.kind}`} readOnly value={field.path ?? ""} placeholder="尚未设置" title={field.path} /><Button ref={field.kind === "resources" ? resources : undefined} variant="secondary" size="sm" disabled={settings.busy} aria-label={`选择${field.label}`} onClick={() => void settings.choose(field.kind)}><FolderOpen size={14} />选择</Button></div>
        {field.kind === "prefabs" ? <small>预制体导出启用后使用此目录。</small> : null}
      </div>)}
      <p className="workbench-settings-note">{isBrowserPreview ? "浏览器中的目录选择仅在当前会话有效。" : "目录仅保存在本机当前 VS Code 工作区，不随项目提交 SVN。选择后自动保存。"}</p>
      {settings.error ? <p className="psd-warning" role="alert">{settings.error}</p> : null}
    </div>
    <footer><Button variant="secondary" onClick={settings.close}>完成</Button></footer>
  </dialog>;
}
