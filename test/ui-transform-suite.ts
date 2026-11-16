import assert from "node:assert/strict";
import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument, type Frame, type GameFlowNode, type GameFlowPage, type NodeTransform } from "../shared/model";
import { isWebviewToHostMessage, type WebviewToHostMessage } from "../shared/protocol";
import { duplicateNode, duplicatePage, moveNode, reparentNode } from "../shared/editor-ops";
import { resolvePageLayout } from "../shared/ui-layout";
import { changeContainerType, convertNodeType, editNodeFrame, nodeDragFrame, nodeResizeFrame, setNodeAnchor, setNodeConstraint } from "../shared/ui-edit";
import { copyNode, pasteNode } from "../shared/node-clipboard";
import { framePolygon, intersectPolygons, inverse, mapPoint, mapVector, multiply, nodeMatrix, polygonBounds, type Point } from "../shared/ui-transform";
import { DocumentSession } from "../webview/document-session";

export const uiTransformTests: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => uiTransformTests.push({ name, run });
const node = (id: string, patch: Partial<GameFlowNode> = {}): GameFlowNode => ({ id, type: "container", name: id, frame: { x: 10, y: 20, width: 50, height: 30 }, ...patch });
const page = (...nodes: GameFlowNode[]): GameFlowPage => ({ id: "p", kind: "screen", name: "page", frame: { x: 80, y: 90, width: 400, height: 600 }, nodes });
const doc = (p: GameFlowPage) => ({ ...createDefaultGameFlowDocument(), pages: [p], interactions: [] });
const near = (actual: number, expected: number, tolerance = 1e-8) => assert.ok(Math.abs(actual-expected) <= tolerance, `${actual} != ${expected}`);
const pointsNear = (actual: Point[], expected: Point[]) => { assert.equal(actual.length, expected.length); actual.forEach((p, i) => { near(p.x, expected[i].x); near(p.y, expected[i].y); }); };
const area = (points: Point[]) => Math.abs(points.reduce((sum, p, i) => sum+p.x*points[(i+1)%points.length].y-p.y*points[(i+1)%points.length].x, 0))/2;

const sameGeometry = (before: GameFlowPage, after: GameFlowPage) => {
  const old = resolvePageLayout(before), next = resolvePageLayout(after);
  for (const n of before.nodes) {
    pointsNear(next.nodes.get(n.id)!.corners,old.nodes.get(n.id)!.corners);
    near(next.nodes.get(n.id)!.local.width,old.nodes.get(n.id)!.local.width);
    near(next.nodes.get(n.id)!.local.height,old.nodes.get(n.id)!.local.height);
  }
};

test("anchor editing compensates free coordinates through rotation, skew, mirrored or singular scales and keeps descendants still", () => {
  for (const transform of [{}, {scaleX:1.25,scaleY:-2.3,rotation:37,skewX:12,skewY:-8}, {scaleX:0,scaleY:1.5,rotation:35}]) {
    const source = page(node("parent",{transform:{scaleX:2,scaleY:.7,rotation:17},layout:{scrollX:9,scrollY:13}}),
      node("n",{parentId:"parent",frame:{x:101.3,y:66.7,width:131.75,height:43.2},transform}),node("child",{parentId:"n"}));
    const frozen = structuredClone(source);
    let changed = setNodeAnchor(source,"n",{anchorX:.37,anchorY:.61});
    sameGeometry(source,changed); assert.deepEqual(source,frozen);
    assert.deepEqual(changed.nodes[1].transform,{...transform,anchorX:.37,anchorY:.61});
    for (let i=0;i<20;i++) { changed=setNodeAnchor(changed,"n",{anchorX:i%2,anchorY:i%2}); sameGeometry(source,changed); }
    assert.equal(changed.nodes[1].id,"n");
  }
  const simple=page(node("n",{frame:{x:100,y:80,width:140,height:90}}));
  const changed=setNodeAnchor(simple,"n",{anchorX:.5,anchorY:.5});
  assert.deepEqual(changed.nodes[0].frame,{x:170,y:125,width:140,height:90});
  assert.equal(changed.nodes[0].layout,undefined);
});

