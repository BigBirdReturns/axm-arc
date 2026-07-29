# AXM Action Player Floor adoption: Arc

The controlling floor is accepted in Tier Bench:

```text
floor custody head   738b357e8dcb452ce12b354a67ef373dbb5e321d
functional floor     9cc2a1e8e1c1f3722ecbf78828c75e2afc50e895
catalog              actionfloor1_55eb8869417b3b36a28a309263624fe04ad07028f2254337a2f1548cd03b47d8
report               actionfloorreport1_190434fd82b36c0877c55a4cde8cd2e4c0c0f64876d59907fa104f522b36f46e
UNDERDRAIN intent    playerintent1_91647652ca3f387b114d5fa7cfab416e2d99c5f307098b6426a17f624cdfbe6c
```

Read the floor at `BigBirdReturns/tier-bench/action_player_floor/START_HERE.md` before changing action timing, damage, objectives, semantic cues, mechanic learning, difficulty profiles, replay, receipts, or campaign consequences.

## Arc ownership

Arc owns:

- action specifications and deterministic state transitions;
- startup, active, recovery, defense, invulnerability, stagger, and defeat windows;
- damage, objective, mechanism, outcome, replay, and receipt law;
- presentation-neutral semantic cue meaning and deterministic cue timing;
- teach, practice, mastery, timing profiles, and alternate completion;
- accepted campaign consequences.

Arc does not own:

- Unity or browser clips, prefabs, shaders, particles, sounds, camera, HUD, subtitles, haptics, or presentation providers;
- device bindings and control schemes;
- engine or human evidence;
- final player-product acceptance.

## Required cue boundary

Arc must state what happened and when without naming how it looks or sounds. Browser and C# must reconstruct the same ordered cue vector. World maps those cues to presentation and may not infer gameplay timing from animation.

## Required learning boundary

A mechanic may become mandatory only after:

```text
teach    safe or low-damage introduction
practice optional advantage with the same cue language
master   authored test with an explicit alternate when precision timing is not the core verb
```

UNDERDRAIN parry therefore requires a forgiving introduction, optional Pump Seven advantage, Crown mastery, and a shorter dodge-or-exhaustion work opening.

Arc issue #191 owns the implementation. Runtime 1.0 and 1.1 bytes remain exact unless a reviewed migration explicitly changes them. The floor remains `productAccepted: false`.
