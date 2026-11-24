const assert = require("node:assert/strict");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ channel:process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless:true });
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
    await menu("PSD 同步");
    const dialog=page.getByRole("dialog",{name:"PSD 同步"});
    const tree=dialog.getByRole("navigation"), button=(name)=>dialog.getByRole("button",{name,exact:true});
    const box=()=>dialog.boundingBox();
    await tree.getByText("4 项差异",{exact:false}).waitFor();
    const startRow=tree.locator('.layer-name[title="开始"]');
    assert.equal(await startRow.locator(".sync-change-slot").textContent(),"","unchanged node keeps an empty marker slot");
    const startParts=await startRow.evaluate(row=>[...row.children].map(child=>child.matches("span")?"name":child.matches(".sync-change-slot")?"marker":child.matches(".layer-variable")?"variable":"icon"));
    assert.deepEqual(startParts,["icon","name","marker","variable"],"empty marker slot stays between the name and variable badge");
    const previews=dialog.locator(".sync-preview"), selectedName=dialog.locator(".sync-bar > strong");
    await previews.nth(0).locator('[data-node-id="help0001"]').click();
    assert.equal(await selectedName.innerText(),"帮助","prototype preview directly selects its node");
    const psdSurface=await previews.nth(1).locator(".sync-surface").boundingBox();
    await page.mouse.click(psdSurface.x+psdSurface.width*80/320,psdSurface.y+psdSurface.height*160/240);
    assert.equal(await selectedName.innerText(),"公告","PSD image preview selects the topmost frame at the click position");
    const initial=await box();
    await tree.getByRole("button",{name:"折叠开始"}).click();
    await tree.getByRole("button",{name:"展开开始"}).click();
    const labelRow=tree.locator('.layer-name[title="文案"]');
    assert.equal(await labelRow.locator(".sync-change-slot").textContent(),"~","changed node shows its marker outside the name");
    await labelRow.click();
    await button("采用PSD").click();
    assert.deepEqual(await box(),initial);
    const footerRow=tree.locator('.layer-name[title="底部"]');
    assert.equal(await footerRow.locator(".sync-change-slot").textContent(),"−");
    await footerRow.click();
    await button("从原型删除").click();
    await button("预演应用").click();
    assert.deepEqual(await box(),initial);
    assert.equal(await button("拖动调整同步窗口大小").count(),0);
    const southeastEdge=dialog.locator('.sync-resize-edge[data-edge="se"]');
    assert.equal(await southeastEdge.evaluate(element=>getComputedStyle(element).cursor),"nwse-resize");
    const edgeBounds=await southeastEdge.boundingBox();
    const start={x:edgeBounds.x+edgeBounds.width/2,y:edgeBounds.y+edgeBounds.height/2};
    const inset={x:initial.x+initial.width-start.x,y:initial.y+initial.height-start.y};
    const target={x:start.x-60,y:start.y-40};
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:5});await page.mouse.up();
    const resized=await box();
    assert(Math.abs(resized.width-(initial.width-120))<=3 && Math.abs(resized.height-(initial.height-80))<=3,"centered dialog size follows double pointer movement");
    assert(Math.abs(resized.x+resized.width-target.x-inset.x)<=3 && Math.abs(resized.y+resized.height-target.y-inset.y)<=3,"resize border stays under the pointer");
    const download=page.waitForEvent("download");
    await button("确认应用").click();
    const output=await download;
    if(process.env.GAMEFLOW_SYNC_TEST_OUTPUT) await output.saveAs(process.env.GAMEFLOW_SYNC_TEST_OUTPUT);
    await dialog.waitFor({state:"hidden"});
    await menu("PSD 同步");
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
