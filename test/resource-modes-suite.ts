import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BUILTIN_IMAGES, builtinImage, builtinPath, imageSlotRequest, nodeImageSlot } from "../shared/image-slots";
import { addBackgroundImage, makeComponent, makeNode, duplicateNode, removeNode } from "../shared/editor-ops";
import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument, type GameFlowPage } from "../shared/model";
import { resolvePageLayout } from "../shared/ui-layout";
import { planPrefabExport, isPrefabExportBatch, exportPrefabToDirectories, resourceUrl, resourceUuid, prefabFileName } from "../shared/prefab-export";
import type { ResourceDirectory } from "../shared/psd-export-directory";
import { readExportedSlice } from "../shared/slice-resources";
import { bindPrototypePsd } from "../shared/psd-prototype";
import type { PsdAsset } from "../shared/psd-meta";
import { NodeView } from "../webview/editor/node-view";
import { editCanvasPage, composeCanvasPage } from "../shared/canvas-instances";
import { isWebviewToHostMessage } from "../shared/protocol";
const tests:{name:string;run:()=>void|Promise<void>}[]=[];
const test=(name:string,run:()=>void|Promise<void>)=>tests.push({name,run});
export const resourceModesTests=tests;
let sequence=0;const id=()=>"slot"+(++sequence);
const page=(nodes:GameFlowPage["nodes"]):GameFlowPage=>({id:"page",name:"登录",kind:"screen",frame:{x:0,y:0,width:400,height:600},nodes});
const doc=(p:GameFlowPage)=>({...createDefaultGameFlowDocument("images-test"),pages:[p],interactions:[]});
const hash=async(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const codec={decode:(value:string)=>Buffer.from(value,"base64"),hash};
function memoryDirectory(fail?:string){const files=new Map<string,Uint8Array>();const io:ResourceDirectory={list:async folder=>[...files.keys()].filter(key=>folder?key.startsWith(folder+"/"):!key.includes("/")).map(key=>folder?key.slice(folder.length+1):key),mkdir:async()=>{},read:async key=>files.get(key)??null,write:async(key,bytes)=>{if(key===fail){fail=undefined;throw new Error("disk full");}files.set(key,bytes);},remove:async key=>{files.delete(key);}};return{files,io};}
const missing=async()=>({status:"error" as const,error:"来源图层已删除"});
import { initialPrefabBase, inspectPrefab, mergePrefab } from "../shared/prefab-sync";
import { readPrefabSnapshot } from "../shared/prefab-export";
test("prefab sync merges both additions, maps foreign IDs, preserves components and clears accepted differences",async()=>{
  const initial=page([{...makeNode("text","caption1",0,0),text:"登录"}]);
  const file="登录.lh", document=doc(initial);
  const {batch:first}=await planPrefabExport(document,initial,missing);
  const base=initialPrefabBase(document,initial,file);
  const proto={...initial,prefabSync:base,nodes:[{...initial.nodes[0],text:"进入游戏"},makeNode("button","help0001",10,10)]};
  const {batch}=await planPrefabExport(document,proto,missing);
  const root=structuredClone(first.prefab),children=root._$child as Record<string,unknown>[];
  children[0].text="开始冒险"; children[0].width=250;
  const script=[{_$type:"DebounceClick",interval:500,button:{_$ref:"caption1"}}];
  children[0]._$comp=script;
  const effect={_$type:"Particle2D",_$id:"fx",intensity:12};children.push(effect);
  children.push({_$type:"UIButton",_$id:"Laya-notice",name:"公告",x:19,y:15,width:48,height:24});
  const review=inspectPrefab(document,proto,file,root);
  const decisions=Object.fromEntries(review.comparison.changes.map(ch=>[ch.key,ch.suggested??"skip"]));
  assert.equal(review.comparison.changes.find(c=>c.field==="text")?.suggested,undefined);
  const merged=mergePrefab(review,decisions,batch);
  assert.equal(merged.page.nodes.find(n=>n.id==="caption1")?.frame.width,250);
  const imported=merged.page.nodes.find(n=>n.name==="公告")!;
  assert.match(imported.id,/^[a-z0-9]{8}$/);
  const out=merged.batch.prefab._$child as Record<string,unknown>[];
  assert.deepEqual(out.find(n=>n._$id==="caption1")?._$comp,script);
  assert.deepEqual(out.find(n=>n._$id==="fx"),effect);
  assert.equal(out.filter(n=>n._$id==="help0001").length,1);
  assert.deepEqual(merged.added,["help0001"]);
  const again=inspectPrefab(document,merged.page,file,merged.batch.prefab);
  assert.deepEqual(again.comparison.changes.map(c=>c.key),["caption1/text"]);
  const skipped=mergePrefab(again,{"caption1/text":"skip"},batch);
  assert.deepEqual(JSON.parse(JSON.stringify(skipped.page.prefabSync)),JSON.parse(JSON.stringify(merged.page.prefabSync)));
  assert.equal(skipped.baseChanged,false);
  const resolved=mergePrefab(again,{"caption1/text":"psd"},batch);
  assert.equal(resolved.page.nodes[0].text,"开始冒险");
  assert.deepEqual(inspectPrefab(document,resolved.page,file,resolved.batch.prefab).comparison.changes,[]);
  assert.equal(resolved.changed,false);
});
test("prefab sync records independently agreed values once across save and reopen",async()=>{
  const initial=page([{...makeNode("text","caption1",0,0),text:"登录"}]);
  const document=doc(initial), file="登录.lh";
  const {batch}=await planPrefabExport(document,initial,missing);
  const edited={...initial,prefabSync:initialPrefabBase(document,initial,file),nodes:[{...initial.nodes[0],text:"开始"}]};
  (batch.prefab._$child as Record<string,unknown>[])[0].text="开始";
  const review=inspectPrefab(document,edited,file,batch.prefab);
  assert.deepEqual(review.comparison.changes,[]);
  const merged=mergePrefab(review,{},batch);
  assert.equal(merged.baseChanged,true);
  assert.equal(merged.changed,false);
  const {nodes,...identity}=merged.page.prefabSync;
  const reopened={...merged.page,prefabSync:{nodes,...identity}};
  assert.equal(mergePrefab(inspectPrefab(document,reopened,file,batch.prefab),{},batch).baseChanged,false);
});
test("prefab sync rejects stale and duplicate targets, preserves source on rollback and protects surviving references",async()=>{
  const original=page([makeNode("text","label001",10,12)]);
  const document=doc(original),{batch}=await planPrefabExport(document,original,missing);
  const dirs=memoryDirectory(),resources=memoryDirectory();
  const guard={hash:null,writePrefab:true,added:[]};
  await exportPrefabToDirectories(resources.io,dirs.io,batch,codec,guard);
  const read=await readPrefabSnapshot(dirs.io,batch,hash);
  await assert.rejects(exportPrefabToDirectories(resources.io,dirs.io,batch,codec,guard),/变化/);
  const root=read.prefab!;
  const previous=dirs.files.get(batch.name);
  await assert.rejects(exportPrefabToDirectories(resources.io,dirs.io,{...batch,prefab:{...root,name:"Changed"}},codec,{...guard,hash:read.hash},async()=>{throw new Error("stale document");}),/stale document/);
  assert.deepEqual(dirs.files.get(batch.name),previous);
  root._$comp=[{target:{_$ref:"label001"}}];
  const proto={...original,prefabSync:initialPrefabBase(document,original,batch.name),nodes:[]};
  const review=inspectPrefab(document,proto,batch.name,root);
  assert.throws(()=>mergePrefab(review,{"label001/exist":"proto"},batch),/引用/);
  assert.throws(()=>inspectPrefab(document,proto,batch.name,{...root,_$child:[...(root._$child as object[]),...(root._$child as object[])]}),/重复/);
});
test("image library contains real consistent PNGs and exactly five picker categories",()=>{
  assert.equal(BUILTIN_IMAGES.filter(image=>image.category==="图标").length,28);
  assert.equal(new Set(BUILTIN_IMAGES.map(image=>image.category)).size,5);
  for(const image of BUILTIN_IMAGES){const bytes=Buffer.from(image.dataUri.split(",")[1],"base64");assert.equal(bytes.readUInt32BE(0),0x89504e47);assert.equal(bytes.readUInt32BE(16),image.width);assert.equal(bytes.readUInt32BE(20),image.height);assert.deepEqual(bytes,readFileSync("assets/builtin/"+image.id+".png"));}
});
test("filled and outlined blocks export their default six-pixel nine-grid",async()=>{
  const blocks=BUILTIN_IMAGES.filter(image=>image.id.startsWith("block/"));assert.equal(blocks.length,12);
  const d=doc(page(blocks.map((image,index)=>({...makeNode("image","block"+index,0,0),image:{builtin:image.id}}))));
  const plan=await planPrefabExport(d,d.pages[0],missing);assert.deepEqual(plan.missing,[]);assert.equal(plan.batch.images.length,12);
  for(const image of plan.batch.images)assert.deepEqual(image.description.nineGrid,{top:6,right:6,bottom:6,left:6,repeat:false});
  const resources=memoryDirectory(),prefabs=memoryDirectory();await exportPrefabToDirectories(resources.io,prefabs.io,plan.batch,codec);
  for(const image of plan.batch.images){const meta=JSON.parse(new TextDecoder().decode(resources.files.get(image.path+".meta")!));assert.deepEqual(meta.importer.sizeGrid,[6,6,6,6,0]);}
});
test("prototype ignores art bindings while art and prefab request their separate sources",()=>{
  const slot={builtin:"button/green",art:{path:"unclassified/normal.png"}};
  assert.equal(imageSlotRequest(slot,"prototype").kind,"builtin");
  assert.deepEqual(imageSlotRequest(slot,"art"),{kind:"resource",ref:slot.art});
  assert.deepEqual(imageSlotRequest({builtin:"button/green"},"prefab"),{kind:"resource",ref:{path:"builtin/button/green.png"}});
  assert.equal(imageSlotRequest(null,"prototype").kind,"empty");
  assert.equal(imageSlotRequest({builtin:"unknown/image"},"art").kind,"error");
});
test("button states use disabled selected normal priority with optional-state fallback",()=>{
  const node=makeNode("button","button",0,0);assert.deepEqual(node.normalSkin,{builtin:"button/gray"});assert.equal(node.selectedSkin,undefined);
  node.widget={selected:true};assert.deepEqual(nodeImageSlot(node),node.normalSkin);
  node.selectedSkin={builtin:"button/green",art:{path:"unclassified/missing.png"}};assert.equal(nodeImageSlot(node),node.selectedSkin);
  node.widget.disabled=true;assert.equal(nodeImageSlot(node),node.normalSkin);
  node.disabledSkin={builtin:"button/red"};assert.equal(nodeImageSlot(node),node.disabledSkin);
  node.disabledSkin=null;node.normalSkin=null;assert.equal(nodeImageSlot(node),null);
});
test("UIBox backgrounds are ordinary repeatable image children and CSS appearance stays transparent",()=>{
  const box=makeNode("container","box",0,0);box.style={fill:"#ff0000",borderWidth:8,radius:22};
  let p=page([box]);p=addBackgroundImage(p,"box",id);p=addBackgroundImage(p,"box",id);
  assert.equal(p.nodes.filter(n=>n.parentId==="box"&&n.type==="image").length,2);
  assert.ok(p.nodes.slice(1).every(n=>n.image?.builtin==="block/fill-gray"));
  const markup=renderToStaticMarkup(createElement(NodeView,{page:p,node:box}));assert.ok(markup.includes("background-color:transparent"));assert.ok(!markup.includes("#ff0000"));
  const copy=duplicateNode(p,"box",id);assert.equal(copy.page.nodes.filter(n=>n.parentId===copy.id).length,2);
});
test("image slots clear save copy and instance overrides independently",()=>{
  const node=makeNode("button","button",0,0);node.selectedSkin={builtin:"button/green",art:{path:"shared/selected.png"}};node.disabledSkin=null;
  const d=doc(page([node]));assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(d)),d);
  const copy=duplicateNode(d.pages[0],node.id,id).page.nodes.at(-1)!;assert.deepEqual(copy.selectedSkin,node.selectedSkin);copy.selectedSkin!.builtin="button/red";assert.equal(node.selectedSkin.builtin,"button/green");
  const source=page([node]);source.componentRootId=node.id;const instance={...makeNode("container","instance",0,0),prefab:{source:"",documentId:d.documentId,pageId:source.id}};
  // Component roots must be boxes, so exercise slot overrides on a nested button.
  const root=makeNode("container","root",0,0);node.parentId=root.id;source.nodes.unshift(root);source.componentRootId=root.id;
  delete instance.style; delete instance.layout; delete instance.widget;
  const target={...page([instance]),id:"target"};const document={...d,pages:[source,target]};const composed=composeCanvasPage(document,target,{}),button=composed.page.nodes.find(n=>n.type==="button")!;
  const edited=editCanvasPage(document,target.id,{},p=>({...p,nodes:p.nodes.map(n=>n.id===button.id?{...n,normalSkin:null,selectedSkin:{builtin:"button/yellow"}}:n)}));
  const reopened=parseGameFlowDocument(serializeGameFlowDocument(edited));const final=composeCanvasPage(reopened,reopened.pages[1],{}).page.nodes.find(n=>n.type==="button")!;assert.equal(final.normalSkin,null);assert.deepEqual(final.selectedSkin,{builtin:"button/yellow"});
});
test("circular and horizontal progress share skin identity but preserve full-image circular geometry",()=>{
  const p=page(makeComponent("progress","progress",0,0,id)),root=p.nodes[0];root.frame={x:0,y:0,width:200,height:80};root.widget={...root.widget,min:0,max:100,value:25,mode:"horizontal"};
  const skin=root.widget.skinNodeId!;assert.equal(resolvePageLayout(p).nodes.get(skin)!.local.width,50);
  root.widget.mode="circular";assert.equal(resolvePageLayout(p).nodes.get(skin)!.local.width,200);
  assert.ok(validateGameFlowDocument(doc(p)).ok);assert.equal(parseGameFlowDocument(serializeGameFlowDocument(doc(p))).pages[0].nodes[0].widget!.mode,"circular");
  const invalid=structuredClone(p);invalid.nodes.find(n=>n.id===skin)!.layout={left:0};assert.equal(validateGameFlowDocument(doc(invalid)).ok,false);
});
test("ComboBox label references copy and detach when their UILabel is deleted",()=>{
  const combo=makeNode("combo","combo",0,0),label={...makeNode("text","caption",0,0),parentId:combo.id};combo.widget={...combo.widget,textLabelNodeId:label.id};
  const p=page([combo,label]);assert.ok(validateGameFlowDocument(doc(p)).ok);const copy=duplicateNode(p,combo.id,id);assert.equal(copy.page.nodes.find(n=>n.id===copy.id)!.widget!.textLabelNodeId,copy.page.nodes.find(n=>n.parentId===copy.id)!.id);
  assert.equal(removeNode(p,label.id).nodes[0].widget!.textLabelNodeId,null);
});
test("no-PSD prefab export writes real builtin PNGs ledger importer metadata and independent labels",async()=>{
  const button=makeNode("button","button",0,0),label={...makeNode("text","caption",0,0),parentId:button.id,text:"登录"};const d=doc(page([button,label]));
  const plan=await planPrefabExport(d,d.pages[0],missing);assert.deepEqual(plan.missing,[]);assert.equal(plan.batch.name,"登录.lh");assert.ok(isPrefabExportBatch(plan.batch));
  assert.ok(isWebviewToHostMessage({type:"prefabExport",requestId:"request",batch:plan.batch}));
  const [native]=plan.batch.prefab._$child as Record<string,unknown>[];assert.equal(native._$type,"UIButton");assert.equal(native.scriptPath,"../src/game/app/core/ui/ui-button.ts");assert.equal(native.normalSkin,resourceUrl("builtin/button/gray.png"));assert.equal(native.text,undefined);assert.equal((native._$child as Record<string,unknown>[])[0].text,"登录");
  const resources=memoryDirectory(),prefabs=memoryDirectory();await exportPrefabToDirectories(resources.io,prefabs.io,plan.batch,codec);
  const result=await readExportedSlice("builtin/button/gray.png",{read:resources.io.read,hash,encode:bytes=>Buffer.from(bytes).toString("base64")});assert.equal(result.error,undefined);assert.ok(prefabs.files.has("登录.lh"));assert.ok(resources.files.has("builtin/button/gray.png.meta"));
});
test("default placeholder exports solved dimensions with independent resources and preserves configured art",async()=>{
  const large={...makeNode("image","large",0,0),frame:{x:0,y:0,width:20,height:20},layout:{left:0,right:0,top:0,bottom:0},image:{builtin:"image/default"}};
  const wide={...makeNode("image","wide",0,0),frame:{x:0,y:0,width:200,height:40},image:{builtin:"image/default"}};
  const art={...makeNode("image","art",0,0),image:{builtin:"image/default",art:{path:"unclassified/art.png"}}};
  const p=page([large,wide,{...wide,id:"repeat"},art]),d=doc(p),renders:{path:string;width:number;height:number}[]=[];
  const plan=await planPrefabExport(d,p,async(ref,render)=>{
    if(!render)return {status:"error",error:"missing configured art"};
    renders.push({path:ref.path,width:render.width,height:render.height});
    const image=render.builtin;
    return {status:"ready",image:{path:ref.path,base64:image.dataUri.split(",")[1],description:{path:ref.path,width:render.width,height:render.height,nineGrid:null,source:{documentId:"gameflow-builtin",psdName:"builtin.psd",sourceHash:"0".repeat(64)},layerId:image.id,layerName:image.name,shared:true}}};
  });
  assert.deepEqual(renders,[{path:"builtin/image/default_400x600.png",width:400,height:600},{path:"builtin/image/default_200x40.png",width:200,height:40}]);
  assert.equal(plan.batch.images.length,2);assert.equal(plan.missing.length,1);assert.equal(plan.missing[0].path,"unclassified/art.png");
  const nodes=plan.batch.prefab._$child as Record<string,unknown>[];
  assert.equal(nodes[0].skin,resourceUrl(renders[0].path));assert.equal(nodes[1].skin,nodes[2].skin);assert.equal(nodes[3].skin,"unclassified/art.png");
  assert.deepEqual(imageSlotRequest(large.image,"prefab",{width:400,height:600}),{kind:"resource",ref:{path:renders[0].path}});
  assert.equal(builtinPath("button/gray",{width:400,height:600}),"builtin/button/gray.png");
  assert.notEqual(builtinPath("image/default",{width:8000,height:8000}),builtinPath("image/default",{width:16000,height:16000}));
  assert.notEqual(builtinPath("image/default",{width:20.1,height:40}),builtinPath("image/default",{width:20.2,height:40}));
});
test("default progress placeholder exports the full image before value clipping",async()=>{
  const p=page(makeComponent("progress","progress",0,0,id)),root=p.nodes[0];
  root.frame={x:0,y:0,width:200,height:20};root.widget={...root.widget,min:0,max:1,value:.25};
  const skin=p.nodes.find(n=>n.id===root.widget!.skinNodeId)!;skin.image={builtin:"image/default"};
  let width=0;
  await planPrefabExport(doc(p),p,async(_ref,render)=>{width=render!.width;return{status:"error",error:"fixture"};});
  assert.equal(resolvePageLayout(p).nodes.get(skin.id)!.local.width,50);assert.equal(width,200);
});
test("missing configured art never falls back to builtin and continuing retains the broken reference",async()=>{
  const button=makeNode("button","button",0,0);button.normalSkin={builtin:"button/gray",art:{path:"unclassified/deleted.png"}};button.selectedSkin=null;
  const d=doc(page([button])),plan=await planPrefabExport(d,d.pages[0],missing);assert.equal(plan.missing.length,1);assert.equal(plan.missing[0].slot,"normalSkin");assert.equal(plan.batch.images.length,0);assert.equal((plan.batch.prefab._$child as Record<string,unknown>[])[0].normalSkin,"unclassified/deleted.png");
  const resources=memoryDirectory(),prefabs=memoryDirectory();assert.equal(prefabs.files.size,0);await exportPrefabToDirectories(resources.io,prefabs.io,plan.batch,codec);assert.ok(prefabs.files.has("登录.lh"));assert.ok(!resources.files.has("unclassified/deleted.png"));
});
test("empty normal and absent optional states do not report missing resources",async()=>{
  const button=makeNode("button","button",0,0);button.normalSkin=null;const d=doc(page([button])),plan=await planPrefabExport(d,d.pages[0],missing);assert.deepEqual(plan.missing,[]);assert.deepEqual(plan.batch.images,[]);
});
test("prefab export validates paths and restores images ledger and prefab after a failed write",async()=>{
  const d=doc(page([makeNode("button","button",0,0)])),plan=await planPrefabExport(d,d.pages[0],missing);
  for(const name of ["../escape.lh","C:/bad.lh","CON.lh"]){assert.equal(isPrefabExportBatch({...plan.batch,name}),false);}
  assert.equal(isPrefabExportBatch({...plan.batch,directory:"../escape"}),false);
  assert.equal(isPrefabExportBatch({...plan.batch,images:[{...plan.batch.images[0],path:"../escape.png"}]}),false);
  const resources=memoryDirectory(),prefabs=memoryDirectory("登录.lh");prefabs.files.set("登录.lh",new TextEncoder().encode("original"));
  await assert.rejects(exportPrefabToDirectories(resources.io,prefabs.io,plan.batch,codec),/已恢复/);assert.equal(resources.files.size,0);assert.equal(new TextDecoder().decode(prefabs.files.get("登录.lh")),"original");
});
test("PSD mapping uses stable node and slot identities despite renamed groups",()=>{
  const button=makeNode("button","button",0,0),p=page([button]),d=doc(p);const asset:PsdAsset={name:"test.psd",documentId:"psd",sourceHash:"0".repeat(64),hasEmbeddedIdentity:true,width:400,height:600,preview:"",layers:[{key:0,nativeId:1,parentKey:null,name:"美术改过名称",group:true,left:0,top:0,width:100,height:40,hidden:false,identityOrigin:"embedded",metadata:{namespace:"com.codetypes.gameflow",version:1,documentId:"psd",layerId:"normal",prototype:{documentId:d.documentId,pageId:p.id,nodeId:button.id,slot:"normalSkin"}},config:{enabled:true,name:"normal",exportName:"login_normal",nineGrid:null}}]};
  const bound=bindPrototypePsd(p,d.documentId,asset);assert.deepEqual(bound.nodes[0].normalSkin,{builtin:"button/gray",art:{path:"unclassified/test_login_normal.png",source:{documentId:"psd",layerId:"normal"}}});assert.deepEqual(bindPrototypePsd(p,"another",asset),p);
  assert.throws(()=>bindPrototypePsd(p,d.documentId,{...asset,layers:[...asset.layers,{...asset.layers[0],key:1}]}),/多个 PSD 图层/);
});

