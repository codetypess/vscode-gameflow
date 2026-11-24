import { FileImage, Link2, RotateCcw } from "lucide-react";
import type { GameFlowPage } from "../../shared/model";
import type { ResourceMode } from "../../shared/image-slots";
import { pagePsdKey } from "../../shared/page-psd";
import type { PagePsdActions } from "../runtime/page-psd";
import { Button } from "../components/ui/button";

type PageArtStateLayout = "full" | "compact" | "minimal";

function pageArtStateLayout(page: GameFlowPage, zoom: number): { kind: PageArtStateLayout; scale: number } {
  const short = page.frame.height < 150;
  const kind: PageArtStateLayout = page.frame.width < 220 || short && page.frame.width < 280 ? "minimal" : short ? "compact" : "full";
  const natural = kind === "full" ? { width: 290, height: 170 } : kind === "compact" ? { width: 250, height: 34 } : { width: 90, height: 34 };
  return { kind, scale: Math.min(1 / zoom, page.frame.width / natural.width, page.frame.height / natural.height) };
}

export function pageArtReady(page: GameFlowPage, actions: PagePsdActions) {
  const state = actions.states[page.id];
  return !!page.artPsd && state?.key === pagePsdKey(page.artPsd) && state.status === "ready";
}
export function pagePreviewBlocked(page: GameFlowPage, actions: PagePsdActions, mode: ResourceMode) {
  return mode !== "prototype" && !pageArtReady(page, actions);
}
export function PageArtState({ page, actions, zoom = 1 }: { page: GameFlowPage; actions: PagePsdActions; zoom?: number }) {
  const state = actions.states[page.id], bound = !!page.artPsd, current = state?.key === pagePsdKey(page.artPsd) ? state : undefined;
  const busy = actions.busy.has(page.id), error = current?.status === "error";
  const layout = pageArtStateLayout(page, zoom);
  const title = !bound ? "尚未绑定美术 PSD" : error ? "无法预览美术 PSD" : "正在加载美术 PSD…";
  const compactTitle = !bound ? "未绑定 PSD" : error ? "PSD 无法预览" : "PSD 加载中…";
  const generateLabel = layout.kind === "full" ? "生成 PSD" : "生成";
  const chooseLabel = layout.kind === "full" ? bound ? "重新绑定 PSD" : "绑定 PSD" : bound ? "重绑" : "绑定";
  return <div className="page-art-state" data-art-state={!bound ? "unbound" : error ? "error" : "loading"} data-art-layout={layout.kind} aria-label={title} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <div className={`page-art-state-card is-${layout.kind}`} style={{ transform: `scale(${layout.scale})` }}>
      <FileImage size={25} aria-hidden="true"/><strong>{layout.kind === "full" ? title : compactTitle}</strong>
      <p>{!bound ? "为此页面生成或绑定一份 PSD" : error ? current.error : page.artPsd!.source}</p>
      <div>{!bound ? <Button size="sm" variant="outline" aria-label="生成 PSD" title="生成 PSD" disabled={busy} onClick={() => void actions.run(page.id, "generate")}><FileImage size={14} aria-hidden="true"/><span className="page-art-action-label">{generateLabel}</span></Button> : error ? <Button size="sm" variant="outline" aria-label="重试" title="重试" disabled={busy} onClick={() => actions.retry(page.id)}><RotateCcw size={14} aria-hidden="true"/><span className="page-art-action-label">重试</span></Button> : null}
      {!bound || error ? <Button size="sm" aria-label={bound ? "重新绑定 PSD" : "绑定 PSD"} title={bound ? "重新绑定 PSD" : "绑定 PSD"} disabled={busy} onClick={() => void actions.run(page.id, "choose")}><Link2 size={14} aria-hidden="true"/><span className="page-art-action-label">{chooseLabel}</span></Button> : null}</div>
    </div>
  </div>;
}
