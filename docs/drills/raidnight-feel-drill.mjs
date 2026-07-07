// Raid Night feel-pass drill: proves the post-wipe decision surface answers the
// four questions, and that after a fix the next pull reports whether it mattered.
// wipe → cause + projected effects visible → apply ONE fix → receipt visible →
// re-pull → "Last pull" delta shows improved / mattered / overtaken.
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
const text = () => page.evaluate(() => document.body.innerText);

await page.goto(`http://127.0.0.1:${server.address().port}${BASE}`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await click("raid night|團本之夜");
await page.waitForTimeout(400);

const out = { errs };

// Pull to the first wipe.
for (let i = 0; i < 6; i++) {
  await click("Pull the Boss|Pull Again|開怪|再次開怪");
  await page.waitForTimeout(300);
  if (/WIPE|團滅/i.test(await text())) break;
}
let body = await text();
out.wipe = /WIPE|團滅/i.test(body);

// Q1–Q4 legible: cause chip present, each fix shows lever tag + projected effect + tradeoff.
out.q3_causeShown = await page.evaluate(() => !!document.querySelector(".raid-cause .raid-cause-tag")?.textContent?.trim());
out.q4_fixesHaveLeverTag = await page.evaluate(() =>
  [...document.querySelectorAll(".raid-fix")].length > 0 &&
  [...document.querySelectorAll(".raid-fix")].every((f) => f.querySelector(".raid-fix-lever")?.textContent?.trim()));
out.q4_fixesHaveProjection = await page.evaluate(() =>
  [...document.querySelectorAll(".raid-fix .raid-fix-proj")].every((p) => (p.textContent || "").includes("→")));
out.leversAreDistinct = await page.evaluate(() =>
  new Set([...document.querySelectorAll(".raid-fix")].map((f) => f.getAttribute("data-lever"))).size >= 2);
await page.screenshot({ path: "/tmp/claude-0/-home-user/e5fc34d9-bf66-5d16-bd4a-2fff1c817b29/scratchpad/raidnight-feel.png" });

// Apply exactly one fix → receipt appears; fix buttons gate.
out.appliedOneFix = await click("^Apply$|^採用$");
await page.waitForTimeout(250);
body = await text();
out.receiptShown = /Changed before next pull|下次開怪前的變更/i.test(body);
out.gatedToOne = await page.evaluate(() => [...document.querySelectorAll(".raid-fix button")].every((b) => b.disabled));

// Re-pull → the "Last pull" delta reports whether the fixed factor mattered.
await click("Pull the Boss|Pull Again|開怪|再次開怪");
await page.waitForTimeout(300);
body = await text();
out.deltaShown = /Last pull|上次開怪/i.test(body);
out.deltaIsGrounded = await page.evaluate(() => {
  const d = document.querySelector(".raid-delta")?.textContent || "";
  // grounded = mentions the check by name in quotes and a number, or a CLEARED/held/moved verdict
  return /".+"/.test(d) && (/→|short|held|CLEARED|moved|variance/i.test(d));
});
out.deltaText = await page.evaluate(() => (document.querySelector(".raid-delta")?.textContent || "").trim().slice(0, 180));

console.log(JSON.stringify(out, null, 2));
await browser.close(); server.close();
