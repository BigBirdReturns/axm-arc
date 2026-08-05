# Authenticated ASOIAF answer-desk transport

## Classification

This layer places an authenticated network boundary above the qualified typed external exchange. The exchange already proves that one named actor may receive one exact leased assignment, return one typed result, and advance the persistent desk only through the permanent work-order and settlement validators. This transport determines which remote certificate is allowed to act as that named actor, carries only the two exchange transactions needed across a machine boundary, and retains replayable request and response custody.

It does not perform acquisition, private search, edition resolution, evidence review, reconciliation, continuity adjudication, gap closure, answer assembly, answer verification, or rendering. It does not grant a certificate, HTTP request, transport receipt, or successful TLS handshake any graph, canon, answer, or underlying task authority.

The boundary is standard mutual TLS plus a holder-controlled certificate-fingerprint registry. Certificate issuance, CA custody, private-key storage, renewal, rotation scheduling, endpoint publication, NAT traversal, load balancing, and distributed failover remain operator responsibilities outside this implementation.

## Trust model

The server is configured with:

```text
one answer-desk estate root
one server certificate and private key
one trusted client-certificate authority
requestCert=true
rejectUnauthorized=true
TLS 1.2 or newer
```

A client must first complete mutual TLS under the configured client CA. The server hashes the authenticated leaf certificate’s DER bytes with SHA-256 and resolves the resulting fingerprint through the local actor registry. The HTTP body cannot provide or replace the actor identity, actor role, estate root, operator identity, certificate fingerprint, lease, action, or accepted result-kind registry.

The actor registry retains only:

```text
certificate SHA-256 fingerprint
actor identity
external actor role
registration time
operator identity
content-derived registration identity and fingerprint
```

The certificate bytes and private key are not copied into the answer-desk estate. A certificate fingerprint maps to exactly one immutable actor registration. A different actor, role, registration time, or operator for the same fingerprint is an immutable collision rather than a remap.

A revocation is a separate immutable record bound to the exact registration. Once a revocation file exists, that certificate can no longer create or replay a network transaction. Rotation therefore means registering a new certificate fingerprint and revoking the old fingerprint. Re-registration of the revoked fingerprint is refused.

## Permanent storage

The transport adds four append-only directories beneath the existing holder-controlled estate:

```text
answer-transport/actors/<certificate-sha256>.json
answer-transport/revocations/<certificate-sha256>.json
answer-transport/requests/<idempotency-key-sha256>.json
answer-transport/responses/<request-fingerprint-sha256>.json
```

Every filename is portable and digest-named. The registry retains no certificate or private-key payload. Request records retain no raw idempotency key. They retain only its SHA-256 digest.

## Narrow remote interface

The server exposes exactly two versioned transactions:

```text
POST /v1/assignments/issue
POST /v1/results/admit
```

Both require `Content-Type: application/json` and one `Idempotency-Key` header containing 16 through 256 visible ASCII characters. Query strings, other methods, and other routes are refused.

The assignment issue body contains only:

```json
{
  "itemId": "optional exact item identity or null",
  "claimedAt": "RFC 3339 timestamp",
  "issuedAt": "RFC 3339 timestamp or null",
  "leaseMilliseconds": 600000
}
```

The result admission body contains only:

```json
{
  "assignmentId": "exact retained assignment identity",
  "completedAt": "RFC 3339 timestamp",
  "outcome": "satisfied | preserved-as-limitation | refused | failed | cancelled | expired | stale",
  "afterWorkOrder": "qualified refreshed work order or null",
  "resultReferences": [],
  "reason": "substantive actor reason"
}
```

Fields such as `root`, `actorId`, `actorRole`, and `operatorId` are forbidden. Unknown fields are refused before request custody is created. Automatic `render-reviewed-answer` work remains outside the transport because it belongs only to the qualified built-in reviewed renderer.

## Authenticated request custody

For each accepted remote transaction, the server constructs an immutable request record binding:

```text
operation, method, and route
idempotency-key digest
authenticated peer-certificate fingerprint
exact actor registration identity and fingerprint
resolved actor identity and role
server receipt time
canonical body digest and normalized body
privateTextIncluded=false
sourceTextIncluded=false
authority=none
graphEffect=none
canonEffect=none
answerEffect=none
```

The request identity and fingerprint are content-derived. A raw idempotency key is never retained.

The idempotency-key namespace is deliberately global to the estate. Reusing one key with a different certificate, actor, route, method, or body is refused. An exact retry resolves the existing request’s original receipt time and bytes rather than constructing a second request.

Untrusted TLS peers are rejected during the TLS handshake. A client certificate signed by the trusted CA but absent from the actor registry is rejected before request custody. A revoked certificate is also rejected before request custody. These authentication failures cannot create leases, assignments, results, settlements, transport requests, or transport responses.

## Exchange execution and response custody

After retaining the authenticated request, the transport invokes the permanent exchange operation with the actor identity and role derived from the certificate registration.

For assignment issuance, the transport supplies:

```text
fixed estate root from server configuration
requested item and lease timing from the normalized body
authenticated actor identity and role
transport-derived operator identity
```

For result admission, the transport supplies:

```text
fixed estate root from server configuration
assignment, completion, outcome, refreshed head, references, and reason from the normalized body
authenticated actor identity and role
transport-derived operator identity
```

The underlying exchange still resolves the retained lease and assignment itself, validates accepted result kinds, previews the permanent settlement, and requires the persistent settlement to equal that preview byte for byte. The transport cannot replace any of those controls.

The response record binds the exact request, authenticated actor, completion time, success or refusal outcome, HTTP status, payload kind, payload fingerprint, exact lower-layer payload or bounded refusal message, and the same zero-authority fields.

An exchange-level refusal from an otherwise authenticated request is retained as one `409` response. This makes role mismatch, unavailable work, stale custody, rejected result kinds, or invalid refreshed heads deterministic and replayable rather than dependent on mutable later state.

## Crash and concurrency behavior

The request file is retained before the exchange operation. The response file is retained after the exchange operation.

If the process stops after request custody but before exchange execution, an exact retry executes that retained request. If it stops after the lower exchange mutation but before response custody, an exact retry re-enters the existing PR #253 replay boundary. Assignment issuance resolves the retained lease and assignment rather than reopening claim creation. Result admission resolves the retained result and settlement rather than reopening terminal settlement creation.

Request files use immutable create-or-exact-replay semantics. Response files use one canonical response per exact request. Concurrent exact retries may both reach a replay-safe lower transaction, but only one response file can be created. The other caller reads and returns the already retained valid response.

Different idempotency keys remain different attempts. They may race for the same work item, in which case the persistent desk’s atomic lease and settlement rules determine which request succeeds and which authenticated request receives a retained refusal.

## Verification

The transport verifier begins with the complete external exchange verifier, which already includes the worker and persistent desk verifiers. It then reconstructs:

```text
actor registration format, identity, fingerprint, role, and key-retention boundary
one registration per certificate fingerprint
revocation-to-registration custody and monotonic time
request format, identity, fingerprint, route, method, body digest, and actor registration
request acceptance before any applicable revocation
one response per request
response format, identity, fingerprint, payload, error, and authenticated actor
successful assignment response to retained assignment custody
successful result response to retained result and settlement custody
pending requests that can be recovered by exact replay
digest-named actor, revocation, request, and response files
```

A request without a response is a warning because exact replay may recover it. A response without a request is an error. A successful issue response whose assignment is absent or differs from the persistent exchange is an error. A successful admission response whose result or settlement is absent or differs from persistent custody is an error. Changed actor, request, response, body-digest, authority, or filename bytes produce deterministic findings.

## Operator interface

The operator is registered as `npm run asoiaf:answer-transport -- ...`.

Compute a certificate fingerprint:

```bash
npm run asoiaf:answer-transport -- fingerprint \
  --certificate client.crt
```

Register an actor locally:

```bash
npm run asoiaf:answer-transport -- register \
  --root .asoiaf-answer-desk \
  --certificate client.crt \
  --actor-id actor:exact-locator-reviewer \
  --actor-role exact-locator-reviewer \
  --registered-at 2026-08-05T06:00:00.000Z
```

