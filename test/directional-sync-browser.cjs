const assert = require("node:assert/strict");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({channel:process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge",headless:true});
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror",error=>errors.push(error.message));
    await page.addInitScript(()=>{
      const frame={x:0,y:0,width:240,height:120};
      const screen={id:"page0001",name:"登录",exportName:"登录",kind:"screen",frame,nodes:[
        {id:"text0001",name:"标题",type:"text",text:"原型初值",frame:{x:12,y:8,width:140,height:32}},
        {id:"icon0001",name:"图标",type:"image",image:{builtin:"image/default"},frame:{x:16,y:44,width:64,height:64}}
      ]};
      const doc={schemaVersion:5,elementIdScheme:"nanoid-8",documentId:"directions",title:"同步",requirements:[],interactions:[],pages:[screen]};
      localStorage.setItem("gameflow.prototype.v1",JSON.stringify(doc));
      let index=0;
      window.showDirectoryPicker=async()=>(await navigator.storage.getDirectory()).getDirectoryHandle(["resources","prefabs"][index++],{create:true});
      window.readPrototype=()=>JSON.parse(localStorage.getItem("gameflow.prototype.v1"));
      window.prefabFolder=async()=>(await navigator.storage.getDirectory()).getDirectoryHandle("prefabs");
      window.readPrefab=async()=>JSON.parse(await (await (await (await window.prefabFolder()).getFileHandle("登录.lh")).getFile()).text());
    });
    await page.goto(process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5197");
    const button=name=>page.getByRole("button",{name,exact:true});
    const item=name=>page.getByRole("menuitem",{name,exact:true});
    const pin=name=>page.getByRole("menuitemcheckbox",{name:"固定"+name,exact:true});
    const directions=["原型 → 预制体","预制体 → 原型","原型 → PSD","PSD → 原型"];
    const openSub=async()=>{
      await button("更多").click();
      await item("单向同步").focus();
      await page.keyboard.press("ArrowRight");
      await item(directions[0]).waitFor();
    };
    const run=async index=>{await openSub();await item(directions[index]).click();};
    const confirm=async index=>{
      const dialog=page.getByRole("dialog",{name:directions[index],exact:true});
      await dialog.waitFor();
      assert.equal(await dialog.getByRole("radio").count(),0);
      await dialog.getByRole("button",{name:"预演应用"}).click();
      await dialog.getByRole("button",{name:"确认应用"}).click();
      await dialog.waitFor({state:"hidden"}).catch(async e=>{throw Error(await dialog.innerText()+"\n"+e);});
    };
    assert.equal(await button("PSD 同步").count(),0);
    assert.equal(await button("预制体同步").count(),0);
    const beforePins=await page.evaluate(()=>window.readPrototype());
    await button("更多").click();
    assert(await item("单向同步").isDisabled());
    await pin("预制体同步").click();
    assert(await pin("预制体同步").isChecked());
    assert.equal(await button("PSD 同步").count(),0);
    await pin("PSD 同步").focus();
    await page.keyboard.press("Space");
    assert(await pin("PSD 同步").isChecked());
    assert(await button("PSD 同步").isDisabled());
    assert(await button("预制体同步").isDisabled());
    await page.keyboard.press("Escape");
    assert.deepEqual(await page.evaluate(()=>window.readPrototype()),beforePins);
    await page.reload();
    await button("PSD 同步").waitFor();
    const viewport=page.viewportSize();
    await page.setViewportSize({width:360,height:760});
    const [psdIcon,prefabIcon,moreIcon]=await Promise.all(["PSD 同步","预制体同步","更多"].map(name=>button(name).boundingBox()));
    assert(psdIcon.x>=0 && psdIcon.x+psdIcon.width<=prefabIcon.x && prefabIcon.x+prefabIcon.width<=moreIcon.x && moreIcon.x+moreIcon.width<=360);
    await page.setViewportSize(viewport);
    await page.locator(".page-caption").first().click();
    await openSub();
    assert.deepEqual(await item(directions[0]).locator("..").getByRole("menuitem").allTextContents(),directions);
    assert(await item(directions[3]).isDisabled());
    await page.keyboard.press("Escape");
    await button("工作台设置").click();
    await button("选择资源导出根目录").click();
    await button("选择预制体导出根目录").click();
    await button("完成").click();
    await run(1);
    await page.getByRole("status").filter({hasText:"找不到来源预制体"}).waitFor();
    assert.deepEqual(await page.evaluate(async()=>Array.fromAsync((await window.prefabFolder()).keys())),[]);
    await run(0);
    await page.waitForFunction(()=>window.readPrototype().pages[0].prefabSync);
    await button("预制体同步").click();
    await page.getByRole("dialog",{name:"预制体同步",exact:true}).waitFor();
    await button("关闭同步窗").click();
    const changeDisk=async text=>page.evaluate(async text=>{
      const root=await window.prefabFolder(), prefab=await window.readPrefab();
      prefab._$child[0].text=text;
      prefab._$child[0]._$comp=[{_$type:"CustomLabel",delay:250}];
      const stream=await (await root.getFileHandle("登录.lh")).createWritable();
      await stream.write(JSON.stringify(prefab));await stream.close();
    },text);
    await changeDisk("引擎初值");
    await run(0);
    await button("关闭同步窗").click();
    assert.equal((await page.evaluate(()=>window.readPrefab()))._$child[0].text,"引擎初值");
    await run(0);await confirm(0);
    assert.equal((await page.evaluate(()=>window.readPrefab()))._$child[0].text,"原型初值");
    await changeDisk("使用引擎文案");
    await page.evaluate(async()=>(await window.prefabFolder()).removeEntry("登录.lh.meta"));
    const beforePull=await page.evaluate(()=>window.readPrefab());
    await run(1);await confirm(1);
    assert.equal((await page.evaluate(()=>window.readPrototype())).pages[0].nodes[0].text,"使用引擎文案");
    assert.deepEqual(await page.evaluate(()=>window.readPrefab()),beforePull);
    assert.deepEqual(await page.evaluate(async()=>Array.fromAsync((await window.prefabFolder()).keys())),["登录.lh"]);

    const art=await page.evaluate(async()=>{
      const {generatePrototypePsd}=await import("/runtime/prototype-psd.ts");
      const doc=window.readPrototype(),screen=doc.pages[0];
      screen.nodes[0].text="美术文案";
      screen.nodes[1].image={builtin:"button/red"};
      return Array.from(await generatePrototypePsd(doc,screen));
    });
    await button("更多").click();
    const choose=page.waitForEvent("filechooser");
    await item("绑定 PSD").click();
    await (await choose).setFiles({name:"art.psd",mimeType:"image/vnd.adobe.photoshop",buffer:Buffer.from(art)});
    await page.waitForFunction(()=>window.readPrototype().pages[0].artPsd);
    await button("PSD 同步").click();
    await page.getByRole("dialog",{name:"PSD 同步",exact:true}).waitFor();
    await button("关闭同步窗").click();
    await button("更多").click();
    await pin("PSD 同步").click();
    assert.equal(await button("PSD 同步").count(),0);
    assert(await button("预制体同步").isVisible());
    await pin("预制体同步").click();
    assert.equal(await button("预制体同步").count(),0);
    await page.keyboard.press("Escape");
    const downloaded=page.waitForEvent("download");
    await run(2);await confirm(2);
    const output=await downloaded;
    assert.match(output.suggestedFilename(),/-sync-.*\.psd$/);
    await page.waitForFunction(name=>window.readPrototype().pages[0].artPsd.source===name,output.suggestedFilename());
    const chunks=await Array.fromAsync(await output.createReadStream());
    const copy=await page.evaluate(async bytes=>{
      const {psdTask}=await import("/psd/io.ts");
      const asset=await psdTask("read",Uint8Array.from(bytes).buffer,"copy.psd");
      return asset.layers.find(l=>l.text).textContent;
    },Array.from(Buffer.concat(chunks)));
    assert.equal(copy,"使用引擎文案");
    assert.deepEqual(await page.evaluate(()=>window.readPrefab()),beforePull);

    await button("更多").click();
    const rebind=page.waitForEvent("filechooser");
    await item("重新绑定 PSD").click();
    await (await rebind).setFiles({name:"art.psd",mimeType:"image/vnd.adobe.photoshop",buffer:Buffer.from(art)});
    await page.waitForFunction(()=>window.readPrototype().pages[0].artPsd.source==="art.psd");
    const beforeArt=await page.evaluate(()=>window.readPrototype());
    await run(3);await confirm(3);
    const fromArt=await page.evaluate(()=>window.readPrototype());
    assert.equal(fromArt.pages[0].nodes[0].text,"美术文案");
    assert.deepEqual(fromArt.pages[0].nodes[1].image,beforeArt.pages[0].nodes[1].image,"PSD-to-prototype keeps prototype image resources");
    assert.deepEqual(await page.evaluate(()=>window.readPrefab()),beforePull,"PSD-to-prototype keeps the prefab read-only");
    await run(3);
    await page.getByRole("dialog",{name:directions[3]}).waitFor();
    assert(await button("预演应用").isDisabled(),"a second PSD-to-prototype sync has no pending writes");
    await button("关闭同步窗").click();
    assert.deepEqual(errors,[]);
    console.log("PASS independent sync pins, keyboard toggling, reload, narrow toolbar, both shortcuts and four directed writes");
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
