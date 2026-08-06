# ASOIAF answer transport credential deployment

The credential-deployment plane installs and activates an already governed transport certificate against an already existing device-bound private key. It begins only after the enrollment plane has retained a valid issuance receipt, and it ends before runtime admission, endpoint availability, rendezvous, or answer-work dispatch. It does not generate, export, approve, issue, admit, register, route, or use a credential on behalf of the actors that own those transactions.

The deployment estate retains public verification material, digest-only provider custody, signed device receipts, signed private-key possession proofs, bounded rollback receipts, and a deterministic current-state projection. Certificate and issuer bytes are parsed transiently during installation and are not written to the estate. Private keys, raw provider handles, provider PINs, passwords, tokens, sessions, and provider configuration are never accepted as retained fields.

## Actors and authority

The plane distinguishes five actors:

```text
enrollment issuer and approvers   govern one externally issued leaf
credential provider               owns one non-exportable private key
device agent                      attests installation, activation, and rollback
credential key                    proves possession during activation
deployment operator               submits bounded local transactions
```

The device agent does not become the credential key. The credential key does not become the device agent. The deployment operator does not become either signer. An installation receipt proves that the agent observed one certificate and provider receipt on one device. An activation receipt additionally proves that the private key corresponding to the issued certificate was usable for the exact activation statement.

Every retained object fixes:

```text
authority = none
graphEffect = none
canonEffect = none
answerEffect = none
```

More specific authority fields remain narrow, such as `device-custody-only`, `opaque-key-reference-only`, `plan-only`, `verified-installation-only`, `verified-device-and-key-use-only`, `restore-predecessor-reference-only`, and `projection-only`. None can issue a certificate, create a runtime admission, select a network route, dispatch answer work, review evidence, reconcile canon, or render an answer.

## Device registry

A device record binds one device-agent identity and public verification key to:

```text
platform
trust domain
allowed provider classes
registration time
operator identity
```

Supported platforms are:

```text
windows
linux
macos
appliance
synthetic
```

Supported provider classes are:

```text
windows-cng
tpm2-pkcs11
pkcs11
secure-enclave
external-reference
synthetic-fixture
```

The registry stores the agent public SPKI, public-key fingerprint, and key type. It declares that no agent private key or raw agent-key reference was retained. Re-registering the same agent or trust-domain key requires exact byte agreement with the existing content-addressed record.

## Opaque key references

A key reference binds one device to one provider class, provider key identity, provider-handle SHA-256, public SPKI and fingerprint, custody class, and registration time. The private key must be non-exportable. The provider class must be allowed by the device record. The public key must meet the same RSA, EC, or Ed25519 strength rules used by the enrollment plane.

The retained object does not contain the provider handle. `providerHandleDigest` names the opaque provider custody without disclosing a PKCS#11 URI, CNG key name, Secure Enclave reference, PIN, token, or session. A device cannot retain two conflicting references for the same provider key identity, handle digest, or public-key fingerprint.

## Deployment plans

A deployment plan binds one exact enrollment issuance receipt and optional runtime-admission link to one device and key reference. It retains:

```text
service identity
device and key-reference identities and fingerprints
provider class and handle digest
issuance policy, request, order, and receipt custody
certificate, issuer, and public-key fingerprints
certificate usage, principal, and external actor role
certificate validity
optional runtime-admission reference
installation and activation schedule
rollback deadline
predecessor retirement boundary
```

The enrollment receipt must pass its permanent fingerprint and authority checks. Its public-key fingerprint, custody class, handle digest, and non-exportability declaration must match the registered key reference. The optional admission link must match the issuance receipt exactly. The deployment plan does not create or verify a runtime admission; it merely retains a reference supplied by the separately qualified enrollment plane.

An initial plan cannot name a predecessor. A successor plan must name one exact predecessor plan and activation. It must preserve device, service, certificate usage, principal, and actor role; use a different certificate; carry the predecessor certificate fingerprint in the governed issuance; and activate while the predecessor remains within the declared overlap interval. A predecessor activation that has already been rolled back cannot become the basis of a new successor.

The schedule must be monotonic and remain inside both the issued certificate validity and the governed enrollment operating schedule:

```text
createdAt <= plannedInstallAt <= plannedActivateAt
plannedActivateAt < rollbackUntil <= retirePredecessorAfter
```

## Installation proof

`prepare-installation` emits the canonical device-agent statement. It binds:

```text
plan, device, and key-reference fingerprints
provider class and opaque-handle digest
service identity
certificate, issuer, and public-key fingerprints
provider-receipt digest
installation time
secret-exclusion declarations
```

The provider receipt is represented only by SHA-256. The device agent signs the canonical statement outside the deployment estate.

`admit-installation` verifies the agent signature and transiently parses the issued certificate and issuer. It requires:

```text
issuer is a CA
leaf is signed by the exact issuer
leaf is not a CA
certificate, issuer, and public-key fingerprints match the plan
subject, SANs, serial, and validity match the issuance receipt
required client-auth or server-auth extended-key usage is present
installation time is inside certificate validity and the planned schedule
```

The resulting receipt retains certificate metadata and the public signature. It does not retain certificate bytes, certificate paths, private keys, private-key paths, raw provider handles, or provider secrets.

## Activation proof

`prepare-activation` emits one challenge-bound statement shared by both signers. It binds the plan, installation, device, key reference, provider, service, certificate, public key, predecessor, challenge digest, activation time, and rollback deadline.

