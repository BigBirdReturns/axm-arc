// Lifecycle drill: one continuous cartridge story.
// author (arc Workshop) -> validate -> save+play (arc Library) -> export (.arc.json)
// -> import into world (boot file upload) -> play -> identity (digest) holds.
import { chromium } from "playwright-core";
import { createServer } from "http";
import { readFile, writeFile } from "fs/promises";
import { extname, join } from "path";

const SCRATCH = "/tmp/claude-0/-home-user/e5fc34d9-bf66-5d16-bd4a-2fff1c817b29/scratchpad";
const SHOTS = join(SCRATCH, "lifecycle");
const EXPORT_PATH = join(SHOTS, "exported.arc.json");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".woff2": "font/woff2",
  ".json": "application/json" };

function serve(root, base) {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.startsWith(base)) p = p.slice(base.length - 1);
    if (p === "/" || p === "") p = "/index.html";
    try {
      const b = await readFile(join(root, p));
      res.writeHead(200, { "content-type": TYPES[extname(p)] || "text/plain" });
      res.end(b);
    } catch {
      res.writeHead(404); res.end();
    }
  });
  return new Promise(r => server.listen(0, () => r(server)));
}

function click(page, sel, re) {
  return page.evaluate(([s, r]) => {
    const b = [...document.querySelectorAll(s)].find(x => new RegExp(r, "i").test(x.textContent || ""));
    if (!b) return false;
    b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  }, [sel, re]);
}

async function closeOv(page) {
  for (let i = 0; i < 3; i++) {
    const c = await page.evaluate(() => {
      const b = document.querySelector(".codex-close");
      if (b) { b.dispatchEvent(new MouseEvent("click", { bubbles: true })); return true; }
      return false;
    });
    if (!c) break;
    await page.waitForTimeout(150);
  }
}

function shortestPrefixMatch(a, b) {
  if (!a || !b) return false;
  const n = Math.min(a.length, b.length);
  return a.slice(0, n) === b.slice(0, n);
}

const out = { stages: {}, errsArc: [], errsWorld: [] };

const arcServer = await serve("/home/user/axm-arc/docs/game", "/axm-arc/game/");
const worldServer = await serve("/home/user/axm-world/docs/game", "/axm-world/game/");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

