# axm-arc
## Organizational Simulation Engine — Design Authority Document v1.0

**Repository**: `axm-arc`
**Description**: Organizational simulation engine. Portable scenario format for any group of agents facing structured challenges under constraint. The first arc is a guild management game. The first raid is Karazhan.
**Stack**: TypeScript, React, PWA (browser-first, mobile-optimized, offline-capable via IndexedDB)
**License**: MIT

---

## PREFACE: HOW THIS DOCUMENT GOT HERE

This document emerged from a conversation that started as "I want a guild management game" and ended as "this is an organizational simulation engine with a game as the proof of concept."

The path was not clean. An early draft was your vibes transcribed literally with no systems knowledge behind it. A second draft imported proven mechanics from Football Manager, Darkest Dungeon, and real WoW loot distribution dynamics, but collapsed them into a WoW simulator instead of a generic engine that could run WoW-shaped content. A correction to separate engine from content overcorrected into stripping the reference implementation entirely. A survey of structural diversity across EverQuest, FFXIV, Old School RuneScape, and Guild Wars 1 revealed that the schema needed to accommodate fundamentally different organizational structures: 72-player raids with per-character flagging, strict 8-player compositions with role enforcement, 1-8 player scalable difficulty with no roles at all, and PvP scenarios where the "encounter" is another organization.

The breakthrough: swap "raid boss" for "contract deliverable" and "guild hall" for "org chart" and you're modeling any organization facing structured challenges under resource constraints with imperfect information about its own people. The engine isn't a game engine. The game is the first arc.

Every design mistake in this document's history was the same mistake: **collapsing layers that need to be separate.** Engine vs content. Generic vs specific. System vs implementation. This document exists to prevent that collapse from happening again during the build.

---

## PART 1: THE ENGINE

The engine is a deterministic organizational simulation. It models a group of agents managed by a single decision-maker (the player) who must allocate those agents against structured challenges defined by a loaded scenario (an arc). The engine knows nothing about fantasy, raids, guilds, or games. It knows about agents, attributes, challenges, relationships, resources, and stress.

### 1.1 Core Concepts

**Agent**: An individual with attributes, personality traits, relationship state, morale, and stress. Agents are the fundamental unit the player manages.

**Organization**: The player's managed group of agents. Has a reputation score, resource stockpiles, and infrastructure (base facilities).

**Arc**: A loadable scenario definition file (JSON) that defines the domain, challenges, progression structure, reward tables, and narrative events. The arc tells the engine what the organization is trying to accomplish. The engine runs the simulation.

**Challenge**: A structured task defined by the arc. Has requirements (how many agents, what attribute checks), difficulty parameters, and outcomes. Challenges are not played by the player. They are simulated by the engine based on the assigned agents and their current state.

**Cycle**: One unit of game time. The player makes all decisions (assignments, resource allocation, drama resolution), then advances the cycle. No real-world clock. The game waits.

### 1.2 Agent Model

Every agent in the engine has the following structure. The arc defines the domain-specific names and flavor. The engine defines the mechanical system.

#### 1.2.1 Primary Attributes

The arc defines how many primary attributes exist (minimum 3, maximum 8) and what they're called. The engine treats them as a numeric array. Each attribute is an integer from 1 to 20.

Example: A fantasy raid arc might define 5 attributes (Power, Resilience, Precision, Adaptability, Focus). A corporate arc might define 4 (Technical Skill, Communication, Endurance, Creativity). The engine doesn't care about the names. It cares about the numbers and how challenges reference them by index or ID.

**Stat Budgets by Tier**: Agents are generated within tier-defined stat budgets. The arc defines the number of tiers and the budget range for each. The engine's character generator distributes points within the budget according to role-weighting rules also defined in the arc.

#### 1.2.2 Hidden Attributes (Engine-Level)

These exist in every arc because they model universal organizational dynamics, not domain-specific performance. They are not visible to the player at agent recruitment. They surface through observation (after N assigned challenges, one is revealed; after M, all are visible).

- **Loyalty**: Resistance to dissatisfaction. High-Loyalty agents tolerate more disappointment before relationship degradation. Low-Loyalty agents are flight risks. Range 1-20.
- **Ambition**: Growth rate modifier AND drama trigger frequency. High-Ambition agents improve faster but demand more (better assignments, more rewards, recognition). They also hoard resources in DKP-style systems and create political dynamics. Range 1-20.
- **Volatility**: Variance in performance. An agent with Volatility 4 performs consistently near their attribute scores. An agent with Volatility 18 will occasionally produce results far above or below their stats. This maps to the real phenomenon of "brilliant but unreliable" team members. Range 1-20.
- **Leadership**: Influence weight in relationship propagation. High-Leadership agents' morale and stress states have amplified effects on nearby agents. When a high-Leadership agent enters an affliction state, it hits the team harder. When they rally, it lifts more. Range 1-20.

**Reveal cadence**: After 3 assigned challenges, one hidden attribute is revealed (randomly selected). After 8 assignments, all four are visible. This models the real-world phenomenon of not truly knowing a team member until you've worked with them through enough situations.

#### 1.2.3 Personality Traits

Each agent has 2-3 personality traits drawn from a pool. The engine ships with a default trait pool (~30 traits). Arcs can extend or replace it.

Traits have mechanical effects that modify engine calculations. They are NOT flavor text. Examples from the default pool:

- **Industrious**: +30% efficiency in infrastructure (base operations) assignments
- **Greedy**: 2x morale penalty from reward disappointment
- **Mentor-Inclined**: Can form Mentorship relationships with one tier gap instead of the standard two
- **Loner**: Relationship formation rate halved, but immune to stress propagation from Hostile relationships
- **Hothead**: +20% chance of Reckless affliction when stress threshold is hit, but +10% to highest primary attribute when morale > 80
- **Stoic**: -30% stress accumulation rate, but -50% morale gain from positive events
- **Perfectionist**: +15% to Precision-equivalent checks, but +1 stress on any partial-success outcome
- **Team Player**: Relationship affinity gains at 1.5x rate, but morale is more sensitive to team losses
- **Ambitious** (trait, distinct from the hidden attribute): Visible signal that the hidden Ambition attribute is likely high. Not guaranteed. A misdirection mechanism.

First trait is visible at recruitment. Second surfaces after 5 assignments. Third after 12.

#### 1.2.4 Role Affinity

The arc defines available roles (if any). Some arcs have strict roles (tank, healer, DPS). Some have no roles at all (OSRS-style). Some have fluid roles (GW1-style, where "build" matters more than "class").

If the arc defines roles, each agent has a primary role and optionally a secondary. Assigning an agent to their secondary role applies a configurable penalty (default: -20% to relevant attribute weights in challenge checks).

If the arc defines no roles, this system is inactive.

#### 1.2.5 Infrastructure Efficiency

Each agent has a **Base Efficiency** stat that determines their productivity in infrastructure assignments (the equivalent of "base operations" in a game, or "administrative work" in an org sim). This stat is inversely weighted by tier: lower-tier agents are naturally better at infrastructure work. This is the mechanical core of the "no trash units" principle. Your highest-performing challenge agents are your worst infrastructure workers, and vice versa.

Formula: `base_efficiency = 20 - (tier_midpoint_attribute_average * 0.6) + trait_modifiers`

This means a Common-tier agent with average stats of 9 has a base_efficiency around 14.6 before traits. A Legendary agent with average stats of 18 has a base_efficiency around 9.2. The Industrious trait adds +30%, making a Common Industrious agent dramatically more efficient than a Legendary agent at infrastructure work.

#### 1.2.6 Cost

Each agent has an upkeep cost per cycle, determined by tier. Higher-tier agents cost more to maintain. This means recruiting a Legendary agent when your resource economy can't support them is possible but dangerous: they drain resources, demand attention, expect high-quality assignments, and create drama when those expectations aren't met.

### 1.3 Challenge Resolution Engine

Challenges are simulated, not played. The player assigns agents to a challenge. The engine runs the simulation and returns a report.

#### 1.3.1 How a Challenge is Structured (Arc-Defined)

