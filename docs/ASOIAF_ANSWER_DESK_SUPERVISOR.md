# ASOIAF persistent answer desk supervisor

The persistent answer desk supervisor is the deterministic scheduling layer above the qualified desk, automatic renderer, and external exchange. It decides which already-defined work item may be claimed next, binds external work to an actor with available capacity, runs the one registered automatic worker when eligible, and records a write-ahead intent and completed run for every scheduling transaction. It does not perform source acquisition, private search, human review, reconciliation, answer assembly, or evidence promotion.

The supervisor exists because a qualified function is not yet an unattended system. The desk can identify available work, the renderer can execute one bounded automatic action, and the exchange can issue or admit one external transaction. Without a scheduling actor, callers still have to choose an item, choose an actor, decide when to claim it, and reconstruct what happened after interruption. The supervisor converts those choices into deterministic, content-addressed custody while leaving the underlying task authority where it already belongs.

## Scheduling policy

One supervisor policy binds:

```text
policy creator and creation time
bounded automatic-renderer enablement and lease duration
zero or more external actor bindings
actor role and identity
actor-role capacity
actor-role priority
external lease duration
dependency-ready work-order-first selection law
claim-only-on-dispatch lease law
local content-addressed file transport
```

External bindings may cover the network collector, holder-controlled search, edition reviewer, structured-observation reviewer, exact-locator reviewer, disposition reviewer, canon reconciler, continuity reviewer, answer assembler, or answer verifier. `reviewed-renderer` cannot appear as an external binding. It remains the exact built-in worker registered by the worker plane.

Bindings are sorted by actor role, priority, actor identity, and content identity. The same actor identity and role may appear only once. Capacity is bounded from one through thirty-two active assignments. Lease durations are bounded from one second through twenty-four hours. A binding declares scheduling capacity and transport eligibility. It does not grant network access, private-text access, human-review authority, acquisition authority, reconciliation authority, graph authority, canon authority, or answer authority.

## JIT projection

A supervisor projection begins by verifying the complete external exchange estate, which recursively verifies the worker and persistent desk planes. It then reads the current deterministic worker plan and all active external assignments. For every binding it computes the exact active assignment identities, active count, capacity, and available slots.

Selection follows the work-order assignment order after dependency readiness. The supervisor scans current `available` assignments, skips any item whose named dependencies are not `satisfied` or `preserved-as-limitation`, and applies the following rules:

```text
available + unmet named dependency           -> dependency-blocked and skipped
automatic and eligible + automatic enabled  -> run-automatic
external + matching enabled actor slot       -> issue-external
external + no enabled role binding           -> unbound-external
external + every matching binding at capacity -> saturated-external
automatic + automatic disabled               -> automatic-disabled
no dispatchable item + active external work  -> wait-external
no dispatchable item + no active work        -> idle
```

The scan may skip an earlier dependency-blocked, unbound, or saturated assignment and dispatch a later independent assignment with a valid actor slot. This permits bounded fanout without allowing capacity pressure in one role to serialize unrelated work. The supervisor never creates a lease during planning. A lease is created only when the selected assignment is actually dispatched or the automatic worker is actually invoked.

The projection retains the exact policy, worker plan, active assignment references, actor loads, dependency-blocked and access-or-capacity-blocked item classes, selected decision, and a content-derived identity. It has no execution or answer effect.

## Write-ahead intent

Every scheduling request carries an explicit request key, policy, request time, optional automatic completion time, and operator identity. The request key is the idempotency boundary. Reusing the same key with different policy or time custody is refused.

Before a side effect, the supervisor retains an immutable intent at:

```text
answer-supervisor/intents/<sha256>.json
```

The intent binds:

```text
estate identity
request key and request fingerprint
exact policy and policy fingerprint
complete before-projection snapshot
work-order identity and fingerprint
state identity and fingerprint
selected decision
request and automatic completion times
operator identity
```

Preparing an intent does not claim work. This is the write-ahead boundary. A process may stop after intent retention and before dispatch without losing which exact item, actor, lease duration, and desk head were selected.

## One deterministic tick

A tick prepares or reuses the exact intent, executes one decision, rebuilds the after-projection, and retains one run at:

```text
answer-supervisor/runs/<sha256>.json
```

For `issue-external`, the supervisor calls the qualified exchange with the exact item, actor identity and role, request time, and actor-binding lease duration. The resulting run binds one content-addressed `answer-exchange-assignment` reference and the exact lease identity. It does not settle the item.

For `run-automatic`, the supervisor calls the qualified reviewed renderer with the exact item, request time, completion time, and automatic lease duration. The resulting run binds the invocation, worker result, rendered output, and rendered settlement. The automatic completion time must fall within the lease.

For `wait-external`, `unbound-external`, `saturated-external`, `automatic-disabled`, and `idle`, the supervisor records a no-operation run only while the current plan still equals the intent’s before plan. A no-operation intent that became stale before completion is refused rather than preserved as a statement about a different desk head.

## Crash recovery and exact replay

The write-ahead intent and underlying actor protocols form a recoverable transaction:

```text
intent retained, operation absent
  -> exact tick executes the intended operation

intent retained, assignment already issued
  -> exchange replays the exact lease and assignment

intent retained, automatic operation already completed
  -> worker replays the exact lease, invocation, output, result, and settlement

run retained
  -> exact tick returns the retained run without reopening operation creation
```

A completed supervisor run is not evidence that the external actor performed its underlying task. It is evidence that the scheduler issued the exact assignment or invoked the exact bounded automatic worker. External advancement still requires a typed exchange result and permanent settlement validation.

