import { Download, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isExtensionUpdateState, type ExtensionUpdateState } from "../shared/extension-update";
import { Button } from "./components/ui/button";
import { isBrowserPreview, postHostMessage } from "./vscode-api";

export function useExtensionUpdate() {
  const [state, setState] = useState<ExtensionUpdateState>({ status: "current" });
  const latest = useRef(state);
  const requested = useRef(false);
  useEffect(() => {
    if (isBrowserPreview) return;
    const synchronize = () => { if (!document.hidden) postHostMessage({ type: "extensionUpdateReady" }); };
    const receive = ({ data }: MessageEvent) => {
      if (data?.type !== "extensionUpdateState" || !isExtensionUpdateState(data.state)) return;
      latest.current = data.state;
      requested.current = data.state.status === "installing";
      setState(data.state);
    };
    window.addEventListener("message", receive);
    window.addEventListener("focus", synchronize);
    window.addEventListener("pageshow", synchronize);
    document.addEventListener("visibilitychange", synchronize);
    synchronize();
    return () => {
      window.removeEventListener("message", receive);
      window.removeEventListener("focus", synchronize);
      window.removeEventListener("pageshow", synchronize);
      document.removeEventListener("visibilitychange", synchronize);
    };
  }, []);
  return {
    state,
    blocked: state.status !== "current",
    isBlocked: () => latest.current.status !== "current",
    install: () => {
      if (requested.current || latest.current.status === "current") return;
      requested.current = true;
      postHostMessage({ type: "installExtensionUpdate" });
    }
  };
}

export function ExtensionUpdateButton({ update }: { update: ReturnType<typeof useExtensionUpdate> }) {
  if (update.state.status === "current") return null;
  const { status, version, error } = update.state;
  const hint = status === "pending" ? `${version} 已安装，请先保存文件，再按 VS Code 提示完成生效。`
    : status === "installing" ? `正在安装 ${version}，请稍候。`
    : error ? `更新失败：${error}。点击重试更新到 ${version}。`
    : `发现新版本 ${version}，请先更新插件再切换工作区。`;
  return <Button size="sm" className="workspace-update-button" aria-label="更新插件" aria-busy={status === "installing"} disabled={status === "installing"} title={hint} onClick={update.install}>
    {status === "installing" ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}<span>更新插件</span>
    <span className="sr-only" role="status">{hint}</span>
  </Button>;
}
