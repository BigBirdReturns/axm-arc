# Gate 8 candidate: Inhabited Continuity

**Status:** additive substrate candidate. It does not reopen or redefine the current Arc cycle, RODOH 1.0, or Gate 7.

**Builder coordinate:** L01 candidate branch based on GitHub `axm-arc/main` while W01's newer local-only head is unavailable to Remote Commander. Promotion requires rebasing or cherry-picking onto the exact W01 Arc head and repeating the complete verification lane.

## Purpose

Gate 8 asks a different question from the local-first cartridge proof:

> Can the holder leave, can an inference seat die or be replaced, and can the same world continue from the same committed facts without letting a model become state authority?

The model is a proposal supplier. Arc-compatible law remains the adjudicator. World remains a representation. Estate owns process, recovery, and machine custody.

## Non-goals

- No wall-clock mutation inside the existing game engine.
- No LLM-authored direct writes to Organization, run, ledger, or cartridge law.
- No mandatory model dependency during replay or ordinary rendering.
- No new cartridge trust class.
- No hidden autonomous action that bypasses an authored affordance.
- No claim that the current reference games must become continuous simulations.

## Versioned records

The candidate introduces six bounded records outside `src/engine/schema.ts`:

```text
axm-world-clock/v1
axm-actor-observation/v1
axm-action-proposal/v1
axm-world-event/v1
axm-world-snapshot/v1
axm-continuity-state/v1
```

Portable custody uses the existing namespaced run seam:

```text
axm.continuity@1
```

No Arc schema field is required for the substrate proof. A compatible runtime may carry the continuity state in `axm-cartridge-run/v3.extensions`; unknown runtimes already preserve that JSON without interpreting it.

The snapshot binds the exact cartridge digest, portable-run digest, state digest, world tick, state revision, and event-chain head. It does not duplicate the Arc or engine save.

The clock is a logical clock. Wall time may tell an Estate scheduler when to request a tick, but wall time never decides the transition. Replaying the same recorded proposals against the same starting state does not need the original wall clock.

## Actor boundary

A seat receives one `axm-actor-observation/v1` object. The observation contains only the facts the host deliberately exposes to that actor plus a finite list of concrete affordances.

Every observation is bound to:

- exact cartridge digest;
- exact run digest;
- exact state revision;
- exact logical tick;
- actor identity;
- visible JSON;
- concrete affordances;
- an `obs1_` digest over all of the above.

A proposal repeats that binding and adds an action, exact offered arguments, optional utterance, and seat provenance. The `prop1_` digest makes model output a retained input artifact rather than ambient authority.

A well-formed proposal is refused before the host reducer if its cartridge, run, revision, tick, actor, observation, action, or concrete arguments do not match the current observation. A malformed or digest-tampered proposal is rejected rather than entered into the lawful event ledger.

## Adjudication

The continuity layer owns transaction binding, not domain rules. A host provides three functions:

```text
observe(snapshot, actor)
preflight(snapshot, proposal)
apply(snapshot, proposal)
```

`observe` exposes scoped facts and affordances. `preflight` applies the real domain permissions and costs. `apply` is the only transition point and returns the resulting run digest, state digest, and JSON effect receipt.

Accepted events increment the state revision exactly once. Refused events leave the run digest, state digest, and revision unchanged but still advance the content-bound event chain, preserving evidence that an attempted action was refused.

Every event binds the previous event id, proposal digest, actor, action, tick, before-and-after revision, before-and-after run and state digests, status, reason, and effects. `assertContinuityState` recomputes every event id and verifies the full chain.

The host must never interpret a model utterance as a state patch. If dialogue becomes consequential, the cartridge or source plane must expose a real authored action whose reducer accepts the structured proposal.

## Candidate proof already exercised

The focused suite executes the substrate rather than checking source text. It proves:

- exact observation and proposal binding before state mutation;
- refusal of unobserved actions and unobserved arguments before host apply;
- refusal of stale ticks and revisions;
- hard rejection of proposal-digest tampering;
- no committed change when a model seat throws before producing a proposal;
- event-chain tamper detection;
- lossless carriage through the existing portable-run extension normalizer;
- a 10,000-tick bounded schedule with one verified event chain;
- model-seat replacement after a checkpoint without changing earlier event ids;
- byte-equivalent checkpoint restart of the replacement-model continuation.

The 10,000-tick test uses deterministic fixture policies. It does not claim that an LLM is deterministic. Model output is a retained proposal input; replay consumes that proposal rather than asking the model to recreate it.

## Next native proof

The first real host adapter belongs to The Lamp District because its source already exposes civic state, visibility, named actors, layered geography, constituencies, movements, and inherited consequences.

That adapter must begin with deterministic policies and ordinary source-owned actions. A local model may then occupy one actor seat through the exact same proposal boundary. Replacing Qwen with another model may change later proposals, but it must not rewrite the preceding event chain or require opaque model memory to recover the world.

A later long-haul Gate 8 acceptance should additionally prove:

1. export and restore through an actual changed portable run;
2. machine/process restart while preserving the same event head;
3. model server death after observation and before proposal;
4. model server death after proposal but before apply;
5. stale proposal replay after another actor commits first;
6. actor knowledge isolation and explicit information transfer;
7. deterministic policy baseline versus one or more replaceable model seats;
8. bounded inference, token, memory, and wall-clock scheduler budgets;
9. World rendering the same committed facts without a second resolver;
10. recovery from the exact retained proposal/event ledger without contacting the originating model.

## Promotion boundary

This branch is intentionally easy to transplant. It adds `src/continuity`, `tests/continuity`, and this document; it does not edit `src/engine/schema.ts`, existing cartridges, the current cycle, or the player UI.

W01's canonical Arc head is newer and locally unique. Do not promote this candidate merely because its branch is green on L01. First apply the additive commit to the exact W01 head, inspect any intervening continuity work, rerun typecheck and the complete Arc suite, and only then begin the Lamp District host adapter.