test("anchor edits retain fractional constrained geometry, padding, stretch and percent layout", () => {
  for (const layout of [{left:11,right:23,top:7,bottom:13}, {centerX:12.25,centerY:-8.75}, {right:8.25,bottom:13.75}, {left:7,right:11,centerY:37,layoutUnit:"percent" as const}]) {
    const source=page(node("parent",{frame:{x:30,y:40,width:413,height:237},layout:{paddingLeft:9.5,paddingRight:11,paddingTop:6,paddingBottom:7.25},transform:{rotation:22}}),
      node("n",{parentId:"parent",frame:{x:11,y:12,width:83.7,height:45.3},layout,transform:{scaleX:1.3,scaleY:.9,rotation:31,skewX:14}}),node("c",{parentId:"n"}));
    const changed=setNodeAnchor(source,"n",{anchorX:.43,anchorY:.29});
    sameGeometry(source,changed);
    assert.equal(resolvePageLayout(changed).issues.length,0);
    for (const key of ["left","right","centerX","top","bottom","centerY"] as const) assert.equal(changed.nodes[1].layout?.[key],source.nodes[1].layout?.[key]);
  }
});

test("anchor edits keep automatic flow children, siblings and measured parents in place", () => {
  for (const type of ["hbox","vbox","grid"] as const) {
    const source=page(node("flow",{type,layout:{widthMode:"measured",heightMode:"measured",gap:7.25,gapX:9,gapY:8,wrapCount:2}}),
      node("a",{parentId:"flow",frame:{x:0,y:0,width:83.7,height:45.3},transform:{rotation:31,scaleX:1.3,scaleY:.9}}),
      node("b",{parentId:"flow",transform:{scaleX:-.7,rotation:12}}),node("c",{parentId:"a"}));
    sameGeometry(source,setNodeAnchor(source,"a",{anchorX:.5,anchorY:.75}));
    sameGeometry(source,setNodeAnchor(source,"b",{anchorX:1,anchorY:1}));
  }
  const measured=page(node("outer",{layout:{widthMode:"measured",heightMode:"measured"}}),
    node("box",{parentId:"outer",layout:{widthMode:"measured",heightMode:"measured"}}),node("c",{parentId:"box",transform:{rotation:28,scaleX:1.2}}));
  const changed=setNodeAnchor(measured,"c",{anchorX:.5,anchorY:.5});
  sameGeometry(measured,changed);
  assert.deepEqual(changed.nodes[2].frame,measured.nodes[2].frame);
});

test("post-anchor movement, resizing and constraint switches consume position correction exactly once", () => {
  const source=page(node("n",{frame:{x:101.3,y:66.7,width:131.75,height:43.2},layout:{centerX:12.3,top:8},transform:{scaleX:1.3,scaleY:.9,rotation:31,skewX:14}}));
  let changed=setNodeAnchor(source,"n",{anchorX:.43,anchorY:.29});
  const original=resolvePageLayout(changed).nodes.get("n")!.local;
  const target={...original,x:180,y:130,width:142,height:54};
  changed=editNodeFrame(changed,"n",target);
  const actual=resolvePageLayout(changed).nodes.get("n")!.local;
  for (const key of ["x","y","width","height"] as const) near(actual[key],target[key]);
  const floating=page(node("n",{frame:{x:101.3,y:66.7,width:131.75,height:43.2},transform:{scaleX:1.3,scaleY:.9,rotation:31,skewX:14}}));
  let toggled=setNodeAnchor(floating,"n",{anchorX:.43,anchorY:.29});
  const before=structuredClone(toggled);
  for (const key of ["left","right","centerX","top","bottom","centerY"] as const) {
    toggled=setNodeConstraint(toggled,"n",key,true); sameGeometry(before,toggled);
    toggled=setNodeConstraint(toggled,"n",key,false); sameGeometry(before,toggled);
  }
});

