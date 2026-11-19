import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composeCanvasPage, editCanvasPage, revertCanvasProperties, revertCanvasSelections, planCanvasApply, copyCanvasSelection, changeCanvasAddition, extractCanvasSelection } from "../shared/canvas-instances";
import { parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument, type GameFlowDocument, type GameFlowNode } from "../shared/model";
import { ROOT_TARGET, ownedCanvasNodes } from "../shared/canvas-instance-data";
import { removeSelection, moveSelection } from "../shared/selection-ops";
import { pasteNode } from "../shared/node-clipboard";
import { migrateDocumentElementIds } from "../shared/document-id-migration";
import { duplicatePage } from "../shared/editor-ops";
import { reserveDocumentElementIds } from "../shared/element-id";
import type { CanvasSources } from "../shared/canvas-references";
import { isWebviewToHostMessage } from "../shared/protocol";

export const canvasInstanceTests: {name:string;run:()=>void}[]=[];
const test=(name:string,run:()=>void)=>canvasInstanceTests.push({name,run});
function fixture() {
  const document=parseGameFlowDocument(readFileSync("sample/canvas-reference-demo.gameflow.json","utf8"));
  const source=parseGameFlowDocument(readFileSync("sample/shared-components.gameflow.json","utf8"));
  const sources:CanvasSources={"shared-components.gameflow.json":{source:"shared-components.gameflow.json",document:source}};
  return {document,source,sources,pageId:document.pages[0].id};
}
function textId(document:GameFlowDocument,sources:CanvasSources,owner="demoref1") {
  const c=composeCanvasPage(document,document.pages[0],sources);
  return [...c.info].find(([id,meta])=>meta.ownerId===owner&&meta.target.path.at(-1)?.nodeId==="cardtext")![0];
}
function change(document:GameFlowDocument,sources:CanvasSources,id:string,patch:Partial<GameFlowNode>) {
  return editCanvasPage(document,document.pages[0].id,sources,page=>({...page,nodes:page.nodes.map(node=>node.id===id?{...node,...patch}:node)}));
}
const owner=(document:GameFlowDocument,id="demoref1")=>document.pages[0].nodes.find(node=>node.id===id)!;

