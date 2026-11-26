import { useEffect, useMemo, useRef, useState } from "react";
import type { PsdAsset } from "../../shared/psd-meta";
import { applyPsdDraft, makePsdDraft } from "../../shared/psd-draft";
import type { PsdEditorMessage } from "../../shared/psd-editor-protocol";
import { isBrowserPreview, postPsdMessage } from "../vscode-api";
import type { PsdWorkspaceBinding } from "./workspace";
import { psdTask } from "./io";
import { PsdDocumentSession } from "./document-session";

/** Reused by the embedded workbench and the optional standalone PSD editor. */
export function usePsdEditor(onOpen?: () => void) {
  const [, render] = useState(0);
  const [source, setSource] = useState<{ asset: PsdAsset; bytes: ArrayBuffer } | null>(null);
  const [initialError, setInitialError] = useState("");
  const [configPath, setConfigPath] = useState("");
  const session = useRef<PsdDocumentSession>();
  const opened = useRef(onOpen); opened.current = onOpen;
  if (!session.current) session.current = new PsdDocumentSession(postPsdMessage, () => render(n => n + 1));
  useEffect(() => {
    if (isBrowserPreview) return;
    let alive = true, generation = 0;
    const listener = async ({ data }: MessageEvent<PsdEditorMessage>) => {
      if (data?.type === "psdEditorReveal") {
        opened.current?.();
      } else if (data?.type === "psdEditorInit") {
        const current = ++generation;
        session.current!.dispose();
        session.current = new PsdDocumentSession(postPsdMessage, () => { if (alive) render(n => n + 1); });
        // Initialize before decoding so native saves can flush during pixel decoding.
        session.current.initialize(data.state);
        setInitialError(""); setSource(null);
        try {
          const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0)).buffer;
          const asset = await psdTask<PsdAsset>("read", bytes, data.name);
          if (!alive || current !== generation) return;
          setSource({ asset: { ...asset, sourceUri: data.sourceUri }, bytes }); setConfigPath(data.configPath);
        } catch (error) { if (alive && current === generation) setInitialError(error instanceof Error ? error.message : String(error)); }
      } else if (data && typeof data.type === "string" && data.type.startsWith("psdEditor")) session.current!.receive(data);
    };
    window.addEventListener("message", listener); postPsdMessage({ type: "psdEditorReady" });
    return () => { alive = false; window.removeEventListener("message", listener); session.current!.dispose(); };
  }, []);
  const controller = session.current;
  const draft = controller.draft;
  const loaded = useMemo(() => source && draft && source.asset.sourceHash === draft.sourceHash
    ? { ...source, asset: applyPsdDraft(source.asset, draft, true) } : undefined, [source, draft]);
  const binding: PsdWorkspaceBinding | undefined = loaded && controller.state ? {
    loaded,
    dirty: controller.state.dirty || controller.pending || controller.unsent,
    pending: controller.pending, busy: controller.busy,
    status: controller.pending ? "正在同步修改…" : controller.state.dirty ? controller.state.backup === "saved" ? "草稿已备份 · 尚未保存配置" : controller.state.backup === "pending" ? "正在备份草稿…" : "配置尚未保存" : "配置已保存",
    configPath, notice: controller.state.warning, error: controller.error ?? controller.state.error,
    change: asset => controller.edit(makePsdDraft(asset)), save: copy => controller.run(copy ? "copy" : "save"),
    history: redo => controller.run(redo ? "redo" : "undo"), retry: () => controller.retry()
  } : undefined;
  return { binding, initialError };
}