test("reparent, paste and container conversion absorb old anchor compensation without applying it twice", () => {
  const source=page(node("from",{type:"vbox",transform:{rotation:25,scaleX:1.2}}),node("target",{frame:{x:200,y:200,width:200,height:200},transform:{rotation:-15}}),
    node("n",{parentId:"from",frame:{x:0,y:0,width:50,height:30},transform:{rotation:31}}),node("c",{parentId:"n"}));
  const anchored=setNodeAnchor(source,"n",{anchorX:.5,anchorY:.5}), before=resolvePageLayout(anchored);
  const moved=reparentNode(anchored,"n","target"), after=resolvePageLayout(moved);
  for (const id of ["n","c"]) pointsNear(after.nodes.get(id)!.corners,before.nodes.get(id)!.corners);
  assert.equal(moved.nodes[2].layout?.positionOffsetX,undefined); assert.equal(moved.nodes[2].layout?.positionOffsetY,undefined);
  let serial=0;
  const pasted=pasteNode(page(),copyNode(anchored,"n")!,()=>`new${++serial}`), p=pasted.page.nodes[0];
  assert.equal(p.layout?.positionOffsetX,undefined); assert.equal(p.layout?.positionOffsetY,undefined);
  near(resolvePageLayout(pasted.page).nodes.get(p.id)!.local.x,before.nodes.get("n")!.local.x+16);
  near(resolvePageLayout(pasted.page).nodes.get(p.id)!.local.y,before.nodes.get("n")!.local.y+16);
  const converted=changeContainerType(anchored,"from","container");
  sameGeometry(anchored,converted);
  const duplicate=duplicateNode(anchored,"n",()=>`new${++serial}`);
  assert.deepEqual(duplicate.page.nodes.find(n=>n.id===duplicate.id)!.layout,anchored.nodes[2].layout);
});

test("anchor edit no-ops protect locks and input ranges and position corrections validate and roundtrip", () => {
  const source=page(node("n"),node("locked",{locked:true}),node("child",{parentId:"locked"}));
  for (const [id,anchor] of [["missing",{anchorX:.5}],["locked",{anchorX:.5}],["child",{anchorY:.5}],["n",{}],["n",{anchorX:0}],["n",{anchorX:NaN}],["n",{anchorY:2}]] as const) assert.equal(setNodeAnchor(source,id,anchor),source);
  const valid=doc(page(node("n",{layout:{left:0,positionOffsetX:-1.23456789,positionOffsetY:5.678}})));
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(valid)),valid);
  assert.ok(isWebviewToHostMessage({type:"replaceDocument",document:valid,baseVersion:1}));
  for (const positionOffsetX of [NaN,Infinity,"1",null]) assert.equal(validateGameFlowDocument(doc(page(node("n",{layout:{positionOffsetX:positionOffsetX as number}})))).ok,false);
  assert.equal(validateGameFlowDocument({...valid,schemaVersion:1}).ok,false);
});

test("compensated anchors and coordinates enter one transaction and survive save, undo and redo", () => {
  const source=doc(page(node("n",{layout:{centerX:0},transform:{rotation:31}}))), messages:WebviewToHostMessage[]=[];
  const session=new DocumentSession(message=>messages.push(message),()=>{});
  session.receive({type:"init",document:source,documentVersion:1,resourceName:"test",dirty:false});
  session.edit(d=>({...d,pages:[setNodeAnchor(d.pages[0],"n",{anchorX:.5,anchorY:.5})]}));
  const changed=session.state.document!;
  assert.equal(messages.length,1); assert.ok(isWebviewToHostMessage(messages[0]));
  sameGeometry(source.pages[0],changed.pages[0]); assert.equal(changed.pages[0].nodes[0].id,"n");
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(changed)),changed);
  session.receive({type:"documentChanged",document:changed,documentVersion:2,dirty:true});
  session.command("save"); session.receive({type:"commandCompleted",action:"save"});
  session.command("undo");session.receive({type:"documentChanged",document:source,documentVersion:3,dirty:false});session.receive({type:"commandCompleted",action:"undo"});
  assert.deepEqual(session.state.document,source);
  session.command("redo");session.receive({type:"documentChanged",document:changed,documentVersion:4,dirty:true});session.receive({type:"commandCompleted",action:"redo"});
  assert.deepEqual(session.state.document,changed);
});

test("optional v2 transforms roundtrip without normalizing defaults or identities; v1 and invalid messages reject them", () => {
  const transform = { anchorX: .125, anchorY: 1, scaleX: -2.12345, scaleY: 0, skewX: 12.5, skewY: -2, rotation: 370.25 };
  const source = doc(page(node("unchanged"), node("transformed", { transform })));
  const before = structuredClone(source);
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(source)), source);
  assert.equal(source.pages[0].nodes[0].transform, undefined);
  assert.deepEqual(source, before);
  assert.ok(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: source }));
  for (const invalid of [null, [], { pivotX: 1 }, { scaleX: Infinity }, { rotation: NaN }, { anchorX: -.01 }, { anchorY: 1.01 }, { scaleY: "1" }]) {
    const candidate = doc(page(node("n", { transform: invalid as NodeTransform })));
    assert.equal(validateGameFlowDocument(candidate).ok, false);
    assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: candidate }), false);
  }
  assert.equal(validateGameFlowDocument({ ...source, schemaVersion: 1 }).ok, false);
});

