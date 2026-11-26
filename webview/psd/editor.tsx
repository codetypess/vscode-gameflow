import { Layers3 } from "lucide-react";
import { useState } from "react";
import { Separator } from "../components/ui/separator";
import { useWorkbenchSettings, WorkbenchSettingsButton, WorkbenchSettingsPanel } from "../workbench-settings";
import { PsdWorkspace } from "./workspace";
import { usePsdEditor } from "./use-psd-editor";
import { ExtensionUpdateButton, useExtensionUpdate } from "../extension-update";

export function PsdEditorApp() {
  const extensionUpdate = useExtensionUpdate();
  const { binding, initialError } = usePsdEditor();
  const settings = useWorkbenchSettings();
  const [documentActions, setDocumentActions] = useState<HTMLDivElement | null>(null);
  return <main className="app-shell"><header className="topbar">{extensionUpdate.blocked ? <ExtensionUpdateButton update={extensionUpdate} /> : <><span className="brand-mark"><Layers3 size={18} /></span><strong>工作台</strong></>}<div ref={setDocumentActions} className="workbench-document-actions">{binding ? null : <WorkbenchSettingsButton settings={settings} />}</div><Separator orientation="vertical" className="topbar-separator" /><span className="document-title">PSD 切图配置</span></header>
    <WorkbenchSettingsPanel settings={settings} />
    {binding ? <PsdWorkspace mode="slice" active binding={binding} documentActions={documentActions} settings={settings} /> : <div className="psd-empty" role="status">{initialError || "正在读取 PSD 和配置…"}</div>}
  </main>;
}
