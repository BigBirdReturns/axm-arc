# ASOIAF Credential Broker Loopback Mutual-TLS Listener

## Purpose

The loopback mutual-TLS listener is a separately governed endpoint-admission and runtime-lifecycle boundary above the authenticated local credential broker service. It accepts the signed, payload-digest-bound request envelope qualified by the broker-service layer and carries that envelope across a pinned HTTPS connection on a literal loopback address. It does not choose a provider operation, issue a credential, create or alter a deployment, register an answer-work transition, schedule work, review evidence, reconcile canon, mutate a graph, or render an answer.

The listener exists because `loopback-https://` is not equivalent to a Unix-domain socket or Windows named pipe. TLS introduces server-certificate custody, client-certificate custody, certificate-authority trust, port ownership, endpoint leasing, handshake failure, restart recovery, and availability observation. Those powers require their own typed objects, verifier, lifecycle receipts, refusal tests, and qualification artifact.

## Actors and authority

The participating actors are:

- the credential deployment operator, which establishes the active non-exportable provider key reference;
- the credential broker operator, which binds the deployment to one broker policy and invocation;
- the provider-profile operator, which selects the already qualified local provider host;
- the broker-service policy operator, which registers the client signing identity and admitted operations;
- the transport certificate operator, which admits the server and client certificates without retaining certificate or key bytes;
- the endpoint-lease operator, which advertises one bounded HTTPS origin and accepted client CA;
- the listener-policy operator, which binds the broker-service policy to the exact endpoint and certificate admissions;
- the authenticated service client, which signs the broker-service request and presents the admitted TLS client certificate;
- the loopback listener process, which authenticates the TLS peer and delegates the signed request to the broker-service dispatcher;
- the provider host and native credential provider, which execute the already selected provider operation;
- the transport availability observer, which records whether the exact pinned endpoint completed mutual TLS.

The listener process is not any of those principals. A listener policy has `listenerAuthority=loopback-tls-admission-only`. A prepared session has `sessionAuthority=listener-start-intent-only`. A ready, stopped, or recovered lifecycle object has `lifecycleAuthority=listener-runtime-reference-only`. Listener state has `stateAuthority=projection-only`. Every retained listener object also fixes:

```text
authority=none
graphEffect=none
canonEffect=none
answerEffect=none
```

## Parent custody

A listener policy is admitted only after the complete broker-service and transport-operations verifiers pass. It binds the following exact parent objects and fingerprints:

1. One broker-service policy and its broker policy, provider profile, client identity, and client public-key fingerprint.
2. One transport endpoint lease with `networkScope=loopback`.
3. One server-auth certificate admission named by that endpoint lease.
4. One client-auth certificate admission issued under the endpoint lease's accepted client CA.
5. One client certificate principal and public-key fingerprint equal to the broker-service client identity and signing key.

The endpoint must be a credential-free HTTPS origin with an explicit port and the literal host `127.0.0.1` or `::1`. Hostnames, wildcard interfaces, unspecified addresses, inherited default ports, paths, queries, fragments, and non-HTTPS schemes are refused. The listener does not reinterpret a LAN, overlay, public, or manual endpoint as loopback merely because the URL happens to resolve locally.

## Retained objects

The listener estate is stored under:

```text
answer-credential-broker-loopback-tls/
  policies/
  sessions/
  lifecycle/
  LISTENER-STATE.json
  .listener-lock
```

Policies, sessions, and lifecycle receipts are immutable content-addressed JSON records. `LISTENER-STATE.json` is an atomic deterministic projection. `.listener-lock` is transient runtime exclusion state and must not survive a completed or recovered qualification.

The listener estate retains no certificate bytes, private keys, private-key paths, certificate paths, raw transient payloads, raw request bodies, or raw response bodies. It retains public certificate fingerprints, public-key fingerprints, parent identities, request-independent runtime counts, lifecycle times, and the digest of a stale lock when recovery occurs.

## Listener policy

A listener policy fixes:

- the broker-service policy identity and fingerprint;
- the underlying broker policy and provider profile custody inherited from that service policy;
- the endpoint lease identity and fingerprint;
- the server identity, base URL, literal loopback host, and explicit port;
- the server certificate admission, certificate fingerprint, and issuer fingerprint;
- the client certificate admission, certificate fingerprint, issuer fingerprint, and public-key fingerprint;
- the broker-service client identity and public-key fingerprint;
- maximum session lifetime;
- maximum wire-frame bytes;
- maximum public-response bytes;
- creation time and operator identity;
- explicit no-secret and no-task-authority declarations.

