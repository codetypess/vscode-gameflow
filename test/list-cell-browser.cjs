const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const {createServer} = await import("vite");
  const server = await createServer({server:{host:"127.0.0.1",port:0},logLevel:"error"});
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({channel:process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge",headless:true});
    const page = await browser.newPage({viewport:{width:1400,height:900}});
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on("pageerror",error=>errors.push(error.message));
    const box = (id,name,height,text) => ({
      id,name,kind:"screen",rootType:"UIBox",frame:{x:400,y:0,width:80,height},
      nodes:[{id:"label001",type:"text",name:"标签",text,frame:{x:0,y:0,width:80,height}}]
    });
    const doc = {schemaVersion:5,elementIdScheme:"nanoid-8",documentId:"list-demo",title:"列表",requirements:[],interactions:[],pages:[
      {id:"page0001",name:"背包",kind:"screen",frame:{x:0,y:0,width:320,height:240},nodes:[
        {id:"list0001",name:"物品列表",type:"list",layout:{scrollType:2,wrapCount:1},frame:{x:20,y:20,width:160,height:91}}]},
      box("item0001","本地模板",30,"本地物品")
    ]};
    const external = {...doc,documentId:"external",pages:[box("item0002","外部模板",20,"跨文件物品")]};
    await page.addInitScript(doc=>{
      if (!localStorage.getItem("gameflow.prototype.v1")) localStorage.setItem("gameflow.prototype.v1",JSON.stringify(doc));
      let n=0;
      window.showDirectoryPicker=async()=> (await navigator.storage.getDirectory()).getDirectoryHandle(["resources","prefabs"][n++],{create:true});
    },doc);
    await page.goto("http://127.0.0.1:"+server.httpServer.address().port);
    const button = name=>page.getByRole("button",{name,exact:true});
    await page.locator(".page-caption").first().dblclick();
    await page.locator('[data-layer-id="list0001"] .layer-name').click();
    const cellField = page.getByRole("button",{name:/^选择渲染项，/});
    assert.equal(await cellField.innerText(),"未绑定");
    await cellField.click();
    await page.getByRole("button",{name:/本地模板/}).click();
    const cells = page.locator(".page-surface [data-cell-index]");
    await cells.nth(3).waitFor();
    assert.equal(await cells.count(),4);
    assert.equal(await cellField.innerText(),"本地模板");
    await cellField.press("Delete");
    await button("选择渲染项，未绑定").waitFor();
    assert.equal(await cells.count(),0);
    await cellField.press("Enter");
    const upload = page.waitForEvent("filechooser");
    await button("引用其他画布…").click();
    await (await upload).setFiles({name:"items.gameflow.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(external))});
    await page.getByRole("button",{name:/外部模板/}).click();
    await cells.nth(4).waitFor();
    assert.equal(await cells.count(),5);
    assert.equal(await cellField.innerText(),"外部模板");
    await cellField.locator(".lucide-square-mouse-pointer").click();
    assert.equal(await page.getByLabel("画布引用来源").inputValue(),"items.gameflow.json");
    await button("清除绑定").click();
    await button("选择渲染项，未绑定").waitFor();
    await cellField.press("Enter");
    await page.getByLabel("画布引用来源").selectOption("items.gameflow.json");
    await page.getByRole("button",{name:/外部模板/}).click();
    await cells.nth(4).waitFor();
    await page.getByRole("combobox",{name:"滚动方向"}).selectOption("1");
    await page.waitForFunction(()=>document.querySelectorAll(".page-surface [data-cell-index]").length===2);
    await button("工作台设置").click();
    await button("选择资源导出根目录").click();
    await button("选择预制体导出根目录").click();
    await button("完成").click();
    await button("更多").click();
    await page.getByRole("menuitem",{name:"预制体同步",exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem("gameflow.prototype.v1")).pages[0].prefabSync);
    await page.evaluate(async()=>{
      const root=await (await navigator.storage.getDirectory()).getDirectoryHandle("prefabs");
      const file=await root.getFileHandle("外部模板.lh");
      const record=JSON.parse(await (await file.getFile()).text());
      record._$child[0].text="引擎模板";
      const output=await file.createWritable();await output.write(JSON.stringify(record));await output.close();
    });
    await button("更多").click();
    await page.getByRole("menuitem",{name:"预制体同步",exact:true}).click();
    const boards=page.locator(".sync-boards figure");
    await boards.nth(1).locator("[data-cell-index]").first().waitFor();
    assert.equal(await boards.nth(0).locator("[data-cell-index]").count(),2);
    assert.equal(await boards.nth(1).locator("[data-cell-index]").count(),2);
    assert.match(await boards.nth(0).innerText(),/跨文件物品/);
    assert.match(await boards.nth(1).innerText(),/引擎模板/);
    const exported = await page.evaluate(async()=>{
      const root=await (await navigator.storage.getDirectory()).getDirectoryHandle("prefabs");
      const read=async name=>JSON.parse(await (await (await root.getFileHandle(name)).getFile()).text());
      return {screen:await read("背包.lh"),cell:await read("外部模板.lh"),meta:await read("外部模板.lh.meta")};
    });
    const game = await browser.newPage();
    const runtimeUrl = new URL("/laya-test",page.url()).href;
    await game.route(runtimeUrl,route=>route.fulfill({contentType:"text/html",body:"<!doctype html><body></body>"}));
    await game.goto(runtimeUrl);
    const example=path.resolve(__dirname,"../examples/laya-gameflow");
    for(const lib of ["laya.core","laya.webgl_2D","laya.d3","laya.webgl_3D","laya.ui"])
      await game.addScriptTag({path:path.join(example,"engine/libs",lib+".js")});
    const bundle=await require("esbuild").build({stdin:{contents:["ui-stack","ui-label","ui-list"].map(lib=>'import "./'+lib+'";').join("\n"),
      resolveDir:path.join(example,"src/core/ui")},bundle:true,write:false,format:"iife",tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}}});
    await game.addScriptTag({content:bundle.outputFiles[0].text});
    const actual=await game.evaluate(async ({screen,cell,meta})=>{
      await Laya.init(320,240);
      const template=new Laya.PrefabImpl(null,cell);
      Laya.loader.cacheRes("res://"+meta.uuid,template,Laya.Loader.HIERARCHY);
      screen._$child.push({_$id:"reference",_$prefab:meta.uuid,name:"引用项",x:200,y:20,width:80,height:20});
      const errors=[],root=Laya.HierarchyParser.parse(screen,null,errors);
      const view=Array.isArray(root)?root[0]:root;
      const list=view.getChildByName("物品列表");
      const reference=view.getChildByName("引用项");
      Laya.stage.addChild(view);
      list.dataSource=Array.from({length:20},(_,i)=>i);
      const first=list.getCell(0), second=list.getCell(1);
      const result={errors:errors.map(String),bound:list.cellPrefab===template,text:first?.getChildAt(0)?.text,referenceText:reference?.getChildAt(0)?.text,
        x:second?.x,width:first?.width,far:list.getCell(19)===null};
      view.destroy(true);
      return result;
    },exported);
    assert.deepEqual(actual,{errors:[],bound:true,text:"引擎模板",referenceText:"引擎模板",x:80,width:80,far:true});
    await game.close();
    assert.deepEqual(errors,[]);
    console.log("Passed local and imported CellPrefab selection, viewport fill, horizontal layout, UUID reference export, independent disk preview and Laya runtime binding");
  } finally {
    await browser?.close(); await server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