test("instance composition uses stable scoped identities and retains source purity",()=>{
  const f=fixture(),before=serializeGameFlowDocument(f.document),c=composeCanvasPage(f.document,f.document.pages[0],f.sources);
  assert.equal(c.errors.size,0);assert.ok(c.page.nodes.length>f.document.pages[0].nodes.length);
  assert.notEqual(textId(f.document,f.sources),textId(f.document,f.sources,"demoref2"));
  f.source.pages[0].nodes.find(node=>node.id==="cardtext")!.name="改名";
  assert.equal(textId(f.document,f.sources),textId(f.document,f.sources));assert.equal(serializeGameFlowDocument(f.document),before);
});
test("local text overrides affect one instance and survive save while unmodified style follows source",()=>{
  const f=fixture(),id=textId(f.document,f.sources),next=change(f.document,f.sources,id,{text:"A 的文案"});
  const saved=parseGameFlowDocument(serializeGameFlowDocument(next));
  assert.equal(saved.schemaVersion,5);assert.equal(saved.pages[0].nodes.length,f.document.pages[0].nodes.length);
  assert.equal(owner(saved).instanceEdits!.overrides[0].set.text,"A 的文案");
  f.source.pages[0].nodes.find(node=>node.id==="cardtext")!.text="新版源";f.source.pages[0].nodes.find(node=>node.id==="cardtext")!.style!.color="#112233";
  const c=composeCanvasPage(saved,saved.pages[0],f.sources);
  assert.equal(c.page.nodes.find(node=>node.id===id)!.text,"A 的文案");
  assert.equal(c.page.nodes.find(node=>node.id===textId(saved,f.sources,"demoref2"))!.text,"新版源");
  assert.equal(c.page.nodes.find(node=>node.id===id)!.style!.color,"#112233");
  assert.equal(f.source.pages[0].nodes.find(node=>node.id==="cardtext")!.text,"新版源");
});
test("root source appearance becomes an override while native placement remains on instance",()=>{
  const f=fixture(),c=composeCanvasPage(f.document,f.document.pages[0],f.sources),root=c.page.nodes.find(n=>n.id==="demoref1")!;
  const next=change(f.document,f.sources,root.id,{style:{...root.style,fill:"#aabbcc"},frame:{...root.frame,x:90}});
  assert.equal(owner(next).frame.x,90);assert.deepEqual(owner(next).style,undefined);
  assert.equal(owner(next).instanceEdits!.overrides[0].set["style.fill"],"#aabbcc");
});
test("explicit zero false null and unset remain distinct from inheritance and reset",()=>{
  const f=fixture(),id=textId(f.document,f.sources),c=composeCanvasPage(f.document,f.document.pages[0],f.sources),node=c.page.nodes.find(n=>n.id===id)!;
  let next=change(f.document,f.sources,id,{text:"",hidden:false,style:{...node.style,opacity:0},layout:{...node.layout,left:null}});
  next=change(next,f.sources,id,{text:undefined});
  const patch=owner(next).instanceEdits!.overrides[0];assert.ok(patch.unset.includes("text"));assert.equal(patch.set["style.opacity"],0);assert.equal(patch.set["layout.left"],null);
  const reset=revertCanvasProperties(next,"demoref1",patch.target,["text"]);
  assert.equal(composeCanvasPage(reset,reset.pages[0],f.sources).page.nodes.find(n=>n.id===id)!.text,f.source.pages[0].nodes.find(node=>node.id==="cardtext")!.text);
});
test("local additions persist complete nodes, stable parents and independent children",()=>{
  const f=fixture();let next=editCanvasPage(f.document,f.pageId,f.sources,page=>({...page,nodes:[...page.nodes,{id:"newbox01",name:"关闭按钮",type:"button",frame:{x:1,y:2,width:40,height:20},parentId:"demoref1"},{id:"newtext1",name:"文字",type:"text",text:"关闭",frame:{x:0,y:0,width:40,height:20},parentId:"newbox01"}]}));
  assert.equal(owner(next).instanceEdits!.additions.length,2);assert.equal(owner(next).instanceEdits!.additions[0].node.parentId,undefined);
  next=parseGameFlowDocument(serializeGameFlowDocument(next));const c=composeCanvasPage(next,next.pages[0],f.sources);
  assert.equal(c.page.nodes.find(n=>n.id==="newtext1")!.parentId,"newbox01");assert.equal(c.info.get("newbox01")!.inherited,false);
  const reset=revertCanvasProperties(next,"demoref1");assert.equal(owner(reset).instanceEdits!.additions.length,2);
  next=editCanvasPage(next,f.pageId,f.sources,page=>removeSelection(page,["newbox01"]));assert.equal(owner(next).instanceEdits!.additions.length,0);
});
test("delete mixed selection, convert and reparent cannot bypass inherited structure protection",()=>{
  const f=fixture(),id=textId(f.document,f.sources);
  assert.throws(()=>editCanvasPage(f.document,f.pageId,f.sources,page=>removeSelection(page,[id])),/不能.*删除/);
  assert.throws(()=>change(f.document,f.sources,id,{type:"image"}),/受保护/);
  assert.throws(()=>editCanvasPage(f.document,f.pageId,f.sources,page=>moveSelection(page,[id],{position:"inside"})),/受保护/);
  assert.throws(()=>editCanvasPage(f.document,f.pageId,f.sources,page=>removeSelection(page,[id,"demoref2"])),/不能.*删除/);
  const next=editCanvasPage(f.document,f.pageId,f.sources,page=>removeSelection(page,["demoref1"]));assert.ok(!owner(next));
});
test("source deletion preserves overrides and attachment subtrees for repair",()=>{
  const f=fixture();f.source.pages[0].nodes.push({id:"srcbox01",name:"源容器",type:"container",parentId:"cardroot",frame:{x:0,y:0,width:20,height:20}});
  const c=composeCanvasPage(f.document,f.document.pages[0],f.sources),parent=[...c.info].find(([,m])=>m.ownerId==="demoref1"&&m.target.path.at(-1)?.nodeId==="srcbox01")![0];
  let next=editCanvasPage(f.document,f.pageId,f.sources,page=>({...page,nodes:[...page.nodes,{id:"orphan01",name:"本地内容",type:"text",text:"保留",parentId:parent,frame:{x:0,y:0,width:10,height:10}}]}));
  f.source.pages[0].nodes=f.source.pages[0].nodes.filter(n=>n.id!=="srcbox01");
  const broken=composeCanvasPage(next,next.pages[0],f.sources);assert.equal(broken.page.nodes.some(n=>n.id==="orphan01"),false);assert.ok(broken.orphans.some(o=>o.additionId==="orphan01"));
  next=changeCanvasAddition(next,"demoref1","orphan01",ROOT_TARGET);assert.equal(composeCanvasPage(next,next.pages[0],f.sources).page.nodes.find(n=>n.id==="orphan01")!.parentId,"demoref1");
});
test("applying selected properties updates source, cleans only those overrides and preserves other instances",()=>{
  const f=fixture(),id=textId(f.document,f.sources);let next=change(f.document,f.sources,id,{text:"全局新文案",style:{color:"#123456"}});
  const b=textId(next,f.sources,"demoref2");next=change(next,f.sources,b,{text:"B 独立"});
  const target=owner(next).instanceEdits!.overrides[0].target,plan=planCanvasApply(next,f.sources,{pageId:f.pageId,ownerId:"demoref1",target,fields:["text"]});
  assert.equal(plan.sourceDocument.pages[0].nodes.find(node=>node.id==="cardtext")!.text,"全局新文案");assert.equal(plan.sourceDocument.pages[0].nodes.find(node=>node.id==="cardtext")!.style!.color,f.source.pages[0].nodes.find(node=>node.id==="cardtext")!.style!.color);
  assert.equal(owner(plan.document).instanceEdits!.overrides[0].set.text,undefined);assert.equal(owner(plan.document).instanceEdits!.overrides[0].set["style.color"],"#123456");
  assert.equal(owner(plan.document,"demoref2").instanceEdits!.overrides[0].set.text,"B 独立");
});