test("Prefab export keeps existing importer UUID and maps only image properties",async()=>{
  const d=doc(page([makeNode("button","button",0,0)])),plan=await planPrefabExport(d,d.pages[0],missing),resources=memoryDirectory(),prefabs=memoryDirectory();
  const existing="12345678-1234-4567-890a-123456789abc",image=plan.batch.images[0];
  resources.files.set(image.path+".meta",new TextEncoder().encode(JSON.stringify({uuid:existing,importer:{textureType:2,filterMode:1}})));
  plan.batch.prefab.description=resourceUrl(image.path);
  await exportPrefabToDirectories(resources.io,prefabs.io,plan.batch,codec);
  const native=JSON.parse(new TextDecoder().decode(prefabs.files.get(plan.batch.name)));assert.equal(native._$child[0].normalSkin,"res://"+existing);assert.equal(native.description,resourceUrl(image.path));
  const meta=JSON.parse(new TextDecoder().decode(resources.files.get(image.path+".meta")));assert.equal(meta.importer.filterMode,1);assert.deepEqual(meta.importer.sizeGrid,[14,14,14,14,0]);
});
test("progress exports its mode range and explicit image skin reference at all endpoint ratios",async()=>{
  const p=page(makeComponent("progress","progress",0,0,id)),root=p.nodes[0];root.frame={x:0,y:0,width:160,height:80};
  for(const mode of ["horizontal","circular"] as const)for(const value of [10,60,110]){root.widget={...root.widget,mode,min:10,max:110,value};const width=resolvePageLayout(p).nodes.get(root.widget.skinNodeId!)!.local.width;assert.equal(width,mode==="circular"?160:160*(value-10)/100);const plan=await planPrefabExport(doc(p),p,missing),native=(plan.batch.prefab._$child as Record<string,unknown>[])[0];assert.equal(native.mode,mode);assert.deepEqual(native.skin,{"_$ref":root.widget.skinNodeId});assert.equal(native.min,10);assert.equal(native.max,110);assert.equal(native.value,value);}
});
test("export batch rejects cyclic data and corrupt pixels before any writes",async()=>{
  const d=doc(page([makeNode("button","button",0,0)])),plan=await planPrefabExport(d,d.pages[0],missing),resources=memoryDirectory(),prefabs=memoryDirectory();
  const circular:Record<string,unknown>={};circular.self=circular;assert.equal(isPrefabExportBatch({...plan.batch,prefab:circular}),false);
  plan.batch.images[0].base64=Buffer.alloc(40).toString("base64");await assert.rejects(exportPrefabToDirectories(resources.io,prefabs.io,plan.batch,codec),/PNG/);assert.equal(resources.files.size,0);assert.equal(prefabs.files.size,0);
  assert.equal(prefabFileName({...d.pages[0],name:"CON"}),"_CON.lh");assert.equal(prefabFileName({...d.pages[0],name:"..."}),"page.lh");
});

test("art-only optional button states retain prototype normal without pulling in art pixels",()=>{
  const button=makeNode("button","button",0,0);button.selectedSkin={art:{path:"unclassified/selected.png"}};button.widget={selected:true};
  assert.equal(nodeImageSlot(button,"prototype"),button.normalSkin);assert.equal(nodeImageSlot(button,"art"),button.selectedSkin);assert.equal(nodeImageSlot(button,"prefab"),button.selectedSkin);
  assert.equal(imageSlotRequest({art:{path:"unclassified/normal.png"}},"prototype").kind,"empty");
});
