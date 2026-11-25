import { SyncTree, changeSymbols } from "./sync-tree";
import { Button } from "../components/ui/button";
import { DialogHeading } from "../components/dialog-heading";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Frame, GameFlowDocument, GameFlowPage } from "../../shared/model";
import { compareTrees, plannedTrees, coordinatedBase, currentSyncBase, prototypeTree, psdTree, applyPrototypeTree, fieldNames, type Change, type Decision, type PsdComponentInstance, type Side, type SyncNode } from "../../shared/page-sync";
import { draftStamp } from "../../shared/psd-draft";
import type { PsdAsset } from "../../shared/psd-meta";
import { requestPsd, sourceBytes } from "../runtime/page-psd";
import { isBrowserPreview } from "../vscode-api";
import { psdTask } from "../psd/io";
import { NodeView, orderedNodes } from "./node-view";
import { resolvePageLayout } from "../../shared/ui-layout";
import { SliceResourcesProvider, useSliceResources } from "../runtime/resource-context";
import { syncDialogResizeEdges, useSyncDialogSize } from "./use-sync-dialog-size";
import { SyncChange, describeDecision } from "./sync-change";
import { PsdSyncLayerPicker } from "./psd-sync-layer-picker";
import { loadComponentPsds, type ComponentPsdTarget } from "../runtime/component-psd";
import { psdComponentSource } from "../../shared/psd-meta";
import { missingComponentLayers } from "../../shared/psd-component-layers";
import type { CanvasSources } from "../../shared/canvas-references";
import { psdVisualUpdates } from "../../shared/psd-visual-updates";
import type { PsdVisualUpdate } from "../../shared/page-sync";
import "./page-sync.css";

async function reviewStamp(asset:PsdAsset) {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(draftStamp(asset)));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}

export function syncPreviewHitNode(nodes:SyncNode[],old:SyncNode[],x:number,y:number) {
  const current=new Set(nodes.map(node=>node.id));
  const candidates=[...old.filter(node=>!current.has(node.id)),...nodes];
  for(let index=candidates.length-1;index>=0;index--) {
    const node=candidates[index], frame=node.frame;
    if(x>=frame.x && x<=frame.x+frame.width && y>=frame.y && y<=frame.y+frame.height) return node.id;
  }
}

