# RFC: Tier-2 ledger schema — the guild's memory, modeled

**Status: Proposed — no code until accepted (owner-gated).** Builds on
`docs/RFC_TIER2_PERSISTENCE.md` (Option B — the projected guild ledger — accepted)
and turns the four owner decisions into the exact object model and projection
contract, so the eventual implementation is *only* the roster-source swap plus
commit/projection plumbing.

The type blocks below are **illustrative pseudotypes**, not a shipped schema
file. They fix the shape; field types are indicative.

## Decisions locked (owner, this round)

- **Q1 — Gear.** No raw tier-1 stats carry. Gear carries as *memory, identity,
  prestige, fairness history, and a bounded readiness contribution*, projected
  only into one of five bounded forms. The player remembers the blade; the tier
  does not inherit broken math.
- **Q2 — Compatibility.** Computed from `{roles, attributes, tiers, item slots,
  required check vocabulary}`. No silent auto-mapping. Incompatible → archive /
  export / start fresh, never a guess. Adapter cartridges are a later, explicit
  feature.
- **Q3 — Commit.** Explicit and ceremonial. A consequence screen shows what will
  persist; the player clicks **Commit to Guild Record**; the night becomes
  append-only history. `VictoryCommit` may advance tier; `FailedLockoutCommit`
  preserves scars/stress/morale/bench/attendance/best-pull but does not advance
  the gate unless the cartridge explicitly allows partial progression.
- **Q4 — Custody.** The playable ledger lives in **arc**, local-first, portable,
  deterministic, exportable. No world runtime dependency; world may later mirror
  / notarize exports as provenance.

## Principles the schema enforces (invariants, not aspirations)

1. **Null-ledger is the current path.** `project(null, cartridge, seed)` MUST
   equal today's `buildStartingOrg(cartridge, seed)`. Standalone play is
   preserved byte-for-byte; persistence is an *added source*, never a replacement.
2. **Projection is pure.** `(ledger snapshot, cartridge, seed) → ProjectionResult`
   with no wall-clock, no `Math.random`, no network, no world dependency. Same
   inputs → same starting org.
3. **People and consequence carry; content does not.** Agents carry identity,
   role, compatible attributes, bounded growth, morale, stress, loyalty,
   attendance, scars. Gear carries memory + a bounded compatibility effect.
   Bosses, checks, loot tables, tier content stay owned by the cartridge.
4. **Ordering is a sequence number, not a clock.** Every commit has a monotonic
   `commitSeq` (truth); any human timestamp is an optional display label, never
   read by projection or gating.
5. **Cartridge-bound references are labelled.** Any reference into cartridge
   content (an item, a boss) carries `{id, cartridgeDigest}`. Vocabulary never
   leaks into a new cartridge unless the compatibility function allows it.
6. **Append-only truth, cached derived state.** The commit log is the source of
   truth; the ledger's current roster/fairness/gates are a fold of the log over
   the founding guild. `derived === fold(commits, founding)` is an invariant the
   implementation may cache but must never violate.
7. **Versioned, forward-migrating.** Additive migrations bump the minor version;
   destructive ones require an explicit migration function and a compatibility
   note. Old cartridges (referenced by digest, never embedded) always replay.

---

## The object model

### Root & identity

**1. CampaignLedger** — the whole guild memory; the file arc reads/writes.

```ts
// illustrative pseudotype — not a shipped schema
interface CampaignLedger {
  schemaVersion: string;          // e.g. "ledger/1.0" — migration key (P7)
  ledgerId: string;               // stable guild-save id, arc-assigned
  profile: CompatibilityProfile;  // the vocabulary this guild lives in (Q2)
  rngSeed: number;                // the guild's persistent seed (determinism, P2)
  guild: GuildIdentity;
  progress: CampaignProgress;
  roster: AgentMemory[];          // the persistent guild members
  gear: GearMemory[];             // owned-gear memory (Q1), not stat blocks
  loot: LootHistory;
  fairness: FairnessMemory;
  precedents: Precedent[];
  grudges: Grudge[];
  gates: ProgressionGateState;
  commits: LockoutCommit[];       // append-only log; truth (P6)
  founding: FoundingSnapshot;     // the guild at commitSeq 0, for fold-replay
  nextCommitSeq: number;          // monotonic allocator (P4)
}
```

