// Guild Hall playtest drill (RFC_GUILD_HALL, PR 040 — the program's capstone):
// drive the REAL player path to commit a ledger, open the Guild Hall, and
// prove every panel renders populated with zero page errors — and that the
// Hall never writes the ledger it reads (loadLedger only, never saveLedger).
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
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
const click = (re) => page.evaluate((r) => {
  const b = [...document.querySelectorAll("button")].find((x) => new RegExp(r, "i").test(x.textContent || ""));
  if (!b) return false; b.dispatchEvent(new MouseEvent("click", { bubbles: true })); return true;
}, re);
const body = () => page.evaluate(() => document.body.innerText);
const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);

await page.goto(`http://127.0.0.1:${server.address().port}${BASE}`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

// Real commit walk (mirrors tier2-drill.mjs): raid night → pull/apply-fix loop
// until CLEARED → Commit to Guild Record. This is the only way a ledger
// becomes COMMITTED — no fixture, no localStorage seeding.
await click("raid night|團本之夜");
await page.waitForTimeout(400);
let cleared = false;
for (let i = 0; i < 24 && !cleared; i++) {
  await click("Pull the Boss|Pull Again|開怪|再次開怪");
  await page.waitForTimeout(220);
  if (/CLEARED|已通關/i.test(await body())) { cleared = true; break; }
  await click("^Apply$|^採用$");
  await page.waitForTimeout(120);
}
const out = { errs, cleared };
out.committed = await click("Commit to Guild Record|寫入公會記錄");
await page.waitForTimeout(250);
out.committed = out.committed && (await page.evaluate(() => !!localStorage.getItem("axm-arc:campaign-ledger:v1")));

const before = await page.evaluate(() => localStorage.getItem("axm-arc:campaign-ledger:v1"));

// Return to the title screen — the consequence screen's persistent footer
// always carries a Back button (RaidNightScreen.tsx), regardless of commit
// state — then open the Guild Hall from there.
await click("^Back$|^返回$");
await page.waitForTimeout(200);
await click("guild hall|公會大廳");
await page.waitForTimeout(400);

out.routeRendered = await has(".guild-hall");
// A committed ledger must render the populated hall, never the empty state.
out.emptyHallNotShown = !(await has(".guild-hall-empty"));
out.panels = {
  record: await has(".guild-hall-record"),
  tiers: await has(".guild-hall-tiers"),
  raiders: await has(".guild-hall-raiders"),
  growth: await has(".guild-hall-growth"),
  attendance: await has(".guild-hall-attendance"),
  fairness: await has(".guild-hall-fairness"),
  gear: await has(".guild-hall-gear"),
  readiness: await has(".guild-hall-readiness"),
  scars: await has(".guild-hall-scars"),
  precedents: await has(".guild-hall-precedents"),
};
out.allPanelsRendered = Object.values(out.panels).every(Boolean);

// Receipt: capture the populated Hall itself, before the no-write reload
// navigates away — this screenshot is the visual proof of the whole program.
await page.screenshot({ path: "/tmp/claude-0/-home-user/65fd6ca3-5fb5-56c1-92df-ef191fdf9c5d/scratchpad/guildhall-playtest.png", fullPage: true });

// Prove no write path: the Hall loads the ledger once and never mutates it.
const after = await page.evaluate(() => localStorage.getItem("axm-arc:campaign-ledger:v1"));
await page.reload({ waitUntil: "networkidle" });
const afterReload = await page.evaluate(() => localStorage.getItem("axm-arc:campaign-ledger:v1"));
out.ledgerUnchanged = before === after && after === afterReload;

console.log(JSON.stringify(out, null, 2));
await browser.close(); server.close();
