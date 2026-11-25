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
const page=(nodes:GameFlowPage["nodes"]):GameFlowPage=>({id:"page",name:"登录",exportName:"登录",kind:"screen",frame:{x:0,y:0,width:400,height:600},nodes});
const doc=(p:GameFlowPage)=>({...createDefaultGameFlowDocument("images-test"),pages:[p],interactions:[]});
const hash=async(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const codec={decode:(value:string)=>Buffer.from(value,"base64"),hash};
function memoryDirectory(fail?:string){const files=new Map<string,Uint8Array>();const io:ResourceDirectory={list:async folder=>[...files.keys()].filter(key=>folder?key.startsWith(folder+"/"):!key.includes("/")).map(key=>folder?key.slice(folder.length+1):key),mkdir:async()=>{},read:async key=>files.get(key)??null,write:async(key,bytes)=>{if(key===fail){fail=undefined;throw new Error("disk full");}files.set(key,bytes);},remove:async key=>{files.delete(key);}};return{files,io};}
const missing=async()=>({status:"error" as const,error:"来源图层已删除"});
import { initialPrefabBase, inspectPrefab, mergePrefab } from "../shared/prefab-sync";
import { readPrefabSnapshot } from "../shared/prefab-export";
import { listCellPositions, resolveCellPage } from "../shared/list-cell";
import { planListPrefabExport } from "../shared/list-prefab-export";
import { loadCanvasSources } from "../shared/canvas-references";

test("disabled export skips a whole subtree, resources and template resolution", async () => {
  const group = { ...makeNode("container", "group", 0, 0), exportEnabled: false };
  const picture = { ...makeNode("image", "picture", 0, 0), parentId: group.id, image: { art: { path: "unclassified/omitted.png" } } };
  const list = { ...makeNode("list", "list", 0, 0), parentId: group.id,
    cellPrefab: { source: "unavailable.gameflow.json", documentId: "unavailable", pageId: "item" } };
  const label = makeNode("text", "label", 0, 0);
  const screen = page([group, picture, list, label]);
  const document = doc(screen);
  const { plan } = await planListPrefabExport(document, screen, {}, () => async () => assert.fail("resolve excluded image"),
    async () => assert.fail("inspect excluded template"), { name: prefabFileName(screen) });
  assert.deepEqual((plan.batch.prefab._$child as Record<string, unknown>[]).map(node => node._$id), [label.id]);
  assert.deepEqual(plan.batch.images, []);
  assert.deepEqual(plan.missing, []);
  const saved = parseGameFlowDocument(serializeGameFlowDocument(document));
  assert.equal(saved.pages[0].nodes[0].exportEnabled, false);
  assert.equal(saved.pages[0].nodes.at(-1)?.exportEnabled, undefined);
});

test("prefab sync omits excluded controls from previews and removes old disk copies without changing prototype controls", async () => {
  const parent = makeNode("checkbox", "check", 0, 0);
  const skin = { ...makeNode("image", "skin", 0, 0), parentId: parent.id };
  parent.widget = { ...parent.widget, skinNodeId: skin.id };
  const group = makeNode("container", "group", 0, 0);
  const caption = { ...makeNode("text", "caption", 0, 0), parentId: group.id };
  const screen = page([parent, skin, group, caption]);
  const document = doc(screen);
  const before = (await planPrefabExport(document, screen, missing)).batch;
  screen.prefabSync = initialPrefabBase(document, screen, before.name);
  screen.nodes = screen.nodes.map(node => node.id === skin.id || node.id === group.id ? { ...node, exportEnabled: false } : node);
  const plan = (await planPrefabExport(document, screen, missing)).batch;
  const review = inspectPrefab(document, screen, before.name, before.prefab);
  assert.deepEqual(review.comparison.changes, []);
  for (const nodes of [review.exportPage.nodes, review.comparison.proto, review.comparison.psd, review.comparison.base!.nodes]) {
    assert(!nodes.some(node => [skin.id, group.id, caption.id].includes(node.id)));
  }
  assert.equal(review.excludedRecords.size, 2);
  const merged = mergePrefab(review, {}, plan);
  assert(merged.changed);
  assert.deepEqual(merged.page.nodes, screen.nodes);
  const children = merged.batch.prefab._$child as Record<string, unknown>[];
  assert.deepEqual(children.map(node => node._$id), [parent.id]);
  assert.equal(children[0].skin, undefined);
  const pull = mergePrefab(inspectPrefab(document, screen, before.name, before.prefab, undefined, undefined, "pull"), {}, plan, "pull");
  assert.deepEqual(pull.page.nodes, screen.nodes);
  assert.deepEqual(pull.batch.prefab, before.prefab);
  const restored = { ...merged.page, nodes: merged.page.nodes.map(node => node.id === group.id ? { ...node, exportEnabled: undefined } : node) };
  assert(inspectPrefab(document, restored, before.name, merged.batch.prefab).comparison.changes.some(change => change.id === group.id && change.kind === "add"));
});

test("prefab export rejects absent and blank export names before resolving images", async () => {
  const button = makeNode("button", "button", 0, 0);
  button.normalSkin = {art:{path:"unclassified/login.png"}};
  for (const exportName of [undefined, "", " \t "]) {
    const screen = {...page([button]), exportName};
    await assert.rejects(planPrefabExport(doc(screen), screen, () => assert.fail("resolved images")), /原型「登录」未设置导出名称/);
  }
});

test("prefab export reports every unnamed prototype in the reference graph before reading targets", async () => {
  const list = makeNode("list", "list", 0, 0);
  const instance = makeNode("container", "instance", 0, 0);
  const screen:GameFlowPage = {...page([list, instance]), exportName:undefined};
  const document = doc(screen);
  const nested = makeNode("container", "nested", 0, 0);
  const item:GameFlowPage = {...page([nested]), id:"item", name:"服务器列表项", exportName:undefined, rootType:"UIBox"};
  const badge:GameFlowPage = {...page([]), id:"badge", name:"状态图标", exportName:"  ", rootType:"UIBox"};
  const source = "ui/items.gameflow.json";
  const external = {...doc(item), documentId:"external", pages:[item,badge]};
  const sources = {[source]:{source, document:external}};
  const ref = {source, documentId:external.documentId, pageId:item.id};
  list.cellPrefab = ref;
  instance.prefab = ref;
  nested.prefab = {source:"", documentId:external.documentId, pageId:badge.id};
  item.prefabSync = initialPrefabBase(external, item, "OldItem.lh");
  document.pages.push({...page([]), id:"unrelated", name:"其他页面", exportName:undefined});
  const target = {name:"Login.lh"};
  await assert.rejects(planListPrefabExport(document, screen, sources, () => missing, () => assert.fail("read a target"), target), error => {
    const message = String(error);
    assert.match(message, /未设置导出名称/);
    for (const name of [screen.name, item.name, badge.name]) assert.equal(message.split(name).length, 2);
    assert.ok(message.includes(source));
    assert.doesNotMatch(message, /其他页面/);
    return true;
  });
  screen.exportName = target.name.slice(0,-3);
  item.exportName = "ServerItem";
  badge.exportName = "Badge";
  const files = memoryDirectory();
  const {plan} = await planListPrefabExport(document, screen, sources, () => missing, file => readPrefabSnapshot(files.io,file,hash), target);
  assert.equal(plan.batch.name, target.name);
  assert.deepEqual(plan.batch.cells?.map(cell => cell.name), ["OldItem.lh", "Badge.lh"]);
});

test("clearing an export name blocks a linked target while still allowing a read-only pull", async () => {
  const screen = page([]);
  screen.exportName = "Login";
  const document = doc(screen);
  const {batch} = await planPrefabExport(document, screen, missing);
  screen.prefabSync = initialPrefabBase(document, screen, batch.name);
  delete screen.exportName;
  const noRead = () => assert.fail("unexpected template read");
  await assert.rejects(planListPrefabExport(document, screen, {}, () => missing, noRead, batch), /原型「登录」未设置导出名称/);
  const {plan} = await planListPrefabExport(document, screen, {}, () => missing, noRead, {name:batch.name}, "pull");
  assert.deepEqual(plan.batch.images, []);
  assert.equal(plan.batch.cells, undefined);
  const review = inspectPrefab(document, screen, batch.name, batch.prefab, undefined, undefined, "pull");
  const decisions = Object.fromEntries(review.comparison.changes.map(change => [change.key, "psd" as const]));
  assert.equal(mergePrefab(review, decisions, plan.batch, "pull").page.exportName, "Login");
  screen.exportName = "Login";
  const renamed = inspectPrefab(document, screen, batch.name, {...batch.prefab,name:screen.name}, undefined, undefined, "pull");
  const rename = renamed.comparison.changes.find(change => change.property === "page.exportName")!;
  assert.equal(mergePrefab(renamed, {[rename.key]:"psd"}, plan.batch, "pull").page.exportName, screen.name);
});

test("UIList repeats UIBox boards from either GameFlow with Laya viewport, spacing and orientation",async()=>{
  const [list,...children]=makeComponent("list","celllist",0,0,id);
  assert.equal(children.length,0);
  const board:GameFlowPage={...page([makeNode("text","itemtext",0,0)]),rootType:"UIBox",id:"cellpage",name:"格子",frame:{x:0,y:0,width:40,height:20}};
  const current=page([list]),document=doc(current),external={...doc(board),documentId:"other"};
  document.pages.push(board);
  const ref={source:"",documentId:document.documentId,pageId:board.id};
  list.cellPrefab=ref;
  assert.equal(resolveCellPage(document,{},ref).page.name,board.name);
  list.cellPrefab={...ref,source:"../other.gameflow.json",documentId:"other"};
  const sources=await loadCanvasSources(document,async source=>{assert.equal(source,list.cellPrefab && "source" in list.cellPrefab && list.cellPrefab.source);return external;});
  const template=resolveCellPage(document,sources,list.cellPrefab).page;
  list.layout={wrapCount:2,gapX:3,gapY:5,paddingTop:5,paddingRight:5};
  const bounds={x:0,y:0,width:100,height:55};
  const vertical=listCellPositions(list,bounds,template);
  assert.deepEqual([vertical.columns,vertical.rows,vertical.dx,vertical.dy],[2,2,43,25]);
  assert.equal(listCellPositions(list,{...bounds,height:56},template).rows,3);
  list.layout.scrollType=1;
  const horizontal=listCellPositions(list,bounds,template);
  assert.deepEqual([horizontal.columns,horizontal.rows],[3,2]);
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(document)).pages[0].nodes[0].cellPrefab,list.cellPrefab);
  assert.throws(()=>resolveCellPage(document,{},list.cellPrefab as typeof ref));
});