**2. GuildIdentity** — cartridge-agnostic; the guild's own name and prestige.

```ts
interface GuildIdentity {
  name: string;                   // verbatim, the guild's own vocabulary
  crestId: string | null;         // a declared marker, not cartridge art
  legacyLevel: number;
  legacyPoints: number;
  foundedCommitSeq: 0;
}
```

**3. CampaignProgress** — the digest-keyed campaign log.

```ts
interface CampaignProgress {
  campaignProfileDigest: string;  // binds the tiers to one vocabulary (Q2)
  currentTierIndex: number;
  tiers: TierRecord[];
}
interface TierRecord {
  tierIndex: number;
  cartridgeId: string;
  cartridgeDigest: string;        // labelled reference (P5)
  tierLabel: string;              // verbatim from the cartridge
  cleared: boolean;
  grade: string | null;           // e.g. "A", "B+"
  firstClearCommitSeq: number | null;
  pulls: number; wipes: number; bestPull: number | null;
}
```

### People

**4. AgentMemory** — a persistent guild member; projects into an engine `Agent`.

```ts
interface AgentMemory {
  agentId: string;                // ledger-stable (NOT a cartridge-generated id)
  name: string;                   // verbatim
  roleId: string;                 // in the guild profile's role vocabulary
  attributes: Record<string, number>;   // profile attribute vocabulary
  traits: TraitRef[];             // { traitId, cartridgeDigest | "core" }
  tier: string;                   // capability tier in the profile
  hiddenAttributes: { loyalty: number; ambition: number; volatility: number; leadership: number };
  morale: number; stress: number;
  afflictionState: { kind: "none" } | { kind: string; sinceCommitSeq: number };
  growth: AgentGrowth;
  attendance: AttendanceRecord;
  bench: BenchHistory;
  joinedCommitSeq: number;
}
```
Note: `agentId` is the guild's own stable id and becomes the projected engine
`Agent.id`, so `assignmentHistory`, scars, and grudges stay coherent across
tiers. Fields mirror the existing engine `Agent` so projection is a mapping, not
an invention.

**5. AgentGrowth** — bounded capability growth (Q1: capability carries via people).

```ts
interface AgentGrowth {
  baseAttributes: Record<string, number>;     // as first recorded
  grownAttributes: Record<string, number>;    // current = base + capped deltas
  log: { attrId: string; delta: number; sourceCommitSeq: number; cap: number }[];
  tierPromotions: { toTier: string; commitSeq: number }[];
}
```
Note: every delta is cap-bounded; `grownAttributes` can never exceed
`base + Σcaps`. This is the anti-inflation guard — growth is real but bounded.

**15. AttendanceRecord** — cartridge-agnostic reliability memory.

```ts
interface AttendanceRecord {
  agentId: string;
  nightsAttended: number; nightsBenched: number; nightsAbsent: number;
  reliability: "exemplary" | "reliable" | "steady" | "at-risk";  // derived
  streak: number; lastAttendedCommitSeq: number | null;
}
```

**16. BenchHistory** — bench memory and its bounded loyalty cost.

```ts
interface BenchHistory {
  agentId: string;
  benchedCommitSeqs: number[];
  passedOnProgression: number;
  resentment: number;             // bounded loyalty impact, feeds drama
  reasons: string[];              // tags, verbatim
}
```

### Gear, loot, fairness

**6. GearMemory** — Q1 made a type. Memory + a bounded projection, never a stat block.

