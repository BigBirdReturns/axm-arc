# RFC: Deterministic Narrative Rails

**Status:** additive prototype and qualification contract  
**Runtime formats:** `axm-narrative-rails/1`, `axm-narrative-recipe/1`, `axm-narrative-ledger/1`  
**Current integration posture:** no existing engine, save, cartridge, drama-card, or player behavior changes

## 1. Decision

AXM Arc will treat continuing-universe authorship as a constrained decision system rather than as a succession of individually authored episodes. A creator or original showrunner defines a machine-readable narrative constitution, reusable situation recipes, actor policies, causal rails, and a qualification corpus. A changing writing team may propose new recipes, expression packs, and cartridge-specific material, but no proposal becomes authoritative until the deterministic rail runtime proves that it fits the current world state, the characters' available methods, the series identity, the causal position of the active story, and the obligations already opened by prior beats.

The first implementation is an additive module under `src/narrative/`. It does not replace `src/engine/drama.ts`. It establishes the smallest complete authority chain needed to test the architecture without altering accepted gameplay:

```text
engine and cartridge state
  -> typed narrative facts
  -> declarative situation recipes
  -> deterministic role binding
  -> candidate eligibility gates
  -> integer saliency sorter
  -> selected candidate receipt
  -> append-only beat and obligation ledger
  -> presentation layer
```

The original creator's scarce attention moves from daily episode construction to constitutional authorship, calibration, and change control. A new room receives a system that can explain why a proposal belongs, why it does not belong, which prior beat it inherits, and which persistent consequence it must pay.

## 2. Problem classification

The current drama system is an event-card generator. It detects useful dramatic facts, including relationship transitions, reward disputes, precedent violations, morale extremes, affliction thresholds, prolonged benching, rivalrous performance gaps, and bonded loss. It immediately converts each trigger into generic prose and three choices, sorts the resulting cards by a short severity table, and removes a card when the player resolves it.

That mechanism is suitable for local incidents. It is not yet a continuing-story authority. The card does not declare its position in a causal rail, does not inherit an earlier promise or grievance, does not record a controlling question, does not preserve a beat graph, and does not require a later event to answer the obligation it creates. Several choices also describe organization-level effects that the current resolver deliberately cannot apply. The prose can therefore imply an institutional consequence while the executable state records only a bounded morale, stress, or loyalty delta.

The missing object is not a larger story bible and not an autonomous prose generator. It is a deterministic editorial authority between simulation facts and presentation.

## 3. Success condition

The architecture succeeds when one constitutional authority and a substantially new production team can continue the same universe without relying on tacit memory held by the old room. The new team must be able to generate unfamiliar material while remaining inside the series' causal and character identity. The system must preserve the possibility of improvement, so it cannot reduce authorship to replaying approved episode templates.

The operational test is stricter than tonal resemblance. A qualified continuation must show that:

1. the story arose from a fact or an inherited beat in the current state;
2. named actors used methods available to those actors under those conditions;
3. the candidate touched every required identity anchor;
4. the beat occupied a legal position on its declared rail;
5. authoritative action paid into persistent state;
6. promises, grievances, evidence claims, dependencies, exposure risks, and constituencies remained open until explicitly resolved, breached, transferred, or inherited;
7. selection was reproducible from the same constitution, state, recipes, and candidates;
8. presentation could not invent a fact or consequence that the semantic receipt did not contain.

## 4. Durable authored objects

### 4.1 Narrative constitution

The constitution is the creator-owned authority for series identity. It declares identity anchors, prohibited moves, named actor policies, causal rails, score weights, and freshness policy. It is versioned and fingerprinted in every selection receipt.

An identity anchor is a required family of semantic tags. A candidate may need to touch a characteristic pressure, a characteristic method, and a persistent payment. This is stronger than a theme label. A candidate that mentions the setting but does not activate the setting's governing mechanism fails before ranking.