The credential key signs the canonical statement to prove possession of the deployed private key. The device agent signs the same bytes to prove that the operation occurred in the registered device and provider context. `admit-activation` verifies both signatures independently. A valid agent signature cannot substitute for the credential-key signature, and a valid credential-key signature cannot substitute for device attestation.

Activation requires a retained installation, exact plan and installation equality, the planned activation time, and an unused activation identity. Exact replay returns the retained activation. Conflicting signatures, challenge, operator, or retained bytes are refused.

## Successor rollback

Rollback is available only to a successor plan with an exact predecessor plan and activation. `prepare-rollback` binds the failed successor activation, exact predecessor activation, service, failed and restored certificate fingerprints, provider-receipt digest, rollback time, and reason digest.

Rollback must occur after successor activation and no later than the plan’s rollback deadline. The device agent signs the canonical rollback statement. A valid rollback does not delete the successor installation or activation. It appends a receipt and projects the named predecessor activation as the current service state. A failure after the rollback deadline requires a new governed plan rather than an implicit fallback.

## Append-only estate and state projection

The estate is:

```text
answer-credential-deployment/
├── devices/<sha256>.json
├── keys/<sha256>.json
├── plans/<sha256>.json
├── installations/<sha256>.json
├── activations/<sha256>.json
├── rollbacks/<sha256>.json
└── STATE.json
```

Each record filename is the hexadecimal part of its content fingerprint. Exact retries require exact bytes. Conflicting content at an existing digest path is an integrity error.

`STATE.json` is regenerated atomically from activation and rollback events. For each service, the latest ordered event selects one activation. A rollback event selects the exact predecessor activation named in the rollback statement. The state records the service, device, plan, activation, certificate, and key-reference identities and fingerprints, the event origin, and the event time. State has projection authority only and cannot activate or roll back a credential by itself.

## Verification

The verifier reconstructs the complete estate and checks:

```text
device and key registration identities and fingerprints
public SPKI decoding and fingerprint parity
provider-class and custody restrictions
issuance and admission-link custody
initial and successor continuity
plan schedules and certificate bounds
installation statement, certificate metadata, and agent signature
activation statement, key signature, and agent signature
rollback window, predecessor continuity, reason, and agent signature
one terminal record for each content identity
deterministic state identity, fingerprint, and projection
digest-named files
secret-bearing paths and contents
pending installation or activation notices
all authority fields
```

A tampered plan invalidates downstream installations and activations that bind it. A stale state file produces a state identity, fingerprint, or projection error. A plan without installation is a notice. An installation without activation is a notice. Certificate, CSR, PEM, private-key, provider-secret, raw-handle, PIN, password, token, or session material is an error wherever it appears under the deployment root.

## Operator

The local operator is registered as:

```bash
npm run asoiaf:answer-credential-deployment -- <command>
```

It exposes:

```text
register-device
register-key
plan
prepare-installation
admit-installation
prepare-activation
admit-activation
prepare-rollback
rollback
status
verify
paths
```

The prepare commands return canonical signing bytes in base64 plus their SHA-256. Signing happens outside the operator. Admission inputs may reference transient certificate, issuer, public-key, or signature files, but those paths and bytes are not copied into retained records.

## Qualification boundary

The permanent qualification fixture creates one ephemeral CA, one Ed25519 device-agent key, and two RSA credential keys only in runner temporary storage. Through the governed enrollment API it produces an initial leaf and a successor leaf whose issuance names the predecessor certificate. It then exercises the deployment operator from a clean estate:

```text
register and exactly replay one device
register and replay the initial key reference
plan and replay the initial deployment
prepare, admit, and replay installation
prepare, admit, and replay activation
register and replay the successor key reference
plan and replay the successor deployment
prepare, admit, and replay successor installation
prepare, admit, and replay successor activation
prepare, retain, and replay bounded rollback
reconstruct status and verify the estate
```

The final state must select the initial activation with `stateOrigin=rollback`. The estate must contain one device, two key references, two plans, two installations, two activations, one rollback, and one active service projection. The verifier must report zero errors, warnings, and notices after the complete lifecycle.

Focused adversarial qualification also proves exportable-key refusal, disallowed-provider refusal, certificate substitution refusal, invalid device signature refusal, invalid credential-key signature refusal, successor discontinuity refusal, late rollback refusal, tamper detection, and secret-file detection. Strict TypeScript, the downstream focused stack, the complete repository regression, and the production build must pass on the exact carrier-free candidate.

The evidence tier is typed deployment implementation, transient certificate verification, independent device and key signatures, synthetic provider lifecycle qualification, command-line exact replay, complete regression, and exact-head artifact custody. The venue is a draft stacked directly above governed enrollment. The target is installation and activation of an already issued leaf against an already existing non-exportable key rather than certificate issuance, runtime transport, or answer execution. The upside is exact device, key, plan, installation, activation, rollback, and service-state custody without key export. The downside is provider-specific external operation, device-agent key custody, append-only record growth, and separate runtime-admission and availability transactions. The failure mode is accepting a wrong certificate or key, retaining a raw handle or secret, allowing one signer to impersonate the other, silently falling back after the rollback window, or treating successful installation as transport or answer-work authority.

The control question is whether every active transport credential can disclose which governed enrollment, externally issued leaf, device, non-exportable key reference, provider, signed installation, credential-key proof, device-agent attestation, predecessor, rollback window, and deterministic state produced it, while the deployment plane remains unable to generate, export, approve, issue, admit, route, or use that credential for an answer-work task.
