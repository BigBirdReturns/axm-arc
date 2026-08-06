# ASOIAF device-local credential provider host

The credential provider host is the native execution boundary above the governed credential broker. Enrollment determines which leaf may exist. Deployment determines which device, provider, and non-exportable key reference are active. The broker determines which exact possession or mutual-TLS invocation is authorized. The provider host performs only the native key operation already selected by those planes and returns public proof material that the broker can verify independently.

The provider host does not generate, export, approve, issue, install, activate, rotate, roll back, register, route, schedule, review, reconcile, or settle a credential or answer-work task. It cannot select a different deployment, broker binding, key, target, server pin, response ceiling, idempotency identity, or operation. Successful native execution is evidence of one provider operation, not evidence that the underlying answer task was authorized or completed.

## Supported host classes

The first provider-host version implements two host classes:

```text
synthetic-fixture
windows-cng
```

`synthetic-fixture` exists for deterministic qualification. Its private keys are supplied transiently to one process and are deleted before artifact construction. It is accepted only when the active deployment provider class is `synthetic-fixture`.

`windows-cng` operates a certificate and private key already installed in the Windows CurrentUser certificate store. The retained profile stores only SHA-256 digests of the credential and device-agent selectors. The raw thumbprints are supplied transiently at execution and must reproduce those digests exactly. The PowerShell adapter resolves `Cert:\CurrentUser\My\<thumbprint>`, requires `HasPrivateKey`, obtains the RSA or ECDSA key through the .NET certificate extension methods, signs in place, and disposes the key object. It contains no key-export operation.

Other qualified deployment classes remain explicit unimplemented boundaries:

```text
tpm2-pkcs11
pkcs11
secure-enclave
external-reference
```

Those classes require separately qualified native adapters rather than being routed through a misleading generic provider implementation.

## Provider profile

A profile is retained only after the complete broker verifier passes. It binds:

```text
exact broker policy identity and fingerprint
exact broker binding identity and fingerprint
exact deployment-state identity and fingerprint
device, service, and key-reference identities
provider class and host implementation
credential-selector SHA-256
device-agent-selector SHA-256
allowed credential-free HTTPS origins
response-size ceiling
creation time and operator
```

The profile refuses a host kind that does not match the active deployment provider class. It refuses a response ceiling above the broker policy. Target origins must be normalized credential-free HTTPS origins. The profile retains no certificate, private key, key path, raw provider selector, provider PIN, password, token, session, secret, or response body.

## Provider invocation

The provider invocation is a write-ahead execution request. It resolves one exact retained broker invocation and binds:

```text
provider profile identity and fingerprint
broker invocation identity and fingerprint
SHA-256 of the exact canonical broker invocation bytes
broker binding identity and fingerprint
operation
idempotency-key digest
preparation time and expiry
operator identity
network-authorized flag
```

A provider invocation cannot outlive the broker invocation and cannot exceed one hour. For mutual TLS, the target origin and response ceiling must remain inside the provider profile. The raw idempotency key is never retained.

One idempotency-key digest may identify one exact provider invocation. Reusing it with a changed broker invocation, profile, schedule, operation, or operator is a conflict. A retained invocation has no execution or task authority by itself.

## Possession execution

For `prove-possession`, the host signs the exact bytes returned by:

```text
serializeAsoiafAnswerCredentialBrokerInvocation(invocation)
```

The synthetic host derives the public SPKI from the transient private key and requires its SHA-256 to match the active deployment binding before signing. The Windows host requires the certificate-store leaf fingerprint to match the active deployment binding before accepting the signature.

The retained result contains:

```text
signature algorithm
signature bytes in base64
signature SHA-256
proof time
broker-compatible admission input
provider receipt digest
```

The result does not retain the private key, certificate, key path, raw selector, or provider secret. The broker remains responsible for verifying the signature against the deployment public key and retaining the governed possession proof.

## Mutual-TLS execution

A mutual-TLS provider invocation must reference a fresh broker possession proof from the same binding. The broker invocation fixes the method, target URL, request-body digest and byte count, lower idempotency-key digest, expected server certificate and issuer fingerprints, and response ceiling.

The synthetic host receives bounded public transport facts and a transient device-agent key, builds the exact broker transport statement, signs it, and returns broker-compatible admission input. It does not claim a live network transaction.

The Windows CNG host performs one real `HttpClient` request with the deployed client certificate selected from CurrentUser storage. It captures the observed server leaf and issuer certificates during TLS validation, requires their SHA-256 fingerprints to equal the broker pins, bounds the response bytes, computes the response digest, and discards the response body. The host then builds the exact broker transport statement and signs that statement with the separately selected device-agent certificate key.

The retained transport result binds:

```text
provider invocation and profile
possession proof
binding, device, provider, and handle digest
client certificate fingerprint
target and method
lower request and response identities and fingerprints
observed server certificate and issuer fingerprints
HTTP status
response byte count and SHA-256
provider receipt SHA-256
start and completion times
device-agent signature and SHA-256
broker-compatible admission input
```

