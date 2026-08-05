# ASOIAF external answer desk exchange

The external answer desk exchange is the typed boundary between the persistent holder-controlled desk and actors that must perform work outside the built-in deterministic renderer. It issues one exact leased assignment bundle, accepts one content-addressed result envelope from the named actor, validates that envelope against the assignment and permanent answer-work settlement protocol, and then asks the persistent estate to record the exact settlement.

The exchange does not execute acquisition, private search, review, reconciliation, continuity adjudication, gap closure, answer assembly, or answer verification. It does not grant those actors authority through an assignment. It supplies exact custody and admits only a result that the permanent upstream validators already recognize as lawful evidence of advancement or an honest non-advancing terminal.

## External actions and actors

The exchange uses the worker capability registry from the qualified typed worker plane. The following actions remain external:

```text
acquire-public-record          network-collector
search-private-edition         holder-controlled-search
resolve-edition                edition-reviewer
review-structured-observation  structured-observation-reviewer
review-exact-locator           exact-locator-reviewer
inspect-disposition            disposition-reviewer
reconcile-candidate            canon-reconciler
split-continuity               continuity-reviewer
close-gap                      answer-assembler
assemble-reviewed-answer       answer-assembler
verify-reviewed-answer         answer-verifier
```

`render-reviewed-answer` is excluded from the external exchange. It belongs to `asoiaf-answer-worker:reviewed-renderer-v1`, whose exact invocation, output, result, and settlement custody are already qualified.

Each action retains its declared network, private-text, and human-review requirements. Those declarations describe what the external actor must possess. The assignment itself retains no source prose and no private text. `privateTextIncluded=false` and `sourceTextIncluded=false` remain structural fields, not narrative assurances.

## Assignment issuance

Issuance begins by verifying the complete persistent desk and typed worker estate. It then compiles the current deterministic assignment plan and selects only an item whose desk status is `available`, whose execution mode is `external-required`, and whose required actor role exactly matches the requested role.

The exchange claims the item through the persistent desk using the external actor identity as the lease worker identity. The lease therefore binds:

```text
one exact work-order identity and fingerprint
one exact item identity and fingerprint
one stable action-and-subject key
one action and stage
one dependency set
one actor identity
one claim time and expiry
```

The content-addressed assignment bundle is retained at:

```text
answer-exchange/assignments/<sha256>.json
```

The assignment contains the exact validated work order and exact lease, plus the actor role, issue time, access requirements, accepted result kinds, and authority boundary. Embedding the exact work order allows a disconnected actor or transport to inspect what was leased without receiving mutable access to the live estate. The bundle remains a copy of custody. It cannot advance the desk and cannot satisfy its own item.

An exact issue retry with the same item, actor, claim time, lease duration, role, and issue time returns the existing lease and exact assignment bytes. A role mismatch, unavailable item, or automatic render item is refused before the exchange creates an external lease.

## Accepted result kinds

The exchange narrows each action to result kinds that the downstream settlement can use:

```text
acquire-public-record          structured-public-observation
search-private-edition         private-search-result
resolve-edition                edition-resolution
inspect-disposition            disposition-inspection
split-continuity               continuity-split-decision
                               reviewed-answer-transaction
review-structured-observation  reviewed-answer-transaction
review-exact-locator           reviewed-answer-transaction
reconcile-candidate            reviewed-answer-transaction
close-gap                      reviewed-answer-packet
assemble-reviewed-answer       reviewed-answer-packet
verify-reviewed-answer         reviewed-answer-packet
                               reviewed-answer-verification
```

A result envelope cannot substitute a packet for a transaction, a search receipt for an edition resolution, or any arbitrary object for the action’s admitted result class. An advancing outcome must retain at least one accepted exact result reference.

## External result envelope

The external actor returns an input containing the assignment identity, actor identity and role, completion time, outcome, optional refreshed work order, exact result references, and substantive reason. The exchange resolves the retained assignment itself. The actor cannot supply or replace the lease, before-work-order, action, stable item key, access declarations, or accepted result-kind registry.

The content-addressed result envelope is retained at:

```text
answer-exchange/results/<sha256>.json
```

It binds:

```text
assignment identity and fingerprint
lease identity and fingerprint
before-work-order identity and fingerprint
item identity, fingerprint, and stable key
action
actor identity and role
claim, issue, and completion times
outcome
optional refreshed work order and fingerprint
accepted exact result references
substantive reason
declared access and review requirements
```

The envelope retains `authority=none`, `graphEffect=none`, `canonEffect=none`, and `answerEffect=none`. It records what the actor returned. It does not prove advancement by itself.

## Admission through the permanent settlement validator

Before retaining the result, the exchange constructs the exact settlement that the result would produce and calls the permanent `settleAsoiafAnswerWorkItem` validator with the assignment’s embedded lease and before-work-order.

For `satisfied` or `preserved-as-limitation`, the refreshed work order must:

```text
pass the permanent work-order validator
remain within the same dossier and question
have a different work-order identity
not move creation time backward
contain the same stable action-and-subject item
prove the expected resulting item status
```

