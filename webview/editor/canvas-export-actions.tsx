import { DialogHeading } from "../components/dialog-heading";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import {Package,RefreshCw} from "lucide-react";
import type {GameFlowDocument,GameFlowPage} from "../../shared/model";
import {planPrefabExport,prefabFileName,type PrefabExportBatch,type PrefabPlan,type PrefabTarget} from "../../shared/prefab-export";
import {initialPrefabBase,inspectPrefab,prefabTarget,type PrefabReview} from "../../shared/prefab-sync";
import {PrefabSyncDialog,type PrefabMerge} from "./prefab-sync-dialog";
import type {Resources} from "../runtime/resource-context";
import {exportImageResolver,inspectPrefabTarget,commitPrefab} from "../runtime/prefab-export";
import type {WorkbenchSettingsUI} from "../workbench-settings";
import {Button} from "../components/ui/button";
import {Tooltip,TooltipContent,TooltipTrigger} from "../components/ui/tooltip";
interface ExportProps {
  document:GameFlowDocument;page:GameFlowPage;sourcePage:GameFlowPage;resources:Resources;settings:WorkbenchSettingsUI;disabled:boolean;
  prepare:(expected:GameFlowDocument,source:GameFlowPage,next:GameFlowPage)=>GameFlowDocument;
  applyBrowser:(expected:GameFlowDocument,next:GameFlowDocument)=>void;
  onNotice:(message:string)=>void;
}
type Snapshot=Awaited<ReturnType<typeof inspectPrefabTarget>>;
interface ReviewSession {source:GameFlowPage;doc:GameFlowDocument;snapshot:Snapshot;plan:PrefabPlan;comparison:PrefabReview}
export function CanvasExportActions({document,page,sourcePage,resources,settings,onNotice,disabled,prepare,applyBrowser}:ExportProps){
  const [busy,setBusy]=useState(false),[session,setSession]=useState<ReviewSession|null>(null);
  const [missing,setMissing]=useState<{plan:PrefabPlan;finish:()=>Promise<void>}|null>(null);
  const [targetChoice,setTargetChoice]=useState(false);
  const [recreate,setRecreate]=useState<{path:string;run:()=>Promise<void>}|null>(null);
  const target={name:prefabFileName(page),directory:document.exportDirectory};
  const saved=sourcePage.prefabSync?.target;
  async function finish(doc:GameFlowDocument,source:GameFlowPage,updated:GameFlowPage,snapshot:Snapshot,batch:PrefabExportBatch,write:boolean,added:string[]) {
    const next=prepare(doc,source,updated);
    await commitPrefab(batch,snapshot,{hash:snapshot.hash,writePrefab:write,added},next,()=>applyBrowser(doc,next));
    setSession(null);setMissing(null);resources.refresh();
    onNotice((snapshot.prefab?"已同步 ":"已导出 ")+batch.name+"。同步记录随原型保存。");
  }
  async function load(chosen:PrefabTarget,refresh=false) {
    setBusy(true);setTargetChoice(false);
    try {
      const scoped=resources.forPage?.(page)??resources;
      const plan=await planPrefabExport(document,page,exportImageResolver(scoped));
      const snapshot=await inspectPrefabTarget(chosen,plan.batch.images.map(({path,description})=>({path,nineGrid:description.nineGrid})));
      Object.assign(plan.batch,{directory:chosen.directory,name:chosen.name});
      const path=prefabTarget(chosen);
      if(snapshot.prefab) {
        const comparison=inspectPrefab(document,sourcePage,path,snapshot.prefab,snapshot.metadata);
        setSession({doc:document,source:sourcePage,snapshot,plan,comparison});
      } else {
        const next={...sourcePage,prefabSync:initialPrefabBase(document,sourcePage,path)};
        const create=()=>finish(document,sourcePage,next,snapshot,plan.batch,true,[]);
        const generate=async()=>{if(plan.missing.length)setMissing({plan,finish:create});else await create();};
        if(refresh || saved===path)setRecreate({path,run:generate});else await generate();
      }
    } catch(e){onNotice(String(e));}finally{setBusy(false);}
  }
  function exportPrefab() {
    if(!settings.settings.resourceDirectory||!settings.settings.prefabDirectory){settings.show();onNotice("请选择资源和预制体导出根目录。");return;}
    if(saved && saved!==prefabTarget(target)) setTargetChoice(true); else void load(target);
  }
  async function applyMerge(merge:PrefabMerge) {
    if(!session)return;
    const commit=()=>finish(session.doc,session.source,merge.page,session.snapshot,merge.batch,merge.changed,merge.added);
    const missing=session.plan.missing.filter(i=>merge.added.includes(i.nodeId));
    if(missing.length)setMissing({plan:{...session.plan,missing},finish:commit});else await commit();
  }
  const actionLabel=busy?"正在处理":saved?"同步":"导出",ActionIcon=saved?RefreshCw:Package;
  return <>
    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="toolbar-button" aria-label={actionLabel} disabled={busy||disabled} onClick={exportPrefab}><ActionIcon size={18}/></Button></TooltipTrigger><TooltipContent side="top">{actionLabel}</TooltipContent></Tooltip>
    {createPortal(<>
    {session && <PrefabSyncDialog review={session.comparison} plan={session.plan} skins={session.snapshot.skins} resourceRoot={settings.settings.resourceDirectory} close={()=>setSession(null)} commit={applyMerge} reload={async()=>{setSession(null);await load(session.plan.batch,true);}}/>}
    {recreate && <MissingTarget path={recreate.path} cancel={()=>setRecreate(null)} generate={()=>{setRecreate(null);setBusy(true);void recreate.run().catch(e=>onNotice(String(e))).finally(()=>setBusy(false));}}/>}
    {missing && <MissingResourcesDialog plan={missing.plan} onCancel={()=>setMissing(null)} onContinue={()=>{const action=missing.finish;setMissing(null);setBusy(true);void action().catch(e=>onNotice(String(e))).finally(()=>setBusy(false));}}/>}
    {targetChoice && saved && <TargetChoice previous={saved} current={prefabTarget(target)} select={p=>{if(!p){setTargetChoice(false);return;}const parts=p.split("/"),name=parts.pop()!;void load({name,directory:parts.join("/")||undefined});}}/>}
    </>, window.document.body)}
  </>;
}
function ExportDialog({title, close, children, actions}: {title: string; close: () => void; children: ReactNode; actions: ReactNode}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="floating-panel workbench-dialog missing-resources-dialog" aria-label={title}
    onCancel={event => { event.preventDefault(); close(); }}>
    <DialogHeading heading={title} onClose={close} />
    <div className="dialog-body">{children}</div>
    <footer>{actions}</footer>
  </dialog>;
}