test("CellPrefab export creates a separate external UIBox, respects disk UUID and reviews template changes independently",async()=>{
  const list=makeNode("list","celllist",0,0),current=page([list]),document=doc(current);
  const item:GameFlowPage={...page([makeNode("text","itemtext",0,0)]),rootType:"UIBox",id:"cellpage",name:"背包格",exportName:"背包格"};
  const external={...doc(item),documentId:"external",exportDirectory:"ui/items"};
  const ref={source:"items.gameflow.json",pageId:item.id,documentId:external.documentId};
  list.cellPrefab=ref;
  const sources={[ref.source]:{source:ref.source,document:external}};
  const resources=memoryDirectory(),files=memoryDirectory(),file="ui/items/背包格.lh";
  const uuid="abcde123-1234-4567-a901-abcdef123456";
  files.files.set(file+".meta",Buffer.from(JSON.stringify({uuid})));
  const target={name:prefabFileName(current)};
  const planFor=()=>planListPrefabExport(document,current,sources,()=>missing,t=>readPrefabSnapshot(files.io,t,hash),target);
  const initial=await planFor(), batch=initial.plan.batch;
  const child=(batch.prefab._$child as Record<string,unknown>[])[0];
  assert.deepEqual(child.cellPrefab,{_$uuid:uuid,_$type:"Prefab"});
  assert.equal(child._$child,undefined);
  assert.ok(isPrefabExportBatch(batch));
  await exportPrefabToDirectories(resources.io,files.io,batch,codec);
  const native=JSON.parse(new TextDecoder().decode(files.files.get(file)));
  native._$child[0].text="磁盘内容";
  files.files.set(file,Buffer.from(JSON.stringify(native)));
  const again=await planFor();
  assert.equal(again.previews.get(uuid)?.nodes[0].text,"磁盘内容");
  assert.equal(again.plan.batch.cells?.[0].prefab,undefined);
  const review=inspectPrefab(document,current,target.name,batch.prefab,undefined,again.refs);
  assert.ok(!review.comparison.changes.some(ch=>ch.property==="cellPrefab"));
  delete list.cellPrefab;
  const cleared=await planFor();
  await cleared.locateDiskBindings(batch.prefab);
  const different=inspectPrefab(document,current,target.name,batch.prefab,undefined,cleared.refs);
  const change=different.comparison.changes.find(ch=>ch.property==="cellPrefab")!;
  const pull=mergePrefab(different,{[change.key]:"psd"},cleared.plan.batch);
  assert.deepEqual(pull.page.nodes[0].cellPrefab,ref);
  const push=mergePrefab(different,{[change.key]:"proto"},cleared.plan.batch);
  assert.equal((push.batch.prefab._$child as Record<string,unknown>[])[0].cellPrefab,undefined);
  const absent=memoryDirectory(target.name);
  absent.files.set(file+".meta",Buffer.from(JSON.stringify({uuid})));
  await assert.rejects(exportPrefabToDirectories(resources.io,absent.io,batch,codec),/已恢复/);
  assert.equal(absent.files.has(file),false);
});

