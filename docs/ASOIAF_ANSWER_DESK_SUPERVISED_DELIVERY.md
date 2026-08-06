# ASOIAF supervised answer-desk delivery

This layer binds the deterministic supervisor in PR #255 to the authenticated certificate, endpoint, rendezvous, and transport stack in PRs #254 and #256. It creates a pull-oriented delivery gate for separately authorized external actors. A remote actor may receive only the assignment already selected by one exact prepared supervisor intent, and may return only the typed result for that retained assignment delivery. The gate does not let the actor choose arbitrary available work, and it does not let the supervisor borrow certificate, private-key, endpoint, result-validation, or settlement authority.

## Permanent operator

The local operator is registered as:

```text
npm run asoiaf:answer-supervised-delivery -- ...
```

The operator exposes:

```text
serve
pull
return
status
verify
paths
```

`serve` runs the mutual-TLS gate. `pull` requests the assignment selected by one prepared intent. `return` submits a typed result for one retained delivery. `status` reads request, response, assignment-delivery, and result-return custody. `verify` reconstructs the delivery layer and every qualified lower plane. `paths` prints the portable storage contract.

## Actors and authority boundaries

The scheduling actor is the qualified persistent answer-desk supervisor. It owns policy, dependency readiness, actor capacity, deterministic selection, write-ahead intent, and one-operation execution custody. It does not own network identity or private-key material.

The remote actor is identified by the client certificate authenticated at the TLS socket. The fingerprint must resolve through the qualified transport actor registry and through an active certificate admission in the transport-operations estate. The actor cannot declare or replace its identity or role in the request body.

The rendezvous plane owns bounded endpoint custody and a fresh, pinned, client-specific route. The delivery gate may use only the exact retained rendezvous named by the request. It cannot discover another host, silently fail over, reinterpret a stale observation, or substitute another server certificate or client trust root.

The typed external exchange and persistent desk remain authoritative for the assignment, lease, accepted result kind, refreshed work-order head, and settlement. The delivery gate cannot satisfy work by emitting a success response. The automatic reviewed-answer renderer remains local to `asoiaf-answer-worker:reviewed-renderer-v1` and never crosses this remote gate.

Every delivery-layer request, response, assignment delivery, and result return retains:

```text
certificateRetained=false
privateKeyRetained=false
privateTextIncluded=false
sourceTextIncluded=false
authority=none
graphEffect=none
canonEffect=none
answerEffect=none
```

## Mutual-TLS server

The server requires a client certificate chained to the configured client certificate authority. It derives the authenticated leaf fingerprint from the TLS socket and verifies the complete lower transport, operations, supervisor, exchange, worker, and desk estate before accepting an application transaction.

Connections without a client certificate or with a certificate outside the configured trust root fail at TLS and create no supervised-delivery request. A trusted certificate must also have an active transport registration and an active operations admission at the request time. A retired, revoked, not-yet-active, or expired certificate is refused before it can receive another assignment.

The server exposes two versioned routes:

```text
POST /v1/supervisor/assignments/pull
POST /v1/supervisor/results/return
```

Only `application/json` is accepted. Query strings, unsupported methods, unsupported routes, malformed JSON, oversized bodies, and missing idempotency keys are refused.

## Assignment pull

The pull body contains exactly:

```json
{
  "intentId": "asoiaf-answer-supervisor-intent:...",
  "rendezvousId": "asoiaf-answer-transport-rendezvous:..."
}
```

The body cannot contain an actor identity, role, item identity, action, subject, policy, lease duration, endpoint, certificate fingerprint, operator identity, or arbitrary work selector. Extra fields are refused before request custody is created.

The gate resolves the retained supervisor intent and requires an `issue-external` decision with one exact item, actor, role, and lease duration. The authenticated actor and role must equal the intent decision. The named rendezvous must belong to the same certificate-bound actor, remain fresh at the receipt time, select one active endpoint, bind the server certificate observed on the current connection, and match the request host.

After those checks, the gate executes the exact supervisor tick represented by the prepared intent. The supervisor may create or replay one typed exchange assignment. The gate then submits the exact issue body through PR #254's authenticated transport processor using a derived lower idempotency key bound to the supervised-delivery request fingerprint. That lower transaction must replay the same actor-bound assignment rather than create a second claim. The resulting assignment must preserve the intent's item, actor, role, claim time, and lease duration. The delivery receipt binds the exact request, intent, supervisor run, actor, certificate admission, certificate fingerprint, rendezvous, endpoint lease, lower transport request and response, assignment, assignment URI, lease, delivery time, and replay flags.

The remote pull does not select the work item. It releases one already prepared decision through the permanent supervisor and exchange validators.

## Typed result return

The return body contains exactly one retained delivery identity, the same client-specific rendezvous identity, completion time, typed exchange outcome, optional refreshed qualified work order, accepted result references, and substantive reason.

The authenticated actor, role, certificate fingerprint, and rendezvous must equal the retained assignment delivery. The actor cannot replace the assignment, lease, before-work-order head, item, action, accepted result registry, or supervisor decision.

The gate submits the result through PR #254's authenticated transport processor using a derived lower idempotency key bound to the supervised-delivery request fingerprint. The lower transport and exchange validate the result kind, actor, assignment, refreshed head, and settlement. A successful result-return receipt binds the exact delivery, lower transport request and response, typed exchange result, permanent settlement, and replay state.

