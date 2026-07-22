# AXM Arc

**A scenario format and a deterministic engine for organizational simulation.**

The player manages a group of agents — each with attributes, hidden traits, stress, morale, and a relationship web — against structured challenges defined by a portable JSON file called an *arc*. The engine resolves every challenge deterministically. Same seed, same run, every time. No inference, no API, no network.

The first arc is a guild management game. The bundled campaigns are **The First Charter**, **The Waking Tower**, and **The Kind Gods of Ilyon**.

> Swap "guild" for "program office" and "raid boss" for "contract deliverable" and you are modeling any organization facing structured challenges under resource constraints with imperfect information about its own people.

**[Play the tutorial arc](https://bigbirdreturns.github.io/axm-arc/game/)** · [Landing page](https://bigbirdreturns.github.io/axm-arc/) · [Design spec](DESIGN.md)

---


## Local-first completion scope

The current browser product is governed by `docs/PARITY_COMPLETION.md`: engine,
custody, complete reference campaigns, authoring, responsive World expression,
local pixel/vector assets, bilingual chrome, sensory preferences, and access
fallbacks are protected by dedicated Arc and World parity workflows. Multiplayer,
cloud sync, marketplace, publisher signing, cinematic media, and authored-content
translation packs are separate future products rather than hidden prerequisites.

---

## What the system is

AXM Arc is more than an engine beside a game UI. It is an authored-model and
decision-record lifecycle:

```text
author a model
  → validate, profile, and content-address it
  → execute decisions deterministically
  → produce inspectable reports
  → commit visible consequences to a ledger
  → reopen or project that record into another compatible engagement
```

The guild game is the reference implementation and the current product-quality
mandate. It tests whether the model is expressive, the loop understandable, the
outcomes satisfying, the artifact portable, and the record honest. It must be
finished as a game; it is also not the boundary of the system.

---

## What this repo contains

| Layer | Path | What it does |
|---|---|---|
| **Engine** | `src/engine/` | Generic deterministic simulation. Resolver, stress/morale/affliction cascade, relationship state machine, drama event cards, reward distribution (Council mode), infrastructure tick, recruitment, save/load. Content-free — zero imports from `src/arcs/`. |
| **Arc format** | `src/arcs/` | Portable JSON scenario definitions. The tutorial arc "The First Charter" ships here: 4 attributes, 3 roles, 3 tiers, 6 challenges across 2 progression tiers, 8 items, 6-agent starting roster with a seeded rivalrous pair. |
| **Authoring + custody** | `src/game/`, `docs/RFC_WORKSHOP.md`, `docs/RFC_CARTRIDGE_LIBRARY.md` | Library, Workshop, writable Designer, guided/source Godscar Forge, validation, authoring QA, digest/profile, import/export, simulation, and explicit custody receipts. |
| **Institutional record** | `src/game/lib/ledger.ts`, `docs/RFC_TIER2_LEDGER_SCHEMA.md` | Append-only committed consequences, compatibility projection, Guild Hall, and Expansion Archive. |
| **Reference game UI** | `src/game/` | React PWA and proof cartridges used to finish a compelling game while exercising the general model and record contract. |
| **Tests** | `tests/engine/`, `tests/game/` | Complete engine, custody, authoring, campaign, localization, sensory, and product-parity suites, including deterministic full-campaign acceptance for all bundled references. |
| **Landing page** | `docs/index.html` | AXM House Style static page. Live at [bigbirdreturns.github.io/axm-arc](https://bigbirdreturns.github.io/axm-arc/). |
| **Game (built)** | `docs/game/` | Compiled PWA output. Live at [bigbirdreturns.github.io/axm-arc/game](https://bigbirdreturns.github.io/axm-arc/game/). |
| **Design authority** | `DESIGN.md`, `docs/WAKING_TOWER_DESIGN_AUTHORITY.md` | The system design authority plus the explicit Waking Tower player-facing, compatibility-id, World-projection, and change-control boundary. |

---

## Quick start

```bash
# requires Node 18+
git clone https://github.com/BigBirdReturns/axm-arc.git
cd axm-arc
npm ci
npm run check     # typecheck + full test suite
npm run dev       # opens the game UI at localhost:5173 — the tutorial arc loads automatically
```

No accounts, no keys, no cloud. Or just [play in the browser](https://bigbirdreturns.github.io/axm-arc/game/) — no install required.

---

## Engine guarantees

**Determinism.** `hashSeed(orgSeed, cycle, challengeId)` derives per-challenge RNG. Same inputs → identical run report.

**Schema validation.** Arcs are validated at load via Zod. Attribute weights must sum to 1.0. Drop rates clamped to [0, 1]. Unknown attribute references throw. The arc either runs or fails loudly — never half-correct.

**Content-free engine.** No domain knowledge is hardcoded. The engine processes agents, attributes, challenges, and relationships. The arc and the game layer provide all domain specifics.

**Offline-first save.** Versioned JSON in localStorage (`axm-arc:save:v1` for game state, `axm-arc:intent:v1` for the player's cycle intent note). Migration dictionary for future versions. Arc-ID mismatch throws. Your decisions persist across sessions and survive indefinitely.

---

## The 11-step cycle

When the player advances a cycle, the engine processes these steps in order:

1. **Challenge resolution** — run the encounter resolver for each assignment
2. **Reward resolution** — present loot decisions (Council mode) or auto-resolve
3. **Stress processing** — per-challenge stress, benching stress, hostile proximity, affliction barks, threshold resolution (75% affliction / 25% resolve)
4. **Relationship updates** — shared challenge effects, reward allocation effects, state transitions
5. **Morale drift** — target morale from reward satisfaction, win/loss streak, relationship quality, infrastructure
6. **Infrastructure tick** — production, training, recreation, research, medical
7. **Recruitment pool refresh** — reputation-weighted tier distribution
8. **Token regeneration** — base + infrastructure bonus, capped
9. **Drama card queue** — collect triggers from steps 1–8, generate cards, cap at 5 per cycle
10. **Hidden attribute / trait reveals** — check assignment counts against thresholds (3/5/8/12)
11. **Save checkpoint** — serialize full state

---

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Vite dev server (localhost:5173) |
| `npm test` | Vitest (engine + integration) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | typecheck + tests |
| `npm run build` | Production bundle → `docs/game/` |

---

## Writing your own arc

Arcs are JSON files validated by the Zod schema in `src/engine/schema.ts`. See `src/arcs/first-charter.ts` for a complete example. The schema enforces:

- At least 3 attributes
- Mechanic check weights sum to 1.0 (within tolerance)
- All referenced attribute IDs exist in the arc's attribute list
- Drop rates in [0, 1] (legacy string entries normalize to 1.0)
- Roles, tiers, progression tiers, attunement chains, items, narrative events — all typed

A passing `validateArc()` call guarantees the arc will run on any engine version satisfying its `engineVersion` floor — or it throws loudly. Never half-correct.

---

## Current-scope defect posture

The previous resolve-headline and reward-dispute field mismatches are closed: heroic moments are engine-authored on `RunReport`, and reward disputes carry `itemId`. Current local-first completion is governed by `docs/PARITY_COMPLETION.md`; expansion products remain explicitly separate.

---

## Contributing

Engine code has zero imports from `src/arcs/`. Arc files have zero assumptions about engine internals beyond the published schema. **This is the invariant that makes the engine portable — don't break it.**

The game UI (`src/game/`) uses `localStorage` and CSS custom properties. It works in every current browser. The PWA install prompt requires HTTPS — `localhost` works for dev, but `http://` served from a file server won't trigger it.

---

## Browser product status

The browser product now includes the playable reference loop, Arc Library,
Workshop authoring, digest/profile visibility, import/export custody, ledger,
Guild Hall, and Expansion Archive. See [STATUS.md](STATUS.md) for the current
implemented-versus-proposed boundary; older phase labels in historical RFCs and
handoffs are not the active roadmap.

### Architecture

The browser modes share one Arc schema, validation seam, digest implementation,
and deterministic engine. Library custody metadata and trust are loader facts,
never content the Arc may claim about itself. Workshop preview uses the real
bounded conformance harness and does not persist or certify a draft.

### Arc Library as trust boundary

Imported artifacts are untrusted input. The Library carries the trust taxonomy:

| Level | Meaning |
|---|---|
| **Bundled** | Shipped with this build, implicitly trusted |
| **Verified** | Signed, chain resolves via axm-verify, author identity shown |
| **Imported (unsigned)** | Schema-valid, runs, but flagged — the natural state for "I'm authoring this" |
| **Quarantined** | Schema-valid but signature failed or was revoked |

Only **Bundled** and **Imported (unsigned)** are reachable today. **Verified** and
**Quarantined** are reserved for future signing and verification; no runtime
behavior currently depends on them.

### Deploy variants (same codebase, different lobby)

The title screen's mode state supports build-time configuration for different audiences:

- **Game deploy** — lobby shows Continue / New Game against the bundled arc, Library is secondary
- **Enterprise deploy** — lobby shows "Open arc..." first, no bundled arc, no marketing copy
- **Research deploy** — research-oriented positioning; reviewer-mode behavior and
  signed rerun packages are not implemented

This is a build-time flag, not three codebases. The Library components should not assume a bundled tutorial arc always exists.

### Scaling stress tests (designed, not yet implemented)

DESIGN.md specifies five schema stress tests proving the engine holds structurally different formats:

| Format | Roster | Key mechanic |
|---|---|---|
| EverQuest: Planes of Power | 72 agents | Per-agent flagging, 85% attunement threshold |
| FFXIV: Savage Raiding | 8 agents, strict comp | 6+ sub-roles, Normal/Savage/Ultimate difficulty modes |
| OSRS: Tombs of Amascut | 1–8 agents, no roles | Invocation-style difficulty modifiers, non-linear scaling |
| Guild Wars 1: GvG | 8v8 PvP | Opposing roster as threshold source (v2) |
| XCOM / Fire Emblem | 4–12 agents | Permadeath weight, high per-agent stat budgets |

The Waking Tower is the shipped large-roster stress cartridge after The First Charter; Ilyon proves the Godscar creator grammar on the same engine.

---

## AXM family

axm-arc is the simulation member of the [AXM](https://github.com/BigBirdReturns) ecosystem. The design principles — portable artifacts, deterministic runtime, no inference at query time — are shared across the family. Full Genesis integration (signed arcs, Merkle roots, `axm-verify`) is on the roadmap.

| Repo | Role |
|---|---|
| [axm-genesis](https://github.com/BigBirdReturns/axm-genesis) | Kernel — spec, compiler, verifier |
| [axm-core](https://github.com/BigBirdReturns/axm-core) | Hub — Forge, Spectra, Clarion |
| [axm-chat](https://github.com/BigBirdReturns/axm-chat) | Spoke — conversations to shards |
| [axm-show](https://github.com/BigBirdReturns/axm-show) | Spoke — drone show compliance |
| [axm-embodied](https://github.com/BigBirdReturns/axm-embodied) | Spoke — forensic flight recorder |
| **axm-arc** (this repo) | Organizational simulation engine |

---

## License

MIT

## Localization

All player-facing chrome renders from the typed catalog in `src/i18n/`
(en / zh-Hant), ported from axm-world's reference implementation. The rule:
**chrome is the app's to translate; arc data flows verbatim** — challenge
names, drama text, resource vocabulary, and variant labels are never
catalogued, so an imported arc's own vocabulary always wins. Engine-emitted
strings are data too; the deterministic engine must stay locale-independent
(codepoint ordering, no `localeCompare`). Guard test:
`tests/i18n/locale.test.ts`. Family doctrine: proposed in
[axm-genesis PR #23](https://github.com/BigBirdReturns/axm-genesis/pull/23)
(LOCALIZATION doctrine, pending owner review).

## Cartridge lifecycle

A cartridge is one artifact from authorship to play: authored in the
in-app Workshop (or any text editor), validated through the one shared
seam (`validateArcJson`), content-addressed by `cartridgeDigest`
(`cart1_…`), shipped with its conformance test, playable here and in
[axm-world](https://github.com/BigBirdReturns/axm-world)'s boot importer,
and ported per the atlas. Family doctrine: proposed in
[axm-genesis PR #23](https://github.com/BigBirdReturns/axm-genesis/pull/23)
(CARTRIDGE_LIFECYCLE doctrine, pending owner review).
This repo's implementations: `docs/COMPATIBILITY_ATLAS.md` (what can be a
cartridge, at what cost) and `docs/CLONE_PORTING.md` (how a port happens).


## Godscar Pocket Forge

The title screen now opens a Pocket Forge that validates the six-pressure Godscar story grammar, runs bounded exact-founding simulations, installs the compiled cartridge, and exports both the editable `.pocket.json` source and interoperable `.arc.json` artifact. The reference pocket is **The Kind Gods of Ilyon**. See `docs/GODSCAR_POCKET_FORMAT.md`.