Run the mutual-TLS server:

```bash
npm run asoiaf:answer-transport -- serve \
  --root .asoiaf-answer-desk \
  --host 127.0.0.1 \
  --port 8443 \
  --server-certificate server.crt \
  --server-key server.key \
  --client-ca-certificate actor-ca.crt
```

Issue an assignment remotely:

```bash
npm run asoiaf:answer-transport -- issue \
  --url https://answer-desk.example:8443 \
  --client-certificate reviewer.crt \
  --client-key reviewer.key \
  --ca-certificate server-ca.crt \
  --idempotency-key review-locator-20260805-0001 \
  --input issue-body.json
```

Admit a result remotely:

```bash
npm run asoiaf:answer-transport -- admit \
  --url https://answer-desk.example:8443 \
  --client-certificate reviewer.crt \
  --client-key reviewer.key \
  --ca-certificate server-ca.crt \
  --idempotency-key admit-locator-20260805-0001 \
  --input result-body.json
```

Revoke a certificate locally:

```bash
npm run asoiaf:answer-transport -- revoke \
  --root .asoiaf-answer-desk \
  --certificate reviewer.crt \
  --revoked-at 2026-08-05T07:00:00.000Z \
  --reason "The actor certificate was rotated and must not authenticate another transaction."
```

Inspect and verify:

```bash
npm run asoiaf:answer-transport -- status \
  --root .asoiaf-answer-desk

npm run asoiaf:answer-transport -- verify \
  --root .asoiaf-answer-desk

npm run asoiaf:answer-transport -- paths \
  --root .asoiaf-answer-desk
```

## Qualification boundary

The focused suite uses synthetic certificate fingerprints without generating or retaining key material. It proves certificate-bound actor derivation, exact issue replay, global idempotency-key conflict refusal, unregistered and revoked actor refusal before request custody, authenticated role-mismatch refusal without lease creation, missing-response recovery through the lower replay boundary, two authenticated external transitions followed by automatic rendering, forbidden actor and root fields, and tamper detection across registrations, requests, and responses.

The permanent workflow adds a real loopback mutual-TLS transaction using ephemeral OpenSSL material generated only inside the runner. It creates one CA, one server certificate, two registered client certificates for different roles, one trusted-but-unregistered certificate, and one certificate under an unrelated CA. It proves:

```text
no-client-certificate TLS refusal
untrusted-client-certificate TLS refusal
trusted-but-unregistered actor refusal
registered exact-locator reviewer assignment and result transition
exact network replay under one idempotency key
registered answer assembler assignment and result transition
automatic reviewed rendering remains local to the worker
certificate revocation blocks a later network transaction
final desk, worker, exchange, and transport reconstruction
```

The generated private keys and certificates are not copied into the qualification artifact. The artifact retains only bounded command outputs, fingerprints, status, verification, refusal observations, and SHA-256 inventory.

The evidence tier is mutual-TLS mechanism qualification, certificate-fingerprint actor custody, synthetic unit qualification, exact-head command-line lifecycle qualification, and complete repository regression. The venue is the holder-controlled answer desk above the typed external exchange. The target is authenticated and replay-safe assignment and result transport across a machine boundary. The upside is that remote actor identity is derived from a trusted certificate and immutable local registration while every state transition remains governed by the permanent exchange, lease, work-order, and settlement validators. The downside is operator-managed PKI, explicit certificate registration and revocation, append-only transport growth, and one configured estate endpoint. The failure mode is accepting an untrusted, unregistered, revoked, body-declared, role-mismatched, idempotency-conflicting, or replay-mutated actor transaction, or allowing the transport receipt to substitute for the authority of the underlying task.

The control question is whether every remote transition can disclose which trusted certificate, actor registration, idempotency key digest, authenticated request, exact assignment or result, persistent settlement, and replay decision produced it, while neither TLS nor HTTP acquires the research, review, graph, canon, or answer authority of the work it carries.
