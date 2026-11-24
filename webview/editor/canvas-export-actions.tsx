import { DialogHeading } from "../components/dialog-heading";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {ArrowRight, ChevronRight, GitMerge, MoreHorizontal, Pin, RefreshCw} from "lucide-react";
import type {GameFlowDocument,GameFlowPage} from "../../shared/model";
import type {CanvasSources} from "../../shared/canvas-references";
import {planListPrefabExport} from "../../shared/list-prefab-export";
import {composeCanvasPage} from "../../shared/canvas-instances";
import {nodeSlots,prefabFileName,type PrefabExportBatch,type PrefabPlan,type PrefabTarget} from "../../shared/prefab-export";
import {initialPrefabBase,inspectPrefab,prefabTarget,type PrefabReview,type PrefabSyncMode} from "../../shared/prefab-sync";
import {PrefabSyncDialog,prefabSyncLabels,type PrefabMerge} from "./prefab-sync-dialog";
import type {Resources} from "../runtime/resource-context";
import {browserHash,exportImageResolver,inspectPrefabTarget,commitPrefab} from "../runtime/prefab-export";
import {readPsdPrefabSource} from "../runtime/psd-prefab";
import type {WorkbenchSettingsUI} from "../workbench-settings";
import {Button} from "../components/ui/button";
import {Tooltip,TooltipContent,TooltipTrigger} from "../components/ui/tooltip";