test("canvas prefab instances export as UUID references instead of expanded source children",async()=>{
  const list=makeNode("list","celllist",0,0), itemNode=makeNode("container","instance",10,20);
  const current=page([list,itemNode]), document=doc(current);
  const item:GameFlowPage={...page([makeNode("text","itemtext",0,0)]),rootType:"UIBox",id:"cellpage",name:"背包格",exportName:"InventoryCell"};
  const external={...doc(item),documentId:"external",exportDirectory:"ui/items"};
  const ref={source:"items.gameflow.json",pageId:item.id,documentId:external.documentId};
  list.cellPrefab=ref; itemNode.prefab=ref;
  const sources={[ref.source]:{source:ref.source,document:external}};
  const resources=memoryDirectory(),files=memoryDirectory(),file="ui/items/InventoryCell.lh";
  const uuid="abcde123-1234-4567-a901-abcdef123456";
  files.files.set(file+".meta",Buffer.from(JSON.stringify({uuid})));
  const target={name:prefabFileName(current)};
  const planned=await planListPrefabExport(document,current,sources,()=>missing,t=>readPrefabSnapshot(files.io,t,hash),target);
  const records=planned.plan.batch.prefab._$child as Record<string,unknown>[];
  const instance=records.find(record=>record._$id==="instance")!;
  assert.equal(instance._$prefab,uuid);
  assert.equal(instance._$type,undefined);
  assert.equal(instance._$child,undefined);
  assert.equal(instance.paddingLeft,undefined);
  assert.equal(instance.gap,undefined);
  assert.equal(planned.plan.batch.cells?.length,1);
  assert.equal(planned.plan.batch.cells?.[0].name,file.split("/").at(-1));
  assert.ok(planned.plan.batch.cells?.[0].prefab);
  const review=inspectPrefab(document,current,target.name,planned.plan.batch.prefab,undefined,planned.refs);
  assert.equal(review.originals.get("instance")?._$prefab,uuid);
  const expanded=composeCanvasPage(document,current,sources).page;
  const old=await planPrefabExport(document,expanded,missing,()=>uuid);
  const conversion=inspectPrefab(document,current,target.name,old.batch.prefab,undefined,planned.refs);
  const expandedChild=conversion.comparison.psd.find(node=>node.parent==="instance")!;
  assert.equal(conversion.comparison.changes.length,1);
  assert.deepEqual(conversion.comparison.changes[0],{
    id:"instance",key:"instance/reference",field:"exist",kind:"edit",members:["instance",expandedChild.id],
    replacement:"proto",representation:"prefab-reference",suggested:"proto"
  });
  const reverse=mergePrefab(conversion,{[conversion.comparison.changes[0].key]:"psd"},planned.plan.batch);
  const retained=(reverse.batch.prefab._$child as Record<string,unknown>[]).find(record=>record._$id==="instance")!;
  assert.equal(retained._$prefab,undefined);
  assert.ok(Array.isArray(retained._$child));
  assert.deepEqual(reverse.page.nodes.map(node=>node.id),current.nodes.map(node=>node.id));
  const decisions=Object.fromEntries(conversion.comparison.changes.map(change=>[change.key,"proto" as const]));
  const merged=mergePrefab(conversion,decisions,planned.plan.batch);
  const converted=(merged.batch.prefab._$child as Record<string,unknown>[]).find(record=>record._$id==="instance")!;
  assert.equal(converted._$prefab,uuid);
  assert.equal(converted._$type,undefined);
  assert.equal(converted._$child,undefined);
  const repeated=inspectPrefab(document,merged.page,target.name,merged.batch.prefab,undefined,planned.refs);
  assert.deepEqual(repeated.comparison.changes,[]);
});