A prohibited move is a world-level refusal, such as a consequence-free reset, an unearned omniscient solution, a cutaway that does not re-enter causality, or a character action that the series has declared structurally unavailable.

### 4.2 Actor policy

An actor policy describes method rather than biography. It identifies baseline moves, conditional moves, forbidden moves, and the evidence required to justify a deviation. A character may change, but change must cite world facts that made the new method available. The system therefore allows earned growth while refusing arbitrary voice drift.

Generated agents can derive policies from traits, hidden attributes, role, relationships, morale, stress, and precedent history. Named cast members can carry concise overrides. A writer does not need to author a complete biography for every agent.

### 4.3 Causal rail

A rail declares legal transitions between beat functions. The initial relational rail uses:

```text
establish
  -> pressure or reveal
  -> escalate, reveal, choose, or reverse
  -> consequence
  -> inherit
```

The rail is deliberately permissive about content and strict about earned movement. It does not prescribe an episode outline. It prevents a setup from jumping directly to an ending and prevents a terminal disposition from being claimed on a nonterminal beat.

Additional cartridges may declare investigation, expedition, institutional reform, survival, romance, or campaign rails. The runtime treats each as data.

### 4.4 Situation recipe

A situation recipe is a reusable dramatic mechanism. It declares which facts make it eligible, how actors are cast into roles, which actor methods are exercised, which rail is opened or advanced, what persistent state is paid, which obligations are opened or answered, and which presentation key will render the semantic result.

A recipe describes contested allocation, prolonged exclusion, credit and blame, authority without capacity, dependency threatened, evidence disputed, or another recurring mechanism. It does not describe one named episode. The same contested-allocation recipe can operate over guild loot, Ilyon cure access, Lamp District heat, or an enterprise program budget because the cartridge supplies the actors, institutions, pressures, and consequence vocabulary.

Recipes are JSON-safe authored data. Runtime callbacks are not part of the format.

### 4.5 Beat ledger

Every committed authoritative candidate appends a beat. The beat records its sequence, cycle, recipe, track, beat function, source facts, causal parents, role bindings, actor moves, pressure tags, state payments, obligations opened and resolved, presentation key, and exact score receipt.

A beat cannot erase a prior beat. Later retellings, reports, dialogue scenes, comics, and World representations project from the same ledger.

### 4.6 Narrative obligation

An obligation is the connective tissue that ordinary event-card systems discard. The initial open vocabulary is deliberately extensible and can include promises, grievances, legitimacy claims, dependencies, unresolved evidence, exposure risks, and constituencies.

A beat may open an obligation. Later recipes become more salient when they can intensify or close it. Closing a promise or grievance automatically cites the beat that opened it as a causal parent. A thread is therefore a ledger query over connected beats and obligations, not a separately authored episode graph.

### 4.7 Qualification case

A qualification case is executable institutional memory. It contains a constitution, a bounded state, candidate material, and expected selection, rejection, and commit behavior. Positive cases establish what belongs. Negative cases establish attractive material that must still fail. Boundary cases establish when a conditional character move becomes earned.

A new team qualifies against the corpus before its material can enter a release train. The original creator can improve the constitution or corpus when the cases expose an inaccurate boundary, but cannot waive a failed case by silently changing runtime behavior.

## 5. Deterministic algorithm

### 5.1 Fact projection

The current adapter converts existing `DramaTriggerInput` values into typed narrative facts. It preserves actor roles, source receipt references, severity, trigger-specific data, and semantic pressure tags. Existing agents become actor snapshots with stable tags and integer metrics derived from role, tier, traits, attunements, hidden attributes, morale, stress, assignments, rewards, and affliction history.

This is a shadow projection. No current engine state is mutated.

### 5.2 Recipe materialization

Recipes and facts are traversed in codepoint order. Required roles are bound deterministically from fact actors, named fact roles, or the whole actor pool. Required and forbidden tags establish eligibility. Integer score terms select the strongest actor, and actor ID provides the final tie-break.

