# Balance — findings from the codex backlinks

**Source:** arc-data analysis of `src/arcs/first-charter.ts`, surfaced by the
codex's auto-derived backlinks (the same data the in-game manual now renders).
**Status:** findings + options. **No rebalance committed.** Changing role or
check weights ripples through the deterministic resolver and every fixed-seed
test — these are decisions for the owner, not a silent dispatch.

## How this was found

The codex (`src/codex/`) renders, for every attribute, *which roles weight it*
and *which mechanic checks use it* — derived live from arc data, not authored.
Reading those backlinks across the whole arc makes structural gaps visible that
no single screen shows. The first one fell out immediately.

**This is the codex's third use.** It is a player manual, an enterprise
model-documentation surface, and — demonstrated here — an **arc-author QA tool**
that surfaces orphaned attributes, dead traits, and uncovered checks the moment
an arc is authored. Same components, three audiences. When the designer port
ships, this QA view is free.

## Finding 1 — Wits is orphaned at the role level

A playtester (cycle 8) asked, in effect, "what does Wits even do?" The data
says her confusion was structural, not a missing tooltip.

**Roles — Wits leads none of them.** Every role's primary attribute (highest
weight) is something else; Wits caps at 0.2 anywhere:

| Role | Power | Wits | Spirit | Mettle | Leads with |
|------|-------|------|--------|--------|------------|
| Vanguard | 0.2 | 0.1 | 0.1 | **0.6** | Mettle |
| Skirmisher | **0.6** | 0.2 | 0.1 | 0.1 | Power |
| Mender | 0.1 | 0.2 | **0.6** | 0.1 | Spirit |

**Checks — Wits leads 2 of 15, and is a real secondary in 5 more:**

- *Leads:* "Navigate the Route" (0.7), "Clear the Flanks" (0.6)
- *Secondary:* "Cut Off the Retreat" (0.5), "Triage the Wounded" (0.3),
  "Sustain the Assault" (0.2), and others.

### The gap

The player assigns agents to challenges **by role**. Roles are the lever for
*who develops what* — you recruit and train toward a role's primary attribute.
But **no role concentrates Wits**, while two challenges (13%) lead with it.

So a Wits-heavy check ("Navigate the Route") cannot be reliably staffed through
the role system. It demands a high-Wits *individual*, which the role-based
roster UI gives the player no deliberate way to cultivate or even notice. Wits
is mechanically alive but strategically invisible — exactly the felt experience
of "this stat does nothing."

The other three attributes each have a role home AND check homes. Wits has
check homes but no role home. It is the only asymmetric attribute.

### Options (pick one; do not assume)

1. **Add a fourth Wits-led role** (e.g. a Scout/Tactician with `wits` ~0.6).
   *Cleanest conceptually* — gives Wits a home symmetric with the others.
   *Cost:* additive but non-trivial — starting-roster generation assigns roles,
   challenges declare role requirements, and the assign UI filters by role; a
   new role touches all three. Deterministic test impact: low if the existing
   roster's role distribution is unchanged and the new role is opt-in via
   recruitment.

2. **Re-home an existing role onto Wits** (e.g. make Skirmisher `wits`-primary,
   shifting Power to a different role or check). *Cheapest in surface area.*
   *Cost:* changes resolver outputs for any test exercising first-charter with
   fixed seeds — expect a snapshot/expectation avalanche. Also a balance shift
   that wants playtesting.

3. **Declare Wits a deliberate specialist/support stat** — accept it has no role
   home by design, and make that *legible* instead of fixing it. The codex
   already surfaces "Checked in: Navigate the Route, Clear the Flanks…"; lean
   into it with a "specialist attribute" label and a recruitment hint when a
   high-Wits individual appears. *Cost:* lowest; design honesty over symmetry.
   Risk: if the player can't act on Wits through any system, it stays a
   feel-bad even when explained.

4. **Do nothing yet** — log it, ship the codex (which at least *explains* Wits),
   and revisit alongside the Karazhan arc, where a fresh attribute map is being
   authored anyway and the role/check symmetry can be designed in from the start.

### Recommendation (owner decides)

Option 3 or 4 for *now* — the codex makes Wits legible today at zero balance
risk. Option 1 is the right *eventual* answer if first-charter is meant to teach
all four attributes as equals. Avoid Option 2 unless you're ready to re-baseline
the deterministic tests and playtest the shift.

## Why this is its own doc

Balance is not legibility (the codex, shipping now) and not the hook
(`HOOK.md`). It's the arc-design layer: whether the *content* the engine runs is
internally coherent. As more arcs are authored (Karazhan, enterprise), this doc
is where the codex-as-QA findings accumulate — each new arc gets a backlink
audit before it ships.

## Method note (reproducing the audit on any arc)

For a given arc, for each attribute: (a) does any role lead with it? (b) does any
check lead with it? An attribute that fails (a) but passes (b) is *role-orphaned*
(the Wits pattern). An attribute that fails both is *dead* (cut it or wire it).
An attribute that passes (a) but fails (b) is *cosmetic* (roles develop it but
nothing tests it). The codex backlinks render exactly the data needed to run
this check by eye; a future `validateArc` extension could assert it.
