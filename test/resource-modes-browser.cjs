const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const ag = require("ag-psd");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");
(async()=>{
  const browser=await chromium.launch({channel:"msedge",headless:true});
  const context=await browser.newContext({viewport:{width:1500,height:1000},acceptDownloads:true});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"gameflow-resource-modes-"));
  try{
    await page.goto((process.env.GAMEFLOW_TEST_URL||"http://127.0.0.1:5191")+"/?sample=ui-components");
    await page.getByRole("button",{name:"原型资源",exact:true}).waitFor();
    assert.equal(await page.getByRole("button",{name:"原型资源",exact:true}).getAttribute("aria-pressed"),"true");
    await page.locator('canvas[data-resource-path^="builtin/"]').first().waitFor();
    await page.getByRole("button",{name:"预制体资源",exact:true}).click();
    await page.locator('[data-resource-status="error"]').first().waitFor();
    await page.getByRole("button",{name:"原型资源",exact:true}).click();
    await page.locator('canvas[data-resource-path^="builtin/"]').first().waitFor();
    // Exercise generation and parsing in the real browser Canvas/worker environment.
    const generated=await page.evaluate(async()=>{
      const generator=await import("/runtime/prototype-psd.ts"),io=await import("/psd/io.ts");
      const document={schemaVersion:5,documentId:"browser-modes-test",title:"测试",requirements:[],interactions:[],pages:[{id:"page",name:"登录",kind:"screen",frame:{x:0,y:0,width:320,height:240},nodes:[{id:"button",name:"登录按钮",type:"button",frame:{x:20,y:20,width:180,height:48},normalSkin:{builtin:"button/green"},selectedSkin:{builtin:"button/yellow"}},{id:"caption",name:"登录文字",type:"text",text:"登录",parentId:"button",frame:{x:0,y:0,width:180,height:48},widget:{valign:"middle"},style:{fontSize:22,textAlign:"center",color:"#333333"}}]}]};
      const bytes=await generator.generatePrototypePsd(document,document.pages[0]);
      const asset=await io.openPsd(new File([bytes],"login.psd"));
      const base64=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(""));
      return {base64,layers:asset.asset.layers.map(l=>({name:l.name,metadata:l.metadata,enabled:l.config.enabled,image:!!l.image}))};
    });
    assert.ok(generated.layers.some(l=>l.name==="@normal"&&l.enabled&&l.image));
    assert.ok(generated.layers.some(l=>l.name==="@selected"&&l.enabled&&l.image));
    assert.ok(generated.layers.some(l=>l.name==="登录文字"&&!l.enabled));
    fs.writeFileSync(path.join(output,"login.psd"),Buffer.from(generated.base64,"base64"));
    ag.initializeCanvas(()=>{throw new Error("unused canvas");},(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}));
    const rgba=(width,height,color)=>({width,height,data:new Uint8ClampedArray(Array.from({length:width*height},()=>color).flat())});
    const grouped=ag.writePsdBuffer({width:16,height:16,imageData:rgba(16,16,[0,0,0,0]),children:[{name:"@normal",children:[{name:"red",left:2,top:1,imageData:rgba(8,8,[255,0,0,255])},{name:"blue",left:6,top:5,imageData:rgba(4,4,[0,0,255,255])}]}]},{generateThumbnail:false});
    const groupResult=await page.evaluate(async base64=>{const io=await import("/psd/io.ts"),bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const {asset}=await io.openPsd(new File([bytes],"group.psd")),group=asset.layers.find(l=>l.name==="@normal");const image=new Image();image.src=group.image;await image.decode();const c=document.createElement("canvas");c.width=image.width;c.height=image.height;const ctx=c.getContext("2d");ctx.drawImage(image,0,0);return{width:group.width,height:group.height,limitation:group.limitation,overlap:Array.from(ctx.getImageData(5,5,1,1).data)};},grouped.toString("base64"));
    assert.deepEqual(groupResult,{width:8,height:8,limitation:undefined,overlap:[0,0,255,255]});
    // Real output adapters run against sandboxed in-memory directory handles.
    await page.evaluate(()=>{
      const roots=[];
      function directory(name){const entries=new Map();const missing=()=>new DOMException("missing","NotFoundError");return{name,entries,async *keys(){yield*entries.keys();},async getDirectoryHandle(name,{create=false}={}){if(!entries.has(name)){if(!create)throw missing();entries.set(name,directory(name));}return entries.get(name);},async getFileHandle(name,{create=false}={}){if(!entries.has(name)){if(!create)throw missing();entries.set(name,{bytes:new Uint8Array(),async getFile(){return new File([this.bytes],name);},async createWritable(){const file=this;let draft;return{async write(bytes){draft=new Uint8Array(bytes);},async close(){file.bytes=draft;},async abort(){}};}});}return entries.get(name);},async removeEntry(name){entries.delete(name);}};}
      window.showDirectoryPicker=async()=>{const root=directory(roots.length?"prefabs":"resources");roots.push(root);return root;};window.testRoots=roots;
    });
    await page.getByRole("button",{name:"工作台设置",exact:true}).click();
    await page.getByRole("button",{name:"选择资源导出根目录",exact:true}).click();
    await page.getByRole("button",{name:"选择预制体导出根目录",exact:true}).click();
    await page.getByRole("button",{name:"完成",exact:true}).click();
    await page.getByRole("button",{name:"导出 Prefab",exact:true}).click();
    await page.waitForFunction(()=>window.testRoots?.[1]?.entries.size>0);
    await page.getByRole("button",{name:"预制体资源",exact:true}).click();
    await page.locator('canvas[data-resource-path^="builtin/"]').first().waitFor();
    // Enter editing, choose a button, open its builtin picker and inspect all categories.
    const firstPage=page.locator(".page-group").first();await firstPage.locator(".page-caption").dblclick();
    await page.waitForSelector(".page-editing");
    await page.getByRole("button",{name:"直选模式",exact:true}).click();
    const button=page.locator(".page-editing .node-button").first();await button.click({position:{x:3,y:3}});
    await page.setViewportSize({width:420,height:760});
    const imageField=page.locator('.image-slot-field[data-image-slot="normalSkin"]');
    await imageField.scrollIntoViewIfNeeded();
    const controlBounds=await imageField.locator('.image-slot-control').boundingBox(),inspectorBounds=await page.locator('.inspector').boundingBox();
    assert.ok(controlBounds.x>=inspectorBounds.x&&controlBounds.x+controlBounds.width<=inspectorBounds.x+inspectorBounds.width,"image resource selector stays inside the narrow inspector");
    await page.setViewportSize({width:1500,height:1000});
    await page.getByRole("button",{name:/^选择普通图片/}).click();
    await page.getByRole("dialog",{name:"内置图片资源",exact:true}).waitFor();
    for(const name of ["按钮","色块","圆形","图标","单选/复选"])assert.equal(await page.getByRole("dialog",{name:"内置图片资源"}).getByRole("button",{name,exact:true}).count(),1);
    const picker=page.getByRole("dialog",{name:"内置图片资源",exact:true});
    const pickerBounds=await picker.boundingBox();
    for(const name of ["按钮","色块","圆形","图标","单选/复选"]){
      await picker.getByRole("button",{name,exact:true}).click();
      assert.deepEqual(await picker.boundingBox(),pickerBounds,"switching to "+name+" must keep picker bounds stable");
    }
    const search=picker.getByRole("textbox",{name:"搜索内置图片",exact:true});
    await search.fill("不存在的图片 no-matching-image");
    assert.equal(await picker.locator(".builtin-image-grid button").count(),0);
    assert.deepEqual(await picker.boundingBox(),pickerBounds,"empty search must keep picker bounds stable");
    await search.fill("");
    assert.deepEqual(await picker.boundingBox(),pickerBounds,"clearing search must keep picker bounds stable");
    await page.getByRole("button",{name:"图标",exact:true}).click();
    assert.equal(await page.locator(".builtin-image-grid button").count(),28);
    await page.screenshot({path:path.join(output,"image-picker.png")});
    for(const viewport of [{width:420,height:600},{width:360,height:480},{width:600,height:320}]){
      await page.setViewportSize(viewport);
      const bounds=await picker.boundingBox();
      assert.equal(bounds.width,Math.min(600,viewport.width-32));
      assert.equal(bounds.height,Math.min(520,viewport.height-32));
      assert.ok(bounds.x>=16&&bounds.y>=16&&bounds.x+bounds.width<=viewport.width-16&&bounds.y+bounds.height<=viewport.height-16,"picker stays within viewport margins");
      for(const name of ["按钮","图标","色块"]){
        await picker.getByRole("button",{name,exact:true}).click();
        assert.deepEqual(await picker.boundingBox(),bounds,"responsive category changes keep picker bounds stable");
      }
      await search.fill("no-matching-image");
      assert.deepEqual(await picker.boundingBox(),bounds,"responsive empty search keeps picker bounds stable");
      await search.fill("");
      assert.ok(await picker.locator(".builtin-image-grid").evaluate(el=>el.clientHeight>0&&el.scrollHeight>el.clientHeight),"only the resource grid scrolls in small windows");
      if(viewport.width===360)await page.screenshot({path:path.join(output,"image-picker-narrow.png")});
    }
    await page.setViewportSize({width:1500,height:1000});
    assert.deepEqual(await picker.boundingBox(),pickerBounds,"restoring viewport restores picker bounds");
    await page.screenshot({path:path.join(output,"image-picker-blocks.png")});
    await picker.getByRole("button",{name:"浅灰色块",exact:true}).click();
    await picker.waitFor({state:"hidden"});
    assert.match(await page.locator('.image-slot-field[data-image-slot="normalSkin"] .image-slot-value').innerText(),/浅灰色块/);
    await page.getByRole("button",{name:/^选择普通图片/}).click();
    await picker.waitFor();
    assert.deepEqual(await picker.boundingBox(),pickerBounds,"reopening keeps picker bounds stable");
    await page.getByRole("button",{name:"关闭图片资源",exact:true}).click();
    await page.locator('.image-slot-field[data-image-slot="normalSkin"] .image-slot-art-toggle').click();
    await page.getByRole("textbox",{name:"资源路径",exact:true}).fill("unclassified/missing.png");
    await page.getByRole("textbox",{name:"资源路径",exact:true}).press("Enter");
    const beforeCancel=await page.evaluate(()=>Array.from(window.testRoots[1].entries.values()).map(file=>Array.from(file.bytes)));
    await page.getByRole("button",{name:"导出 Prefab",exact:true}).click();
    const missingDialog=page.getByRole("dialog",{name:"有资源缺失，是否继续导出？",exact:true});await missingDialog.waitFor();
    await missingDialog.getByRole("button",{name:"取消",exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>Array.from(window.testRoots[1].entries.values()).map(file=>Array.from(file.bytes))),beforeCancel);
    await page.getByRole("button",{name:"导出 Prefab",exact:true}).click();
    await missingDialog.getByRole("button",{name:"仍然导出",exact:true}).click();
    await page.waitForFunction(()=>Array.from(window.testRoots[1].entries.values()).some(file=>new TextDecoder().decode(file.bytes).includes("unclassified/missing.png")));
    await page.getByRole("button",{name:"原型资源",exact:true}).click();
    await page.getByRole("button",{name:"运行预览",exact:true}).click();
    const preview=page.getByRole("dialog",{name:"运行预览"});await preview.waitFor();
    assert.equal(await preview.getByRole("group",{name:"预览资源显示模式"}).getByRole("button").count(),3);
    await preview.getByRole("combobox",{name:"预览页面"}).selectOption({label:"游戏控件 · 状态预览"});
    const ring=preview.locator('canvas[data-resource-path="builtin/progress/ring_fill.png"]');await ring.waitFor();
    const ringBounds=await ring.boundingBox(),stageBounds=await preview.locator(".runtime-page").boundingBox();
    assert.ok(ringBounds&&stageBounds,"circular progress and runtime stage must have visible bounds");
    assert.ok(ringBounds.x>=stageBounds.x&&ringBounds.y>=stageBounds.y&&ringBounds.x+ringBounds.width<=stageBounds.x+stageBounds.width+1&&ringBounds.y+ringBounds.height<=stageBounds.y+stageBounds.height+1,"circular progress stays inside the page");
    const alpha=await ring.evaluate(c=>{const ctx=c.getContext("2d");return{right:ctx.getImageData(Math.round(c.width*.88),Math.round(c.height*.5),1,1).data[3],left:ctx.getImageData(Math.round(c.width*.12),Math.round(c.height*.5),1,1).data[3]};});
    assert.ok(alpha.right>0);assert.equal(alpha.left,0);
    await page.screenshot({path:path.join(output,"runtime-preview.png")});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,checks:["default prototype mode","missing disk diagnostic","PSD state layers and editable labels roundtrip","builtin Prefab actual export","exported disk resource preview","compact image resource field within narrow inspector","five-category picker with 28 icons","fixed picker bounds across categories and empty search","responsive picker at 420x600, 360x480 and 600x320","block selection and picker reopening","three-mode runtime preview","grouped PSD state composition","cancel and continue missing-resource dialog","circular progress pixel clipping"],output},null,2));
  }catch(error){await page.screenshot({path:path.join(output,"failure.png")});console.error("Browser artifacts:",output);console.error("Page errors:",errors);throw error;}
  finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
