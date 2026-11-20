import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Grip, X } from "lucide-react";
import type { GameFlowDocument, GameFlowPage } from "../../shared/model";
import { compareTrees, plannedTrees, coordinatedBase, currentSyncBase, prototypeTree, psdTree, applyPrototypeTree, fieldNames, type Change, type Decision, type SyncNode } from "../../shared/page-sync";
import { draftStamp } from "../../shared/psd-draft";
import type { PsdAsset } from "../../shared/psd-meta";
import { requestPsd, sourceBytes } from "../runtime/page-psd";
import { psdTask } from "../psd/io";
import { NodeView, orderedNodes } from "./node-view";
import { resolvePageLayout } from "../../shared/ui-layout";
import { SliceResourcesProvider, useSliceResources } from "../runtime/resource-context";
import "./page-sync.css";

async function reviewStamp(asset:PsdAsset) {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(draftStamp(asset)));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}
const symbols={add:"+",delete:"−",edit:"~"};
const sizeKey="gameflow.pagePsdSync.size";
function savedSize() {
  try {
    const s=JSON.parse(localStorage.getItem(sizeKey)??"null");
    if (Number.isFinite(s?.width) && Number.isFinite(s?.height)) return {width:Number(s.width),height:Number(s.height)};
  } catch { /* Use the default size if settings storage is unavailable. */ }
  return {width:Math.min(1050,innerWidth-24),height:Math.min(720,innerHeight-24)};
}
function Preview({page,asset,nodes,selected,changes,old}:{page:GameFlowPage;asset?:PsdAsset;nodes:SyncNode[];selected:string;changes:Change[];old:SyncNode[]}) {
  const ref=useRef<HTMLDivElement>(null), [scale,setScale]=useState(.2);
  const resources=useSliceResources(), layout=useMemo(()=>resolvePageLayout(page),[page]);
  const w=asset?.width??page.frame.width,h=asset?.height??page.frame.height;
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
      {change && <b style={{fontSize:12/scale}}>{symbols[change.kind]}</b>}</div>;
  });
  return <div className="sync-preview" ref={ref}>
    <div style={{width:w*scale,height:h*scale,position:"relative"}}><div className="sync-surface" style={{width:w,height:h,transform:`scale(${scale})`,background:page.background??"#fff"}}>
      {asset ? <img src={asset.preview} alt="美术 PSD 合成图"/> : <SliceResourcesProvider value={{...resources,mode:"prototype"}}>{orderedNodes(page).map(n=><NodeView key={n.id} node={n} page={page} geometry={layout.nodes.get(n.id)}/>)}</SliceResourcesProvider>}
      {overlays}
    </div></div>
  </div>;
}
export interface SyncSession { document:GameFlowDocument; page:GameFlowPage; makeId:()=>string }
interface Props { session:SyncSession; close():void; apply(page:GameFlowPage,checkOnly?:boolean):void }
export function PageSyncDialog({session,close,apply}:Props) {
  const {page,document:doc}=session, dialog=useRef<HTMLDialogElement>(null);
  const [size,setSize]=useState(savedSize), drag=useRef<{x:number;y:number;w:number;h:number}|null>(null);
  const [asset,setAsset]=useState<PsdAsset>(), [error,setError]=useState(""), [busy,setBusy]=useState(false);
  const [pairs,setPairs]=useState(new Map<string,string>()), [candidate,setCandidate]=useState("");
  const [selected,select]=useState(""), [expanded,setExpanded]=useState(new Set<string>([""]));
  const [choices,setChoices]=useState<Record<string,Decision>>({}), [result,setResult]=useState(false), [review,setReview]=useState(false);
  const [reload,setReload]=useState(0);
  useEffect(()=>{const d=dialog.current!;d.showModal();return ()=>d.close();},[]);
  useEffect(()=>{
    let active=true;
    setAsset(undefined);setError("");setChoices({});setPairs(new Map());setReview(false);
    requestPsd({action:"review",pageId:page.id,expected:page.artPsd}).then(r=>{
      if (!r || r.asset.documentId!==page.artPsd?.documentId) throw new Error("页面 PSD 绑定已变化。");
      if(active) setAsset(r.asset);
    }).catch(e=>{if(active)setError(String(e));});
    return ()=>{active=false;};
  },[session,reload]);
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
    return n[ch.field] || "（空）";
  }
  async function commit() {
    if(busy || !asset || !c || !plan.proto || !plan.trees)return;
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
  function tree(parent:string,path:Set<string>):ReactNode {
    return <ul>{nodeList.filter(n=>n.parent===parent && !path.has(n.id)).map(n=>{
      const branch=nodeList.some(p=>p.parent===n.id), open=expanded.has(n.id), change=changes.find(ch=>ch.members.includes(n.id));
      return <li key={n.id}><div className="sync-tree-row">
        {branch?<button aria-label={(open?"折叠":"展开")+n.name} aria-expanded={open} onClick={()=>toggle(n.id)}>{open?<ChevronDown/>:<ChevronRight/>}</button>:<i/>}
        <button data-kind={change?.kind} aria-pressed={n.id===selected} onClick={()=>{select(n.id);setCandidate("");}}>{change && <b>{symbols[change.kind]}</b>} {n.name} <code>{n.variable}</code></button>
      </div>{branch && open && tree(n.id,new Set([...path,n.id]))}</li>;
    })}</ul>;
  }
  function toggle(id:string){setExpanded(prev=>{const s=new Set(prev);if(s.has(id))s.delete(id);else s.add(id);return s;});}
  const shown=result && plan.trees?plan.trees:c;
  const selectedLayer=asset?.layers.find(l=>l.metadata.layerId===c?.psd.find(n=>n.id===selected)?.layer);
  const artChildren=selectedLayer ? asset?.layers.filter(l=>l.parentKey===selectedLayer.key).map(l=>l.name) : [];
  const message=error || comparison.issue || plan.issue || copyIssue;
  return <dialog ref={dialog} className="page-sync-dialog" aria-labelledby="page-sync-title" style={{width:size.width,height:size.height}}
    onCancel={e=>{e.preventDefault();if(!busy)close();}}>
    <header><div><h2 id="page-sync-title">同步文字与结构</h2><span>{page.name}　/　{page.artPsd?.source}</span></div><button aria-label="关闭同步窗" disabled={busy} onClick={close}><X/></button></header>
    <div className="sync-layout"><nav aria-label="完整节点树"><strong>节点树　{c?changes.length:"…"} 项差异</strong>
      <div className="sync-legend"><b data-kind="add">+ 新增</b><b data-kind="delete">− 删除</b><b data-kind="edit">~ 修改</b></div>
      <button className="sync-root" onClick={()=>{toggle("");select("");}} aria-expanded={expanded.has("")}>{expanded.has("")?"▾":"▸"} {page.name}</button>{expanded.has("") && tree("",new Set())}</nav>
      <section className="sync-body"><div className="sync-bar"><strong>{node?.name??page.name}</strong>
        <div><button aria-pressed={!result} disabled={busy} onClick={()=>{setResult(false);setReview(false);}}>当前</button><button aria-pressed={result} disabled={busy} onClick={()=>setResult(true)}>同步后</button></div></div>
        {asset && shown && <div className="sync-boards"><figure><figcaption>原型 · 内置资源</figcaption><Preview page={result && plan.proto?plan.proto:page} nodes={shown.proto} selected={selected} changes={changes} old={c?.base?.nodes??[]}/></figure>
        <figure><figcaption>美术 PSD</figcaption>{result && plan.push && !copy ? <div className="sync-preview">{copyIssue?"此项暂无法写出":"正在生成同步预览…"}</div>:<Preview page={page} asset={result && plan.push?copy?.asset:asset} nodes={shown.psd} selected={selected} changes={changes} old={c?.base?.nodes??[]}/>}</figure></div>}
        {!asset && !error && <p>正在读取绑定的 PSD…</p>}
        {needBase && <p>首次对照。确认对应关系后可建立共同基线。</p>}
        {c && !changes.length && <p>文字与结构已一致</p>}
        {items.map(ch=><fieldset disabled={busy} key={ch.key}><legend>{fieldNames[ch.field]} · {c?.base?({add:"新增",delete:"删除",edit:"修改"}[ch.kind]):"首次对照"}</legend>
          <p>{c?.base && <>上次　{fieldValue(ch,c.base.nodes)}　</>}原型　{fieldValue(ch,c!.proto)}　/　PSD　{fieldValue(ch,c!.psd)}</p>
          {ch.field==="exist" && !!artChildren?.length && <p>随组处理　{artChildren.join("、")}</p>}
          {(["proto","psd","skip"] as const).map(v=><button key={v} aria-pressed={decisions[ch.key]===v} onClick={()=>choose(ch.key,v)}>{describe(ch,v)}</button>)}</fieldset>)}
        {asset && c && node && !c.psd.some(n=>n.id===node.id) && c.proto.some(n=>n.id===node.id) && <fieldset disabled={busy}><legend>对应已有 PSD 图层</legend>
          <select aria-label="对应 PSD 图层" value={candidate} onChange={e=>setCandidate(e.target.value)}><option value="">选择图层</option>{asset.layers.filter(l=>!c.psd.some(n=>n.layer===l.metadata.layerId && page.nodes.some(p=>p.id===n.id))).map(l=><option key={l.key} value={l.metadata.layerId}>{l.name}</option>)}</select>
          <button disabled={!candidate} onClick={()=>{setPairs(p=>new Map(p).set(candidate,selected));setCandidate("");setChoices({});}}>关联</button></fieldset>}
        {review && <fieldset><legend>本轮应用明细</legend>{changes.map(ch=><p key={ch.key}>{nodeList.find(n=>n.id===ch.id)?.name} · {fieldNames[ch.field]}　{describe(ch,decisions[ch.key])}</p>)}</fieldset>}
        {message && <p role="alert">{message} <button disabled={busy} onClick={()=>setReload(n=>n+1)}>重新比较</button></p>}
      </section></div>
    <footer><span>待决定 {pending} 项　·　已选 {count} 项</span><button disabled={busy || !c || pending>0 || (!count && !plan.baselineChanged) || !!plan.issue || !!(review && plan.push && !copy)}
      onClick={()=>{if(review)void commit();else {setError("");setReview(true);setResult(true);}}}>{busy?"正在应用…":review?"确认应用":!count && plan.baselineChanged?(needBase?"建立基线":"记录一致变更"):"预演应用"}</button>
      <button className="sync-resize" aria-label="拖动调整同步窗口大小" onPointerDown={e=>{e.preventDefault();const r=dialog.current!.getBoundingClientRect();drag.current={x:e.clientX,y:e.clientY,w:r.width,h:r.height};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{const d=drag.current;if(d)setSize({width:Math.min(innerWidth-16,Math.max(360,d.w+2*(e.clientX-d.x))),height:Math.min(innerHeight-16,Math.max(300,d.h+2*(e.clientY-d.y)))});}}
        onLostPointerCapture={()=>{drag.current=null;try{localStorage.setItem(sizeKey,JSON.stringify(size));}catch{/* session-only size */}}}><Grip/></button></footer>
  </dialog>;
}
