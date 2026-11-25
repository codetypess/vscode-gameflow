const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {chromium}=require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE||"playwright");
(async()=>{
  const browser=await chromium.launch({channel:"msedge",headless:true,args:["--disable-gpu"]});
  const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  try {
    const fixture=path.join(__dirname,"default-image-browser.html").replaceAll("\\","/");
    await page.goto((process.env.GAMEFLOW_TEST_URL||"http://127.0.0.1:5191")+"/@fs/"+fixture);
    await page.locator('pre[data-complete="true"]').waitFor();
    const result=await page.locator("pre").innerText();console.log(result);
    assert.doesNotMatch(result,/FAIL/);assert.deepEqual(errors,[]);
    const repository=path.resolve(__dirname,"..").replaceAll("\\","/");
    const sample=await page.evaluate(async repository=>{
      const {openPsd}=await import("/psd/io.ts");
      const {renderSliceExportBatch}=await import("/psd/slice-render.ts");
      const {psdLayerPath}=await import("/@fs/"+repository+"/shared/psd-export.ts");
      const bytes=await (await fetch("/@fs/"+repository+"/sample/星海远征 · 登录.psd")).blob();
      const {asset}=await openPsd(new File([bytes],"login.psd"));
      const layer=asset.layers.find(layer=>layer.metadata.builtinOrigin?.id==="image/default");
      const product=(await renderSliceExportBatch(asset)).items.find(item=>item.builtin?.id==="image/default");
      return {path:psdLayerPath(asset,layer),width:product?.width,grid:product?.nineGrid};
    },repository);
    assert.deepEqual(sample,{path:"builtin/image/default.png",width:64,grid:{left:40,right:0,top:36,bottom:0,repeat:false}});
    console.log("PASS 星海登录绑定 PSD 的默认图层复用共享九宫格");
    const output=fs.mkdtempSync(path.join(os.tmpdir(),"gameflow-default-image-"));
    await page.locator("#default-image-gallery").screenshot({path:path.join(output,"default-image.png")});console.log(output);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
