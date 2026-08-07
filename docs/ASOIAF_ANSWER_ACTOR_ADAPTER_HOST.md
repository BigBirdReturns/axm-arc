# ASOIAF actor adapter host and process custody

## Classification

The actor adapter host is a holder-controlled process-custody plane below the certificate-bound actor runtime. It consumes one exact runtime execution intent, verifies one public provider result, binds one adapter manifest and host installation, materializes the task input only in process memory, launches one fixed process, and retains one start receipt plus one terminal process receipt.

The host does not issue or select the assignment. It does not generate, issue, deploy, export, or choose the actor credential. It does not convert process completion into a task outcome. It does not settle the work item, update the research graph, determine canon, or render an answer. The typed runtime result remains a distinct actor-local admission above process evidence.

## Actors

The supervised-delivery plane authenticates the delivery certificate and releases one prepared assignment. The actor runtime binds that delivery to one explicit local credential slot and one digest-only execution intent. The credential provider host owns one exact native credential operation and retains a public result. The adapter host owns process preparation, launch, bounded stream handling, timeout, and process receipts. The adapter process performs the declared work. The actor runtime separately admits a typed task result. The delivery desk separately accepts the result return and retains settlement.

These actors cannot borrow one another's authority. A process exit code cannot issue a lease. A provider proof cannot select work. An adapter output cannot settle an assignment. A runtime result cannot rewrite provider custody. A successor credential cannot inherit predecessor-delivered work.

## Permanent operator

```text
npm run asoiaf:answer-actor-adapter-host -- help
npm run asoiaf:answer-actor-adapter-host -- manifest --input manifest.json
npm run asoiaf:answer-actor-adapter-host -- install --input installation.json
npm run asoiaf:answer-actor-adapter-host -- prepare --input invocation.json
npm run asoiaf:answer-actor-adapter-host -- start --input start.json
npm run asoiaf:answer-actor-adapter-host -- execute --input execution.json
npm run asoiaf:answer-actor-adapter-host -- recover --input recovery.json
npm run asoiaf:answer-actor-adapter-host -- status --root answer-estate
npm run asoiaf:answer-actor-adapter-host -- verify --root answer-estate
npm run asoiaf:answer-actor-adapter-host -- paths --root answer-estate
```

The `start` command retains a process-start receipt without launching a process. It exists so a process supervisor can make the durable start boundary explicit before transferring control. The ordinary `execute` command performs the same atomic start admission and then launches the process. If a start exists without a terminal receipt, `execute` refuses to launch again. The `recover` command closes that incomplete start as `interrupted` without a duplicate launch.

## Adapter manifest

A manifest binds one adapter identity and version to:

* the SHA-256 digest and byte count of one executable;
* the SHA-256 digest and byte count of one adapter bundle;
* one fixed argument template containing exactly one `{adapterBundle}` token;
* one fixed non-secret environment;
* one or more result kinds already accepted by the assignment contract;
* input, standard-output, and standard-error ceilings;
* one process timeout;
* `shell=false`;
* `inheritEnvironment=false`;
* an empty ephemeral working directory;
* declared filesystem access limited to the adapter bundle and ephemeral working directory;
* declared network access of `none`;
* declared child-process access of `none`.

The manifest retains no executable path, bundle path, task input, task output, provider selector, certificate, private key, or provider secret. The fixed argument list cannot contain input-derived substitutions. The process receives the task input only on standard input.

## Host installation

An installation binds one exact manifest to one host identity, platform, architecture, executable-path digest, bundle-path digest, executable digest, bundle digest, file byte counts, and fixed-argument digest. The raw paths are presented transiently and verified again at every start. They are not retained.

A changed executable, changed adapter bundle, changed path, changed argument template, or changed environment cannot replay an existing installation or invocation. The host does not follow a replacement executable or bundle implicitly.

## Invocation

An invocation binds:

* the manifest and installation;
* the exact runtime execution intent, acceptance, and slot;
* the exact provider profile and public provider result;
* adapter identity and version;
* the runtime input digest and byte count;
* a digest of the idempotency key;
* preparation and expiry times.

The adapter identity and version must equal the runtime intent. The provider result must belong to the same provider profile. Every manifest result kind must already be accepted by the certificate-bound assignment. The invocation cannot outlive the runtime intent. One runtime intent and one idempotency-key digest can each identify only one invocation.

## Ephemeral input protocol

The host validates the transient input bytes against the runtime digest and byte count before retaining a start receipt. It then sends one JSON envelope on standard input:

```json
{
  "format": "axm-asoiaf-answer-actor-adapter-input/1",
  "invocationId": "...",
  "invocationFingerprint": "sha256:...",
  "runtimeExecutionIntentId": "...",
  "runtimeExecutionIntentFingerprint": "sha256:...",
  "adapterId": "...",
  "adapterVersion": "...",
  "inputDigest": "sha256:...",
  "inputBytes": 123,
  "inputBase64": "..."
}
```

The envelope exists only in process memory and the process pipe. Neither the raw bytes nor the Base64 representation enters the adapter-host estate.

## Process launch

The host launches the manifest-bound executable with:

* the fixed argument template and the verified transient adapter-bundle path;
* `shell=false`;
* an exact minimal environment rather than inherited environment state;
* a newly created empty temporary working directory;
* standard input, output, and error pipes;
* bounded output streams;
* one manifest-bound timeout.

The temporary working directory is removed after terminal receipt construction. Standard output and standard error are hashed incrementally. Output that exceeds a ceiling terminates the process and produces `protocol-refused`. A timeout terminates the process and produces `timed-out`. A nonzero exit produces `failed`. Malformed or custody-mismatched adapter evidence produces `protocol-refused`.

