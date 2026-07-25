# Persistence custody v1

## Control question

When browser storage rejects, corrupts, or only partially applies a load-bearing write, can the player see the failure, preserve the complete in-memory record, export it, retry it, and verify whether the previously committed record survived?

A persistence surface fails this contract when it returns no result, labels an unverified write successful, drops the in-memory record, or removes the player's recovery path.

## Scope

This contract governs:

- the digest-keyed Arc run slot;
- the campaign ledger used by Raid Night and compatible progression;
- clear operations for those records;
- player-visible failure, retry, and recovery export.

Preferences such as theme, locale, and motion remain lower-stakes records. They may degrade to defaults without claiming that a run or ledger was committed.

## Transaction law

A write follows this order:

1. Serialize the complete candidate record before the first storage mutation.
2. Write the candidate to a deterministic temporary key.
3. Read the temporary value back and require byte identity.
4. Capture the current canonical value.
5. Promote the candidate to the canonical key.
6. Read the canonical value back and require byte identity.
7. Remove the temporary value.
8. Return exact success with the UTF-8 byte count.

A failed promotion attempts to restore the captured canonical value and reads it back. The failure result distinguishes:

```text
quota
unavailable
serialization
verification
rollback
unknown
```

`rollback` is the most severe result. It means the attempted write failed and the client could not verify that the prior canonical value was restored. The in-memory candidate must remain exportable, and the player must be told not to close the page.

## Run custody

The local run envelope contains:

- the exact engine save;
- pending reward choices;
- unknown holder-owned portable-run extensions.

The outer envelope is bounded before its embedded engine save is deserialized. Save identity remains digest-keyed by the exact Arc. A run cannot silently attach to revised authored law.

The ordinary player already exposes a visible unsaved alert and an exact `axm-cartridge-run/v3` export. A failed autosave does not clear state or disable that export.

## Ledger custody

The campaign ledger is parsed through bounded JSON and its load-bearing shape before migration. Interactive Raid Night commits use a result-bearing API:

```text
ledger candidate
+
SaveResult
```

The UI calls a ledger committed only when `SaveResult.ok` is true. On failure, it retains the complete in-memory ledger, offers retry, and exports the same ledger JSON that would have been committed.

The pure `commitNightVictory` and `commitNightFailed` functions remain available to simulations and headless clients. They create in-memory records and perform no browser write. This prevents a headless adapter from hiding a failed ambient storage operation.

## Recovery and failure injection

Permanent tests cover:

- successful temporary and canonical readback;
- canonical corruption followed by verified rollback;
- an adapter that mutates and then throws;
- quota and unavailable stores;
- a store that refuses removal;
- serialization failure before any write;
- exact unknown-extension preservation;
- failed ledger writes retaining the complete commit;
- UI binding to result-bearing commit functions, retry, and recovery export.

A test double may be more hostile than browser `localStorage`. This is intentional. The contract is written for any synchronous holder-owned storage adapter that claims to implement the interface.

## Relationship to whole-holder custody

`rodoh-holder-estate/v1` in World transports all holder-owned browser records together. It does not excuse an individual Arc or ledger write from reporting failure. Whole-estate restore and ordinary day-to-day persistence share the same rule: validate and prepare before mutation, commit explicitly, verify readback, and preserve a recovery object when storage is unhealthy.
