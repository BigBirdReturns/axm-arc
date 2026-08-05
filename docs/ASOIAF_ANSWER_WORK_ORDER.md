# ASOIAF answer work order

The answer work order is the unattended control plane above the qualified ASOIAF question dossier, reviewed reconciliation transactions, and reviewed answer packet. It does not acquire sources, search private editions, normalize structured responses, admit observations, review rights, reconcile candidates, assemble answer text, verify an answer on behalf of its validator, or render prose. It reads the current immutable custody objects and compiles one deterministic dependency-bound statement of what remains open, what has been satisfied, what has been preserved as a limitation, what is blocked, and whether an already reviewed answer packet is renderable.

The research dossier is an orientation record. It binds the bounded question, continuity scope, source routing, exact private retrieval references, structured-observation dispositions, recall candidates, explicit gaps, and projected next actions. The reviewed reconciliation transaction is an adjudication record. It binds exact primary evidence, locators, promoted records, candidate resolutions, and the canon compiler receipt. The reviewed answer packet is an assembly record. It binds reviewed answer text, exact citations, gap closures, limitations, answer-review custody, and deterministic rendering. The work-order actor combines these records without acquiring any of their authority.

## Formats

One work item uses:

```text
axm-asoiaf-answer-work-item/1
```

The complete order uses:

```text
axm-asoiaf-answer-work-order/1
```

Every item fixes:

```text
content-derived item identity
content fingerprint
action
lifecycle stage
status
bounded-complete requirement
exact subject identities
dependency item identities
human-readable reason
authority = none
graphEffect = none
canonEffect = none
answerEffect = none
```

The work order fixes the exact dossier and fingerprint, question identity and digest, creator and creation time, supplied reviewed transactions, optional reviewed answer packet, resolved and unresolved candidate identities, reviewed and unreviewed private references, closed, limited, and open gap identities, limited and open structured-disposition references, deterministic items, status counts, lifecycle status, readiness flags, fingerprint, and content-derived identity.

## Actions and stages

Research-stage actions are:

```text
acquire-public-record
search-private-edition
resolve-edition
inspect-disposition
split-continuity
```

Review-stage actions are:

```text
review-structured-observation
review-exact-locator
```

Reconciliation-stage work is:

```text
reconcile-candidate
```

Assembly-stage work is:

```text
close-gap
assemble-reviewed-answer
```

Verification and rendering are:

```text
verify-reviewed-answer
render-reviewed-answer
```

The planner does not blindly copy the dossier’s aggregate `nextActions` list. The dossier already carries exact private references, recall references, structured dispositions, and gaps. The planner derives identity-bound work from those objects. Re-emitting the aggregate next-action projection would create duplicate unscoped tasks that remain open even after the corresponding exact evidence or gap is satisfied. Exact object work is therefore the authoritative lifecycle projection.

## Status law

Each work item has one status:

```text
open
satisfied
preserved-as-limitation
blocked
```

`open` means the named transaction remains available to perform. `satisfied` means exact supplied custody proves that the transaction has already occurred. `preserved-as-limitation` means a valid reviewed answer packet deliberately retains the unresolved object rather than claiming closure. `blocked` means the action cannot proceed because its required upstream object is absent.

The complete work-order status is one of:

```text
research-open
review-open
reconciliation-open
answer-assembly-open
answer-ready-partial
answer-ready-bounded
```

Before an answer packet exists, the earliest open lifecycle stage determines status. Research precedes review, review precedes reconciliation, and reconciliation precedes assembly. Once a valid reviewed answer packet exists, the order reports `answer-ready-bounded` only when the packet is bounded-complete and every item required for bounded completeness is satisfied. Any remaining required item or preserved limitation produces `answer-ready-partial`.

`answerReady=true` means that the supplied answer packet itself is valid and may be passed to its deterministic renderer. It does not mean the work-order actor may create, alter, extend, summarize, or reinterpret answer text. `boundedComplete=true` is stricter. It means the exact dossier’s reference, candidate, disposition, gap, assembly, and verification work is satisfied without relying on a limitation. It makes no claim about questions, continuities, sources, or candidates outside that dossier.

## Exact satisfaction rules

A recall reference is satisfied only when a supplied reviewed transaction contains an approved `confirm`, `correct`, `split`, or `merge` resolution for that exact dossier candidate. Rejected and deferred resolutions do not satisfy answer work.