test("multi-node property choices apply atomically and retain every unselected field and addition",()=>{
  const f=fixture(),id=textId(f.document,f.sources),before=serializeGameFlowDocument(f.document),sourceBefore=serializeGameFlowDocument(f.source);
  const c=composeCanvasPage(f.document,f.document.pages[0],f.sources),text=c.page.nodes.find(n=>n.id===id)!,root=c.page.nodes.find(n=>n.id==="demoref1")!;
  let next=change(f.document,f.sources,id,{text:"只应用文案",style:{...text.style,color:"#123456"}});
  next=change(next,f.sources,"demoref1",{style:{...root.style,fill:"#112233",borderColor:"#445566"}});
  next=editCanvasPage(next,f.pageId,f.sources,page=>({...page,nodes:[...page.nodes,{id:"local001",name:"本地按钮",type:"button",parentId:"demoref1",frame:{x:0,y:0,width:20,height:20}}]}));
  const patches=owner(next).instanceEdits!.overrides,selections=patches.map(patch=>({target:patch.target,fields:[patch.target.path.length ? "text" : "style.fill"]}));
  const plan=planCanvasApply(next,f.sources,{pageId:f.pageId,ownerId:"demoref1",selections});
  assert.equal(plan.sourceDocument.pages[0].nodes.find(node=>node.id==="cardtext")!.text,"只应用文案");assert.equal(plan.sourceDocument.pages[0].nodes[0].style!.fill,"#112233");
  assert.equal(plan.sourceDocument.pages[0].nodes.find(node=>node.id==="cardtext")!.style!.color,f.source.pages[0].nodes.find(node=>node.id==="cardtext")!.style!.color);
  assert.equal(owner(plan.document).instanceEdits!.overrides.length,2);
  assert.equal(owner(plan.document).instanceEdits!.overrides.find(p=>p.target.path.length)!.set["style.color"],"#123456");
  assert.equal(owner(plan.document).instanceEdits!.overrides.find(p=>!p.target.path.length)!.set["style.borderColor"],"#445566");
  assert.equal(owner(plan.document).instanceEdits!.additions.length,1);
  assert.equal(serializeGameFlowDocument(f.document),before);assert.equal(serializeGameFlowDocument(f.source),sourceBefore);
  const reverted=revertCanvasSelections(next,"demoref1",selections);
  assert.deepEqual(owner(reverted).instanceEdits,owner(plan.document).instanceEdits);
});

