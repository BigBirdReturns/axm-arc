# ASOIAF authenticated local credential broker service

## Purpose

The authenticated local credential broker service exposes the already qualified credential provider host through one bounded device-local IPC endpoint. It accepts a signed request envelope, verifies that the caller and payload match one retained service policy, executes exactly one provider-host operation, and returns a public provider invocation or result with a content-addressed service receipt.

The service does not choose research work, issue credentials, alter enrollment or deployment state, select a replacement credential, register a transport actor, schedule an answer worker, review evidence, reconcile canon, mutate the graph, or render an answer. It is an authenticated local execution boundary above the credential broker and provider host.

The first endpoint classes are:

* `unix:///absolute/socket/path` on Unix-like systems.
* `npipe://bounded-pipe-name` on Windows.

`loopback-https://` remains reserved for a separately qualified TLS listener. This module rejects that endpoint class rather than treating a TCP listener as equivalent to local IPC.

## Placement in the credential stack

The service is stacked above the following qualified parents:

1. Governed transport enrollment establishes issuer, requester, approval, issuance, and runtime-admission custody.
2. Credential deployment binds one non-exportable provider key to an exact device, service, certificate, activation, and deployment state.
3. The credential broker binds one exact active deployment to a local policy and produces content-addressed possession or mutual-TLS invocations.
4. The credential provider host executes one already selected broker invocation through a qualified native provider and returns public proof material.
5. This service authenticates the local caller, admits one transient payload against an exact signed envelope, invokes the provider host, and retains a safe request and receipt.

The service therefore controls local admission and execution only. Parent modules remain authoritative for enrollment, deployment, broker invocation construction, provider compatibility, key possession, server pins, and downstream broker admission.

## Actors and authority

The participating actors are the broker policy operator, provider-profile operator, local service-policy operator, authenticated local client, broker service process, credential provider host, native credential provider, credential key, device-agent key, lower HTTPS peer, and downstream broker verifier.

The service policy has `serviceAuthority=local-request-admission-only`. A signed request has `requestAuthority=caller-request-only`. A terminal receipt has `receiptAuthority=provider-execution-reference-only`. Service state has `stateAuthority=projection-only`. Every retained object also fixes:

```text
authority=none
graphEffect=none
canonEffect=none
answerEffect=none
```

A successful request proves that one authenticated local client asked the service to execute one exact payload against one exact provider profile. It does not prove that the task was correct, the answer was true, the evidence was sufficient, or the caller had authority outside the retained service policy.

## Retained service policy

A service policy binds:

* One exact broker policy identity and fingerprint.
* One exact provider profile identity and fingerprint.
* The provider profile's device, service, and qualified host kind.
* The broker policy's exact local endpoint.
* One client identity and one public SPKI.
* The derived client public-key fingerprint and signature algorithm.
* An explicit service-operation allowlist.
* A maximum signed-request lifetime.
* A maximum transient payload size.
* A maximum public response size.
* Creation time and operator identity.

Policy creation begins by running the complete broker and provider-host verifiers. The provider profile must bind the same broker policy. The service policy cannot predate either parent. The endpoint must parse as a normalized Unix socket or bounded Windows named pipe.

The retained policy contains no client private key, private-key path, provider selector, provider secret, request body, response body, certificate thumbprint, or provider executable input.

## Signed request envelope

The caller signs a content-addressed request envelope before opening the IPC connection. The envelope binds:

* Service policy identity and fingerprint.
* Broker policy identity and fingerprint.
* Provider profile identity and fingerprint.
* Local endpoint and endpoint kind.
* Client identity and public-key fingerprint.
* Service operation.
* Digest-only service idempotency key.
* Canonical transient-payload digest and byte count.
* Issue time and expiry.
* Signature algorithm, signature bytes, and signature digest.
* Explicit no-retention and no-authority declarations.

The payload itself is not included in the retained request object. The service reconstructs the canonical payload in memory, checks its exact field set, recomputes its digest and byte count, and refuses execution if either differs from the signed envelope.

