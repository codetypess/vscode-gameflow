import { useEffect, useMemo, useState } from "react";
import { Layers3 } from "lucide-react";
import type { PsdAsset } from "../../shared/psd-meta";
import { applyPsdDraft, makePsdDraft } from "../../shared/psd-draft";
import type { PsdEditorMessage } from "../../shared/psd-editor-protocol";
import { postPsdMessage } from "../vscode-api";
import { PsdWorkspace, type PsdWorkspaceBinding } from "./workspace";
import { psdTask } from "./io";
import { PsdDocumentSession } from "./document-session";

export function PsdEditorApp() {
  const [, render] = useState(0);
  const [source, setSource] = useState<{ asset: PsdAsset; bytes: ArrayBuffer } | null>(null);
  const [initialError, setInitialError] = useState("");
  const [configPath, setConfigPath] = useState("");
  const [notice, setNotice] = useState("");
  const session = useMemo(() => new PsdDocumentSession(postPsdMessage, () => render(n => n + 1)), []);
  useEffect(() => {
    let alive = true;
    const listener = async ({ data }: MessageEvent<PsdEditorMessage>) => {
      if (data?.type === "psdEditorInit") {
        try {
          const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0)).buffer;
          const asset = await psdTask<PsdAsset>("read", bytes, data.name);
          if (!alive) return;
          setSource({ asset, bytes }); setConfigPath(data.configPath); setNotice(data.notice ?? ""); session.initialize(data.state);
        } catch (error) { if (alive) setInitialError(error instanceof Error ? error.message : String(error)); }
      } else session.receive(data);
    };
    window.addEventListener("message", listener); postPsdMessage({ type: "psdEditorReady" });
    return () => { alive = false; window.removeEventListener("message", listener); session.dispose(); };
  }, [session]);
  const binding: PsdWorkspaceBinding | undefined = source && session.state && session.draft ? {
    loaded: { ...source, asset: applyPsdDraft(source.asset, session.draft, true) },
    dirty: session.state.dirty || session.pending || session.unsent,
    pending: session.pending, busy: session.busy,
    status: session.pending ? "正在同步修改…" : session.state.dirty ? session.state.backup === "saved" ? "草稿已备份 · 尚未保存配置" : session.state.backup === "pending" ? "正在备份草稿…" : "配置尚未保存" : "配置已保存",
    configPath, notice, error: session.error ?? session.state.error,
    change: asset => session.edit(makePsdDraft(asset)),
    save: copy => session.run(copy ? "copy" : "save"),
    history: redo => session.run(redo ? "redo" : "undo"), retry: () => session.retry()
  } : undefined;
  return <main className="app-shell"><header className="topbar"><div className="brand"><Layers3 size={18} /><strong>工作台</strong></div><span className="document-title">PSD 切图配置</span><span className="sync-status">{binding?.status ?? "正在读取 PSD…"}</span></header>
    {binding ? <PsdWorkspace mode="slice" active binding={binding} /> : <div className="psd-empty" role="status">{initialError || "正在读取 PSD 和配置…"}</div>}
  </main>;
}
