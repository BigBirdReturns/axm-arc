// Expansion Archive route drill: the Archive opens from the title and renders
// read-only — a fresh install has the bundled cartridges, so the roster
// renders even with no ledger (all unattempted), zero page errors. Then a
// real committed-ledger pass proving the UNION MODEL (PR 044): play a raid
// night to CLEARED and commit it to the guild record WITHOUT ever importing
// the raid-night cartridge into the library, then reopen the Archive and
// prove the played digest surfaces as an artifact-missing row — status still
// real (cleared), its per-expansion record (PR 043) still rendering, plus the
// "artifact missing" marker — and that the Archive never wrote the library or
// the ledger it read.
import { chromium } from "playwright-core";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";

const ROOT = "/home/user/axm-arc/docs/game", BASE = "/axm-arc/game/";
const LEDGER_KEY = "axm-arc:campaign-ledger:v1";
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

const click = (re) => page.evaluate((r) => {
  const b = [...document.querySelectorAll("button")].find((x) => new RegExp(r, "i").test(x.textContent || ""));
  if (!b) return false; b.dispatchEvent(new MouseEvent("click", { bubbles: true })); return true;
}, re);
const body = () => page.evaluate(() => document.body.innerText);
const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);

await page.goto(`http://127.0.0.1:${server.address().port}${BASE}`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await click("expansion archive|擴充典藏");
await page.waitForTimeout(400);
const out = {
  errs,
  routeRendered: await has(".expansion-archive"),
  // Fresh install → bundled cartridges but no ledger → roster still renders,
  // all rows unattempted.
  rosterShown: await has(".expansion-archive-roster"),
};
await page.screenshot({ path: "/tmp/claude-0/-home-user/65fd6ca3-5fb5-56c1-92df-ef191fdf9c5d/scratchpad/expansion-archive.png" });

// ── committed-ledger pass (union model — NOT imported into the library) ────
// Return to the title from the empty Archive.
await click("^Back$|^返回$");
await page.waitForTimeout(200);

// Deliberately skip the paste-import step this time: Raid Night always plays
// cartridges/first-lockout.arc.json (RAID_ARC), which resolveActiveArc() does
// NOT bundle into the library (only first-charter and karazhan are). By never
// importing it, the committed ledger below records a digest with no library
// counterpart — exactly the "artifact missing" case the union model (PR 044)
// must surface.
//
// Real commit walk (mirrors guildhall-playtest-drill.mjs): raid night →
// pull/apply-fix loop until CLEARED → Commit to Guild Record.
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
out.cleared = cleared;
out.committed = await click("Commit to Guild Record|寫入公會記錄");
await page.waitForTimeout(250);
out.committed = out.committed && (await page.evaluate((k) => !!localStorage.getItem(k), LEDGER_KEY));

const before = await page.evaluate((k) => localStorage.getItem(k), LEDGER_KEY);

// Back to the title, then open the Archive.
await click("^Back$|^返回$");
await page.waitForTimeout(200);
await click("expansion archive|擴充典藏");
await page.waitForTimeout(400);

out.committedLedgerArchive = {
  routeRendered: await has(".expansion-archive"),
  rosterShown: await has(".expansion-archive-roster"),
};
out.recordShown = await has(".expansion-archive-record");
out.artifactMissingShown = await has(".expansion-archive-artifact-missing");
// A committed ledger has at least one recorded night — the journey timeline
// (PR 045) must render it.
out.journeyShown = await has(".expansion-archive-journey");
// The carry-forward signal (PR 047) renders on every row (a "ready"/
// "incompatible" badge for library rows, an honest "unavailable" badge for
// the artifact-missing row) — its stable class must be present.
out.carryShown = await has(".expansion-archive-carry");
// Provenance (PR 049): every row — library or artifact-missing — shows its
// source badge (bundled/imported/ledger), reusing the same stable class.
out.sourceShown = await has(".expansion-archive-source");

// Screenshot the artifact-missing archive before the no-write reload navigates
// away — the visual proof that a committed-but-unlibraried cartridge's record
// renders as artifact-missing (the whole point of the union fix).
await page.screenshot({ path: "/tmp/claude-0/-home-user/65fd6ca3-5fb5-56c1-92df-ef191fdf9c5d/scratchpad/expansion-archive-union.png", fullPage: true });

// Prove no write path: the Archive loads the ledger once and never mutates it.
const after = await page.evaluate((k) => localStorage.getItem(k), LEDGER_KEY);
await page.reload({ waitUntil: "networkidle" });
const afterReload = await page.evaluate((k) => localStorage.getItem(k), LEDGER_KEY);
out.ledgerUnchanged = before === after && after === afterReload;

console.log(JSON.stringify(out, null, 2));
await browser.close(); server.close();