The request must be issued on or after policy creation, remain within the policy lifetime ceiling, be live when received, use an allowed service operation, and verify under the exact client SPKI retained by policy.

## Transient payloads

The service supports three operations.

### `prepare-provider-invocation`

The transient payload identifies one existing broker invocation and supplies the provider-host idempotency key, preparation time, and expiry. The service fixes the provider profile from policy and derives the provider operator identity from the authenticated client and signed request. The caller cannot substitute another profile or arbitrary provider operator.

### `execute-possession`

For a `synthetic-fixture` profile, the payload carries one transient private-key PEM used only to qualify exact credential-key possession. For a `windows-cng` profile, the payload carries one transient CurrentUser certificate thumbprint. The host kind must equal the retained provider profile.

### `execute-transport`

For a `synthetic-fixture` profile, the payload carries a transient device-agent private key, lower request and response references, observed server pins, status, raw response bytes in base64, provider receipt digest, and execution times. The provider host hashes and bounds the response, produces the public transport statement, and does not retain the raw body.

For a `windows-cng` profile, the payload carries transient credential and device-agent certificate thumbprints, the raw request body in base64, and completion time. The provider host resolves non-exportable keys through Windows CNG, performs the pinned mutual-TLS request, bounds and hashes the response, discards the raw body, and returns a signed public result.

Transient payloads cross process memory and the local socket or named pipe. They are never written to the service estate. Operators should place `sign`, `dispatch`, or `invoke` input files in a protected ephemeral directory and delete them after use.

## Dispatch and replay

Dispatch proceeds in this order:

1. Acquire the service transaction lock.
2. Load the exact retained service policy.
3. Normalize and verify the complete signed request.
4. Normalize the transient payload and verify its operation, host kind, digest, and byte count.
5. Verify that the request is live at receipt time.
6. Refuse any service idempotency digest already bound to different request custody.
7. Retain the safe signed request by request fingerprint.
8. Refresh deterministic state so a later execution failure remains an explicit pending request.
9. Reuse an existing terminal receipt if the exact request already completed.
10. Execute the exact provider-host operation.
11. Bound and hash the public provider response.
12. Retain one content-addressed terminal receipt.
13. Refresh deterministic state and remove the transaction lock.

An exact retry returns the original request, receipt, and provider response without another provider operation. A changed payload, schedule, operation, policy, endpoint, client, signature, or idempotency key custody is refused.

If provider execution fails after request admission, the safe request remains retained without a receipt. `SERVICE-STATE.json` lists it under `pendingRequestIds`, and verification emits a `service-request-pending` notice. The service does not fabricate success or erase the authenticated attempt.

## Local IPC framing

Each connection carries one UTF-8 JSON object followed by one newline. The service accepts one frame per connection. It bounds the request frame before JSON parsing and bounds the response before writing. Empty frames, trailing second frames, malformed JSON, unsupported fields, oversized requests, and oversized responses are rejected.

On Unix, the endpoint must be one normalized absolute path. The service refuses to unlink an existing socket implicitly, including a stale socket, because silent unlinking could replace another process's endpoint. After binding, it sets the socket mode to `0600`. Normal shutdown removes the socket.

On Windows, `npipe://name` maps to `\\.\pipe\name`. The pipe name is limited to ASCII letters, numbers, periods, underscores, and hyphens. Cryptographic request authentication remains mandatory even though the transport is device-local.

The endpoint probe uses the same framing implementation with a digest-bound challenge and response. It retains neither request nor response body and has `probeAuthority=transport-health-only`.

## Service estate

The service estate is rooted at:

```text
answer-credential-broker-service/
  policies/
  requests/
  receipts/
  SERVICE-STATE.json
  .service-lock
```

Policy, request, and receipt files use digest-derived names and immutable create-or-exact-replay writes. State is an atomic deterministic projection over retained objects. The transaction lock must not remain after operation completion.

The verifier reconstructs:

