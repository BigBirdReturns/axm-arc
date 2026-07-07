# RFC: The Expansion Archive — the guild's journey across cartridges, made browsable

Status: **proposed** (owner-gated for scope). Implementation would land as PR 041–050.
Depends on the tier-2 campaign ledger (RFC_TIER2_LEDGER_SCHEMA, shipped), the arc
library (`src/game/lib/arc-library.ts`, shipped), and the Guild Hall (RFC_GUILD_HALL,
shipped 032–040).

## The one rule

> **The Expansion Archive reads the library and the ledger. It never writes either.**

Every panel is a pure derivation that *joins* two things that already exist —
`loadArcLibrary()` (the expansions this engine can load) and `loadLedger()` (the
one guild's recorded campaign). The Archive renders the join and nothing it cannot
back: no fabricated expansion metadata, no invented clear, no persisted summary the
schema lacks. Writing stays where it belongs — the library's import/remove and the
commit at the end of a night.

## Why it exists

Two surfaces already exist, and neither answers the obvious question:

- The **Library** (`LibraryScreen`) lists every expansion you *can* load, and lets
  you import / inspect / export / load / remove them. It knows nothing about your guild.
- The **Guild Hall** reads *one* guild's ledger — attendance, scars, tier record —
  but only for the currently-loaded expansion's lineage.

Neither answers: **"Which expansions has this guild actually journeyed through, and
how did each one go?"** The ledger already holds it — `progress.tiers[]` carries a
`cartridgeId` + `cartridgeDigest` + clear/grade/pulls/wipes for every tier the guild
has played, and `commits[]` records the order it met them. The Archive is the
read-only surface that joins that journey to the library's expansions, so the player
can browse their whole campaign *across* cartridges — what's cleared, what's
available, what each cost.

This is the same "make the current truth readable" discipline the Guild Hall proved:
the memory exists and is guarded; the Archive makes the *cross-expansion* view
legible. It invents no mechanics — a gap becomes an RFC, never a fake panel.

## Shape

A new read-only surface (the **Archive**), reachable from the title / library.
Given `loadArcLibrary()` and `loadLedger()` (or none → an honest empty archive), it
renders panels, each a pure join in `src/game/lib/expansion-archive.ts`:

| PR  | Panel / step | Reads |
|-----|--------------|-------|
| 041 | **This RFC.** Scope + the one rule (owner-gated). | — |
| 042 | Minimal Archive route + expansion roster: one card per library expansion, tagged *cleared / in progress / unattempted / active* by joining the ledger. | library + `progress.tiers` |
| 043 | Per-expansion campaign record: tiers cleared within each expansion, pulls/wipes/best-pull/grade — grouped by `cartridgeDigest`. | `progress.tiers` |
| 044 | Journey timeline: expansions in the order the ledger *first recorded* them (`commits[]` digest order). Never interpolates an expansion that wasn't played. | `commits[]` |
| 045 | "Compatible to carry" indicator: which library expansions this guild can project into, via the existing `checkCompatibility` (read-only; no new logic). | `ledger.profile` + arc profile |
| 046 | Unattempted-expansions surface: library expansions absent from the ledger (set difference) — the road not yet taken, stated honestly as *unattempted*, not *locked*. | library − `progress.tiers` |
| 047 | Emblem + trust provenance in the Archive: reuse the existing emblem seam (`KarazhanEmblem`/`isKarazhan`) and `TrustLabel`; no new asset, no invented emblem. | library `trust`/`source` |
| 048 | Save-summary line per expansion, **derived** (guild name, roster size, legacy at the records the ledger holds) — computed, never stored. | ledger derivations |
| 049 | i18n (en + zh-Hant, coverage guard) + a11y pass; read-only cross-navigation to Guild Hall / Library. | — |
| 050 | Expansion Archive playtest drill (capstone): the Archive renders a multi-expansion journey with zero page errors and **no write path** to library or ledger. | drill |

PR 042 stands up the minimal route + one read-only view; PR 050 is the headless drill
proving it. (Panel order/count may flex during build — the RFC fixes the *shape* and
the *rule*, not the exact PR seams.)

## Non-goals (guard-enforced by "reads, never writes")

- **No editing.** No renaming expansions, no marking clears by hand, no curating the
  journey. The Archive is a mirror of library + ledger, not an editor of either.
- **No new persistence.** It adds **no storage key and no schema field.** Save
  summaries are *derived on read*, never written. If a panel wants data neither the
  library nor the ledger holds (e.g. a persistent per-expansion bookmark, playtime, or
  wall-clock timestamp), that is a **ledger-schema RFC first — brought to the human**,
  never faked in the Archive.
- **No expansion-content authoring.** This is *not* a tool for creating new cartridges
  or tiers (that is the Workshop / creator-packaging lane). The Archive only *reflects*
  expansions that already exist in the library.
- **No cross-expansion stat fabrication.** A panel shows what the ledger recorded for
  each expansion; it never sums incomparable vocabularies or interpolates a tier that
  wasn't played.

## Derivation discipline

Each panel is a pure `deriveX(library, ledger)` helper in
`src/game/lib/expansion-archive.ts`, unit-tested against a committed ledger + a bundled
library, then rendered. Any fact shown in both the Guild Hall and the Archive (e.g. a
tier's grade) shares one derivation — the two surfaces can never disagree. All chrome
routes through `t()` (en + zh-Hant); expansion names, ids, grades, and roles flow
**verbatim** (cartridge vocabulary is never catalogued). Ordering is codepoint, never
`localeCompare`. This mirrors the family's "one pure helper, two surfaces" and grammar
rules exactly as the Guild Hall program applied them.

## Schema footprint (the decision this RFC asks the human to ratify)

As scoped above, the Expansion Archive adds **zero schema fields and zero storage
keys** — it is a pure read-only join of `arc-library` + `ledger`, both already shipped.
Nothing here is an alive-world model (calendar / settlement / economy) — those remain
the human's to spec first. The single place a schema question *could* enter is a
**persistent** per-expansion summary or bookmark (PR 048 deliberately keeps it
*derived* to avoid that). If, on review, you want any of that persisted, it becomes a
separate ledger-schema RFC before a line of it is built.

**Open calls for the owner:**
1. Is the read-only *library × ledger journey* the right scope for "Expansion Archive",
   or did you intend something more ambitious (e.g. authored expansion content, or a
   persisted collection)? The former is safe and buildable now; the latter is a schema
   RFC first.
2. Should the Archive be its own route, or a section grafted onto the existing Library
   screen? (This RFC assumes a new route for parity with the Guild Hall.)