test("empty duplicate mixed and stale property selections never expand into apply-all",()=>{
  const f=fixture(),next=change(f.document,f.sources,textId(f.document,f.sources),{text:"修改"});
  const target=owner(next).instanceEdits!.overrides[0].target,selection={target,fields:["text"]},request={pageId:f.pageId,ownerId:"demoref1",selections:[selection]};
  const message={type:"applyCanvasOverrides",requestId:"selection",baseVersion:1,request,expectedSources:{}};
  assert.equal(isWebviewToHostMessage(message),true);
  for(const selections of [[],[selection,selection],[{target,fields:[]}],[{target,fields:["text","text"]}],[{target,fields:["id"]}]]){
    assert.equal(isWebviewToHostMessage({...message,request:{...request,selections}}),false);
    assert.throws(()=>planCanvasApply(next,f.sources,{...request,selections}),/请选择/);
  }
  assert.equal(isWebviewToHostMessage({...message,request:{...request,fields:["text"]}}),false);
  const before=serializeGameFlowDocument(next),stale=[selection,{target:ROOT_TARGET,fields:["style.fill"]}];
  assert.throws(()=>planCanvasApply(next,f.sources,{...request,selections:stale}),/已变化/);
  assert.throws(()=>revertCanvasSelections(next,"demoref1",stale),/已变化/);
  assert.equal(serializeGameFlowDocument(next),before);
});

test("selected unset cleanup in a same-file candidate preserves other overrides",()=>{
  const f=fixture();f.document.pages.push(f.source.pages[0]);for(const node of f.document.pages[0].nodes)if(node.prefab)node.prefab={source:"",documentId:f.document.documentId,pageId:f.source.pages[0].id};
  let next=change(f.document,{},textId(f.document,{}),{text:undefined,hidden:true});
  const patch=owner(next).instanceEdits!.overrides[0];assert.ok(patch.unset.includes("text"));
  const plan=planCanvasApply(next,{}, {pageId:f.pageId,ownerId:"demoref1",selections:[{target:patch.target,fields:["text"]}]});
  assert.equal(plan.document.pages[1].nodes.find(node=>node.id==="cardtext")!.text,undefined);assert.equal(owner(plan.document).instanceEdits!.overrides[0].set.hidden,true);
  assert.equal(owner(plan.document).instanceEdits!.overrides[0].unset.length,0);
});
test("same-file apply is one candidate containing source changes and override cleanup",()=>{
  const f=fixture();f.document.pages.push(f.source.pages[0]);for(const node of f.document.pages[0].nodes)if(node.prefab)node.prefab={source:"",documentId:f.document.documentId,pageId:f.source.pages[0].id};
  const next=change(f.document,{},textId(f.document,{}),{text:"同文件",style:{color:"#123456"}});
  const plan=planCanvasApply(next,{}, {pageId:f.pageId,ownerId:"demoref1"});
  assert.equal(plan.source,"");assert.equal(plan.document.pages[1].nodes.find(node=>node.id==="cardtext")!.text,"同文件");assert.equal(plan.document.pages[1].nodes.find(node=>node.id==="cardtext")!.style!.color,"#123456");assert.equal(owner(plan.document).instanceEdits!.overrides.length,0);
});
test("copying whole instances preserves linkage and remaps every owned addition",()=>{
  const f=fixture();const next=editCanvasPage(f.document,f.pageId,f.sources,page=>({...page,nodes:[...page.nodes,{id:"addition",name:"附加",type:"text",parentId:"demoref1",frame:{x:0,y:0,width:10,height:10}}]}));
  const c=composeCanvasPage(next,next.pages[0],f.sources),clipboard=copyCanvasSelection(next,c,["demoref1"])!;assert.equal(clipboard.nodes.length,1);assert.ok(clipboard.nodes[0].prefab);
  let serial=0;const pasted=pasteNode(c.page,clipboard,()=>`clone${++serial}`);
  const saved=editCanvasPage(next,f.pageId,f.sources,()=>pasted.page);const newRoot=saved.pages[0].nodes.find(n=>n.id===pasted.id)!;
  assert.equal(newRoot.prefab!.pageId,owner(next).prefab!.pageId);assert.notEqual(newRoot.instanceEdits!.additions[0].node.id,"addition");
  const reserved=new Set<string>();reserveDocumentElementIds(saved,reserved);assert.ok(reserved.has(newRoot.instanceEdits!.additions[0].node.id));
});
test("ordinary inherited subtree copies become local snapshots",()=>{
  const f=fixture(),c=composeCanvasPage(f.document,f.document.pages[0],f.sources),clipboard=copyCanvasSelection(f.document,c,[textId(f.document,f.sources)])!;
  assert.equal(clipboard.nodes.length,1);assert.equal(clipboard.nodes[0].prefab,undefined);assert.equal(clipboard.nodes[0].text,f.source.pages[0].nodes.find(node=>node.id==="cardtext")!.text);
});
test("invalid edit addresses, identity overrides, duplicate local IDs and v4 edits fail validation",()=>{
  const f=fixture(),id=textId(f.document,f.sources),next=change(f.document,f.sources,id,{text:"局部"});
  const invalid=structuredClone(next);owner(invalid).instanceEdits!.overrides[0].set.id="bad";assert.equal(validateGameFlowDocument(invalid).ok,false);
  const older=structuredClone(next);older.schemaVersion=4;assert.equal(validateGameFlowDocument(older).ok,false);
  const dup=structuredClone(next);owner(dup).instanceEdits!.additions.push({node:{id:"demoref2",name:"重号",type:"text",frame:{x:0,y:0,width:10,height:10}},parent:ROOT_TARGET});assert.equal(validateGameFlowDocument(dup).ok,false);
  assert.equal(ownedCanvasNodes(dup.pages[0].nodes).filter(n=>n.id==="demoref2").length,2);
});

