// Raid Night UI drill: title → Raid Night → pull → (wipe) diagnosis visible →
// apply one fix → pull again. Proves the acceptance loop and that the diagnosis
// is on the page (no debug panel).
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
const click = (re) => page.evaluate((r) => {
  const b = [...document.querySelectorAll("button")].find((x) => new RegExp(r, "i").test(x.textContent || ""));
  if (!b) return false; b.dispatchEvent(new MouseEvent("click", { bubbles: true })); return true;
}, re);
const text = () => page.evaluate(() => document.body.innerText);

await page.goto(`http://127.0.0.1:${server.address().port}${BASE}`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

const out = { errs };
out.openedRaidNight = await click("raid night|團本之夜");
await page.waitForTimeout(400);
let body = await text();
out.rosterVisible = /Raid Party|出戰隊伍/i.test(body) && /Bench|替補席/i.test(body);
out.bossVisible = /Hollow Choir/i.test(body);

// The real loop: pull → on wipe, read the diagnosis, apply ONE fix, pull again,
// until the guild is ready. Proves the loop converges through the diagnosis.
let sawWipe = false, appliedFixes = 0, sawDiagnosisParts = false, sawClear = false, gatedOnce = null;
for (let i = 0; i < 16; i++) {
  await click("Pull the Boss|Pull Again|開怪|再次開怪");
  await page.waitForTimeout(300);
  body = await text();
  if (/CLEARED|已通關/i.test(body)) { sawClear = true; break; }
  if (/WIPE|團滅/i.test(body)) {
    sawWipe = true;
    if (!sawDiagnosisParts) {
      sawDiagnosisParts =
        /Why we wiped|團滅原因/i.test(body) &&
        /Bottleneck|瓶頸/i.test(body) &&
        /Three things|三件事/i.test(body) &&
        /vs \d/i.test(body);
      await page.screenshot({ path: "/tmp/claude-0/-home-user/e5fc34d9-bf66-5d16-bd4a-2fff1c817b29/scratchpad/raidnight.png" });
    }
    if (await click("^Apply$|^採用$")) {
      appliedFixes++;
      await page.waitForTimeout(200);
      if (gatedOnce === null) {
        gatedOnce = await page.evaluate(() =>
          [...document.querySelectorAll(".raid-fix button")].every((b) => b.disabled));
      }
    }
  }
}
out.sawWipe = sawWipe;
out.diagnosisFullyVisible = sawDiagnosisParts;
out.fixGatedToOnePerWipe = gatedOnce;
out.fixesApplied = appliedFixes;
out.eventuallyCleared = sawClear;
console.log(JSON.stringify(out, null, 2));
await browser.close(); server.close();
