# ASOIAF device-local credential broker

The device-local credential broker is the use boundary above governed enrollment and qualified non-exportable credential deployment. It does not generate a key, export a key, approve a certificate, issue a certificate, install a certificate, activate a deployment, register a transport actor, select a remote work item, or execute an answer-work transition. It binds the current active deployment projection to one local broker policy, prepares exact provider invocations, verifies cryptographic proof and device-agent attestations, and retains content-addressed replay custody for the result.

The broker exists because enrollment and deployment deliberately stop before private-key use. Enrollment proves which public key, policy, quorum, order, and externally issued leaf were governed. Deployment proves which device, provider, opaque key reference, installation, activation, predecessor, and rollback state are current. Neither plane should gain permission to invoke the private key merely because it can describe it. The broker therefore requires an explicit local policy and an exact binding to the active deployment state before preparing a use request.

## Actors and authority

The participating actors are:

```text
deployment verifier
  proves the current active credential deployment and key reference

local broker operator
  creates policy, binding, and invocation custody

hardware or provider adapter
  uses the non-exportable private key outside the retained estate

credential key
  signs the exact possession invocation

device agent
  attests the exact provider-backed transport result

lower authenticated transport
  retains its own request and response identities
```

The broker is not any of those actors. Its objects retain:

```text
authority = none
graphEffect = none
canonEffect = none
answerEffect = none
```

A broker policy has policy authority only. A deployment binding is reference-only. An invocation is a provider request only. A possession proof proves key possession only. A transport result is an attested reference to a lower transport transaction only. None of those objects can issue a certificate, mutate deployment state, register an actor, select work, validate evidence, reconcile canon, render an answer, or settle a lease.

## Local policy

A broker policy binds one broker identity, device, service, local endpoint, provider classes, operations, time ceilings, response-size ceiling, and device-agent verification key. Local endpoints are limited to:

```text
npipe://
unix://
loopback-https://
```

The policy cannot authorize a remote broker endpoint. It cannot carry a private-key path, raw provider handle, PIN, password, token, session, or provider secret. It must permit the provider class of the current deployment and at least one operation.

The supported operations are:

```text
prove-possession
mutual-tls-request
```

A policy limits invocation lifetime to at most one hour, possession-proof age to at most one day, and retained response metadata to at most 16 MiB. A narrower policy may impose smaller ceilings.

## Deployment binding

Binding begins by running the complete credential-deployment verifier. The broker then resolves the current service entry from `answer-credential-deployment/STATE.json` and requires exact parity across:

```text
deployment state identity and fingerprint
plan identity and fingerprint
activation identity and fingerprint
device identity and fingerprint
device-agent identity and public-key fingerprint
key-reference identity and fingerprint
provider class and opaque-handle digest
public-key fingerprint
certificate and issuer fingerprints
service, principal, actor role, and validity limit
```

The binding records no certificate bytes, private-key bytes, raw provider handle, or provider secret. It is valid only for the exact deployment state that existed at binding time. A later activation, rollback, state repair, or credential rotation changes the deployment projection. The old binding then becomes unusable for new invocations. The broker does not silently follow a service to a new credential.

## Provider invocation

Every invocation carries a SHA-256 digest of the raw idempotency key rather than the key itself. The digest is globally unique within the broker estate. Reusing the same raw key with different policy, binding, operation, payload, time, or operator custody is a conflict.

An invocation binds:

```text
policy and binding identities and fingerprints
deployment state identity and fingerprint
service, device, key reference, and provider
opaque-handle digest
certificate and public-key fingerprints
local broker endpoint
operation
idempotency-key digest
canonical request
creation and expiry times
operator identity
```

Invocation creation re-verifies the deployment estate and requires the bound plan and activation still to be current. The invocation may not predate the binding, outlive the certificate, or exceed the policy lifetime.

The canonical invocation bytes are the stable-key JSON encoding of the complete retained invocation. The provider or hardware adapter signs or acts on those exact bytes. A console message or generic provider success value is not admissible proof.

## Possession proof

A possession invocation carries only two digests:

```text
challengeDigest
contextDigest
```

The private key corresponding to the deployed public SPKI signs the exact canonical invocation bytes. The broker verifies that signature using the public key already retained in the deployment key reference. Supported algorithms remain aligned with governed enrollment:

```text
ed25519
ecdsa-sha256
rsa-sha256
```

The retained proof binds the invocation, policy, deployment binding, activation, key reference, certificate, public key, challenge, context, signature algorithm, public signature bytes, signature digest, proof time, and operator. Public signature material is retained because it is necessary for independent verification. The private key and provider handle remain outside the estate.

One possession invocation may have one terminal proof. Exact replay returns the same proof. A different signature, time, or operator under the same invocation is a conflict. A mutual-TLS invocation must name a verified proof for the same binding, and that proof must remain inside the policy’s age ceiling.

## Mutual-TLS request

A mutual-TLS invocation binds one lower operation without carrying the lower response body. Its canonical request includes:

```text
verified possession-proof identity and fingerprint
GET or POST method
credential-free HTTPS target URL
request-body digest and byte count
lower idempotency-key digest
expected server certificate fingerprint
expected server issuer fingerprint
response-byte ceiling
```

