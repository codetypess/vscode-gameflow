import { ListCells } from "./list-cell-context";
import { cellKey } from "../../shared/list-cell";
import type { GameFlowPage } from "../../shared/model";
import { SyncTree } from "./sync-tree";
import { Button } from "../components/ui/button";
import { DialogHeading } from "../components/dialog-heading";
import {useEffect,useMemo,useRef,useState} from "react";
import type {Decision} from "../../shared/page-sync";
import {mergePrefab,prefabPreviewPage,type PrefabReview,type PrefabSyncMode} from "../../shared/prefab-sync";
import {resourceUrl,type PrefabPlan} from "../../shared/prefab-export";
import {SyncPreview} from "./page-sync-dialog";
import {changeTitle, changeValue, describeDecision, PrefabSyncChange} from "./prefab-sync-change";
import {SliceResourcesProvider} from "../runtime/resource-context";
import {useRuntimeResources} from "../runtime/resources";
import type {PsdAsset} from "../../shared/psd-meta";
import {isSliceResourcePath} from "../../shared/slice-resources";
import {loadSliceImage} from "../psd/slice-render";
import type {RuntimeResource} from "../runtime/resource-context";
import {syncDialogResizeEdges,useSyncDialogSize} from "./use-sync-dialog-size";
const noAssets:PsdAsset[]=[], noPageAssets:Record<string,PsdAsset>={};

