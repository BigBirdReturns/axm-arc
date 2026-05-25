# AXM Arc

**A scenario format and a deterministic engine for organizational simulation.**

The player manages a group of agents — each with attributes, hidden traits, stress, morale, and a relationship web — against structured challenges defined by a portable JSON file called an *arc*. The engine resolves every challenge deterministically. Same seed, same run, every time. No inference, no API, no network.

The first arc is a guild management game. The first raid is Karazhan.

> Swap "guild" for "program office" and "raid boss" for "contract deliverable" and you are modeling any organization facing structured challenges under resource constraints with imperfect information about its own people.

---

## What this repo contains

| Layer | Path | What it does |
|---|---|---|
| **Engine** | `src/engine/` | Generic deterministic simulation. Resolver, stress/morale/affliction cascade, relationship state machine, drama event cards, reward distribution (Council mode), infrastructure tick, recruitment, save/load. Content-free — zero imports from `src/arcs/`. |
| **Arc format** | `src/arcs/` | Portable JSON scenario definitions. The tutorial arc "The First Charter" ships here: 4 attributes, 3 roles, 3 tiers, 6 challenges across 2 progression tiers, 8 items, 6-agent starting roster with a seeded rivalrous pair. |
| **Game UI** | `src/game/` | React PWA in the AXM House Style (Barlow Condensed / Lora / IBM Plex Mono, cream paper, brick-red accent). Mobile-first portrait layout with a desktop "Situation Room" 3-column view at ≥960px. |
| **Tests** | `tests/engine/` | 130+ tests across 11 files. Engine subsystem tests, resolver edge cases (drop-rate gates, determinism, gear bonus, hostile relationships), schema validation, and a full end-to-end integration test that plays through the tutorial arc. |
| **Landing page** | `docs/index.html` | AXM House Style static page. Enable GitHub Pages from `main /docs` to serve it. |
| **Design spec** | `DESIGN.md` | The full v1.0 design authority document. 1,245 lines covering every system, the arc schema, the Karazhan reference arc, schema stress tests (EQ, FFXIV, OSRS, GW1, XCOM), and the non-game applications of the engine. |

---

## Quick start

```bash
git clone https://github.com/BigBirdReturns/axm-arc.git
cd axm-arc
npm ci
npm run check     # typecheck + full test suite
npm run dev       # Vite dev server on localhost:5173
```

Requires Node 18+. No accounts, no keys, no cloud.

---

## Engine guarantees

**Determinism.** `hashSeed(orgSeed, cycle, challengeId)` derives per-challenge RNG. Same inputs → identical run report.

**Schema validation.** Arcs are validated at load via Zod. Attribute weights must sum to 1.0. Drop rates clamped to [0, 1]. Unknown attribute references throw. The arc either runs or fails loudly — never half-correct.

**Content-free engine.** No domain knowledge is hardcoded. The engine processes agents, attributes, challenges, and relationships. The arc and the game layer provide all domain specifics.

**Offline-first save.** Versioned JSON in localStorage. Migration dictionary for future versions. Arc-ID mismatch throws. Your decisions persist across sessions and survive indefinitely.

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
| `npm run dev` | Vite dev server |
| `npm test` | Vitest (engine + integration) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | typecheck + tests |
| `npm run build` | Production bundle |

---

## Writing your own arc

Arcs are JSON files validated by the Zod schema in `src/engine/schema.ts`. See `src/arcs/first-charter.ts` for a complete example. The schema enforces:

- At least 3 attributes
- Mechanic check weights sum to 1.0 (within tolerance)
- All referenced attribute IDs exist in the arc's attribute list
- Drop rates in [0, 1] (legacy string entries normalize to 1.0)
- Roles, tiers, progression tiers, attunement chains, items, narrative events — all typed

A passing `validateArc()` call guarantees the arc will run on any engine version satisfying its `engineVersion` floor.

---

## Browser product roadmap

The playable build at `docs/game/` ships a title screen, tutorial, and the full cycle loop. The roadmap for evolving it from single-arc player to platform:

| Phase | What | Status |
|---|---|---|
| **1. Shell** | Title screen with continue/new game, save awareness, onboarding coach, cycle transition interstitial | Shipped |
| **2. Arc Library** | List bundled + imported arcs, import arc JSON via file picker, validate with schema, store in browser | Next |
| **3. Settings & Data** | Export/import save bundles, accessibility prefs (text scale, reduced motion), animation toggle, data controls | Next |
| **4. Arc Creator** | Guided form editor over the Zod schema, live validation panel, test-one-cycle-in-editor with fixed seed | Later |
| **5. Mods** | Enable/disable installed arc packs, compatibility warnings, optional trust levels (unsigned/signed) | Later |

### Architecture

The app uses a top-level `mode` state that gates between screens. Currently `"title"` and `"play"`. Adding `"library"`, `"settings"`, `"creator"` is additive — each mode gets its own screen component. The engine/content split means arc import is `validateArc()` + localStorage. The creator is a form over the existing schema.

### Scaling stress tests (designed, not yet implemented)

DESIGN.md specifies five schema stress tests proving the engine holds structurally different formats:

| Format | Roster | Key mechanic |
|---|---|---|
| EverQuest: Planes of Power | 72 agents | Per-agent flagging, 85% attunement threshold |
| FFXIV: Savage Raiding | 8 agents, strict comp | 6+ sub-roles, Normal/Savage/Ultimate difficulty modes |
| OSRS: Tombs of Amascut | 1–8 agents, no roles | Invocation-style difficulty modifiers, non-linear scaling |
| Guild Wars 1: GvG | 8v8 PvP | Opposing roster as threshold source (v2) |
| XCOM / Fire Emblem | 4–12 agents | Permadeath weight, high per-agent stat budgets |

The Karazhan arc (10-to-25 expansion moment) is the designed next arc after The First Charter.

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
| **axm-arc** | **Sibling — organizational simulation engine** |

---

## License

MIT
