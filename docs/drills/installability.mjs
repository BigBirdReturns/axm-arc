import { chromium } from "playwright-core";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";
const APPS=[
  {name:"arc", root:"/home/user/axm-arc/docs/game", base:"/axm-arc/game/"},
  {name:"world", root:"/home/user/axm-world/docs/game", base:"/axm-world/game/"},
  {name:"pta", root:"/home/user/axm-tools/pta-tracker", base:"/"},
];
const TYPES={".html":"text/html",".js":"text/javascript",".css":"text/css",".webmanifest":"application/manifest+json",".json":"application/json",".png":"image/png",".woff2":"font/woff2"};
const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
for(const app of APPS){
  const server=createServer(async(req,res)=>{let p=decodeURIComponent(req.url.split("?")[0]);if(app.base!=="/"&&p.startsWith(app.base))p=p.slice(app.base.length-1);if(p==="/"||p==="")p="/index.html";try{const b=await readFile(join(app.root,p));res.writeHead(200,{"content-type":TYPES[extname(p)]||"text/plain"});res.end(b);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,r));
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}${app.base}`,{waitUntil:"networkidle"});
  await page.waitForTimeout(1800); // let SW install
  const cdp=await page.context().newCDPSession(page);
  let manifest=null, errors=null;
  try { manifest=await cdp.send("Page.getAppManifest"); } catch(e){ manifest={err:String(e).slice(0,80)}; }
  try { errors=await cdp.send("Page.getInstallabilityErrors"); } catch(e){ errors={err:String(e).slice(0,80)}; }
  console.log(JSON.stringify({
    app: app.name,
    manifestParsed: manifest?.errors?.length===0 || (manifest?.errors??[]).every(e=>!e.critical),
    manifestErrors: (manifest?.errors??[]).slice(0,3),
    installabilityErrors: (errors?.installabilityErrors??[]).map(e=>e.errorId),
  }));
  await page.close(); server.close();
}
await browser.close();
