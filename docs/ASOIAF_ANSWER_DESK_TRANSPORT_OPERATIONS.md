# ASOIAF answer-desk transport operations

This layer operates certificate and endpoint custody above the authenticated ASOIAF answer-desk transport. It admits bounded X.509 client and server certificate lifecycles, records explicit rotation and retirement, leases HTTPS origins, observes pinned mutual-TLS availability, selects deterministic client-specific rendezvous, and dispatches the exact assignment or result request through the already qualified transport. It does not issue certificates, retain keys, discover hosts, keep a durable message queue, fail over automatically, or acquire the authority of the underlying research, review, graph, canon, or answer transaction.

The permanent operator is:

```text
npm run asoiaf:answer-transport-operations -- <command>
```

Its commands are `admit-certificate`, `retire-certificate`, `advertise`, `probe`, `resolve`, `issue`, `admit`, `status`, `verify`, and `paths`.

## Position in the answer-desk stack

The persistent desk owns work-order, lease, and settlement custody. The worker owns the one registered automatic rendering capability. The external exchange owns typed assignment and result envelopes. The authenticated transport binds a mutual-TLS peer certificate to one immutable actor registration and retains replay-safe request and response custody. This operations layer governs when one certificate and one endpoint are eligible to use that transport. It never replaces any lower validator.

A successful operations dispatch therefore proves which admitted client certificate, selected endpoint lease, current availability observation, rendezvous, idempotency key, request body, authenticated transport response, lower assignment or result, refreshed work-order head, and persistent settlement participated. It does not prove that an external actor performed the underlying task correctly. That decision remains with the permanent exchange, answer-work, reviewed-answer, dossier, reconciliation, graph, canon, and answer validators.

## Portable formats

The layer adds six content-addressed formats:

```text
axm-asoiaf-answer-transport-certificate-admission/1
axm-asoiaf-answer-transport-certificate-retirement/1
axm-asoiaf-answer-transport-endpoint-lease/1
axm-asoiaf-answer-transport-availability-observation/1
axm-asoiaf-answer-transport-rendezvous/1
axm-asoiaf-answer-transport-dispatch/1
```

Every object fixes `authority`, `graphEffect`, `canonEffect`, and `answerEffect` to `none`. Certificate and private-key bytes, certificate and key paths, TLS session material, source text, and private text are excluded from these formats.

## Storage contract

One holder-controlled answer-desk estate receives an `answer-transport-operations/` directory:

```text
answer-transport-operations/
├── certificates/<certificate-fingerprint>.json
├── retirements/<certificate-fingerprint>.json
├── endpoints/<endpoint-lease-fingerprint>.json
├── availability/<observation-fingerprint>.json
├── rendezvous/<rendezvous-fingerprint>.json
└── dispatches/<idempotency-key-digest>.json
```

The exact lower transport, exchange, worker, and desk estates remain in their existing directories. Operations records use create-or-exact-replay semantics. An existing path with changed bytes is an immutable collision rather than an update. Disposable `status` output is reconstructed from these retained objects.

## Certificate admission

`admit-certificate` accepts one leaf certificate and one operator-selected issuer certificate for verification in memory. The issuer must be a certificate authority. The leaf must verify under that issuer, must not itself be a certificate authority, and must carry the requested extended-key usage: `clientAuth` for a client certificate or `serverAuth` for a server certificate. RSA keys must be at least 2048 bits. Supported elliptic-curve keys must identify their named curve. A leaf lifetime may not exceed 398 days.

The admission retains the leaf and issuer fingerprints, public-key fingerprint, serial number, subject, issuer, extended-key-usage identifiers, validity window, principal, optional answer-work role, bounded operating schedule, predecessor fingerprint, rotation reason, operator, and lower transport registration identity where applicable. It retains neither certificate nor key material.

The operating schedule is explicit:

```text
admittedAt <= activateAt < renewAfter < retireAfter <= validUntil
```

A client certificate requires one existing answer-work actor role and is registered through the qualified authenticated transport under the same principal and role. A server certificate cannot acquire an external actor registration.