interface ExportProps {
  sources:CanvasSources;document:GameFlowDocument;page:GameFlowPage|null;sourcePage?:GameFlowPage;resources:Resources;settings:WorkbenchSettingsUI;disabled:boolean;mappingError:boolean;
  prepare:(expected:GameFlowDocument,source:GameFlowPage,next:GameFlowPage)=>GameFlowDocument;
  applyBrowser:(expected:GameFlowDocument,next:GameFlowDocument)=>void;
  onNotice:(message:string)=>void;
  onPsdSync:()=>void;
  onPushPsd:()=>void;
  children:ReactNode;
}
type Snapshot=Awaited<ReturnType<typeof inspectPrefabTarget>>;
type ArtSource=Awaited<ReturnType<typeof readPsdPrefabSource>>;
interface PrefabOperation {
  mode:PrefabSyncMode;source:GameFlowPage;doc:GameFlowDocument;snapshot:Snapshot;art?:ArtSource;
}
interface ReviewSession extends PrefabOperation {
  cells:Map<string,GameFlowPage>;plan:PrefabPlan;comparison:PrefabReview;
}
function prototypeExportPage(page:GameFlowPage):GameFlowPage {
  return {...page,nodes:page.nodes.map(node=>{
    const slots=nodeSlots(node);
    if(!slots.some(([,slot])=>slot?.art)) return node;
    const copy={...node};
    for(const [field,slot] of slots) if(slot?.art) copy[field]=slot.builtin?{builtin:slot.builtin}:null;
    return copy;
  })};
}
function useSyncPin(action:"psd"|"prefab") {
  const key="gameflow.toolbar.pin."+action;
  const [pinned,setPinned]=useState(()=>{
    try { return localStorage.getItem(key)==="true"; }
    catch { return false; }
  });
  useEffect(()=>{
    function restore(event:StorageEvent) {
      if(event.key===key || event.key===null) setPinned(event.newValue==="true");
    }
    window.addEventListener("storage",restore);
    return ()=>window.removeEventListener("storage",restore);
  },[key]);
  function setPin(value:boolean) {
    setPinned(value);
    try { localStorage.setItem(key,String(value)); }
    catch { /* Keep the preference for the current session. */ }
  }
  return {pinned,setPin};
}
export function CanvasExportActions({document,sources,page,sourcePage,resources,settings,onNotice,disabled,mappingError,prepare,applyBrowser,onPsdSync,onPushPsd,children}:ExportProps){
  const [busy,setBusy]=useState(false),[session,setSession]=useState<ReviewSession|null>(null);
  const [missing,setMissing]=useState<{plan:PrefabPlan;finish:()=>Promise<void>}|null>(null);
  const [targetChoice,setTargetChoice]=useState<PrefabSyncMode|null>(null);
  const [recreate,setRecreate]=useState<{path:string;source:string;run:()=>Promise<void>}|null>(null);
  const saved=sourcePage?.prefabSync?.target;
  const target={name:page?prefabFileName(page):"",directory:document.exportDirectory};

  async function finish(operation:PrefabOperation,updated:GameFlowPage,batch:PrefabExportBatch,write:boolean,added:string[]) {
    const {doc,source,snapshot,mode,art}=operation;
    await art?.verify();
    const composedUpdated=art ? updated : composeCanvasPage(doc,updated,sources).page;
    const prepared=prepare(doc,source,composedUpdated), next=art ? doc : prepared;
    const guard={hash:snapshot.hash,writePrefab:write,added,source:art?"psd" as const:mode==="pull"?"prefab" as const:undefined};
    await commitPrefab(batch,snapshot,guard,next,()=>applyBrowser(doc,next));
    setSession(null);setMissing(null);resources.refresh();
    onNotice(mode==="pull"?"已从预制体更新原型。":(snapshot.prefab?"已同步 ":"已导出 ")+batch.name);
  }
  async function load(chosen:PrefabTarget,mode:PrefabSyncMode,refresh=false) {
    if(!page || !sourcePage) return;
    setBusy(true);setTargetChoice(null);
    try {
      const art=mode==="art"?await readPsdPrefabSource(document,sourcePage):undefined;
      const canonical=document.pages.find(item=>item.id===sourcePage.id) ?? sourcePage;
      const exportPage=art?.page ?? (mode==="pull"?{...sourcePage,nodes:[]}:mode==="push"?prototypeExportPage(canonical):canonical);
      const cellPlan=await planListPrefabExport(document,exportPage,sources,
        item=>art && item===art.page?art.resolve:exportImageResolver(resources.forPage?.(item)??resources),file=>inspectPrefabTarget(file,[]),chosen);
      const {plan}=cellPlan;
      const images=await Promise.all(plan.batch.images.map(async({path,description,base64})=>({
        path,nineGrid:description.nineGrid,sha256:art?await browserHash(Uint8Array.from(atob(base64),c=>c.charCodeAt(0))):undefined
      })));
      const snapshot=await inspectPrefabTarget(chosen,images);
      Object.assign(plan.batch,{directory:chosen.directory,name:chosen.name});
      const path=prefabTarget(chosen);
      const operation={mode,doc:document,source:sourcePage,snapshot,art};
      if(snapshot.prefab) {
        await cellPlan.locateDiskBindings(snapshot.prefab);
        const comparison=inspectPrefab(document,art?.page??canonical,path,snapshot.prefab,snapshot.metadata,cellPlan.refs,mode);
        setSession({...operation,cells:cellPlan.previews,plan,comparison});
      } else {
        if(mode==="pull") throw new Error("找不到来源预制体："+path);
        const next=art ? sourcePage : {...sourcePage,prefabSync:initialPrefabBase(document,sourcePage,path)};
        const create=()=>finish(operation,next,plan.batch,true,[]);
        const generate=async()=>{if(plan.missing.length)setMissing({plan,finish:create});else await create();};
        if(refresh || saved===path)setRecreate({path,source:art?"PSD":"原型",run:generate});else await generate();
      }
    } catch(e){onNotice(String(e));}finally{setBusy(false);}
  }
  function exportPrefab(mode:PrefabSyncMode) {
    if(!page || !sourcePage || disabled || busy) return;
    if(!settings.settings.prefabDirectory || mode!=="pull" && !settings.settings.resourceDirectory){
      settings.show();onNotice(mode==="pull"?"请选择预制体根目录。":"请选择资源和预制体导出根目录。");return;
    }
    if(saved && saved!==prefabTarget(target)) setTargetChoice(mode); else void load(target,mode);
  }
  async function applyMerge(merge:PrefabMerge) {
    if(!session)return;
    const updated=session.art?session.source:merge.page;
    const commit=()=>finish(session,updated,merge.batch,session.mode!=="pull" && merge.changed,merge.added);
    const templateNodes = new Set<string>();
    for (const cell of merge.batch.cells ?? []) if (cell.prefab) JSON.stringify(cell.prefab,(key,value)=>{
      if(key === "_$id" && typeof value === "string") templateNodes.add(value);
      return value;
    });
    const missing=session.plan.missing.filter(i=>session.mode==="art" || session.mode==="push" || merge.added.includes(i.nodeId) || templateNodes.has(i.nodeId));
    if(missing.length)setMissing({plan:{...session.plan,missing},finish:commit});else await commit();
  }
  const unavailable=disabled || busy;
  const psdPin=useSyncPin("psd"), prefabPin=useSyncPin("prefab");
  const syncActions=[
    {label:"PSD 同步",Icon:GitMerge,disabled:unavailable || !sourcePage?.artPsd,run:onPsdSync,...psdPin},
    {label:prefabSyncLabels.review,Icon:RefreshCw,disabled:unavailable || mappingError,run:()=>exportPrefab("review"),...prefabPin}
  ];
  return <>
    {syncActions.filter(action=>action.pinned).map(({label,Icon,disabled,run})=>
      <Tooltip key={label}><TooltipTrigger asChild>
        <Button size="icon" variant="ghost" className="toolbar-button" aria-label={label} disabled={disabled} onClick={run}><Icon size={18}/></Button>
      </TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>
    )}
    <DropdownMenu.Root modal={false}>
      <Tooltip><TooltipTrigger asChild><DropdownMenu.Trigger asChild disabled={busy}><Button size="icon" variant="ghost" className="toolbar-button" aria-label="更多"><MoreHorizontal size={19}/></Button></DropdownMenu.Trigger></TooltipTrigger><TooltipContent side="top">更多</TooltipContent></Tooltip>
      <DropdownMenu.Portal><DropdownMenu.Content loop side="top" align="end" sideOffset={8} collisionPadding={12} className="layer-context-menu" onPointerDown={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
        {children}
        {syncActions.map(({label,Icon,disabled,run,pinned,setPin})=>
          <div className="sync-menu-row" key={label}>
            <DropdownMenu.Item disabled={disabled} onSelect={run}><Icon size={15}/><span>{label}</span></DropdownMenu.Item>
            <DropdownMenu.CheckboxItem className="sync-menu-pin" checked={pinned} aria-label={"固定"+label}
              title={(pinned?"取消固定":"固定到工具栏")+" · "+label} onCheckedChange={setPin} onSelect={event=>event.preventDefault()}>
              <Pin size={14} aria-hidden="true" fill={pinned?"currentColor":"none"}/>
            </DropdownMenu.CheckboxItem>
          </div>
        )}
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger disabled={unavailable}><ArrowRight size={15}/><span>单向同步</span><ChevronRight size={14}/></DropdownMenu.SubTrigger>
          <DropdownMenu.Portal><DropdownMenu.SubContent loop sideOffset={3} collisionPadding={8} className="layer-context-menu" onPointerDown={event=>event.stopPropagation()}>
            <DropdownMenu.Item onSelect={()=>exportPrefab("push")}>{prefabSyncLabels.push}</DropdownMenu.Item>
            <DropdownMenu.Item onSelect={()=>exportPrefab("pull")}>{prefabSyncLabels.pull}</DropdownMenu.Item>
            <DropdownMenu.Item onSelect={onPushPsd}>从原型到 PSD</DropdownMenu.Item>
            <DropdownMenu.Item disabled={!sourcePage?.artPsd} onSelect={()=>exportPrefab("art")}>{prefabSyncLabels.art}</DropdownMenu.Item>
          </DropdownMenu.SubContent></DropdownMenu.Portal>
        </DropdownMenu.Sub>
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>
    {createPortal(<>
    {session && <PrefabSyncDialog mode={session.mode} asset={session.art?.asset} cells={session.cells} review={session.comparison} plan={session.plan} skins={session.snapshot.skins} resourceRoot={settings.settings.resourceDirectory} close={()=>setSession(null)} commit={applyMerge} reload={async()=>{setSession(null);await load(session.plan.batch,session.mode,true);}}/>}
    {recreate && <MissingTarget path={recreate.path} source={recreate.source} cancel={()=>setRecreate(null)} generate={()=>{setRecreate(null);setBusy(true);void recreate.run().catch(e=>onNotice(String(e))).finally(()=>setBusy(false));}}/>}
    {missing && <MissingResourcesDialog plan={missing.plan} onCancel={()=>setMissing(null)} onContinue={()=>{const action=missing.finish;setMissing(null);setBusy(true);void action().catch(e=>onNotice(String(e))).finally(()=>setBusy(false));}}/>}
    {targetChoice && saved && <TargetChoice previous={saved} current={prefabTarget(target)} select={p=>{if(!p){setTargetChoice(null);return;}const parts=p.split("/"),name=parts.pop()!;void load({name,directory:parts.join("/")||undefined},targetChoice);}}/>}
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

function MissingTarget({path,source,cancel,generate}:{path:string;source:string;cancel:()=>void;generate:()=>void}) {
  return <ExportDialog title="关联的预制体已移走或删除" close={cancel} actions={<>
    <Button variant="outline" onClick={cancel}>取消</Button><Button onClick={generate}>按当前{source}重新生成</Button>
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
