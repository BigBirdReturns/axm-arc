# ASOIAF answer transport enrollment and issuer governance

The answer transport enrollment plane governs the interval before a certificate may enter the qualified runtime operations estate. It proves possession of the proposed public key, binds the requested actor or server identity, records the declared key-custody class, obtains signed approvals from an issuer policy quorum, authorizes exactly one bounded leaf certificate, verifies the externally issued certificate, and emits one admission instruction for the existing transport-operations actor.

Enrollment does not run a certificate authority and does not retain a signing key. It does not register the resulting certificate with the runtime transport by itself. The issuer remains an external cryptographic actor, and the qualified transport-operations plane remains authoritative for admission, activation, rotation, endpoint selection, availability, retirement, and dispatch. This plane retains the governance objects needed to prove why one exact leaf was eligible to be issued and later presented for runtime admission.

Every enrollment object retains:

```text
authority = none
graphEffect = none
canonEffect = none
answerEffect = none
```

The issuer policy alone carries `issuanceAuthority=policy-only`. A quorum-approved order carries `issuanceAuthority=authorize-one-leaf`. A verified receipt carries `issuanceAuthority=verified-issued-leaf`. These labels describe certificate-governance custody only. They do not grant source, task, review, reconciliation, graph, canon, answer, network, endpoint, or automatic-renderer authority.

## Holder-controlled estate

The enrollment estate is append-only and digest-named:

```text
answer-transport-enrollment/
  policies/<sha256>.json
  requests/<sha256>.json
  approvals/<sha256>.json
  orders/<sha256>.json
  issuances/<sha256>.json
  admission-links/<sha256>.json
```

The estate retains public certificates only as digests and parsed metadata. It retains requester and approver public keys in SPKI form because later verification must reproduce proof-of-possession and approval signatures. It does not retain an issuer certificate body, issued leaf body, private key, private-key path, raw HSM or agent handle, certificate-signing request, PKCS#12 bundle, TLS session, or signing service credential.

The verifier rejects `.key`, `.pem`, `.p12`, `.pfx`, and `.csr` paths and scans bounded text files for private-key and certificate-request PEM blocks. The declared key reference enters custody only through a SHA-256 digest. An optional attestation URI may identify a holder-controlled evidence object, while the raw provider handle remains absent.

## Issuer policy

An issuer policy binds one exact certificate-authority fingerprint and public-key fingerprint to:

```text
issuer identity and validity interval
permitted client-auth and server-auth usages
permitted external actor roles
permitted principal prefixes
permitted key-custody classes
whether exportable private keys are allowed
maximum leaf, request, and order lifetimes
minimum declared renewal overlap
ordinary approval threshold and required roles
emergency approval threshold and required roles
named approver identities, roles, and public keys
creation time and operator identity
```

Approver identities and public-key fingerprints are unique. The verifier reparses every retained SPKI key, checks supported key strength, recomputes the public-key fingerprint and type, validates both thresholds against the approver population, and proves that each required approval role exists in the registry.

The external actor-role registry is closed over the ten exchange roles inherited from the qualified worker and exchange planes. The local automatic `reviewed-renderer` is excluded. Policy creation, proof construction, admission-link normalization, and later verification all reject a role string outside that closed registry, including values supplied through untyped JSON.

The policy may set a shorter leaf lifetime, but it may not authorize more than 398 days. That ceiling is inherited from the qualified transport-operations admission contract, so an enrollment policy cannot approve a leaf that its only downstream runtime is required to refuse.

The policy does not retain the issuer certificate. Policy creation parses the operator-supplied certificate transiently, verifies that it is a certificate authority, binds its subject, validity, certificate digest, and public-key digest, then discards the bytes.

## Proof of possession

A requester first constructs a canonical proof statement. The statement binds:

```text
exact policy identity and fingerprint
principal identity
client-auth or server-auth usage
external actor role when client-auth applies
initial, renewal, or emergency-recovery mode
proposed public-key fingerprint
requested subject and subject alternative names
requested certificate validity bounds
activation, renewal, and retirement schedule
predecessor certificate when renewal or recovery applies
key-custody class and attestation digests
nonce digest
request creation and expiry times
requester identity
```