* Complete broker and provider parent validity.
* Service policy identity, chronology, endpoint, client key, limits, and authority boundary.
* Request identity, policy custody, lifetime, signature, idempotency, digest-named path, and chronology.
* Receipt identity, request linkage, response digest and size, provider invocation or result equality, and one-receipt cardinality.
* Pending request notices.
* Deterministic state identity and exact reconstruction.
* Lock cleanup.
* Forbidden secret-bearing paths and retained content.

Forbidden service-estate content includes private keys, certificates, CSRs, PKCS#12 files, client private-key fields, credential or device-agent private-key fields, certificate thumbprints, raw request or response bodies, raw payload objects, and provider executable inputs.

## Command-line operator

The permanent operator is registered as:

```text
npm run asoiaf:answer-credential-broker-service -- <command>
```

Commands are:

```text
policy          Retain one authenticated local-service policy
sign            Build and sign one payload-digest-only request envelope
dispatch        Admit and execute one signed request in-process
serve           Listen on the policy's Unix socket or Windows named pipe
invoke          Send one signed request and transient payload to the service
probe-endpoint  Exercise bounded local framing
status          Read policies, requests, receipts, and deterministic state
verify          Reconstruct complete service custody
paths           Print service-estate paths
```

`policy`, `sign`, `dispatch`, `serve`, `invoke`, and `probe-endpoint` accept `--input <json>`. `status`, `verify`, and `paths` accept `--root <estate>`. Any command can write JSON through `--out <path>` where applicable.

A `serve` input may include `maxRequests`, `powershellExecutable`, `readyFile`, and `summaryFile`. The server also closes on `SIGINT` or `SIGTERM`.

## Refusal matrix

The implementation refuses:

* A broker or provider estate with verification errors.
* A provider profile bound to another broker policy.
* A service policy that predates either parent.
* A remote, malformed, relative, or unsupported endpoint.
* Implicit unlinking of an existing Unix socket.
* An unsupported client key type.
* An empty operation allowlist or limits outside hard ceilings.
* A request signed by another key or algorithm.
* A request that predates policy, exceeds its lifetime, or is not live when received.
* A request whose policy, parent, endpoint, client, operation, authority, or retention fields differ.
* A transient payload with missing, unknown, or extra fields.
* A payload whose canonical digest or size differs from the signed envelope.
* A host kind that differs from the provider profile.
* A changed request under one service idempotency digest.
* More than one terminal receipt for a request.
* A public provider response above the service response ceiling.
* A retained service transaction lock.
* Secret-bearing service files or fields.

## Qualification boundary

The permanent Linux qualification constructs governed enrollment and an active synthetic deployment through the parent operators, retains a broker policy and binding, retains a provider profile, creates one service policy, and then performs a real authenticated local IPC lifecycle. The fixture prepares and executes possession, admits the public proof to the broker, prepares and executes transport, admits the public transport result, and repeats the final signed request to prove exact replay without another provider execution.

The Linux fixture proves a `0600` Unix socket, bounded framing, four unique signed requests, four terminal receipts, two provider invocations, two provider results, one broker possession proof, one broker transport result, no pending requests, no retained transaction lock, and no ephemeral secret directory.

The Windows qualification performs a real named-pipe endpoint probe through the permanent operator and retains only a public no-authority probe receipt. The combined qualification requires the Linux and Windows candidate SHAs to match, scans the reconciled artifacts for secret material, and verifies a combined checksum ledger.

The evidence proves authenticated local execution custody. It does not qualify a loopback TLS listener, operating-system service installation, startup recovery, endpoint discovery, remote access, multi-client policy, provider-class expansion, service availability objectives, task authorization, or ASOIAF truth.

## Control question

Can every local credential operation identify the exact governed enrollment, active deployment, broker policy, broker binding, broker invocation, provider profile, authenticated client, signed service request, transient payload digest, provider invocation or result, terminal service receipt, and downstream broker admission while no service object acquires credential issuance, deployment, transport registration, scheduling, research, review, graph, canon, or answer authority?