test("Laya anchor, mirror, rotation and skew fixtures map local corners and pivot correctly", () => {
  const frame = { x: 100, y: 200, width: 80, height: 40 };
  const matrix = nodeMatrix(frame, { anchorX: .5, anchorY: .25, scaleX: 2, scaleY: -3, rotation: 90 });
  assert.deepEqual(matrix, [0, 2, 3, 0, 70, 120]);
  pointsNear(framePolygon(matrix, 80, 40), [{x:70,y:120},{x:70,y:280},{x:190,y:280},{x:190,y:120}]);
  assert.deepEqual(mapPoint(matrix, { x: 40, y: 10 }), { x: 100, y: 200 });
  const skewed = nodeMatrix(frame, { scaleX: 2, scaleY: 3, rotation: 10, skewX: 40, skewY: 20 });
  [Math.sqrt(3), 1, 1.5, 3*Math.sqrt(3)/2, 100, 200].forEach((v, i) => near(skewed[i], v));
  pointsNear([mapPoint(inverse(skewed)!, mapPoint(skewed, {x:14,y:-8}))], [{x:14,y:-8}]);
  assert.equal(inverse(nodeMatrix(frame, { scaleX: 0 })), null);
  assert.equal(inverse(nodeMatrix(frame, { skewX: 90 })), null);
});

test("nested world geometry includes transformed parent origin and scroll but never page canvas coordinates", () => {
  const source = page(node("parent", { frame: { x: 100, y: 200, width: 80, height: 40 }, transform: { anchorX: .5, anchorY: .25, scaleX: 2, scaleY: -3, rotation: 90 }, layout: { scrollX: 5, scrollY: 7 } }),
    node("child", { parentId: "parent", frame: {x:15,y:17,width:10,height:20} }));
  const before = structuredClone(source), resolved = resolvePageLayout(source);
  pointsNear(resolved.nodes.get("child")!.corners, [{x:100,y:140},{x:100,y:160},{x:160,y:160},{x:160,y:140}]);
  assert.deepEqual(resolved.nodes.get("child")!.absolute, {x:100,y:140,width:60,height:20});
  assert.deepEqual(source, before);
});

test("scaled constraints use pivot compensation and raw stretch dimensions, diagnosing negative stretches", () => {
  const source = page(node("box", { frame: {x:0,y:0,width:400,height:200}, layout: {paddingLeft:10,paddingRight:20} }),
    node("n", { parentId:"box", transform:{anchorX:.5,scaleX:2}, layout:{left:10,right:20} }),
    node("center", { transform:{anchorY:.5,scaleY:1.5}, layout:{centerY:10} }),
    node("right", { transform:{anchorX:1,scaleX:-2}, layout:{right:15} }));
  const resolved = resolvePageLayout(source);
  assert.equal(resolved.nodes.get("n")!.local.width, 170);
  assert.equal(resolved.nodes.get("n")!.local.x, 190);
  assert.equal(resolved.nodes.get("center")!.local.y, 310);
  assert.equal(resolved.nodes.get("right")!.local.x, 385);
  source.nodes[1].transform!.scaleX = 0;
  assert.equal(resolvePageLayout(source).nodes.get("n")!.local.width, 34000);
  source.nodes[1].transform!.scaleX = -1;
  const negative = resolvePageLayout(source);
  assert.ok(negative.issues.some(issue => issue.nodeId === "n"));
  assert.equal(negative.nodes.get("n")!.local.width, source.nodes[1].frame.width);
});