```ts
interface GearMemory {
  gearMemoryId: string;
  itemRef: { itemId: string; cartridgeDigest: string };   // labelled (P5)
  displayName: string;            // verbatim ("Void Reaver Blade")
  acquiredCommitSeq: number;
  acquiredByAgentId: string | null;
  passedOverAgentIds: string[];   // fairness memory
  disputeRef: string | null;      // precedent/grudge id, if it caused one
  contributedToClear: boolean;
  prestige: number;
  projection: GearProjection;     // the ONLY mechanical carry — bounded
}
// The five allowed bounded forms (Q1). Never unbounded old-tier stats.
type GearProjection =
  | { kind: "tier-normalized-equivalent"; slot: string; normalizedBonus: number } // re-scaled to new tier, bounded
  | { kind: "legacy-readiness-modifier"; modifier: number }                        // small, bounded
  | { kind: "cosmetic"; markerId: string }                                         // no math
  | { kind: "fairness-precedent-memory"; precedentRef: string }                    // memory only
  | { kind: "role-identity-signal"; roleId: string; signalStrength: number }       // informs diagnosis
  | { kind: "none" };                                                              // pure memory
```
Note: which form applies is decided at projection time by compatibility (a
matching item slot may allow `tier-normalized-equivalent`; otherwise it degrades
to `legacy-readiness-modifier`, `cosmetic`, or `none`). `normalizedBonus` and
`modifier` are hard-capped by the target cartridge's tier scale — the blade is
remembered, the math is the new tier's.

**7. LootHistory** — append-only "who got what," the fairness substrate.

```ts
interface LootHistory {
  events: LootEvent[];
}
interface LootEvent {
  commitSeq: number;
  itemRef: { itemId: string; cartridgeDigest: string };
  grantedToAgentId: string | null;
  eligibleAgentIds: string[];
  rule: string;                   // the loot rule in force (e.g. "DKP")
  disputeRef: string | null;
}
```

**8. FairnessMemory** — rolled-up fairness state; cartridge-agnostic.

```ts
interface FairnessMemory {
  perAgent: Record<string, { received: number; passedOver: number; lastAwardCommitSeq: number | null }>;
  distributionScore: number;      // 0–100, a Gini-like fairness index
  disputesResolved: number; disputesOpen: number;
}
```

### Commits & consequences (Q3)

**9. LockoutCommit** — the base append-only night record (the union parent).

```ts
type LockoutCommit = VictoryCommit | FailedLockoutCommit;
interface LockoutCommitBase {
  commitSeq: number;              // monotonic truth (P4)
  commitLabel?: string;           // optional display timestamp, never read by logic
  type: "victory" | "failed-lockout";
  cartridgeId: string; cartridgeDigest: string;
  rngSeedAtNight: number;         // the seed the night was played with (replay)
  pulls: number; wipes: number; bestPull: number | null;
  consequences: ConsequenceSet;   // exactly what the consequence screen showed
}
interface ConsequenceSet {
  loot: LootEvent[];
  moraleShifts: { agentId: string; delta: number }[];
  stressConfidence: { agentId: string; stressDelta: number; confidenceDelta: number }[];
  scarsEarned: BossScar[];
  precedentsSet: Precedent[];
  legends: { agentId: string; citation: string }[];
  gateEffects: GateEffect[];
}
```
Note: the `ConsequenceSet` is computed and shown on the consequence screen
*before* persistence; committing appends the already-shown set. Nothing persists
that the player did not see.

**10. VictoryCommit** — may advance tier.

```ts
interface VictoryCommit extends LockoutCommitBase {
  type: "victory";
  clearedTier: boolean;
  gradeAwarded: string;
  firstClear: boolean;
  tierAdvanced: boolean;          // may flip a ProgressionGateState (Q3)
  reputationGained: number;
}
```

**11. FailedLockoutCommit** — preserves consequence, does not advance the gate.

