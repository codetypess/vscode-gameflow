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
    const output=fs.mkdtempSync(path.join(os.tmpdir(),"gameflow-default-image-"));
    await page.screenshot({path:path.join(output,"default-image.png")});console.log(output);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
