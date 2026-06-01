# Roadmap

**Canonical strategic map for axm-arc.** Supersedes the implicit Sprint 1–4
backlog in `HANDOFF.md` (that backlog is still accurate as a task list; this
doc reframes *why* and *in what order*). If you're an agent or contributor
picking up cold, read this first.

## Thesis — one engine, two audiences, no fork

axm-arc is a **content-free deterministic simulation engine** plus a
**portable arc format**. The guild game is the first arc. Enterprise
(program offices, staffing, org modeling) is a later arc. **They are the same
product.** The engine hardcodes no challenge, no attribute, no role.

The consequence that governs every decision: **polishing the game IS
enterprise work.** A clearer assign screen, a legible cycle loop, a manual
that explains the systems, counters that animate — none of these are
guild-specific. They accrue to *whoever shows up with an arc*. There is no
"player thread vs. platform thread" fork. UX polish on the loop is
deterministic-team-management UX for any domain that loads an arc.

So we do not choose between "make the game good" and "make the platform."
We make the loop excellent (which is dual-use by construction) and, in
parallel, build the thin layer that lets *other people's arcs* run on it.

## The three threads

### Thread 1 — Loop legibility & feel (in progress, compounding)
Make the core loop easy to navigate, correct to progress, and satisfying to
run. Every win here is dual-use for free.

- ✅ Cycle readiness checklist, intent recap, reports "so what" layer
- ✅ Assign decision support (recommended roster, projection legibility)
- ✅ Economy correctness (gold, upkeep, farm guard, downed recovery)
- ✅ **Codex/manual** — attributes, roles, traits, facilities, check math
- ✅ **Liveness primitive #1** — count-up on resource bar
- ✅ **Release notes + deploy pipeline** — ends stale-build drift
- 🔜 Hook work (`HOOK.md`): 60-sec-to-first-win, more liveness primitives,
  per-arc skin layer
- 🔜 Sprint-2 gaps: Auto-Resolve Policy (#5), full Drama Decision Feedback
  with provenance tags (#7)
- 🔜 Engine debt: explicit `resolveEvent` on RunReport (kill the heuristic)

### Thread 2 — Arc-as-artifact (the bridge; mostly unbuilt)
The smallest layer that turns the polished engine into something a stranger
can use. **This is the highest-leverage unstarted work** — it converts all of
Thread 1 into a platform without new engine capability.

- 🟡 **Arc import** — JSON → `validateArc()` → store → load. Storage layer
  exists (PR #6); the import/validate/preview flow is shell-only. (HANDOFF #8)
- 🔴 **Trust labels in the UI** — bundled / imported-unsigned / verified /
  quarantined. Schema/taxonomy documented; no UI. Display + metadata only,
  no runtime behavior change yet. (HANDOFF #9)
- 🔴 **Deploy-variant flag** — build-time `game-first` / `enterprise-first` /
  `research-first` switches title/lobby entry points without a code fork.
  (HANDOFF #10)

When Thread 2 is done, **arc distribution becomes possible without us building
a marketplace** — we ship the runtime + format + import + trust; arcs are
content other people make. Who runs any eventual marketplace (us, a third
party, none) is a deliberately deferred decision, not a prerequisite.

### Thread 3 — Authoring (makes people *want* to make arcs)
The tools that make arc creation pleasant, and that make authored arcs
self-checking.

- 🔜 **Designer port** (`DESIGNER_PORT.md`) — multi-agent roster workshop as
  a real authoring mode. 8 sequenced steps, none started. Prototype lives at
  `docs/designer-prototype/`.
- ✅ **Codex-as-QA** (`BALANCE.md`) — the manual's arc-data backlinks double
  as an authoring audit (found the Wits role-orphan). Free QA surface for any
  authored arc.
- 🔜 A `validateArc` extension could assert the role/check coverage audit from
  `BALANCE.md` automatically.

## Sequencing recommendation (owner decides)

1. **Land the current branch** (codex + liveness + release-notes + deploy +
   design docs). Confirm the deploy Action works on first merge.
2. **Thread 2 trio** — import → trust labels → variant flag. Smallest set that
   makes the engine a platform. ~1–2 sprints.
3. **Telemetry** (HANDOFF #11) — becomes obvious *after* strangers can run
   arcs; you'll want to know what they do.
4. **Threads 1 & 3 continue in parallel** as feedback and authoring needs
   pull them. Hook work and the designer port don't block Thread 2.

## What's deferred on purpose
- Marketplace economics (falls out of Threads 2+3; not a build target yet).
- Genesis-signed arcs / ML-DSA verification (the landing page's "later" —
  trust-label plumbing in Thread 2 is the honest precursor).
- The Wits rebalance (`BALANCE.md`) — options costed, decision pending.

## Status snapshot (2026-06-01)
- Sprint 1: ✅ done, live.
- Sprint 2: 🟡 #5 and #7 remain.
- Sprint 3 (= Thread 2): 🔴 the bridge, barely started — **the gap that matters.**
- Sprint 4: 🔴 telemetry/enterprise-arc/presets — after Thread 2.
- Off-backlog work shipped (codex, liveness, hook/balance docs, release-notes,
  deploy): all Thread 1, all dual-use, all driven by playtest + ops needs.
