# ASOIAF remote answer-desk supervisor

The remote answer-desk supervisor is the authority-free composition layer above the qualified persistent supervisor and the qualified certificate, rendezvous, and transport operations plane. It converts one deterministic supervisor decision into either one exact certificate-bound remote dispatch, one exact local automatic execution, or one retained waiting decision. It does not perform source acquisition, private-edition search, evidence review, reconciliation, gap closure, answer assembly, answer verification, or rendering in place of the qualified actors that own those operations.

The layer exists because the two qualified predecessor planes solve different parts of unattended execution. The persistent supervisor can select dependency-ready work, bind it to an actor and capacity slot, retain a write-ahead intent, and reconstruct its local scheduling receipt. The transport operations plane can bind one active certificate to one actor, select one fresh pinned rendezvous, dispatch one typed transport transaction, and replay the retained transaction without network access. Neither predecessor alone proves that the scheduler used the exact remote identity and endpoint selected by the operations estate.

The remote supervisor joins those custody chains without weakening either one. It retains a remote write-ahead intent before creating a base supervisor intent, a transport dispatch, a lease, or an assignment. For external work, it dispatches the assignment through the exact retained rendezvous first. It then invokes the qualified base supervisor with the same item, actor, role, request time, and lease duration. The base supervisor must find and replay the exact lease and assignment created by the remote transaction. A different item, actor, role, lease, assignment, endpoint, certificate, request body, or idempotency key is a conflict.

## Actors and authority boundaries

The local remote-supervisor operator supplies one qualified base supervisor policy and a bounded set of remote bindings. Each remote binding joins one base supervisor actor binding to one admitted client certificate and one retained client-specific rendezvous. The binding records certificate and rendezvous fingerprints, but it retains no certificate bytes, private-key bytes, certificate paths, private-key paths, or credential paths.

The base supervisor remains authoritative only for deterministic work selection, actor capacity, dependency readiness, write-ahead scheduling intent, and scheduling-run custody. The operations plane remains authoritative only for certificate admission and retirement, endpoint leases, availability observations, deterministic rendezvous, and dispatch custody. The transport server remains authoritative only for authenticated request and response custody. The exchange, worker, desk, work-order, lease, reviewed-answer, dossier, and reconciliation validators retain their existing authority boundaries.

Every remote policy, binding, projection, intent, and run carries `authority=none`, `graphEffect=none`, `canonEffect=none`, and `answerEffect=none`. The remote supervisor cannot make evidence valid, satisfy work by assertion, promote canon, mutate the graph, or create answer text.

## Policy

A remote policy embeds one complete validated supervisor policy. Each remote binding must identify an existing enabled external actor binding from that policy, one active admitted client certificate for the same actor and role, and one retained rendezvous for that exact client admission. The rendezvous must bind one active endpoint lease, one fresh successful mutual-TLS observation, the exact certificate admission, and `automaticFailover=false`.

The policy is deterministic and content addressed. It retains:

- the exact base supervisor policy and fingerprint;
- the exact supervisor binding identity and fingerprint;
- the exact actor identity and role;
- the client certificate admission identity, admission fingerprint, and certificate fingerprint;
- the rendezvous identity and fingerprint;
- the selected server identity;
- `selectionPolicy=supervisor-decision-then-exact-pinned-rendezvous`;
- `credentialPolicy=operator-supplied-ephemeral-material`;
- `dispatchPolicy=remote-first-then-supervisor-replay`;
- `automaticFailover=false`.

A changed supervisor policy, actor binding, certificate admission, actor, role, rendezvous, or retained byte produces a different policy or an integrity error. A remote binding cannot select an automatic worker because automatic rendering remains local to the qualified reviewed renderer.

## Projection and readiness

Planning verifies the complete base supervisor and operations estates. It first computes the ordinary supervisor projection. For each remote binding, it then reconstructs the bound certificate admission, endpoint lease, availability observation, and rendezvous at the projection time.

An ordinary `issue-external` decision becomes `dispatch-external` only when the exact bound certificate is active and unretired, the endpoint lease and server certificate are active, the rendezvous is selected, the successful observation remains fresh, and every stored fingerprint agrees. If any one of those conditions fails, the decision becomes `wait-rendezvous`. The projection records the exact exclusion reason and creates no lease, assignment, base supervisor intent, or dispatch.

All non-external decisions preserve the base supervisor decision. Automatic work remains `run-automatic`. Existing external work remains `wait-external`. Unbound, saturated, disabled, and idle states remain explicit. Planning has no mutation effect.

## Write-ahead intent

`prepare` retains one immutable remote intent before any lower mutation. The intent binds:

- the request key and request fingerprint;
- the exact remote policy and projection;
- the base supervisor decision;
- the remote certificate and rendezvous decision, when applicable;
- the exact request time and optional automatic completion time;
- the derived base supervisor request key;
- the digest of the lower dispatch idempotency key;
- the operator identity;
- `credentialMaterialRetained=false`.

Credential bytes and credential paths are not fields in the intent. An exact prepare retry returns the retained intent. Reusing a request key with a changed policy, time, decision, certificate, rendezvous, or optional completion time is refused.

## External tick

For `dispatch-external`, the remote tick performs the following transaction:

