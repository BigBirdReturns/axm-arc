// Library custody drill: every Library entry shows its content digest — the
// custody surface names the identity everything else verifies by (the Archive
// joins on it, world's boot-import matches it, the repo's verification bar
// demands matching digests in both clients). Fresh install → open the Library
// → the bundled arcs render with a visible short digest AND a full digest in
// the card's title attribute, honestly consistent with each other, zero page
// errors.
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

await page.screenshot({ path: "/tmp/claude-0/-home-user/65fd6ca3-5fb5-56c1-92df-ef191fdf9c5d/scratchpad/library-custody.png" });

console.log(JSON.stringify(out, null, 2));
await browser.close(); server.close();
