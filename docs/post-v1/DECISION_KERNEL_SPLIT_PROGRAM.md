# Decision kernel split program

## Decision

The enterprise bare-metal audit has already rejected the claim that the current public Arc engine is a domain-neutral decision kernel with only translated nouns. Its deterministic simulation semantics are valuable, but the canonical data model and eleven-stage cycle still carry substantial game policy.

The accepted post-v1 disposition is **Split**.

The first implementation creates a separately versioned package inside `axm-arc`:

```text
packages/decision-kernel/
```

The package name is:

```text
@axm/decision-kernel
```

This is an ownership decision, not a permanent repository-location promise. The package starts inside Arc because Arc already owns the reviewed deterministic and receipt law, and because an in-repository extraction can preserve exact game behavior while making the dependency boundary executable. Moving the package to a separate repository later must preserve its package identity, semantic version, conformance vectors, and receipt compatibility. It may never create an Arc implementation and a World implementation that merely share tests.

## Kernel object

The kernel governs a bounded decision record:

```text
state
+ work contract
+ candidate options
+ constraints and policy identifiers
+ evidence and assumptions
+ authorizing authority
+ expected effects
+ observed outcome or bounded simulation
→ feasibility
→ selected option
→ reconciliation
→ validated transition
→ immutable receipt
→ next feasible options
```

The kernel does not require a game loop, a browser, a roster screen, or randomness. A consumer may compose those policies around it.

## Public contract

The minimum versioned API supports:

1. actors or capacity units with opaque identifiers and capabilities;
2. work contracts with resources, risks, constraints, approval requirements, and options;
3. deterministic feasibility and exact rejection reasons;
4. expected effects tied to model and policy versions;
5. assumptions and an authorizing actor, office, or authority record;
6. optional bounded simulation supplied by a policy adapter;
7. externally observed outcomes with evidence references and provenance;
8. exact expected-versus-actual reconciliation;
9. explanation that distinguishes observed facts, model inference, supplied attribution, and unresolved variance;
10. a validated resulting state transition;
11. a canonical immutable decision receipt;
12. next feasible options derived from the resulting state.

Randomness is an optional policy input. Externally observed results are not converted into simulated outcomes merely to fit the existing game cycle.

## Receipt law

The candidate receipt format is:

```text
axm-decision-receipt/v1
```

Every receipt records:

- kernel version;
- policy identifiers and versions;
- exact input state identity;
- work contract identity;
- feasible and refused options with reasons;
- selected option;
- assumptions;
- authorizing authority;
- expected effects;
- observed or simulated outcome and its evidence;
- reconciliation and unresolved variance;
- supplied and inferred attribution kept separate;
- resulting transition;
- exact output state identity;
- next feasible options;
- canonical receipt digest.

A client may attach presentation or custody metadata outside the canonical decision facts. It may not alter the receipt digest by restyling or relabeling the decision.

## Package boundary

The package may import only:

- deterministic value and identifier utilities;
- versioned kernel types and validation;
- canonicalization and digest primitives;
- pure feasibility, reconciliation, transition, and next-option functions.

It may not import:

- React, DOM, browser globals, or local storage;
- bundled cartridges or source planes;
- stress, morale, afflictions, traits, relationships, recruitment, facilities, items, loot, attunement, progression, narrative, drama, or heroic events;
- Arc game screens or World representations;
- a domain name such as guild, raid, boss, program, project, or enterprise;
- an external network client.

A source guard and package dependency test enforce that boundary.

## Arc migration

Arc becomes a kernel consumer and game-policy host.

The existing engine is not deleted in one change. The migration proceeds by extracting one canonical fact at a time behind adapters while exact game conformance remains green.

The initial game policy pack owns:

- generated and authored agents;
- stress and morale;
- afflictions and downed state;
- relationships and traits;
- recruitment and infrastructure;
- resources, items, rewards, loot, and attunement;
- progression tiers and access milestones;
- narrative, drama, and heroic events;
- random challenge resolution;
- the current eleven-stage cycle orchestration.

The adapter converts Arc organization and challenge facts into kernel work contracts and options. The kernel returns canonical decision facts. The game policy uses those facts to perform the existing deterministic simulation and then records the resulting observed or simulated outcome back through the kernel receipt.

No existing game field becomes mandatory in the kernel merely to preserve source compatibility.

## World migration

World consumes the exact same kernel package version and conformance vectors as Arc. World may:

- present feasible options and refusal reasons;
- collect a selected option and authority;
- receive or enter an observed outcome;
- display reconciliation, receipt, and resulting state;
- persist and export the record;
- compose neutral or cartridge-owned presentation.

World may not retain a separate enterprise evaluator, scorer, or receipt constructor after the shared kernel exists.

For identical input facts and policy versions, Arc and World must emit byte-equivalent canonical decision facts and receipt digests.

## Conformance program

The kernel release includes vectors for:

- capability, capacity, budget, risk, and approval constraints;
- feasible and infeasible option sets;
- deterministic ordering and locale independence;
- expected effects and policy versioning;
- observed-outcome ingestion;
- partial and contradictory evidence;
- reconciliation without invented attribution;
- transition refusal;
- next-option derivation;
- canonical receipt digest and replay;
- unknown and incompatible version refusal.

The reference enterprise loop must complete in Node without React, browser globals, local storage, game fields, or bundled content.

## Quantitative exit report

The boundary audit from issue #117 is rerun under the same classification rules. The report compares before and after for:

- game-only public symbols;
- mandatory game placeholders;
- game-policy stages in the canonical kernel lifecycle;
- prohibited dependency edges;
- existing files requiring semantic enterprise edits;
- kernel, policy, cartridge, custody, and presentation module counts;
- cross-client receipt equivalence.

A smaller line count is not itself a success condition. The controlling measure is whether Arc and World can disagree about a lawful decision without one of them violating the versioned kernel contract.

## Activation boundary

No implementation begins until coordinated Arc and World v1.0.0 releases exist, the local operator receipt binds them, and the v1 source, run, holder-estate, canonicalization, and recovery contracts are frozen.
