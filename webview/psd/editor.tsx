import { Layers3 } from "lucide-react";
import { useState } from "react";
import { useWorkbenchSettings, WorkbenchSettingsButton, WorkbenchSettingsPanel } from "../workbench-settings";
import { PsdWorkspace } from "./workspace";
import { usePsdEditor } from "./use-psd-editor";

export function PsdEditorApp() {
  const { binding, initialError } = usePsdEditor();
  const settings = useWorkbenchSettings();
  const [documentActions, setDocumentActions] = useState<HTMLDivElement | null>(null);
  const [exportActions, setExportActions] = useState<HTMLDivElement | null>(null);
  return <main className="app-shell"><header className="topbar"><span className="brand-mark"><Layers3 size={18} /></span><strong>工作台</strong><div ref={setDocumentActions} className="workbench-document-actions" /><span className="document-title">PSD 切图配置</span><div className="workbench-right"><div ref={setExportActions} className="workbench-export-actions" /><WorkbenchSettingsButton settings={settings} /></div></header>
    <WorkbenchSettingsPanel settings={settings} />
    {binding ? <PsdWorkspace mode="slice" active binding={binding} documentActions={documentActions} exportActions={exportActions} settings={settings} /> : <div className="psd-empty" role="status">{initialError || "正在读取 PSD 和配置…"}</div>}
  </main>;
}
