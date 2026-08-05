# ASOIAF persistent answer desk worker

The persistent answer desk worker is the typed execution boundary above the qualified answer-work lease and append-only desk estate. It converts the current deterministic desk projection into explicit assignments, claims only work covered by a registered automatic capability, retains an immutable invocation before execution, retains an immutable result after execution, and settles the exact lease through the persistent estate. It does not treat a process exit code, console message, or generic success response as evidence that the underlying work advanced.

The first registered worker is deliberately narrow. `asoiaf-answer-worker:reviewed-renderer-v1` may execute only `render-reviewed-answer`. The reviewed packet has already passed the permanent answer validator and already contains the exact claims, citations, limitations, rendered-text digest, and rendered character count. The worker may reproduce that reviewed text deterministically. It has no network access, private-text access, human-review authority, acquisition authority, reconciliation authority, graph effect, or canon effect.

## Capability registry

Every answer-work action receives one typed capability classification:

```text
acquire-public-record          external-required  network-collector
search-private-edition         external-required  holder-controlled-search
resolve-edition                external-required  edition-reviewer
review-structured-observation  external-required  structured-observation-reviewer
review-exact-locator           external-required  exact-locator-reviewer
inspect-disposition            external-required  disposition-reviewer
reconcile-candidate            external-required  canon-reconciler
split-continuity               external-required  continuity-reviewer
close-gap                      external-required  answer-assembler
assemble-reviewed-answer       external-required  answer-assembler
verify-reviewed-answer         external-required  answer-verifier
render-reviewed-answer         automatic          reviewed-renderer
```

The registry also declares whether an action requires network access, private text, or human review, and which result kinds may satisfy it. The built-in worker has exactly one automatic action. It will not claim acquisition, private search, edition resolution, observation review, locator review, disposition inspection, reconciliation, continuity adjudication, gap closure, answer assembly, or answer verification.

An external assignment is operational output, not a simulated refusal. It identifies the exact work-order head, desk-state head, item, stable action-and-subject key, dependencies, required actor, access requirements, and expected result kinds. A separate actor may later use that assignment to perform the work under its own qualified protocol. The renderer does not acquire that actor’s authority merely because the assignment exists.

## Deterministic assignment plan

The planner first verifies the complete persistent desk estate. It then reads the latest qualified work order, current deterministic desk state, all leases, and all settlements. Each work item becomes a content-addressed assignment with one desk status:

```text
available
active-lease
expired-lease
stale-lease
settled
unavailable
open
satisfied
preserved-as-limitation
blocked
```

An assignment is eligible for automatic execution only when the desk exposes the item as available and the capability registry marks its action automatic. The plan retains separate `automaticAvailableItemIds` and `externalAvailableItemIds` arrays. `nextAutomaticItemId` never points at an external assignment.

The plan has no execution, graph, canon, or answer authority. It is a deterministic projection of existing custody. Recompiling it from the same estate produces the same content-derived identity and fingerprint.

## Invocation custody

The operator claims the exact render item through the persistent desk. The lease must bind:

```text
workerId = asoiaf-answer-worker:reviewed-renderer-v1
action = render-reviewed-answer
one exact work-order identity and fingerprint
one exact item identity, fingerprint, and stable key
one exact reviewed-answer packet identity in the item subjects
claim and expiry times
```

The worker then builds and retains a content-addressed invocation under:

```text
answer-worker/invocations/<sha256>.json
```

The invocation binds the worker manifest fingerprint, lease, work order, item, action, request time, and output locations. The request time must occur within the active lease. The invocation retains `networkAccess=none`, `privateTextAccess=none`, `humanReviewAuthority=none`, `authority=none`, `graphEffect=none`, `canonEffect=none`, and `answerEffect=none`.

Invocation files are immutable. An exact retry reuses the existing bytes. A different object at the same content-addressed location is an integrity failure.

## Deterministic rendering and result custody

Execution validates the invocation, lease, work order, and reviewed answer packet again. It calls the permanent reviewed-packet renderer and checks both the output digest and character count against packet custody before retaining any result.

The rendered text is stored at:

```text
answer-worker/outputs/<rendered-text-sha256>.txt
```

The result object is stored at:

```text
answer-worker/results/<result-sha256>.json
```

The result binds the invocation, lease, work order, item, worker, start and completion times, exact output reference, rendered character count, and settlement outcome. The result itself retains no review, acquisition, reconciliation, graph, canon, or answer authority. Its role is to prove what the bounded worker emitted under which exact lease.

