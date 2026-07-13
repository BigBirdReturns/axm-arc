# Roadmap

**Canonical strategic map for axm-arc.** Supersedes the implicit Sprint 1–4
backlog in `HANDOFF.md` (that backlog is still accurate as a task list; this
doc reframes *why* and *in what order*). If you're an agent or contributor
picking up cold, read this first.

## Thesis — one engine, two audiences, no fork

axm-arc is a **content-free deterministic simulation engine** plus a
**portable authored-model format**, custody lifecycle, and durable record seam.
The guild game is the first arc. Enterprise applications (program offices,
staffing, org modeling) may be later arcs. **They use the same substrate.** The
engine hardcodes no challenge, attribute, role, domain, or presentation.

The consequence that governs every decision: **polishing the game IS
enterprise work.** A clearer assign screen, a legible cycle loop, a manual
that explains the systems, counters that animate — none of these are
guild-specific. They accrue to *whoever shows up with an arc*. There is no
"player thread vs. platform thread" fork. UX polish on the loop is
deterministic-team-management UX for any domain that loads an arc.

So we do not choose between "make the game good" and "make the platform."
We make the loop excellent (which is dual-use by construction) and, in
parallel, build the thin layer that lets *other people's arcs* run on it.

### The game-completion gate

The broader thesis raises the bar for the reference game; it does not excuse an
unfinished one. The First Charter must work for a stranger with no explanation,
carry a campaign from opening choice through a legible ending, make consequence
and recovery understandable, save and resume reliably, and feel intentionally
crafted on desktop and mobile.

The platform proof must emerge from those player actions. Determinism is not
pacing. Portability is not fun. A digest is not provenance. Honest fixed moments
do not excuse a campaign without enough consequential agency. Tools, Library,
Workshop, and ledger support the game; they do not substitute for finishing it.

## The three threads

### Thread 1 — Loop legibility & feel (in progress, compounding)
Make the core loop easy to navigate, correct to progress, and satisfying to
run. Every win here is dual-use for free.

- ✅ Cycle readiness checklist, intent recap, reports "so what" layer
- ✅ Assign decision support (recommended roster, projection legibility)
- ✅ Economy correctness (gold, upkeep, farm guard, downed recovery)
- ✅ **Codex/manual** — attributes, roles, traits, facilities, check math
- ✅ **Liveness primitive #1** — count-up on resource bar
- ✅ **Liveness primitives #2–5** (keyframes lifted from digest-prototype):
  wordSet on digest masthead, digestIn on digest root, barPulse on
  threshold crossings, pressSweep on cycle transition. `<AttendedStamp>`
  available; drama-resolution wire-up future.
- ✅ **Light/dark theme toggle** (lifted from designer-prototype) — token
  map under `:root[data-theme="dark"]`, `☾`/`☀` toggle in the top bar,
  persisted to `axm-arc:theme:v1`, first load honors `prefers-color-scheme`.
- ✅ **Release notes + deploy pipeline** — ends stale-build drift
- 🔜 Hook work (`HOOK.md`): 60-sec-to-first-win, more liveness primitives,
  per-arc skin layer
- 🔜 Sprint-2 gaps: Auto-Resolve Policy (#5), full Drama Decision Feedback
  with provenance tags (#7)
- 🔜 Engine debt: explicit `resolveEvent` on RunReport (kill the heuristic)

### Thread 2 — Arc-as-artifact (the shipped bridge)
The layer that turns the engine into something a stranger can author, hold,
inspect, transfer, and run. The foundation is shipped; later signing and
cross-player run continuity must remain honestly distinguished from it.

- ✅ **Arc import** — JSON → `validateArc()` → store → load. `arc-library.ts`
  is the versioned localStorage layer; LibraryScreen is the import/inspect/
  load/remove surface. (HANDOFF #8)
- ✅ **Trust labels in the UI** — bundled / imported-unsigned / verified /
  quarantined. Type lives on `ArcLibraryEntry` (provenance, not content);
  `<TrustLabel>` surfaces it in the library, codex header, and title screen.
  Verified/quarantined are reserved placeholders for future signing/admin
  work; no runtime behavior depends on trust yet. (HANDOFF #9)
- ✅ **Deploy-variant flag** — build-time `game-first` / `enterprise-first` /
  `research-first` switches title/lobby entry points without a code fork.
  Validated at Vite config load; positioning only, not capability.
  (HANDOFF #10, docs/DEPLOY.md)

**Thread 2 is done.** Arc-as-artifact is live: arcs import from outside the
bundle, provenance shows in the UI, and the same engine ships under different
positioning without a fork.

**Maintenance posture:** Library and Workshop are shipped foundations, not
abandoned lanes and not open-ended feature priorities. Keep their validation,
custody, accessibility, and game-support paths correct. Expand them now only
when the work closes the reference game, enables the changed-run custody round
trip, or repairs an artifact/record invariant.

When Thread 2 is done, **arc distribution becomes possible without us building
a marketplace** — we ship the runtime + format + import + trust; arcs are
content other people make. Who runs any eventual marketplace (us, a third
party, none) is a deliberately deferred decision, not a prerequisite.

### Thread 3 — Authoring (makes people *want* to make arcs)
The tools that make arc creation pleasant, and that make authored arcs
self-checking.

The cartridge Workshop's validate/preview/save/export loop is shipped. The
separate roster Designer below remains a proposed deeper authoring workbench;
do not confuse its status with the existing Workshop.

- 🔜 **Designer port** (`DESIGNER_PORT.md`) — multi-agent roster workshop as
  a real authoring mode. 8 sequenced steps, none started. Prototype lives at
  `docs/designer-prototype/`.
- ✅ **Codex-as-QA** (`BALANCE.md`) — the manual's arc-data backlinks double
  as an authoring audit (found the Wits role-orphan). Free QA surface for any
  authored arc.
- 🔜 A `validateArc` extension could assert the role/check coverage audit from
  `BALANCE.md` automatically.

## Sequencing recommendation (owner decides)

1. **Finish the reference game.** Cold onboarding, full First Charter campaign,
   meaningful decisions, legible consequence, ending, failure recovery,
   accessibility, mobile/desktop craft, and reliable save/resume.
2. **Protect artifact and record truth.** Fix silent save loss; preserve digest,
   custody, ledger, and compatibility invariants while the game is finished.
3. **Continue authoring where it improves the proof.** Prefer Workshop and
   validation work that helps create, tune, and complete real cartridges.
4. **Add broader-domain work only with its missing contracts named.** Enterprise
   or research arcs need model validity, scale, evidence, privacy, and authority
   decisions; a lobby variant is not that product.

## What's deferred on purpose
- Marketplace economics (falls out of Threads 2+3; not a build target yet).
- Genesis-signed arcs / ML-DSA verification (the landing page's "later" —
  trust-label plumbing in Thread 2 is the honest precursor).
- The Wits rebalance (`BALANCE.md`) — options costed, decision pending.

## Historical status snapshot (2026-06-01)

This snapshot records the state on that date and is not the current queue. Read
`STATUS.md` for present truth; later work completed portions marked red below.
- Sprint 1: ✅ done, live.
- Sprint 2: 🟡 #5 and #7 remain.
- Sprint 3 (= Thread 2): 🔴 the bridge, barely started — **the gap that matters.**
- Sprint 4: 🔴 telemetry/enterprise-arc/presets — after Thread 2.
- Off-backlog work shipped (codex, liveness, hook/balance docs, release-notes,
  deploy): all Thread 1, all dual-use, all driven by playtest + ops needs.