test("serialized address key order never changes override identity",()=>{
  const f=fixture(), document=parseGameFlowDocument(readFileSync("sample/canvas-instance-demo.gameflow.json","utf8"));
  const c=composeCanvasPage(document,document.pages[0],f.sources);
  assert.equal(c.orphans.length,0);assert.equal(c.errors.size,0);
  assert.equal(c.page.nodes.find(node=>node.id===textId(document,f.sources))!.text,"A 的本地提示文案");
  const duplicate=structuredClone(document), patch=owner(duplicate).instanceEdits!.overrides[0];
  owner(duplicate).instanceEdits!.overrides.push({...patch,target:{path:patch.target.path.map(p=>({nodeId:p.nodeId,kind:p.kind,pageId:p.pageId,documentId:p.documentId}))}});
  assert.equal(validateGameFlowDocument(duplicate).ok,false);
});
test("bindings resolve new local parts before applying inherited overrides and reject promotion of local-only targets",()=>{
  const f=fixture();f.source.pages[0].nodes.push({id:"sourceck",name:"勾选",type:"checkbox",parentId:"cardroot",frame:{x:0,y:0,width:40,height:20}});
  const c=composeCanvasPage(f.document,f.document.pages[0],f.sources), check=[...c.info].find(([,m])=>m.ownerId==="demoref1"&&m.target.path.at(-1)?.nodeId==="sourceck")![0];
  const next=editCanvasPage(f.document,f.pageId,f.sources,page=>({...page,nodes:[...page.nodes.map(node=>node.id===check?{...node,widget:{skinNodeId:"localmrk",selected:true}}:node),{id:"localmrk",name:"本地标记",type:"rectangle",parentId:check,frame:{x:0,y:0,width:10,height:10}}]}));
  const result=composeCanvasPage(next,next.pages[0],f.sources);assert.equal(result.errors.size,0);assert.equal(result.page.nodes.find(n=>n.id===check)!.widget!.skinNodeId,"localmrk");
  assert.throws(()=>planCanvasApply(next,f.sources,{pageId:f.pageId,ownerId:"demoref1",fields:["widget.skinNodeId"]}),/附加节点/);
  const removed=editCanvasPage(next,f.pageId,f.sources,page=>removeSelection(page,["localmrk"]));
  assert.equal(composeCanvasPage(removed,removed.pages[0],f.sources).page.nodes.find(n=>n.id===check)!.widget!.skinNodeId,null);
});
test("new local controls keep nullable member slots and scoped references through save and copy",()=>{
  const f=fixture();const next=editCanvasPage(f.document,f.pageId,f.sources,page=>({...page,nodes:[...page.nodes,
    {id:"localgrp",name:"组",type:"radioGroup",parentId:"demoref1",frame:{x:0,y:0,width:20,height:20},widget:{optionNodeIds:[null,"localrad"],selectedIndex:1}},
    {id:"localrad",name:"选项",type:"radio",parentId:"demoref1",frame:{x:0,y:0,width:20,height:20}}
  ]}));
  const saved=parseGameFlowDocument(serializeGameFlowDocument(next));const c=composeCanvasPage(saved,saved.pages[0],f.sources);
  assert.equal(c.errors.size,0);assert.deepEqual(c.page.nodes.find(n=>n.id==="localgrp")!.widget!.optionNodeIds,[null,"localrad"]);
  assert.equal(owner(saved).instanceEdits!.additions.find(a=>a.node.id==="localgrp")!.node.widget!.optionNodeIds,undefined);
  assert.throws(()=>change(saved,f.sources,"localgrp",{widget:{optionNodeIds:[textId(saved,f.sources,"demoref2")],selectedIndex:0}}),/作用域|radio/);
});
test("source variables use instance scopes while local additions share their containing scope",()=>{
  const f=fixture();f.source.pages[0].nodes.find(node=>node.id==="cardtext")!.variableName="message";
  const c=composeCanvasPage(f.document,f.document.pages[0],f.sources);assert.equal(c.errors.size,0);
  assert.notEqual(c.info.get(textId(f.document,f.sources))!.scope,c.info.get(textId(f.document,f.sources,"demoref2"))!.scope);
  assert.throws(()=>editCanvasPage(f.document,f.pageId,f.sources,page=>({...page,nodes:[...page.nodes,{id:"varlocal",name:"冲突",type:"text",variableName:"message",parentId:"demoref1",frame:{x:0,y:0,width:10,height:10}}]})),/重名/);
});
test("page duplication and ID migration rekey all locally owned additions and preserve source identities",()=>{
  const f=fixture();const document=parseGameFlowDocument(readFileSync("sample/canvas-instance-demo.gameflow.json","utf8"));
  let serial=0;const copy=duplicatePage(document.pages[0],()=>`dupe${++serial}`);const merged={...document,pages:[...document.pages,copy]};
  assert.equal(validateGameFlowDocument(merged).ok,true);const c=composeCanvasPage(merged,copy,f.sources);assert.equal(c.errors.size,0);assert.equal(c.orphans.length,0);
  assert.ok(copy.nodes.find(n=>n.prefab)!.instanceEdits!.overrides[0].target.path.some(p=>p.nodeId==="cardtext"));
  delete document.elementIdScheme;
  const migrated=migrateDocumentElementIds(document,()=>`id${String(++serial).padStart(6,"0")}`);
  const cm=composeCanvasPage(migrated,migrated.pages[0],f.sources);assert.equal(cm.errors.size,0);assert.equal(cm.orphans.length,0);
  assert.ok(!ownedCanvasNodes(migrated.pages[0].nodes).some(n=>n.id==="closebtn"));
});
test("local UIBox extraction preserves an instance attachment and produces a reusable source",()=>{
  const f=fixture();let next=editCanvasPage(f.document,f.pageId,f.sources,page=>({...page,nodes:[...page.nodes,{id:"localbox",name:"本地容器",type:"container",parentId:"demoref1",frame:{x:4,y:5,width:80,height:40}},{id:"localtxt",name:"子文案",type:"text",text:"本地",parentId:"localbox",frame:{x:0,y:0,width:40,height:20}}]}));
  let serial=0;next=extractCanvasSelection(next,f.pageId,f.sources,"localbox",()=>`new${++serial}`);
  assert.equal(next.pages.length,2);assert.ok(owner(next).instanceEdits!.additions.find(a=>a.node.id==="localbox")!.node.prefab);
  const c=composeCanvasPage(next,next.pages[0],f.sources);assert.equal(c.errors.size,0);assert.ok(c.page.nodes.some(n=>n.text==="本地"));assert.equal(c.page.nodes.find(n=>n.id==="localbox")!.parentId,"demoref1");
});
test("attachments retain stable order and missing anchors without allowing repair cycles",()=>{
  const f=fixture();const next=editCanvasPage(f.document,f.pageId,f.sources,page=>({...page,nodes:[...page.nodes,{id:"localbox",name:"容器",type:"container",parentId:"demoref1",frame:{x:0,y:0,width:10,height:10}},{id:"localtxt",name:"子级",type:"text",parentId:"localbox",frame:{x:0,y:0,width:10,height:10}}]}));
  const target={path:[{documentId:next.documentId,pageId:f.pageId,kind:"addition" as const,nodeId:"localtxt"}]};
  assert.throws(()=>changeCanvasAddition(next,"demoref1","localbox",target),/自身或其子节点/);
});
test("new cyclic references and unknown unset fields cannot enter an editing transaction",()=>{
  const f=fixture();assert.throws(()=>editCanvasPage(f.document,f.pageId,f.sources,page=>({...page,nodes:[...page.nodes,{id:"cyclic01",name:"循环",type:"container",frame:{x:0,y:0,width:10,height:10},prefab:{source:"",documentId:f.document.documentId,pageId:f.pageId}}]})),/循环/);
  const next=change(f.document,f.sources,textId(f.document,f.sources),{text:"局部"});owner(next).instanceEdits!.overrides[0].unset.push("style.unknownField");assert.equal(validateGameFlowDocument(next).ok,false);
});

