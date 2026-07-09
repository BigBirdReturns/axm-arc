# Drills — headless verification through the real player paths

Reference scripts, not CI. Each drives a built app (`docs/game`) in
headless Chromium through the same clicks a player makes, and prints one
JSON verdict. They exist because tests passing while the UI seam is broken
is a real failure mode — when a drill fails where a test passed, fix the
seam; it protects every future cartridge.

| Script | Proves |
|---|---|
| `lifecycle-drill.mjs` | The whole chain: Workshop-author → validate (digest) → save → play in arc → export → import the *exported file* into world → digest identical both ends |
| `batch-import-drill.mjs` | Every cartridge in a list imports and plays in BOTH clients (arc Library paste, world boot file input), vocabulary rendering verbatim |
| `workshop-drill.mjs` | Workshop flow incl. broken-JSON error panel, en + zh-Hant |
| `offline-drill.mjs` | PWA: service worker takes control → network killed → reload boots, zero external requests |
| `installability.mjs` | CDP `getInstallabilityErrors` on the manifest/SW |
| `guildhall-playtest-drill.mjs` | The Guild Hall renders a committed ledger — every panel populated, zero page errors, and the Hall never writes the ledger it reads |
| `expansion-archive-drill.mjs` | The Expansion Archive route opens from the title and renders the library × ledger roster on a fresh install — zero page errors |
| `library-custody-drill.mjs` | Every Library entry shows its content digest — the custody surface names the identity everything else verifies by |

## Running (2026 tooling — adapt freely, keep the assertions)

Needs `playwright-core` (npm, anywhere) and a Chromium binary
(`executablePath` in each script). Build the app(s) first. Paths at the
top of each script are absolute — point them at your checkouts.

## Solved gotchas encoded in these scripts — do not rediscover them

- Serve `docs/game` with the Vite base prefix stripped
  (`/axm-arc/game/`, `/axm-world/game/`), or every asset 404s.
- Dispatch clicks as `MouseEvent` with `bubbles: true` inside
  `page.evaluate` — Playwright's `.click()` misses some React handlers
  and hidden-duplicate mobile DOM (a comma selector returns the FIRST
  match in document order, which may be inside `display:none`).
- Accept `confirm()` dialogs via `page.on("dialog")` (arc-switch asks).
- Close auto-opening overlays (`.codex-close`) in a loop before reading
  `innerText`.
- CSS `text-transform: uppercase` breaks case-sensitive regexes on
  `innerText` — always match case-insensitively.
- Blob + `a.click()` downloads DO emit Playwright `download` events, but
  only with `acceptDownloads: true` on the context.
- world's full digest lives in a collapsed "Cartridge" panel
  (`data-testid="cartridge-digest"`) — expand it; a body-text scrape only
  catches a coincidental prefix.
- Locale key is `axm-arc:locale:v1`; `localStorage.clear()` + reload
  before every scenario or state bleeds between runs.