export type PrefabMerge = ReturnType<typeof mergePrefab>;
export const prefabSyncLabels:Record<PrefabSyncMode,string>={review:"预制体同步",push:"从原型到预制体",pull:"从预制体到原型",art:"从 PSD 到预制体"};
export function PrefabSyncDialog({review,cells,plan,mode,asset,skins,resourceRoot,close,commit,reload}:{review:PrefabReview;cells:Map<string,GameFlowPage>;plan:PrefabPlan;mode:PrefabSyncMode;asset?:PsdAsset;skins?:Record<string,string>;resourceRoot?:string;close:()=>void;commit:(merge:PrefabMerge)=>Promise<void>;reload:()=>Promise<void>}) {
  const c=review.comparison,ref=useRef<HTMLDialogElement>(null);
  const {size,resizeEdgeProps}=useSyncDialogSize({storageKey:"gameflow.prefabSync.size.v2",defaultWidth:1280,defaultHeight:760,minWidth:360,minHeight:300});
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
  const fixedSide=mode==="review"?undefined:mode==="pull"?"psd":"proto";
  const [choices,choose]=useState<Record<string,Decision>>(()=>Object.fromEntries(c.changes.filter(ch=>fixedSide || ch.suggested).map(ch=>[ch.key,fixedSide ?? ch.suggested!])));
  const [result,setResult]=useState(false),[details,setDetails]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    const dialog=ref.current!;
    dialog.showModal();
    return ()=>dialog.close();
  },[]);
  const merged=useMemo(()=>{try{return {data:mergePrefab(review,choices,plan.batch,mode)};}catch(e){return {issue:String(e)};}},[review,choices,plan,mode]);
  const m=merged.data,trees=result && m?m.trees:c;
  const preview=useMemo(()=>{
    const paths={...skins};
    if(result && m)for(const img of m.batch.images) {
      paths[resourceUrl(img.path)]=img.path;
      if(img.expectedUuid) paths["res://"+img.expectedUuid]=img.path;
    }
    return prefabPreviewPage(review,trees.psd,result && m?m.batch.prefab:review.root,paths);
  },[review,trees.psd,result,m,skins]);
  const pages=useMemo(()=>[preview,...new Set(cells.values())],[preview,cells]);
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
    if(asset && result && plannedPixels.has(ref.path)) return plannedPixels.get(ref.path)!;
    return disk.status==="ready" ? disk : plannedPixels.get(ref.path)??disk;
  }};
  const [extra,setExtra]=useState<number|null>(null);
  function selectNode(next:string,component:number|null=null){select(next);setExtra(component);}
  const node=union.get(id),selected=c.changes.filter(ch=>ch.members.includes(id));
  const native=review.originals.get(id)??(id===review.page.id?review.root:undefined);
  const rawChildren=Array.isArray(native?._$child)?native._$child:[];
  const extraChildren=rawChildren.filter(n=>![...review.originals.values()].includes(n));
  const nativeProps=native ? Object.fromEntries(Object.entries(native).filter(([k])=>k!=="_$child")) : undefined;
  const unknownSkins=["skin","normalSkin","selectedSkin","disabledSkin"].map(k=>native?.[k]).filter((s):s is string=>
    typeof s==="string" && !!s && !skins?.[s] && !isSliceResourcePath(s));
  const pending=c.changes.filter(ch=>!choices[ch.key]).length, applied=c.changes.filter(ch=>choices[ch.key] && choices[ch.key]!=="skip");
  const skipped=c.changes.length-pending-applied.length;
  const cellChanges = m?.batch.cells?.filter(cell=>cell.prefab || cell.metaChanged).map(cell=>[cell.directory,cell.name].filter(Boolean).join("/")) ?? [];
  const hasAssets=mode!=="pull" && (review.metadata?.prefabMetaChanged || !!m?.batch.images.length || !!cellChanges.length);
  const toggle=(key:string)=>setExpanded(prev=>{const next=new Set(prev);if(next.has(key))next.delete(key);else next.add(key);return next;});
  async function run(action:()=>Promise<void>) {
    setBusy(true);setError("");
    try{await action();}catch(e){setError(String(e));}finally{setBusy(false);}
  }
  return <dialog ref={ref} className="floating-panel workbench-dialog page-sync-dialog prefab-sync-dialog" aria-label={prefabSyncLabels[mode]} style={{width:size.width,height:size.height}} onCancel={e=>{e.preventDefault();if(!busy)close();}}>
    <DialogHeading heading={prefabSyncLabels[mode]} closeLabel="关闭同步窗" onClose={close} closeDisabled={busy}>
      <span title={review.target}>{review.page.name} / {review.target}</span>
    </DialogHeading>
    <div className="sync-layout"><SyncTree page={review.page} nodes={union.values()} changes={c.changes}
      selected={id} selectedComponent={extra} components={review.engine} expanded={expanded} onToggle={toggle} onSelect={selectNode} />
      <section className="sync-main"><div className="sync-bar"><strong>{node?.name??review.page.name}</strong><div><button aria-pressed={!result} onClick={()=>{setResult(false);setDetails(false);}}>当前</button><button aria-pressed={result} onClick={()=>setResult(true)}>同步后</button></div></div>
        <div className="sync-boards"><figure><figcaption>{asset?"美术 PSD":"原型 · 内置资源"}</figcaption><SyncPreview asset={asset} page={result && m?m.page:review.page} canvasSize={review.page.frame} selected={extra===null?id:""} nodes={trees.proto} changes={c.changes} old={c.base?.nodes??[]} onSelect={selectNode}/></figure>
          <figure><figcaption>预制体 · 静态 UI</figcaption><ListCells.Provider value={{resolve(ref) {
            const key = cellKey(ref);
            const uuid = "uuid" in ref ? ref.uuid : [...review.cellReferences].find(([,binding])=>cellKey(binding)===key)?.[0];
            if (!result && plan.batch.cells?.some(cell=>cell.uuid===uuid && cell.hash===null)) throw new Error("磁盘上的列表项模板尚未生成。");
            const template = cells.get(key);
            if (!template) throw new Error("找不到磁盘列表项模板 " + ("uuid" in ref ? ref.uuid : ref.pageId));
            return template;
          }}}><SliceResourcesProvider value={previewResources}><SyncPreview page={preview} canvasSize={review.page.frame} resourceMode="prefab" selected={id} nodes={trees.psd} changes={c.changes} old={c.base?.nodes??[]} onSelect={selectNode}/></SliceResourcesProvider></ListCells.Provider></figure></div></section>
      <aside className="sync-detail" aria-label="同步属性详情">
        {unknownSkins.length>0 && <p>未定位到预览贴图　{[...new Set(unknownSkins)].join("、")}</p>}
        {extra!==null && <fieldset><legend>仅预制体 · {review.engine.get(id)?.[extra]?.name}</legend><pre>{JSON.stringify(review.engine.get(id)?.[extra]?.value,null,2)}</pre></fieldset>}
        {!c.base && !fixedSide && <p>首次对照。请确认单侧控件的对应关系和处理方向。</p>}
        {!c.changes.length && <p>可同步的控件与属性已一致。</p>}
        {hasAssets && <p>待同步资源文件　{[...(review.metadata?.prefabMetaChanged?[review.target+".meta"]:[]),...cellChanges,...m?.batch.images.map(i=>i.path)??[]].join("、")}</p>}
        {extra===null && selected.map(ch=>fixedSide ? <fieldset key={ch.key}><legend>{changeTitle(ch)}</legend>
          <dl className="sync-values"><dt>{asset?"PSD":"原型"}</dt><dd>{changeValue(c.proto,ch)}</dd><dt>预制体</dt><dd>{changeValue(c.psd,ch)}</dd></dl>
          <p>{describeDecision(review,ch,fixedSide)}</p></fieldset> : <PrefabSyncChange key={ch.key} review={review} change={ch} decision={choices[ch.key]} disabled={busy}
          onChoose={decision=>{choose(current=>({...current,[ch.key]:decision}));setError("");setResult(true);setDetails(false);}}>
          {ch.kind==="delete" && ch.members.some(i=>review.engine.has(i)) && <p>删除预制体节点会同时移除　{ch.members.flatMap(i=>review.engine.get(i)?.map(e=>e.name)??[]).join("、")}</p>}
        </PrefabSyncChange>)}
        {extra===null && selected.length>0 && m && <details className="prefab-result" key={"result-"+id}><summary>同步后属性预览</summary>
          <table><thead><tr><th>属性</th><th>{asset?"PSD":"原型"}</th><th>预制体</th></tr></thead>
            <tbody>{selected.map(ch=><tr key={ch.key}><th scope="row">{changeTitle(ch)}</th><td>{changeValue(m.trees.proto,ch)}</td><td>{changeValue(m.trees.psd,ch)}</td></tr>)}</tbody>
          </table></details>}
        {nativeProps && <details key={id}><summary>预制体节点属性与挂载组件</summary><pre>{JSON.stringify(nativeProps,null,2)}</pre>{extraChildren.map((n,i)=><p key={i}>仅预制体　{n.name??n._$type??"子节点"}</p>)}</details>}
        {details && m && <fieldset><legend>本轮应用明细</legend>{c.changes.map(ch=><p key={ch.key}>{union.get(ch.id)?.name} · {changeTitle(ch)}　{describeDecision(review,ch,choices[ch.key])}</p>)}
          {m.batch.images.map(i=><p key={i.path}>资源　{i.path}</p>)}{!asset && <p>原型编辑与同步记录将进入工作台的保存和撤销历史。</p>}</fieldset>}
        {(error || merged.issue) && <p role="alert">{error || merged.issue} <button disabled={busy} onClick={()=>void run(reload)}>重新比较</button></p>}</aside></div>
    <footer><span>待决定 {pending} 项　·　已选 {applied.length} 项{skipped>0 && "　·　跳过 "+skipped+" 项"}</span>{details && <button disabled={busy} onClick={()=>setDetails(false)}>返回调整</button>}
      <Button size="sm" disabled={busy || !!pending || !m || !applied.length && !m.changed && !(mode!=="art" && m.baseChanged) && !hasAssets} onClick={()=>{if(details && m)void run(()=>commit(m));else{setDetails(true);setResult(true);}}}>{busy?"正在处理…":details?"确认应用":mode!=="art" && !c.base && !applied.length?"建立基线":"预演应用"}</Button></footer>
    {syncDialogResizeEdges.map(edge=><span key={edge} className="sync-resize-edge" data-edge={edge} aria-hidden="true" {...resizeEdgeProps(edge)}/>)}
  </dialog>;
}