A private retrieval reference is satisfied only when a supplied transaction contains primary reviewed evidence whose exact locator digest equals the dossier paragraph digest. Source-level similarity, matching labels, search rank, or a different paragraph in the same edition is insufficient.

A rejected or deferred structured observation is satisfied for answer lifecycle purposes only by being preserved as an explicit answer limitation. It cannot be silently dropped, converted into supporting evidence, or treated as reviewed truth.

A dossier gap is satisfied by one content-addressed answer gap closure. A gap preserved as a limitation remains partial. When supplied adjudicated custody now matches the gap’s candidate, observation, or source identity, the planner emits `close-gap` rather than pretending that the immutable dossier has changed.

Answer assembly is open only when at least one supplied transaction contains an approved resolution capable of supporting reviewed text. It remains blocked when no adjudicated claim custody exists. A valid answer packet satisfies assembly and verification. Rendering remains an explicit open action because the planner does not render on its own.

## Hidden incompleteness

The reviewed answer packet validates the claims, transactions, closures, and limitations that it contains. The lifecycle planner adds a broader dossier parity check. Every recall candidate and private reference named by the dossier receives its own work item even when no corresponding dossier gap was authored. This prevents an otherwise valid answer packet from creating a generic ready state while a separate dossier candidate or private retrieval reference was never reviewed, reconciled, closed, or preserved.

The planner also verifies that any explicitly supplied transaction set agrees with the transaction set embedded in the answer packet. When only the answer packet is supplied, its validated transaction set becomes the work-order input. When both are supplied, identity divergence is refused.

## Operator transactions

The read-only operator exposes:

```bash
npm run asoiaf:answer-work-order -- build \
  --input answer-work-order-input.json \
  --out answer-work-order.json

npm run asoiaf:answer-work-order -- verify \
  --file answer-work-order.json

npm run asoiaf:answer-work-order -- status \
  --file answer-work-order.json

npm run asoiaf:answer-work-order -- next \
  --file answer-work-order.json
```

`build` accepts one `AsoiafAnswerWorkOrderInput` containing the dossier, creator, creation time, optional reviewed transactions, and optional reviewed answer packet. `verify` rebuilds every upstream transaction and every deterministic projection, then checks item identities, dependencies, authority boundaries, work-order fingerprint, and work-order identity. `status` returns complete counts and exact open and blocked items. `next` returns the first exact open item in lifecycle order together with its dependencies and current blockers.

The operator performs no network request, opens no private edition, mutates no estate, writes no graph or canon state, and renders no answer text. Its optional output file is a disposable deterministic projection over the supplied immutable receipts.

## Qualification boundary

Synthetic qualification uses two exact holder-controlled AGOT recall candidates, one private paragraph digest, one reviewed primary packet, one passed reconciliation transaction, one immutable research dossier, and bounded or partial reviewed answer packets. No source prose is retained or read.

The focused suite proves:

```text
deterministic pre-review work
review and reconciliation stage ordering
exact private-locator satisfaction
exact candidate-resolution satisfaction
answer assembly readiness after adjudication
bounded readiness after content-addressed gap closure
partial readiness after explicit limitation
hidden unresolved dossier-candidate detection
transaction-set divergence refusal
item, projection, status, fingerprint, and identity tamper detection
```

The permanent workflow also exercises the operator from JSON in two states. The first supplies the qualified dossier without reconciliation custody and must report open review and reconciliation work. The second supplies the exact reviewed answer packet and transactions and must report bounded answer readiness with deterministic render work remaining. Strict TypeScript, the focused lifecycle, answer, dossier, and reconciliation suites, the complete Arc regression suite, and the production build must pass on the exact final head.

The evidence tier is deterministic lifecycle-planning qualification over synthetic immutable custody. The venue is the stacked research-answer programme. The target is unattended next-action and readiness control rather than ASOIAF truth or automatic execution. The upside is one exact ledger of satisfied, partial, blocked, and open work from question orientation through rendering. The downside is an additional projection that must remain synchronized with every upstream fingerprint. The failure mode is allowing aggregate next-action labels, missing dossier references, stale receipts, or a locally valid but incomplete answer packet to disappear behind a generic ready flag.

The control question is whether one bounded question can always disclose what research, review, reconciliation, closure, assembly, verification, or rendering transaction remains next, which exact custody objects satisfy each dependency, which unresolved objects are deliberately retained as limitations, and why the planner itself cannot execute or promote any of them.