The operator exposes the canonical signing bytes without receiving a private key. The requester signs those bytes using the proposed key. Supported proof algorithms are RSA with SHA-256, ECDSA with SHA-256, and Ed25519. The algorithm must match the retained public-key type. RSA keys must be at least 2,048 bits, and EC keys must use an admitted curve.

Submission rebuilds the proof statement from the supplied request fields, verifies the signature against the proposed public key, checks the policy and schedule, and retains the request with `proofVerified=true`. The public key is retained for later verification. The private key and private-key path remain absent.

An exact request retry reuses the same digest-named file. Changed proof bytes, request fields, key material, custody declarations, or schedule produce a different object or a signature failure rather than reopening the first request.

## Approval quorum

Each policy approver signs a canonical terminal decision for one exact request. The signed statement binds the policy and request fingerprints, approver identity and role, `approve` or `reject`, decision time, and a digest of the substantive reason. The retained approval includes the reason, signature algorithm, signature bytes, signature digest, and the assertion `signatureVerified=true`.

One approver may retain only one terminal decision for one request. A changed second decision is refused. Any retained rejection blocks order compilation. Ordinary issuance requires the ordinary threshold and every ordinary required role. Emergency recovery requires the higher emergency threshold and every emergency role, including the configured security role.

The verifier does not trust the order's approval summary. It independently verifies every approval signature and reason digest, checks role and key parity against the policy, reconstructs the set of decisions effective at the order time, rejects duplicate approvers or retained rejections, recomputes the applicable threshold and required roles, and compares the exact approval identities, fingerprints, and roles with the order.

## One-leaf issuance order

A valid quorum compiles one content-addressed order. The order fixes:

```text
policy and request identities and fingerprints
ordered approval identities, fingerprints, and roles
exact requested certificate profile
order and expiry times
operator identity
issuer certificate and public-key fingerprints
certificateRetained = false
privateKeyRetained = false
issuanceAuthority = authorize-one-leaf
```

The order cannot precede any approval it relies upon. Its expiry must remain within the request interval and the policy's maximum order lifetime. Only one order may exist for one request. The verifier independently reconstructs that cardinality and refuses a second self-consistent order even when both files have valid content fingerprints.

The order is an authorization receipt for an external issuer. It does not include the issuer private key, invoke a signing service, or create a certificate.

## External issuance and certificate verification

The external issuer receives the order through an operator-controlled mechanism outside this estate. When the leaf is returned, the recording transaction transiently parses the leaf and issuer certificates and verifies:

```text
the issuer is a certificate authority
the leaf verifies under that issuer
the issuer fingerprint equals the order
the leaf is not a certificate authority
the leaf public key equals the proof-of-possession key
the subject and subject alternative names equal the order
the certificate validity is contained within the requested bounds
the activation and retirement schedule fits within actual validity
the required client-auth or server-auth extended key usage exists
the issuance and recording times remain within the order
```

The receipt retains only parsed certificate metadata and digests. It does not retain the certificate or its path. The receipt emits an admission instruction containing the exact usage, principal, role, certificate, issuer and public-key fingerprints, schedule, predecessor, key-custody class, key-reference digest, exportability declaration, operator, and bounded reason.

Only one issuance receipt may exist for one order, and one certificate fingerprint may not appear in multiple issuance receipts. The verifier recomputes both cardinalities. It also reconstructs certificate metadata and the admission instruction from the order. A forged subject, usage, schedule, custody field, or instruction remains an error even when an attacker recomputes the receipt fingerprint and content-derived identity.

Cryptographic issuer and leaf verification occurs when the certificate bytes are recorded. Because the bytes are deliberately not retained, later estate verification proves the immutable receipt, order, key, policy, and admission metadata chain rather than re-running certificate signature verification. Operators that require later cryptographic revalidation must retain the certificate in the qualified runtime operations estate or another holder-controlled certificate repository, not inside the enrollment estate.

## Runtime admission link

The issuance receipt is eligible for the separate runtime admission transaction defined by the transport-operations plane. The enrollment actor can then retain a reference-only link to the resulting runtime admission. The link requires exact agreement on:

```text
certificate fingerprint
public-key fingerprint
issuer certificate fingerprint
usage
principal
actor role
predecessor fingerprint
admission time
```

