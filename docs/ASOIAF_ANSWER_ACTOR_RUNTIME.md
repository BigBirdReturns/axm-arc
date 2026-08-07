# ASOIAF actor runtime and durable mailbox

## Classification

The actor runtime is a holder-controlled execution-custody plane between certificate-authenticated supervised delivery and any adapter process that performs the assigned work. It receives an already delivered assignment, binds it to one explicit actor-local credential slot and one exact provider profile, retains digest-only execution custody, records one typed result, prepares one durable return intent, and records one exact supervised-return acknowledgement.

It is not a scheduler, certificate issuer, deployment manager, credential provider, transport registry, research authority, review authority, settlement authority, graph writer, canon authority, or answer renderer. Network success, provider success, process exit, and fluent output do not confer task authority.

## Actors and mechanism

The answer-desk supervisor selects a dependency-ready work item and actor role. Supervised delivery authenticates the actor certificate and releases one exact assignment. The runtime operator configures a local credential slot. The provider host owns one exact native credential operation. The adapter performs bounded task work. Supervised delivery accepts a typed result, and the answer desk retains settlement.

The runtime preserves these separations. A local slot cannot issue the assignment, create the actor certificate, generate or export the provider credential, select a different provider profile, register a transport endpoint, settle the work item, mutate the research graph, determine canon, or render an answer.

## Credential slots

A runtime slot binds one actor identity and role, one delivery-certificate fingerprint, one provider profile and broker binding, one credential relationship, one optional predecessor slot, one creation time, and one operator. The relationship is either `same-principal` or `explicit-delegation`.

A same-principal slot is admitted only when the delivery actor and provider binding have the same principal and role. An explicit delegation is admitted only when those identities differ and the operator retains a bounded reason. The delegation record grants no task or credential authority. It makes the cross-credential mapping reconstructable.

A successor slot must preserve actor identity, role, and provider profile while identifying a different delivery certificate. The predecessor relationship does not transfer assignments. A return intent must use the exact slot that accepted the delivery. A successor or alternate slot cannot return predecessor-delivered work.

## Assignment acceptance

The runtime accepts an assignment only from the verified supervised-delivery estate. Acceptance binds the slot, actor, role, delivery certificate, delivery, assignment, lease, item, action, stage, accepted result kinds, rendezvous, delivery time, and lease expiry. The slot must own the exact actor, role, and certificate carried by the delivery. One delivery can have only one runtime acceptance.

Acceptance retains no certificate bytes, private key, source text, private text, provider selector, provider secret, or raw task input.

## Digest-only execution

An execution intent binds one accepted assignment to the exact slot and provider profile, one adapter identity and version, the SHA-256 digest and byte count of ephemeral task input, preparation and expiry times, and one operator. Raw task input is never retained. The execution interval cannot exceed the assignment lease. One acceptance can have only one execution intent.

A typed local result binds one execution intent to one public provider result from the exact provider profile. It retains the typed outcome, an optional deterministically valid after-work-order, assignment-approved result references, a bounded reason, the SHA-256 digest and byte count of adapter output, completion time, and operator. Raw adapter output is never retained. Provider success does not become task success automatically.

## Durable return custody

A return intent reconstructs the supervised-delivery return body from the typed local result. It binds the original slot, acceptance, delivery, certificate, rendezvous, result, digest of the idempotency key, typed body and body digest, preparation time, and operator. The raw idempotency key is not retained. The intent remains durable while connectivity is absent, but it proves only that the actor requested a return.

A return receipt is admitted only when the supervised-delivery estate contains the exact return and the exchange estate contains the exact typed result. The runtime compares delivery, actor, role, certificate, rendezvous, outcome, after-work-order, result references, reason, exchange result, and settlement custody. The return intent must precede the supervised return, and the local receipt must follow it. The receipt has acknowledgement authority only.

## Retirement and stranded work

Scheduled slot retirement is admitted only when every assignment accepted under that slot has a retained return receipt. A pending execution, local result, or durable return intent does not satisfy this condition.

Emergency retirement may proceed with unresolved assignments, but each unresolved acceptance becomes a permanent stranded-assignment record with `successorMayInherit=false`. The runtime state projects the assignment as `stranded` rather than silently moving it to a successor certificate or slot.

## Deterministic state and verification

Runtime records are immutable JSON objects stored under SHA-256 filenames. Exact retries reproduce the existing object. Conflicting retries fail. State is rebuilt from slots, acceptances, execution intents, results, return intents, return receipts, retirements, and stranded records. Each assignment is projected as `accepted`, `prepared`, `result-ready`, `return-pending`, `returned`, or `stranded`.

The verifier reconstructs every fingerprint, parent reference, one-to-one cardinality, slot continuity, provider-profile custody, delivery-certificate custody, result typing, return settlement, retirement rule, and state entry. It invokes the complete supervised-delivery and provider-host verifiers before accepting runtime state.

## Retention boundary

The runtime may retain public identities, fingerprints, typed work orders, typed result references, reasons, counts, and times. It may not retain private keys or key paths, certificates or certificate requests, PKCS#12 objects, raw provider selectors, provider PINs, passwords, tokens, secrets or sessions, raw task input, raw adapter output, raw idempotency keys, or raw provider response bodies. The verifier rejects credential-bearing filenames and secret-bearing content under the runtime estate.

## Operator

```text
npm run asoiaf:answer-actor-runtime -- help
npm run asoiaf:answer-actor-runtime -- slot --input slot.json
npm run asoiaf:answer-actor-runtime -- accept --input acceptance.json
npm run asoiaf:answer-actor-runtime -- prepare --input execution.json
npm run asoiaf:answer-actor-runtime -- result --input result.json
npm run asoiaf:answer-actor-runtime -- prepare-return --input return-intent.json
npm run asoiaf:answer-actor-runtime -- record-return --input return-receipt.json
npm run asoiaf:answer-actor-runtime -- retire --input retirement.json
npm run asoiaf:answer-actor-runtime -- status --root answer-estate
npm run asoiaf:answer-actor-runtime -- verify --root answer-estate
npm run asoiaf:answer-actor-runtime -- paths --root answer-estate
```

## Qualification target

The permanent qualification reconstructs the complete inherited supervised-delivery and provider-host estates, imports two certificate-bound assignments, executes two digest-only runtime intents through public provider results, binds one exact supervised-return acknowledgement, proves immutable replay through separate CLI processes, refuses successor-slot return, refuses scheduled retirement with unresolved work, and records one emergency-stranded assignment with successor inheritance disabled.

The complete repository regression and production build remain mandatory. Qualification artifacts exclude parent ephemeral certificate material, task input, adapter output, provider selectors, private keys, and provider secrets.

## Control question

Can every actor-local result disclose the exact supervised assignment, delivery certificate, runtime slot, provider profile, digest-only execution intent, public provider result, typed local result, durable return intent, supervised return, settlement, retirement state, workflow head, and qualification artifact that produced it, while no successor slot, provider success, process exit, network route, or retained receipt acquires the actor's credential or task authority?
