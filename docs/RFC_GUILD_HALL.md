# RFC: The Guild Hall — the campaign ledger, made browsable

Status: proposed. Owner-gated for scope; the implementation lands as PR 032–040.
Depends on the tier-2 campaign ledger (RFC_TIER2_LEDGER_SCHEMA, shipped).

## The one rule

> **The Guild Hall reads the ledger. It never writes it.**

Every panel is a pure derivation of `CampaignLedger` — the same durable record
Raid Night commits. The Hall renders what is stored and nothing it cannot back
(no invented history, no aspirational stats, no wall-clock the schema lacks).
Writing the ledger stays where it belongs: the commit at the end of a night.

## Why it exists

Raid Night is one night. The ledger already remembers the whole campaign —
attendance, benchings, scars, precedents, loot fairness, tier progress — and
PRs 026–029 surfaced slivers of it on the roster cards. But there is no place to
*read the guild's history as history*. The Guild Hall is that place: a read-only
route where the owner browses what the runtime honestly recorded.

This is the "make the current truth readable" layer (world's discipline, adopted
here): the memory exists and is guarded; the Hall makes it legible. It invents
no mechanics — a schema gap becomes an RFC, never a fake panel.

## Shape

A new arc route, `GuildHallScreen`, reachable from the title/library. Given the
loaded `CampaignLedger` (or none → an empty-hall state), it renders panels, each
a pure function of the ledger:

| Panel | Reads | Lands in |
|---|---|---|
| Guild identity + campaign record | `guild`, `progress.tiers`, `commits` | PR 036 |
| Agent memory cards | `roster[].agent` + `attendance` + `bench` | PR 033 |
| Scars & precedents | `scars`, `precedents` | PR 034 |
| Loot / fairness history | `fairness`, `gear` | PR 035 |
| Roster growth history | `roster[].growthBase` vs current attrs | PR 037 |
| Bench & attendance timeline | `roster[].attendance`, `bench` | PR 038 |
| Next-tier readiness summary | `progress`, roster vs next cartridge profile | PR 039 |

PR 032 stands up the minimal route + one read-only view; PR 040 is the headless
drill proving the Hall renders a committed ledger with zero page errors and no
write path.

## Non-goals (guard-enforced by "reads, never writes")

- **No editing.** No renaming raiders, no reassigning loot, no curating history.
  The Hall is a mirror, not an editor.
- **No new persistence.** It adds no storage key and no schema field. If a panel
  wants data the ledger lacks, that is a ledger-schema RFC first.
- **No cross-tier fabrication.** A panel shows what commits recorded; it never
  interpolates nights that were not played.

## Derivation discipline

Each panel is a pure `deriveX(ledger)` helper in `src/game/lib/`, unit-tested
against a committed ledger, then rendered. Two surfaces that show the same fact
(e.g. attendance on a roster card and in the Hall) share one derivation — they
can never disagree. This mirrors the family's "one pure helper, two surfaces"
rule.