// ---------------------------------------------------------------------
// ARC: author, validate, save+play, export
// ---------------------------------------------------------------------
const arcPage = await browser.newPage({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
arcPage.on("pageerror", e => out.errsArc.push(e.message));
arcPage.on("dialog", d => d.accept());

await arcPage.goto(`http://127.0.0.1:${arcServer.address().port}/axm-arc/game/`, { waitUntil: "networkidle" });
await arcPage.evaluate(() => localStorage.clear());
await arcPage.reload({ waitUntil: "networkidle" });
await closeOv(arcPage);

// STAGE 1: author
out.stage1_workshopOpened = await click(arcPage, "button", "Workshop|工坊|工作坊");
await arcPage.waitForTimeout(500);
const editorText = await arcPage.evaluate(() => document.querySelector("textarea")?.value ?? "");
out.stage1_editorHasSkeleton = editorText.includes("my-first-cartridge");
let skeleton = null;
try { skeleton = JSON.parse(editorText); } catch { /* leave null, asserted below */ }
out.stage1_editorParsedAsJson = skeleton !== null;
await arcPage.screenshot({ path: join(SHOTS, "1-workshop-author.png") });

// vocab candidates pulled straight from the parsed skeleton
const vocabCandidates = skeleton ? [
  skeleton.currencyName, skeleton.materialName, skeleton.tokenName, skeleton.reputationName,
  ...(skeleton.challenges || []).map(c => c.name),
  ...(skeleton.roles || []).map(r => r.name),
  ...(skeleton.tiers || []).map(t => t.name),
].filter(Boolean) : [];

// STAGE 2: validate
out.stage2_validateClicked = await click(arcPage, "button", "^(Validate|驗證)");
await arcPage.waitForTimeout(700);
let body = await arcPage.evaluate(() => document.body.innerText);
out.stage2_validOkShown = /valid|通過|有效/i.test(body) && /cart1_[0-9a-f]{6,}/.test(body);
const digestFull = body.match(/cart1_[0-9a-f]{64}/);
const digestAny = body.match(/cart1_[0-9a-f]+/);
out.stage2_digest = (digestFull || digestAny || [null])[0];
out.stage2_summaryCounts = /challenge/i.test(body) && /role/i.test(body);
await arcPage.screenshot({ path: join(SHOTS, "2-workshop-validate.png") });

// STAGE 3: save + play in arc
out.stage3_savedClicked = await click(arcPage, "button", "Save to Library");
await arcPage.waitForTimeout(600);
body = await arcPage.evaluate(() => document.body.innerText);
out.stage3_savedMsg = /saved/i.test(body);

await click(arcPage, "button", "^(Back|返回)");
await arcPage.waitForTimeout(400);
out.stage3_libraryClicked = await click(arcPage, "button", "library|資料庫|藏庫");
await arcPage.waitForTimeout(500);
body = await arcPage.evaluate(() => document.body.innerText);
out.stage3_libraryListsSkeleton = /my-first-cartridge|My First Cartridge/i.test(body);
await arcPage.screenshot({ path: join(SHOTS, "3-arc-library.png") });

await arcPage.evaluate(() => {
  const card = [...document.querySelectorAll(".card")].find(c => /my-first-cartridge|My First Cartridge/i.test(c.textContent || ""));
  [...(card?.querySelectorAll("button") || [])].find(b => /^(Load|載入)$/.test(b.textContent?.trim() || ""))
    ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await arcPage.waitForTimeout(600);
await closeOv(arcPage);
const titleAfterLoad = await arcPage.evaluate(() => document.body.innerText);
out.stage3_loadedOnTitle = /my-first-cartridge|My First Cartridge/i.test(titleAfterLoad);

await click(arcPage, "button", "new game|start scenario|load model");
await arcPage.waitForTimeout(800);
await closeOv(arcPage);
await arcPage.screenshot({ path: join(SHOTS, "4-arc-play.png") });
const playBody = await arcPage.evaluate(() => document.body.innerText);
const vocabFound = vocabCandidates.filter(v => new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(playBody));
out.stage3_vocabFound = vocabFound.slice(0, 2);
out.stage3_playShowsVocab = vocabFound.length >= 2;

// STAGE 4: export
await arcPage.reload({ waitUntil: "networkidle" });
await closeOv(arcPage);
out.stage4_reopenedWorkshop = await click(arcPage, "button", "Workshop|工坊|工作坊");
await arcPage.waitForTimeout(500);
const editorAfterReopen = await arcPage.evaluate(() => document.querySelector("textarea")?.value ?? "");
out.stage4_draftPersisted = editorAfterReopen.includes("my-first-cartridge");

const [download] = await Promise.all([
  arcPage.waitForEvent("download"),
  click(arcPage, "button", "Export \\.arc\\.json|匯出"),
]);
await download.saveAs(EXPORT_PATH);
out.stage4_exportClicked = true;
await arcPage.waitForTimeout(400);
await arcPage.screenshot({ path: join(SHOTS, "5-workshop-export.png") });

let exportedParsed = null;
try { exportedParsed = JSON.parse(await readFile(EXPORT_PATH, "utf8")); } catch { /* asserted below */ }
out.stage4_exportedIsJson = exportedParsed !== null;
out.stage4_exportedIdMatches = exportedParsed?.meta?.id === "my-first-cartridge";

await arcPage.close();

// ---------------------------------------------------------------------
// WORLD: import the round-tripped file, play, capture digest
// ---------------------------------------------------------------------
const worldPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
worldPage.on("pageerror", e => out.errsWorld.push(e.message));
worldPage.on("dialog", d => d.accept());

await worldPage.goto(`http://127.0.0.1:${worldServer.address().port}/axm-world/game/`, { waitUntil: "networkidle" });
await worldPage.evaluate(() => localStorage.clear());
await worldPage.reload({ waitUntil: "networkidle" });
await worldPage.waitForTimeout(600);
await closeOv(worldPage);

const input = await worldPage.$("input[type=file]");
out.stage5_fileInputFound = !!input;
if (input) await input.setInputFiles(EXPORT_PATH);
await worldPage.waitForTimeout(900);
const bootBody = await worldPage.evaluate(() => document.body.innerText);
const cartName = skeleton?.meta?.name || "My First Cartridge";
const nameRe = new RegExp(cartName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
out.stage5_importedOnBoot = nameRe.test(bootBody);

await worldPage.evaluate((name) => {
  const btns = [...document.querySelectorAll("button, a")];
  const b = btns.find(x => new RegExp(name, "i").test(x.closest("article,section,div")?.textContent || "")
    && /enter|進入|resume|繼續/i.test(x.textContent || ""));
  (b ?? btns.filter(x => /enter/i.test(x.textContent || "")).at(-1))
    ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}, cartName);
await worldPage.waitForTimeout(1500);
await closeOv(worldPage);

const playWorldBody = await worldPage.evaluate(() => document.body.innerText).catch(() => "");
out.stage5_playHeaderHasName = nameRe.test(playWorldBody);

// the digest lives in a collapsible "Cartridge" panel — open it so the full
// hash is present in the DOM (and in the screenshot) rather than a partial.
await worldPage.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find(x => /^cartridge$/i.test(x.textContent?.trim() || ""));
  b?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await worldPage.waitForTimeout(400);
await worldPage.screenshot({ path: join(SHOTS, "6-world-play.png") });

const digestChipText = await worldPage.evaluate(() =>
  document.querySelector('[data-testid="cartridge-digest"]')?.textContent ?? "").catch(() => "");
const digestWorldFull = digestChipText.match(/cart1_[0-9a-f]{64}/);
const digestWorldAny = digestChipText.match(/cart1_[0-9a-f]+/) || playWorldBody.match(/cart1_[0-9a-f]+/);
out.stage5_digest = (digestWorldFull || digestWorldAny || [null])[0];
out.stage5_digestShown = !!out.stage5_digest;

// STAGE 6: identity holds
out.stage6_identityHolds = shortestPrefixMatch(out.stage2_digest, out.stage5_digest);

await worldPage.close();

const verdict = {
  stage1_author: !!(out.stage1_workshopOpened && out.stage1_editorHasSkeleton && out.stage1_editorParsedAsJson),
  stage2_validate: !!(out.stage2_validateClicked && out.stage2_validOkShown && out.stage2_summaryCounts),
  stage3_saveAndPlay: !!(out.stage3_savedClicked && out.stage3_savedMsg && out.stage3_libraryListsSkeleton
    && out.stage3_loadedOnTitle && out.stage3_playShowsVocab),
  stage4_export: !!(out.stage4_draftPersisted && out.stage4_exportClicked && out.stage4_exportedIsJson && out.stage4_exportedIdMatches),
  stage5_importIntoWorld: !!(out.stage5_fileInputFound && out.stage5_importedOnBoot && out.stage5_playHeaderHasName && out.stage5_digestShown),
  stage6_identityHolds: out.stage6_identityHolds,
  digestFromArcValidate: out.stage2_digest,
  digestFromWorldPlay: out.stage5_digest,
  vocabWordsAssertedInArcPlay: out.stage3_vocabFound,
  errsArc: out.errsArc,
  errsWorld: out.errsWorld,
  details: out,
};

console.log(JSON.stringify(verdict, null, 2));

await browser.close();
arcServer.close();
worldServer.close();