The host records `osIsolationEnforced=false`. The v1 plane constrains what the host supplies, how it launches, how long it runs, and what it retains. It does not claim that the operating system prevents a malicious executable from opening unrelated files, sockets, or child processes. Kernel-enforced filesystem, network, namespace, process, and syscall isolation remains the next boundary.

## Adapter evidence

A successful process emits one bounded JSON object:

```json
{
  "format": "axm-asoiaf-answer-actor-adapter-output/1",
  "invocationId": "...",
  "invocationFingerprint": "sha256:...",
  "runtimeExecutionIntentId": "...",
  "runtimeExecutionIntentFingerprint": "sha256:...",
  "adapterId": "...",
  "adapterVersion": "...",
  "resultKind": "...",
  "outputDigest": "sha256:...",
  "outputBytes": 456,
  "rawOutputRetained": false,
  "evidenceAuthority": "digest-evidence-only"
}
```

The result kind must be admitted by both the manifest and the assignment. The output digest and byte count describe the task output, which remains ephemeral. The retained JSON object is public process evidence, not the task output itself.

## Start and terminal receipts

The start receipt binds the invocation, manifest, installation, runtime intent, command digest, environment digest, input digest and byte count, start time, and operator. It retains no process identifier, executable path, bundle path, or raw input.

The terminal receipt binds the start and invocation to one of five outcomes:

```text
succeeded
failed
timed-out
protocol-refused
interrupted
```

It retains exit code, signal, start and completion times, duration, standard-output digest and byte count, standard-error digest and byte count, optional public adapter evidence, and an optional bounded recovery reason. It explicitly records that raw input, raw standard output, raw standard error, and raw task output are not retained. It also records `taskOutcomeDeclared=false` and `terminalAuthority=process-observation-only`.

A successful terminal can be admitted by the actor runtime only when the typed runtime result uses the same provider result and reproduces the adapter evidence output digest and byte count. A non-successful terminal cannot coexist with a typed runtime result for the same execution intent.

## Restart and exact replay

Every object is append-only and stored under its SHA-256 fingerprint. Exact retries reproduce the existing object. A changed retry fails as an immutable collision.

An exact invocation retry after a terminal receipt returns the retained start and terminal without another process launch. A retry after a start but before a terminal refuses execution. The operator must call `recover`, which creates an `interrupted` terminal with empty stream digests and `processLaunched=false`. This prevents a process restart from silently duplicating work whose prior process state is unknown.

## Deterministic state

The state projection assigns each invocation one status:

```text
prepared
started
succeeded
failed
timed-out
protocol-refused
interrupted
```

The state is rebuilt from append-only invocations, starts, and terminals. A missing terminal after a start is a warning requiring recovery. A prepared invocation without a start is a notice. A successful terminal without a typed runtime result is a notice. A typed runtime result that differs from successful process evidence, or exists after a non-successful terminal, is an integrity error.

## Verification

The verifier begins with the complete actor-runtime and credential-provider-host verifiers. It then reconstructs:

* manifest fingerprints, arguments, environment, limits, result kinds, and authority boundary;
* installation identities and manifest parity;
* invocation identities, runtime intent, acceptance, slot, provider profile, provider result, schedule, and idempotency custody;
* one start and one terminal per invocation;
* command and environment digests;
* successful adapter evidence;
* typed runtime-result parity;
* restart recovery and exact replay;
* digest-derived filenames;
* the deterministic state projection;
* credential and provider-secret exclusion.

The verifier rejects credential-bearing filenames and private-key, certificate, certificate-request, PKCS#11-selector, provider-secret, or session-bearing content beneath the adapter-host root.

## Qualification target

The permanent qualification constructs the complete enrolled, certificate-authenticated delivery, deployment, broker, native provider, and actor-runtime floor. It then proves two successful process transactions whose output evidence exactly matches two typed runtime results. It proves that exact retries do not relaunch the process, changed input and bundle custody are refused before mutation, timeout is distinct from process failure, malformed protocol output is distinct from both, and a retained start can be recovered as interrupted without relaunch.

The focused suite includes the adapter host, actor runtime, provider host, broker, deployment, enrollment, supervised delivery, supervisor, transport, exchange, work-order, lease, reviewed-answer, dossier, and reconciliation seams. The complete repository regression and production build remain mandatory.

## Limitations and next boundary

This plane does not enforce kernel-level isolation. It does not create a container, network namespace, seccomp profile, AppContainer, job object, restricted token, mount namespace, or filesystem broker. It does not prove that a malicious adapter obeyed its declared `none` network and child-process policy. It proves that the host selected no shell, inherited no environment, supplied no arbitrary path or argument, used an empty ephemeral working directory, bounded time and streams, retained no raw task payload, and preserved exact process custody.

The next boundary is a capability broker and operating-system isolation profile that can enforce the manifest's filesystem, network, child-process, syscall, resource, and device policy on Linux and Windows while returning a public attestation bound to this exact invocation and terminal receipt.

## Control question

Can every adapter execution disclose the exact certificate-bound assignment, runtime slot, execution intent, provider profile and result, adapter manifest, executable and bundle digests, installation, idempotent invocation, process start, bounded terminal outcome, digest-only task evidence, typed runtime result, workflow head, and qualification artifact that produced it, while no shell, inherited environment, changed path, changed input, process exit, provider proof, successor credential, or retained receipt acquires scheduling, credential, task, settlement, graph, canon, or answer authority?
