import { FileImage, Link2, RotateCcw } from "lucide-react";
import type { GameFlowPage } from "../../shared/model";
import { pagePsdKey } from "../../shared/page-psd";
import type { PagePsdActions } from "../runtime/page-psd";
import { Button } from "../components/ui/button";
export function pageArtReady(page: GameFlowPage, actions: PagePsdActions) {
  const state = actions.states[page.id];
  return !!page.artPsd && state?.key === pagePsdKey(page.artPsd) && state.status === "ready";
}
export function PageArtState({ page, actions, zoom = 1 }: { page: GameFlowPage; actions: PagePsdActions; zoom?: number }) {
  const state = actions.states[page.id], bound = !!page.artPsd, current = state?.key === pagePsdKey(page.artPsd) ? state : undefined;
  const busy = actions.busy.has(page.id), error = current?.status === "error";
  const scale = Math.min(1 / zoom, Math.max(.25, page.frame.width / 290), Math.max(.25, page.frame.height / 170));
  return <div className="page-art-state" data-art-state={!bound ? "unbound" : error ? "error" : "loading"} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <div className="page-art-state-card" style={{ transform: "scale(" + scale + ")" }}>
      <FileImage size={25}/><strong>{!bound ? "尚未绑定美术 PSD" : error ? "无法预览美术 PSD" : "正在加载美术 PSD…"}</strong>
      <p>{!bound ? "为此页面生成或绑定一份 PSD" : error ? current.error : page.artPsd!.source}</p>
      <div>{!bound ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void actions.run(page.id, "generate")}><FileImage size={14}/>生成 PSD</Button> : error ? <Button size="sm" variant="outline" disabled={busy} onClick={() => actions.retry(page.id)}><RotateCcw size={14}/>重试</Button> : null}
      {!bound || error ? <Button size="sm" disabled={busy} onClick={() => void actions.run(page.id, "choose")}><Link2 size={14}/>{bound ? "重新绑定 PSD" : "绑定 PSD"}</Button> : null}</div>
    </div>
  </div>;
}
