# Lineage brief — the live-service party RPG

**Reference lineage:** the live-service collectible party RPG — a growing roster
drawn from rotating recruitment pools, timed events on a cadence, resource caps
that pace sessions, a collection as the long-horizon goal.
**Our cartridge:** `cartridges/wandering-court.arc.json` (clone #4).

## Core tension
Roster breadth vs. investment depth. Limited resources force a standing choice:
recruit new members (breadth, coverage, the next shiny) or deepen the ones you
have (power, reliability). The loop never funds both, so every resource is a
vote for one strategy over the other.

## Retention loop
Cadence and rotation. Timed events and a rotating recruitment pool create a
return rhythm — content and options that are available *now* and won't be later.
The collection itself is the long-term goal; capped daily/cyclic resources pace
engagement so players return on a schedule rather than exhausting the game in
one sitting.

## Progression arc (the beats)
Onboarding roster → the first recruitment pull (the hook lands) → an event
introducing a wall the current roster can't clear → the investment decision
(pull for the answer, or deepen what you have) → a seasonal finale that closes
the cadence and resets it. The "wall that your current roster *almost* clears"
is the beat that converts curiosity into commitment.

## Tuning lessons
- Recruitment rates are THE knob: generous enough to hook, rare enough to
  sustain the chase. This single dial sets the entire feel.
- Event difficulty tuned to *almost* require the newest options — enough to make
  them desirable, never so much that it hard-locks players who don't have them.
- Resource caps pace sessions; they are a retention tool, not a wall — set to
  invite a return, not to punish absence.

## Known failure modes
- **The one to carry as a warning, not a feature:** predatory rate design (units
  gated behind punishing pull odds, events engineered to *require* paid options)
  buys short-term revenue and burns the goodwill that retention actually runs
  on. Millions of hours taught the loop's *shape* AND taught that its
  exploitative tuning is a failure mode, not a best practice.
- Too-generous rates → the chase collapses → the collection goal loses its pull.
- Cadence too aggressive → fatigue → churn. The rhythm has to breathe.

## How our cartridge honors it — and where it doesn't yet
The economy (Gleam / Summons / Court Favor / Relic Dust), the "Seals of the
Season" chain, and the Eclipsed Throne finale carry the cadence-and-collection
shape. Critically, our version keeps the *structural* retention beats — the
investment choice, the seasonal wall, the growing roster — while deliberately
**leaving the predatory monetization on the cutting-room floor**. That is the
lineage's real lesson applied: take the loop that kept people engaged, drop the
tuning that exploited them. The conformance sweep clearing **13/15 seeds** sits
closest of all our clones to the "event wall you *almost* clear" beat — the
tuning here is doing the lineage's job well. **Divergence to bank:** the rotating
recruitment pool is expressed as a static namePool rather than a
cadence-rotating one; a future pass could make recruitment availability shift by
progression tier to embody the rotation beat more literally.
