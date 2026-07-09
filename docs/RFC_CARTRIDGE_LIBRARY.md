# RFC: Cartridge Library custody — the cartridge's identity, made visible

Status: **accepted** (2026-07-09, under the owner's drive-to-100 delegation — the
owner authorized the train to run to PR 100 and delegated the open calls; the
rulings below were made by the orchestrator under the standing stop/ask policy and
are recorded here for the owner's later audit). Implementation lands as PR 071–080.
Depends on the arc library (`src/game/lib/arc-library.ts`, shipped), the cartridge
digest (`src/engine/cartridge-digest.ts`, shipped), and the Expansion Archive
(RFC_EXPANSION_ARCHIVE, shipped 041–050).

## Delegated rulings (2026-07-09)

1. **Carry signal in the Library (075): include.** "One pure helper, two surfaces"
   is family law; `carryVerdict` is reused verbatim with zero new logic. The
   owner's don't-overload-Library ruling was about *journey history*
   (played/cleared/attendance) — that stays in the Archive. Carry is a
   present-tense compatibility fact about the cartridge in hand, like trust.
   Omitted honestly when no guild exists (null-ledger → no badge).
2. **Preflight shape (073): (a) additive report.** The current one-click
   "Validate & Save" flow is unchanged; the custody report renders alongside the
   result. Option (b) — a two-step validate → confirm-save — changes a user flow
   and therefore sits outside the delegated "additive display" box; it remains an
   owner call for a future PR.
3. **Numbering: keep 071–080.** 051–060 (world appliance) and 061–070 (Workshop)
   keep their slots in the train map and are built in dependency order, each
   RFC-first.

## The one rule

> **New Library surfaces read the cartridges the Library already holds.
> Custody writes stay where they already are — explicit user actions through the
> one existing seam.**

Import, update, and remove already write the library's single storage key, via the
one validator (`validateArcJson`/`importArcFromJson` — never a second one). This
program adds **no new write path, no new storage key, and no schema field**. Every
new panel is a pure derivation of a cartridge already in hand (`cartridgeDigest`,
`compatibilityProfile`) — computed, never claimed.

## Why it exists

The Library is arc's custody surface (Article-4 territory: import / validate /
inspect / export / load / remove), and the custody loop works — but it is **mute
about identity**:

- **No digest is shown anywhere.** The content digest is the fact everything else
  keys on — the Archive joins by it, world's boot-import verifies by it, the
  repo's own verification bar demands "matching digests in BOTH clients" — yet the
  holder of the cartridge can't see it. You cannot verify custody of a thing whose
  identity is invisible.
- **Re-import is silent.** Importing a cartridge whose id already exists quietly
  replaces the imported entry. The user is never told whether the incoming file is
  byte-identical (same digest — a no-op re-import), an update (same id, new
  digest), or a different cartridge that happens to share an id.
- **Export gives no receipt.** The exported file's digest — the thing the other
  client will check — is never shown at export time, so round-trip verification
  is a matter of faith rather than a visible fact.

This is the same "make the current truth readable" discipline as the Guild Hall
and the Archive: the identity facts exist and are guarded by the engine; the
Library makes them legible. It invents no mechanics.

## Shape

Panels and reports, each a pure derivation in `src/game/lib/` (or a thin reuse of
an existing one), rendered in the existing `LibraryScreen`:

| PR  | Step | Reads |
|-----|------|-------|
| 071 | **This RFC.** Scope + the one rule (owner-gated). | — |
| 072 | **Digest visibility**: every Library entry shows its content digest (short form on the card, full digest in the inspect overlay) — verbatim, computed by the one existing `cartridgeDigest`. | `cartridgeDigest(entry.arc)` |
| 073 | **Import preflight honesty**: the validate step reports, *before anything persists*: the incoming digest, and which custody action will occur — new entry · updates an existing imported entry (same id, different digest) · exact duplicate already held (same digest). Same validator, one seam. | incoming arc + library |
| 074 | **Vocabulary profile inspection**: the inspect surface shows the cartridge's computed compatibility profile (roles / attributes / tiers / item slots / check vocab, and the profile digest) — the facts `checkCompatibility` already compares. | `compatibilityProfile(arc)` |
| 075 | **Carry signal in the Library** *(open call #1)*: reuse the Archive's `carryVerdict` so both surfaces answer "can my guild carry into this?" from one helper. | `carryVerdict(arc, ledger)` |
| 076 | **Export receipt**: export success shows filename **and** the exported digest, so the holder can verify the round trip at the other client. | export payload |
| 077 | **Cross-navigation**: read-only links between Library (custody) and Archive (journey) — two questions, two rooms, one hallway. | — |
| 078 | **i18n + a11y** for all new chrome (en + zh-Hant, coverage-guarded; landmarks/labels). | — |
| 079 | **Cohesion pass**: new panels use arc's management vocabulary (stat-strip, badges, audit-section); no one-off styling; dedupe any redundant badges. | — |
| 080 | **Custody drill (capstone)**: headless — import → digest + preflight verdict shown → re-import same file → "exact duplicate" surfaced → export → receipt digest equals displayed digest → remove → library storage changes **only** through those explicit custody actions, ledger byte-identical throughout, zero page errors. | drill |

## Non-goals (guard-enforced)

- **No second validator.** All import paths stay on `validateArcJson` /
  `importArcFromJson`. Preflight *reports*; it never re-validates differently.
- **No new persistence.** No new storage key, no schema field, no signing/trust
  changes (`TrustLabel` semantics untouched — a file still cannot claim its own
  trust level).
- **No journey facts in the Library.** Played/cleared/attendance history stays in
  the Archive (owner ruling: Library is custody, Archive is journey memory; do not
  overload Library). The carry signal (075) is the one deliberate boundary case —
  see open call #1.
- **No Workshop, no authored content, no world.** Arc-only; no world pixel-ui; the
  arc/world contract stands.

## Derivation discipline

Every new fact shown is computed from a cartridge actually in hand — digest via
the one `cartridgeDigest`, profile via the one `compatibilityProfile`, carry via
the one `carryVerdict`. Any fact shown in two surfaces shares one helper. Chrome
through `t()` (en + zh-Hant); digests, ids, vocab, and trust values flow verbatim.
Ordering codepoint, never `localeCompare`.

## Schema footprint (the decision this RFC asks the owner to ratify)

**Zero.** No schema field, no storage key, no engine/resolver/save change. The
only writes in the Library's orbit remain the pre-existing, user-initiated custody
actions through the existing seam. If any step turns out to want persistence (e.g.
a remembered import history), that is a **separate schema RFC first** — never
faked.

**Open calls — resolved by the delegated rulings above (2026-07-09):**
1. Carry signal (075) → **include**, reusing `carryVerdict` (one helper, two
   surfaces); journey history still never enters the Library.
2. Preflight (073) → **(a) additive report**; the two-step flow change stays an
   owner call.
3. Numbering → **071–080 kept**; 051–070 built in dependency order, RFC-first.