```
challenge:
  id: string
  name: string
  description: string            # visible after Library/intel research
  
  roster_requirements:
    min_agents: int
    max_agents: int
    role_requirements:           # optional, only if arc defines roles
      - role_id: string
        count: int
    
  access_requirements:           # who can participate
    org_milestones: [string]     # org must have cleared these challenges
    agent_attunements: [string]  # each assigned agent must have these attunement flags
    attunement_threshold: float  # optional: fraction of assigned agents that must be attuned (EQ 85% rule)
  
  difficulty_rating: int         # 1-100, used for stress calculations and report generation
  
  mechanic_checks:               # the core of resolution
    - id: string
      name: string
      description: string
      attribute_weights:         # which attributes matter and how much
        - attribute_id: string   # references arc-defined attribute
          weight: float          # 0.0-1.0, must sum to 1.0
      difficulty_threshold: int  # score needed to pass
      scope: enum [per_agent, team_aggregate, role_specific]
      failure_consequence:
        type: enum [agent_damage, team_damage, stress, debuff, cascade]
        severity: float          # 0.0-1.0 scale
        
  completion_criteria:
    type: enum [all_mechanics_passed, threshold_passed, dps_check, survival_check, composite]
    parameters: {}               # type-specific parameters
    
  time_pressure:                 # optional enrage/deadline mechanic
    rounds: int
    aggregate_threshold: int     # total team output needed within rounds
    attribute_id: string         # which attribute feeds the time pressure check
    
  outcomes:
    success:
      reward_table: [string]     # item IDs with drop rates
      narrative: string
      reputation_gain: int
      milestone_flag: string     # org-level flag set on first clear
    partial:
      reward_table: [string]     # reduced rewards
      narrative: string
      agent_downtime_cycles: int # how long downed agents are unavailable
    failure:
      narrative: string
      stress_penalty: int
      token_refund: float        # 0.0 = no refund, 0.5 = half token back, etc.
```

#### 1.3.2 The Resolution Formula

For each mechanic check, for each agent in scope:

```
raw_score = sum(
  agent.attribute[check.attribute_id] * check.weight
  for each weighted attribute in the check
)

# Gear bonus: sum of relevant stat bonuses from equipped items
gear_bonus = sum(
  equipped_item.stat_bonus[check.primary_attribute_id]
  for each equipped item on agent
) * 0.5  # gear contributes but doesn't dominate

# Context modifiers
relationship_mod = sum(
  +2 for each Allied agent also assigned to this challenge
  -3 for each Hostile agent also assigned to this challenge
  +4 for each Bonded agent also assigned to this challenge
  +1 for each Mentor/Mentee pair on this challenge
) / agent_count  # averaged to prevent scaling abuse

morale_mod = (agent.morale - 50) / 10
# morale 70 = +2, morale 30 = -2, morale 50 = 0

affliction_mod = affliction_penalty if agent is Afflicted else 0
# Resentful: -3, Fearful: -4, Defiant: -1 (but +2 stress to team), Reckless: 0 (but Volatility maxed)

# Bounded randomness
variance = uniform_random(-8, +8)

# Volatility swing: high-volatility agents have wider variance
if agent.volatility > 14:
  volatility_swing = uniform_random(-5, +10)
elif agent.volatility > 10:
  volatility_swing = uniform_random(-3, +5)
else:
  volatility_swing = 0

# Final score
score = raw_score + gear_bonus + relationship_mod + morale_mod + affliction_mod + variance + volatility_swing
```

If `score >= check.difficulty_threshold`: pass. 
If `score < threshold`: fail, apply `failure_consequence`.

For `scope: team_aggregate` checks, sum all agents' scores and compare against `threshold * agent_count`.

For `scope: role_specific` checks, only agents in the specified role are evaluated.

#### 1.3.3 Time Pressure (Enrage) Check

If the challenge has a `time_pressure` block:

```
total_output = sum(
  agent.attribute[time_pressure.attribute_id] + gear_bonus + morale_mod
  for each agent in relevant role
) * time_pressure.rounds

if total_output < time_pressure.aggregate_threshold:
  result = failure (enrage)
```

This models DPS checks, delivery deadlines, and any scenario where the organization must produce enough output within a time constraint.

#### 1.3.4 Outcome Determination

After all mechanic checks and time pressure checks:

- **Success**: All checks passed (or composite criteria met). Full rewards. Milestone flag set on first clear.
- **Partial**: Some checks failed but survival criteria met. Reduced rewards. Some agents may be "downed" (unavailable for N cycles).
- **Failure**: Survival criteria not met or enrage triggered. No rewards. Stress applied to all assigned agents. Token spent.

#### 1.3.5 Run Reports

The engine generates a structured report from the resolution:

```
report:
  challenge_id: string
  outcome: enum [success, partial, failure]
  cycle: int
  assigned_agents: [
    {
      agent_id: string
      mechanic_results: [
        { mechanic_id: string, score: int, threshold: int, passed: bool }
      ]
      performance_rating: float   # normalized 0-1 across all checks
      stress_gained: int
      was_downed: bool
    }
  ]
  loot_drops: [{ item_id: string, eligible_agents: [string] }]
  drama_triggers: [{ type: string, agents_involved: [string] }]
  narrative_seed: int             # deterministic seed for narrative generation
```

The **presentation layer** (the game) converts this structured report into readable narrative. The engine outputs data. The game outputs story.

Example of how the game layer would render a report:

> *Moroes went down after a messy start. Vex nearly wiped the group by missing two interrupt windows (mechanic "Guest Crowd Control": score 48 vs threshold 55). But Lira pulled the party through on heals (mechanic "Sustained Healing": score 62 vs threshold 52, passed with margin). Korrin carried damage, posting the highest output. Stress was moderate. Vex gained 2 stress from the near-failure.*
>
> **Loot: [Crimson Girdle] — eligible: Brennan, Jorah**
> [Award to Brennan] [Award to Jorah] [Disenchant]

The engine doesn't write this text. It provides the data. The game layer has narrative templates that consume the data and produce human-readable output. Different game implementations could render the same report data in different tones, languages, or formats.

#### 1.3.6 Determinism

Given the same inputs and random seed, the encounter resolver must produce identical results. This enables:
- Replay of memorable runs
- Community verification of arc balance
- Debugging
- "What-if" analysis (what would have happened with a different roster?)

The random seed is generated at the start of each challenge attempt and stored in the save file.

### 1.4 Relationship Web

Relationships are tracked between pairs of agents. They evolve through shared experience, resource allocation decisions, and personality interactions. This system models universal organizational dynamics: alliance, rivalry, hostility, mentorship, and deep bonds.

#### 1.4.1 Relationship States

- **Neutral** (default): No mechanical modifier.
- **Allied**: +2 per agent to relationship_mod in challenge checks when both are assigned. Develops from: repeated shared successes, compatible personality traits.
- **Rivalrous**: +1 per agent to relationship_mod (competitive boost), BUT if one significantly outperforms the other (>15% performance differential), the underperformer gains +1 stress. Develops from: same role, similar tier, high Ambition on both.
- **Hostile**: -3 per agent to relationship_mod. +1 stress per cycle when both are assigned to the same challenge. Develops from: reward disputes, betrayed expectations, affliction bark targeting, personality clash.
- **Mentorship**: +1 to relationship_mod for both. Mentee's stat growth rate increased by 25% when assigned to Training. Requires: tier gap of 2+, positive or neutral relationship, compatible role affinity. The mentor gains a small morale boost (sense of purpose).
- **Bonded**: +4 per agent to relationship_mod. BUT if one agent leaves the organization or is permanently downed, the other enters an automatic affliction state (Grieving: -4 to all checks for 3 cycles, then resolves to a permanent -1 morale floor). Develops from: extended Allied state (10+ shared challenges with Allied status). Rare and powerful but creates fragility.

#### 1.4.2 Relationship Transition Triggers

Relationships shift through concrete events, not timers:

**Shared successful challenge**: +affinity (moves toward Allied)
**Shared failure**: Weighted by personality:
  - If both agents have Team Player trait: +affinity (shared adversity)
  - If either has Hothead or Ambitious: -affinity (blame)
  - Default: no change

