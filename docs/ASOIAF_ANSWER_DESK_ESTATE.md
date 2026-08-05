# ASOIAF persistent answer desk estate

The persistent answer desk is the holder-controlled storage and transaction layer above the qualified ASOIAF answer work-order and lease protocols. It does not search a private edition, acquire a public source, review evidence, reconcile a claim, assemble an answer, verify a packet in place of its validator, or render text. It stores exact qualified heads and append-only attempt custody so a local unattended desk can restart from disk without permitting callers to omit active leases, terminal settlements, or older work-order heads.

## Estate surfaces

One estate is bound to one dossier and one question. Its durable surfaces are:

```text
ANSWER-DESK.json
DESK-STATE.json
work-orders/<sha256>.json
work-orders.ndjson
leases.ndjson
settlements.ndjson
.transaction-lock/lock.json
```

`ANSWER-DESK.json` is the current manifest. `DESK-STATE.json` is a disposable deterministic projection. Every work order is retained as an immutable JSON file named by its full SHA-256 fingerprint, which avoids colon-bearing semantic identifiers and remains portable across NTFS and Unix filesystems. `work-orders.ndjson`, `leases.ndjson`, and `settlements.ndjson` are append-only custody ledgers.

The manifest binds the estate identity, initialization and update times, dossier and question identities, latest work-order identity and fingerprint, ledger counts, stale-lock recovery count, authority boundary, and manifest fingerprint. The estate cannot mix questions or dossiers.

## Work-order adoption

An adopted work order must pass the permanent answer work-order validator. A new head must preserve the estate’s dossier and question, strictly advance the prior work-order creation time, and receive a content-addressed adoption record. Its stored file, adoption record, manifest pointer, and append-only ledger must agree exactly.

Replaying the exact same qualified work order is idempotent. The estate returns the existing record and does not append a duplicate. A different work order with a non-advancing creation time is refused. Adoption time cannot precede the work-order creation time or move the desk’s logical clock backward.

## Atomic local transaction lock

Every mutation acquires `.transaction-lock` through an atomic directory creation. The lock record binds owner, acquisition time, expiry, duration, fingerprint, and content-derived identity. Lock duration is bounded from one second through five minutes.

A valid unexpired lock blocks another writer. An expired or malformed lock may be recovered through an atomic rename followed by removal. Each recovery increments `staleLockRecoveryCount` in the manifest. The transaction lock is released in a `finally` path, including after a refused mutation.

The lock is a local single-writer mechanism. It does not grant task authority, satisfy a work item, or transfer an older lease to a newer head.

## Claims

A claim reads the authoritative work-order, lease, and settlement ledgers from disk. The caller cannot omit another worker’s active lease or a prior terminal settlement to manufacture availability.

An exact retry with the same work order, item, worker, claim time, and lease duration returns the existing valid lease. It does not append a second row. A conflicting concurrent claim is refused. An expired lease releases its item. A terminal settlement prevents replay.

After every claim attempt that mutates the estate, current desk state and manifest counts are regenerated from the complete stored ledgers.

## Settlements and head advancement

A settlement looks up its lease and exact before-work-order from the append-only estate. A retry that exactly matches the existing settlement is idempotent. A conflicting second settlement for the same lease is refused.

An advancing settlement may supply a refreshed qualified work order. The settlement is validated against the before and proposed after heads before the estate appends either the new adoption record or settlement row. The new work order must prove that the same stable action-and-subject item became `satisfied` or `preserved-as-limitation`. At least one exact result object and fingerprint must be retained.

This ordering prevents an invalid worker result from leaving an orphan work-order adoption. If the desk has already advanced to a different head, a normal settlement is refused. The worker must record a structurally valid `stale` terminal against the newer exact head.

Rendering is non-advancing. A valid `rendered` settlement binds the reviewed output but leaves the work-order head unchanged. The lease protocol marks the same stable render item terminal in current desk state, so restart does not advertise rendering again and a second render claim is refused.

## Logical time and corrupted-estate refusal

The manifest’s `updatedAt` is the desk’s logical clock. Adoption, claim, settlement, and refresh cannot move it backward. Work-order creation times and adoption times must also advance consistently.

Before mutating an already initialized estate, the transaction verifies the complete existing estate. A stale manifest fingerprint, count mismatch, malformed work order, broken lease, duplicate settlement, invalid desk state, or other integrity error blocks further mutation. The actor does not append new receipts to a corrupted base and hope that a later projection conceals it.

