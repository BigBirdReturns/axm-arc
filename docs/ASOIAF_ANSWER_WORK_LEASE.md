# ASOIAF answer work lease

The answer work lease is the durable attempt-custody plane above the qualified ASOIAF answer work order. It does not perform the leased research, review, reconciliation, closure, assembly, verification, or rendering transaction. It allows one unattended worker to claim one exact open item for a bounded period, prevents concurrent claims and terminal replay, and records what happened without permitting a worker receipt to satisfy the underlying work.

The work order remains the authoritative lifecycle projection. A lease can identify which transaction a worker may attempt. A settlement can identify what result was produced. Except for deterministic rendering, advancement is recognized only when a refreshed qualified work order for the same dossier and question proves that the same stable action-and-subject key became `satisfied` or `preserved-as-limitation`.

## Lease format

A lease uses:

```text
axm-asoiaf-answer-work-lease/1
```

It binds:

```text
exact work-order identity and fingerprint
dossier and question identities
exact item identity and fingerprint
stable action-and-subject item key
action and lifecycle stage
subject and dependency identities
worker identity
claim and expiry times
bounded lease duration
content-derived lease identity and fingerprint
authority = none
graphEffect = none
canonEffect = none
answerEffect = none
```

Only an item whose exact work-order status is `open` may be leased. A lease duration must be an integer from one second through twenty-four hours. The same claim input is deterministic. Another worker cannot claim the same item key while an unsettled lease remains active. An expired lease releases the item for another claim. A successful or rendered terminal settlement prevents replay against the same work-order head.

A lease does not imply that its dependencies are satisfied. The work order already determines whether the action is open and records its dependencies. The worker must preserve those dependency identities in any external transaction and result receipt.

## Settlement format

A settlement uses:

```text
axm-asoiaf-answer-work-settlement/1
```

Settlement outcomes are:

```text
satisfied
preserved-as-limitation
rendered
refused
failed
cancelled
expired
stale
```

Every settlement binds the lease, before-work-order identity and fingerprint, stable item key, action, worker, start and completion times, result references, reason, content fingerprint, and content-derived settlement identity. Result references carry a kind, object identity, supported SHA-256 or FNV-1a fingerprint, and optional URI.

### Advancement

`satisfied` and `preserved-as-limitation` require a refreshed answer work order. The new order must:

```text
pass the permanent work-order validator
retain the same dossier and question
have a different content-derived work-order identity
not predate the prior work-order projection
contain the same action-and-subject item key
show the exact expected item status
```

The settlement must also bind at least one exact result object. Typical results include a reviewed acquisition receipt, admission disposition, reviewed reconciliation transaction, reviewed answer packet, or gap-closure-bearing answer packet. The settlement receipt cannot manufacture the new status. The refreshed work order proves it from the authoritative upstream objects.

### Rendering

`rendered` is permitted only for an open `render-reviewed-answer` item on an answer-ready work order. It requires at least one exact rendered-output reference. It does not require a refreshed work order because deterministic rendering does not alter dossier, reconciliation, answer-packet, graph, or canon custody. The rendered artifact remains bound to the reviewed answer packet through its own digest and receipt.

### Honest non-advancing terminals

`refused`, `failed`, and `cancelled` require a substantive reason and cannot name a refreshed work order or resulting status. `expired` is accepted only at or after the exact lease expiry. `stale` requires a newer work order for the same dossier and question, proving that the worker’s original exact head was superseded. None of these outcomes satisfies the item.

A lease may receive only one settlement. A second settlement is terminal replay and is refused.

## Desk-state projection

The desk state uses:

```text
axm-asoiaf-answer-desk-state/1
```

It is a disposable deterministic projection over one current qualified work order, its known leases, its known settlements, and an `asOf` time. It distinguishes:

```text
active leases
expired leases
stale leases
settled leases
all open work
currently available work
blocked work
next available item
answer readiness
bounded completeness
```

An unsettled lease from another work-order identity is stale even when it belongs to the same dossier and question. A lease does not move to a new head merely because the action and subjects still resemble the new work. The worker must obtain a new lease against the new exact work order.

The state projection does not execute a settlement, retry an item, select a worker, or mark work complete. It reports availability and custody only. All state, lease, and settlement objects retain `authority=none`, `graphEffect=none`, `canonEffect=none`, and `answerEffect=none`.

## Operator transactions

The read-only operator exposes:

```bash
npm run asoiaf:answer-work-lease -- claim \
  --input lease-claim-input.json \
  --out lease.json

npm run asoiaf:answer-work-lease -- settle \
  --input lease-settlement-input.json \
  --out settlement.json

npm run asoiaf:answer-work-lease -- state \
  --input desk-state-input.json \
  --out desk-state.json

npm run asoiaf:answer-work-lease -- verify-lease \
  --lease lease.json \
  --work-order before-work-order.json

npm run asoiaf:answer-work-lease -- verify-settlement \
  --settlement settlement.json \
  --lease lease.json \
  --before before-work-order.json \
  --after after-work-order.json

npm run asoiaf:answer-work-lease -- verify-state \
  --state desk-state.json \
  --input desk-state-input.json
```

The operator performs no network request, opens no private source, executes no underlying task, and mutates no graph or canon state. It emits local JSON custody objects only.

## Qualification boundary

Synthetic qualification builds one exact holder-controlled AGOT dossier, an open answer work order, a passed primary reconciliation transaction, a reconciled work order, a bounded reviewed answer packet, and an answer-ready work order. No source prose is retained or read.

The focused suite proves:

```text
deterministic exact-item leasing
active concurrent-lease refusal
expiry and item release
refreshed-work-order proof of exact satisfaction
content-addressed gap-closure settlement
render-only completion without false work-order advancement
failed, expired, and stale non-advancing terminals
terminal replay refusal
active, expired, stale, settled, available, and blocked desk projection
lease, settlement, and desk-state tamper detection
```

The permanent workflow also exercises the command-line operator from JSON. It compiles open, reconciled, and answer-ready work orders from one immutable dossier; claims and verifies an exact private-review lease; proves that a concurrent claim fails; compiles active desk state; settles the review only after the reconciled work order proves satisfaction; claims and settles deterministic rendering; and verifies every emitted object. Strict TypeScript, the focused lease and lifecycle suites, the complete Arc regression suite, and the production build must pass on the exact final head.

The evidence tier is lease, settlement, and desk-state mechanism qualification over synthetic immutable custody. The venue is the stacked answer-work control plane. The target is duplicate-execution prevention, exact-head custody, honest terminals, and resumable unattended operation rather than ASOIAF truth or automatic execution. The upside is a content-addressed attempt ledger that cannot satisfy work by assertion. The downside is explicit expiry, result-reference preparation, and refreshed-work-order reconciliation. The failure mode is allowing a generic success message, stale lease, duplicate worker, or unverified worker receipt to stand in for a new qualified upstream projection.

The control question is whether every unattended attempt can disclose which exact item and work-order head it claimed, who held the lease, when the lease expired, which result object was produced, which refreshed qualified work order proved advancement, and why neither the lease nor the settlement acquired the authority of the underlying transaction.