## Capacity and fanout

Capacity is scoped to one actor identity and role. An actor bound as an exact-locator reviewer and as an answer assembler has independent declared slots because those roles carry different access and review requirements. A future resource scheduler may add a cross-role machine or human capacity contract, but this supervisor does not infer one.

Repeated ticks with distinct request keys may issue independent available assignments until their role-specific actor slots are full. Once every matching slot is full, the projection reports `saturated-external` without creating another lease. When no other work is dispatchable and external leases remain active, the projection reports `wait-external`.

This is JIT scheduling rather than queue reservation. The supervisor does not claim a backlog and then wait for an actor to become free. It claims only when it can produce the exact assignment bundle immediately.

## Run custody

A run retains:

```text
intent identity and fingerprint
request identity
before and after projection fingerprints
complete after-projection snapshot
before and after work-order identities
before and after state fingerprints
selected item and action
actor identity and role
lease and settlement identities when applicable
operation references
operation replay status
start and completion times
```

Operation references are checked against the authoritative underlying estates. External assignment references must match a retained exchange assignment. Automatic invocation and result references must match worker files. Render references must match the worker result. Settlement references must match the append-only desk settlement ledger. Referenced file URIs must remain inside the estate and exist.

The supervisor run retains `authority=none`, `graphEffect=none`, `canonEffect=none`, and `answerEffect=none`. The run records scheduling custody. It does not acquire the authority of the actor it scheduled.

## Verification

The supervisor verifier begins with complete exchange, worker, and desk verification, then reconstructs:

```text
policy and binding identity, ordering, capacity, lease, and authority
embedded worker-plan and assignment content identities
projection actor loads and deterministic decision
one immutable intent per request key
one run per intent
pending intents
run-to-intent custody
side-effecting versus no-operation boundaries
external assignment references
worker invocation, result, render, and settlement references
portable digest-named intent and run files
```

A retained intent without a run is a warning because it may be resumed with the same request. A run without an intent is an error. A missing or changed underlying assignment, invocation, result, output, or settlement is an error. A duplicate request key, duplicate intent, duplicate run, changed fingerprint, unsafe URI, or non-digest filename is an error.

## Operator transactions

The command-line operator is registered as `npm run asoiaf:answer-supervisor -- ...` and exposes:

```bash
npm run asoiaf:answer-supervisor -- policy \
  --input supervisor-policy-input.json \
  --out supervisor-policy.json

npm run asoiaf:answer-supervisor -- plan \
  --input supervisor-tick-input.json \
  --out supervisor-plan.json

npm run asoiaf:answer-supervisor -- prepare \
  --input supervisor-tick-input.json \
  --out supervisor-intent.json

npm run asoiaf:answer-supervisor -- tick \
  --input supervisor-tick-input.json \
  --out supervisor-run.json

npm run asoiaf:answer-supervisor -- status \
  --root .asoiaf-answer-desk \
  --policy supervisor-policy.json \
  --out supervisor-status.json

npm run asoiaf:answer-supervisor -- verify \
  --root .asoiaf-answer-desk \
  --out supervisor-verification.json

npm run asoiaf:answer-supervisor -- paths \
  --root .asoiaf-answer-desk
```

The operator performs no network request and opens no private source. It schedules only the already-qualified worker and exchange transactions.

## Qualification boundary

Synthetic qualification uses the reusable holder-controlled AGOT desk fixture and one deterministic supervisor policy. The policy binds an exact-locator reviewer, an answer assembler, and the built-in renderer.

The focused suite proves:

```text
deterministic policy and actor-binding identities
bounded capacity and lease validation
planning without claim creation
write-ahead intent retention
exact request-key replay
request-key retarget refusal
external issue through JIT claim
crash recovery after assignment issue and before run receipt
unbound work without manufactured lease
parallel independent external fanout
actor saturation without over-claiming
automatic render invocation and replay
review-to-gap-closure-to-render rotation
complete desk, worker, exchange, and supervisor reconstruction
intent and run tamper detection
```

The permanent workflow exercises the full rotation through command-line operators. It adopts one open work order, plans and ticks exact-locator review, replays that tick, admits the reviewed transaction, ticks gap closure, admits the reviewed packet, ticks the automatic renderer, replays the render tick, and verifies every plane. The final estate must contain three work orders, three leases, three settlements, two external assignments, two external results, one automatic invocation, one automatic result, one rendered output, three supervisor intents, and three supervisor runs. No item may remain available, no supervisor intent may remain pending, no transaction lock may remain, and every retained path must be portable and content addressed.

The evidence tier is deterministic scheduling, write-ahead intent, and exact operation-reference qualification over synthetic immutable answer-work custody. The venue is the persistent holder-controlled answer desk above the qualified worker and exchange planes. The target is JIT claim timing, actor-role capacity, independent fanout, crash recovery, exact replay, and restart reconstruction rather than the truth of an ASOIAF answer or the authority of an external actor. The upside is that unattended operation can choose and execute the next lawful transaction without queueing leases in front of unavailable actors. The downside is explicit actor policy, request-key management, role-scoped capacity, and immutable intent and run growth. The failure mode is allowing a scheduler to retarget an intent, claim work before capacity exists, overbook an actor, reopen completed operation creation, or let a scheduling receipt stand in for the actor’s result.

The control question is whether every scheduling turn can disclose which exact desk head, work item, actor slot, request key, write-ahead intent, lease, assignment or automatic invocation, after-state, and completed run produced it, while the supervisor remains structurally incapable of performing or authorizing the underlying research, review, reconciliation, or answer task.