## Desk-state regeneration

`DESK-STATE.json` is rebuilt from the latest qualified work order, complete lease ledger, complete settlement ledger, and an explicit `asOf` time. It distinguishes:

```text
active leases
expired leases
stale leases
settled leases
open items
available items
blocked items
next available item
answer readiness
bounded completeness
```

An unsettled lease from an older head remains visible as stale. A valid rendered settlement removes its unchanged render key from availability. A refresh updates time-sensitive expiry and availability without altering work-order, lease, or settlement custody.

## Verification

The estate verifier reconstructs every durable relationship. It checks:

```text
manifest format, content identity, fingerprint, counts, time, and authority
one dossier and question across every head
portable and safe work-order paths
stored work-order validation and file-to-ledger parity
strictly advancing creation and adoption times
unique work-order, lease, and settlement identities
lease-to-work-order custody
one settlement per lease
before and after work-order existence and settlement validity
latest-head pointer parity
current desk-state deterministic reconstruction
manifest and state time parity
transaction-lock validity
```

A valid active lock is reported as a warning because another writer may be operating. A malformed lock is an integrity error.

## Operator transactions

The local operator exposes:

```bash
npm run asoiaf:answer-desk -- adopt \
  --input adopt-input.json \
  --out adopt-result.json

npm run asoiaf:answer-desk -- claim \
  --input claim-input.json \
  --out claim-result.json

npm run asoiaf:answer-desk -- settle \
  --input settlement-input.json \
  --out settlement-result.json

npm run asoiaf:answer-desk -- status \
  --root .asoiaf-answer-desk

npm run asoiaf:answer-desk -- refresh \
  --root .asoiaf-answer-desk \
  --at 2026-08-05T06:45:00.000Z \
  --operator answer-desk:refresh \
  --out refreshed-state.json

npm run asoiaf:answer-desk -- verify \
  --root .asoiaf-answer-desk

npm run asoiaf:answer-desk -- paths \
  --root .asoiaf-answer-desk
```

The operator reads and writes local JSON custody only. It performs no network request, opens no private source, executes no leased task, and mutates no graph or canon state.

## Qualification boundary

Synthetic qualification uses one exact holder-controlled AGOT dossier with one immutable candidate gap, an open work order, a passed primary reconciliation transaction that makes the gap closable, a reconciled work order, a bounded reviewed answer packet that carries the exact gap closure, and an answer-ready work order. No source prose is retained or read.

The focused suite proves:

```text
portable content-addressed work-order storage
exact adoption replay
idempotent lease replay from authoritative ledgers
concurrent claim refusal
stale-lock recovery and release after failure
settlement replay and conflicting-terminal refusal
refreshed-head advancement
older-head stale lease visibility
content-addressed gap closure
render settlement persistence without head mutation
render terminal suppression after restart
restart reconstruction
state refresh and expiry
non-monotonic and cross-question refusal
invalid-settlement refusal before head adoption
logical-clock refusal
corrupted-estate mutation refusal
manifest and ledger tamper detection
```

The permanent workflow exercises the same lifecycle through the command-line operators and a temporary filesystem estate. It restarts by reading the estate from disk, refreshes time-sensitive state, verifies the complete custody chain, confirms that transaction locks are absent after each transaction, checks portable filenames, and retains the full estate as a qualification artifact. Strict TypeScript, the focused estate, lease, work-order, answer, dossier, and reconciliation suites, the complete Arc regression suite, and the production build must pass on the exact final head.

The evidence tier is local estate and transaction-custody qualification over synthetic immutable answer-work objects. The venue is the holder-controlled answer desk. The target is atomic mutation, append-only replay, portable storage, stale-lock recovery, and complete restart reconstruction rather than ASOIAF truth or automatic task execution. The upside is that local callers cannot bypass known leases or settlements and the desk can reconstruct its exact current state after process loss. The downside is a single-writer lock, monotonic logical time, explicit refreshed-head adoption, and append-only storage growth. The failure mode is allowing concurrent callers, omitted ledger rows, stale locks, backward time, or overwritten projections to create duplicate or unverifiable work.

The control question is whether the local desk can restart from disk and prove every qualified head, claim, settlement, expiry, stale lease, rendered terminal, and available item while no caller can bypass the append-only ledgers or make the estate acquire the authority of the underlying task.
