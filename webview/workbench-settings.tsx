import { DialogHeading } from "./components/dialog-heading";
import { useEffect, useRef, useState } from "react";
import { FolderOpen, Settings } from "lucide-react";
import type { ExportDirectoryKind, WorkbenchSettings, WorkbenchSettingsRequest, WorkbenchSettingsResult } from "../shared/workbench-settings";
import { isBrowserPreview, postHostMessage } from "./vscode-api";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import "./workbench-settings.css";
import { exportDestination, exportDirectoryError, normalizeExportDirectory } from "../shared/export-directory";

interface FileExportSettings { directory?: string; name: string; change(directory: string | undefined): void }

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
export function WorkbenchSettingsPanel({ settings, file }: { settings: WorkbenchSettingsUI; file?: FileExportSettings }) {
  return settings.open ? <SettingsDialog settings={settings} file={file} /> : null;
}
function SettingsDialog({ settings, file }: { settings: WorkbenchSettingsUI; file?: FileExportSettings }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const resources = useRef<HTMLButtonElement>(null);
  const [directory, setDirectory] = useState(file?.directory ?? "");
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  useEffect(() => { setDirectory(file?.directory ?? ""); setDirectoryError(null); }, [file?.directory]);
  const commit = () => {
    if (!file) return true;
    const normalized = normalizeExportDirectory(directory), issue = exportDirectoryError(normalized);
    setDirectoryError(issue);
    if (issue) return false;
    setDirectory(normalized ?? "");
    if (normalized !== file.directory) file.change(normalized);
    return true;
  };
  const close = () => { if (commit()) settings.close(); };
  const previewDirectory = exportDirectoryError(normalizeExportDirectory(directory)) ? file?.directory : normalizeExportDirectory(directory);
  useEffect(() => { dialog.current?.showModal(); resources.current?.focus(); }, []);
  return <dialog ref={dialog} className="floating-panel workbench-dialog workbench-settings-dialog" aria-labelledby="workbench-settings-title" onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => event.stopPropagation()}>
    <DialogHeading heading="工作台设置" headingId="workbench-settings-title" closeLabel="关闭工作台设置" onClose={close} />
    <div className="workbench-settings-body">
      {([{ kind: "resources", label: "资源导出根目录", path: settings.settings.resourceDirectory }, { kind: "prefabs", label: "预制体导出根目录", path: settings.settings.prefabDirectory }] as const).map(field => <div className="workbench-setting" key={field.kind}>
        <label htmlFor={`workbench-${field.kind}`}>{field.label}</label>
        <div className="workbench-directory"><Input id={`workbench-${field.kind}`} readOnly value={field.path ?? ""} placeholder="尚未设置" title={field.path} /><Button ref={field.kind === "resources" ? resources : undefined} variant="secondary" size="sm" disabled={settings.busy} aria-label={`选择${field.label}`} onClick={() => void settings.choose(field.kind)}><FolderOpen size={14} />选择</Button></div>
        {field.kind === "prefabs" ? <small>当前页面的 .lh 预制体导出到此目录。</small> : <small>图片按共享、未分类或独立图集目录保存。</small>}
      </div>)}
      <p className="workbench-settings-note">{isBrowserPreview ? "浏览器中的根目录选择仅在当前会话有效。" : "根目录仅保存在本机当前 VS Code 工作区，不随项目提交 SVN。选择后自动保存。"}</p>
      {file ? <div className="workbench-setting workbench-file-setting">
        <strong>当前文件</strong><small title={file.name}>{file.name}</small>
        <label htmlFor="workbench-export-directory">导出目录</label>
        <Input id="workbench-export-directory" value={directory} placeholder="留空使用根目录，例如 ui/login" aria-invalid={!!directoryError} aria-describedby="workbench-export-directory-hint" maxLength={512}
          onChange={event => { setDirectory(event.target.value); setDirectoryError(null); }} onBlur={commit}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDirectory(file.directory ?? ""); setDirectoryError(null); } }} />
        {settings.settings.prefabDirectory && previewDirectory ? <small className="workbench-export-destination" title={exportDestination(settings.settings.prefabDirectory, previewDirectory)}>实际导出到：{exportDestination(settings.settings.prefabDirectory, previewDirectory)}</small> : null}
        <small id="workbench-export-directory-hint">用于此文件的预制体导出，随 GameFlow 保存。PSD 图片按图集目录单独分类。</small>
        {directoryError ? <p className="psd-warning" role="alert">{directoryError}</p> : null}
      </div> : null}
      {settings.error ? <p className="psd-warning" role="alert">{settings.error}</p> : null}
    </div>
    <footer><Button variant="secondary" onClick={close}>完成</Button></footer>
  </dialog>;
}