The settlement must retain both the typed `answer-exchange-result` reference and the actor’s accepted payload references. For `failed`, `refused`, or `cancelled`, the result must remain non-advancing and provide a substantive reason. Expired and stale outcomes retain the permanent lease protocol’s exact time and head requirements. The external exchange cannot admit `rendered`.

Only after the preview settlement validates does the exchange retain the result file and call the persistent desk settlement transaction. The returned persistent settlement must equal the previewed settlement byte for byte. The exchange therefore cannot use its own envelope to bypass the upstream work-order or lease transition rules.

## Exact replay and race honesty

An exact admission retry reuses the result file and persistent settlement. It does not append a second result or terminal receipt.

The result file is retained before the persistent settlement transaction. This ordering preserves the actor’s exact returned object if the process stops between result custody and desk mutation. A concurrent head change may therefore leave an orphan result whose settlement no longer validates. The verifier reports that condition as an error. The exchange does not silently retarget the result or claim that the actor advanced a different head.

## Exchange verification

The exchange verifier begins with the complete typed worker-estate verifier, then reconstructs every assignment and result relationship. It checks:

```text
assignment format, content identity, fingerprint, role, and capability
assignment-to-persistent-lease equality
assignment-to-stored-work-order equality
one assignment per external lease
result format, content identity, fingerprint, actor, and accepted kinds
result-to-assignment custody
result-to-previewed-settlement equality
persistent settlement equality
settled assignments with typed results
pending assignments
external leases with retained assignments
portable digest-named assignment and result files
```

A retained assignment without a result is a warning while its lease remains an unfinished external attempt. A settled external assignment without its typed result envelope is an error. A result whose persistent settlement is absent or differs from the preview is an error. A changed assignment or result file produces deterministic projection and fingerprint failures.

## Operator transactions

The local command-line operator is registered as `npm run asoiaf:answer-exchange -- ...` and exposes:

```bash
npm run asoiaf:answer-exchange -- plan \
  --root .asoiaf-answer-desk \
  --out exchange-plan.json

npm run asoiaf:answer-exchange -- issue \
  --input exchange-issue-input.json \
  --out exchange-issue-result.json

npm run asoiaf:answer-exchange -- admit \
  --input exchange-result-input.json \
  --out exchange-admission-result.json

npm run asoiaf:answer-exchange -- status \
  --root .asoiaf-answer-desk \
  --out exchange-status.json

npm run asoiaf:answer-exchange -- verify \
  --root .asoiaf-answer-desk \
  --out exchange-verification.json

npm run asoiaf:answer-exchange -- paths \
  --root .asoiaf-answer-desk
```

The exchange operator performs no network request and reads no private source. It operates only on holder-controlled JSON custody supplied to or retained by the local desk.

## Qualification boundary

Synthetic qualification uses the reusable holder-controlled AGOT desk fixture. It adopts the open work order, issues one `review-exact-locator` assignment to an exact-locator reviewer, admits the content-addressed reviewed transaction that advances the desk to the reconciled work order, issues one `close-gap` assignment to an answer assembler, admits the reviewed packet that advances the desk to the bounded ready work order, and hands the remaining `render-reviewed-answer` item to the already-qualified automatic worker.

The focused suite proves:

```text
actor-bound assignment issuance
no source or private text in the bundle
exact issue replay without duplicate lease or file
role mismatch refusal before claim
automatic render refusal from the external exchange
unaccepted result-kind refusal before result custody
missing advancing head refusal before result custody
review-result admission and exact replay
content-addressed gap-result admission
three-head transition from open through reconciled to ready
handoff to the automatic reviewed renderer
final desk, worker, and exchange reconstruction
honest failed external terminal with item release
assignment and result tamper detection
actor identity mismatch refusal
```

The permanent workflow exercises the same sequence through the command-line operators. The assignment identities returned by issuance are inserted into the result templates only after the corresponding bundles exist. The workflow asserts three work orders, three leases, three settlements, two external assignments, two external results, one automatic invocation, one automatic result, one rendered output, no available item, no next automatic item, digest-named files, no source/private text flags, exact replay, and no transaction-lock residue.

The evidence tier is typed external assignment and result custody, synthetic multi-head lifecycle qualification, and exact-head command-line verification. The venue is the persistent holder-controlled answer desk above the typed worker plane. The target is disconnected or separately authorized work without direct mutable estate access. The upside is that external actors receive an exact leased bundle and can return a typed result whose admission remains governed by permanent work-order and settlement validators. The downside is explicit actor-role configuration, immutable exchange-file growth, and honest orphan-result handling under a head race. The failure mode is allowing an actor to replace its lease, return an unaccepted object kind, omit the refreshed proof head, retarget a stale result, or let the exchange envelope satisfy work by assertion.

The control question is whether every external transition can disclose which exact desk head, item, lease, actor, assignment bundle, result envelope, payload objects, refreshed head, and persistent settlement produced it, while neither the transport nor the envelope acquires the authority of the underlying review or acquisition task.
