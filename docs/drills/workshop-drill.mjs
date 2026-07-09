// Workshop drill: title → Workshop → skeleton → Validate → Save to Library →
// back → Library shows the saved arc. Then a zh-Hant chrome check.
import { chromium } from "playwright-core";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";

const ROOT = "/home/user/axm-arc/docs/game", BASE = "/axm-arc/game/";
const TYPES = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".webmanifest":"application/manifest+json", ".png":"image/png", ".woff2":"font/woff2" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.startsWith(BASE)) p = p.slice(BASE.length - 1);
  if (p === "/" || p === "") p = "/index.html";
  try { const b = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "text/plain" }); res.end(b);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; page.on("pageerror", e => errs.push(e.message));
page.on("dialog", d => d.accept());
const click = (sel, re) => page.evaluate(([s, r]) => {
  const b = [...document.querySelectorAll(s)].find(x => new RegExp(r, "i").test(x.textContent || ""));
  if (!b) return false;
  b.dispatchEvent(new MouseEvent("click", { bubbles: true })); return true;
}, [sel, re]);

await page.goto(`http://127.0.0.1:${server.address().port}${BASE}`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

const out = { errs };
out.openedWorkshop = await click("button", "workshop|工坊|工作坊");
await page.waitForTimeout(400);
const editor = await page.evaluate(() => document.querySelector("textarea")?.value ?? "");
out.editorHasSkeleton = editor.includes("my-first-cartridge");
// Draft custody honesty (RFC_WORKSHOP PR 065) — fresh session, cleared
// storage: the persistence notice is always shown, but the restored
// indicator must NOT appear — there is nothing to restore yet, and
// claiming restoration would be a lie.
out.draftNoticeShown = await page.evaluate(() => !!document.querySelector(".workshop-draft-notice"));
out.draftRestoredHiddenOnFresh = !(await page.evaluate(() => !!document.querySelector(".workshop-draft-restored")));
// The editor already shows the skeleton (the fallback when storage is
// empty), but nothing has actually been written to storage yet — only
// setDraft() (edits, New-from-Skeleton, duplicate-load, file-import)
// autosaves. Click New from Skeleton to trigger a real autosave of known,
// distinctive content before the later restore check.
out.newFromSkeletonClicked = await click("button", "New from Skeleton|從骨架新建");
await page.waitForTimeout(200);
out.validateClicked = await click("button", "^(Validate|驗證)");
await page.waitForTimeout(600);
let body = await page.evaluate(() => document.body.innerText);
out.validOkShown = /valid|通過|有效/i.test(body) && /cart1_[0-9a-f]{8}/.test(body);
out.digest = (body.match(/cart1_[0-9a-f]{12}/) || [null])[0];
out.summaryCounts = /challenge/i.test(body) && /role/i.test(body);
// author vocabulary profile (RFC_WORKSHOP PR 063) — always-on under the
// summary counts on a valid draft, pure reuse of compatibilityProfile.
out.profileShown = await page.evaluate(() => !!document.querySelector(".workshop-profile"));
out.profileDigestShown = /prof1_/i.test(body);
out.savedClicked = await click("button", "Save to Library|存入");
await page.waitForTimeout(500);
body = await page.evaluate(() => document.body.innerText);
out.savedMsg = /saved|已存/i.test(body);
// Draft custody honesty (RFC_WORKSHOP PR 065), continued: storage still
// holds the skeleton draft autosaved by the New-from-Skeleton click above
// (Validate/Save never touch the draft or its storage). Leave the Workshop
// and come back before the playtest/export/broken-JSON steps below, which
// DO mutate the draft further — this is the one point in the flow where a
// reopen proves both "restored" and "content survived" honestly against
// content we know is still the skeleton.
await click("button", "^(Back|返回)");
await page.waitForTimeout(300);
out.reopenedWorkshop = await click("button", "workshop|工坊|工作坊");
await page.waitForTimeout(400);
out.draftRestoredShown = await page.evaluate(() => !!document.querySelector(".workshop-draft-restored"));
out.draftContentSurvived = await page.evaluate(() =>
  (document.querySelector("textarea")?.value ?? "").includes("my-first-cartridge")
);
// The reopen mounted a fresh WorkshopScreen instance — validateResult (and
// the Playtest button it gates) resets with it, same as any real navigation
// away and back. Re-run Validate so the rest of the flow below (playtest,
// export) continues against a validated draft, exactly as an author
// returning to a restored draft would need to.
out.revalidatedAfterReopen = await click("button", "^(Validate|驗證)");
await page.waitForTimeout(400);
// playtest preview — bounded seeded runs through the shared conformance harness
out.playtestClicked = await click("button", "^playtest$|^試玩$");
let playtestShown = false, playtestParamsShown = false;
for (let i = 0; i < 10 && !playtestShown; i++) {
  await page.waitForTimeout(500);
  playtestShown = await page.evaluate(() => !!document.querySelector(".workshop-playtest"));
}
if (playtestShown) {
  body = await page.evaluate(() => document.body.innerText);
  playtestParamsShown = /seeded runs|種子模擬/i.test(body);
}
out.playtestShown = playtestShown;
out.playtestParamsShown = playtestParamsShown;
if (playtestShown) {
  await page.screenshot({ path: "/tmp/claude-0/-home-user/65fd6ca3-5fb5-56c1-92df-ef191fdf9c5d/scratchpad/workshop-playtest.png" });
}
// export receipt (RFC_WORKSHOP PR 064, parity with the Library's 076 drill
// above): click the export button (t("workshop.exportArc") = "Export
// .arc.json" / "匯出 .arc.json") on the still-valid draft and check that a
// receipt renders with the digest of the EXPORTED bytes (re-parsed, never
// assumed from in-memory state) plus an honest match badge. Headless
// without acceptDownloads simply drops the actual download — harmless;
// only the on-screen receipt is under test here.
out.exportClicked = await click("button", "export|匯出");
await page.waitForTimeout(400);
body = await page.evaluate(() => document.body.innerText);
out.exportReceiptShown = await page.evaluate(() => !!document.querySelector(".workshop-export-receipt"));
out.exportMatches = /matches the validated draft/i.test(body);
// broken JSON → error panel
await page.fill("textarea", "{ not json");
out.validateBrokenClicked = await click("button", "^(Validate|驗證)");
await page.waitForTimeout(400);
body = await page.evaluate(() => document.body.innerText);
out.brokenShowsError = /parse error|failed|驗證失敗/i.test(body);
// back → library → saved arc listed
await click("button", "^(Back|返回)");
await page.waitForTimeout(400);
await click("button", "library|資料庫|藏庫");
await page.waitForTimeout(500);
body = await page.evaluate(() => document.body.innerText);
out.libraryListsSkeleton = /my-first-cartridge|My First Cartridge/i.test(body);
// zh-Hant chrome check back on workshop
await page.evaluate(() => { [...document.querySelectorAll("button")]
  .find(b => /^中文$/.test(b.textContent?.trim() || ""))?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
await page.waitForTimeout(300);
await click("button", "^(Back|返回)");
await page.waitForTimeout(300);
out.zhWorkshopBtn = await page.evaluate(() => [...document.querySelectorAll("button")]
  .map(b => b.textContent?.trim()).filter(t => /工/.test(t || "")));
await click("button", "工");
await page.waitForTimeout(400);
body = await page.evaluate(() => document.body.innerText);
out.zhChromeSample = body.replace(/\s+/g, " ").slice(0, 200);
out.zhHasChinese = /[一-鿿]/.test(body);
console.log(JSON.stringify(out, null, 2));
await browser.close(); server.close();