function MissingTarget({path,cancel,generate}:{path:string;cancel:()=>void;generate:()=>void}) {
  return <ExportDialog title="关联的预制体已移走或删除" close={cancel} actions={<>
    <Button variant="outline" onClick={cancel}>取消</Button><Button onClick={generate}>按当前原型重新生成</Button>
  </>}><p>{path}</p></ExportDialog>;
}

function TargetChoice({previous,current,select}:{previous:string;current:string;select:(path?:string)=>void}) {
  return <ExportDialog title="选择预制体目标" close={()=>select()} actions={<Button variant="outline" onClick={()=>select()}>取消</Button>}>
    <p>页面的导出路径已变化。</p>
    <dl className="sync-values">
      <dt>已关联</dt><dd><Button variant="secondary" onClick={()=>select(previous)}>继续同步 {previous}</Button></dd>
      <dt>当前目标</dt><dd><Button variant="secondary" onClick={()=>select(current)}>使用 {current}</Button></dd>
    </dl>
  </ExportDialog>;
}

function MissingResourcesDialog({plan,onCancel,onContinue}:{plan:PrefabPlan;onCancel():void;onContinue():void}) {
  return <ExportDialog title="有资源缺失，是否继续导出？" close={onCancel} actions={<>
    <Button variant="outline" onClick={onCancel}>取消</Button><Button onClick={onContinue}>仍然导出</Button>
  </>}>
    <p>继续导出会保留缺失图片的引用，并输出页面结构、文字和其他正常资源。</p>
    <ul>{plan.missing.map(item=><li key={item.nodeId+item.slot}><strong>{item.nodeName} · {item.slot}</strong><code>{item.path}</code><span>{item.error}</span></li>)}</ul>
  </ExportDialog>;
}