A recipe opening a rail derives a stable track ID from the recipe, source fact, and bound actors. A recipe advancing a rail searches only open tracks satisfying its declared actor and pressure overlap. Candidate IDs and obligation IDs are derived deterministically from their semantic inputs.

Generation produces both candidates and failures. A failed role binding, missing track, unresolved payment target, or missing required obligation remains inspectable rather than disappearing from the pool.

### 5.3 Eligibility before saliency

The sorter rejects invalid candidates before assigning a comparative score. Current hard gates include:

- missing source facts or causal parents;
- duplicate candidate, track, or obligation identifiers;
- missing or closed tracks;
- illegal rail transitions;
- nonterminal resolution claims;
- authoritative beats without persistent state payment;
- presentation-only beats carrying authoritative mutations;
- missing identity anchors;
- constitutionally prohibited moves;
- forbidden, conditionally unavailable, or unjustified character moves;
- missing or already closed obligations;
- recipe cooldown violations.

A very high authored priority cannot rescue a candidate that fails a hard gate.

### 5.4 Saliency

Eligible candidates receive an integer score with a complete breakdown:

```text
score =
    authored priority
  + source severity
  + condition complexity
  + relevant open-obligation pressure
  + identity-anchor relevance
  + obligation closure value
  + freshness
  + actor-method fit
  + active-track urgency
  - recipe repetition
```

Weights belong to the constitution. The sign convention is fixed. Every magnitude is a non-negative integer, and repetition is subtracted. Eligible candidates sort by total score, then condition specificity, then source severity, then codepoint candidate ID.

The query is read-only. Selection mutation occurs only during commit.

### 5.5 Custody and commit

Selection receipts include constitution, state, and candidate-set fingerprints. The first implementation labels these fingerprints `fnv1a32` so that no one mistakes them for cryptographic custody. The existing AXM digest and signed-artifact layers can later bind the receipt into stronger provenance without changing the narrative semantics.

Commit verifies the constitution identity and version, constitution fingerprint, state fingerprint, cycle, selected candidate, and current candidate eligibility. It then appends one beat, updates one track, opens or resolves obligations, and returns before-and-after state fingerprints. A stale selection cannot be applied after the state changes.

## 6. Production authority and team turnover

The architecture separates constitutional authority from daily production authority.

| Authority | May change | Must not change silently |
|---|---|---|
| Constitutional editor | identity anchors, prohibited moves, actor policies, rails, score weights, qualification corpus | accepted canon history or qualification expectations without versioning |
| Story-breaking pod | situation recipes, source facts to pursue, proposed rail placement, state payments | constitution or committed ledger |
| Rewrite pod | role bindings, candidate alternatives, causal parents, obligations, presentation keys | executable effects outside typed payments |
| Expression pod | dialogue, report prose, visual staging, localization | actors, facts, choices, obligations, or consequences |
| Continuity and qualification desk | positive, negative, and boundary cases; drift reports | runtime law merely to admit a favored draft |
| Runtime | eligibility, saliency, tie-breaking, receipts, commit | authored meaning or presentation voice |

The constitutional editor does not need to approve every story. The editor maintains the laws that make approvals reproducible. A new team can introduce new situations and better expression while the qualification corpus protects the underlying series.

## 7. Source-plane derivation

Godscar Pocket, Dark Tomb, Common Ship, and future source planes already carry much of the constitutional material. The compiler should derive narrative rails rather than asking creators to duplicate it.

For Godscar Pocket, the control question becomes the track-level governing question. The six pressures become identity anchors and fact tags. Cast responsibilities become role selectors and actor-policy inputs. Faction public goods and characteristic failures become situation mechanisms. Story Physics becomes prohibited moves and state-payment requirements. Consequences become available payment and inheritance classes.

