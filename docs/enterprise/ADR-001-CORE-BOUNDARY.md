# ADR-001: Split the commercial decision kernel from the game engine

- Status: Accepted
- Date: 2026-07-12
- Milestone: axm-arc #117 / axm-world #98
- Decision: **Split**

## Context

The executable boundary audit measures the implemented Arc engine, not its product positioning:

- 93 of 194 exported symbols (47.9%) classify as game-only.
- A valid representative cartridge exposes 67 mandatory game-shaped schema paths.
- Six of fourteen canonical cycle stages are mandatory game policy.
- The proposed kernel is only 7.4% of engine source and still has three dependency violations into game-shaped types and constants.
- At least eleven existing engine files require edits rather than configuration to support a commercial workflow.

The neutral reference completed a lawful delivery-staffing loop in a two-module, 305-line headless package without React, DOM, localStorage, Arc cartridges, or game state. World could ingest and render the enterprise contract only by branching before its Arc-specific bootstrap and shell. Because Arc does not yet publish that neutral package, the World proof required a parallel evaluator. That duplication is direct evidence that the current repository boundary is not a reusable commercial substrate.

## Decision

Extract a smaller commercial decision kernel with its own package and contract version. Arc becomes one consumer through a game-policy adapter; World consumes the same kernel for neutral enterprise cartridges and the game adapter for Arc cartridges.

The kernel owns only:

- work-contract validation;
- feasible option enumeration and comparison;
- capability, capacity, budget, and risk evaluation;
- authorization and assumption recording;
- simulated or externally observed outcome ingestion;
- expected-versus-actual variance without unsupported attribution;
- immutable receipt chaining and state transitions;
- deterministic serialization, verification, reload, and next-decision derivation.

The kernel does not own morale, stress, afflictions, relationships, traits, recruitment, facilities, loot, items, equipment, attunement, progression, drama, narrative, downed status, heroic modes, React, DOM, localStorage, or bundled cartridges.

## Integration boundary

- `axm-core` orchestrates commercial workflows and query routing.
- The extracted decision package accepts domain contracts and organizational snapshots from callers.
- Genesis-backed evidence references attach to observed outcomes and receipts; the kernel records references but does not invent or fetch evidence.
- Arc maps game challenges and policies onto the kernel where semantics genuinely match, while retaining random resolution and game lifecycle policy outside the kernel.
- World selects the neutral or game adapter from the imported cartridge kind and must not duplicate evaluation law.

## Consequences

- The current `runCycle` remains a game-policy composition until decomposed; it is not renamed as the commercial lifecycle.
- The World enterprise evaluator in `db3084f` is a proving adapter and must be replaced by the synchronized extracted package before #98 closes.
- Existing Arc game tests remain the compatibility gate during extraction.
- “Modularize inside Arc” is rejected because the demonstrated neutral contract and receipt model do not depend on Arc's public schema, while Arc's candidate scoring modules still depend on game-shaped `Agent` and constants.
- “Keep” is rejected by the audit thresholds and mandatory placeholder count.

## Exit controls

The split is complete only when:

1. Arc and World consume the same versioned decision package.
2. The enterprise reference has zero game placeholders and zero game/browser/presentation dependencies.
3. Externally observed outcomes and evidence references survive export and reload.
4. World passes the enterprise flow offline using the synchronized package.
5. Existing Arc and World game references remain green.