test("nested overrides apply to the direct definition layer and reset exposes inner values",()=>{
  const f=fixture(), inner=structuredClone(f.source.pages[0]);inner.nodes=inner.nodes.filter(node=>node.id==="cardroot"||node.id==="cardtext");inner.id="innerpg1";inner.componentRootId="innerbox";inner.nodes[0].id="innerbox";inner.nodes[1].id="innertxt";inner.nodes[1].parentId="innerbox";
  f.source.pages.push(inner);f.source.pages[0].nodes.push({id:"nested01",name:"嵌套",type:"container",parentId:"cardroot",frame:{x:0,y:0,width:100,height:40},prefab:{source:"",documentId:f.source.documentId,pageId:inner.id}});
  const c=composeCanvasPage(f.document,f.document.pages[0],f.sources), [id,meta]=[...c.info].find(([,m])=>m.ownerId==="demoref1"&&m.target.path.at(-1)?.nodeId==="innertxt")!;
  let next=change(f.document,f.sources,id,{text:"外层覆盖"});
  const plan=planCanvasApply(next,f.sources,{pageId:f.pageId,ownerId:"demoref1",target:meta.target});
  assert.equal(plan.sourceDocument.pages[1].nodes.find(node=>node.id==="innertxt")!.text,inner.nodes[1].text);
  assert.equal(plan.sourceDocument.pages[0].nodes.find(n=>n.id==="nested01")!.instanceEdits!.overrides[0].set.text,"外层覆盖");
  const updatedSources={...f.sources,"shared-components.gameflow.json":{source:"shared-components.gameflow.json",document:plan.sourceDocument}};
  const result=composeCanvasPage(plan.document,plan.document.pages[0],updatedSources);assert.equal(result.errors.size,0);assert.equal(result.page.nodes.find(n=>n.id===id)!.text,"外层覆盖");assert.equal(result.info.get(id)!.overrides.length,0);
  const copy=copyCanvasSelection(next,composeCanvasPage(next,next.pages[0],f.sources),[...c.info].filter(([,m])=>m.ownerId==="demoref1"&&m.reference&&m.inherited).map(([id])=>id))!;
  assert.equal(copy.nodes.length,1);assert.equal(copy.nodes[0].instanceEdits!.overrides[0].set.text,"外层覆盖");
});