The listener policy cannot widen the request or response ceilings of the broker-service policy. The service client and TLS client must be the same cryptographic principal at the public-key layer. A valid TLS certificate for some other actor under the same CA is insufficient.

## Prepared sessions

A prepared session is a bounded start intent. It fixes one listener policy, one endpoint lease, one digest-only idempotency key, preparation time, expiry, and operator identity. The session must begin after the policy exists, remain within the endpoint lease, and remain within the listener policy's maximum session lifetime.

Exact replay of the same session input returns the original session. Reuse of the same idempotency key with changed policy, timing, or operator custody is refused. Preparation does not imply that a port was bound or a listener became available. An unstarted session appears as a verifier notice rather than being converted into a ready receipt.

## Runtime material validation

Certificate and key material enter the listener only as transient process inputs. Before binding the port, runtime requires:

- the supplied server certificate fingerprint to equal the endpoint lease pin;
- the supplied server private key to reproduce the certificate public-key fingerprint;
- the supplied client CA certificate fingerprint to equal the listener policy's accepted client issuer fingerprint;
- the session to be live at the proposed start time;
- the endpoint lease to be active at the proposed start time.

No runtime material is copied into the listener estate or included in lifecycle receipts.

## Mutual-TLS request admission

The TLS server uses TLS 1.2 or TLS 1.3, requires a client certificate, and rejects unauthorized chains. Chain authorization is necessary but insufficient. After the handshake, the listener compares both the peer certificate fingerprint and the peer public-key fingerprint with the exact client admission retained by listener policy.

Each TLS connection carries one bounded newline-delimited UTF-8 JSON frame in the existing broker-service wire format:

```json
{
  "format": "axm-asoiaf-answer-credential-broker-service-wire-request/1",
  "request": { "...": "signed broker-service request" },
  "payload": { "...": "transient operation payload" }
}
```

The listener requires the exact field set, applies the listener wire ceiling, and refuses trailing frames. It then delegates the request and payload to the qualified broker-service dispatcher. The dispatcher independently reconstructs the canonical payload bytes, checks the signed digest and byte count, verifies the client signature, checks chronology and liveness, rejects idempotency drift, and executes the exact provider-host operation.

A TLS handshake does not weaken the signed-request requirement. The TLS certificate authenticates the connection principal. The broker-service signature authenticates the request object and transient payload digest. Both checks must succeed.

## Exact replay

The listener does not create a second replay cache. Exact replay is governed by the broker-service estate. A repeated signed request with the same canonical payload returns the original retained request, terminal receipt, and public provider response without another provider-host execution. A changed request or payload under the same idempotency digest is refused.

Connection counts may increase on replay because a new TLS session occurred. Provider execution counts and retained service objects do not increase.

## Lifecycle receipts

### Ready

A `ready` lifecycle receipt is retained only after the process has successfully bound the exact host and port, validated runtime certificate material, resolved any prior interrupted session, written the current runtime lock, and entered authenticated request service.

A ready receipt does not claim that any request was served. It establishes bounded endpoint ownership for one prepared session.

### Stopped

A `stopped` lifecycle receipt records normal closure. It carries only:

- served connection count;
- admitted request-frame count;
- rejected connection or frame count;
- stop time and reason;
- exact policy, session, and endpoint identities.

A stopped receipt cannot carry certificate, key, payload, request-body, response-body, task, graph, canon, or answer authority.

### Recovered

A `recovered` lifecycle receipt closes a prior ready session whose process did not retain a stopped receipt. Recovery is admitted only after a later session has successfully bound the same exact port. Successful bind is the evidence that the prior process no longer owns the endpoint.

The later session records the prior session identity, its own recovery identity, recovery time, and the SHA-256 digest of any stale runtime lock. The stale lock is removed only after bind succeeds. The replacement lock is written only after prior active-session custody is reconstructed and closed.

A failed bind cannot erase a prior lock, close a prior session, or fabricate recovery.

## Deterministic state

`LISTENER-STATE.json` reconstructs, for each listener policy:

- latest prepared session;
- latest lifecycle receipt;
- sessions prepared but not started;
- ready sessions without a terminal receipt;
- stopped sessions;
- recovered sessions;
- projection update time.

The verifier rebuilds this projection from immutable records and requires byte-equivalent semantic content. More than one active session for one listener policy is an error.

## Availability observations

The `probe` command delegates to the qualified transport-operations probe. It performs a pinned mutual-TLS connection using the admitted client certificate and endpoint lease. The resulting observation records endpoint identity, server and client certificate fingerprints, timing, outcome, and public error classification. It retains no certificate or private key bytes.

An `available` observation establishes that the exact endpoint completed the pinned handshake at a stated time. It does not establish that a broker-service request was admitted, that a provider operation succeeded, or that any research, review, graph, canon, or answer transition occurred.

## Operator commands

The package registers:

```text
npm run asoiaf:answer-credential-broker-loopback-tls -- <command>
```

### Retain listener policy

```text
policy --input listener-policy-input.json --out listener-policy-result.json
```

### Prepare one listener session

```text
prepare --input listener-session-input.json --out listener-session-result.json
```

### Serve the exact endpoint

```text
serve \
  --root /holder/estate \
  --session-id <session-id> \
  --server-certificate /transient/server.crt \
  --server-key /transient/server.key \
  --client-ca-certificate /transient/client-ca.crt \
  --out listener-ready.json \
  --summary-out listener-summary.json
```

`serve` writes only public readiness and closure data. Certificate and key files remain caller-controlled transient inputs.

### Invoke one signed request

```text
invoke \
  --input signed-wire-input.json \
  --client-certificate /transient/client.crt \
  --client-key /transient/client.key \
  --server-ca-certificate /transient/server-ca.crt \
  --out public-response.json
```

The invocation input carries the loopback base URL, expected server certificate fingerprint, signed broker-service request, transient payload, and optional timeout or response ceiling.

### Probe availability

```text
probe \
  --root /holder/estate \
  --listener-policy-id <listener-policy-id> \
  --client-certificate /transient/client.crt \
  --client-key /transient/client.key \
  --server-ca-certificate /transient/server-ca.crt \
  --observed-at 2026-08-07T00:00:00.000Z \
  --out availability-observation.json
```

### Inspect and verify

```text
status --root /holder/estate
verify --root /holder/estate
paths --root /holder/estate
```

## Verification

The verifier reconstructs:

- the complete broker-service parent estate;
- the complete transport-operations parent estate;
- every listener policy identity and parent fingerprint;
- exact service-client and TLS-client principal parity;
- literal loopback URL and endpoint-scope constraints;
- session identity, idempotency, lifetime, and lease chronology;
- ready, stopped, and recovered lifecycle identity and cardinality;
- recovery relationships and chronology;
- deterministic listener state;
- absence of surviving runtime locks;
- absence of secret-bearing paths and content.

Prepared sessions and ready sessions without a terminal receipt are explicit notices. Invalid identities, duplicate terminal receipts, multiple active sessions, stale projections, retained locks, and secret material are errors.

## Operational boundary

This module qualifies an application-level loopback TLS listener. It does not install an operating-system service, configure automatic startup, manage service accounts, alter firewall rules, reserve a Windows HTTP namespace, create a launch daemon, rotate certificates, obtain certificates from an issuer, or supervise host reboot. Those powers belong to separately qualified installation and host-custody planes.

The evidence tier for this module is typed implementation, exact certificate and endpoint binding, real mutual-TLS execution, signed request verification, exact replay, lifecycle reconstruction, restart recovery, pinned availability observation, inherited broker and provider verification, repository regression, production build, artifact secret exclusion, and checksum-bound custody. The target remains endpoint admission and runtime lifecycle around an already selected provider-host operation. The failure mode is accepting the wrong peer, binding beyond loopback, executing payload bytes outside the signed digest, erasing prior custody without successful bind, retaining certificate or key material, or treating availability as task authority.

The controlling question is whether every loopback TLS request can identify the exact broker-service policy, endpoint lease, server certificate admission, client certificate admission, listener policy, prepared session, authenticated peer, signed service request, provider result, lifecycle receipt, and availability observation while no listener object acquires certificate issuance, deployment, scheduling, research, review, graph, canon, or answer authority.