The raw request body is supplied transiently and must match the broker digest and byte count. The raw response is never retained.

## Windows CNG adapter

The exact PowerShell adapter can be emitted with:

```bash
npm run asoiaf:answer-credential-provider-host -- powershell \
  --out asoiaf-answer-credential-provider-host.ps1
```

The script supports `sign` and `mutual-tls` commands. It uses only CurrentUser certificate-store selectors supplied in a temporary input file. The Node host writes the script and input into a process-private temporary directory and removes that directory in `finally` after execution.

The adapter supports RSA PKCS#1 SHA-256 and ECDSA SHA-256 keys. Unsupported key types are refused. A certificate without an accessible private key is refused. The implementation does not invoke `ExportPkcs8PrivateKey`, `ExportRSAPrivateKey`, `ExportECPrivateKey`, `ExportParameters`, PFX export, or any equivalent key-extraction operation.

## Append-only provider estate

The retained estate is:

```text
answer-credential-provider-host/
├── profiles/<sha256>.json
├── invocations/<sha256>.json
├── results/<sha256>.json
└── PROVIDER-STATE.json
```

Files use their complete content SHA-256 as portable names. Exact retries reuse the existing bytes. A changed object at the same digest-derived path is an immutable collision. One provider invocation may have one terminal result.

The state projection records, for each profile, the latest invocation and result identities and the latest public update time. It is rebuilt deterministically from the append-only records and has no provider, task, graph, canon, or answer authority.

## Verification

Provider verification begins with the complete broker verifier, which already begins with the complete deployment and enrollment custody. The provider verifier then reconstructs:

```text
profile-to-policy and profile-to-binding parity
profile-to-deployment-state parity
host-kind and provider-class compatibility
canonical broker-invocation byte digest
provider idempotency uniqueness
result-to-invocation and result-to-profile parity
credential possession signature against the deployment SPKI
device-agent transport signature against the deployment agent SPKI
one terminal result per provider invocation
deterministic state identity and fingerprint
digest-named paths
pending invocations
secret-bearing paths or retained content
no-authority fields
```

A prepared invocation without a result is a notice. A changed public signature, response digest, server pin, provider receipt, binding, profile, state, or retained file is an error. A secret-bearing file extension or recognizable key, certificate, provider-secret, or PKCS#11 URI in the provider estate is an error.

## Operator

The local operator is registered as:

```bash
npm run asoiaf:answer-credential-provider-host -- <command>
```

It exposes:

```text
profile
prepare
synthetic-proof
synthetic-transport
windows-proof
windows-transport
powershell
status
verify
paths
```

The synthetic execution inputs may contain transient qualification private keys. The Windows execution inputs may contain transient certificate-store thumbprints and request bytes. Those input files are outside the provider estate and must be removed by the caller after execution. The retained result contains only public proof and digest custody.

## Qualification boundary

The Linux qualification fixture constructs one governed enrollment and active synthetic deployment through the permanent parent operators. It retains one broker policy and binding, one provider profile, one possession broker invocation, one provider invocation and credential signature, one broker possession proof, one mutual-TLS broker invocation, one provider transport invocation and device-agent signature, and one admitted broker transport result. Every provider, broker, deployment, and enrollment verifier must return clean.

The focused suite proves:

```text
exact profile replay
exact provider-invocation replay
exact public-result replay
exact downstream broker-admission replay
selector and private-key non-retention
provider-class mismatch refusal
non-HTTPS target-origin refusal
idempotency-key conflict refusal
wrong transient credential-key refusal
result tamper detection
secret-path and secret-content detection
Windows CNG CurrentUser-store selection
absence of a Windows key-export path
```

The Windows qualification job creates one ephemeral non-exportable CurrentUser RSA certificate, emits the permanent adapter script, signs one bounded message through the store-backed key, verifies the public signature, and removes the certificate. The job proves native signing custody but does not claim production certificate issuance, machine-wide installation, service-account profile access, TPM attestation, fleet policy, or a deployed network endpoint.

The evidence tier is provider-host implementation, exact parent-custody integration, synthetic cryptographic lifecycle qualification, Windows CNG non-exporting signing qualification, complete repository regression, and production build. The venue is the device-local credential estate above the broker. The target is native use of an already governed and active credential rather than issuance, deployment, transport registration, scheduling, or ASOIAF truth. The upside is an unbroken, public-verifiable chain from deployment through native signing and pinned transport. The downside is provider-specific operating-system integration, transient selector and request handling, service-account certificate-store access, append-only provider growth, and a separately governed adapter for each additional provider class. The failure mode is exporting a key, retaining a selector or secret, selecting a different deployment, accepting the wrong server pin, replaying a changed invocation, or treating native key use as task authority.

The control question is whether every native credential operation can identify the exact broker invocation, active deployment, device, provider class, digest-bound selector, provider profile, idempotent provider invocation, public signature or attested transport result, and downstream broker admission while the host remains unable to choose, export, issue, deploy, register, schedule, review, reconcile, graph, canonize, or answer on behalf of the credential owner.