test("moving an ordinary subtree into an instance creates owned additions and badges",()=>{
  const f=fixture();f.document.pages[0].nodes.push({id:"movebox1",name:"待移入",type:"container",frame:{x:0,y:0,width:50,height:50}},{id:"movetxt1",name:"子级",type:"text",parentId:"movebox1",frame:{x:0,y:0,width:10,height:10}});
  const next=editCanvasPage(f.document,f.pageId,f.sources,page=>moveSelection(page,["movebox1"],{targetId:"demoref1",position:"inside"}));
  assert.ok(!next.pages[0].nodes.some(n=>n.id==="movebox1"));assert.equal(owner(next).instanceEdits!.additions.length,2);
  const c=composeCanvasPage(next,next.pages[0],f.sources);assert.equal(c.errors.size,0);assert.equal(c.info.get("movebox1")!.added,true);assert.equal(c.info.get("movetxt1")!.added,true);assert.ok(!c.info.get(textId(next,f.sources))!.added);
});
test("added linked instances retain a plus badge at their boundary while source children remain inherited",()=>{
  const f=fixture();const linked={...owner(f.document),id:"localref",parentId:"demoref1",name:"本地引用"};
  const next=editCanvasPage(f.document,f.pageId,f.sources,page=>({...page,nodes:[...page.nodes,linked]}));
  const c=composeCanvasPage(next,next.pages[0],f.sources);assert.equal(c.info.get("localref")!.added,true);assert.ok(c.info.get("localref")!.reference);
  const inner=[...c.info].find(([,m])=>m.ownerId==="localref"&&m.inherited)![1];assert.ok(!inner.added);
});

