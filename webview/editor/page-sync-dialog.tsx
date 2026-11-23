import { SyncTree, changeSymbols } from "./sync-tree";
import { Button } from "../components/ui/button";
import { DialogHeading } from "../components/dialog-heading";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Frame, GameFlowDocument, GameFlowPage } from "../../shared/model";
import { compareTrees, plannedTrees, coordinatedBase, currentSyncBase, prototypeTree, psdTree, applyPrototypeTree, fieldNames, type Change, type Decision, type SyncNode } from "../../shared/page-sync";
import { draftStamp } from "../../shared/psd-draft";
import type { PsdAsset } from "../../shared/psd-meta";
import { requestPsd, sourceBytes } from "../runtime/page-psd";
import { isBrowserPreview } from "../vscode-api";
import { psdTask } from "../psd/io";
import { NodeView, orderedNodes } from "./node-view";
import { resolvePageLayout } from "../../shared/ui-layout";
import { SliceResourcesProvider, useSliceResources } from "../runtime/resource-context";
import { syncDialogResizeEdges, useSyncDialogSize } from "./use-sync-dialog-size";
import "./page-sync.css";

async function reviewStamp(asset:PsdAsset) {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(draftStamp(asset)));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}

export function SyncValues({ previous, prototype, targetLabel, target }: {
  previous: ReactNode; prototype: ReactNode; targetLabel: string; target: ReactNode;
}) {
  return <dl className="sync-values">
    <dt>上次</dt><dd>{previous}</dd>
    <dt>原型</dt><dd>{prototype}</dd>
    <dt>{targetLabel}</dt><dd>{target}</dd>
  </dl>;
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
export interface SyncSession { document:GameFlowDocument; page:GameFlowPage; makeId:()=>string }
interface Props { session:SyncSession; loadedAsset?:PsdAsset; close():void; apply(page:GameFlowPage,checkOnly?:boolean):void }
export function PageSyncDialog({session,loadedAsset,close,apply}:Props) {
  const {page,document:doc}=session, dialog=useRef<HTMLDialogElement>(null);
  const {size,resizeEdgeProps}=useSyncDialogSize({storageKey:"gameflow.pagePsdSync.size.v2",defaultWidth:1280,defaultHeight:760,minWidth:360,minHeight:300});
  const canReview = isBrowserPreview || !!document.querySelector('meta[name="gameflow-page-psd-sync"][content="1"]');
  const [reviewedAsset,setAsset]=useState<PsdAsset>(), [error,setError]=useState(""), [busy,setBusy]=useState(false);
  const asset = canReview ? reviewedAsset : loadedAsset;
  const [pairs,setPairs]=useState(new Map<string,string>()), [candidate,setCandidate]=useState("");
  const [selected,select]=useState(""), [expanded,setExpanded]=useState(new Set<string>([""]));
  const [choices,setChoices]=useState<Record<string,Decision>>({}), [result,setResult]=useState(false), [review,setReview]=useState(false);
  const [reload,setReload]=useState(0);
  useEffect(()=>{const d=dialog.current!;d.showModal();return ()=>d.close();},[]);
  useEffect(()=>{
    if (!canReview) return;
    let active=true;
    setAsset(undefined);setError("");setChoices({});setPairs(new Map());setReview(false);
    requestPsd({action:"review",pageId:page.id,expected:page.artPsd}).then(r=>{
      if (!r || r.asset.documentId!==page.artPsd?.documentId) throw new Error("页面 PSD 绑定已变化。");
      if(active) setAsset(r.asset);
    }).catch(e=>{if(active)setError(String(e));});
    return ()=>{active=false;};
  },[session,reload,canReview]);
  const ids=useRef(new Map<string,string>());
  const comparison=useMemo(()=>{
    if(!asset) return {};
    try {
      const art=psdTree(doc.documentId,page,asset,layer=>{
        const key=layer.metadata.layerId;if(!ids.current.has(key))ids.current.set(key,session.makeId());return ids.current.get(key)!;
      },pairs);
      return {data:compareTrees(prototypeTree(page),art,currentSyncBase(doc.documentId,page,asset))};
    } catch(e){return {issue:String(e)};}
  },[session,asset,pairs]);
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
    setExpanded(open);select(c.changes[0]?.id??"");
  },[c,nodeList]);
  const decisions:Record<string,Decision>={...choices};
  for(const ch of changes) if(!decisions[ch.key] && ch.suggested) decisions[ch.key]=ch.suggested;
  const stamp=JSON.stringify(decisions);
  const plan=useMemo(()=>{
    if(!c)return {};
    try{
      const trees=plannedTrees(c,decisions);
      const proto=applyPrototypeTree(page,trees.proto);
      const push=c.changes.some(ch=>decisions[ch.key]==="proto");
      const base=coordinatedBase(doc.documentId,page.id,asset!.documentId,c,trees);
      const signature=(nodes:SyncNode[])=>JSON.stringify(nodes.map(n=>[n.id,n.parent,n.name,n.type,n.text,n.layer,n.undecided]));
      const baselineChanged=!c.base || signature(c.base.nodes)!==signature(base.nodes);
      return {trees,proto,push,base,baselineChanged};
    }catch(e){return {issue:String(e)};}
  },[c,stamp]);
  const [copy,setCopy]=useState<{key:string;asset:PsdAsset;bytes:Uint8Array;nodes:SyncNode[]}>();
  const [copyIssue,setCopyIssue]=useState("");
  useEffect(()=>{
    let active=true;setCopy(undefined);setCopyIssue("");
    if(!plan.push || !result || !asset || !plan.trees || !c) return;
    const trees=plan.trees;
    const timer=setTimeout(async()=>{
      try{
        const {writeSyncCopy}=await import("../runtime/sync-psd-copy");
        const expectedPage=applyPrototypeTree(page,trees.psd);
        const bytes=await writeSyncCopy(doc,expectedPage,asset,sourceBytes(asset),c.psd,trees.psd);
        const output=await psdTask<PsdAsset>("read",new Uint8Array(bytes).buffer,asset.name);
        const mappings=new Map(trees.psd.flatMap(n=>n.layer?[[n.layer,n.id] as const]:[]));
        const verified=psdTree(doc.documentId,expectedPage,output,()=>{throw new Error("副本出现未预期的控件。");},mappings);
        const content=(nodes:SyncNode[])=>nodes.map(n=>[n.id,n.parent,n.type,n.name,n.text,nodes.filter(s=>s.parent===n.parent).findIndex(s=>s.id===n.id)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
        if(JSON.stringify(content(verified))!==JSON.stringify(content(trees.psd)))throw new Error("同步副本的文字、层级或顺序与计划不符。");
        if(active)setCopy({key:stamp,asset:output,bytes,nodes:verified});
      }catch(e){if(active)setCopyIssue(String(e));}
    },120);
    return ()=>{active=false;clearTimeout(timer);};
  },[plan,asset,result]);
  const node=nodeList.find(n=>n.id===selected), items=changes.filter(ch=>ch.members.includes(selected));
  const pending=changes.filter(ch=>!decisions[ch.key]).length, count=changes.filter(ch=>decisions[ch.key] && decisions[ch.key]!=="skip").length;
  const needBase=!!c && !c.base;
  const choose=(key:string,value:Decision)=>{setChoices(s=>({...s,[key]:value}));setReview(false);setError("");setResult(true);};
  const describe=(ch:Change,value?:Decision)=>{
    if(!value)return "待决定";
    if(value==="skip")return "本轮跳过";
    const from=c![value].find(n=>n.id===ch.id), dest=value==="proto"?"PSD":"原型";
    if(ch.field==="exist") return (from?"补到":"从")+dest+(from?"":"删除");
    return "采用"+(value==="proto"?"原型":"PSD");
  };
  function fieldValue(ch:Change,tree:SyncNode[]) {
    const n=tree.find(n=>n.id===ch.id); if(!n) return "不存在";
    if(ch.field==="exist")return n.name;
    if(ch.field==="parent")return tree.find(p=>p.id===n.parent)?.name??page.name;
    if(ch.field==="order")return String(tree.filter(p=>p.parent===n.parent).findIndex(p=>p.id===n.id)+1);
    if(ch.field==="property") {const value=ch.property?n.properties?.[ch.property]:undefined;return value===undefined?"（空）":typeof value==="object"?JSON.stringify(value):String(value);}
    return n[ch.field] || "（空）";
  }
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
        const output=await requestPsd({action:"syncCopy",pageId:page.id,expected:page.artPsd,sourceHash:asset.sourceHash,reviewStamp:await reviewStamp(asset),name},copy.bytes);
        if(!output)return;
        next={...next,artPsd:{documentId:output.asset.documentId,source:output.source},
          psdSync:coordinatedBase(doc.documentId,page.id,output.asset.documentId,c,{proto:plan.trees.proto,psd:copy.nodes})};
      }
      apply(next);close();
    } catch(e){setError(String(e));} finally{setBusy(false);}
  }
  function toggle(id:string){setExpanded(prev=>{const s=new Set(prev);if(s.has(id))s.delete(id);else s.add(id);return s;});}
  const selectNode=(id:string)=>{select(id);setCandidate("");};
  const shown=result && plan.trees?plan.trees:c;
  const selectedLayer=asset?.layers.find(l=>l.metadata.layerId===c?.psd.find(n=>n.id===selected)?.layer);
  const artChildren=selectedLayer ? asset?.layers.filter(l=>l.parentKey===selectedLayer.key).map(l=>l.name) : [];
  const message=error || comparison.issue || plan.issue || copyIssue;
  return <dialog ref={dialog} className="floating-panel workbench-dialog page-sync-dialog" aria-labelledby="page-sync-title" style={{width:size.width,height:size.height}}
    onCancel={e=>{e.preventDefault();if(!busy)close();}}>
    <DialogHeading heading="同步文字与结构" headingId="page-sync-title" closeLabel="关闭同步窗" onClose={close} closeDisabled={busy}>
      <span title={page.artPsd?.source}>{page.name} / {page.artPsd?.source}</span>
    </DialogHeading>
    <div className="sync-layout"><SyncTree page={page} nodes={nodeList} changes={changes} loading={!c}
      selected={selected} expanded={expanded} onToggle={toggle} onSelect={selectNode} />
      <section className="sync-main"><div className="sync-bar"><strong>{node?.name??page.name}</strong>
        <div><button aria-pressed={!result} disabled={busy} onClick={()=>{setResult(false);setReview(false);}}>当前</button><button aria-pressed={result} disabled={busy || !canReview} onClick={()=>setResult(true)}>同步后</button></div></div>
        {asset && shown && <div className="sync-boards"><figure><figcaption>原型 · 内置资源</figcaption><SyncPreview page={result && plan.proto?plan.proto:page} nodes={shown.proto} selected={selected} changes={changes} old={c?.base?.nodes??[]} onSelect={selectNode}/></figure>
        <figure><figcaption>美术 PSD</figcaption>{result && plan.push && !copy ? <div className="sync-preview checkerboard">{copyIssue?"此项暂无法写出":"正在生成同步预览…"}</div>:<SyncPreview page={page} asset={result && plan.push?copy?.asset:asset} nodes={shown.psd} selected={selected} changes={changes} old={c?.base?.nodes??[]} onSelect={selectNode}/>}</figure></div>}</section>
      <aside className="sync-detail" aria-label="同步属性详情">
        {!canReview && <p role="alert">当前扩展宿主版本较旧，仅可查看已加载的页面。请按 F1 执行「开发人员: 重新加载窗口」，再打开同步。</p>}
        {canReview && !asset && !error && <p>正在读取绑定的 PSD…</p>}
        {canReview && needBase && <p>首次对照。确认对应关系后可建立共同基线。</p>}
        {c && !changes.length && <p>文字与结构已一致</p>}
        {items.map(ch=><fieldset disabled={busy || !canReview} key={ch.key}><legend>{fieldNames[ch.field]} · {c?.base?({add:"新增",delete:"删除",edit:"修改"}[ch.kind]):"首次对照"}</legend>
          <SyncValues previous={c?.base ? fieldValue(ch,c.base.nodes) : "无记录"} prototype={fieldValue(ch,c!.proto)} targetLabel="PSD" target={fieldValue(ch,c!.psd)} />
          {ch.field==="exist" && !!artChildren?.length && <p>随组处理　{artChildren.join("、")}</p>}
          {(["proto","psd","skip"] as const).map(v=><button key={v} aria-pressed={decisions[ch.key]===v} onClick={()=>choose(ch.key,v)}>{describe(ch,v)}</button>)}</fieldset>)}
        {asset && c && node && !c.psd.some(n=>n.id===node.id) && c.proto.some(n=>n.id===node.id) && <fieldset disabled={busy || !canReview}><legend>对应已有 PSD 图层</legend>
          <select aria-label="对应 PSD 图层" value={candidate} onChange={e=>setCandidate(e.target.value)}><option value="">选择图层</option>{asset.layers.filter(l=>!c.psd.some(n=>n.layer===l.metadata.layerId && page.nodes.some(p=>p.id===n.id))).map(l=><option key={l.key} value={l.metadata.layerId}>{l.name}</option>)}</select>
          <button disabled={!candidate} onClick={()=>{setPairs(p=>new Map(p).set(candidate,selected));setCandidate("");setChoices({});}}>关联</button></fieldset>}
        {review && <fieldset><legend>本轮应用明细</legend>{changes.map(ch=><p key={ch.key}>{nodeList.find(n=>n.id===ch.id)?.name} · {fieldNames[ch.field]}　{describe(ch,decisions[ch.key])}</p>)}</fieldset>}
        {message && <p role="alert">{message} {canReview && <button disabled={busy} onClick={()=>setReload(n=>n+1)}>重新比较</button>}</p>}
      </aside></div>
    <footer><span>待决定 {pending} 项　·　已选 {count} 项</span><Button size="sm" disabled={!canReview || busy || !c || pending>0 || (!count && !plan.baselineChanged) || !!plan.issue || !!(review && plan.push && !copy)}
      onClick={()=>{if(review)void commit();else {setError("");setReview(true);setResult(true);}}}>{busy?"正在应用…":review?"确认应用":!count && plan.baselineChanged?(needBase?"建立基线":"记录一致变更"):"预演应用"}</Button></footer>
    {syncDialogResizeEdges.map(edge=><span key={edge} className="sync-resize-edge" data-edge={edge} aria-hidden="true" {...resizeEdgeProps(edge)}/>)}
  </dialog>;
}
