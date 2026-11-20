import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Package } from "lucide-react";
import type { GameFlowDocument, GameFlowPage } from "../../shared/model";
import { planPrefabExport, type PrefabPlan } from "../../shared/prefab-export";
import type { Resources } from "../runtime/resource-context";
import { exportImageResolver, writePrefab } from "../runtime/prefab-export";
import type { WorkbenchSettingsUI } from "../workbench-settings";
import { Button } from "../components/ui/button";
export function CanvasExportActions({document,page,resources,settings,onNotice,disabled}:{document:GameFlowDocument;page:GameFlowPage;resources:Resources;settings:WorkbenchSettingsUI;onNotice(message:string):void;disabled:boolean}){
  const [busy,setBusy]=useState(false),[review,setReview]=useState<PrefabPlan|null>(null);
  useEffect(()=>setReview(null),[document,page]);
  const finish=async(plan:PrefabPlan)=>{setReview(null);setBusy(true);try{const count=await writePrefab(plan.batch);resources.refresh();onNotice("已导出 "+plan.batch.name+" 和 "+count+" 张图片"+(plan.missing.length?"；缺失资源引用已保留。":"。"));}catch(error){onNotice(String(error));}finally{setBusy(false);}};
  const exportPrefab=async()=>{
    if(!settings.settings.resourceDirectory||!settings.settings.prefabDirectory){settings.show();onNotice("请选择资源与预制体导出根目录。");return;}
    setBusy(true);try{const scoped=resources.forPage?.(page) ?? resources;const plan=await planPrefabExport(document,page,exportImageResolver(scoped));if(plan.missing.length)setReview(plan);else await finish(plan);}catch(error){onNotice(String(error));}finally{setBusy(false);}
  };
  return <>
    <Button variant="ghost" size="sm" aria-label="导出 Prefab" title="导出当前页面的预制体与图片" disabled={busy||disabled} onClick={()=>void exportPrefab()}><Package size={15}/><span className="page-export-label">{busy?"正在处理…":"导出 Prefab"}</span></Button>
    {review?<MissingResourcesDialog plan={review} onCancel={()=>setReview(null)} onContinue={()=>void finish(review)}/>:null}
  </>;
}
function MissingResourcesDialog({plan,onCancel,onContinue}:{plan:PrefabPlan;onCancel():void;onContinue():void}){
  const dialog=useRef<HTMLDialogElement>(null);useEffect(()=>{const d=dialog.current!;d.showModal();return()=>d.close();},[]);
  return createPortal(<dialog ref={dialog} className="missing-resources-dialog" aria-label="有资源缺失，是否继续导出？" onCancel={event=>{event.preventDefault();onCancel();}}><h2>有资源缺失，是否继续导出？</h2><p>继续导出会保留缺失图片的引用，并输出页面结构、文字和其他正常资源。</p><ul>{plan.missing.map(item=><li key={item.nodeId+item.slot}><strong>{item.nodeName} · {item.slot}</strong><code>{item.path}</code><span>{item.error}</span></li>)}</ul><footer><Button variant="outline" onClick={onCancel}>取消</Button><Button onClick={onContinue}>仍然导出</Button></footer></dialog>,window.document.body);
}
