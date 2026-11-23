const assert = require("node:assert/strict");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    const page = await browser.newPage({viewport:{width:1280,height:880}});
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.setDefaultTimeout(12000);
    await page.goto(process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5197");
    const psd = await page.evaluate(async () => {
      const {generatePrototypePsd} = await import("/runtime/prototype-psd.ts");
      const {psdTask} = await import("/psd/io.ts");
      const base = {id:"mylogin1",name:"登录",kind:"screen",frame:{x:0,y:0,width:320,height:240},nodes:[
        {id:"start001",name:"开始",type:"button",variableName:"start",frame:{x:20,y:20,width:120,height:50},normalSkin:{builtin:"button/gray"}},
        {id:"label001",name:"文案",type:"text",parentId:"start001",text:"初始",frame:{x:5,y:5,width:95,height:32}},
        {id:"footer01",name:"底部",type:"text",text:"提示",frame:{x:20,y:190,width:100,height:32}}
      ]};
      const doc = {schemaVersion:5,elementIdScheme:"nanoid-8",documentId:"sync-browser",title:"同步",requirements:[],interactions:[],pages:[base]};
      const original = await generatePrototypePsd(doc,base);
      const asset = await psdTask("read",original.buffer,"login.psd");
      const frame = {x:30,y:80,width:100,height:40};
      const added = (id,name,y) => ({id,name,type:"button",frame:{...frame,y},normalSkin:{builtin:"button/gray"}});
      const art = {...base,nodes:[base.nodes[0],{...base.nodes[1],text:"美术"},added("notice01","公告 (UIButton)",140)]};
      const artBytes = await generatePrototypePsd(doc,art);
      const baseNodes = base.nodes.map(n=>({id:n.id,name:n.name,type:n.type,parent:n.parentId||"",text:n.text||"",frame:n.frame,
        layer:asset.layers.find(l=>l.metadata.prototype?.nodeId===n.id && !l.metadata.prototype.slot).metadata.layerId}));
      doc.pages=[{...base,artPsd:{source:"login.psd",documentId:asset.documentId},psdSync:{version:1,documentId:doc.documentId,pageId:base.id,psdId:asset.documentId,nodes:baseNodes},
        nodes:[base.nodes[0],{...base.nodes[1],text:"策划"},base.nodes[2],added("help0001","帮助",80)]}];
      localStorage.setItem("gameflow.prototype.v1",JSON.stringify(doc));
      return btoa(Array.from(artBytes,b=>String.fromCharCode(b)).join(""));
    });
    await page.reload();
    await page.locator(".page-caption").first().click();
    const menu=async name=>{
      await page.getByRole("button",{name:"更多",exact:true}).click();
      await page.getByRole("menuitem",{name,exact:true}).click();
    };
    const chooser=page.waitForEvent("filechooser");
    await menu("重新绑定 PSD");
    await (await chooser).setFiles({name:"login.psd",mimeType:"image/vnd.adobe.photoshop",buffer:Buffer.from(psd,"base64")});
    await menu("同步文字与结构");
    const dialog=page.getByRole("dialog",{name:"同步文字与结构"});
    const tree=dialog.getByRole("navigation"), button=(name)=>dialog.getByRole("button",{name,exact:true});
    const box=()=>dialog.boundingBox();
    await tree.getByText("4 项差异",{exact:false}).waitFor();
    const initial=await box();
    await tree.getByRole("button",{name:"折叠开始"}).click();
    await tree.getByRole("button",{name:"展开开始"}).click();
    await tree.getByRole("button",{name:/~ 文案/}).click();
    await button("采用PSD").click();
    assert.deepEqual(await box(),initial);
    await tree.getByRole("button",{name:/− 底部/}).click();
    await button("从原型删除").click();
    await button("预演应用").click();
    assert.deepEqual(await box(),initial);
    const handle=await button("拖动调整同步窗口大小").boundingBox();
    const x=handle.x+handle.width/2,y=handle.y+handle.height/2;
    const target={x:x-60,y:y-40};
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:5});await page.mouse.up();
    const resized=await box(), movedHandle=await button("拖动调整同步窗口大小").boundingBox();
    assert(Math.abs(resized.width-(initial.width-120))<=3 && Math.abs(resized.height-(initial.height-80))<=3,"centered dialog size follows double pointer movement");
    assert(Math.abs(movedHandle.x+movedHandle.width/2-target.x)<=3 && Math.abs(movedHandle.y+movedHandle.height/2-target.y)<=3,"resize handle stays under the pointer");
    const download=page.waitForEvent("download");
    await button("确认应用").click();
    const output=await download;
    if(process.env.GAMEFLOW_SYNC_TEST_OUTPUT) await output.saveAs(process.env.GAMEFLOW_SYNC_TEST_OUTPUT);
    await dialog.waitFor({state:"hidden"});
    await menu("同步文字与结构");
    await dialog.getByText("文字与结构已一致").waitFor().catch(async e=>{throw new Error((await dialog.innerText())+" / "+e.message);});
    assert.deepEqual(await box(),resized);
    const names=await tree.innerText();
    assert(names.includes("公告") && names.includes("帮助") && !names.includes("底部"));
    await page.setViewportSize({width:420,height:500});
    const small=await box();
    assert(small.width<=404 && small.height<=484);
    await button("关闭同步窗").click();
    assert.deepEqual(errors,[]);
    console.log("PASS page PSD bidirectional sync, editable copy, reopen, fixed geometry and manual resize");
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
