# Continuous post-v1 authority estate

**Status:** isolated integration candidate  
**Action authority:** `6eef311836ee7cb3a43a94ce51f448a2699c3b04`  
**Narrative baseline:** `3c09166af33fb24dd185b0559b5a80183d514d3e`  
**Combined parent:** `2182d9fb7007d20af46bcdd88fc08b2875b93e3a`  
**Frozen v1 effect:** none

## Decision

AXM now has one explicit boundary between deterministic encounter execution and continuing-universe memory. An accepted `axm-action-receipt/1` can enter narrative authority only after Arc replays and verifies it. The receipt is then preserved as an immutable `NarrativeFact`, and an authored `axm-action-narrative-binding/1` maps the already accepted outcome into a candidate narrative consequence.

The binding cannot change the action outcome. It can only declare what the accepted outcome means inside one universe constitution:

```text
accepted action receipt
  -> exact Arc replay verification
  -> immutable accepted-action-result fact
  -> authored outcome mapping
  -> ordinary narrative eligibility and ranking
  -> ordinary narrative commit
  -> beat, precedent, obligation, or inherited pressure
```

This closes the smallest useful loop between the action and narrative trains without combining their authority.

## Authority boundaries

### Narrative succession owns

- why a situation is currently salient;
- actor goals, methods, beliefs, and epistemic limits;
- inherited beats, precedents, pressures, and obligations;
- semantic consequence selection under a universe constitution;
- the next story question made unavoidable by accepted history.

### Arc action law owns

- `axm-action-profile/1` and `axm-action-spec/1`;
- fixed-step encounter simulation;
- exact input-trace replay;
- accepted `success`, `partial`, or `failure` classification;
- `axm-action-receipt/1` identity and tamper refusal.

### World and Unity own

- presentation and input collection;
- provisional real-time execution;
- controls, camera, effects, quality profiles, and device delivery;
- a provisional candidate that explicitly requires Arc replay.

World and Unity cannot create an accepted action fact or narrative consequence.

### Embodied custody owns

- physical-session observations;
- immutable spool and hash-chained journal custody;
- attachment of the provisional candidate and later accepted Arc receipt;
- Genesis-facing evidence projection.

Tracking loss, guardian stops, focus loss, sensor evidence, and other physical observations retain `campaignEffect: null` unless separate Arc law accepts a game consequence.

## `axm-action-narrative-binding/1`

A binding belongs to authored narrative law. It names one challenge and supplies an outcome rule for all three accepted Arc outcomes. Each rule declares:

- the legal narrative beat function;
- track opening or advancement and optional terminal disposition;
- severity, tags, and pressure tags;
- the characteristic move used by the controlled actor;
- additional persistent payments;
- obligations opened or resolved;
- disclosed priority, complexity, and cooldown;
- the downstream presentation key.

Example:

```json
{
  "format": "axm-action-narrative-binding/1",
  "id": "first-charter-cellar-aftermath",
  "version": "1.0.0",
  "challengeId": "the-cellar",
  "track": {
    "kind": "open",
    "trackId": "cellar-aftermath",
    "railId": "accepted-action-consequence",
    "controllingQuestion": "What must remain true because the cellar result was accepted?",
    "pressureTags": ["pressure:cellar-aftermath"]
  },
  "outcomes": {
    "success": {
      "beatFunction": "consequence",
      "trackDisposition": "resolve",
      "severity": 8,
      "tags": ["action:success"],
      "pressureTags": ["pressure:cellar-aftermath"],
      "controlledMoveTag": "formalize",
      "statePayments": [],
      "opensObligations": [],
      "resolvesObligationIds": [],
      "authoredPriority": 3,
      "conditionComplexity": 4,
      "cooldownCycles": 0,
      "presentationKey": "cellar.success.consequence"
    },
    "partial": {
      "beatFunction": "consequence",
      "trackDisposition": "resolve",
      "severity": 6,
      "tags": ["action:partial"],
      "pressureTags": ["pressure:cellar-aftermath"],
      "controlledMoveTag": "formalize",
      "statePayments": [],
      "opensObligations": [],
      "resolvesObligationIds": [],
      "authoredPriority": 3,
      "conditionComplexity": 4,
      "cooldownCycles": 0,
      "presentationKey": "cellar.partial.consequence"
    },
    "failure": {
      "beatFunction": "consequence",
      "trackDisposition": "resolve",
      "severity": 10,
      "tags": ["action:failure"],
      "pressureTags": ["pressure:cellar-aftermath"],
      "controlledMoveTag": "formalize",
      "statePayments": [],
      "opensObligations": [],
      "resolvesObligationIds": [],
      "authoredPriority": 3,
      "conditionComplexity": 4,
      "cooldownCycles": 0,
      "presentationKey": "cellar.failure.consequence"
    }
  }
}
```

All fields are bounded and unknown fields are refused. All outcomes are mandatory, so authors cannot quietly leave failure or partial play outside narrative continuity.

## Ingestion receipt

`ingestAcceptedActionReceipt` emits `axm-action-narrative-ingestion/1`. It binds:

```text
binding identity and fingerprint
action receipt digest and accepted outcome
narrative fact identity
candidate identity
state fingerprint before ingestion
state fingerprint after ingestion
whether the fact was newly inserted
receipt digest
```

The generated fact preserves the exact Arc, challenge, action-spec, trace, state, and accepted-receipt digests plus terminal statistics. Every generated narrative candidate carries an automatic `action-result` state payment whose `receiptRef` is the accepted action receipt.

Repeated ingestion of the same accepted receipt is idempotent. A different fact attempting to occupy the same accepted-receipt identity is refused.

## Refusal rules

The seam refuses:

- anything that is not an exact `axm-action-receipt/1`;
- a provisional World or Unity candidate;
- any receipt that fails exact Arc replay;
- a binding naming a different challenge;
- a narrative cycle different from the accepted action cycle;
- a receipt party absent from narrative actor custody;
- duplicate or conflicting accepted-action facts;
- candidate consequences that fail the ordinary narrative constitution, rail, identity, method, payment, obligation, or cooldown law.

The seam does not bypass `sortNarrativeCandidates` or `commitNarrativeSelection`. Ingestion makes the accepted outcome available to narrative authority; the ordinary narrative system remains responsible for eligibility, comparison, and commit.

## End-to-end operating sequence

```text
Narrative pressure and obligations
  -> authored challenge and action profile
  -> exact axm-action-spec/1
  -> World / Unity provisional execution
  -> physical-session spool and embodied journal
  -> exact Arc replay
  -> accepted axm-action-receipt/1
  -> accepted-action-result NarrativeFact
  -> authored outcome candidate
  -> ordinary narrative selection
  -> committed beat and persistent payment
  -> next inherited narrative pressure
```

The current executable acceptance uses a real First Charter challenge, builds a competent deterministic input trace, creates an accepted Arc receipt, ingests it, selects the resulting consequence through the ordinary narrative sorter, and commits the beat through the ordinary narrative ledger.

## Next seams

This candidate deliberately stops before broad product integration. The next bounded work is:

1. put one real cartridge-owned binding beside its action profile;
2. persist narrative state and the ingestion receipt through exact run custody;
3. expose the committed narrative consequence to World as presentation-only data;
4. have the physical completion runner emit the accepted receipt into this seam automatically;
5. prove the same complete loop for a second materially different cartridge;
6. add writer-room and Forge controls only after the two-cartridge loop is stable.

Book IV, connected-operation v2, and the decision-kernel program remain separate post-v1 trains. This integration branch does not register or activate them.