**Reward allocation** (the big one):
When a reward drops from a challenge and multiple agents are eligible, the player must decide who receives it. The non-recipients' relationships are affected:
  - Relationship with recipient: -affinity, scaled by:
    - Size of the upgrade (how much better the item is than their current)
    - How long they've been waiting for a comparable reward
    - Their Loyalty attribute (high Loyalty = smaller hit)
    - Whether the player made any prior commitments ("I'll get you the next one")
  - Relationship with the player (tracked as organization loyalty): -loyalty, same scaling factors
  - In DKP-style systems: the economic mechanism replaces the direct decision, but hoarding and inflation create their own resentments

**Promotion/demotion**: Promoting an agent to Officer status boosts their morale but may trigger Rivalrous with peers at the same tier. Demoting an agent triggers -morale and potential Hostile shift with whoever replaced them.

**Benching**: Removing an agent from an expected assignment. Morale hit scaled by how consistent their assignment history has been. An agent who has been on every challenge run and gets benched for one takes it harder than an agent who rotates regularly.

**Affliction barks** (see Stress System): When an agent is Afflicted, they generate negative events that target specific other agents, adding stress and degrading relationships.

#### 1.4.3 Precedent Memory

The relationship system tracks precedents as structured records. Every reward allocation, promotion, and benching decision is logged in a precedent store with the following shape:

```
precedent:
  cycle: int                      # when the decision happened
  type: enum [reward, promotion, benching, assignment]
  decision_basis: enum [merit, seniority, need, favoritism, rotation]
  agents_involved: [string]       # agent IDs affected
  winner: string                  # agent ID who benefited (if applicable)
  context: {}                     # type-specific data (item_id, challenge_id, etc.)
```

When a new decision is made, the engine scans the precedent store (lookback window: last 10 precedents of the same type) and computes a **consistency score**: how often the same `decision_basis` was applied. High-Ambition agents weight the most recent 5 precedents at 2x. High-Loyalty agents weight all 10 equally.

If the current decision's basis contradicts the dominant pattern (e.g., awarding by seniority when 7 of the last 10 were merit-based), a **precedent violation penalty** applies:
- All agents with Ambition > 12 who witnessed the decision: -2 loyalty to the player
- The penalty scales by 0.5x for each additional violation (they stop being surprised)
- A Drama Event Card fires if 3+ agents are affected simultaneously

This means: your reward policy decisions are not isolated. Every decision teaches the organization what to expect, and violations of established patterns cost more than the initial decision would have. The precedent store is included in the save file and is part of the deterministic state.

### 1.5 Stress and Morale System

Adapted from Darkest Dungeon's stress/affliction cascade, translated to organizational dynamics.

#### 1.5.1 Morale (Background State)

Range: 0-100. Drifts slowly based on:
- Reward satisfaction: morale trends toward 70+ when agents receive rewards proportional to contribution. Trends toward 30- when passed over repeatedly.
- Win/loss: successful challenges boost morale. Failures degrade it. Streaks amplify the effect.
- Relationships: agents with mostly Allied relationships have a morale floor above 40. Agents surrounded by Hostile relationships have a morale ceiling below 60.
- Infrastructure quality: higher-level facilities provide a morale bonus to agents resting or working there.
- Officer status: officers get a morale floor of 45 (status provides stability).

Morale affects challenge performance (see morale_mod in resolution formula) and stress susceptibility (low morale agents accumulate stress faster).

#### 1.5.2 Stress (Acute Pressure)

Range: 0-10. Accumulated per-challenge and from events:
- Failed challenge: +1-3 stress based on difficulty_rating
- Watching an allied/bonded agent get downed: +2 stress
- Being assigned with a Hostile agent: +1 stress
- Being benched when expected to participate: +1 stress
- Receiving an affliction bark from a nearby Afflicted agent: +1 stress
- Being passed over for a reward: +1 stress (modified by Loyalty)

Stress reduces by 1 per cycle when the agent is assigned to rest at the Tavern-equivalent infrastructure. Mentorship pairs reduce the mentee's stress by 1 additional per cycle. The Stoic trait reduces all stress accumulation by 30%.

#### 1.5.3 The Affliction Threshold

When stress reaches 10, a resolution event fires. This is the fork that makes the system dramatic:

**~75% chance: Affliction.** The agent enters one of the following states:

- **Resentful**: -3 to all challenge check scores. Generates barks targeting the highest-performing agent on shared challenges ("must be nice to be the favorite"). Morale drain on nearby agents.
- **Fearful**: -4 to challenge checks. Agent may "refuse" an assignment (25% chance per cycle of auto-unassigning from a challenge, forcing the player to find a replacement). Stress propagation to nearby agents via anxious behavior.
- **Defiant**: -1 to challenge checks, but +2 stress to all other agents on shared challenges. The agent is actively disruptive: questioning decisions, undermining leadership, creating faction dynamics. High-Leadership Defiant agents are organizational crises.
- **Reckless**: No direct penalty to scores, but Volatility is temporarily set to 20. The agent will either perform brilliantly or catastrophically, with no consistency. Generates excitement or dread in other agents based on outcomes.
- **Withdrawn**: -2 to challenge checks, -50% relationship interaction rate. The agent stops participating in org dynamics. No barks, no drama, but also no mentorship, no allied bonuses. They're physically present and emotionally absent.