test("HBox and VBox measure signed scaled occupancy while Grid compensates mirrored anchors", () => {
  for (const type of ["hbox", "vbox"] as const) {
    const axis = type === "hbox" ? "x" : "y", size = axis === "x" ? "width" : "height", scale = axis === "x" ? "scaleX" : "scaleY";
    const source = page(node("flow", { type, layout: { [`${size}Mode`]: "measured", gap: 5 } }),
      node("a", {parentId:"flow", frame:{x:0,y:0,width:50,height:50}, transform:{[scale]:2,anchorX:.5,anchorY:.5,rotation:20}}),
      node("b", {parentId:"flow", frame:{x:0,y:0,width:20,height:20}, transform:{[scale]:-1}}));
    const resolved = resolvePageLayout(source);
    assert.equal(resolved.nodes.get("flow")!.local[size], 85);
    assert.equal(resolved.nodes.get("a")!.local[axis], 0);
    assert.equal(resolved.nodes.get("b")!.local[axis], 105);
  }
  const grid = page(node("grid", {type:"grid",layout:{gapX:5,wrapCount:2,widthMode:"measured"}}),
    node("mirror",{parentId:"grid",transform:{scaleX:-2,anchorX:.5}}),
    node("next",{parentId:"grid",frame:{x:0,y:0,width:20,height:30},transform:{anchorX:.5}}));
  const resolved = resolvePageLayout(grid);
  assert.equal(resolved.nodes.get("grid")!.local.width, 205);
  assert.equal(resolved.nodes.get("mirror")!.local.x, 50);
  assert.equal(resolved.nodes.get("mirror")!.absolute.x, 10);
  assert.equal(resolved.nodes.get("next")!.local.x, 115);
});

test("constraint toggles and inverse frame edits preserve anchored scaled geometry", () => {
  let source = page(node("n", { frame:{x:133,y:242,width:80,height:40}, transform:{anchorX:.5,anchorY:.25,scaleX:1.5,scaleY:2,rotation:30} }));
  const original = resolvePageLayout(source).nodes.get("n")!;
  for (const key of ["left","right","centerX","top","bottom","centerY"] as const) {
    source = setNodeConstraint(source, "n", key, true);
    pointsNear(resolvePageLayout(source).nodes.get("n")!.corners, original.corners);
    source = setNodeConstraint(source, "n", key, false);
    pointsNear(resolvePageLayout(source).nodes.get("n")!.corners, original.corners);
  }
  source = setNodeConstraint(source, "n", "right", true);
  const changed = editNodeFrame(source,"n",{...original.local,x:153,width:100});
  assert.deepEqual(resolvePageLayout(changed).nodes.get("n")!.local, {...original.local,x:153,width:100});
  assert.equal(changed.nodes[0].layout!.right, 172);
});

test("rotated and mirrored ancestor clipping uses convex intersection instead of bounding boxes", () => {
  const diamond = [{x:0,y:5},{x:5,y:0},{x:10,y:5},{x:5,y:10}];
  const square = [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}];
  near(area(intersectPolygons(square, diamond)), 50);
  near(area(intersectPolygons(square, [...diamond].reverse())), 50);
  assert.deepEqual(intersectPolygons(square, [{x:0,y:0},{x:1,y:0},{x:2,y:0}]), []);
  const source = page(node("p1",{type:"panel",frame:{x:100,y:100,width:100,height:100},transform:{rotation:45}}),
    node("p2",{type:"panel",parentId:"p1",frame:{x:50,y:0,width:100,height:100},transform:{scaleY:-1,anchorY:1}}),
    node("c",{parentId:"p2",frame:{x:0,y:0,width:100,height:100}}));
  const result = resolvePageLayout(source).nodes.get("c")!;
  near(area(result.clipPolygon!), 5000);
  assert.ok(area(result.clipPolygon!) < polygonBounds(result.clipPolygon!).width*polygonBounds(result.clipPolygon!).height);
});

test("drag follows page displacement through a rotated nonuniform parent and mirrored local transforms", () => {
  const parent = nodeMatrix({x:100,y:200,width:80,height:40},{rotation:35,scaleX:2,scaleY:-3});
  const frame = {x:15,y:17,width:50,height:30};
  const next = nodeDragFrame(frame,parent,31,-27);
  pointsNear([mapVector(parent,{x:next.x-frame.x,y:next.y-frame.y})],[{x:31,y:-27}]);
  assert.deepEqual(nodeDragFrame(frame,nodeMatrix(frame,{scaleX:0}),31,-27), frame);
});

