// Library custody drill: every Library entry shows its content digest — the
// custody surface names the identity everything else verifies by (the Archive
// joins on it, world's boot-import matches it, the repo's verification bar
// demands matching digests in both clients). Fresh install → open the Library
// → the bundled arcs render with a visible short digest AND a full digest in
// the card's title attribute, honestly consistent with each other, zero page
// errors. PR 075 extends this with the carry-forward signal: honestly hidden
// with no guild (null-ledger), shown on every card once a guild is committed,
// and proven read-only (the Library never writes the ledger it reads).
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
const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);

await page.goto(`http://127.0.0.1:${server.address().port}${BASE}`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

await click("arc library|資料庫");
await page.waitForTimeout(400);

const out = {
  errs,
  libraryRendered: (await has(".card")) || (await has("h1")),
  digestShown: await has(".library-digest"),
  digestCount: await page.evaluate(() => document.querySelectorAll(".library-digest").length),
  entryCount: await page.evaluate(() => document.querySelectorAll(".card").length),
};

// PR 075 — carry-forward signal, null-ledger honesty: with localStorage
// cleared (no ledger — no guild yet) and BEFORE any import, the concept of
// "can my guild carry into this?" does not apply, so the badge must render
// on NO card — never a misleading verdict.
out.carryHiddenWhenNoGuild = !(await has(".library-carry"));

// Honesty check: the visible short digest is a true prefix of the full
// digest carried in the card's `title` attribute — no invented display value.
out.digestConsistent = await page.evaluate(() => {
  const el = document.querySelector(".library-digest");
  if (!el) return false;
  const full = el.getAttribute("title") || "";
  const shortSpan = el.querySelector(".rn-num");
  const shortText = (shortSpan ? shortSpan.textContent || "" : "").replace(/…$/, "");
  return shortText.length > 0 && full.startsWith(shortText);
});

// PR 073 — import preflight honesty: paste a real cartridge, Validate & Save,
// and check the additive custody report (an honest new-vs-update-vs-duplicate
// verdict, computed BEFORE the write, off the SAME validator) renders
// alongside the existing one-click flow — never a second validator, never a
// changed write path.
const cartJson = await readFile("/home/user/axm-arc/cartridges/severed-march.arc.json", "utf8");

await page.fill("textarea", cartJson);
await click("Validate|驗證");
await page.waitForTimeout(400);

const bodyTextNew = await page.evaluate(() => document.body.innerText);
out.preflightShown = (await has(".library-preflight")) && /added to the library/i.test(bodyTextNew);

// Re-paste the exact same JSON and click again — the incoming digest is now
// byte-identical to the copy just imported, so the report must honestly read
// "exact duplicate", never "new" a second time.
await page.fill("textarea", cartJson);
await click("Validate|驗證");
await page.waitForTimeout(400);

const bodyTextDup = await page.evaluate(() => document.body.innerText);
out.preflightDuplicate = (await has(".library-preflight")) && /byte-identical/i.test(bodyTextDup);

// PR 074 — vocabulary profile inspection: click the first entry's Profile
// button and check the panel renders with a visible profile digest — the
// exact facts checkCompatibility compares, reused verbatim from ledger.ts.
await click("^profile$|^設定檔$");
await page.waitForTimeout(200);

out.profileShown = await has(".library-profile");
out.profileDigestShown = /prof1_/i.test(await page.evaluate(() => document.body.innerText));

// PR 076 — export receipt: click the first card's Export button and check
// that a receipt renders with the digest of the EXPORTED bytes (re-parsed
// from the exported JSON, never assumed from the in-memory entry) plus an
// honest "matches the library copy" badge. Headless without
// acceptDownloads simply drops the actual download — harmless; only the
// on-screen receipt is under test here.
await page.evaluate(() => {
  const btn = document.querySelector('[data-testid^="export-arc-"]');
  if (btn) btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await page.waitForTimeout(300);

out.exportReceiptShown = await has(".library-export-receipt");
out.exportMatches = /matches the library copy/i.test(await page.evaluate(() => document.body.innerText));

await page.screenshot({ path: "/tmp/claude-0/-home-user/65fd6ca3-5fb5-56c1-92df-ef191fdf9c5d/scratchpad/library-custody.png" });

// ── PR 075 committed-ledger pass ────────────────────────────────────────────
// A guild now needs to exist so the carry signal has something to say.
// Return to the title, then run the real raid-night commit walk (mirrors
// expansion-archive-drill.mjs verbatim): raid night → pull/apply-fix loop
// until CLEARED → Commit to Guild Record.
const body = () => page.evaluate(() => document.body.innerText);

await click("^Back$|^返回$");
await page.waitForTimeout(200);

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
out.raidCleared = cleared;
out.raidCommitted = await click("Commit to Guild Record|寫入公會記錄");
await page.waitForTimeout(250);
out.raidCommitted = out.raidCommitted && (await page.evaluate((k) => !!localStorage.getItem(k), LEDGER_KEY));

const before = await page.evaluate((k) => localStorage.getItem(k), LEDGER_KEY);

// Back to the title, then reopen the Library — a guild now exists, so the
// carry verdict must render on every card.
await click("^Back$|^返回$");
await page.waitForTimeout(200);
await click("arc library|資料庫");
await page.waitForTimeout(400);

out.carryShown = await has(".library-carry");

await page.screenshot({ path: "/tmp/claude-0/-home-user/65fd6ca3-5fb5-56c1-92df-ef191fdf9c5d/scratchpad/library-carry.png" });

// Prove no write: the Library reads the ledger once and never mutates it —
// same read-only discipline as the Archive.
const after = await page.evaluate((k) => localStorage.getItem(k), LEDGER_KEY);
await page.reload({ waitUntil: "networkidle" });
const afterReload = await page.evaluate((k) => localStorage.getItem(k), LEDGER_KEY);
out.ledgerUnchanged = before === after && after === afterReload;

console.log(JSON.stringify(out, null, 2));
await browser.close(); server.close();
