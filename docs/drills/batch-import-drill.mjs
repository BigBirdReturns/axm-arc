// Batch import drill: runs every cartridge through BOTH real player seams —
// arc Library (paste → Validate & Save → Load) and world boot (file upload).
// Usage: node batch-import-drill.mjs
import { chromium } from "playwright-core";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";

const CARTS = [
  { path: "/home/user/axm-arc/cartridges/deepway-rescue.arc.json",
    name: "Deepway Rescue Guild", vocab: /Marks|Expedition Slots|Guild Standing|Salvaged Kit/i,
    challenge: /lost-surveyor|Lost Surveyor/i },
  { path: "/home/user/axm-arc/cartridges/wandering-court.arc.json",
    name: "The Wandering Court", vocab: /Gleam|Summons|Court Favor|Relic Dust/i,
    challenge: /bandit-toll|Bandit Toll/i },
  { path: "/home/user/axm-arc/cartridges/palisade-war.arc.json",
    name: "The Palisade War", vocab: /Plunder|War Parties|Dread|Timber/i,
    challenge: /lone-watchtower|Lone Watchtower/i },
];

const TYPES = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".webmanifest":"application/manifest+json", ".png":"image/png", ".woff2":"font/woff2", ".json":"application/json" };

function serve(root, base) {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.startsWith(base)) p = p.slice(base.length - 1);
    if (p === "/" || p === "") p = "/index.html";
    try { const b = await readFile(join(root, p));
      res.writeHead(200, { "content-type": TYPES[extname(p)] || "text/plain" }); res.end(b);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise(r => server.listen(0, () => r(server)));
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const results = {};

// ---- ARC LIBRARY SEAM ----
{
  const ROOT = "/home/user/axm-arc/docs/game", BASE = "/axm-arc/game/";
  const server = await serve(ROOT, BASE);
  for (const cart of CARTS) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errs = []; page.on("pageerror", e => errs.push(e.message));
    page.on("dialog", d => d.accept());
    const closeOv = async () => { for (let i = 0; i < 3; i++) {
      const c = await page.evaluate(() => { const b = document.querySelector(".codex-close");
        if (b) { b.dispatchEvent(new MouseEvent("click", { bubbles: true })); return true; } return false; });
      if (!c) break; await page.waitForTimeout(150); } };
    const cartJson = await readFile(cart.path, "utf8");
    await page.goto(`http://127.0.0.1:${server.address().port}${BASE}`, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.evaluate(() => { [...document.querySelectorAll(".title-actions button")]
      .find(b => /library/i.test(b.textContent || ""))?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    await page.waitForTimeout(300);
    await page.fill("textarea", cartJson);
    await page.evaluate(() => { [...document.querySelectorAll("button")]
      .find(b => /Validate|驗證/.test(b.textContent || ""))?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    await page.waitForTimeout(400);
    const afterImport = await page.evaluate(() => document.body.innerText);
    const nameRe = new RegExp(cart.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const imported = nameRe.test(afterImport);
    await page.evaluate((name) => {
      const card = [...document.querySelectorAll(".card")].find(c => new RegExp(name, "i").test(c.textContent || ""));
      [...(card?.querySelectorAll("button") || [])].find(b => /^(Load|載入)$/.test(b.textContent?.trim() || ""))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }, cart.name);
    await page.waitForTimeout(600);
    await closeOv();
    const title = await page.evaluate(() => document.body.innerText);
    await page.evaluate(() => { [...document.querySelectorAll(".title-actions button")]
      .find(b => /new game|begin|start/i.test(b.textContent || ""))?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    await page.waitForTimeout(700);
    await closeOv();
    const play = await page.evaluate(() => document.body.innerText);
    results[`arc:${cart.name}`] = {
      imported,
      loadedOnTitle: nameRe.test(title) && cart.vocab.test(title),
      playShowsVocab: cart.vocab.test(play),
      playShowsChallenge: cart.challenge.test(play),
      errs,
      sample: play.replace(/\s+/g, " ").slice(0, 160),
    };
    await page.close();
  }
  server.close();
}

// ---- WORLD BOOT SEAM ----
{
  const ROOT = "/home/user/axm-world/docs/game", BASE = "/axm-world/game/";
  const server = await serve(ROOT, BASE);
  for (const cart of CARTS) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errs = []; page.on("pageerror", e => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}${BASE}`, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const input = await page.$("input[type=file]");
    if (!input) { results[`world:${cart.name}`] = { fail: "no file input on boot screen" }; await page.close(); continue; }
    await input.setInputFiles(cart.path);
    await page.waitForTimeout(900);
    const boot = await page.evaluate(() => document.body.innerText);
    const nameRe = new RegExp(cart.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    await page.evaluate((name) => {
      const btns = [...document.querySelectorAll("button, a")];
      const b = btns.find(x => new RegExp(name, "i").test(x.closest("article,section,div")?.textContent || "")
        && /enter|進入|resume|繼續/i.test(x.textContent || ""));
      (b ?? btns.filter(x => /enter/i.test(x.textContent || "")).at(-1))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }, cart.name);
    await page.waitForTimeout(1500);
    const play = await page.evaluate(() => document.body.innerText).catch(() => "");
    results[`world:${cart.name}`] = {
      importedOnBoot: nameRe.test(boot),
      trustChip: (boot.match(/Imported \(unsigned\)|已匯入（未簽署）/) || [null])[0],
      playHeaderHasCart: nameRe.test(play),
      playHasVocab: cart.vocab.test(play),
      digestShown: (play.match(/cart1_[0-9a-f]{6}/) || [null])[0],
      errs,
      sample: play.replace(/\s+/g, " ").slice(0, 180),
    };
    await page.close();
  }
  server.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