The broker does not retain the lower raw request body. It retains the digest and byte count needed to prove what was authorized. The remote URL must use HTTPS and may not contain credentials or a fragment.

The device-local provider performs the actual mutual-TLS transaction outside the broker estate. The broker does not open the network socket or load the private key. After the operation, the provider supplies lower request and response identities and fingerprints, observed server pins, HTTP status, response digest and byte count, provider-receipt digest, and start and completion times.

The result builder requires the observed server certificate and issuer to equal the invocation pins. The response must remain under the invocation and policy ceiling. The complete result statement also binds the possession proof, deployment binding, device, device agent, provider, opaque-handle digest, certificate, target, method, and lower idempotency-key digest.

The registered device agent signs the exact canonical result statement. This independent signature binds the provider assertion to the device and deployment custody. A provider result without the device-agent signature is not admissible. The retained result includes the public signature, signature digest, and verified result statement. It does not retain the certificate, private key, raw handle, provider secret, or raw response body.

## Append-only estate and replay

The broker estate is:

```text
answer-credential-broker/
├── policies/<sha256>.json
├── bindings/<sha256>.json
├── invocations/<sha256>.json
├── proofs/<sha256>.json
├── transport-results/<sha256>.json
└── BROKER-STATE.json
```

All ledger objects use digest-derived filenames and immutable create-or-exact-replay writes. The deterministic state projects, for every binding, the latest verified possession proof and latest attested transport result. State is rebuilt from append-only objects and written atomically. It does not select a current credential independently of deployment state.

A repeated exact policy, binding, invocation, proof, or result returns the retained bytes. Changed custody under the same broker identity, policy, idempotency key, invocation, or terminal result is refused.

## Verification

The verifier begins with the complete credential-deployment verifier. It then reconstructs:

```text
policy identities, endpoints, provider classes, operations, and fingerprints
binding parity with deployment plan, activation, device, and key reference
invocation parity with policy, binding, and idempotency uniqueness
possession signatures against the deployed public key
mutual-TLS proof linkage and age
result statements against invocation pins and limits
device-agent signatures against the deployed device key
one terminal proof or result per invocation
deterministic state projection
digest-named paths
pending invocations
secret-bearing filenames and contents
all no-authority declarations
```

A possession invocation without a proof and a mutual-TLS invocation without a result are notices rather than fabricated success. A changed deployment state blocks new use. Changed proof or result bytes, duplicate idempotency digests, stale state, wrong server pins, invalid signatures, missing lower identities, unsafe paths, or retained secret material are errors.

## Operator

The operator is registered as:

```bash
npm run asoiaf:answer-credential-broker -- <command>
```

It exposes:

```text
policy
bind
invoke
invocation-bytes
admit-proof
transport-statement
admit-transport
status
verify
paths
```

`invocation-bytes` emits the exact bytes the deployed credential must sign. `transport-statement` emits the exact bytes the device agent must sign. The operator does not sign either statement itself unless an external qualification fixture supplies an ephemeral key.

## Qualification boundary

Qualification first runs the permanent credential-deployment fixture to create one governed enrollment, one synthetic device-bound key reference, one installation, one activation, and one valid deployment state. It then retains one broker policy and binding, signs one possession invocation with the ephemeral qualification credential key, admits and exactly replays the proof, prepares one mutual-TLS invocation, signs one result statement with the ephemeral qualification device-agent key, admits and exactly replays the result, rebuilds state, and verifies the complete enrollment, deployment, and broker estate.

The focused refusal matrix covers:

```text
remote broker endpoints
provider classes outside deployment custody
changed idempotency-key custody
wrong credential-key signatures
stale possession proofs
wrong server certificate or issuer pins
wrong device-agent signatures
changed deployment state
changed proof bytes
state drift
secret-bearing paths and contents
authority leakage
```

The permanent workflow removes ephemeral certificate and key material before artifact construction. It retains only source-safe fixture inputs, public signatures, public fingerprints, digest-only handles, broker objects, lower transport references, verification reports, logs, boundary declarations, and `SHA256SUMS`.

The evidence tier is device-local use-protocol implementation, cryptographic possession and device-agent attestation qualification, exact replay, complete inherited enrollment and deployment verification, repository regression, production build, and artifact custody. The venue is the holder-controlled deployment estate on a separately qualified branch above credential deployment. The target is use of an already active non-exportable credential rather than key generation, certificate issuance, credential installation, runtime actor registration, remote scheduling, or ASOIAF truth. The upside is an unbroken reference chain from active deployment to exact provider invocation and attested lower transport result. The downside is provider-specific native execution outside this module, device-agent key custody, append-only result growth, and explicit rebinding after every deployment-state change. The failure mode is accepting a provider assertion without cryptographic proof, following a rotated credential silently, retaining a key or raw handle, trusting a wrong server pin, replaying changed payloads under one key, or treating successful use as task authority.

The control question is whether every credential use can identify the exact governed enrollment, active deployment state, device, provider, opaque key reference, local policy, binding, idempotent invocation, possession proof, device-agent attestation, and lower transport request and response while no broker object acquires private-key, enrollment, deployment, transport-registration, task, research, review, graph, canon, or answer authority.
