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
    browser=await chromium.launch({channel:"msedge",headless:true});
    const p=await browser.newPage({viewport:{width:1300,height:900}});
    const errors=[];p.on("pageerror",error=>errors.push(error.message));
    await p.addInitScript(()=>{
      const key="gameflow.prototype.v1";
      if(!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify({
        schemaVersion:5,elementIdScheme:"nanoid-8",documentId:"prefab-browser",title:"测试",requirements:[],interactions:[],
        pages:[{id:"page0001",name:"登录",kind:"screen",frame:{x:0,y:0,width:320,height:240},
          nodes:[{id:"text0001",name:"按钮文案",type:"text",text:"登录",frame:{x:20,y:80,width:200,height:48}}]}]
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
    await select();await directories();await button("导出 Prefab").click();
    await p.waitForFunction(()=>JSON.parse(localStorage.getItem("gameflow.prototype.v1")).pages[0].prefabSync);
    // Two independently saved inputs, including a foreign Laya ID and a private component.
    await p.evaluate(async()=>{
      const key="gameflow.prototype.v1",doc=JSON.parse(localStorage.getItem(key));
      doc.pages[0].nodes[0].text="进入游戏";
      doc.pages[0].nodes.push({id:"help0001",name:"帮助",type:"button",frame:{x:10,y:10,width:50,height:30}});
      localStorage.setItem(key,JSON.stringify(doc));
      const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle("prefabs");
      const file=await dir.getFileHandle("登录.lh"),raw=JSON.parse(await (await file.getFile()).text());
      raw._$child[0].text="开始冒险";raw._$child[0]._$comp=[{_$type:"DebounceClick",interval:500}];
      raw._$child.push({_$type:"UIButton",_$id:"notice-laya",name:"公告",width:60,height:25});
      const writer=await file.createWritable();await writer.write(JSON.stringify(raw));await writer.close();
    });
    await p.reload();await select();await directories();await button("同步预制体").click();
    const dialog=p.getByRole("dialog",{name:"同步预制体"});
    await dialog.waitFor();
    assert.equal(await dialog.locator(".sync-boards figure").count(),2);
    await dialog.getByRole("button",{name:"采用预制体 → 原型"}).click();
    await button("预演应用").click();await button("确认应用").click();
    await dialog.waitFor({state:"hidden"});
    const data=await p.evaluate(async()=>{
      const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle("prefabs");
      const file=await dir.getFileHandle("登录.lh");
      return {page:JSON.parse(localStorage.getItem("gameflow.prototype.v1")).pages[0],prefab:JSON.parse(await (await file.getFile()).text())};
    });
    assert.equal(data.page.nodes.find(n=>n.id==="text0001").text,"开始冒险");
    assert.equal(data.page.nodes.filter(n=>n.name==="公告").length,1);
    assert.equal(data.prefab._$child.filter(n=>n._$id==="help0001").length,1);
    assert.equal(data.prefab._$child[0]._$comp[0].interval,500);
    await button("同步预制体").click();await dialog.waitFor();
    assert.match(await dialog.innerText(),/0 项差异/);
    assert(await dialog.getByRole("button",{name:"预演应用"}).isDisabled());
    await p.setViewportSize({width:400,height:590});
    const rect=await dialog.boundingBox();
    assert(rect.width<=400 && rect.height<=590);
    await dialog.getByRole("button",{name:"展开或折叠按钮文案"}).click();
    await dialog.getByRole("button",{name:/DebounceClick/}).click();
    assert.match(await dialog.locator("fieldset").innerText(),/500/);
    assert.deepEqual(errors,[]);
    console.log("Prefab sync browser: export, storage reload, independent additions, text conflict, script retention and zero differences passed");
    if(process.env.GAMEFLOW_LAYA_ROOT) await checkRuntime(browser,process.env.GAMEFLOW_LAYA_ROOT,data.prefab);
  } finally {await browser?.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
