const assert = require("node:assert/strict");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");
const path = require("node:path");

async function checkRuntime(browser,root,prefab) {
  const game=await browser.newPage();
  try {
    await game.route("http://prefab-test.local/",route=>route.fulfill({contentType:"text/html",body:"<!doctype html><body></body>"}));
    await game.goto("http://prefab-test.local/");
    for(const name of ["laya.core","laya.webgl_2D","laya.d3","laya.webgl_3D","laya.ui"])
      await game.addScriptTag({path:path.join(root,"engine/libs",name+".js")});
    const bundle=await require("esbuild").build({stdin:{contents:["ui-stack","ui-label","ui-button"].map(n=>'import "./'+n+'";').join("\n"),
      resolveDir:path.join(root,"src/game/app/core/ui")},bundle:true,write:false,format:"iife",tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}}});
    await game.addScriptTag({content:bundle.outputFiles[0].text});
    const result=await game.evaluate(async data=>{
      await Laya.init(320,240);
      class DebounceClick extends Laya.Script {interval=0;}
      Laya.ClassUtils.regClass("DebounceClick",DebounceClick);
      const errors=[], parsed=Laya.HierarchyParser.parse(data,null,errors);
      const page=Array.isArray(parsed)?parsed[0]:parsed;
      const label=page.getChildByName("按钮文案");
      const result={errors:errors.map(String),text:label.text,interval:label.getComponent(DebounceClick)?.interval,
        buttons:["帮助","公告"].map(n=>page.getChildByName(n) instanceof Laya.ClassUtils.getClass("UIButton"))};
      page.destroy(true);
      return result;
    },prefab);
    assert.deepEqual(result,{errors:[],text:"开始冒险",interval:500,buttons:[true,true]});
    console.log("Real Laya engine instantiated both UIButton nodes, merged UILabel text and the retained script parameter");
  } finally {await game.close();}
}

