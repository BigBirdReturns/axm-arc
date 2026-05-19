# Project Review: axm-arc

## Executive summary
`axm-arc` is a promising simulation-first project with a clear architecture split between:
- deterministic engine logic (`src/engine/*`),
- content/data packs (`src/arcs/*`), and
- a React shell (`src/game/*`).

The structure is strong enough to scale beyond the initial "First Charter" arc. The most important next step is reducing ambiguity between **design intent** and **implemented behavior** (especially rewards/loot semantics), then tightening contributor UX with better local/CI workflows.

---

## Scope reviewed
- Core engine: cycle resolution, resolver, stress, rewards, economy, relationships, save/schema
- Arc/content wiring and bootstrap data
- UI progression model and cycle advancement flow
- Test layout and project scripts

Files inspected include (non-exhaustive):
- `src/engine/cycle.ts`
- `src/engine/resolver.ts`
- `src/game/App.tsx`
- `README.md`
- `package.json`
- `tests/engine/*.test.ts`

---

## What is working well

### 1) Architecture boundaries are real, not cosmetic
The project keeps engine logic mostly content-free and pushes scenario specifics into arc data. That is the right long-term call for supporting multiple arcs with shared simulation infrastructure.

### 2) Determinism strategy is thoughtful
Cycle-scoped RNG with seeded forks creates a good basis for replay/debug/test reproducibility. This is especially valuable for simulation balancing and regression checks.

### 3) Engine modules map to domain concepts
Resolution, stress, relationships, rewards, infrastructure, recruitment, and save logic are separated in a way that aligns with mental models of the game system.

### 4) TypeScript usage is purposeful
Core entities and cycle/report contracts are explicit enough to act as documentation. The codebase is readable and generally discoverable without excessive indirection.

---

## Key issues and risks

### P0: Design/implementation mismatch in reward-drop semantics
In `resolver.ts`, comments explicitly acknowledge a spec-level drop-rate notion, while the current implementation effectively treats reward table items as always-dropping when eligible for roll processing.

Why this matters:
- If designers think reward tables imply probabilities, balancing assumptions will be wrong.
- Future arcs may encode intended rarity only to discover runtime behavior is deterministic.

Recommendation:
- Promote drop behavior into explicit schema data (`dropRate` or equivalent).
- Validate range at schema boundaries (e.g., 0.0–1.0).
- Add deterministic tests for edge values (`0`, `1`, and mid-probability under seeded runs).

### P1: Cycle-advance UX logic is correct but opaque
The "Advance Cycle" button enable/disable condition references both assignment state and prior reports, which makes sense in flow terms but is not obvious at glance.

Risk:
- Small UI regressions are likely when future contributors modify progression rules.

Recommendation:
- Extract into named predicates (e.g., `canAdvanceCycle`, `hasUnresolvedRewards`, `hasBlockingDrama`).
- Add 1–2 focused UI/state tests around these progression gates.

### P1: Contributor verification path is fragile
The documented run path is straightforward, but in clean-room environments it is easy to hit missing local tooling states.

Recommendation:
- Add a concise "Contributor quickstart" with:
  - expected Node/npm versions,
  - `npm ci` as the canonical install command,
  - one-line health check (`npm run typecheck && npm test`).
- Add a unified script: `npm run check`.

### P2: Test reporting in docs can drift from actual suite
README currently states specific test/file counts. This can become stale as suite evolves.

Recommendation:
- Either automate that count in CI badge/reporting, or rephrase docs to avoid hardcoded totals.

---

## Tactical roadmap (proposed)

### Week 1 (stability + correctness)
1. Introduce explicit loot drop-rate schema support.
2. Add/adjust resolver tests for drop behavior.
3. Add `npm run check` script.

### Week 2 (developer experience)
1. Add contributor quickstart to README.
2. Add one integration test covering cycle progression gates (drama + reward decision blocking).
3. Add short inline docs/comments around cycle advance state transitions.

### Week 3 (future-proofing)
1. Add a reproducibility note: how to replay a cycle sequence via seed.
2. Consider a tiny debug/report export command to support balancing workflows.

---

## Suggested concrete changes (small PR-friendly slices)

### Slice A: Reward formalization
- Update types/schema to include optional `dropRate` with default `1.0`.
- Use seeded RNG roll against `dropRate`.
- Add tests for deterministic outcomes with fixed seeds.

### Slice B: Quality gate script
- In `package.json`, add:
  - `"check": "npm run typecheck && npm test"`

### Slice C: Readability around App progression
- In `App.tsx`, replace inline boolean conditions with named helpers.
- Keep behavior unchanged; improve maintainability.

---

## Questions for product/design alignment
1. Should all reward tables be deterministic by default, or probabilistic by data?
2. Are pending reward decisions intended to hard-block progression in all game modes?
3. Is drama queue intended as a strict gate forever, or can some arcs opt into soft gating?

Answering these now will prevent engine-level churn later.

---

## Final verdict
This is a solid foundation with good simulation architecture and separation of concerns. The project is closest to the next quality tier once it resolves schema-vs-behavior ambiguities and streamlines contributor verification paths.