Affliction type is weighted by personality traits and affliction history. An agent who has been Resentful before is more likely to become Resentful again (Darkest Dungeon's affliction history pattern). Hothead trait weights toward Defiant and Reckless. Stoic weights toward Withdrawn.

**~25% chance: Resolve.** The agent rallies under pressure. Effects:
- Stress resets to 0
- Temporary +3 to all challenge checks for 2 cycles
- Morale boost to all agents who witnessed it (on the same challenge or in the same facility)
- Relationship boost with all agents present (+affinity)
- This is the "clutch moment." It's rare enough to be memorable and mechanically significant enough to swing outcomes.

**Affliction recovery**: Afflictions clear when stress returns to 0 (via rest, mentorship, or time off). Duration depends on infrastructure quality and intervention. Untreated afflictions can cascade: an Afflicted agent's barks add stress to nearby agents, who may hit their own thresholds, creating a domino effect. This is the organizational death spiral. It happens in real guilds. It happens in real companies.

### 1.6 Resource Economy

The engine defines four resource categories. The arc names them and sets quantities.

**General Currency** (gold, credits, budget): Earned from challenge rewards and infrastructure. Spent on recruitment, infrastructure upgrades, agent upkeep, and crafting.

**Specialized Materials** (materials, data, components): Arc-specific inputs earned from challenges. Used in crafting/production (the Forge equivalent). Different challenges drop different materials, creating a reason to run varied content.

**Capacity Tokens** (lockouts, sprints, deployments): The weekly constraint. Tokens represent the organization's capacity for high-stakes efforts in a given cycle. Base regeneration rate is defined by the arc. Infrastructure investment can accelerate regeneration by up to 50%. Each progression challenge costs tokens. Farm runs of cleared challenges cost 0 tokens but consume agent time slots.

**Reputation**: Organization-wide stat. Affects recruitment pool quality, arc unlock speed, access to top-tier agents. Earned from: milestone clears, consistent performance, drama resolution quality. Lost from: unresolved affliction cascades, agent departures, extended failure streaks.

### 1.7 Reward Distribution Policies

At organization creation, the player selects a distribution policy. This choice is permanent and shapes the entire game's political dynamics. The policies are modeled on real systems that generated real organizational drama for 20+ years.

**Council (Manual)**: The player decides every reward allocation. Maximum control, maximum drama. Every multi-eligible reward is a Drama Event Card with branching consequences. This is the mode that most faithfully simulates real leadership decisions.

**Points (Automated Seniority/Attendance)**: Agents accumulate points from challenge participation. Highest bidder wins. The player manages the economy: setting prices, handling inflation, dealing with hoarding. Drama shifts from "you gave it to the wrong person" to "the system is unfair." High-Ambition agents hoard points for optimal rewards, leaving intermediate rewards unclaimed, weakening the organization. This models real DKP problems: inflation, hoarding, newcomer disadvantage.

**Rotation (Automated Fairness)**: Rewards distribute evenly. Least drama, least optimization. The organization will be less optimally equipped because rewards aren't prioritized by need. But morale will be more stable, and new agents integrate faster.

Each policy has real trade-offs because each policy had real trade-offs in actual guilds and companies. The game doesn't tell you which is best.

### 1.8 Infrastructure (Base Operations)

The organization has a physical base with upgradable facilities. Facilities are staffed by assigned agents. Agent productivity in infrastructure scales with their Base Efficiency stat, NOT their primary attributes. This is the structural mechanism that makes low-tier agents valuable.

**Engine-level facility types** (arc can rename, reskin, or add domain-specific ones):

- **Quarters** (Barracks): Determines roster capacity. Upgrade to hold more agents.
- **Production** (Forge): Crafting queue for equipment. Output scales with assigned agents' Base Efficiency. The player assigns agents here instead of to challenges. Low-tier agents with high Base Efficiency and the Industrious trait are the optimal staffing.
- **Recreation** (Tavern): Agents assigned to rest here recover stress at 2x rate. Facility level sets a morale floor for resting agents. Also affects recruitment: higher-level Recreation improves the quality of the recruitment pool.
- **Research** (Library): Unlocks challenge intel (reveals mechanic details before first attempt), recruitment intel (reveals one hidden attribute on recruits before signing), and arc lore.
- **Training**: Accelerates stat growth for assigned agents. Growth rate = base growth + (trainer's Leadership * 0.1). Mentorship pairs get an additional 25% bonus.
- **Storage** (Vault): Resource storage capacity. Determines maximum stockpile between cycles.
- **Medical** (Infirmary): Reduces downed-agent recovery time. Staffed by agents; effectiveness scales with relevant attributes.

Infrastructure runs passively. The player configures assignments and advances the cycle. This is the idle layer.

### 1.9 Recruitment Pipeline

New agents arrive through:

- **Open Pool** (Tavern Board): Random pool refreshes each cycle. Pool size and quality scale with organization Reputation and Recreation facility level. Low Reputation yields mostly low-tier agents. High Reputation surfaces higher-tier ones. Top-tier agents never appear in the open pool.
- **Targeted Search** (Scouting): Scouts are agents assigned to find specific profiles. The player sets criteria (role, minimum attribute thresholds, tier range). Success rate depends on scout's relevant attributes and the specificity of the criteria.
- **Event-Driven**: Drama resolution events can bring in new agents (a friend of a current member, impressed by how you handled a situation) or drive agents away.
- **Arc Milestone Rewards**: Certain clears unlock top-tier agents as narrative events. These are scripted per-arc. This is the only way to get the highest-tier agents. They are earned, not found.

**Imperfect information at signing**: The player sees tier, primary role (if applicable), primary attribute scores, one personality trait, and upkeep cost. Hidden attributes, secondary role affinity, remaining traits, and Base Efficiency are all hidden. This models real recruitment: you never fully know what you're getting.

Hidden information surfaces through work. After 3 assignments, one hidden attribute reveals. After 5 assignments, the second trait reveals. After 8 assignments, all hidden attributes are visible. After 12 assignments, all traits are visible.

### 1.10 Per-Agent State Tracking

This is critical and was missing from earlier drafts. The engine tracks state at the agent level, not just the organization level:

- **Attunement flags**: Each agent has a set of attunement flags. Attunement chains in the arc define prerequisites for specific challenges. Different agents may have different access levels. Agent A might be attuned for Tier 3 while Agent B is still on Tier 1. This creates a management imperative: you need to run old content with new recruits to get them attuned for progression. This is a feature, not busywork. It gives old content ongoing purpose and creates a reason to invest in your whole roster.

- **Assignment history**: The engine records which challenges each agent has been assigned to, with outcomes. This feeds: trait reveal cadence, hidden attribute reveals, relationship development, and the precedent memory system.

- **Affliction history**: Which affliction types each agent has experienced. Feeds future affliction weighting.

- **Reward history**: What rewards each agent has received and when. Feeds reward expectation calculations and drama trigger weighting.

### 1.11 Advance Cycle Sequence

When the player clicks "Advance Cycle," the engine processes the following steps in this exact order. Order matters because each step can affect subsequent steps.

```
1. CHALLENGE RESOLUTION
   - For each challenge with assigned agents this cycle:
     a. Run the encounter resolver (1.3.2)
     b. Determine outcome (success/partial/failure)
     c. Generate run report data
     d. Apply agent damage / down status
     e. Roll loot table, queue reward decisions

2. REWARD RESOLUTION
   - Present queued reward decisions to player (Drama Event Cards in Council mode)
   - Player resolves each (or system auto-resolves in Points/Rotation mode)
   - Apply reward effects: gear equip, morale shifts, relationship changes
   - Log to precedent store
   - Check for precedent violations, queue resulting Drama Cards

3. STRESS PROCESSING
   - Apply per-challenge stress gains to all assigned agents
   - Apply benching stress to agents who expected assignment but didn't get one
   - Apply Hostile-proximity stress for agents co-assigned with Hostile relationships
   - Apply affliction bark stress propagation from currently-Afflicted agents
   - For each agent at stress >= 10: resolve affliction threshold (75/25 fork)
   - Apply affliction effects or resolve bonuses

4. RELATIONSHIP UPDATES
   - Process all relationship triggers from this cycle's events:
     - Shared challenge outcomes (+/- affinity)
     - Reward allocation effects
     - Affliction bark targets
     - Promotion/demotion effects
   - Evaluate relationship state transitions (Neutral→Allied, Allied→Bonded, etc.)
   - Queue Drama Event Cards for major transitions

5. MORALE DRIFT
   - For each agent, calculate target morale based on:
     - Reward satisfaction (recent reward history vs. expectations)
     - Win/loss streak
     - Relationship quality (average affinity of relationships)
     - Infrastructure quality (facility levels)
     - Officer status floor
   - Drift current morale toward target by max 5 points per cycle

6. INFRASTRUCTURE TICK
   - Production facilities generate output (materials, gear) based on assigned agents' Base Efficiency
   - Training facilities apply stat growth to assigned agents
   - Recreation facilities apply stress recovery to resting agents
   - Research facilities advance intel/lore unlock queues
   - Medical facilities tick downed agents toward recovery

7. RECRUITMENT POOL REFRESH
   - Generate new open pool based on Reputation and Recreation level
   - Process returning scout missions (if scouting is implemented)

8. TOKEN REGENERATION
   - Add tokens_per_cycle (+ infrastructure bonus) to token pool
   - Cap at max_tokens

9. DRAMA CARD QUEUE FINALIZATION
   - All Drama Cards generated during steps 1-8 are added to the queue
   - Cards are presented to the player at the START of the next cycle's decision phase
   - Cards do not expire and do not auto-resolve

10. HIDDEN ATTRIBUTE / TRAIT REVEALS
    - Check each agent's cumulative assignment count
    - Reveal hidden attributes and traits per the cadence (3/5/8/12 thresholds)
    - Newly revealed info is surfaced to the player as notification events

11. SAVE CHECKPOINT
    - Auto-save the complete game state with cycle number as version marker
```

### 1.12 Drama Event Card Rules

Drama Event Cards are the primary mechanism for player decision-making outside of challenge assignment. They are generated by engine events and resolved by the player.

**Generation triggers and thresholds:**

A Drama Card is generated when ANY of the following occur:
- A relationship transitions between states (e.g., Neutral → Hostile)
- A reward decision has 2+ eligible agents (in Council mode, this is automatic)
- A precedent violation affects 3+ agents simultaneously
- An agent's morale drops below 25 or rises above 85 (extreme states create events)
- An agent hits the affliction threshold (stress = 10)
- An agent has been benched for 3+ consecutive cycles
- Two agents with a Rivalrous relationship have a performance differential > 20% on the same challenge
- A Bonded agent's partner is downed or leaves

**Card queuing rules:**
- Maximum 5 cards can queue per cycle. If more triggers fire, prioritize by: severity (relationship state change > morale extreme > benching), then by tier of agents involved (higher tier = higher priority).
- Cards queue in generation order within a cycle.
- Cards never reference unresolved cards. Each card is self-contained at generation time. However, the resolution of one card can affect the context of a subsequent card (e.g., resolving a loot dispute may shift a relationship, which changes the framing of a benching card).
- Unresolved cards carry forward indefinitely. There is no cap on the backlog. A player who ignores drama will accumulate a growing queue, which is itself a signal that the organization needs attention.

**Card structure:**
```
drama_card:
  id: string
  cycle_generated: int
  trigger_type: string
  agents_involved: [string]
  narrative_text: string          # generated from template (see 1.13)
  options: [
    {
      id: string
      label: string               # short action description
      description: string         # fuller explanation of trade-offs
      effects: [                  # mechanical consequences
        { target: string, type: string, value: float }
      ]
      hidden_effects: [           # consequences not fully visible to the player
        { target: string, type: string, value: float }
      ]
    }
  ]
```

The `hidden_effects` field is critical. Some consequences of a decision are not immediately obvious. Awarding loot to the higher-performer might satisfy the high-Ambition agents you can see, but quietly erode loyalty in the mid-tier agents who notice the pattern. Hidden effects are revealed through subsequent events, not at decision time.

### 1.13 Narrative Template System

The engine outputs structured data. The game layer converts that data into readable text using a template system.

**Template structure:**
```
template:
  trigger: string                 # what kind of event this template renders
  tone: enum [neutral, tense, triumphant, grim, comedic]
  conditions: {}                  # optional: only use this template if conditions met
  text: string                    # template string with variable slots
```

**Variable slots** use `{variable_name}` syntax and are populated from the report data or drama card data:

- `{agent.name}` — agent's display name
- `{agent.role}` — agent's role (arc-defined)
- `{challenge.name}` — challenge display name
- `{mechanic.name}` — mechanic check name
- `{score}` — agent's score on a check
- `{threshold}` — the check's difficulty threshold
- `{margin}` — score minus threshold (positive = passed with room, negative = failed by N)
- `{item.name}` — reward item name
- `{outcome}` — success/partial/failure

**Example templates for run reports:**

```
# Close pass
trigger: "mechanic_check_passed"
conditions: { margin: [1, 5] }
tone: "tense"
text: "{agent.name} barely handled {mechanic.name}, scraping through with nothing to spare."

# Comfortable pass
trigger: "mechanic_check_passed"
conditions: { margin: [10, 999] }
tone: "neutral"
text: "{agent.name} breezed through {mechanic.name}. No drama."

# Failure
trigger: "mechanic_check_failed"
tone: "grim"
text: "{agent.name} failed {mechanic.name}. The margin wasn't even close."

# High-volatility heroics
trigger: "mechanic_check_passed"
conditions: { agent.volatility: [15, 20], margin: [8, 999] }
tone: "triumphant"
text: "{agent.name} pulled something out of nowhere on {mechanic.name}. Nobody expected that."

# Full run report assembly
trigger: "challenge_complete"
tone: "neutral"
text: "{challenge.name} is done. {outcome_summary}. {top_performer_line}. {stress_summary}."
```

The game ships with ~50 templates covering the core report types. Arcs can include custom templates that override or extend the defaults for domain-specific tone (a military arc might use different language than a fantasy arc).

**Assembly rule**: The report renderer iterates through mechanic check results, selects the best-matching template for each (by trigger + conditions), populates the variables, and concatenates with connecting prose. The `narrative_seed` from the report data is used to select among equally-valid templates for variety.

---

## PART 2: THE GAME LAYER

The first consumer of this engine is a guild management simulation game. Browser-first PWA, mobile-optimized, offline-capable, premium model.

### 2.1 Domain Mapping

| Engine Concept | Game Term |
|---|---|
| Agent | Character / Toon |
| Organization | Guild |
| Arc | Scenario / Campaign |
| Challenge | Encounter / Boss / Raid |
| Cycle | Week |
| Capacity Token | Raid Lockout |
| General Currency | Gold |
| Specialized Material | Crafting Materials |
| Reputation | Guild Renown |
| Quarters | Barracks |
| Production | Forge |
| Recreation | Tavern |
| Research | Library |
| Training | Training Grounds |
| Medical | Infirmary |
| Open Pool Recruitment | Tavern Board |
| Targeted Search | Scout Mission |

### 2.2 UI/UX Principles

- **Mobile-first portrait layout.** Everything reachable with one thumb.
- **Player-initiated pacing.** "Advance Week" button. The game never punishes you for not playing.
- **No hidden information as dark pattern.** If a system exists, the player can learn how it works. Hidden character attributes are hidden diegetically (you haven't observed them yet), not systemically (the game is keeping secrets from you for monetization).
- **Run reports are the core feedback loop.** The player doesn't watch combat. They read what happened. The report should read like a friend telling you about the raid night, not a stat dump.
- **Drama cards queue, never expire, never auto-resolve.** Your decisions always matter. Come back in a month, your drama events are waiting.
- **Aesthetic direction**: Dark, tactile, slightly medieval-bureaucratic. Guild charter parchment meets logistics ledger. Readable at small size. Character portraits are the primary visual investment.

### 2.3 Monetization Model

Premium or freemium-with-demo. No gacha. No daily login rewards. No energy systems. No FOMO.

- Base game: free demo with tutorial arc (2 tiers, 6 encounters)
- Full game: one-time purchase ($5-15) with one complete arc
- Additional arcs: paid DLC ($3-5 each) OR community-created (free, loaded via JSON)
- No competitive element between players. No leaderboards. No whales.

### 2.4 What Players Don't See

The player never needs to know:
- That the engine is generic
- That arcs are JSON files
- That the encounter resolver has a formula
- That their game is running on an organizational simulation engine

They see: a guild management game where their decisions matter, their characters feel real, and the drama has actual consequences. The abstraction layer between engine and game exists for developers and arc creators, not for players.

---

## PART 3: ARC SCHEMA (Full Specification)

```yaml
arc:
  meta:
    id: string                    # unique identifier
    name: string                  # display name
    description: string           # 2-3 sentence pitch
    author: string
    version: string               # semver
    engine_version: string        # minimum engine version required
    domain: string                # "fantasy", "sci-fi", "corporate", "military", etc.
    estimated_cycles: int         # approximate arc length

  # DOMAIN CONFIGURATION
  # This is where the arc tells the engine what the domain looks like.
  
  attributes:                     # defines primary attributes for this arc
    - id: string
      name: string
      description: string
      
  roles:                          # optional. omit for role-less domains.
    - id: string
      name: string
      attribute_weights: {}       # which attributes are primary for this role
      
  tiers:                          # agent tier definitions
    - id: string
      name: string
      stat_budget_min: int
      stat_budget_max: int
      upkeep_cost: int
      base_efficiency_modifier: float  # higher for lower tiers
  
  # Resource naming
  currency_name: string           # "Gold", "Credits", "Budget"
  material_name: string           # "Materials", "Components", "Data"
  token_name: string              # "Raid Lockouts", "Sprint Capacity", "Deployment Orders"
  reputation_name: string         # "Guild Renown", "Market Position", "Reputation"
  
  # Token economy
  tokens_per_cycle: int           # base regeneration
  max_tokens: int                 # storage cap
  infrastructure_token_bonus: float  # max bonus from base upgrades (e.g. 0.5 = +50%)

  # Names for character generation
  name_pool:
    first_names: [string]
    last_names: [string]          # optional

  # Trait extensions (merged with engine defaults)
  custom_traits: []               # same format as engine trait pool
  
  # PROGRESSION STRUCTURE
  
  progression_tiers:              # these are content tiers, not agent tiers
    - id: string
      name: string
      flavor_text: string
      unlock_conditions:
        org_milestones: [string]  # challenge IDs the org must have cleared
        reputation_minimum: int   # optional
      challenges: [string]        # challenge IDs available in this tier
      required_challenges: [string]  # must clear these to progress (subset of challenges)
      optional_challenges: [string]  # available but not required
      
  attunement_chains:              # per-agent prerequisite systems
    - id: string
      name: string
      steps:
        - type: enum [challenge_clear, reputation_threshold, item_acquire, chain_complete]
          target: string
      grants_access_to: [string]  # challenge IDs or tier IDs this attunement unlocks
      
  challenges: []                  # full challenge definitions (see 1.3.1)
  
  # DIFFICULTY VARIANTS
  # The same challenge at multiple difficulty levels
  
  difficulty_modes:               # optional
    - id: string
      name: string                # "Normal", "Savage", "Ultimate", "Heroic"
      global_modifiers:
        difficulty_multiplier: float
        reward_multiplier: float
        mechanic_additions: []    # additional mechanic checks added at this difficulty
        
  # REWARD DEFINITIONS
  
  items:
    - id: string
      name: string
      slot: string                # arc-defined slot system
      stat_bonuses: {}            # keyed by attribute ID
      tier_requirement: string    # minimum agent tier to equip
      flavor_text: string

  # NARRATIVE
  
  narrative_events:
    - trigger:
        type: enum [first_clear, tier_complete, arc_complete, agent_milestone, reputation_threshold]
        target: string
      title: string
      text: string
      rewards: []
      agent_unlock:               # optional: triggers a top-tier recruit event
        agent_template: {}
        
  # SCALING (for flexible party size arcs)
  
  scaling:                        # optional
    type: enum [fixed, scaled, invocation]
    # fixed: challenges have set requirements (WoW-style)
    # scaled: challenge difficulty adjusts to party size (OSRS/FFXIV-style)
    # invocation: player selects difficulty modifiers (OSRS ToA-style)
    scaling_rules: {}             # type-specific parameters
```

---

## PART 4: REFERENCE ARC — KARAZHAN (Structural Proof)

This section demonstrates that the schema holds Burning Crusade Phase 1 content. It is a reference implementation, not engine specification. Every field maps to the schema defined in Part 3. A developer should be able to load this as a JSON file and have the engine run it.

### 4.1 Domain Configuration

```yaml
meta:
  id: "tbc-phase1"
  name: "The Burning Crusade: Phase 1"
  description: "Karazhan, Gruul's Lair, and Magtheridon's Lair. The entry tier of Burning Crusade raiding. 10- and 25-player content with attunement chains, gear-dependent progression, and the most beloved raid instance in MMO history."
  domain: "fantasy-mmo"
  estimated_cycles: 30

attributes:
  - id: "power", name: "Power", description: "Raw offensive output"
  - id: "resilience", name: "Resilience", description: "Damage absorption and sustained survival"
  - id: "precision", name: "Precision", description: "Interrupt timing, mechanic execution, accuracy"
  - id: "adaptability", name: "Adaptability", description: "Response to unpredictable situations"
  - id: "focus", name: "Focus", description: "Sustained performance, mana management, concentration"

roles:
  - id: "tank", name: "Tank", attribute_weights: { resilience: 0.4, power: 0.2, adaptability: 0.2, focus: 0.1, precision: 0.1 }
  - id: "healer", name: "Healer", attribute_weights: { focus: 0.4, resilience: 0.2, adaptability: 0.2, precision: 0.1, power: 0.1 }
  - id: "dps-melee", name: "Melee DPS", attribute_weights: { power: 0.4, precision: 0.3, adaptability: 0.15, resilience: 0.1, focus: 0.05 }
  - id: "dps-ranged", name: "Ranged DPS", attribute_weights: { power: 0.35, precision: 0.3, focus: 0.2, adaptability: 0.1, resilience: 0.05 }
  - id: "support", name: "Support", attribute_weights: { adaptability: 0.3, focus: 0.25, precision: 0.2, resilience: 0.15, power: 0.1 }

tiers:
  - id: "common", name: "Recruit", stat_budget_min: 40, stat_budget_max: 55, upkeep_cost: 2, base_efficiency_modifier: 1.6
  - id: "uncommon", name: "Member", stat_budget_min: 50, stat_budget_max: 65, upkeep_cost: 4, base_efficiency_modifier: 1.3
  - id: "rare", name: "Veteran", stat_budget_min: 60, stat_budget_max: 80, upkeep_cost: 8, base_efficiency_modifier: 1.0
  - id: "epic", name: "Elite", stat_budget_min: 75, stat_budget_max: 95, upkeep_cost: 15, base_efficiency_modifier: 0.7
  - id: "legendary", name: "Champion", stat_budget_min: 85, stat_budget_max: 100, upkeep_cost: 25, base_efficiency_modifier: 0.4

scaling:
  type: "fixed"

tokens_per_cycle: 3
max_tokens: 5
infrastructure_token_bonus: 0.5
```

### 4.2 Progression Structure

```yaml
progression_tiers:
  - id: "t4-10man"
    name: "Karazhan"
    flavor_text: "Medivh's haunted tower. Ten brave souls. The entry exam for everything that follows."
    unlock_conditions:
      org_milestones: []          # first tier, no prereqs
      reputation_minimum: 0
    challenges: ["attumen", "moroes", "maiden", "opera", "curator", "illhoof", "aran", "netherspite", "chess", "prince", "nightbane"]
    required_challenges: ["moroes", "opera", "curator", "chess", "prince"]
    optional_challenges: ["attumen", "maiden", "illhoof", "aran", "netherspite", "nightbane"]

  - id: "t4-25man"
    name: "Gruul's Lair & Magtheridon"
    flavor_text: "Twenty-five required. The guild must grow to progress."
    unlock_conditions:
      org_milestones: ["curator"]
      reputation_minimum: 20
    challenges: ["maulgar", "gruul", "magtheridon"]
    required_challenges: ["gruul", "magtheridon"]
    optional_challenges: ["maulgar"]

attunement_chains:
  - id: "masters-key"
    name: "The Master's Key"
    steps:
      - type: "challenge_clear", target: "shadow-lab"      # modeled as a minor challenge
      - type: "challenge_clear", target: "steamvault"
      - type: "challenge_clear", target: "arcatraz"
      - type: "challenge_clear", target: "black-morass"
    grants_access_to: ["t4-10man"]
    
  - id: "nightbane-attunement"
    name: "Medivh's Journal"
    steps:
      - type: "reputation_threshold", target: 15            # "Honored" equivalent
      - type: "challenge_clear", target: "curator"          # must have cleared deeper Kara
    grants_access_to: ["nightbane"]
```

### 4.3 Sample Encounters (Showing Structural Diversity)

**Attumen the Huntsman** — the tutorial boss. Simple, forgiving, teaches the run report format.

```yaml
- id: "attumen"
  name: "Attumen the Huntsman"
  flavor_text: "The ghostly huntsman and his spectral steed. A straightforward fight that tests nothing except showing up."
  difficulty_rating: 25
  roster_requirements:
    min_agents: 8
    max_agents: 10
    role_requirements:
      - role_id: "tank", count: 1
      - role_id: "healer", count: 2
      - role_id: "dps-melee", count: 2
      - role_id: "dps-ranged", count: 2
  access_requirements:
    agent_attunements: ["masters-key"]
  mechanic_checks:
    - id: "phase-transition"
      name: "Mount Phase Transition"
      attribute_weights:
        - attribute_id: "resilience", weight: 0.5
        - attribute_id: "adaptability", weight: 0.3
        - attribute_id: "precision", weight: 0.2
      difficulty_threshold: 35
      scope: "role_specific"       # only tank is checked
      failure_consequence:
        type: "agent_damage"
        severity: 0.3
  completion_criteria:
    type: "survival_check"
  outcomes:
    success:
      reward_table: [{ item_id: "gloves-of-dexterous-manipulation", drop_rate: 0.15 }, { item_id: "stalkers-war-bands", drop_rate: 0.15 }]
      reputation_gain: 2
      milestone_flag: "attumen-cleared"
```

**Opera Event** — the adaptability test. The challenge randomizes which variant fires. The player cannot prepare for a specific variant.

```yaml
- id: "opera"
  name: "The Opera Event"
  flavor_text: "Tonight's performance is... unknown until curtain rise."
  difficulty_rating: 40
  roster_requirements:
    min_agents: 8
    max_agents: 10
    role_requirements:
      - role_id: "tank", count: 1
      - role_id: "healer", count: 2
  access_requirements:
    org_milestones: ["moroes-cleared"]
    agent_attunements: ["masters-key"]
  mechanic_checks:
    - id: "opera-variant"
      name: "Unknown Performance"
      description: "One of three possible encounters. Preparation is impossible. Adaptability is everything."
      attribute_weights:
        - attribute_id: "adaptability", weight: 0.6
        - attribute_id: "precision", weight: 0.25
        - attribute_id: "focus", weight: 0.15
      difficulty_threshold: 45
      scope: "team_aggregate"
      failure_consequence:
        type: "cascade"
        severity: 0.5
  # Note: the engine rolls which variant at resolution time, affecting narrative output only.
  # The mechanical check is the same regardless of variant. The STORY differs.
```

**Shade of Aran** — the no-tank encounter. Breaks the assumed roster structure.

```yaml
- id: "aran"
  name: "Shade of Aran"
  flavor_text: "Medivh's father. No tank can help you. Everyone must execute perfectly or everyone dies."
  difficulty_rating: 55
  roster_requirements:
    min_agents: 8
    max_agents: 10
    role_requirements: []         # NO TANK REQUIRED. Unique constraint.
  access_requirements:
    org_milestones: ["curator-cleared"]
    agent_attunements: ["masters-key"]
  mechanic_checks:
    - id: "flame-wreath"
      name: "Flame Wreath"
      description: "Do not move. Anyone who moves kills the raid."
      attribute_weights:
        - attribute_id: "focus", weight: 0.5
        - attribute_id: "adaptability", weight: 0.3
        - attribute_id: "precision", weight: 0.2
      difficulty_threshold: 55
      scope: "per_agent"          # EVERY agent is checked individually. One failure = wipe.
      failure_consequence:
        type: "team_damage"
        severity: 1.0             # instant wipe
    - id: "blizzard-dodge"
      name: "Circular Blizzard"
      attribute_weights:
        - attribute_id: "adaptability", weight: 0.7
        - attribute_id: "resilience", weight: 0.3
      difficulty_threshold: 45
      scope: "per_agent"
      failure_consequence:
        type: "agent_damage"
        severity: 0.4
    - id: "arcane-management"
      name: "Arcane Explosion Window"
      attribute_weights:
        - attribute_id: "precision", weight: 0.5
        - attribute_id: "adaptability", weight: 0.3
        - attribute_id: "focus", weight: 0.2
      difficulty_threshold: 50
      scope: "team_aggregate"
      failure_consequence:
        type: "team_damage"
        severity: 0.6
```

**Prince Malchezaar** — the final boss. Gear check plus RNG.

```yaml
- id: "prince"
  name: "Prince Malchezaar"
  flavor_text: "All realities, all dimensions, are open to me. The final test of Karazhan. Your tank's gear and your raid's composure."
  difficulty_rating: 60
  roster_requirements:
    min_agents: 8
    max_agents: 10
    role_requirements:
      - role_id: "tank", count: 1
      - role_id: "healer", count: 3     # healer-heavy fight
  access_requirements:
    org_milestones: ["chess-cleared"]
    agent_attunements: ["masters-key"]
  mechanic_checks:
    - id: "tank-survivability"
      name: "Enfeeble + Shadow Nova"
      description: "The tank must survive sequential burst damage. Gear matters enormously."
      attribute_weights:
        - attribute_id: "resilience", weight: 0.7
        - attribute_id: "focus", weight: 0.3
      difficulty_threshold: 60
      scope: "role_specific"      # tank only
      failure_consequence:
        type: "agent_damage"
        severity: 0.9             # near-lethal
    - id: "infernal-positioning"
      name: "Infernal Landing"
      description: "Infernals drop in random locations. The raid must adapt. This is partially luck."
      attribute_weights:
        - attribute_id: "adaptability", weight: 0.8
        - attribute_id: "precision", weight: 0.2
      difficulty_threshold: 40    # lower threshold but high-volatility RNG
      scope: "team_aggregate"
      failure_consequence:
        type: "team_damage"
        severity: 0.5
  time_pressure:
    rounds: 12
    aggregate_threshold: 150
    attribute_id: "power"
  outcomes:
    success:
      reward_table: [{ item_id: "t4-helm-token", drop_rate: 1.0 }, { item_id: "gorehowl", drop_rate: 0.1 }]
      reputation_gain: 10
      milestone_flag: "prince-cleared"
      narrative: "The Prince falls. Karazhan is clear. Your guild's name will be remembered."
```

### 4.4 The 10-to-25 Expansion Moment

When the player clears enough of Karazhan (specifically: Curator), the Tier 1B content unlocks. This requires 25 agents. Most guilds at this point have 12-18. This forces a recruitment wave, which means:

- New agents with unknown hidden attributes
- Integration stress on existing relationships
- Reward distribution across a larger pool (more drama)
- Old content (Karazhan) now serves as a training ground for new recruits
- Attunement runs needed for new agents (more reason to run old content)

This is the first major organizational scaling challenge in the arc and it's organic to the progression structure, not a tutorial popup.

---

## PART 5: SCHEMA STRESS TESTS

These are not full implementations. They are structural proofs that the schema can hold fundamentally different organizational challenges.

### 5.1 EverQuest: Planes of Power

**What it tests**: Massive roster (72 agents), per-agent flagging with threshold rules, world-spawn timing, deep attunement dependency chains.

Schema accommodations:
- `roster_requirements.max_agents: 72` — the engine supports any party size because the arc defines it.
- `access_requirements.attunement_threshold: 0.85` — models the 85% rule. 85% of assigned agents must have the attunement flag; the rest are "willed in." The engine already supports this via the `attunement_threshold` field.
- Attunement chains are deep and branching (Plane of Justice trials → specific flag → next plane). The `attunement_chains` list supports arbitrary step sequences.
- Per-agent flag tracking means Character A may access Plane of Time while Character B is still stuck on Plane of Valor. The engine tracks this natively.

**What it proves**: The schema isn't locked to 10-25 player WoW-shaped content. The roster management challenge at 72 agents is qualitatively different (you can't know everyone personally) and the engine's relationship system would generate realistic factional dynamics at that scale.

### 5.2 FFXIV: Savage Raiding

**What it tests**: Strict 8-player composition with sub-role diversity (2 tank, 2 healer, 1 melee DPS, 1 ranged physical DPS, 1 ranged magical DPS, 1 flex), difficulty variants of the same encounter, weekly per-agent lockouts.

Schema accommodations:
- `roles` list with 6+ role definitions, including sub-roles like "dps-melee", "dps-ranged-physical", "dps-ranged-magical."
- `difficulty_modes` block defines Normal, Savage, Ultimate as global modifiers. Same challenge ID, different difficulty multiplier, different rewards, additional mechanic checks at higher modes.
- Weekly per-agent lockouts: extend the engine's per-agent state tracking to include `last_clear_cycle` per challenge. An agent who cleared a Savage encounter this cycle cannot attempt it again until next cycle. This is a one-field extension to the agent state model.

**What it proves**: The schema handles strict composition enforcement and difficulty scaling. The same arc can serve casual and hardcore play styles by defining difficulty modes that gate different rewards.

### 5.3 OSRS: Tombs of Amascut

**What it tests**: 1-8 players (including solo), NO defined roles, player-selected difficulty via invocation system, non-linear path selection, boss HP scaling by party size.

Schema accommodations:
- `roles: []` — omitted entirely. The arc defines no roles. The engine's role system is inactive.
- `scaling.type: "invocation"` — the player selects modifiers before each attempt that adjust difficulty thresholds and reward multipliers. The `scaling_rules` block defines available invocations and their effects.
- `progression_tiers[].challenges` with branching paths: "choose 3 of 4 paths" is modeled as 4 optional challenge groups where the player must clear at least 3 before the final challenge unlocks.
- Boss HP scaling: the engine's challenge resolution already accounts for party size in team_aggregate checks. Fewer agents = lower total output capacity = harder to meet thresholds. The arc sets thresholds assuming a reference party size, and the `scaling_rules` define how thresholds adjust for different sizes.

**What it proves**: The schema doesn't require roles. It doesn't require fixed party sizes. It supports player-driven difficulty tuning. A single-player experience is mechanically valid.

### 5.4 Guild Wars 1: Guild vs Guild

**What it tests**: 8v8 PvP. The "encounter" is another organization's roster. Build theory (skill/ability composition) matters more than raw stats. Competitive rather than PvE.

Schema accommodations:
- Challenges of type "competitive" where the difficulty isn't a static threshold but is generated from an opposing organization's attributes. The engine would need to simulate the opposing org or load a predefined "rival guild" profile.
- "Build" as a loadout system: agents aren't just assigned to a challenge, they're assigned with a specific configuration (skill set, equipment loadout) that creates synergies or vulnerabilities. This is an extension to the assignment model.
- This is the hardest stress test and likely a v2 feature. But the schema doesn't preclude it: a competitive challenge is still a challenge with mechanic checks. The mechanic checks just reference the opposing roster's stats instead of static thresholds.

**What it proves**: The schema can accommodate PvP if extended. The engine's core loop (assign agents, resolve challenge, process consequences) doesn't fundamentally change. The resolution engine needs a "dynamic threshold" option, not a redesign.

### 5.5 Single-Player Tactical RPGs (XCOM, Fire Emblem, Dragon Age War Table)

**What it tests**: Small roster (4-12 agents), high individual investment per agent, permanent death as a consequence, deployment-screen management as the core loop.

Schema accommodations:
- Everything already works. These games are already running a simplified version of this engine. The arc would define small roster caps, high stat budgets per agent (each one matters more), and severe failure consequences (permanent death instead of temporary downtime).
- The drama system scales down: with 6 agents, every relationship matters intensely. A Hostile pair in a 6-agent roster is a crisis. In a 72-agent EQ roster, it's containable.

**What it proves**: The engine scales down as cleanly as it scales up. The "no trash units" principle is trivially satisfied at small scale because every unit is load-bearing.

---

## PART 6: BEYOND THE GAME

The game is the first consumer. It is not the only possible consumer.

The engine models: a group of agents with imperfect information, managed by a decision-maker who must allocate them against structured challenges, under resource constraints, while managing interpersonal dynamics that have mechanical consequences on performance.

This is not a metaphor for organizational management. It IS organizational management, with a fantasy skin.

Possible non-game consumers of this engine:

- **Training simulations**: A defense program office loads an arc that models JCIDS milestone progression. "Challenges" are contract deliverables. "Agents" are team members with real skill profiles. "Drama events" are the interpersonal dynamics that actually derail programs. The simulation runs faster than real time, letting leaders practice decision-making.

- **Organizational diagnostics**: Load an arc that models your actual company's current quarter. Define the challenges you're facing. Input (anonymized) team attributes. Run the simulation 1000 times. See where the stress cascades happen. See which relationships are load-bearing. See what happens when your best performer leaves.

- **Recruiting strategy testing**: Before hiring, define the role and run simulations with different agent profiles. See how a high-Ambition hire interacts with your existing team's relationship web. See whether a high-Volatility hire helps or hurts your specific challenge profile.

- **Education**: Business schools currently use case studies. This engine runs case studies as interactive simulations. Students make the decisions and see the cascading consequences.

The arc schema is a portable scenario definition format. An arc can model a WoW raid tier, a startup's first year, a military unit's deployment cycle, or a hospital's staffing crisis. The engine doesn't care. It runs the simulation.

This is the framing for the repo. The game is the proof of concept. The engine is the product. The arc system is the platform.

---

## V1 BUILD SCOPE

### What to build first (in order):

1. **Arc schema TypeScript types and JSON validator.** If the schema is wrong, everything built on it is wrong.
2. **Agent model and character generator.** Stat budgets, trait assignment, hidden attribute distribution.
3. **Challenge resolver with the formula specified in 1.3.2.** Deterministic given seed.
4. **Run report data structure.** Structured output from the resolver.
5. **Morale and stress system.** Background morale drift, per-challenge stress accumulation, affliction threshold with fork.
6. **Relationship state machine.** Neutral, Allied, Hostile, Mentorship at minimum. Rivalrous and Bonded for v1.1.
7. **Drama event card system.** Branching resolution with downstream consequence tracking.
8. **Reward distribution: Council mode only.** Manual decisions feeding the drama engine.
9. **Infrastructure tick system.** Forge, Tavern, Training Grounds. Agent assignment with Base Efficiency scaling.
10. **Token economy and "Advance Cycle" loop.**
11. **Recruitment: open pool only.**
12. **Per-agent state tracking.** Attunement flags, assignment history, affliction history, reward history.
13. **Tutorial arc.** Original fantasy domain (not tied to any IP). 2 tiers, 6 challenges, teaches all core systems in sequence:

    **Arc name**: "The First Charter" (your guild's founding contract)
    **Starting roster**: 6 agents (pre-generated, not recruited, so the player starts playing immediately)
    **Starting facilities**: Quarters (level 1), Recreation (level 1)
    
    **Tier 1: "Proving Grounds"** (3 challenges)
    - Challenge 1 ("The Cellar"): Trivial difficulty. Teaches assignment UI and run reports. Cannot fail.
    - Challenge 2 ("The Bridge Troll"): Introduces role requirements (needs 1 tank). Teaches roster comp. Can fail if wrong comp assigned. First loot drop with 2 eligible agents → teaches reward decisions.
    - Challenge 3 ("The Merchant Escort"): Introduces a second mechanic check. Two pre-generated agents have a budding Rivalrous relationship → first Drama Card fires after this challenge regardless of outcome. Teaches drama resolution.
    
    **Tier 2: "The Contract"** (3 challenges, unlocked by clearing all Tier 1)
    - Challenge 4 ("The Mine Collapse"): Requires 8 agents. Player must recruit 2 from the open pool → teaches recruitment. Hidden attributes are revealed for starting agents who now have enough assignments.
    - Challenge 5 ("The Bandit Camp"): First challenge with an enrage timer. Tests whether the player has been investing in the right attributes. A pre-scripted stress threshold event fires for one agent → teaches affliction system.
    - Challenge 6 ("The Warden's Keep"): Tier-final boss. Requires attunement (clearing challenges 4+5 for each assigned agent). Tests all systems simultaneously. First infrastructure unlock (Production facility) is the milestone reward. Completing this unlocks the arc selection screen for purchased/loaded arcs.
14. **Save/load.** JSON export with version tag and migration support.
15. **Game presentation layer.** Narrative report renderer, drama card UI, roster management screen, infrastructure assignment screen.

### Defer to v2:
- Points and Rotation reward policies
- Scout missions
- Community arc browser / URL-based arc loading
- Full Karazhan arc
- Difficulty modes
- Competitive (PvP) challenge type
- Cloud sync
- Character portrait generation
- Sound design

---

## DESIGN CONSTRAINTS (NEVER VIOLATE)

1. **The player never directly controls an agent in a challenge.** They assign. The engine resolves.
2. **No agent is permanently useless.** If an agent has no role, that is a design bug in the arc, not a feature of the engine.
3. **Reward decisions must feed the relationship system.** Rewards that have no interpersonal consequences are wasted design.
4. **Drama consequences must be mechanical.** Flavor text without stat effects is not a consequence.
5. **The arc system must be fully data-driven.** No arc content hardcoded outside the tutorial.
6. **Offline play is non-negotiable.** Internet required only for optional arc downloads.
7. **No expiring content.** A player returning after any absence faces no penalty.
8. **Hidden attributes must be discoverable through play.** Time and attention reveal everything. No paywalls. No RNG gates.
9. **The challenge resolver must be deterministic given the same inputs and random seed.**
10. **Save format must be versioned.** Breaking a player's save is a critical bug.
11. **Engine and content are separate layers.** Engine code must never reference arc-specific content. Arc files must never assume engine internals beyond the published schema.
12. **The engine knows nothing about the domain.** It processes agents, attributes, challenges, and relationships. The game layer and the arc provide all domain knowledge. This constraint is what makes the engine portable.