test("all resize handles keep the opposite local corner fixed under anchors, mirrors, skew and parent transforms", () => {
  const parent = nodeMatrix({x:110,y:80,width:300,height:200},{rotation:23,scaleX:2,scaleY:.7});
  for (const transform of [{anchorX:.5,anchorY:.25,rotation:37,scaleX:1.25,scaleY:2,skewX:12}, {anchorX:1,anchorY:1,scaleX:-2,scaleY:1.5}] as NodeTransform[]) {
    const n = node("n",{frame:{x:120,y:80,width:100,height:60},transform});
    const before = multiply(parent,nodeMatrix(n.frame,transform));
    for (const handle of ["nw","n","ne","e","se","s","sw","w"]) {
      const delta = mapVector(before,{x:handle.includes("w")?-10:10,y:handle.includes("n")?-8:8});
      const next = nodeResizeFrame(n,n.frame,before,handle,delta.x,delta.y);
      const after = multiply(parent,nodeMatrix(next,transform));
      pointsNear([mapPoint(after,{x:handle.includes("w")?next.width:0,y:handle.includes("n")?next.height:0})], [mapPoint(before,{x:handle.includes("w")?n.frame.width:0,y:handle.includes("n")?n.frame.height:0})]);
      near(next.width,handle.includes("w")||handle.includes("e")?110:100);
      near(next.height,handle.includes("n")||handle.includes("s")?68:60);
    }
  }
});

test("reparent preserves affine world corners and descendants across rotated scaled scrolling parents", () => {
  const source = page(node("from",{frame:{x:20,y:30,width:300,height:200},transform:{anchorX:.5,rotation:35,scaleX:2,scaleY:.7},layout:{scrollX:8,scrollY:12}}),
    node("to",{frame:{x:260,y:170,width:300,height:200},transform:{rotation:-15,scaleX:-1.5,scaleY:2},layout:{scrollX:4}}),
    node("n",{parentId:"from",transform:{anchorX:.25,anchorY:.5,rotation:22,scaleX:1.2},layout:{left:30}}),
    node("child",{parentId:"n",transform:{rotation:12}}));
  const before = resolvePageLayout(source), changed = reparentNode(source,"n","to"), after = resolvePageLayout(changed);
  for (const id of ["n","child"]) pointsNear(after.nodes.get(id)!.corners,before.nodes.get(id)!.corners);
  assert.equal(changed.nodes[2].id,"n"); assert.equal(changed.nodes[2].layout!.left,null);
  assert.ok(Math.abs(changed.nodes[2].transform!.skewX!) > .01);
});

test("singular target parents reject both direct and tree-drop reparent without changing sibling order", () => {
  const source = page(node("n"),node("other"),node("flat",{transform:{scaleX:0}}));
  assert.equal(reparentNode(source,"n","flat"),source);
  assert.equal(moveNode(source,"n",{targetId:"flat",position:"inside"}),source);
});

test("copies isolate transforms and type conversion, save, undo and redo retain them with stable existing IDs", () => {
  const source = page(node("n",{transform:{anchorX:.125,scaleX:1.23456,rotation:22}}),node("child",{parentId:"n",transform:{scaleY:-1}}));
  let serial=0;
  for (const copied of [duplicateNode(source,"n",()=>`new${++serial}`).page, duplicatePage(source,()=>`new${++serial}`), pasteNode(page(),copyNode(source,"n")!,()=>`new${++serial}`).page]) {
    const clone = copied.nodes.find(n=>n.id!=="n" && n.transform?.anchorX===.125)!;
    assert.notEqual(clone.id,"n"); assert.deepEqual(clone.transform,source.nodes[0].transform);
    clone.transform!.scaleX=99; assert.equal(source.nodes[0].transform!.scaleX,1.23456);
  }
  assert.deepEqual(convertNodeType(source,"n","panel").nodes[0].transform,source.nodes[0].transform);
  const legacy = {...doc(page(node("n"))),schemaVersion:1 as const}, messages:WebviewToHostMessage[]=[];
  const session = new DocumentSession(message=>messages.push(message),()=>{});
  session.receive({type:"init",document:legacy,documentVersion:1,resourceName:"test",dirty:false});
  session.edit(d=>({...d,pages:[source]}));
  const changed = session.state.document!;
  assert.equal(changed.schemaVersion,2); assert.equal(changed.pages[0].nodes[0].id,"n");
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(changed)),changed);
  session.receive({type:"documentChanged",document:changed,documentVersion:2,dirty:true});
  session.command("save"); assert.deepEqual(messages.at(-1),{type:"save"});
  session.receive({type:"commandCompleted",action:"save"});
  session.command("undo"); session.receive({type:"documentChanged",document:legacy,documentVersion:3,dirty:false});
  session.receive({type:"commandCompleted",action:"undo"}); assert.deepEqual(session.state.document,legacy);
  session.command("redo"); session.receive({type:"documentChanged",document:changed,documentVersion:4,dirty:true});
  session.receive({type:"commandCompleted",action:"redo"}); assert.deepEqual(session.state.document,changed);
});