(async () => {
  const {createServer} = await import("vite");
  const server = await createServer({server:{host:"127.0.0.1",port:0},logLevel:"error"});
  await server.listen();
  let browser;
  try {
    browser=await chromium.launch({channel:process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge",headless:true});
    const p=await browser.newPage({viewport:{width:1300,height:900}});
    const errors=[];p.on("pageerror",error=>errors.push(error.message));
    await p.addInitScript(()=>{
      const key="gameflow.prototype.v1";
      if(!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify({
        schemaVersion:5,elementIdScheme:"nanoid-8",documentId:"prefab-browser",title:"测试",requirements:[],interactions:[],
        pages:[{id:"page0001",name:"登录",kind:"screen",frame:{x:0,y:0,width:320,height:240},
          nodes:[{id:"text0001",name:"按钮文案",type:"text",text:"登录",frame:{x:20,y:80,width:200,height:48},style:{fontSize:32}}]}]
      }));
      let i=0;
      window.showDirectoryPicker=async()=> (await navigator.storage.getDirectory()).getDirectoryHandle(["resources","prefabs"][i++],{create:true});
    });
    await p.goto("http://127.0.0.1:"+server.httpServer.address().port);
    const select=()=>p.locator(".page-caption").first().click();
    const button=name=>p.getByRole("button",{name,exact:true});
    const directories=async()=>{
      await button("工作台设置").click();
      await button("选择资源导出根目录").click();
      await button("选择预制体导出根目录").click();
      await button("完成").click();
    };
    await select();await directories();
    const openPrefab=async()=>{
      await button("更多").click();
      await p.getByRole("menuitem",{name:"预制体同步",exact:true}).click();
    };
    assert.equal(await p.locator(".canvas-toolbar").getByRole("button",{name:/^(导出|同步)$/}).count(),0);
    assert.equal(await button("运行预览").count(),0);
    await openPrefab();
    await p.waitForFunction(()=>JSON.parse(localStorage.getItem("gameflow.prototype.v1")).pages[0].prefabSync);
    // Two independently saved inputs, including a foreign Laya ID and a private component.
    await p.evaluate(async()=>{
      const key="gameflow.prototype.v1",doc=JSON.parse(localStorage.getItem(key));
      doc.pages[0].nodes[0].text="进入游戏";
      doc.pages[0].nodes[0].style.italic=true;
      doc.pages[0].nodes[0].widget={wordWrap:false};
      const oldLabel=doc.pages[0].prefabSync.nodes.find(node=>node.id==="text0001");
      delete oldLabel.properties["widget.wordWrap"];
      doc.pages[0].nodes.push({id:"help0001",name:"帮助",type:"button",frame:{x:10,y:10,width:50,height:30},normalSkin:{builtin:"button/gray"}});
      localStorage.setItem(key,JSON.stringify(doc));
      const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle("prefabs");
      const file=await dir.getFileHandle("登录.lh"),raw=JSON.parse(await (await file.getFile()).text());
      raw.width=360;raw.height=260;
      raw._$child[0].text="开始冒险";raw._$child[0].fontSize=33;raw._$child[0]._$comp=[{_$type:"DebounceClick",interval:500}];
      raw._$child.push({_$type:"UIButton",_$id:"notice-laya",name:"公告",width:60,height:25});
      const writer=await file.createWritable();await writer.write(JSON.stringify(raw));await writer.close();
    });
    await p.reload();await select();await directories();await openPrefab();
    const dialog=p.getByRole("dialog",{name:"预制体同步"});
    await dialog.waitFor();
    assert.equal(await dialog.locator(".sync-boards figure").count(),2);
    const changedRow=dialog.locator(".layer-name").filter({hasText:"按钮文案"});
    const changedParts=await changedRow.evaluate(row=>[...row.children].map(child=>child.matches("span")?"name":child.matches(".sync-change-slot")?"marker":child.matches(".layer-variable")?"variable":"icon"));
    assert.deepEqual(changedParts,["icon","name","marker"],"changed node marker follows its name when no variable badge exists");
    assert.equal(await changedRow.locator(".sync-change-slot").textContent(),"~");
    const rootParts=await dialog.locator(".tree-root").evaluate(row=>[...row.children].map(child=>child.matches("strong")?"name":child.matches(".sync-change-slot")?"marker":child.matches("small")?"type":"icon"));
    assert.deepEqual(rootParts,["icon","name","marker","type","icon"],"root marker stays between the page name and root type");
    await changedRow.click();
    const textDiff=dialog.locator("fieldset").filter({hasText:"文字内容"});
    const fontDiff=dialog.locator("fieldset").filter({hasText:"字号"});
    const wrapDiff=dialog.getByRole("group",{name:/自动换行\s*来源待定/});
    const wrapChoice=dialog.getByRole("combobox",{name:"自动换行的同步方向"});
    assert.match(await textDiff.locator("legend").innerText(),/双方已改/);
    assert.deepEqual(await textDiff.locator("dt").allTextContents(), ["上次同步值", "原型", "预制体"]);
    assert.deepEqual(await textDiff.locator("dd").allTextContents(), ["登录", "进入游戏", "开始冒险"]);
    assert.equal(await textDiff.getByRole("combobox").inputValue(),"");
    assert.match(await fontDiff.locator("legend").innerText(),/预制体已改/);
    assert.match(await fontDiff.locator("dd").textContent(),/32 px → 33 px/);
    assert.equal(await fontDiff.getByRole("combobox").inputValue(),"psd");
    assert.equal(await fontDiff.locator("option:checked").textContent(),"把原型改为「33 px」");
    const italic=dialog.getByRole("combobox",{name:"斜体的同步方向"});
    assert.equal(await italic.inputValue(),"proto");
    assert.equal(await italic.locator("option:checked").textContent(),"把预制体改为「是」");
    assert.deepEqual(await wrapDiff.locator("dd").allTextContents(),["未记录","关闭","开启"]);
    assert.equal(await wrapChoice.inputValue(),"");
    assert(await button("预演应用").isDisabled());
    const heading = await dialog.locator("header").boundingBox();
    const inspectorHeading = await p.locator(".inspector .floating-heading").boundingBox();
    assert.equal(heading.height, inspectorHeading.height);
    const main = await dialog.locator(".sync-main").boundingBox();
    const detail = await dialog.locator(".sync-detail").boundingBox();
    const previews = await dialog.locator(".sync-preview").all();
    assert(main.x + main.width <= detail.x + 1, "property details stay to the right of both previews");
    assert((await previews[0].boundingBox()).height > 310, "preview uses the available dialog height");
    const previewBackground = await previews[0].evaluate(element => getComputedStyle(element).backgroundImage);
    assert.match(previewBackground, /linear-gradient/, "preview reuses the slice editor checkerboard");
    const surfaces=await dialog.locator(".sync-surface").all(),leftSurface=await surfaces[0].boundingBox(),rightSurface=await surfaces[1].boundingBox();
    assert(Math.abs(leftSurface.width-rightSurface.width)<=1 && Math.abs(leftSurface.height-rightSurface.height)<=1,"prototype and prefab previews share one design-canvas scale");
    const selectedName=dialog.locator(".sync-bar > strong");
    await previews[0].locator('[data-node-id="help0001"]').click();
    assert.equal(await selectedName.innerText(),"帮助","prototype preview directly selects its node");
    await previews[1].locator('[data-node-id="text0001"]').click();
    assert.equal(await selectedName.innerText(),"按钮文案","prefab preview directly selects its node");
    const initialSize = await dialog.boundingBox();
    const resizeEdges = dialog.locator(".sync-resize-edge"), southeastEdge = dialog.locator('.sync-resize-edge[data-edge="se"]');
    assert.equal(await resizeEdges.count(),8,"all window edges and corners can resize the dialog");
    assert.equal(await dialog.getByRole("button",{name:"拖动调整同步窗口大小",exact:true}).count(),0,"resize has no visible footer button");
    assert.equal(await southeastEdge.evaluate(element=>getComputedStyle(element).cursor),"nwse-resize");
    const southeastBounds = await southeastEdge.boundingBox();
    const shrinkStart = {x:southeastBounds.x + southeastBounds.width / 2,y:southeastBounds.y + southeastBounds.height / 2};
    const shrinkInset = {x:initialSize.x + initialSize.width - shrinkStart.x,y:initialSize.y + initialSize.height - shrinkStart.y};
    const shrinkTarget = {x:shrinkStart.x - 80,y:shrinkStart.y - 45};
    await p.mouse.move(shrinkStart.x,shrinkStart.y);
    await p.mouse.down();await p.mouse.move(shrinkTarget.x,shrinkTarget.y,{steps:5});await p.mouse.up();
    const resizedSize = await dialog.boundingBox();
    assert(Math.abs(resizedSize.width - (initialSize.width - 160)) <= 3, `centered resize doubles horizontal pointer movement: ${initialSize.width} -> ${resizedSize.width}`);
    assert(Math.abs(resizedSize.height - (initialSize.height - 90)) <= 3, `centered resize doubles vertical pointer movement: ${initialSize.height} -> ${resizedSize.height}`);
    assert(Math.abs(resizedSize.x + resizedSize.width - shrinkTarget.x - shrinkInset.x) <= 3, "right edge follows the horizontal pointer position");
    assert(Math.abs(resizedSize.y + resizedSize.height - shrinkTarget.y - shrinkInset.y) <= 3, "bottom edge follows the vertical pointer position");
    if (process.env.GAMEFLOW_PREFAB_SYNC_SCREENSHOT) await dialog.screenshot({path: process.env.GAMEFLOW_PREFAB_SYNC_SCREENSHOT});
    await textDiff.getByRole("combobox").selectOption("psd");
    await dialog.getByText("同步后属性预览",{exact:true}).click();
    const wrapRow=dialog.locator(".prefab-result tr").filter({hasText:"自动换行"});
    for(const [direction,values] of [["proto",["关闭","关闭"]],["skip",["关闭","开启"]],["psd",["开启","开启"]]]) {
      await wrapChoice.selectOption(direction);
      assert.deepEqual(await wrapRow.locator("td").allTextContents(),values);
      if(direction==="skip") assert.match(await dialog.locator("footer").innerText(),/跳过 1 项/);
    }
    assert.equal(await button("同步后").getAttribute("aria-pressed"),"true");
    await dialog.locator(".tree-root").click();
    for(const name of ["页面宽度","页面高度"]) assert.equal(await dialog.getByRole("combobox",{name:name+"的同步方向"}).inputValue(),"psd");
    await button("预演应用").click();await button("确认应用").click();
    await dialog.waitFor({state:"hidden"});
    const data=await p.evaluate(async()=>{
      const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle("prefabs");
      const file=await dir.getFileHandle("登录.lh");
      return {page:JSON.parse(localStorage.getItem("gameflow.prototype.v1")).pages[0],prefab:JSON.parse(await (await file.getFile()).text())};
    });
    assert.equal(data.page.nodes.find(n=>n.id==="text0001").text,"开始冒险");
    assert.equal(data.page.nodes.find(n=>n.id==="text0001").style.fontSize,33);
    assert.equal(data.page.nodes.find(n=>n.id==="text0001").widget.wordWrap,true);
    assert.equal(data.prefab._$child[0].italic,true);
    assert.deepEqual(data.page.frame,{x:0,y:0,width:360,height:260});
    assert.equal(data.page.nodes.filter(n=>n.name==="公告").length,1);
    assert.equal(data.prefab._$child.filter(n=>n._$id==="help0001").length,1);
    assert.equal(data.prefab._$child[0]._$comp[0].interval,500);
    const editedUuid="96f04853-16ab-4f90-b4e1-ee6a37780f93";
    await p.evaluate(async uuid=>{
      const disk=await navigator.storage.getDirectory(),dir=await disk.getDirectoryHandle("prefabs");
      await dir.removeEntry("登录.lh.meta");
      const resources=await disk.getDirectoryHandle("resources");
      const folder=await (await resources.getDirectoryHandle("builtin")).getDirectoryHandle("button");
      const meta=await folder.getFileHandle("gray.png.meta"),writer=await meta.createWritable();
      await writer.write(JSON.stringify({uuid,importer:{filterMode:0,sizeGrid:[0,0,0,0,0]}}));
      await writer.close();
    },editedUuid);
    await openPrefab();await dialog.waitFor();
    assert.deepEqual(await dialog.boundingBox(),resizedSize,"prefab sync restores the last completed resize");
    const growBox = await dialog.boundingBox(), northwestEdge = dialog.locator('.sync-resize-edge[data-edge="nw"]');
    assert.equal(await northwestEdge.evaluate(element=>getComputedStyle(element).cursor),"nwse-resize");
    const northwestBounds = await northwestEdge.boundingBox();
    const growStart = {x:northwestBounds.x + northwestBounds.width / 2,y:northwestBounds.y + northwestBounds.height / 2};
    const growInset = {x:growStart.x - growBox.x,y:growStart.y - growBox.y};
    const growTarget = {x:growStart.x - 55,y:growStart.y - 35};
    await p.mouse.move(growStart.x,growStart.y);
    await p.mouse.down();await p.mouse.move(growTarget.x,growTarget.y,{steps:5});await p.mouse.up();
    const enlargedSize = await dialog.boundingBox();
    assert(Math.abs(enlargedSize.width - (resizedSize.width + 110)) <= 3, "growing doubles horizontal pointer movement");
    assert(Math.abs(enlargedSize.height - (resizedSize.height + 70)) <= 3, "growing doubles vertical pointer movement");
    assert(Math.abs(growTarget.x - enlargedSize.x - growInset.x) <= 3, "left edge stays under the pointer while growing");
    assert(Math.abs(growTarget.y - enlargedSize.y - growInset.y) <= 3, "top edge stays under the pointer while growing");
    assert.match(await dialog.innerText(),/登录\.lh\.meta/);
    await button("预演应用").click();await button("确认应用").click();
    await dialog.waitFor({state:"hidden"});
    const repaired=await p.evaluate(async()=>{
      const disk=await navigator.storage.getDirectory(),dir=await disk.getDirectoryHandle("prefabs");
      const read=async(folder,name)=>JSON.parse(await (await (await folder.getFileHandle(name)).getFile()).text());
      const resources=await disk.getDirectoryHandle("resources");
      const folder=await (await resources.getDirectoryHandle("builtin")).getDirectoryHandle("button");
      return {prefab:await read(dir,"登录.lh"),meta:await read(dir,"登录.lh.meta"),image:await read(folder,"gray.png.meta")};
    });
    assert.match(repaired.meta.uuid,/^[a-f0-9-]{36}$/);
    assert.equal(repaired.prefab._$child.find(n=>n._$id==="help0001").normalSkin,"res://"+editedUuid);
    assert.deepEqual(repaired.image,{uuid:editedUuid,importer:{filterMode:0,textureType:2,sizeGrid:[14,14,14,14,0]}});
    await openPrefab();await dialog.waitFor();
    assert.deepEqual(await dialog.boundingBox(),enlargedSize,"prefab sync remembers the enlarged size after reopening");
    assert.match(await dialog.innerText(),/0 项差异/);
    assert(await dialog.getByRole("button",{name:"预演应用"}).isDisabled());
    await p.setViewportSize({width:400,height:590});
    const rect=await dialog.boundingBox();
    assert(rect.width<=400 && rect.height<=590);
    const tree = await dialog.getByRole("navigation").boundingBox();
    const narrowMain = await dialog.locator(".sync-main").boundingBox();
    const narrowDetail = await dialog.locator(".sync-detail").boundingBox();
    assert(tree.y + tree.height <= narrowMain.y + 1);
    assert(narrowMain.y + narrowMain.height <= narrowDetail.y + 1);
    const label = dialog.getByRole("button", {name:"按钮文案", exact:true});
    assert.equal((await label.boundingBox()).height, 28, "sync nodes use the layer row height");
    const labelIcon = await label.locator("svg").boundingBox();
    assert.equal(labelIcon.width, 14);
    const expand = dialog.getByRole("button", {name:"展开按钮文案", exact:true});
    assert.equal((await expand.locator("svg").boundingBox()).width, 12);
    await expand.click();
    const script = dialog.getByRole("button",{name:/DebounceClick/});
    assert.equal((await script.locator("svg").boundingBox()).x - labelIcon.x, 10);
    assert.equal(await script.locator(".sync-change-slot").textContent(),"","unchanged component row keeps an empty marker slot");
    const scriptParts=await script.evaluate(row=>[...row.children].map(child=>child.matches("span")?"name":child.matches(".sync-change-slot")?"marker":child.matches(".layer-variable")?"variable":"icon"));
    assert.deepEqual(scriptParts,["icon","name","marker","variable"],"empty marker slot stays before the component type badge");
    await dialog.getByRole("button", {name:"折叠按钮文案", exact:true}).click();
    assert.equal(await script.count(), 0);
    await expand.click();
    await script.click();
    assert.match(await dialog.locator("fieldset").innerText(),/500/);
    assert.deepEqual(errors,[]);
    console.log("Prefab sync browser: export, border resize and restore, independent additions, text conflict, script retention and zero differences passed");
    if(process.env.GAMEFLOW_LAYA_ROOT) await checkRuntime(browser,process.env.GAMEFLOW_LAYA_ROOT,data.prefab);
  } finally {await browser?.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
