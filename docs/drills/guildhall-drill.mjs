// Guild Hall route drill: the Hall opens from the title and renders read-only —
// empty-hall state on a fresh install (no committed ledger), zero page errors.
import { chromium } from "playwright-core";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";

const ROOT = "/home/user/axm-arc/docs/game", BASE = "/axm-arc/game/";
const TYPES = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".webmanifest":"application/manifest+json",".png":"image/png",".woff2":"font/woff2" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.startsWith(BASE)) p = p.slice(BASE.length - 1);
  if (p === "/" || p === "") p = "/index.html";
  try { res.writeHead(200, { "content-type": TYPES[extname(p)] || "text/plain" }); res.end(await readFile(join(ROOT, p))); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}${BASE}`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /guild hall|公會大廳/i.test(x.textContent || ""));
  b?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await page.waitForTimeout(300);
const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const out = {
  errs,
  routeRendered: await has(".guild-hall"),
  // Fresh install → no committed ledger → honest empty hall, not a fabricated one.
  emptyHallShown: await has(".guild-hall-empty"),
};
await page.screenshot({ path: "/tmp/claude-0/-home-user/e5fc34d9-bf66-5d16-bd4a-2fff1c817b29/scratchpad/guildhall.png" });
console.log(JSON.stringify(out, null, 2));
await browser.close(); server.close();
