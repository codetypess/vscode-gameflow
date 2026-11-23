import {useEffect,useMemo,useRef,useState,type ReactNode} from "react";
import {fieldNames,prototypeTree,type Change,type Decision,type SyncNode} from "../../shared/page-sync";
import {mergePrefab,prefabPreviewPage,type PrefabReview} from "../../shared/prefab-sync";
import {resourceUrl,type PrefabPlan} from "../../shared/prefab-export";
import {SyncPreview} from "./page-sync-dialog";
import {SliceResourcesProvider} from "../runtime/resource-context";
import {useRuntimeResources} from "../runtime/resources";
import type {PsdAsset} from "../../shared/psd-meta";
import {isSliceResourcePath} from "../../shared/slice-resources";
import {loadSliceImage} from "../psd/slice-render";
import type {RuntimeResource} from "../runtime/resource-context";
const noAssets:PsdAsset[]=[], noPageAssets:Record<string,PsdAsset>={};

export type PrefabMerge = ReturnType<typeof mergePrefab>;
const signs={add:"+",delete:"−",edit:"~"};
function describe(c:Change,d:Decision|undefined,r:PrefabReview) {
  if(!d) return "待决定";
  if(d==="skip") return "本轮跳过";
  const dest=d==="proto"?"预制体":"原型";
  if(c.field==="exist") return r.comparison[d].some(n=>n.id===c.id)?"补到"+dest:"从"+dest+"删除";
  return "采用"+(d==="proto"?"原型":"预制体")+" → "+dest;
}
function value(tree:SyncNode[],c:Change) {
  const n=tree.find(n=>n.id===c.id);
  if(!n) return "不存在";
  if(c.field==="exist") return n.name;
  if(c.field==="parent") return tree.find(p=>p.id===n.parent)?.name??"页面";
  if(c.field==="order") return tree.filter(p=>p.parent===n.parent).indexOf(n)+1;
  return n[c.field]??"—";
}
export function PrefabSyncDialog({review,plan,skins,resourceRoot,close,commit,reload}:{review:PrefabReview;plan:PrefabPlan;skins?:Record<string,string>;resourceRoot?:string;close:()=>void;commit:(merge:PrefabMerge)=>Promise<void>;reload:()=>Promise<void>}) {
  const c=review.comparison,ref=useRef<HTMLDialogElement>(null);
  const union=useMemo(()=>new Map([...c.base?.nodes??[],...c.psd,...c.proto].map(n=>[n.id,n])),[c]);
  const [expanded,setExpanded]=useState(()=>{
    const open=new Set([""]);
    for(const ch of c.changes) {
      let parent=union.get(ch.id)?.parent;
      while(parent && !open.has(parent)) {open.add(parent);parent=union.get(parent)?.parent;}
    }
    return open;
  });
  const [id,select]=useState(c.changes.find(ch=>!ch.suggested)?.id??c.changes[0]?.id??"");
  const [choices,choose]=useState<Record<string,Decision>>(()=>Object.fromEntries(c.changes.filter(ch=>ch.suggested).map(ch=>[ch.key,ch.suggested!])));
  const [result,setResult]=useState(false),[details,setDetails]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    const dialog=ref.current!;
    try {const saved=JSON.parse(localStorage.getItem("gameflow.prefabSync.size")??"null"); if(saved?.w>0 && saved?.h>0){dialog.style.width=saved.w+"px";dialog.style.height=saved.h+"px";}} catch {}
    dialog.showModal();
    return ()=>{try{localStorage.setItem("gameflow.prefabSync.size",JSON.stringify({w:dialog.offsetWidth,h:dialog.offsetHeight}));}catch{} dialog.close();};
  },[]);
  const merged=useMemo(()=>{try{return {data:mergePrefab(review,choices,plan.batch)};}catch(e){return {issue:String(e)};}},[review,choices,plan]);
  const m=merged.data,trees=result && m?m.trees:c;
  const preview=useMemo(()=>{
    const paths={...skins};
    if(result && m)for(const img of m.batch.images) paths[resourceUrl(img.path)]=img.path;
    return prefabPreviewPage(review,trees.psd,result && m?m.batch.prefab:review.root,paths);
  },[review,trees.psd,result,m,skins]);
  const pages=useMemo(()=>[preview],[preview]);
  const resources=useRuntimeResources(noAssets,pages,resourceRoot,"prefab",noPageAssets);
  const [plannedPixels,setPlannedPixels]=useState(new Map<string,RuntimeResource>());
  useEffect(()=>{
    let active=true;
    const images=result && m ? m.batch.images : [];
    void Promise.all(images.map(async image=>{
      try {
        const pixels=await loadSliceImage("data:image/png;base64,"+image.base64);
        return [image.path,{status:"ready",description:image.description,pixels}] as const;
      } catch {return [image.path,{status:"error",error:"待导出图片无法预览"}] as const;}
    })).then(pairs=>{if(active)setPlannedPixels(new Map<string,RuntimeResource>(pairs));});
    return ()=>{active=false;};
  },[result,m]);
  const previewResources={...resources,resolve:(ref:{path:string})=>{
    const disk=resources.resolve(ref);
    return disk.status==="ready" ? disk : plannedPixels.get(ref.path)??disk;
  }};
  const [extra,setExtra]=useState<number|null>(null);
  function selectNode(next:string,component:number|null=null){select(next);setExtra(component);}
  const node=union.get(id),selected=c.changes.filter(ch=>ch.members.includes(id));
  const native=review.originals.get(id)??(!id?review.root:undefined);
  const rawChildren=Array.isArray(native?._$child)?native._$child:[];
  const extraChildren=rawChildren.filter(n=>![...review.originals.values()].includes(n));
  const nativeProps=native ? Object.fromEntries(Object.entries(native).filter(([k])=>k!=="_$child")) : undefined;
  const unknownSkins=["skin","normalSkin","selectedSkin","disabledSkin"].map(k=>native?.[k]).filter((s):s is string=>
    typeof s==="string" && !!s && !skins?.[s] && !isSliceResourcePath(s));
  const pending=c.changes.filter(ch=>!choices[ch.key]).length, applied=c.changes.filter(ch=>choices[ch.key] && choices[ch.key]!=="skip");
  const toggle=(key:string)=>setExpanded(prev=>{const next=new Set(prev);if(next.has(key))next.delete(key);else next.add(key);return next;});
  function rows(parent:string,path:Set<string>):ReactNode {
    return <ul>{[...union.values()].filter(n=>n.parent===parent && !path.has(n.id)).map(n=>{
      const branch=review.engine.has(n.id) || [...union.values()].some(p=>p.parent===n.id), ch=c.changes.find(v=>v.members.includes(n.id));
      return <li key={n.id}><div className="sync-tree-row">{branch?<button aria-expanded={expanded.has(n.id)} aria-label={"展开或折叠"+n.name} onClick={()=>toggle(n.id)}>{expanded.has(n.id)?"▾":"▸"}</button>:<i/>}
        <button data-kind={ch?.kind} aria-pressed={id===n.id && extra===null} onClick={()=>selectNode(n.id)}>{ch && signs[ch.kind]} {n.name} <code>{n.variable}</code></button></div>
        {branch && expanded.has(n.id) && rows(n.id,new Set([...path,n.id]))}</li>;
    })}{review.engine.get(parent)?.map((e,i)=><li className="sync-tree-row" key={"component-"+i}><i/><button aria-pressed={id===parent && extra===i} onClick={()=>selectNode(parent,i)}>{e.name} <code>仅预制体</code></button></li>)}</ul>;
  }
  async function run(action:()=>Promise<void>) {
    setBusy(true);setError("");
    try{await action();}catch(e){setError(String(e));}finally{setBusy(false);}
  }
  return <dialog ref={ref} className="page-sync-dialog prefab-sync-dialog" aria-label="同步预制体" onCancel={e=>{e.preventDefault();if(!busy)close();}}>
    <header><div><h2>同步预制体</h2><span>{review.page.name}　/　{review.target}</span></div><button disabled={busy} onClick={close} aria-label="关闭同步窗">×</button></header>
    <div className="sync-layout"><nav aria-label="完整节点树"><strong>节点树　{c.changes.length} 项差异</strong>
      <div className="sync-legend"><b data-kind="add">+ 新增</b><b data-kind="delete">− 删除</b><b data-kind="edit">~ 修改</b></div>
      <button className="sync-root" aria-expanded={expanded.has("")} onClick={()=>{toggle("");selectNode("");}}>{expanded.has("")?"▾":"▸"} {review.page.name}</button>{expanded.has("") && rows("",new Set())}</nav>
      <section className="sync-body"><div className="sync-bar"><strong>{node?.name??review.page.name}</strong><div><button aria-pressed={!result} onClick={()=>{setResult(false);setDetails(false);}}>当前</button><button aria-pressed={result} onClick={()=>setResult(true)}>同步后</button></div></div>
        <div className="sync-boards"><figure><figcaption>原型 · 内置资源</figcaption><SyncPreview page={result && m?m.page:review.page} selected={extra===null?id:""} nodes={prototypeTree(result && m?m.page:review.page)} changes={c.changes} old={c.base?.nodes??[]}/></figure>
          <figure><figcaption>预制体 · 静态 UI</figcaption><SliceResourcesProvider value={previewResources}><SyncPreview page={preview} resourceMode="prefab" selected={id} nodes={prototypeTree(preview)} changes={c.changes} old={c.base?.nodes??[]}/></SliceResourcesProvider></figure></div>
        {unknownSkins.length>0 && <p>未定位到预览贴图　{[...new Set(unknownSkins)].join("、")}</p>}
        {extra!==null && <fieldset><legend>仅预制体 · {review.engine.get(id)?.[extra]?.name}</legend><pre>{JSON.stringify(review.engine.get(id)?.[extra]?.value,null,2)}</pre></fieldset>}
        {!c.base && <p>首次对照。请确认单侧控件的对应关系和处理方向。</p>}
        {!c.changes.length && <p>可同步的控件与属性已一致。</p>}
        {extra===null && selected.map(ch=><fieldset key={ch.key} disabled={busy}><legend>{fieldNames[ch.field]}</legend><p>上次　{c.base?value(c.base.nodes,ch):"无记录"}　原型　{value(c.proto,ch)}　预制体　{value(c.psd,ch)}</p>
          {ch.kind==="delete" && ch.members.some(i=>review.engine.has(i)) && <p>删除预制体节点会同时移除　{ch.members.flatMap(i=>review.engine.get(i)?.map(e=>e.name)??[]).join("、")}</p>}
          {(["proto","psd","skip"] as const).filter(d=>ch.kind!=="add" || d==="skip" || c[d].some(n=>n.id===ch.id)).map(d=><button key={d} aria-pressed={choices[ch.key]===d} onClick={()=>{choose({...choices,[ch.key]:d});setError("");setResult(true);setDetails(false);}}>{describe(ch,d,review)}</button>)}</fieldset>)}
        {nativeProps && <details key={id}><summary>预制体节点属性与挂载组件</summary><pre>{JSON.stringify(nativeProps,null,2)}</pre>{extraChildren.map((n,i)=><p key={i}>仅预制体　{n.name??n._$type??"子节点"}</p>)}</details>}
        {details && m && <fieldset><legend>本轮应用明细</legend>{c.changes.map(ch=><p key={ch.key}>{union.get(ch.id)?.name} · {fieldNames[ch.field]}　{describe(ch,choices[ch.key],review)}</p>)}
          {m.batch.images.map(i=><p key={i.path}>资源　{i.path}</p>)}<p>原型编辑与同步记录将进入工作台的保存和撤销历史。</p></fieldset>}
        {(error || merged.issue) && <p role="alert">{error || merged.issue} <button disabled={busy} onClick={()=>void run(reload)}>重新比较</button></p>}</section></div>
    <footer><span>待决定 {pending} 项　·　已选 {applied.length} 项</span>{details && <button disabled={busy} onClick={()=>setDetails(false)}>返回调整</button>}
      <button disabled={busy || !!pending || !m || !applied.length && !m.baseChanged} onClick={()=>{if(details && m)void run(()=>commit(m));else{setDetails(true);setResult(true);}}}>{busy?"正在处理…":details?"确认应用":!c.base && !applied.length?"建立基线":"预演应用"}</button></footer>
  </dialog>;
}