For Dark Tomb, the eight pressures, seven-layer anatomy, depth vector, signature budget, Long Alarm, expedition ledger, incompatible responsibilities, faction receipts, four movements, and persistent consequence classes supply a richer constitution. The narrative layer should bind to those source objects and never create a competing second canon.

A plain Arc without a rich source plane can compile a smaller default constitution from challenges, roles, traits, relationships, precedents, and drama triggers.

## 8. Migration train

### Train A: additive authority

Land `src/narrative/` with types, role binding, recipe materialization, rails, saliency, fingerprints, ledger commit, current-engine adapters, qualification, tests, and this RFC. No existing behavior changes.

### Train B: shadow observation

During test and simulation runs, project current drama triggers into facts and generate rail candidates without displaying or committing them. Compare selection density, actor coverage, repetition, open obligations, and rejected-candidate causes against the current drama queue.

### Train C: stock recipe library

Translate the eight current drama triggers into reusable recipes. Repair the existing stringly effect boundary by moving authoritative effects into typed state payments. Keep current cards as presentation fallbacks.

### Train D: optional runtime memory

Add narrative tracks, beats, obligations, and seen-recipe memory to a new save and portable-run version. Migration initializes an empty ledger for legacy runs. Current accepted save versions remain readable under their existing contract.

### Train E: Workshop State Lab

Expose fact projection, role candidates, failed predicates, score breakdowns, rail position, open obligations, and before-and-after receipts. Add a seed orchard that runs deterministic campaign batches and reports dead recipes, unresolved obligations, repeated actor use, identity-anchor gaps, and accidental single-path endings.

### Train F: source-plane constitutions

Compile narrative constitutions from Godscar Pocket, Dark Tomb, and Common Ship. Add cartridge-specific golden, negative, and boundary qualification cases. World receives the accepted semantic protocol after Arc has closed save, custody, replay, and qualification gates.

## 9. Acceptance

The additive train is accepted when:

1. candidate and recipe input permutation produces identical generation and selection receipts;
2. required roles bind deterministically with inspectable failures;
3. an illegal rail jump cannot be rescued by authored priority;
4. a forbidden character move fails and an evidence-backed conditional deviation can pass;
5. an authoritative beat without a state payment fails;
6. a presentation beat cannot mutate authoritative state;
7. an obligation callback outranks an equally authored tangent when its pressure and closure value require it;
8. closing an obligation cites its opening beat as a causal parent;
9. commit refuses a stale state or constitution fingerprint;
10. qualification cases can encode positive, negative, boundary, and commit expectations;
11. the complete existing Arc typecheck and test suite remains green;
12. no current engine, cartridge, save, or UI output changes.

Later integration is not accepted merely because generated scenes appear plausible. It must also prove long-run obligation closure, bounded repetition, cast distribution, source-plane identity retention, save and export custody, and independent cold-team qualification.

## 10. Failure modes

The principal failure mode is constitutional overfitting. A corpus made only from existing successful episodes can preserve imitation while blocking legitimate growth. The remedy is to include boundary cases, alternate successful methods, and explicit earned deviations.

A second failure mode is tag laundering, where an author adds required tags without providing the corresponding mechanism. The qualification corpus and state-payment receipts must test behavior, not tag presence alone.

A third failure mode is score politics. Saliency weights can hide editorial preferences inside arithmetic. Every score component is therefore visible, integer-only, constitution-owned, and versioned.

A fourth failure mode is expression capture. Strong dialogue can make a semantically empty candidate feel finished. Presentation remains downstream of authoritative facts, choices, payments, and obligations.

A fifth failure mode is endless continuity debt. The sorter rewards closure, but a cartridge may still create more obligations than it can answer. Seed-orchard acceptance must measure the age, pressure, and terminal disposition of open obligations across full campaigns.

## 11. Control question

Can a writer who never sat in the original room explain, from the receipts alone, which world pressure produced the scene, why these actors used these methods, which prior beat it inherited, what persistent state it changed, and what future decision it made unavoidable?