```ts
interface FailedLockoutCommit extends LockoutCommitBase {
  type: "failed-lockout";
  tierAdvanced: false;            // unless partialProgressionAllowed on the cartridge
  partialProgress?: { metricId: string; value: number };  // only if the cartridge opts in
}
```
Note: a failed lockout still writes scars, stress, morale, bench, attendance,
and best-pull — the night mattered even though the boss lived. It advances the
gate only when the cartridge explicitly declares partial progression.

### Carried consequence

**12. BossScar** — the carry-forward consequence vehicle; bounded, with a cost.

```ts
interface BossScar {
  scarId: string;
  sourceBossRef: { challengeId: string; cartridgeDigest: string };  // labelled (P5)
  name: string;                   // verbatim ("Void Reaver Scar")
  effect: { modifier: number; appliesTo: "guild" | { roleId: string } | { agentId: string }; note: string };
  cost: { modifier: number; note: string } | null;   // scars can cut both ways
  earnedCommitSeq: number;
  durationTiers: number;          // bounded lifespan, e.g. 1
}
```
Note: `effect`/`cost` are bounded modifiers with stated meaning ("+X healing,
lasts 1 raid") — the honest carry from Q1. Scars are cartridge-agnostic in
effect but labelled with their source.

**13. Precedent** — a guild decision that biases future behavior.

```ts
interface Precedent {
  precedentId: string;
  kind: string;                   // e.g. "fairness-vs-readiness", "healer-shortage"
  setCommitSeq: number;
  sourceCartridgeDigest: string | null;
  description: string;            // verbatim
  bias: { target: "drama" | "bench" | "morale"; modifier: number };  // bounded
  resolved: boolean;
}
```

**14. Grudge** — a persistent antagonism with an optional oath.

```ts
interface Grudge {
  grudgeId: string;
  kind: "agent-vs-agent" | "guild-vs-boss";
  parties: { agentIds: string[] } | { bossRef: { challengeId: string; cartridgeDigest: string } };
  reason: string;                 // verbatim
  oath: string | null;            // verbatim ("Never again")
  intensity: number;              // bounded
  status: "active" | "resolved";
  setCommitSeq: number;
}
```

### Gates

**17. ProgressionGateState** — which tiers are open; advanced only by victory.

```ts
interface ProgressionGateState {
  tiers: {
    tierIndex: number;
    cartridgeDigest: string;
    state: "cleared" | "current" | "gate-locked" | "locked";
    gateMetrics: { metricId: string; value: number; threshold: number; met: boolean }[];
  }[];
}
interface GateEffect { tierIndex: number; metricId: string; delta: number }
```
Note: `state` is computed from cleared tiers + gate metrics; the metrics are
inputs, the unlock is derived. Only a `VictoryCommit` may flip `current → cleared`
or open the next tier.

### Projection & compatibility

**18. ProjectionResult** — the pure output that feeds `resolveChallenge` unchanged.

```ts
interface ProjectionResult {
  ok: boolean;
  org: Organization | null;       // the engine Organization, ready to play
  compatibility: CompatibilityReport;
  projected: { ledgerAgentId: string; role: string; carriedScars: string[]; gearProjections: GearProjection[] }[];
  generated: string[];            // ids of roster-slack agents (night-scoped, not persisted)
  carried: { precedents: string[]; grudges: string[]; gateTierIndex: number };
  seedUsed: number;               // hashSeed(ledger.rngSeed, cartridgeDigest)
}
```
Note: `org` is exactly the type `raid-night.ts` already hands to
`resolveChallenge`. The seam swap is: `buildStartingOrg(...)` →
`project(ledger, cartridge, seed).org`.

**19. CompatibilityReport** — the readable verdict shown when refusing (Q2).

```ts
interface CompatibilityProfile {
  roleIds: string[];              // sorted
  attributeIds: string[];         // sorted
  tierIds: string[];              // sorted
  itemSlots: string[];            // sorted, from item.slot
  checkVocab: string[];           // role_specific roleIds + weighted attributeIds used
  profileDigest: string;          // hash of the canonicalized profile above
}
interface CompatibilityReport {
  compatible: boolean;
  ledgerProfile: CompatibilityProfile;
  cartridgeProfile: CompatibilityProfile;
  dimensions: { dimension: string; ledgerValue: string[]; cartridgeValue: string[]; match: boolean }[];
  verdict: "null-ledger" | "compatible" | "incompatible";
  remedy: null | "archive" | "export" | "start-fresh" | "adapter-required";
  message: string;                // human-readable, for the refusal UI
}
```
Note: v1 compatibility is **exact match on the five dimensions** (strictest,
safest). `profileDigest` equality is the fast check. Subset/adapter relations
are a deferred, explicit feature — never a silent guess.

**20. NullLedger behavior** — not a type; the degenerate contract that protects today.

There is no `NullLedger` object. "No ledger" is the *absence* of a
`CampaignLedger`, and the projection contract pins its meaning:

```
project(undefined, cartridge, seed):
  → { ok: true,
      org: buildStartingOrg(cartridge, seed),   // byte-identical to today
      compatibility: { verdict: "null-ledger", compatible: true, remedy: null, ... },
      generated: <all roster ids>, projected: [], carried: {...empty} }
```
This is the guarantee that standalone cartridges keep playing exactly as they do
now. Every cartridge in `cartridges/` remains valid and replayable with no
ledger in sight.

---

## The compatibility function (Q2)

```
compatibilityProfile(cartridge) -> CompatibilityProfile
  roleIds       = sorted(cartridge.roles.map(id))
  attributeIds  = sorted(cartridge.attributes.map(id))
  tierIds       = sorted(cartridge.tiers.map(id))
  itemSlots     = sorted(unique(cartridge.items.map(slot)))
  checkVocab    = sorted(unique(role_specific roleIds ∪ weighted attributeIds))
  profileDigest = digest(canonical(the above))     // like cartridgeDigest, vocab-only

compatible(ledger, cartridge) -> CompatibilityReport
  if ledger absent            -> verdict "null-ledger", compatible true
  else if ledger.profile.profileDigest === profile(cartridge).profileDigest
                              -> verdict "compatible"
  else                        -> verdict "incompatible", remedy in {archive, export, start-fresh, adapter-required},
                                 message naming the mismatched dimension(s)
```
No dimension is ever coerced. "Mender" never becomes "Compliance Lead";
"Output" never becomes "Throughput". Chrome may relabel for display; *campaign
persistence* requires the deterministic digest match.

## The projection function (pure — P2)

```
project(ledger?, cartridge, seed) -> ProjectionResult
  report = compatible(ledger, cartridge)
  if report.verdict === "null-ledger":
     return { ok: true, org: buildStartingOrg(cartridge, seed), generated: all, ... }   // today
  if report.verdict === "incompatible":
     return { ok: false, org: null, compatibility: report }                              // refuse, readable
  // compatible:
  runSeed = hashSeed(ledger.rngSeed, cartridge.digest)     // deterministic, no clock/random
  agents  = ledger.roster.map(m => toEngineAgent(m, cartridge))   // identity-mapped vocab
             .map(a => applyScars(a, ledger, cartridge))
             .map(a => applyGearProjection(a, ledger, cartridge)) // bounded forms only
  agents += generateSlack(cartridge, runSeed, want - agents.length)  // top-up like today
  org     = assembleOrg(cartridge, agents, ledger.precedents, ledger.grudges, ledger.gates, runSeed)
  return { ok: true, org, compatibility: report, ... }
```
`toEngineAgent` is a mapping (same vocabulary → identity on roles/attributes),
not a translation. Generated slack agents are **night-scoped**: they fill the
roster but do not persist unless a future recruitment feature promotes them
(out of scope here).

## The commit functions (Q3 — ceremonial, append-only)

```
buildConsequences(ledgerSnapshot, nightReport) -> ConsequenceSet    // shown on the consequence screen
commitVictory(ledger, night, consequences) -> ledger'
   append VictoryCommit(seq = ledger.nextCommitSeq++, ...)
   fold: apply consequences to roster/gear/fairness/precedents/grudges
   if night.clearedTier: advance ProgressionGateState (current -> cleared, open next)
commitFailedLockout(ledger, night, consequences) -> ledger'
   append FailedLockoutCommit(...)
   fold: apply scars/stress/morale/bench/attendance/bestPull
   gate unchanged unless cartridge.partialProgressionAllowed
```
Both are pure `(ledger, night) -> ledger'`; the returned ledger's derived state
equals `fold(commits, founding)` (P6). Nothing persists before the player clicks
**Commit to Guild Record**.

## Contracts, restated as acceptance-testable statements

- **Determinism:** `project(L, C, s)` is referentially transparent; `hashSeed`
  is the only entropy; no `Date`/`Math.random`/fetch/world import appears in the
  projection or commit paths.
- **Migration:** loading a `CampaignLedger` whose `schemaVersion` is older runs
  registered forward-migrations to current; additive ones are automatic,
  destructive ones must ship a migration function + a note. Cartridges are never
  embedded, so no cartridge is ever migrated by the ledger.
- **Vocabulary:** every cartridge-bound field carries `{id, cartridgeDigest}`;
  projection maps such a reference into a new cartridge only when
  `profileDigest` matches; otherwise the reference stays memory-only (display).

## The acceptance walk, mapped to the model

1. **Start tier 1, no ledger** → `project(undefined, cart1, seed)`.
2. **Fresh guild** → returns `buildStartingOrg(cart1, seed)` (null-ledger path).
3. **Clear The Hollow Choir** → the loop produces a cleared `RunReport`.
4. **Victory consequence screen** → `buildConsequences(...)` renders the
   `ConsequenceSet` (loot, morale, scars, precedents, legends, gate effects).
5. **Commit** → `commitVictory` mints a `CampaignLedger` (founding = this night's
   guild), appends the `VictoryCommit`, records `TierRecord` for cart1's digest.
6. **Open tier 2** → load `cart2` (a compatible sibling by profile).
7. **Compute compatibility** → `compatible(ledger, cart2)` → `verdict:
   "compatible"` on matching `profileDigest`.
8. **Project into tier 2** → `project(ledger, cart2, seed)` returns an `org` with
   the same `AgentMemory` people (morale, stress, growth, loyalty), carried
   `BossScar`s, `FairnessMemory`, `Precedent`s, and `ProgressionGateState`.
9. **Tier 1 stays standalone** → `cart1` is untouched read-only content;
   `project(undefined, cart1, seed)` still plays a fresh guild, forever.
10. **Refuse incompatible cleanly** → `compatible(ledger, someOtherCart)` returns
    `verdict: "incompatible"` with a `remedy` and a readable `message`; `project`
    returns `{ ok: false, org: null }`. No guess, no corruption.

## What this leaves for implementation (when accepted)

- **The seam swap:** `raid-night.ts` line 71, `buildStartingOrg(...)` →
  `project(ledgerOrUndefined, cartridge, seed).org` (with an `ok:false` branch
  that renders the `CompatibilityReport` instead of a party).
- **Commit plumbing:** a consequence screen that shows `buildConsequences(...)`,
  a **Commit to Guild Record** action, and `commitVictory` /
  `commitFailedLockout`.
- **Ledger I/O:** local-first load/save + export (arc-owned, Q4), versioned.
- Everything else — the engine, the diagnosis, the pull loop — is unchanged.

## Deferred (explicit, not silent)

- Adapter cartridges that declare a mapping between profiles (Q2).
- Recruitment / promoting night-scoped generated agents into the roster.
- World mirroring / notarization of ledger exports as provenance (Q4).

*No code lands against this RFC until accepted. On acceptance, update
`docs/GUILD_CAMPAIGN.md` and axm-genesis `docs/CONTINUITY.md`'s index in the same
change.*
