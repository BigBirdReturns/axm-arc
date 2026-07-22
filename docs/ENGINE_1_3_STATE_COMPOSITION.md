# Engine 1.3 cartridge state and composition contract

Engine 1.3 adds two bounded, creator-authored capabilities to the existing deterministic Arc ABI:

1. **cartridge state**, which makes a source plane's persistent variables executable rather than merely descriptive;
2. **composition law**, which makes embodied roster and operating constraints deterministic rather than receiver inference.

Both capabilities are optional and additive. An engine-1.2 cartridge with neither field remains valid and retains its existing behavior. A cartridge that declares either capability must set `meta.engineVersion` to at least `1.3.0`.

## Cartridge state

An Arc may declare `stateDefinitions`. Definitions are content-addressed authored law and use one of three bounded kinds:

- `number`, with finite minimum, maximum, and initial value;
- `enum`, with an explicit value set and initial member;
- `boolean`, with an initial value.

Every definition also declares a label, description, and visibility class: `public`, `operator`, or `private`.

The engine owns the corresponding `Organization.cartridgeState` record. Founding and save restoration initialize every declared state in canonical identifier order. A historical organization may omit the record; the engine backfills only the initial values declared by the exact bound Arc. An organization carrying an undeclared state identifier is refused.

### State effects

An outcome may declare `stateEffects` using a deliberately small operator set:

- `set` assigns a valid value;
- `increment` adds a non-negative finite amount to a number;
- `decrement` subtracts a non-negative finite amount from a number;
- `transition` moves an enum from an optional expected source to a declared target.

Numeric overflow is rejected unless the effect explicitly authors `overflow: "clamp"`. There is no silent clamp and no receiver-selected policy.

Effects are validated against state definitions before play. At runtime they produce exact `CartridgeStateChange` receipts containing the state identifier, before value, after value, operation, authored reason, challenge, outcome, and cycle.

### Cycle ordering and atomicity

The existing cycle resolves accepted assignments simultaneously under the established game policy. Engine 1.3 applies authored state effects after that resolution in canonical challenge-and-party order while preserving the original report order for presentation. This prevents assignment order from changing the final cartridge state and prevents one assignment's newly written state from silently changing another assignment that was already accepted for the same cycle.

Each report carries its own state changes. The cycle event stream also receives `cartridge_state_change` entries. If any effect in a report is invalid, the state application throws before a result is returned. The supplied organization is never mutated in place.

This ordering is part of the ABI. A future cartridge that needs state-dependent sequencing inside one cycle must author a progression boundary or use a separately versioned ordered-resolution mechanic.

## Declarative composition

An Arc may declare `compositionProfiles`. A profile has:

- stable identifier, name, and description;
- tags for categorical capacities;
- numeric metrics;
- named numeric ranges;
- explicit dependencies.

An authored founder may bind to one profile through `compositionProfileId`. A challenge may declare `compositionConstraints` using these bounded operators:

- `role-count`;
- `profile-count`;
- `tag-count`;
- `metric-sum` with `gte`, `lte`, or `eq`;
- `range-overlap`;
- `fraction`;
- `redundancy` by distinct profile;
- nested `all`;
- nested `any`.

The format accepts no executable expression, arbitrary callback, locale-sensitive comparison, or domain-name branch.

### Evaluation output

`evaluateComposition()` returns:

- `feasible`;
- one result per top-level constraint, with nested child results where applicable;
- exact rejection reasons;
- the union of profile dependencies;
- detected single points of failure, including uniquely required actors and dependencies.

Input agents and result identifiers are canonically ordered. The same Arc, agents, and challenge therefore produce the same evaluation independent of UI ordering.

### One authority rule

Composition is evaluated by Arc-owned engine law in both places where it matters:

- `runCycle()` refuses an infeasible assignment before capacity is debited;
- direct `resolveChallenge()` calls refuse the same assignment.

Authoring preview and World projection may call the evaluator and display its result. They may not duplicate, weaken, or replace it.

## Save migration

The engine save advances from version 2 to version 3. Version 2 already binds the exact cartridge digest, so it may migrate safely. The v2-to-v3 migration preserves the organization and pending engine choices, introduces an empty cartridge-state record, then deterministically backfills declared initial state from the exact bound Arc.

Version 1 remains refused because it lacks exact cartridge identity. The outer `axm-cartridge-run/v3` envelope does not change merely because the opaque engine save advances. It continues to carry the exact Arc, engine save, pending choices, integrity, and namespaced runtime memory.

## Book II projection

The Dark Tomb compiler now emits engine-1.3 state for:

- Long Alarm phase;
- signature credibility;
- external visibility;
- every authored inherited consequence.

A successful delve writes its exact consequence. Breach, visibility, and Alarm consequences also change their corresponding shared state. The receiver reads those facts; it does not infer them from narrative copy.

## Book III projection

The Common Ship compiler now emits:

- the eight ship-state tracks as bounded number definitions;
- every structured embodiment profile as a composition profile;
- founder-to-profile bindings;
- the six Common Watch viability categories as deterministic constraints;
- authored ship-state effects on successful watches.

The six categories remain visible as:

1. role coverage;
2. temporal overlap;
3. habitat compatibility;
4. translation resilience;
5. handoff continuity;
6. life-fraction fairness.

The first recension's body, habitat, clock, translator, reserve, and life-fraction prose remains embedded in the source. Engine 1.3 adds the bounded executable profile and constraint layer required for actual play.

## Compatibility rules

- Engine-1.2 cartridges remain valid and do not acquire undeclared state.
- State and composition fields on an older engine floor are refused.
- Unknown state identifiers, unknown profiles, unknown roles, invalid values, invalid ranges, duplicate identifiers, and incompatible transitions fail validation.
- New operators require a new engine version. Receivers may not emulate unsupported operators.
- World must vendor the exact accepted Arc source and pass drift checks before projecting this ABI.

## Gate boundary

This contract completes the Arc-side Gate 1 substrate. It does not itself ship the Lamp District, Relief Circuit, Tomb Forge, Watch Forge, World underworld receiver, World vessel-management receiver, or the Gate 2 source-plane registry and vendoring expansion.