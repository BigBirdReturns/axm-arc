# ASOIAF Answer Actor Capability Broker

## Classification

The capability broker is the operating-system enforcement layer above the catalogue-bound adapter host. The adapter host identifies one executable, one adapter bundle, one fixed argument template, one fixed environment, one runtime intent, one provider result, and one bounded process request. It deliberately records `osIsolationEnforced=false`. The capability broker consumes that prepared request and converts the declared filesystem, network, child-process, resource, and environment policy into a fail-closed Linux kernel boundary.

The broker does not select work, schedule actors, lease tasks, retrieve credentials, choose providers, settle exchanges, evaluate research, review evidence, mutate the graph, change canon, or declare an answer. It owns only compiler custody, kernel-policy custody, isolated process launch, pre-input attestation, digest-only process evidence, restart recovery, and verification of those receipts.

## Actors and custody

The holder controls the estate root and supplies transient paths for the compiler, adapter executable, adapter bundle, and task input. The adapter host remains the catalogue and invocation authority for those objects. The capability broker revalidates their path digests, content digests, byte counts, fingerprints, time interval, fixed arguments, fixed environment, stream ceilings, and timeout before any broker mutation. The executable must be one little-endian ELF64 x86-64 image with exactly one NUL-terminated `PT_INTERP` record. The broker resolves that record to the exact runtime loader required by the kernel and validates the loader as a regular file.

The local C compiler converts the fixed launcher source carried in the product library into one transient launcher binary. The policy receipt binds the compiler path digest, compiler content digest, compiler byte count, compiler-version digest, launcher-source digest, launcher-binary digest, compilation digest, kernel-release digest, Landlock ABI, runtime-loader path digest, runtime-loader content digest, and runtime-loader byte count. Raw compiler, executable, runtime-loader, and bundle paths are excluded from retained broker objects.

The launcher installs the operating-system controls. The Node broker supervises the launcher, enforces wall-clock and stream ceilings, verifies the kernel attestation, and releases the task envelope only after that attestation is exact. The adapter remains responsible only for producing the existing typed digest-evidence output protocol.

## Exact predecessor boundary

A policy can bind only to an adapter manifest that declares all of the following:

- `shell=false`
- `inheritEnvironment=false`
- `workingDirectory=ephemeral-empty`
- `declaredFilesystemAccess=adapter-bundle-and-ephemeral-cwd-only`
- `declaredNetworkAccess=none`
- `declaredChildProcessAccess=none`
- `osIsolationEnforced=false`

The installation must bind exactly to that manifest. An invocation must bind exactly to the manifest, installation, runtime acceptance, runtime execution intent, provider profile, and provider result already retained by the predecessor estate. The broker refuses any invocation that the non-isolated adapter host has already started or completed. This prevents the weaker execution path and the kernel-enforced path from claiming the same runtime intent.

## Policy binding

`bind` requires Linux on x86-64, Landlock ABI 3 or newer, one exact adapter manifest, one exact installation, the transient exact executable already named by that installation, and one exact compiler file. Before compiling the launcher, the broker revalidates the executable against the manifest and installation, parses its ELF program-header table, requires exactly one absolute UTF-8 runtime-loader path, and retains only the loader path digest, content digest, and byte count. The compiler runs with a fixed non-secret environment and a fixed argument vector:

```text
-O2
-std=c11
-fstack-protector-strong
-D_FORTIFY_SOURCE=2
-Wall
-Wextra
-Werror
```

The launcher source is a fixed product constant. The broker compiles it in a transient directory, verifies the source digest, records the binary digest, executes a bounded kernel probe, and deletes the source and binary after the policy receipt is retained. An exact policy replay revalidates compiler identity, compiler version, executable identity, and runtime-loader identity but does not compile another launcher.

The v1 policy derives four resource ceilings from the adapter manifest:

- Virtual address space is 4 GiB. This admits ordinary Node startup and worker-thread isolates while bounding total virtual mappings.
- CPU time is the manifest timeout rounded up to seconds plus one second.
- Maximum file size is the larger of 1 MiB, the stdout ceiling, and the stderr ceiling.
- Open file descriptors are limited to 64.

Core dumps are disabled.