The persistent settlement retains two exact references:

```text
answer-worker-result   the complete typed worker result object
reviewed-answer-render the emitted reviewed text and its packet-bound digest
```

The lease settles as `rendered` without changing the work-order head. The rendered-terminal lease protocol then removes the stable render item from availability and refuses another render claim.

## Exact replay

A complete retry with the same item, worker, claim time, lease duration, request time, completion time, result references, and reason returns the existing lease, invocation, output, result, and settlement. It does not append duplicate ledger rows or create parallel worker files.

Replay is byte-exact. If a retained output, invocation, or result file has changed, the immutable write refuses to overwrite it. The verifier independently reports the stale digest or custody mismatch.

## Worker-estate verification

The worker verifier begins with the complete persistent desk verifier, then reconstructs the worker plane. It checks:

```text
worker manifest identity, capability registry, authority, and fingerprint
current deterministic assignment plan
portable invocation, result, and output filenames
one invocation per built-in worker lease
invocation-to-lease and invocation-to-work-order custody
one result per invocation
result-to-invocation, result-to-lease, and result-to-work-order custody
reviewed packet output digest and character count
result-to-rendered-settlement references
built-in renderer settlements with retained results
pending invocations
unreferenced output files
```

A retained invocation without a result is a warning because a process may have stopped after invocation custody and before result custody. A rendered settlement from the built-in worker without its typed result is an error. A changed output digest, unsafe path, duplicate invocation, duplicate result, or missing settlement reference is an error.

## Operator transactions

The local command-line operator exposes:

```bash
npm run asoiaf:answer-worker -- manifest

npm run asoiaf:answer-worker -- plan \
  --root .asoiaf-answer-desk \
  --out worker-plan.json

npm run asoiaf:answer-worker -- run \
  --input worker-run-input.json \
  --out worker-run-result.json

npm run asoiaf:answer-worker -- status \
  --root .asoiaf-answer-desk \
  --out worker-status.json

npm run asoiaf:answer-worker -- verify \
  --root .asoiaf-answer-desk \
  --out worker-verification.json

npm run asoiaf:answer-worker -- paths \
  --root .asoiaf-answer-desk
```

A run input supplies the estate root, optional exact item identity, worker identity, claim time, optional request time, completion time, lease duration, and operator identity. If no item is supplied, the operator selects `nextAutomaticItemId`. When the desk contains only external work, the operator identifies the required external actor and refuses to claim an item.

## Qualification boundary

Synthetic qualification adopts one answer-ready work order from the reusable holder-controlled AGOT fixture. The exact work order contains a validated bounded-complete reviewed answer packet and one open `render-reviewed-answer` item. No source prose is read or retained by the worker.

The focused suite proves:

```text
one deterministic render-only worker manifest
explicit external actor classification for every other action
no automatic claim from an open external-work desk
exact render-item selection from an answer-ready desk
content-addressed invocation, output, and result custody
reviewed packet digest and character parity
rendered settlement with worker-result and output references
terminal render suppression in desk state
exact lease, invocation, output, result, and settlement replay
output tamper detection and immutable collision refusal
unknown-worker refusal
out-of-lease invocation refusal
complete desk-and-worker reconstruction
```

The permanent workflow exercises the same lifecycle through the command-line operators. It adopts the exact ready head, compiles and verifies the worker plan, executes one automatic render, replays the same run, verifies the desk and worker planes, inspects the retained output bytes, and asserts one lease, one settlement, one invocation, one result, no available item, and no next automatic item. Strict TypeScript, the focused worker, estate, lease, work-order, reviewed-answer, dossier, and reconciliation suites, the complete Arc regression, and the production build must pass on the exact final head.

The evidence tier is typed worker implementation, synthetic immutable result custody, and exact-head command-line qualification. The venue is the persistent holder-controlled answer desk. The target is deterministic execution of work already authorized by a validated reviewed packet, plus explicit routing of every other action to its required external actor. The upside is that the system can now perform one real unattended transaction while retaining exact invocation, output, result, and settlement receipts. The downside is intentionally narrow automatic coverage and immutable worker-file growth. The failure mode is allowing a generic worker response, unauthorized access, changed output bytes, absent typed result, or external-only action to stand in for a lawful settlement.

The control question is whether every automatic execution can prove which exact desk head, item, lease, worker manifest, invocation, output, result, and settlement produced it, while every non-automatic action remains attached to a named external actor whose authority the built-in worker never acquires.