1. Retain or replay the remote write-ahead intent.
2. Retain or replay the exact base supervisor write-ahead intent without executing it.
3. Resolve the exact active certificate admission and selected rendezvous from permanent custody.
4. Build the typed assignment-issue body from the base supervisor decision.
5. Dispatch that body through the qualified operations plane using operator-supplied certificate, private-key, and server-CA bytes.
6. Require one successful typed exchange assignment response.
7. Invoke the base supervisor with the exact same request time, item, actor, role, and lease duration.
8. Require the base supervisor to replay the exact lease and assignment created by the network dispatch.
9. Retain one remote run binding both write-ahead intents, the operations dispatch, transport request and response, assignment, lease, base supervisor run, and after-projection.

The credential material exists only in process memory during step 5. The remote run retains the certificate admission identity and dispatch receipt, not the credential bytes or their filesystem paths.

## Crash and replay behavior

The transaction is restart-safe at each retained boundary. If the process stops after the remote intent, the next exact tick resumes from the same decision. If it stops after the base supervisor intent, the next tick reuses that intent. If it stops after the network dispatch but before either supervisor run receipt, the next tick locates the retained dispatch through its idempotency digest, reconstructs the successful assignment, and completes both supervisor run receipts without certificate material or another network attempt.

Once a remote run exists, an exact retry returns it directly. The retry does not require a live server, a fresh probe, a certificate file, or a private key. A changed retry is refused rather than interpreted as a new scheduling transaction.

Offline replay is a custody statement, not a new availability statement. It proves that the retained lower transaction already completed. It does not claim that the endpoint remains reachable.

## Automatic and waiting decisions

For `run-automatic`, the remote supervisor delegates the exact decision to the qualified base supervisor. The base supervisor delegates rendering to `asoiaf-answer-worker:reviewed-renderer-v1`. The remote layer neither receives remote credentials nor transports the render operation.

For `wait-rendezvous`, the remote supervisor retains a remote run with no base supervisor intent, lease, assignment, dispatch, or network attempt. For other non-mutating states, it delegates the exact decision to the base supervisor and retains both scheduling receipts without creating unrelated work.

## Persistent storage

The remote estate is stored below the holder-controlled answer-desk root:

```text
answer-remote-supervisor/
  intents/<sha256>.json
  runs/<sha256>.json
```

Filenames are full SHA-256 digests. Files use immutable create-or-exact-replay semantics. A changed byte at an existing digest path is an immutable collision.

The remote verifier begins with the complete supervisor and operations verifiers. Those verifiers recursively cover transport, exchange, worker, desk, work-order, lease, reviewed-answer, dossier, and reconciliation custody. The remote verifier additionally reconstructs:

- policy and binding identities;
- actor, role, certificate, and rendezvous equality;
- active-certificate and selected-rendezvous readiness;
- projection and exclusion determinism;
- request-key uniqueness;
- remote intent and run identities;
- base supervisor intent and run equality;
- dispatch, request, response, assignment, and lease equality;
- remote-first and supervisor-replay ordering;
- exact offline replay;
- missing or orphan lower objects;
- digest-named paths;
- forbidden certificate, key, credential, or PEM material.

A retained intent without a run is a warning because it may represent interrupted work. A run without its exact intent or lower receipts is an error. A stale or retired rendezvous is a waiting condition before mutation, not permission to select another endpoint automatically.

## Operator interface

The permanent operator is:

```text
npm run asoiaf:answer-remote-supervisor -- <command>
```

The commands are:

- `policy`: build and validate one certificate-bound remote supervisor policy;
- `plan`: project one remote decision without retaining intent or claiming work;
- `prepare`: retain one remote write-ahead intent;
- `tick`: execute or replay one external, automatic, or waiting decision;
- `status`: read remote intents, runs, pending intents, and an optional current projection;
- `verify`: reconstruct the complete remote and lower custody chain;
- `paths`: print the portable storage contract.

A tick input may contain `credentialFiles` for one live external dispatch. The CLI reads those files into memory, removes their paths from the typed input, and passes only byte buffers to the library. The permanent remote intent and run formats have no field capable of retaining those paths or bytes.

## Qualified and unqualified claims

This layer is designed to qualify unattended remote scheduling across one holder-controlled estate and one selected transport endpoint. It does not claim certificate issuance, automated enrollment, renewal, recovery, hardware-backed key custody, public service discovery, NAT traversal, reverse connectivity, durable message queues, automatic failover, multi-server high availability, distributed consensus, or cross-estate transaction atomicity.

A successful remote tick proves which deterministic scheduling decision, certificate admission, pinned observation, rendezvous, dispatch, transport response, assignment, lease, base supervisor replay, and final projection were retained. It does not prove that the remote actor performed the assigned review correctly. That substantive result still has to return through the typed result, refreshed-head, and settlement validators.

The control question is whether every unattended remote scheduling transaction can identify the exact desk and worker-plan heads, base policy and actor-capacity decision, remote write-ahead intent, admitted client certificate, fresh pinned rendezvous, dispatch and transport receipts, assignment and lease, base supervisor replay, result and refreshed head when later admitted, and permanent settlement, while no scheduler, certificate, endpoint, observation, rendezvous, or dispatch acquires the authority of the underlying research, review, graph, canon, answer, private-text, or automatic-rendering task.