A fluent answer, generic success flag, process exit code, or delivery response cannot advance the desk. Only the permanent result and settlement validators can do so.

## Idempotency and restart reconstruction

Every application request requires an `Idempotency-Key`. The raw key is never retained. Its SHA-256 digest names one request record. The request binds the authenticated certificate fingerprint, transport registration, certificate admission, actor and role, operation, method, route, rendezvous, endpoint lease, receipt time, canonical body digest, and content-derived identity.

An exact retry returns the retained request and response. A changed actor, certificate, rendezvous, route, operation, or body under the same key is refused as a conflict. Assignment pull replay reuses the same supervisor intent, run, lease, assignment, and delivery. Result return replay reuses the same lower transport request and response, result, settlement, and return receipt.

Because the request and terminal response are retained separately, a missing response remains visible as an incomplete transaction. Process restart cannot silently retarget the request to a different intent, assignment, actor, endpoint, result, or head. The qualified lifecycle stops and restarts the mutual-TLS server, then proves exact pull and return replay without creating another claim or settlement.

## Portable storage

The delivery estate is rooted at:

```text
answer-supervised-delivery/
```

It contains four append-only, digest-named collections:

```text
answer-supervised-delivery/requests/<sha256>.json
answer-supervised-delivery/responses/<sha256>.json
answer-supervised-delivery/deliveries/<sha256>.json
answer-supervised-delivery/returns/<sha256>.json
```

Files use create-or-exact-replay semantics. Changed bytes at an existing digest-derived path are immutable collisions rather than overwrites.

## Refusal matrix

The permanent tests cover the following materially distinct refusals:

- A body that declares an actor, role, work item, action, policy, lease, endpoint, or another forbidden selector.
- A certificate-bound actor that does not own the prepared supervisor intent.
- An intent that is absent, invalid, non-external, or inconsistent with the resulting supervisor run or exchange assignment.
- A rendezvous that is absent, invalid, stale, unavailable, assigned to another client, bound to another endpoint, host, server certificate, or inactive certificate lifecycle.
- A retired or revoked certificate attempting to pull another assignment.
- A result return from an actor, certificate, role, or rendezvous that does not own the retained delivery.
- An idempotency key reused with changed body, actor, rendezvous, route, or operation custody.
- A lower result kind, refreshed head, or settlement rejected by the permanent transport, exchange, work-order, or lease validators.
- Changed request, response, delivery, return, intent, run, assignment, result, settlement, registration, admission, endpoint, or rendezvous bytes.
- Certificate, private-key, CSR, PEM, source-text, or private-text material retained under the delivery estate.

## Verification

The verifier begins with the complete transport-operations, transport, supervisor, exchange, worker, and persistent-desk verifiers. It then reconstructs request identities and paths, idempotency-key uniqueness, active certificate and actor custody, rendezvous and endpoint equality, response terminal consistency, one response per request, assignment-delivery equality with the intent, supervisor run, assignment, and lease, result-return equality with the delivery, lower transport request and response, result, and settlement, exact actor and role continuity, incomplete requests, orphan objects, replay state, authority boundaries, and secret-material prohibitions.

A changed or missing lower object is an integrity error. An incomplete request is visible rather than silently discarded. Verification does not infer that a remote actor performed the underlying research or review correctly; the accepted typed result and permanent settlement remain the evidence for that transition.

## Qualified lifecycle target

The permanent qualification creates an ephemeral issuing authority plus server, reviewer, and answer-assembler certificates. It adopts one open answer work order, prepares the exact reviewer intent without claiming work, admits certificate and endpoint custody, performs real pinned mutual TLS, refuses the wrong actor, pulls and replays the reviewer assignment, refuses changed idempotency custody, returns and replays the reviewed result, prepares and completes the assembler intent, restarts the delivery server, replays retained pull and return transactions after restart, retires the reviewer certificate, refuses another pull from that retired identity, delegates final rendering to the local automatic worker, and reconstructs every delivery and lower-plane object.

The qualification certificates and private keys exist only in ephemeral runner storage and are deleted before artifact construction.

## Limitations

This layer does not execute the assigned task on the remote machine. It does not distribute or protect private keys, enroll devices, renew certificates automatically, discover public endpoints, traverse NAT, maintain a durable message queue, stream large task payloads, retry across endpoints, fail over automatically, supervise a remote process, attest hardware, or establish distributed consensus.

The next operational boundary is a durable remote actor runtime and mailbox that can hold the delivered assignment, execute the named task under its declared access constraints, and return a typed result across intermittent connectivity while preserving this gate's exact actor, intent, assignment, and settlement custody.

## Control question

Can every remote transition identify the exact prepared supervisor intent, dependency-ready item, policy and actor-capacity decision, authenticated certificate admission and registration, fresh pinned rendezvous and endpoint, request and response, supervisor run, assignment delivery, typed result return, refreshed work-order head, and permanent settlement that produced it, while neither the scheduler, certificate, network route, delivery envelope, nor remote actor response acquires the authority of the underlying research, review, graph, canon, answer, private-text, or automatic-renderer task?