A later certificate for the same principal must name its exact predecessor. It must preserve certificate usage and actor role, use a different certificate fingerprint, and overlap its predecessor by at least sixty seconds. One predecessor may have at most one admitted successor in this format version. This keeps rotation a visible lineage rather than allowing an operator to reinterpret an old certificate as an unrelated actor.

## Retirement and revocation

`retire-certificate` appends one terminal retirement for an admitted certificate. A scheduled retirement may not precede the admission's declared retirement time and requires its exact successor to be active at the retirement time. An emergency retirement may occur after activation without waiting for the scheduled boundary. Both forms retain the reason and operator.

Retiring a client certificate invokes the lower authenticated transport's append-only revocation transaction for the same fingerprint. The retirement binds the exact revocation identity and fingerprint. A retired or lower-revoked client certificate is ineligible for rendezvous and dispatch. Retiring a server certificate does not manufacture a client-actor revocation.

This layer does not create, renew, escrow, recover, or destroy private keys. Those actions remain external operator and device responsibilities.

## Endpoint leases

`advertise` retains one bounded lease for an HTTPS origin. The origin may contain no credentials, query, fragment, or application path and may not use an unspecified address. The lease declares a server identity, network scope, deterministic integer priority, exact admitted server certificate and issuer fingerprints, accepted client-certificate-authority fingerprint, advertised time, availability start, expiry, and operator.

The supported network scopes are `loopback`, `lan`, `overlay`, `public`, and `manual`. Scope is descriptive custody, not proof that the route is reachable or safe. The endpoint's availability window must remain inside the admitted server certificate's active and validity window. The lease cannot extend the server certificate by assertion.

An endpoint lease is not service discovery. The operator must supply the exact origin and pins. This format version does not publish DNS records, open firewall ports, create tunnels, traverse NAT, or configure reverse proxies.

## Availability observations

`probe` performs one real TLS connection to a retained endpoint using the supplied client certificate, private key, and server certificate authority only for that transaction. It requires mutual TLS, verifies the server chain, computes the observed leaf fingerprint, and compares it with the endpoint's exact server pin. It then destroys the probe socket and retains only the bounded observation.

An observation terminates as one of:

```text
available
unreachable
tls-refused
server-certificate-mismatch
```

The record binds the endpoint, client admission, expected and observed server fingerprints, observation and completion times, latency, bounded error code, and reason. It retains no certificate or private-key bytes or paths. Availability is operational evidence only. It cannot satisfy an answer-work item or authorize a lower exchange transition.

## Deterministic rendezvous

`resolve` compiles one client-specific rendezvous for one server identity at one declared generation time. The client admission must be active, unretired, and unrevoked. Each endpoint entry states its exact lease and pin custody, latest observation, eligibility, and exclusion reason. A successful observation is usable only within the caller's bounded freshness window, which must be at least one second and no more than twenty-four hours.

Eligible entries sort by lower numeric priority, newer observation, origin, and endpoint fingerprint. The first entry is selected deterministically. The rendezvous retains `automaticFailover=false`. If the selected endpoint later fails, the caller must produce a new observation and a new rendezvous. A dispatch does not silently move to a different route.

A rendezvous with no eligible entry remains an honest retained projection. It does not invent availability.

## Dispatch and replay

`issue` and `admit` dispatch through one retained rendezvous. The caller supplies the exact client certificate, private key, and server certificate authority for the live request. Before network access, the operations layer verifies the rendezvous, endpoint, client admission, retirement and revocation state, certificate fingerprint, server and issuer pins, route, request-body digest, and idempotency-key digest.

The dispatch receipt binds the operation, lower transport route, request-body digest, rendezvous, endpoint, base origin, client fingerprint, dispatch and completion times, HTTP status, and complete typed lower transport envelope. The lower authenticated transport still validates the certificate registration, actor role, global idempotency key, assignment or result body, and every exchange and desk transition.

An exact local retry with the same idempotency key, operation, body, rendezvous, endpoint, and client fingerprint returns the retained dispatch receipt with `networkAttempted=false`. It does not require the endpoint to remain online and does not reopen lower claim or settlement creation. Reusing a retained idempotency key with changed custody is refused.