## Filesystem enforcement

The launcher creates a Landlock ruleset and requires ABI 3 or newer. It grants executable and read access to the exact adapter executable and the exact ELF runtime loader retained by policy. It grants read access to the exact adapter bundle. It grants read-only, non-executable runtime-library access to `/usr`, `/lib`, `/lib64`, `/etc/ld.so.cache`, and `/etc/ssl/openssl.cnf`, plus read and write access to `/dev/null`.

The ephemeral working directory admits ordinary file and directory reads, writes, creation, truncation, renaming, and removal. It does not admit execution, character-device creation, or block-device creation. Runtime directories admit reads but no directory-wide execution. The executable scope is therefore `manifest-executable-plus-runtime-loader`: the launcher admits only the manifest executable and the one exact interpreter the kernel must enter before that executable can start. The adapter bundle, shared libraries, generated files, and every other runtime file remain non-executable.

All other filesystem access is denied by the kernel. The broker does not depend on adapter cooperation or path filtering inside JavaScript.

## Network and process enforcement

The seccomp filter rejects socket creation, connection, binding, listening, acceptance, message transmission, message receipt, and shutdown with `EPERM`. The policy applies to loopback, Unix-domain, and external sockets because the filter denies the socket syscalls rather than filtering destinations.

The filter returns `ENOSYS` for `clone3`. This causes libuv to use the argument-filtered `clone` path. A `clone` call is admitted only when it carries `CLONE_THREAD`; process-forming clone calls return `EPERM`. `fork` and `vfork` return `EPERM`. This admits Node and V8 worker threads without admitting child processes.

The filter also rejects namespace creation and entry, mounts, ptrace, BPF, performance events, kernel keyrings, `execveat`, executable memory files, process-directed signals, pidfd signals, cross-process memory operations, and System V shared-memory, message-queue, and semaphore operations. `no_new_privs` is set before Landlock and seccomp are installed.

The launcher itself performs the one admitted `execve` of the exact manifest executable. During that transition the kernel enters the exact ELF runtime loader admitted by policy. Landlock prevents execution of the adapter bundle, shared libraries, generated files, and every other runtime file.

## Attestation before input

The broker creates a dedicated fourth child pipe for isolation attestation. The launcher performs the following sequence:

1. Parse the broker-supplied resource limits.
2. Apply all rlimits and disable core dumps.
3. Set `no_new_privs`.
4. Create and apply the Landlock ruleset.
5. Apply the seccomp filter.
6. Emit one exact JSON isolation receipt through file descriptor 3.
7. Close file descriptor 3 and every non-standard inherited descriptor.
8. Execute the exact manifest executable with the exact manifest environment, allowing the kernel to enter only its policy-bound ELF runtime loader.

The broker does not write the task envelope to standard input until it has parsed the complete attestation, verified every field against the retained policy, and observed no trailing attestation content. A missing, malformed, oversized, or contradictory attestation causes `SIGKILL`, an `isolation-refused` terminal, and `adapterInputReleased=false`.

The attestation states that input has not yet been released. The terminal separately records whether the broker released input after verification. A successful terminal therefore requires both a valid isolation receipt and `adapterInputReleased=true`.

## Execution receipts

A capability start binds the policy, manifest, installation, invocation, runtime intent, provider result, command digest, environment digest, input digest, launcher digests, compilation digest, kernel-release digest, runtime-loader path digest, runtime-loader content digest, runtime-loader byte count, start time, and operator. It retains no raw input or raw path.

A terminal binds the start and all inherited fingerprints. It records the process outcome, exit code, signal, timestamps, duration, stdout and stderr digests and byte counts, the exact isolation receipt and its digest, typed adapter evidence when successful, and bounded recovery information when unsuccessful. Raw input, stdout, stderr, and task output are never retained.

Terminal outcomes are:

- `succeeded`: the kernel receipt is exact, input was released, the process exited zero, stream and timeout ceilings held, and stdout parsed as exact adapter digest evidence.
- `failed`: the isolated process was established but the executable failed to start or exited nonzero.
- `timed-out`: the isolated process exceeded the bounded wall-clock interval.
- `protocol-refused`: the isolated process exceeded a stream ceiling or emitted invalid or contradictory adapter evidence.
- `isolation-refused`: the launcher did not establish and attest the exact kernel boundary. Task input remains withheld.
- `interrupted`: a retained start was recovered after restart without compiling, launching, or releasing input again.