export function SyncPreview({page,asset,nodes,selected,changes,old,resourceMode="prototype",canvasSize,onSelect}:{page:GameFlowPage;asset?:PsdAsset;nodes:SyncNode[];selected:string;changes:Change[];old:SyncNode[];resourceMode?:"prototype"|"prefab";canvasSize?:Pick<Frame,"width"|"height">;onSelect?:(id:string)=>void}) {
  const ref=useRef<HTMLDivElement>(null), [scale,setScale]=useState(.2);
  const resources=useSliceResources(), layout=useMemo(()=>resolvePageLayout(page),[page]);
  const w=canvasSize?.width??asset?.width??page.frame.width,h=canvasSize?.height??asset?.height??page.frame.height;
  useEffect(()=>{
    const observer=new ResizeObserver(([entry])=>setScale(Math.min(entry.contentRect.width/w,entry.contentRect.height/h)));
    if(ref.current) observer.observe(ref.current);
    return ()=>observer.disconnect();
  },[w,h]);
  const marks=new Map(changes.map(ch=>[ch.id,ch]));
  const overlays=[...new Set([...marks.keys(),selected])].map(id=>{
    const change=marks.get(id), node=nodes.find(n=>n.id===id);
    const frame=(node ?? (change?.kind==="delete"?old.find(n=>n.id===id):undefined))?.frame;
    if(!frame || scale<=0)return null;
    return <div key={id} className="sync-box" data-kind={change?.kind} data-selected={id===selected} data-ghost={!node}
      style={{left:frame.x,top:frame.y,width:frame.width,height:frame.height,borderWidth:(id===selected?2:1)/scale}}>
      {change && <b style={{fontSize:12/scale}}>{changeSymbols[change.kind]}</b>}</div>;
  });
  return <div className="sync-preview checkerboard" ref={ref}>
    <div style={{width:w*scale,height:h*scale,position:"relative"}}><div className="sync-surface" data-selectable={!!onSelect} style={{width:w,height:h,transform:`scale(${scale})`,background:page.background??"#fff"}}
      onClick={event=>{
        if(!onSelect)return;
        const direct=(event.target as HTMLElement).closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
        if(direct && nodes.some(node=>node.id===direct)) {onSelect(direct);return;}
        const bounds=event.currentTarget.getBoundingClientRect();
        const hit=syncPreviewHitNode(nodes,old,(event.clientX-bounds.left)*w/bounds.width,(event.clientY-bounds.top)*h/bounds.height);
        if(hit)onSelect(hit);
      }}>
      {asset ? <img src={asset.preview} alt="美术 PSD 合成图"/> : <SliceResourcesProvider value={{...resources,mode:resourceMode}}>{orderedNodes(page).map(n=><NodeView key={n.id} node={n} page={page} geometry={layout.nodes.get(n.id)}/>)}</SliceResourcesProvider>}
      {overlays}
    </div></div>
  </div>;
}
export interface SyncSession { document:GameFlowDocument; page:GameFlowPage; components:ReadonlyMap<string,PsdComponentInstance>; componentTargets:ReadonlyMap<string,ComponentPsdTarget>; sources:CanvasSources; makeId:()=>string; source?:Side }
function changeTitle(change: Change) {
  if (change.representation === "psd-list-cells") return "列表项智能对象";
  if (change.representation === "psd-default-image") return "内置默认图片";
  if (change.representation === "psd-smart-object") return "PSD 图层类型";
  if (change.representation === "psd-component-layers") return "智能对象图层";
  if (change.representation === "psd-component-source") return "组件源 PSD";
  return fieldNames[change.field];
}
interface Props { session:SyncSession; loadedAsset?:PsdAsset; close():void; apply(page:GameFlowPage,checkOnly?:boolean):void }
export function PageSyncDialog({session,loadedAsset,close,apply}:Props) {
  const {page,document:doc,components}=session, dialog=useRef<HTMLDialogElement>(null);
  const fixedSource=session.source;
  const {size,resizeEdgeProps}=useSyncDialogSize({storageKey:"gameflow.pagePsdSync.size.v2",defaultWidth:1280,defaultHeight:760,minWidth:360,minHeight:300});
  const canReview = isBrowserPreview || !!document.querySelector('meta[name="gameflow-page-psd-sync"][content="1"]');
  const [reviewedAsset,setAsset]=useState<PsdAsset>(), [error,setError]=useState(""), [busy,setBusy]=useState(false);
  const asset = canReview ? reviewedAsset : loadedAsset;
  const [pairs,setPairs]=useState(new Map<string,string>());
  const [selected,select]=useState(""), [expanded,setExpanded]=useState(new Set<string>([""]));
  const [choices,setChoices]=useState<Record<string,Decision>>({}), [result,setResult]=useState(false), [review,setReview]=useState(false);
  const [reload,setReload]=useState(0);
  const [componentPsds, setComponentPsds] = useState<Awaited<ReturnType<typeof loadComponentPsds>>>();
  useEffect(()=>{const d=dialog.current!;d.showModal();return ()=>d.close();},[]);
  useEffect(()=>{
    if (!canReview) return;
    let active=true;
    setAsset(undefined);setComponentPsds(undefined);setError("");setChoices({});setPairs(new Map());setReview(false);
    Promise.all([
      requestPsd({action:"review",pageId:page.id,expected:page.artPsd}),
      loadComponentPsds(fixedSource === "psd" ? new Map() : session.componentTargets),
    ]).then(([r, sources])=>{
      if (!r || r.asset.documentId!==page.artPsd?.documentId) throw new Error("页面 PSD 绑定已变化。");
      if(active) { setComponentPsds(sources); setAsset(r.asset); }
    }).catch(e=>{if(active)setError(String(e));});
    return ()=>{active=false;};
  },[session,reload,canReview]);
  const ids=useRef(new Map<string,string>());
  const comparison=useMemo(()=>{
    if(!asset) return {};
    try {
      const art=psdTree(doc.documentId,page,asset,layer=>{
        const key=layer.metadata.layerId;if(!ids.current.has(key))ids.current.set(key,session.makeId());return ids.current.get(key)!;
      },pairs,false,components);
      const comparison = compareTrees(prototypeTree(page,components),art,currentSyncBase(doc.documentId,page,asset),false,!!fixedSource);
      if (fixedSource !== "psd") for (const [id, representation] of psdVisualUpdates(doc,page,asset,art,session.sources)) {
        comparison.changes.push({ id, key: id + "/" + representation, representation, field: "exist", kind: "edit",
          replacement: "proto", members: [id], suggested: "proto" });
      }
      if (fixedSource !== "psd") for (const node of comparison.proto) {
        if (!components.has(node.id)) continue;
        const matched = art.find(item => item.id === node.id);
        const layer = matched && asset.layers.find(layer => layer.metadata.layerId === matched.layer);
        if (layer?.group)
          comparison.changes.push({ id: node.id, key: node.id + "/smart-object", field: "exist", kind: "edit",
            replacement: "proto", representation: "psd-smart-object", members: [node.id], suggested: "proto" });
        const contents = layer?.smartObject?.contents;
        const incoming = componentPsds?.results.get(node.id)?.source;
        const previous = psdComponentSource(layer?.metadata.componentSource);
        const embeddedHash = layer?.smartObject?.hash;
        if (incoming && embeddedHash) {
          const origin = incoming.origin;
          const firstLink = !previous || previous.documentId !== origin.documentId || previous.pageId !== origin.pageId || previous.psdId !== origin.psdId;
          const conflict = embeddedHash !== origin.sourceHash && (firstLink || embeddedHash !== previous.embeddedHash);
          if (firstLink || previous.sourceHash !== origin.sourceHash) comparison.changes.push({
            id: node.id, key: node.id + "/component-source", field: "exist", kind: "edit",
            representation: "psd-component-source", members: [node.id],
            componentSource: { name: incoming.name, conflict, firstLink }, suggested: conflict ? undefined : "proto",
          });
        } else if (!session.componentTargets.get(node.id)?.page.artPsd && !previous && layer?.metadata.componentSmartObject === true && contents) {
          const addedLayers = missingComponentLayers(page, node.id, contents);
          if (addedLayers.length) comparison.changes.push({ id: node.id, key: node.id + "/component-layers", field: "exist", kind: "edit",
            replacement: "proto", representation: "psd-component-layers", members: [node.id], addedLayers, suggested: "proto" });
        }
      }
      return {data:comparison};
    } catch(e){return {issue:String(e)};}
  },[session,asset,pairs,componentPsds]);
  const c=comparison.data, changes=c?.changes??[];
  const nodeList=useMemo(()=>{
    const union=new Map<string,SyncNode>();
    for(const n of [...c?.proto??[],...c?.psd??[],...c?.base?.nodes??[]]) if(!union.has(n.id)) union.set(n.id,n);
    return [...union.values()];
  },[c]);
  useEffect(()=>{
    if(!c) return;
    const open=new Set<string>([""]);
    for(const change of c.changes) {
      let parent=nodeList.find(n=>n.id===change.id)?.parent;
      while(parent && !open.has(parent)) {open.add(parent);parent=nodeList.find(n=>n.id===parent)?.parent;}
    }
    setExpanded(open);
    select(previous => previous && nodeList.some(node => node.id === previous) ? previous : c.changes[0]?.id ?? "");
  },[c,nodeList]);
  const decisions:Record<string,Decision>={...choices};
  for(const ch of changes) {
    if(fixedSource && ch.representation !== "psd-component-source") decisions[ch.key]=fixedSource;
    else if(!decisions[ch.key] && ch.suggested) decisions[ch.key]=ch.suggested;
  }
  const stamp=JSON.stringify(decisions);
  const plan=useMemo(()=>{
    if(!c)return {};
    try{
      const trees=plannedTrees(c,decisions,fixedSource);
      const visualUpdates = new Map<string,PsdVisualUpdate>();
      for (const { id, key, representation } of c.changes) {
        if ((representation === "psd-list-cells" || representation === "psd-default-image") && decisions[key] === "proto" &&
            trees.psd.some(node => node.id === id)) visualUpdates.set(id, representation);
      }
      const blocked = trees.psd.find(node => !c.psd.some(current => current.id === node.id) && componentPsds?.errors.has(node.id));
      if (blocked) return { issue: componentPsds?.errors.get(blocked.id) };
      const proto=fixedSource==="proto" ? page : applyPrototypeTree(page,trees.proto,components);
      const sourceUpdates = new Map<string, Side>();
      for (const change of c.changes) {
        const decision = decisions[change.key];
        if (change.representation === "psd-component-source" && (decision === "proto" || decision === "psd") &&
          trees.psd.some(node => node.id === change.id)) sourceUpdates.set(change.id, decision);
      }
      const push=sourceUpdates.size > 0 || c.changes.some(ch=>ch.representation !== "psd-component-source" && decisions[ch.key]==="proto");
      const conversions = new Set(c.changes.filter(change => change.representation === "psd-smart-object" && decisions[change.key] === "proto").map(change => change.id));
      const componentUpdates = new Set(c.changes.filter(change => change.representation === "psd-component-layers" &&
        decisions[change.key] === "proto" && trees.psd.some(node => node.id === change.id)).map(change => change.id));
      const base=coordinatedBase(doc.documentId,page.id,asset!.documentId,c,trees);
      const signature=(nodes:SyncNode[])=>JSON.stringify(nodes.map(n=>[n.id,n.parent,n.name,n.type,n.text,n.layer,n.undecided]));
      const baselineChanged=!c.base || signature(c.base.nodes)!==signature(base.nodes);
      return {trees,proto,push,base,baselineChanged,conversions,componentUpdates,sourceUpdates,visualUpdates};
    }catch(e){return {issue:String(e)};}
  },[c,stamp,componentPsds]);
  const [copy,setCopy]=useState<{key:string;asset:PsdAsset;bytes:Uint8Array;nodes:SyncNode[]}>();
  const [copyIssue,setCopyIssue]=useState("");
  useEffect(()=>{
    let active=true;setCopy(undefined);setCopyIssue("");
    if(!plan.push || !result || !asset || !plan.trees || !c) return;
    const trees=plan.trees;
    const timer=setTimeout(async()=>{
      try{
        const {writeSyncCopy}=await import("../runtime/sync-psd-copy");
        const expectedPage=applyPrototypeTree(page,trees.psd,components);
        const sources = new Map(Array.from(componentPsds?.results ?? [], ([id, item]) => [id, item.source] as const));
        const bytes=await writeSyncCopy(doc,expectedPage,asset,sourceBytes(asset),c.psd,trees.psd,components,plan.conversions,plan.componentUpdates,sources,plan.sourceUpdates,session.sources,plan.visualUpdates);
        const output=await psdTask<PsdAsset>("read",new Uint8Array(bytes).buffer,asset.name);
        const mappings=new Map(trees.psd.flatMap(n=>n.layer?[[n.layer,n.id] as const]:[]));
        const verified=psdTree(doc.documentId,expectedPage,output,()=>{throw new Error("副本出现未预期的控件。");},mappings,false,components);
        const content=(nodes:SyncNode[])=>nodes.map(n=>[n.id,n.parent,n.type,n.name,n.text,nodes.filter(s=>s.parent===n.parent).findIndex(s=>s.id===n.id)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
        if(JSON.stringify(content(verified))!==JSON.stringify(content(trees.psd)))throw new Error("同步副本的文字、层级或顺序与计划不符。");
        for (const id of plan.componentUpdates ?? []) {
          const layerId = verified.find(node => node.id === id)?.layer;
          const contents = output.layers.find(layer => layer.metadata.layerId === layerId)?.smartObject?.contents;
          if (!contents || missingComponentLayers(expectedPage, id, contents).length)
            throw new Error("智能对象内的图层与同步计划不符。");
        }
        for (const [id, choice] of plan.sourceUpdates ?? []) {
          const layerId = verified.find(node => node.id === id)?.layer;
          const layer = output.layers.find(layer => layer.metadata.layerId === layerId);
          const sourceHash = sources.get(id)?.origin.sourceHash;
          const expectedHash = choice === "proto" ? sourceHash : asset.layers.find(layer => layer.metadata.layerId === layerId)?.smartObject?.hash;
          if (!expectedHash || layer?.smartObject?.hash !== expectedHash ||
            psdComponentSource(layer.metadata.componentSource)?.sourceHash !== sourceHash)
            throw new Error("智能对象的内嵌 PSD 与同步计划不符。");
        }
        if(active)setCopy({key:stamp,asset:output,bytes,nodes:verified});
      }catch(e){if(active)setCopyIssue(String(e));}
    },120);
    return ()=>{active=false;clearTimeout(timer);};
  },[plan,asset,result,componentPsds]);
  const node=nodeList.find(n=>n.id===selected), items=changes.filter(ch=>ch.members.includes(selected));
  const pending=changes.filter(ch=>!decisions[ch.key]).length, count=changes.filter(ch=>decisions[ch.key] && decisions[ch.key]!=="skip").length;
  const needBase=!!c && !c.base;
  const choose=(key:string,value:Decision)=>{setChoices(s=>({...s,[key]:value}));setReview(false);setError("");setResult(true);};
  async function commit() {
    if(!canReview || busy || !asset || !c || !plan.proto || !plan.trees)return;
    setBusy(true);setError("");
    try {
      let next={...plan.proto,psdSync:plan.base};
      apply(next,true);
      const fresh=await requestPsd({action:"review",pageId:page.id,expected:page.artPsd});
      if(!fresh || draftStamp(fresh.asset)!==draftStamp(asset))throw new Error("PSD 或切图配置已变化，请重新比较。");
      if(plan.push) {
        if(!copy || copy.key!==stamp)throw new Error("请先完成同步后预览。");
        const name=asset.name.replace(/\.psd$/i,"").slice(0,100)+"-sync-"+Date.now()+".psd";
        const existing = new Set(c.psd.map(node => node.id));
        const used = new Set(plan.trees.psd.filter(node => !existing.has(node.id) || plan.sourceUpdates?.has(node.id)).map(node => node.id));
        const checks = new Map(Array.from(componentPsds?.results ?? []).filter(([id]) => used.has(id))
          .map(([, item]) => [JSON.stringify(item.check), item.check]));
        const output=await requestPsd({action:"syncCopy",pageId:page.id,expected:page.artPsd,sourceHash:asset.sourceHash,
          reviewStamp:await reviewStamp(asset),name, componentChecks: [...checks.values()]},copy.bytes);
        if(!output)return;
        next={...next,artPsd:{documentId:output.asset.documentId,source:output.source},
          psdSync:coordinatedBase(doc.documentId,page.id,output.asset.documentId,c,{proto:plan.trees.proto,psd:copy.nodes})};
      }
      apply(next);close();
    } catch(e){setError(String(e));} finally{setBusy(false);}
  }
  function toggle(id:string){setExpanded(prev=>{const s=new Set(prev);if(s.has(id))s.delete(id);else s.add(id);return s;});}
  function pairLayer(layerId: string) {
    setPairs(current => new Map(current).set(layerId, selected));
    setChoices({});
    setReview(false);
    setResult(false);
    setError("");
  }
  const shown=result && plan.trees?plan.trees:c;
  const selectedLayer=asset?.layers.find(l=>l.metadata.layerId===c?.psd.find(n=>n.id===selected)?.layer);
  const artChildren=selectedLayer ? asset?.layers.filter(l=>l.parentKey===selectedLayer.key).map(l=>l.name) : [];
  const message=error || comparison.issue || plan.issue || copyIssue;
  return <dialog ref={dialog} className="floating-panel workbench-dialog page-sync-dialog" aria-labelledby="page-sync-title" style={{width:size.width,height:size.height}}
    onCancel={e=>{e.preventDefault();if(!busy)close();}}>
    <DialogHeading heading={fixedSource==="proto"?"原型 → PSD":fixedSource==="psd"?"PSD → 原型":"PSD 同步"} headingId="page-sync-title" closeLabel="关闭同步窗" onClose={close} closeDisabled={busy}>
      <span title={page.artPsd?.source}>{page.name} / {page.artPsd?.source}</span>
    </DialogHeading>
    <div className="sync-layout"><SyncTree page={page} nodes={nodeList} changes={changes} loading={!c}
      selected={selected} expanded={expanded} onToggle={toggle} onSelect={select} />
      <section className="sync-main"><div className="sync-bar"><strong>{node?.name??page.name}</strong>
        <div><button aria-pressed={!result} disabled={busy} onClick={()=>{setResult(false);setReview(false);}}>当前</button><button aria-pressed={result} disabled={busy || !canReview} onClick={()=>setResult(true)}>同步后</button></div></div>
        {asset && shown && <div className="sync-boards"><figure><figcaption>原型 · 内置资源</figcaption><SyncPreview page={result && plan.proto?plan.proto:page} nodes={shown.proto} selected={selected} changes={changes} old={c?.base?.nodes??[]} onSelect={select}/></figure>
        <figure><figcaption>美术 PSD</figcaption>{result && plan.push && !copy ? <div className="sync-preview checkerboard">{copyIssue?"此项暂无法写出":"正在生成同步预览…"}</div>:<SyncPreview page={page} asset={result && plan.push?copy?.asset:asset} nodes={shown.psd} selected={selected} changes={changes} old={c?.base?.nodes??[]} onSelect={select}/>}</figure></div>}</section>
      <aside className="sync-detail" aria-label="同步属性详情">
        {!canReview && <p role="alert">当前扩展宿主版本较旧，仅可查看已加载的页面。请按 F1 执行「开发人员: 重新加载窗口」，再打开同步。</p>}
        {canReview && !asset && !error && <p>正在读取绑定的 PSD…</p>}
        {canReview && needBase && <p>首次对照。确认对应关系后可建立共同基线。</p>}
        {c && !changes.length && <p>文字与结构已一致</p>}
        {componentPsds && Array.from(new Set(componentPsds.errors.values())).map(issue => <p role="alert" key={issue}>{issue}</p>)}
        {c && items.map(ch => <SyncChange key={ch.key} comparison={c} change={ch} title={changeTitle(ch)}
          decision={decisions[ch.key]} disabled={busy || !canReview} onChoose={value => choose(ch.key, value)}
          targetLabel="PSD" pageName={page.name} fixedSource={ch.representation === "psd-component-source" ? undefined : fixedSource}>
          {ch.field === "exist" && !!artChildren?.length && <p>随组处理　{artChildren.join("、")}</p>}
        </SyncChange>)}
        {asset && c && node && !c.psd.some(n => n.id === node.id) && c.proto.some(n => n.id === node.id) &&
          <PsdSyncLayerPicker key={node.id} layers={asset.layers} comparison={c} documentId={doc.documentId}
            pageId={page.id} disabled={busy || !canReview} onConfirm={pairLayer} />}
        {review && c && <fieldset><legend>本轮应用明细</legend>{changes.map(ch => <p key={ch.key}>
          {nodeList.find(n => n.id === ch.id)?.name} · {changeTitle(ch)}　{describeDecision(c, ch, decisions[ch.key], "PSD", page.name)}
        </p>)}</fieldset>}
        {message && <p role="alert">{message} {canReview && <button disabled={busy} onClick={()=>setReload(n=>n+1)}>重新比较</button>}</p>}
      </aside></div>
    <footer><span>待决定 {pending} 项　·　已选 {count} 项</span><Button size="sm" disabled={!canReview || busy || !c || pending>0 || (!count && !plan.baselineChanged) || !!plan.issue || !!(review && plan.push && !copy)}
      onClick={()=>{if(review)void commit();else {setError("");setReview(true);setResult(true);}}}>{busy?"正在应用…":review?"确认应用":!count && plan.baselineChanged?(needBase?"建立基线":"记录一致变更"):"预演应用"}</Button></footer>
    {syncDialogResizeEdges.map(edge=><span key={edge} className="sync-resize-edge" data-edge={edge} aria-hidden="true" {...resizeEdgeProps(edge)}/>)}
  </dialog>;
}
