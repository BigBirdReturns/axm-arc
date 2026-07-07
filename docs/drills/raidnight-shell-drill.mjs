// Raid Night shell-region check: the main screen renders as an AXM-WORLD dark
// runtime — top bar, left roster panel, center encounter panel, right memory
// panel, bottom action strip — not a debug page.
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
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}${BASE}`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /raid night|團本之夜/i.test(x.textContent || ""));
  b?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await page.waitForTimeout(400);

const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const bg = await page.evaluate(() => getComputedStyle(document.querySelector(".raid-shell")).backgroundColor);
const out = {
  errs,
  region_topbar: await has(".rn-topbar"),
  region_leftRoster: await has(".rn-left .rn-rolegroup .rn-agent"),
  region_centerEncounter: await has(".rn-center .rn-encounter"),
  region_rightPanel: await has(".rn-right"),
  region_bottomStrip: await has(".rn-bottom .rn-bottom-actions"),
  darkShell: /rgb\(1[0-9]|rgb\(([0-9]|1[0-9]|2[0-9]),/.test(bg) || bg === "rgb(13, 12, 10)",
  shellBg: bg,
  // strong state chips + mono numbers present
  chips: await has(".rn-chip"),
  monoNumbers: await has(".rn-num"),
};
await page.screenshot({ path: "/tmp/claude-0/-home-user/e5fc34d9-bf66-5d16-bd4a-2fff1c817b29/scratchpad/raidnight-shell.png" });
console.log(JSON.stringify(out, null, 2));
await browser.close(); server.close();