test("component definitions promote their owned UIBox to the Prefab root",async()=>{
  const root={...makeNode("container","component-root",0,0),frame:{x:0,y:0,width:320,height:80},layout:{gap:9,paddingLeft:12,widthMode:"explicit" as const,heightMode:"explicit" as const}};
  const label={...makeNode("text","component-label",8,10),parentId:root.id,text:"一区"};
  const component:GameFlowPage={...page([root,label]),id:"component-page",name:"服务器列表项",exportName:"LoginServerListItem",rootType:"UIBox",componentRootId:root.id,frame:{x:500,y:0,width:320,height:80}};
  const document=doc(component), plan=await planPrefabExport(document,component,missing), native=plan.batch.prefab;
  assert.equal(native._$id,component.id);
  assert.equal(native._$type,"UIBox");
  assert.equal(native.name,component.exportName);
  assert.equal(native.gap,9);
  assert.equal(native.paddingLeft,12);
  assert.equal(native.x,undefined);
  assert.equal(native.y,undefined);
  const children=native._$child as Record<string,unknown>[];
  assert.deepEqual(children.map(child=>child._$id),[label.id]);
  assert.equal(JSON.stringify(native).includes(root.id),false);
  assert.deepEqual(inspectPrefab(document,component,plan.batch.name,native).comparison.changes,[]);

  const editedNative=structuredClone(native);
  editedNative.width=360;
  editedNative.gap=17;
  const rootReview=inspectPrefab(document,component,plan.batch.name,editedNative);
  const pullRoot=mergePrefab(rootReview,Object.fromEntries(rootReview.comparison.changes.map(change=>[change.key,"psd" as const])),plan.batch);
  const pulledRoot=pullRoot.page.nodes.find(node=>node.id===root.id)!;
  assert.equal(pullRoot.page.frame.width,360);
  assert.equal(pulledRoot.frame.width,360);
  assert.equal(pulledRoot.layout?.gap,17);
  assert.deepEqual(inspectPrefab(document,pullRoot.page,plan.batch.name,pullRoot.batch.prefab).comparison.changes,[]);
  const pushRoot=mergePrefab(rootReview,Object.fromEntries(rootReview.comparison.changes.map(change=>[change.key,"proto" as const])),plan.batch);
  assert.equal(pushRoot.batch.prefab.width,320);
  assert.equal(pushRoot.batch.prefab.gap,9);
  assert.deepEqual(inspectPrefab(document,pushRoot.page,plan.batch.name,pushRoot.batch.prefab).comparison.changes,[]);

  const legacyPage={...component,componentRootId:undefined};
  const legacy=(await planPrefabExport(document,legacyPage,missing)).batch.prefab;
  const migration=inspectPrefab(document,component,plan.batch.name,legacy);
  assert.deepEqual(migration.comparison.changes,[{
    id:root.id,key:root.id+"/component-root",field:"exist",kind:"edit",members:[root.id,label.id],
    replacement:"proto",representation:"component-root",suggested:"proto"
  }]);
  const skipped=mergePrefab(migration,{[root.id+"/component-root"]:"skip"},plan.batch);
  assert.equal((skipped.batch.prefab._$child as Record<string,unknown>[])[0]._$id,root.id);
  const promoted=mergePrefab(migration,{[root.id+"/component-root"]:"proto"},plan.batch);
  assert.deepEqual((promoted.batch.prefab._$child as Record<string,unknown>[]).map(child=>child._$id),[label.id]);
  assert.deepEqual(inspectPrefab(document,promoted.page,plan.batch.name,promoted.batch.prefab).comparison.changes,[]);
});

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
test("prefab sync diffs and merges every round-trippable inspector property in both directions",async()=>{
  const label={...makeNode("text","caption1",20,30),text:"登录",layout:{},widget:{leading:0}};
  const initial={...page([label]),layout:{layoutUnit:"absolute" as const}};
  const document=doc(initial),file="登录.lh",first=await planPrefabExport(document,initial,missing);
  const root=structuredClone(first.batch.prefab),native=(root._$child as Record<string,unknown>[])[0];
  native.fontSize=33;native.rotation=15;native.left=12;native.leading=3;native.name="captionLaya";native._$var=true;native.visible=false;
  root.width=420;root.height=620;root.left=10;
  const synced={...initial,prefabSync:initialPrefabBase(document,initial,file)};
  const review=inspectPrefab(document,synced,file,root);
  assert.deepEqual(new Set(review.comparison.changes.map(change=>change.key)),new Set([
    "page/property/page.width","page/property/page.height","page/property/layout.left",
    "caption1/property/style.fontSize","caption1/property/transform.rotation","caption1/property/layout.left",
    "caption1/property/widget.leading","caption1/property/variableName","caption1/property/hidden"
  ]));
  const pull=Object.fromEntries(review.comparison.changes.map(change=>[change.key,"psd"] as const));
  const imported=mergePrefab(review,pull,first.batch);
  const importedLabel=imported.page.nodes[0];
  assert.equal(imported.page.frame.width,420);assert.equal(imported.page.frame.height,620);assert.equal(imported.page.layout?.left,10);
  assert.equal(importedLabel.style?.fontSize,33);assert.equal(importedLabel.transform?.rotation,15);assert.equal(importedLabel.layout?.left,12);
  assert.equal(importedLabel.widget?.leading,3);assert.equal(importedLabel.variableName,"captionLaya");assert.equal(importedLabel.hidden,true);
  assert.deepEqual(inspectPrefab(document,imported.page,file,imported.batch.prefab).comparison.changes,[]);

  const changed={...imported.page,frame:{...imported.page.frame,width:430},nodes:imported.page.nodes.map(node=>node.id==="caption1"?{
    ...node,style:{...node.style,fontSize:44},transform:{...node.transform,rotation:25},layout:{...node.layout,left:20},widget:{...node.widget,leading:5},variableName:"captionProto",hidden:false
  }:node)};
  const nextPlan=await planPrefabExport(document,changed,missing),pushReview=inspectPrefab(document,changed,file,imported.batch.prefab);
  const expected=["page/property/page.width","caption1/property/style.fontSize","caption1/property/transform.rotation","caption1/property/layout.left","caption1/property/widget.leading","caption1/property/variableName","caption1/property/hidden"];
  assert.deepEqual(new Set(pushReview.comparison.changes.map(change=>change.key)),new Set(expected));
  const push=Object.fromEntries(pushReview.comparison.changes.map(change=>[change.key,"proto"] as const));
  const exported=mergePrefab(pushReview,push,nextPlan.batch),output=(exported.batch.prefab._$child as Record<string,unknown>[])[0];
  assert.equal(exported.batch.prefab.width,430);assert.equal(output.fontSize,44);assert.equal(output.rotation,25);assert.equal(output.left,20);assert.equal(output.leading,5);
  assert.equal(output.name,"captionProto");assert.equal(output._$var,true);assert.equal(output.visible,true);
  assert.deepEqual(inspectPrefab(document,exported.page,file,exported.batch.prefab).comparison.changes,[]);
});
test("prefab sync uses Laya wordWrap default while export preserves the prototype default",async()=>{
  const explicit={...makeNode("text","caption1",0,0),widget:{wordWrap:false}};
  const original=page([explicit]),document=doc(original),file="登录.lh";
  const {batch}=await planPrefabExport(document,original,missing),native=(batch.prefab._$child as Record<string,unknown>[])[0];
  assert.equal(native.wordWrap,false);
  delete native.wordWrap;
  const synced={...original,prefabSync:initialPrefabBase(document,original,file)};
  assert.equal(inspectPrefab(document,synced,file,batch.prefab).comparison.changes.some(change=>change.property==="widget.wordWrap"),false);

  const implicit=page([{...makeNode("text","caption2",0,0),widget:undefined}]);
  const exported=await planPrefabExport(doc(implicit),implicit,missing);
  assert.equal((exported.batch.prefab._$child as Record<string,unknown>[])[0].wordWrap,true);
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
test("default placeholder uses one shared nine-grid resource and preserves configured art",async()=>{
  const large={...makeNode("image","large",0,0),frame:{x:0,y:0,width:20,height:20},layout:{left:0,right:0,top:0,bottom:0},image:{builtin:"image/default"}};
  const wide={...makeNode("image","wide",0,0),frame:{x:0,y:0,width:200,height:40},image:{builtin:"image/default"}};
  const art={...makeNode("image","art",0,0),image:{builtin:"image/default",art:{path:"unclassified/art.png"}}};
  const p=page([large,wide,{...wide,id:"repeat"},art]),d=doc(p);
  const plan=await planPrefabExport(d,p,missing);
  assert.equal(plan.batch.images.length,1);assert.equal(plan.missing.length,1);assert.equal(plan.missing[0].path,"unclassified/art.png");
  const image=plan.batch.images[0];assert.equal(image.path,"builtin/image/default.png");assert.deepEqual(image.description.nineGrid,{top:36,right:0,bottom:0,left:40,repeat:false});
  const nodes=plan.batch.prefab._$child as Record<string,unknown>[];
  assert.equal(nodes[0].skin,resourceUrl(image.path));assert.equal(nodes[1].skin,nodes[2].skin);assert.equal(nodes[3].skin,"unclassified/art.png");
  assert.deepEqual(imageSlotRequest(large.image,"prefab"),{kind:"resource",ref:{path:image.path}});
  assert.equal(builtinPath("button/gray"),"builtin/button/gray.png");
  const resources=memoryDirectory(),prefabs=memoryDirectory();
  await exportPrefabToDirectories(resources.io,prefabs.io,plan.batch,codec);
  const meta=JSON.parse(new TextDecoder().decode(resources.files.get(image.path+".meta")));
  assert.deepEqual(meta.importer.sizeGrid,[36,0,0,40,0]);
});
test("prefab review migrates a verified size-specific default and keeps custom engine skins",async()=>{
  const p=page([makeNode("image","legacy",0,0),makeNode("image","custom",0,0)]);
  const document=doc(p),{batch}=await planPrefabExport(document,p,missing);
  const resources=memoryDirectory(),prefabs=memoryDirectory();
  const oldPath="builtin/image/default_64x64.png", oldUrl=resourceUrl(oldPath);
  const image=batch.images[0], bytes=codec.decode(image.base64);
  const entry={...image.description,nineGrid:null,name:"default_64x64",file:oldPath,sha256:await hash(bytes)};
  resources.files.set("image-files.meta.json",Buffer.from(JSON.stringify({schema:"gameflow.resources",version:2,resources:[entry]})));
  resources.files.set(oldPath,bytes);
  resources.files.set(oldPath+".meta",Buffer.from(JSON.stringify({uuid:resourceUuid(oldPath)})));
  const root=structuredClone(batch.prefab), nodes=root._$child as Record<string,unknown>[];
  nodes[0].skin=oldUrl;
  nodes[1].skin="res://custom-engine-skin";
  prefabs.files.set(batch.name,Buffer.from(JSON.stringify(root)));
  const review=async()=>{
    const snapshot=await readPrefabSnapshot(prefabs.io,batch,hash,resources.io,[image.description]);
    return mergePrefab(inspectPrefab(document,p,batch.name,snapshot.prefab!,snapshot.metadata),{},batch);
  };
  const merged=await review(), output=merged.batch.prefab._$child as Record<string,unknown>[];
  assert.equal(output[0].skin,resourceUrl(image.path));
  assert.equal(output[1].skin,nodes[1].skin);
  assert.deepEqual(merged.batch.images.map(item=>item.path),[image.path]);
  resources.files.set(oldPath,Buffer.from("engine-edited pixels"));
  const edited=(await review()).batch.prefab._$child as Record<string,unknown>[];
  assert.equal(edited[0].skin,oldUrl);
});
test("default progress skin uses the shared resource before value clipping",async()=>{
  const p=page(makeComponent("progress","progress",0,0,id)),root=p.nodes[0];
  root.frame={x:0,y:0,width:200,height:20};root.widget={...root.widget,min:0,max:1,value:.25};
  const skin=p.nodes.find(n=>n.id===root.widget!.skinNodeId)!;skin.image={builtin:"image/default"};
  const plan=await planPrefabExport(doc(p),p,missing);
  assert.equal(resolvePageLayout(p).nodes.get(skin.id)!.local.width,50);
  assert.deepEqual(plan.batch.images.filter(image=>image.path.startsWith("builtin/image/default")).map(image=>image.path),["builtin/image/default.png"]);
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
  const guard={hash:await hash(prefabs.files.get("登录.lh")!),writePrefab:true,added:["button"]};
  await assert.rejects(exportPrefabToDirectories(resources.io,prefabs.io,plan.batch,codec,guard),/已恢复/);assert.equal(resources.files.size,0);assert.equal(new TextDecoder().decode(prefabs.files.get("登录.lh")),"original");
  assert.equal(prefabs.files.has("登录.lh.meta"),false);
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
test("metadata-only prefab merge updates existing grids, keeps importer UUIDs and reaches zero differences",async()=>{
  const button=makeNode("button","button01",0,0);
  button.selectedSkin=button.normalSkin;
  const p=page([button]),document=doc(p),{batch}=await planPrefabExport(document,p,missing);
  batch.directory="ui/login";
  const target=batch.directory+"/"+batch.name,image=batch.images[0];
  const resources=memoryDirectory(),prefabs=memoryDirectory();
  const uuid="12345678-1234-4567-890a-123456789abc", prefabUuid="21da2d60-3384-497a-9b11-6ec45a0a7777";
  const json=(value:unknown)=>Buffer.from(JSON.stringify(value));
  const parse=(bytes:Uint8Array|undefined)=>JSON.parse(new TextDecoder().decode(bytes));
  resources.files.set(image.path+".meta",json({uuid,importer:{filterMode:1}}));
  prefabs.files.set(target+".meta",json({uuid:prefabUuid,custom:123}));
  await exportPrefabToDirectories(resources.io,prefabs.io,batch,codec);
  const root=parse(prefabs.files.get(target));
  root._$child[0].selectedSkin="res://engine-owned";
  root._$child[0]._$comp=[{_$type:"Custom",options:{a:1}}];
  prefabs.files.set(target,json(root));
  const originalPrefab=prefabs.files.get(target), originalPng=resources.files.get(image.path);
  image.description.nineGrid={top:1,right:2,bottom:3,left:4,repeat:true};
  const synced={...p,prefabSync:initialPrefabBase(document,p,target)};
  const compare=async()=>{
    const snapshot=await readPrefabSnapshot(prefabs.io,batch,hash,resources.io,[image.description]);
    const review=inspectPrefab(document,synced,target,snapshot.prefab!,snapshot.metadata);
    assert.deepEqual(review.comparison.changes,[]);
    return {snapshot,merge:mergePrefab(review,{},batch)};
  };
  const {snapshot,merge}=await compare();
  assert.equal(merge.changed,false);
  assert.equal(merge.batch.images.length,1);
  const guard={hash:snapshot.hash,writePrefab:merge.changed,added:merge.added};
  const oldFiles=new Map(resources.files);
  await assert.rejects(exportPrefabToDirectories(resources.io,prefabs.io,merge.batch,codec,guard,async()=>{throw new Error("retry");}),/已恢复/);
  assert.deepEqual(resources.files,oldFiles);
  await exportPrefabToDirectories(resources.io,prefabs.io,merge.batch,codec,guard);
  assert.deepEqual(parse(resources.files.get(image.path+".meta")),{uuid,importer:{filterMode:1,textureType:2,sizeGrid:[1,2,3,4,1]}});
  assert.deepEqual(parse(resources.files.get("image-files.meta.json")).resources[0].nineGrid,image.description.nineGrid);
  assert.equal(resources.files.get(image.path),originalPng);
  assert.equal(prefabs.files.get(target),originalPrefab);
  assert.deepEqual(parse(prefabs.files.get(target+".meta")),{uuid:prefabUuid,custom:123});
  assert.equal((await compare()).merge.batch.images.length,0);
  resources.files.delete(image.path);
  const repair=await compare();
  assert.equal(repair.merge.batch.images.length,1);
  await exportPrefabToDirectories(resources.io,prefabs.io,repair.merge.batch,codec,guard);
  assert.deepEqual(resources.files.get(image.path),originalPng);
});
test("one-step reexport merges identified prefab nodes and creates a missing prefab UUID",async()=>{
  const p=page([makeNode("text","caption1",0,0)]),document=doc(p),{batch}=await planPrefabExport(document,p,missing);
  const prefabs=memoryDirectory(), resources=memoryDirectory();
  const root=structuredClone(batch.prefab), children=root._$child as Record<string,unknown>[];
  children[0]._$comp=[{_$type:"DebounceClick",interval:500}];
  const added={_$id:"fx",_$type:"Particle2D",value:2};
  children.push(added);
  prefabs.files.set(batch.name,Buffer.from(JSON.stringify(root)));
  prefabs.files.set(batch.name+".meta",Buffer.from('{"editor":{"keep":true}}'));
  (batch.prefab._$child as Record<string,unknown>[])[0].text="更新";
  await exportPrefabToDirectories(resources.io,prefabs.io,batch,codec);
  const saved=JSON.parse(new TextDecoder().decode(prefabs.files.get(batch.name)));
  assert.deepEqual(saved._$child[0]._$comp,children[0]._$comp);
  assert.equal(saved._$child[0].text,"更新");
  assert.deepEqual(saved._$child[1],added);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(prefabs.files.get(batch.name+".meta"))),{uuid:resourceUuid(batch.name),editor:{keep:true}});
});
test("progress exports its mode range and explicit image skin reference at all endpoint ratios",async()=>{
  const p=page(makeComponent("progress","progress",0,0,id)),root=p.nodes[0];root.frame={x:0,y:0,width:160,height:80};
  for(const mode of ["horizontal","circular"] as const)for(const value of [10,60,110]){root.widget={...root.widget,mode,min:10,max:110,value};const width=resolvePageLayout(p).nodes.get(root.widget.skinNodeId!)!.local.width;assert.equal(width,mode==="circular"?160:160*(value-10)/100);const plan=await planPrefabExport(doc(p),p,missing),native=(plan.batch.prefab._$child as Record<string,unknown>[])[0];assert.equal(native.mode,mode);assert.deepEqual(native.skin,{"_$ref":root.widget.skinNodeId});assert.equal(native.min,10);assert.equal(native.max,110);assert.equal(native.value,value);}
});
test("export batch rejects cyclic data and corrupt pixels before any writes",async()=>{
  const d=doc(page([makeNode("button","button",0,0)])),plan=await planPrefabExport(d,d.pages[0],missing),resources=memoryDirectory(),prefabs=memoryDirectory();
  const circular:Record<string,unknown>={};circular.self=circular;assert.equal(isPrefabExportBatch({...plan.batch,prefab:circular}),false);
  plan.batch.images[0].base64=Buffer.alloc(40).toString("base64");await assert.rejects(exportPrefabToDirectories(resources.io,prefabs.io,plan.batch,codec),/PNG/);assert.equal(resources.files.size,0);assert.equal(prefabs.files.size,0);
  assert.equal(prefabFileName({...d.pages[0],exportName:"CON"}),"_CON.lh");assert.equal(prefabFileName({...d.pages[0],exportName:"..."}),"page.lh");
});

test("art-only optional button states retain prototype normal without pulling in art pixels",()=>{
  const button=makeNode("button","button",0,0);button.selectedSkin={art:{path:"unclassified/selected.png"}};button.widget={selected:true};
  assert.equal(nodeImageSlot(button,"prototype"),button.normalSkin);assert.equal(nodeImageSlot(button,"art"),button.selectedSkin);assert.equal(nodeImageSlot(button,"prefab"),button.selectedSkin);
  assert.equal(imageSlotRequest({art:{path:"unclassified/normal.png"}},"prototype").kind,"empty");
});
