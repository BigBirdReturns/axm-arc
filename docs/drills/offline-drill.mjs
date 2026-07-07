// Generic PWA offline drill: node offline-drill.mjs <rootDir> <basePath> <mustContainText>
import { chromium } from "playwright-core";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";

const [ROOT, BASE, MUST] = process.argv.slice(2);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".webmanifest": "application/manifest+json", ".json": "application/json",
  ".png": "image/png", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.startsWith(BASE)) p = p.slice(BASE.length - 1); // keep leading /
  if (p === "/" || p === "") p = "/index.html";
  try {
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "text/plain" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const URL = `http://127.0.0.1:${port}${BASE}`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const external = [];
const errors = [];
page.on("request", (r) => { const u = r.url(); if (!u.startsWith(`http://127.0.0.1:${port}`)) external.push(u); });
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: "networkidle" });
// wait for SW to control the page (reload once after activation)
await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.reload({ waitUntil: "networkidle" });
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
await page.waitForTimeout(800); // let runtime caching settle

// go offline, reload — must still boot
await ctx.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(1200);
const offlineText = await page.evaluate(() => document.body.innerText).catch(() => "");
const offlineBoot = offlineText.includes(MUST);

console.log(JSON.stringify({
  controlled,
  offlineBoot,
  offlineSample: offlineText.replace(/\s+/g, " ").slice(0, 160),
  externalRequests: [...new Set(external)].slice(0, 5),
  pageErrors: errors.slice(0, 4),
}, null, 2));
await browser.close();
server.close();
