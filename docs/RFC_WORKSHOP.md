# RFC: Workshop conformance — the author sees what the tests see

Status: **accepted** (2026-07-09, under the owner's drive-to-100 delegation; the
rulings below were made by the orchestrator under the standing stop/ask policy and
are recorded for the owner's audit). Implementation lands as PR 061–070.
Depends on the Workshop (`WorkshopScreen` + `src/game/lib/workshop.ts`, shipped),
the conformance harness (`src/sim/cartridge-conformance.ts`, shipped, arc-owned,
**zero node dependencies — browser-safe**), the arc library seam, and the custody
lane (RFC_CARTRIDGE_LIBRARY, shipped 071–080).

## The one rule

> **The Workshop authors through the one seam and previews through the one
> harness. It writes only what the author explicitly saves; previews never
> persist and never certify.**

Validation stays on `validateArcJson` (never a second validator). Playability
facts come from the same `simulateArcRun`/`aggregateRuns` harness every shipped
cartridge's conformance test runs — reused read-only, never modified (changing
the harness changes what the tests mean; that is out of scope for this lane).
A preview reports *what bounded seeded runs did*, with its parameters visible —
it never claims "conformant" (that remains the test suite's word).

## Why it exists

The Workshop already closes most of the authoring loop: skeleton, duplicate-
from-library, file/paste import, schema validation (with digest + entity
counts), save-to-library, export. What the author **cannot** see is the fact
that matters most: **does this cartridge play?** Reachability, gate honesty,
wipe/clear behavior — all of it exists in `cartridge-conformance.ts`, but only
tests ever run it. An author today ships blind and finds out in review.

This is "make the current truth readable" for creators (Article 4: the dev kit
is the product): the harness exists and is guarded; the Workshop makes its
verdicts legible at authoring time. It invents no mechanics and certifies
nothing.

## Shape

| PR  | Step | Reads |
|-----|------|-------|
| 061 | **This RFC.** | — |
| 062 | **Playtest preview**: a "Playtest" action on a valid draft runs bounded, seeded, deterministic `simulateArcRun`s (fixed seed set, visible `maxCycles`) + `aggregateRuns`, and renders the facts: runs attempted, tiers reached, clears/wipes, cycles used — labeled with the exact run parameters, never as certification. | the harness |
| 063 | **Author vocabulary profile**: the valid draft's `compatibilityProfile` (roles / attributes / tiers / item slots / check vocab + profile digest) — what a guild would need to carry in. Parity with the Library's 074. | `compatibilityProfile` |
| 064 | **Export receipt parity**: Workshop export shows the digest computed from the exported bytes + match badge — the 076 receipt, on the author's side. | export payload |
| 065 | **Draft custody honesty**: the existing draft key surfaced honestly — draft saved/restored indicators, and the current draft's digest when (and only when) it validates. No new storage. | draft + validator |
| 066 | **Validation ergonomics**: the real `validateArcJson` errors, better displayed (grouped/counted; line hints where the parser provides them). Same errors, same validator — display only. | validator output |
| 067 | **Cross-navigation**: Workshop ↔ Library (the author's room and the custody room). | — |
| 068 | **i18n + a11y** for all new chrome (en + zh-Hant, coverage-guarded; landmarks, live regions). | — |
| 069 | **Cohesion pass** against arc's management vocabulary — expected to be a verified no-op if 062–068 hold the bar; recorded either way. **Resolved as verified-no-op — see the cohesion verdict below.** | — |
| 070 | **Author round-trip drill (capstone)**: headless — author from skeleton → validate → playtest preview renders real run facts → save → export (receipt matches) → the Library shows the cartridge with the same digest → previews persisted nothing. Article 4's loop, executable. | drill |

## Non-goals (guard-enforced)

- **No harness changes.** `cartridge-conformance.ts` is reused read-only; a
  preview need the harness can't meet is a note for the owner, never a hack.
- **No certification language.** The preview reports bounded-run facts with
  parameters visible; "conformant" remains the test suite's word.
- **No new persistence.** The existing draft key is the only Workshop storage;
  preview results are never persisted.
- **No second validator, no schema/engine/save changes, no authored cartridge
  content shipped, no world.** Arc-only; the arc/world contract stands.

## Cohesion verdict (PR 069 — reviewed 2026-07-10, verified no-op)

Audited after 062–068 landed. The lane introduced seven new classes
(`workshop-playtest`, `workshop-profile`, `workshop-export-receipt`,
`workshop-draft-notice`, `workshop-draft-restored`, `workshop-error-panel`,
`workshop-to-library`) and **zero CSS rules for any of them** — every one is a
drill anchor or layout hook; all visual styling comes from reused arc
primitives (`stat-strip`/`stat-cell`, `badge`(+`pass`), `agent-meta`,
`rn-num`, `mechanic-row`, `warning`, `secondary`). The profile panel reuses
074's exact idiom and i18n keys; the export receipt reuses 076's; the playtest
report was built in the management vocabulary from its first commit. No
duplicate badges, no one-off styling. Nothing to restyle — the verdict is
recorded instead of churn manufactured, same as the custody lane's 079.

## Delegated rulings (2026-07-09)

1. **Preview scope**: fixed seed set (small, deterministic), visible
   `maxCycles`, results labeled with parameters — honest bounded facts, no
   certification claim. Long-running previews must stay responsive (bounded
   work per click; the drill gates on zero page errors, not on speed).
2. **Results render in-Workshop, read-only, unpersisted.**
3. **Numbering kept**: 061–070; the 051–060 world lane remains next after this
   lane, RFC-first.