test("inherited radio member overrides resolve nullable slots and preserve selection",()=>{
  const f=fixture();f.source.pages[0].nodes.push({id:"sourcegp",name:"组",type:"radioGroup",parentId:"cardroot",frame:{x:0,y:0,width:20,height:20}},{id:"sourcerd",name:"成员",type:"radio",parentId:"cardroot",frame:{x:0,y:0,width:20,height:20}});
  const c=composeCanvasPage(f.document,f.document.pages[0],f.sources),group=[...c.info].find(([,m])=>m.ownerId==="demoref1"&&m.target.path.at(-1)?.nodeId==="sourcegp")![0],radio=[...c.info].find(([,m])=>m.ownerId==="demoref1"&&m.target.path.at(-1)?.nodeId==="sourcerd")![0];
  const next=change(f.document,f.sources,group,{widget:{optionNodeIds:[null,radio],selectedIndex:1}});
  const result=composeCanvasPage(next,next.pages[0],f.sources);assert.equal(result.errors.size,0);assert.deepEqual(result.page.nodes.find(n=>n.id===group)!.widget!.optionNodeIds,[null,radio]);
  const plan=planCanvasApply(next,f.sources,{pageId:f.pageId,ownerId:"demoref1"});assert.deepEqual(plan.sourceDocument.pages[0].nodes.find(n=>n.id==="sourcegp")!.widget!.optionNodeIds,[null,"sourcerd"]);
});
test("source reparent keeps addresses while incompatible content overrides suspend without data loss",()=>{
  const f=fixture(),id=textId(f.document,f.sources),next=change(f.document,f.sources,id,{text:"保留覆盖"});
  f.source.pages[0].nodes.push({id:"newparent",name:"新父级",type:"container",parentId:"cardroot",frame:{x:0,y:0,width:50,height:50}});f.source.pages[0].nodes.find(node=>node.id==="cardtext")!.parentId="newparent";
  assert.equal(composeCanvasPage(next,next.pages[0],f.sources).page.nodes.find(n=>n.id===id)!.text,"保留覆盖");
  f.source.pages[0].nodes.find(node=>node.id==="cardtext")!.type="image";delete f.source.pages[0].nodes.find(node=>node.id==="cardtext")!.text;
  const changed=composeCanvasPage(next,next.pages[0],f.sources);assert.match(changed.errors.get("demoref1")!,/类型已变化/);assert.equal(changed.page.nodes.find(n=>n.id===id)!.text,undefined);assert.equal(owner(next).instanceEdits!.overrides[0].set.text,"保留覆盖");
});
