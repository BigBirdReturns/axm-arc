# AXM action runtime v1

## Classification and authority

Engine 1.4 adds a deterministic action-adjudication authority to AXM Arc. It is
an optional way to resolve an ordinary Arc challenge through human action input
rather than through the statistical resolver. The actors remain distinct:

- the cartridge authors challenge meaning, objectives, consequences, access,
  rewards, and optional bounded action presentation law;
- Arc compiles that law into one `axm-action-spec/1`, advances the fixed-step
  simulation, verifies the resulting `axm-action-receipt/1`, and commits its
  outcome through the ordinary cycle;
- a compatible player such as Rodoh World samples controls and renders state;
  it does not own combat law or campaign consequences;
- the run holder keeps the exact receipt and can replay it without a service,
  model, account, or network connection.

The action path does not ask the statistical resolver to reroll a fight after
play. A verified receipt is the encounter result. Rewards, stress,
relationships, progression, cartridge state, and custody continue through the
existing deterministic cycle after that result has been accepted.

## Generic compilation

Every schema-valid challenge can compile without adding `axm.action@1`.
`compileActionEncounter(arc, challenge, difficultyModeId)` derives:

- one ordered action objective from every mechanic check;
- an enemy kit from each check's failure consequence;
- bounded enemy count from threshold, scope, and optional authored scale;
- a player moveset from challenge shape and difficulty;
- an arena kit from mechanic count and time pressure;
- success, partial, and failure thresholds from completion criteria;
- the action duration from authored time pressure or bounded defaults;
- one digest covering exact cartridge identity, mode, law, and runtime version.

Difficulty-mode composition is Arc-owned. The caller supplies the base
challenge and optional mode ID; Arc applies the registered mode before compiling
its added or scaled mechanics. This prevents different players from inventing
different heroic law.

The compiler contains no challenge-ID branch. An unbundled cartridge receives
the same derivation as a bundled one.

## Optional authored profile

A cartridge may make selected choices explicit under its namespaced extension:

```json
{
  "extensions": {
    "axm.action@1": {
      "format": "axm-action-profile/1",
      "encounters": {
        "challenge-id": {
          "arenaKit": "ring",
          "playerKit": "blade",
          "durationSeconds": 60,
          "arenaScale": 1,
          "enemyScale": 1,
          "objectiveOrder": ["first-check", "second-check"],
          "objectiveKits": {
            "first-check": "duelist",
            "second-check": "swarm"
          }
        }
      }
    }
  }
}
```

The bounded v1 vocabulary is intentionally small:

| Dimension | Values or range |
|---|---|
| Arena kit | `ring`, `lane`, `islands` |
| Player moveset | `staff`, `blade`, `hammer` |
| Enemy kit | `skirmisher`, `duelist`, `swarm`, `hexer`, `breaker` |
| Duration | 20 through 600 seconds |
| Arena scale | 0.5 through 2.0 |
| Enemy scale | 0.5 through 2.0 |
| Wave population | 1 through 12 active enemies |

The schema rejects unknown challenge IDs, unknown objective IDs, duplicate or
incomplete objective order, unknown fields, out-of-range values, and an engine
floor below 1.4. The Workshop exposes every bounded choice and can either
materialize explicit law for the whole cartridge or return an encounter to the
generic compiler.

## Low-power simulation law

The simulation runs at 30 fixed integer ticks per second. Position, range,
movement, health, timings, cone checks, hit resolution, AI transitions, and
spawns use bounded integer arithmetic. Render refresh rate is not simulation
law. The v1 kernel imports no physics engine, navigation package, inference
runtime, or network client.

Each tick advances:

1. normalized movement, aim, and rising-edge action input;
2. player startup, active, recovery, dodge, parry, stagger, or defeat state;
3. at most twelve enemies through approach, telegraph, active, recovery,
   stagger, or defeat state;
4. the active objective and any next bounded wave;
5. terminal success, partial, or failure classification.

The hot path does not canonicalize or sort the complete state every tick.
Canonical ordering is applied only when evidence is digested. The state machine
emits deterministic presentation events for wave start, player action, hit,
parry, dodge, objective completion, and encounter completion. A renderer may
turn those events into animation, sound, camera response, and effects without
changing the result.

## Input and receipt custody

Input is a quantized, renderer-independent record:

```text
moveX, moveY     -1 | 0 | 1
aimX, aimY       -1 | 0 | 1
buttons           light | heavy | dodge | parry bitmask
```

Consecutive identical ticks are run-length compressed. A receipt contains:

- exact cartridge digest and action-spec digest;
- challenge, mode, cycle, deterministic seed, party, and controlled agent;
- the complete compressed input trace;
- objective progress, terminal outcome, health, and combat statistics;
- independent trace, terminal-state, and whole-receipt digests.

Verification reparses the bounded schema, reconstructs the expected seed and
spec from Arc authority, replays every tick, refuses trailing input after the
terminal state, and compares the complete rebuilt receipt. A changed party,
mode, cycle, law, input, result, state, or digest is refused before token debit
or campaign mutation.

## Campaign integration

`ChallengeAssignment.actionReceipt` selects action adjudication. Admission still
checks challenge access, attunement, party count, roles, agent availability, and
composition. Action v1 refuses statistical resource spending because the
existing spend lever narrows a probability distribution and has no honest
meaning in a skill-resolved encounter.

After verification, Arc converts the action result into the ordinary
`RunReport`. Loot is seeded from the exact receipt. Assignment history,
downtime, rewards, stress, relationships, morale, infrastructure, recruitment,
progression, narrative events, cartridge state, save checkpoints, and portable
run custody continue through the same cycle that serves statistical play. The
report carries an action adjudication summary with the receipt, spec, trace,
and state digests.

## Acceptance estate

The permanent action tests cover profile validation, generic and explicit
compilation, difficulty-mode ownership, fixed-step success and failure,
parry/dodge evidence, untouched future-objective accounting, receipt replay and
tamper refusal, cycle mutation boundaries, guided Workshop authoring, and the
engine-version floor.

The estate gate compiles and clears all 48 challenges across The First Charter,
The Waking Tower, The Kind Gods of Ilyon, The Lamp District, The Relief Circuit,
and Orchard at Low Tide through one kernel. Every challenge produces a unique,
replayable receipt. The same gate asserts 30 Hz integer law and the twelve-enemy
wave ceiling.

This proves Arc authority and authoring reach. It does not by itself prove a
finished third-person player, animation set, camera, controls, encounter art, or
mobile rendering budget. Those are World receiver responsibilities and require
separate desktop/mobile evidence against the same spec and receipt.

## Failure modes and control question

Evidence tier: deterministic source, schema, replay, full-suite regression, and
multi-cartridge model acceptance. Venue: Arc engine, Workshop, and CI. Target:
portable action law and adjudication. Upside: one action kernel can serve every
ordinary cartridge while preserving campaign custody. Downside: the bounded v1
kits cannot express every combat genre. Failure mode: a player adds hidden
combat authority, performs a statistical reroll after play, or requires
challenge-specific runtime branches.

The governing control question is: can two materially different cartridges
compile into mechanically distinct fights through shared bounded law, produce
exact receipts under constrained hardware, and commit those receipts through
the ordinary campaign without any player inventing a second resolver?
