// Tier-2 persistence UI drill: play tier 1 → clear → consequence screen →
// Commit to Guild Record → Start Next Tier → guild carried into tier 2 → prove
// the incompatible refusal surface too. The walk, in the real app.
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
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const click = (re) => page.evaluate((r) => {
  const b = [...document.querySelectorAll("button")].find((x) => new RegExp(r, "i").test(x.textContent || ""));
  if (!b) return false; b.dispatchEvent(new MouseEvent("click", { bubbles: true })); return true;
}, re);
const body = () => page.evaluate(() => document.body.innerText);

await page.goto(`http://127.0.0.1:${server.address().port}${BASE}`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await click("raid night|團本之夜");
await page.waitForTimeout(400);

const out = { errs };
out.startsFresh = /Fresh guild|全新公會/i.test(await body());

// Play tier 1 to a clear: pull, apply first fix on each wipe.
let cleared = false;
for (let i = 0; i < 24 && !cleared; i++) {
  await click("Pull the Boss|Pull Again|開怪|再次開怪");
  await page.waitForTimeout(220);
  const b = await body();
  if (/CLEARED|已通關/i.test(b)) { cleared = true; break; }
  await click("^Apply$|^採用$");
  await page.waitForTimeout(120);
}
out.clearedTier1 = cleared;
let b = await body();
out.consequenceScreen = /What this night did|這一夜為公會/i.test(b);
out.commitButton = await page.evaluate(() => [...document.querySelectorAll("button")].some((x) => /Commit to Guild Record|寫入公會記錄/i.test(x.textContent || "")));
await page.screenshot({ path: "/tmp/claude-0/-home-user/e5fc34d9-bf66-5d16-bd4a-2fff1c817b29/scratchpad/tier2-consequence.png" });

// Commit the night.
out.committed = await click("Commit to Guild Record|寫入公會記錄");
await page.waitForTimeout(250);
b = await body();
out.consequencesRemain = /consequences remain|餘波長存/i.test(b);
out.startNextTierBtn = await page.evaluate(() => [...document.querySelectorAll("button")].some((x) => /Start Next Tier|進入下一階/i.test(x.textContent || "")));

// Start tier 2 — the guild should carry.
await click("Start Next Tier|進入下一階");
await page.waitForTimeout(300);
b = await body();
out.tier2Boss = /Obsidian Conclave/i.test(b);
out.guildCarried = /Guild carried|公會延續/i.test(b);
await page.screenshot({ path: "/tmp/claude-0/-home-user/e5fc34d9-bf66-5d16-bd4a-2fff1c817b29/scratchpad/tier2-carried.png" });

// Now prove the refusal surface: re-clear tier 2 enough to commit, then try incompatible.
// (Simpler: go back, re-clear tier1, commit, and click "Try an incompatible tier".)
await click("New Guild|新公會");
await page.waitForTimeout(200);
cleared = false;
for (let i = 0; i < 24 && !cleared; i++) {
  await click("Pull the Boss|Pull Again|開怪|再次開怪");
  await page.waitForTimeout(200);
  if (/CLEARED|已通關/i.test(await body())) { cleared = true; break; }
  await click("^Apply$|^採用$");
  await page.waitForTimeout(100);
}
await click("Commit to Guild Record|寫入公會記錄");
await page.waitForTimeout(200);
await click("Try an incompatible tier|嘗試不相容");
await page.waitForTimeout(300);
b = await body();
out.incompatibleShown = /INCOMPATIBLE GUILD|公會不相容/i.test(b);
out.incompatibleHasStartFresh = await page.evaluate(() => [...document.querySelectorAll("button")].some((x) => /Start Fresh Here|在此重新開始/i.test(x.textContent || "")));
await page.screenshot({ path: "/tmp/claude-0/-home-user/e5fc34d9-bf66-5d16-bd4a-2fff1c817b29/scratchpad/tier2-refused.png" });

console.log(JSON.stringify(out, null, 2));
await browser.close(); server.close();
