# UNDERDRAIN continuous authored-pilot candidate

**Status:** isolated post-v1 demonstration donor  
**Release effect:** none  
**Book IV effect:** none  
**World authority:** presentation and provisional execution only  
**Player-comprehension claim:** not earned until an independent one-a.m. receipt passes

## Creator idea

A new creator begins with one sentence:

> A municipal plumber is drafted into a war against the hidden fungus kingdom causing every drain problem in town.

The original cartridge is **UNDERDRAIN: The Bloom Below**. It uses no names, characters, visual assets, dialogue, or setting from an existing franchise.

## Production rails

The package uses the durable long-running ensemble-comedy structure extracted from the American Dad analysis without copying that series' expression:

1. stable character methods generate plot rather than bending to it;
2. municipal institutions play absurd stakes completely straight;
3. the household B-plot materially collides with the action A-plot;
4. escalation follows from prior choices;
5. the ostensible enemy receives a legible causal model;
6. action reveals the hidden cause rather than a result card explaining it afterward;
7. accepted outcomes pay persistent world and relationship state;
8. the episode may restore ordinary function, but cannot erase precedent or debt.

The continuous pilot is:

```text
Mrs. Kett service call
  → inspect the living trap joint
  → restore one household's water
  → municipal draft and method commitment
  → Pump Seven
       diagnose and reroute three spore valves
       hold the purge wheel at shared-flow pressure
       balance the Crown Sluice
  → discover the fungal nursery and Bellwether discharge during play
  → exact Arc replay and accepted consequence
  → visible Bellwether / Crown state changes
  → playable Parley at the Root Gate
```

The controlling hidden cause is deliberately absent from the pre-action narrative ledger. The player learns it through the authored Pump Seven objectives.

## Arc authority

`src/demos/underdrain/` now owns:

- one validated engine-1.4 Arc;
- three challenges: service call, Pump Seven, and Root Gate;
- `axm-action-profile/1` for the two action encounters;
- `axm-action-objectives/1` with zero-pressure, interaction, and hold objectives;
- `axm-authored-experience/1` binding entry, commitments, mechanisms, reveals, consequences, checkpoints, and the implemented successor;
- persistent cartridge state for water pressure, Mrs. Kett's service, fungal contact, Crown grievance, Rhea's status, evidence custody, and Root Gate access;
- three Pump Seven entry methods with runtime-visible information, actor, route, and affordance changes;
- one `axm-narrative-rails/1` constitution;
- five stable actor policies;
- the pre-action episode state without the hidden-cause reveal;
- one `axm-action-narrative-binding/1` with success, partial, and failure consequences.

The action result is never inferred from narrative preference. `ingestAcceptedActionReceipt` first replays and verifies the exact `axm-action-receipt/1`, then emits a fact and consequence candidate through the ordinary narrative sorter and commit authority.

## Semantic objective law

The service call is a safe action encounter:

```text
inspect-living-trap    interact_count 1    pressure enemies 0
restore-kett-water     hold_ticks 45       pressure enemies 0
```

Pump Seven is not an enemy-clear encounter wearing plumbing labels:

```text
diagnose-spore-valves  interact_count 3    pressure enemies 2
operate-purge-wheel    hold_ticks 90       pressure enemies 2
open-crown-sluice      hold_ticks 75       pressure enemies 2
```

Pressure actors may be subdued to reduce danger. They do not satisfy the mechanism objective. The accepted receipt records mechanism target identity, progress, interaction count, hold ticks, and terminal result.

Root Gate is an authored-choice experience rather than a combat wave. It contains three actual compact commitments and is present in the cartridge as the next enterable experience.

## State and consequence

Pump Seven's accepted success, partial, and failure outcomes each update visible Arc-owned state and open the Root Gate under different conditions:

- success restores strong water pressure, preserves the nursery route, lowers Crown grievance, and recognizes Rhea as liaison;
- partial restores uneven pressure, confirms the Crown, and carries a ceasefire debt;
- failure gives the Crown control of Pump Seven, triggers rationing pressure, and forces Bellwether to negotiate access under fungal terms.

World may not display these as committed campaign changes until Arc has accepted the action trace.

## Standalone World product

The exact generated authoring manifest is mirrored by the World product. World may:

- stage the service call, draft, method commitment, action encounters, and Root Gate;
- render the 30 Hz action law;
- collect keyboard, pointer, touch, controller, or XR input;
- present authored mechanism targets and in-play reveals;
- produce a provisional trace and terminal state;
- send that trace to exact Arc replay;
- render accepted world deltas and the next experience after acceptance.

World may not:

- turn a provisional result into an accepted action fact;
- alter the accepted outcome;
- close an obligation without Arc;
- assign a campaign effect to physical or browser observations;
- issue its own one-a.m. comprehension receipt.

## Acceptance tiers

The Arc donor must prove:

- safe zero-pressure service action;
- mechanism-driven Pump Seven completion;
- all three methods on the same stable-character rail;
- hidden cause absent from pre-action prose and present in in-play reveal law;
- real successful and failed receipt return;
- persistent state effects;
- an implemented Root Gate successor;
- deterministic generation of the authoring manifest.

The World donor must separately prove:

- exact semantic Arc-to-C# parity;
- a directed desktop/mobile first session;
- accepted consequence before visible campaign mutation;
- checkpoint/reload continuity;
- Root Gate entry from each Pump Seven outcome;
- zero required external runtime dependency for the standalone route.

Finally, an independent cold player who did not author or inspect the candidate must pass `rodoh-one-am-player-receipt/1`. Until that observation exists on the same candidate identity, the correct label remains **authored-pilot candidate**, not accepted playable pilot.