The client process destroys its shared HTTPS agent after each command. The probe and test server paths explicitly close or destroy idle and active sockets. This makes a completed one-shot command terminate without leaving pooled connections as accidental availability state.

## Verification

`verify` begins with the complete authenticated transport, exchange, worker, and persistent-desk verifiers. It then reconstructs:

- Certificate admission identity, issuer verification metadata, role legality, schedules, predecessor and successor lineage, overlap, lower registration, and secret-exclusion flags.
- Retirement identity, exact admission and successor custody, retirement time, and lower client revocation.
- Endpoint identity, origin normalization, network scope, priority, certificate and client-CA pins, and lease containment within the server certificate schedule.
- Availability identity, endpoint and client custody, observed pin, outcome, timing, and digest-named path.
- Rendezvous identity, active client custody, complete endpoint entries, latest observations, deterministic ordering and selection, bounded freshness, and absence of automatic failover.
- Dispatch identity, idempotency-key path, exact operation and body digest, rendezvous and endpoint custody, client fingerprint, typed lower response, and local replay parity.
- The complete operations directory for secret-bearing filenames and embedded PEM certificate or private-key material.

Changed retained bytes, stale fingerprints, duplicate lineage, crossed roles, unsafe origins, expired leases, stale observations, retired clients, mismatched pins, response custody drift, missing lower objects, orphan files, or secret-bearing material are errors. A bounded absence of availability remains an honest state rather than an integrity failure.

## Qualification boundary

The permanent workflow uses ephemeral, one-day qualification certificates created only inside the GitHub runner. It admits one server certificate, an exact-locator reviewer predecessor and successor, and a separate answer-assembler certificate. It proves exact admission replay, successor lineage, emergency predecessor retirement and lower revocation, one bounded loopback endpoint lease, real pinned TLS observations for the successor reviewer and assembler, retired-client rendezvous refusal, two deterministic rendezvous records, four live external dispatches, offline replay after transport-process loss, and one local automatic render transition.

The artifact retains operating objects, lower desk custody, refusal receipts, statuses, verifier output, focused and complete test logs, build output, candidate identity, boundary declaration, and `SHA256SUMS`. It excludes the ephemeral certificate directory and rejects any `.key`, `.crt`, `.pem`, or `.csr` path or embedded PEM certificate or private-key marker.

The focused test suite additionally proves scheduled retirement with an active overlapping successor, issuer and extended-key-usage refusal, weak schedule and crossed-role refusal, unsafe endpoint refusal, server-pin mismatch, unreachable observation, deterministic priority and freshness, immutable dispatch replay, post-rotation actor custody, and tamper and secret-material detection.

## Operational limits

This boundary does not claim automated certificate enrollment, certificate-authority governance, renewal agents, key recovery, hardware-backed key custody, endpoint publication, public reachability, tunnel creation, durable queues, delivery acknowledgement beyond the retained HTTPS response, automatic failover, multi-server consensus, load balancing, or high availability. It operates exact operator-supplied certificates and origins and records what happened.

The evidence tier is certificate and endpoint operations implementation, synthetic and real loopback TLS qualification, exact replay and refusal receipts, complete lower-estate reconstruction, full repository regression, production build, and a content-addressed workflow artifact. The venue is the holder-controlled answer-desk estate above the authenticated transport. The target is safe rotation, bounded availability, deterministic rendezvous, and replayable dispatch. The upside is that a remote transition can remain attributable through certificate turnover and temporary transport loss. The downside is explicit certificate, endpoint, observation, and renewal administration plus append-only custody growth. The failure mode is accepting a certificate outside its issuer, usage, schedule, lineage, or retirement state; selecting a stale or mismatched route; silently failing over; reopening a completed dispatch; retaining secrets; or allowing operations evidence to impersonate task authority.

The control question is whether every dispatched remote transition can disclose which admitted certificate lineage, retirement state, lower actor registration, endpoint lease, live pinned observation, deterministic rendezvous, idempotency key, request, response, assignment or result, refreshed work-order head, and permanent settlement produced it, while certificate and endpoint operations remain unable to perform or authorize the underlying research, review, graph, canon, or answer task.
