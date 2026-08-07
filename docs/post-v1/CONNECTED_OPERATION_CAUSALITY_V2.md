# Connected-operation causality v2

## Problem

`axm-connected-operation/v1` correctly proves one bounded operation between The Relief Circuit and The Lamp District. It preserves both cartridge identities, both state sets, selected people, resources, evidence, environmental loads, exposure, dissent, uncertainty, obligations, unknown memory, and return effects.

A network of cartridges introduces a different problem. Independent local holders cannot rely on one atomic database transaction, one global clock, one online coordinator, or exactly-once delivery. A file may be copied twice. One participant may commit while another is unavailable. A return may arrive after either run has advanced. Two valid operations may fork from the same parent state.

The protocol must represent these facts rather than calling them impossible or pretending a distributed action was atomic.

## New format

The post-v1 candidate is:

```text
axm-connected-operation/v2
```

Version 1 remains valid and immutable. Version 2 is an additive protocol event and requires explicit migration or dual-reader support. No v1 fixture is relabeled as v2.

## Delivery model

The transport contract is:

```text
at-least-once delivery
+ content-derived operation identity
+ idempotent application
+ causal-parent validation
```

Exactly-once delivery is not claimed. Exactly-once **effect** is achieved locally by refusing to apply the same committed operation identity twice.

## Identity

A prepared operation has a canonical identity derived from:

- format and protocol version;
- source and destination cartridge digests;
- source and destination parent run integrity digests;
- participant identifiers;
- selected people, resources, evidence, environmental loads, authority, and obligations;
- intended state effects;
- causal parents;
- preparation policy identifiers and versions;
- unknown namespaced memory included in the operation.

Transport metadata, signatures, local filenames, receipt locations, and timestamps outside authored causal facts do not change the operation identity.

A later phase refers to the prepared operation identity and carries its own phase receipt digest.

## Parent state

Every participant names the exact run integrity digest it consumed:

```text
sourceParentRunDigest
destinationParentRunDigest
```

A receiving client checks the current run before the first write.

- Exact parent match permits preparation or application.
- A previously applied operation identity is an idempotent no-op with the existing receipt returned.
- A different current parent is `causally-stale-parent` and is refused.
- A missing participant run is `participant-unavailable`, not implicit permission to create one.

A migration can explicitly authorize a parent transformation. Normal import cannot.

## Phases

### Prepared

The source records the operation proposal, authority, intended transfers, expected effects, dependencies, risks, and parent state. Nothing is claimed to have changed in either participant.

### Accepted

The destination validates its exact parent, source authority, feasibility, limits, and intended consequences. Acceptance is a receipt of willingness, not a state mutation.

### Committed

Each participant records its own application receipt:

```text
sourceCommit
destinationCommit
```

A participant receipt contains exact pre-state, exact applied effects, exact post-state, and the operation identity. The aggregate operation state may therefore be:

- neither committed;
- source-only committed;
- destination-only committed;
- both committed.

Only the final state is complete commitment. Partial commitment remains visible.

### Returned

A return is a new causal phase over the committed operation. It names the exact committed participant states it consumed and preserves both sovereign state sets, return effects, evidence, people, obligations, dissent, uncertainty, and unknown memory.

### Compensated

Compensation is a new consequence-bearing operation. It does not erase the original commit. It records which effects can be reversed, which costs remain, who authorized the compensation, and what new state and obligations result.

### Aborted

An uncommitted prepared or accepted operation can be aborted with a receipt. A committed operation cannot be converted to aborted.

## Failure states

The protocol uses explicit refusal and partial-failure states:

```text
replayed-operation
causally-stale-parent
participant-unavailable
participant-refusal
partial-commit
return-unavailable
compensation-refused
unknown-version
invalid-phase-transition
integrity-mismatch
```

A receiver may explain one of these states. It may not repair parent identity, invent authority, drop an already committed participant receipt, or manufacture a successful return.

## Causal graph

Every operation can name zero or more causal parents. Canonical ordering is by operation identity. The graph is acyclic under validation.

Two operations prepared from the same participant parent form a fork. The runtime does not select a winner by arrival time. A later reconciliation operation must name both fork heads, the venue and authority capable of reconciling them, accepted and refused facts, resulting participant state, and unresolved obligations.

## Offline transport

A complete portable connected-operation object contains:

- the prepared operation;
- every phase receipt available to the holder;
- participant cartridge identity and source-plane metadata;
- parent and resulting run integrity digests;
- unknown namespaced memory;
- signatures or attestations as external custody metadata;
- a canonical phase summary derived from receipts.

The file may travel by any medium. Repeated import is safe. Import never implies commit.

## Interaction with the decision kernel

When the post-v1 decision kernel exists, preparation and acceptance can use its versioned feasibility, authority, expectation, observation, reconciliation, and receipt law. Connected-operation causality remains a protocol around participant state. It is not absorbed into presentation or game policy.

The kernel may determine that an option is feasible. It does not pretend that two independent local stores committed atomically.

## Conformance vectors

The v2 program must include:

1. clean prepare, accept, two-party commit, and return;
2. repeated delivery before and after commit;
3. stale source parent refusal;
4. stale destination parent refusal;
5. source-only partial commit and later destination completion;
6. destination-only partial commit and explicit recovery;
7. compensation with irreversible residual cost;
8. duplicate compensation refusal;
9. two-operation fork and explicit reconciliation;
10. unknown phase and version refusal;
11. unknown namespaced memory preservation;
12. exact replay after export and fresh-context import.

Arc and World must produce the same canonical operation identities and phase facts for the same inputs.

## Activation boundary

This document stages v2 after RODOH v1.0.0. The release continues to ship and replay `axm-connected-operation/v1`. No v2 format string, runtime branch, source-plane requirement, or cartridge expectation enters the v1 critical path.