A replay of an exact completed invocation returns the retained start and terminal without compiling or launching another process. A retained start without a terminal must be closed through `recover` before any retry.

## Typed output boundary

The adapter output protocol remains `axm-asoiaf-answer-actor-adapter-output/1`. The capability broker requires one exact JSON object and rejects missing or unknown fields. The result kind must be admitted by both the manifest and the runtime acceptance. Invocation, runtime-intent, adapter, digest, byte-count, retention, and evidence-authority fields must match their retained parents.

Successful isolated evidence may later be admitted as a typed runtime result. Until that occurs, verification emits a notice. A runtime result for a failed capability terminal is an error. The capability terminal never declares the assignment outcome and retains `taskOutcomeDeclared=false`.

## Storage contract

The broker stores only append-only digest-addressed receipts and one reconstructable projection:

```text
<estate-root>/answer-actor-capability-broker/
  policies/<policy-fingerprint>.json
  starts/<start-fingerprint>.json
  terminals/<terminal-fingerprint>.json
  CAPABILITY-STATE.json
```

The state file projects each started invocation to its start, terminal, outcome, isolation status, and latest timestamp. Verification reconstructs the state from append-only receipts and rejects any difference.

No launcher source, launcher binary, compiler output, raw executable path, raw runtime-loader path, raw bundle path, working directory, task input, stdout, stderr, task output, certificate, private key, provider selector, provider secret, or diagnostic receipt belongs in the retained estate.

## Verification

`verify` replays the complete custody map. It imports predecessor findings, verifies every object fingerprint and digest-addressed filename, validates policy-to-manifest and policy-to-installation links, validates retained runtime-loader digest and byte-count custody, validates start-to-policy and start-to-invocation links, validates terminal-to-start and terminal-to-runtime links, parses retained isolation receipts against their policies, checks success and failure invariants, checks replay uniqueness, reconstructs state, and scans the broker estate for credential-bearing paths and content.

The verifier treats a successful terminal without exact isolation evidence as an error. It also treats a parent adapter start or terminal for the same invocation as an error because that would collapse the enforced and non-enforced execution paths.

## Operator surface

```text
npm run asoiaf:answer-actor-capability-broker -- bind --input <json>
npm run asoiaf:answer-actor-capability-broker -- start --input <json>
npm run asoiaf:answer-actor-capability-broker -- execute --input <json>
npm run asoiaf:answer-actor-capability-broker -- recover --input <json>
npm run asoiaf:answer-actor-capability-broker -- status --root <estate>
npm run asoiaf:answer-actor-capability-broker -- verify --root <estate>
npm run asoiaf:answer-actor-capability-broker -- paths --root <estate>
```

The permanent product supports dynamically linked ELF64 x86-64 executables on Linux only. Static executables, executables without exactly one `PT_INTERP` record, other operating systems, and other architectures fail before mutation. Cross-platform local-service exposure remains an orthogonal transport and portability concern and does not weaken this kernel boundary.

## Authority ledger

Evidence tier: exact-head, live-kernel, integrated process qualification. Venue: a holder-controlled Linux x86-64 answer estate and its exact GitHub Actions candidate. Target: one prepared catalogue-bound adapter invocation. Upside: the declared filesystem, network, process, resource, environment, runtime-loader, and input-release policy becomes kernel-enforced and receipt-verifiable. Downside: the v1 launcher requires a local C compiler, Landlock ABI 3 or newer, one dynamically linked ELF64 x86-64 executable with exactly one runtime loader, and a 4 GiB virtual-address ceiling that may exclude unusually large adapters. Failure mode: any compiler, executable, runtime-loader, kernel, attestation, transient-file, input, timeout, stream, protocol, replay, or parent-custody mismatch fails closed without task authority.

The control question is whether every successful adapter receipt can prove that the exact task input crossed into the exact executable through its exact policy-bound runtime loader only after the complete operating-system boundary was installed, while every broader, weaker, or contradictory execution path remains refused.