The link also binds the runtime admission identity and fingerprint, issuance identity and fingerprint, link time, and operator. It cannot create, activate, rotate, retire, or dispatch a runtime certificate. The runtime operations verifier remains authoritative for the referenced admission object. One issuance may have only one runtime admission link in this format.

## Renewal and emergency recovery

`renewal` and `emergency-recovery` requests must identify a predecessor certificate. Initial requests must not. The request schedule retains a declared overlap window through activation and retirement timing. Emergency recovery invokes the higher approval threshold and emergency required roles.

This version proves the requested successor profile, predecessor identity, declared schedule, and approval law. It does not independently query the live predecessor admission or availability estate while compiling the order. Runtime overlap, predecessor activity, successor activation, availability proof, and retirement remain governed by the qualified transport-operations plane. A future integration may validate those live predicates before issuance without transferring runtime authority into enrollment.

## Operator

The local operator is registered as:

```bash
npm run asoiaf:answer-transport-enrollment -- ...
```

It exposes:

```text
policy
proof
request
approval-statement
approve
order
record
link
status
verify
paths
```

`proof` and `approval-statement` emit canonical signing bytes as base64 plus a SHA-256 digest. They do not sign and do not read a private key. `policy`, `request`, `approve`, `order`, `record`, and `link` accept explicit JSON inputs and retain append-only custody. `status` reads the complete estate. `verify` reconstructs every policy, key proof, approval, quorum, order, issued-certificate receipt, admission instruction, runtime link, digest-derived path, cardinality rule, authority boundary, and secret-exclusion rule.

## Qualification boundary

The exact-head qualification generates one ephemeral certificate authority, one RSA requester key, and three independent Ed25519 approver keys in the runner's temporary directory. Those secrets are used only to exercise the cryptographic lifecycle and are excluded from the retained artifact.

The command-line smoke:

```text
retains and exactly replays one issuer policy
emits canonical proof signing bytes
verifies and exactly replays one proof-of-possession request
emits two canonical approval statements
verifies and exactly replays issuer-operator and actor-owner approvals
compiles and exactly replays one quorum-authorized issuance order
verifies and exactly replays one externally issued client certificate
links and exactly replays one runtime admission reference
reconstructs one policy, request, order, issuance, and link plus two approvals
returns no verifier finding
finds no secret-bearing path or payload in the enrollment estate
```

The focused suite additionally proves insufficient quorum, retained rejection, the higher emergency-recovery quorum, wrong issuer refusal, wrong public-key refusal, runtime-link mismatch refusal, content tamper detection, secret-file detection, duplicate-order detection, quorum reconstruction after self-consistent re-fingerprinting, and certificate-metadata reconstruction after self-consistent re-fingerprinting.

The permanent workflow must also pass strict TypeScript, the focused enrollment, operations, transport, exchange, worker, estate, lease, work-order, reviewed-answer, dossier, and reconciliation suites, the complete Arc regression, and the production build on one exact candidate head. Its qualification artifact retains the public enrollment estate, operator receipts, expected identities, logs, declared boundary, and `SHA256SUMS`. It excludes the ephemeral certificate authority, leaf certificate, certificate request, private keys, and signature working files.

The evidence tier is issuer-policy implementation, proof-of-possession verification, signed human approval custody, quorum reconstruction, external certificate verification at recording time, exact command-line replay, adversarial semantic reconstruction, full repository regression, and a retained public qualification artifact. The venue is the holder-controlled answer desk above the qualified transport-operations plane. The target is pre-admission certificate governance rather than runtime certificate activity or any research task. The upside is that a leaf can identify the exact policy, requester key, custody attestation, approvers, order, issuer, certificate metadata, and runtime admission reference that authorized it. The downside is explicit issuer and approver key management, external signing integration, append-only governance growth, and separate runtime admission. The failure mode is issuing without proof of possession, accepting an unregistered or insufficient quorum, letting a rejection disappear, allowing one order to mint multiple leaves, retaining secret material, or treating certificate issuance as task authority.

The control question is whether every admitted runtime certificate can disclose which exact issuer policy allowed it, which key proved possession, how that key was held, which named approvers and roles authorized one leaf, which issuer and certificate metadata were verified, which runtime admission received it, and why none of those governance receipts acquired the authority of the actor or task that later used the certificate.
