import { validateArc } from "../../engine/schema.js";
import type { Arc } from "../../engine/types.js";
import {
  ACTION_EXTENSION_KEY,
  ACTION_OBJECTIVE_EXTENSION_KEY,
  ACTION_OBJECTIVE_PROFILE_FORMAT,
  ACTION_PROFILE_FORMAT,
  type ActionObjectiveProfile,
  type ActionProfile,
} from "../../engine/action/types.js";
import {
  AUTHORED_EXPERIENCE_EXTENSION_KEY,
  AUTHORED_EXPERIENCE_FORMAT,
  type AuthoredExperienceProfile,
} from "../../engine/experience/types.js";

export const UNDERDRAIN_DEMO_ID = "underdrain-draft" as const;
export const UNDERDRAIN_SERVICE_CHALLENGE_ID = "mrs-kett-service-call" as const;
export const UNDERDRAIN_CHALLENGE_ID = "breach-crown-pump" as const;
export const UNDERDRAIN_ROOT_GATE_CHALLENGE_ID = "root-gate-parley" as const;
export const UNDERDRAIN_EXPERIENCE_IDS = [
  "mrs-kett-service-call",
  "pump-seven-operation",
  "root-gate-parley",
] as const;
export const UNDERDRAIN_STRATEGY_IDS = [
  "emergency-plan",
  "service-tunnel",
  "truce-offer",
] as const;
export type UnderdrainStrategyId = typeof UNDERDRAIN_STRATEGY_IDS[number];

export const UNDERDRAIN_ACTION_PROFILE: ActionProfile = {
  format: ACTION_PROFILE_FORMAT,
  encounters: {
    [UNDERDRAIN_SERVICE_CHALLENGE_ID]: {
      arenaKit: "ring",
      playerKit: "hammer",
      durationSeconds: 35,
      arenaScale: 0.65,
      enemyScale: 0.5,
      objectiveOrder: [
        "inspect-living-trap",
        "restore-kett-water",
      ],
      objectiveKits: {
        "inspect-living-trap": "skirmisher",
        "restore-kett-water": "skirmisher",
      },
    },
    [UNDERDRAIN_CHALLENGE_ID]: {
      arenaKit: "lane",
      playerKit: "hammer",
      durationSeconds: 120,
      arenaScale: 1,
      enemyScale: 1,
      objectiveOrder: [
        "diagnose-spore-valves",
        "operate-purge-wheel",
        "open-crown-sluice",
      ],
      objectiveKits: {
        "diagnose-spore-valves": "skirmisher",
        "operate-purge-wheel": "swarm",
        "open-crown-sluice": "breaker",
      },
    },
  },
};

export const UNDERDRAIN_ACTION_OBJECTIVE_PROFILE: ActionObjectiveProfile = {
  format: ACTION_OBJECTIVE_PROFILE_FORMAT,
  encounters: {
    [UNDERDRAIN_SERVICE_CHALLENGE_ID]: {
      "inspect-living-trap": {
        kind: "interact_count",
        targetCount: 1,
        radius: 1_200,
        pressureEnemyCount: 0,
      },
      "restore-kett-water": {
        kind: "hold_ticks",
        targetTicks: 45,
        radius: 1_200,
        pressureEnemyCount: 0,
      },
    },
    [UNDERDRAIN_CHALLENGE_ID]: {
      "diagnose-spore-valves": {
        kind: "interact_count",
        targetCount: 3,
        radius: 1_000,
        pressureEnemyCount: 2,
      },
      "operate-purge-wheel": {
        kind: "hold_ticks",
        targetTicks: 90,
        radius: 1_100,
        pressureEnemyCount: 2,
      },
      "open-crown-sluice": {
        kind: "hold_ticks",
        targetTicks: 75,
        radius: 1_100,
        pressureEnemyCount: 2,
      },
    },
  },
};

const outcome = (
  factIds: string[],
  openedObligationIds: string[],
  resolvedObligationIds: string[],
  nextExperienceIds: string[],
  terminal = false,
) => ({
  factIds,
  openedObligationIds,
  resolvedObligationIds,
  nextExperienceIds,
  ...(terminal ? { terminal: true } : {}),
});

export const UNDERDRAIN_AUTHORED_EXPERIENCE_PROFILE: AuthoredExperienceProfile = {
  format: AUTHORED_EXPERIENCE_FORMAT,
  experiences: {
    "mrs-kett-service-call": {
      challengeId: UNDERDRAIN_SERVICE_CHALLENGE_ID,
      entry: {
        beatId: "kett-kitchen-backflow",
        title: "Mrs. Kett's Kitchen",
        playerRoleId: "rhea-venn",
        playerRoleLabel: "Rhea Venn, licensed plumber",
        ordinaryStake: "Restore one customer's water before Bellwether converts a repair call into a military emergency.",
        primaryActionLabel: "Inspect the living trap joint",
      },
      commitments: [
        {
          id: "restore-service-first",
          label: "Restore service first",
          description: "Patch the household line before anyone turns the living blockage into evidence or a weapon.",
          runtimeSignals: [
            { kind: "affordance", id: "household-bypass-visible" },
            { kind: "presentation", id: "mrs-kett-tap-pressure" },
          ],
        },
        {
          id: "preserve-living-sample",
          label: "Preserve a sample",
          description: "Keep the tissue intact so Tess can prove that the blockage is regulating pressure rather than merely clogging the drain.",
          runtimeSignals: [
            { kind: "information", id: "living-tissue-sample" },
            { kind: "actor", id: "tess-diagnosis-channel" },
          ],
        },
      ],
      objectiveBindings: {
        "inspect-living-trap": {
          verb: "diagnose",
          targetKind: "mechanism",
          targetId: "kett-living-trap-joint",
          playerFacingLabel: "Inspect the living trap joint",
          completion: { kind: "interact_count", targetCount: 1 },
          storyPaymentId: "fact-living-clog-regulates-pressure",
        },
        "restore-kett-water": {
          verb: "repair",
          targetKind: "mechanism",
          targetId: "kett-household-bypass",
          playerFacingLabel: "Hold the bypass until Mrs. Kett's tap runs clear",
          completion: { kind: "hold_ticks", targetTicks: 45 },
          storyPaymentId: "fact-kett-water-restored",
        },
      },
      reveals: [
        {
          id: "living-pressure-route",
          objectiveId: "inspect-living-trap",
          trigger: "objective_completed",
          actorId: "tess-loam",
          factId: "fact-living-clog-regulates-pressure",
        },
        {
          id: "townwide-pressure-pattern",
          objectiveId: "restore-kett-water",
          trigger: "objective_completed",
          actorId: "rhea-venn",
          factId: "fact-backflow-is-townwide-network",
        },
      ],
      outcomes: {
        success: outcome(
          ["fact-kett-water-restored", "fact-living-clog-regulates-pressure"],
          ["obligation-answer-municipal-draft"],
          ["obligation-complete-service-call"],
          ["pump-seven-operation"],
        ),
        partial: outcome(
          ["fact-kett-water-temporarily-restored"],
          ["obligation-finish-kett-bypass"],
          [],
          ["mrs-kett-service-call"],
        ),
        failure: outcome(
          ["fact-kett-backflow-worsened"],
          ["obligation-retry-kett-service"],
          [],
          ["mrs-kett-service-call"],
        ),
      },
      checkpointKey: "underdrain:kett-service:v1",
      extensions: {
        "underdrain.presentation@1": {
          placeId: "mrs-kett-kitchen",
          safeOpening: true,
          firstMeaningfulSuccess: "household-water-restored",
        },
      },
    },
    "pump-seven-operation": {
      challengeId: UNDERDRAIN_CHALLENGE_ID,
      entry: {
        beatId: "municipal-draft-at-kett-kitchen",
        title: "The Draft and Pump Seven",
        playerRoleId: "rhea-venn",
        playerRoleLabel: "Rhea Venn, civilian plumber under municipal draft",
        ordinaryStake: "Keep Bellwether's water moving without letting the city purge a hidden fungal nursery.",
        primaryActionLabel: "Choose how Rhea enters Pump Seven",
      },
      commitments: [
        {
          id: "emergency-plan",
          label: "Follow the emergency plan",
          description: "Use the city's access codes while Marta and the Sanitary Reserve treat every living pipe as hostile infrastructure.",
          runtimeSignals: [
            { kind: "actor", id: "marta-command-channel" },
            { kind: "affordance", id: "municipal-override-controls" },
          ],
        },
        {
          id: "service-tunnel",
          label: "Take the old service tunnel",
          description: "Enter as a working plumber, following household pressure lines the military map ignores.",
          runtimeSignals: [
            { kind: "route", id: "old-service-tunnel" },
            { kind: "information", id: "household-pressure-map" },
          ],
        },
        {
          id: "truce-offer",
          label: "Carry Morrowcap's truce",
          description: "Enter with a literal promise that opens fungal signals and makes every act of force diplomatically legible.",
          runtimeSignals: [
            { kind: "information", id: "morrowcap-signal-key" },
            { kind: "affordance", id: "fungal-contact-prompts" },
          ],
        },
      ],
      objectiveBindings: {
        "diagnose-spore-valves": {
          verb: "diagnose",
          targetKind: "mechanism",
          targetId: "pump-seven-spore-valve-array",
          playerFacingLabel: "Inspect and reroute the three living spore valves",
          completion: { kind: "interact_count", targetCount: 3 },
          storyPaymentId: "fact-valves-shield-nursery-branch",
        },
        "operate-purge-wheel": {
          verb: "operate",
          targetKind: "mechanism",
          targetId: "pump-seven-purge-wheel",
          playerFacingLabel: "Hold the purge wheel at shared-flow pressure",
          completion: { kind: "hold_ticks", targetTicks: 90 },
          storyPaymentId: "fact-city-purge-would-flood-nursery",
        },
        "open-crown-sluice": {
          verb: "reroute",
          targetKind: "mechanism",
          targetId: "crown-sluice",
          playerFacingLabel: "Balance the Crown Sluice and open a communication route",
          completion: { kind: "hold_ticks", targetTicks: 75 },
          storyPaymentId: "fact-crown-contact-channel-open",
        },
      },
      reveals: [
        {
          id: "nursery-defense",
          objectiveId: "diagnose-spore-valves",
          trigger: "objective_completed",
          actorId: "tess-loam",
          factId: "fact-valves-shield-nursery-branch",
        },
        {
          id: "municipal-discharge-cause",
          objectiveId: "operate-purge-wheel",
          trigger: "objective_started",
          actorId: "morrowcap",
          factId: "fact-city-purge-would-flood-nursery",
        },
        {
          id: "crown-signal",
          objectiveId: "open-crown-sluice",
          trigger: "objective_completed",
          actorId: "morrowcap",
          factId: "fact-crown-contact-channel-open",
        },
      ],
      outcomes: {
        success: outcome(
          ["fact-pump-seven-balanced", "fact-nursery-route-preserved"],
          ["honor-fungal-embassy", "deliver-municipal-compost"],
          ["keep-water-running", "expose-enzyme-poisoning"],
          ["root-gate-parley"],
        ),
        partial: outcome(
          ["fact-pump-seven-ceasefire"],
          ["audit-lower-aquifer", "negotiate-fungal-labor-status"],
          ["keep-water-running"],
          ["root-gate-parley"],
        ),
        failure: outcome(
          ["fact-crown-controls-pump-seven"],
          ["restore-crown-pump", "pay-substrate-invoice"],
          [],
          ["root-gate-parley"],
        ),
      },
      checkpointKey: "underdrain:pump-seven:v1",
      extensions: {
        "underdrain.presentation@1": {
          placeId: "pump-seven",
          revealMustOccurBeforeResult: "nursery-defense",
          acceptedResultRequiredBeforeWorldDelta: true,
        },
      },
    },
    "root-gate-parley": {
      challengeId: UNDERDRAIN_ROOT_GATE_CHALLENGE_ID,
      entry: {
        beatId: "root-gate-opens",
        title: "Parley at the Root Gate",
        playerRoleId: "rhea-venn",
        playerRoleLabel: "Rhea Venn, plumber and reluctant liaison",
        ordinaryStake: "Separate water-flow rights from political sovereignty before either side turns emergency access into permanent occupation.",
        primaryActionLabel: "Propose a water compact",
      },
      commitments: [
        {
          id: "town-first-flow",
          label: "Town water first",
          description: "Guarantee Bellwether's household pressure and accept a higher Crown grievance debt.",
          runtimeSignals: [
            { kind: "world-state", id: "town-first-water-compact" },
            { kind: "presentation", id: "bellwether-pressure-map" },
          ],
        },
        {
          id: "nursery-first-flow",
          label: "Nursery protection first",
          description: "Protect the fungal nursery and force the city to ration until clean infrastructure exists.",
          runtimeSignals: [
            { kind: "world-state", id: "nursery-first-water-compact" },
            { kind: "relationship", id: "crown-trust-increase" },
          ],
        },
        {
          id: "balanced-flow-compact",
          label: "Balanced flow compact",
          description: "Bind both sides to shared meters, evidence custody, and a jointly operated sluice.",
          runtimeSignals: [
            { kind: "affordance", id: "joint-sluice-controls" },
            { kind: "actor", id: "rhea-liaison-role" },
          ],
        },
      ],
      objectiveBindings: {
        "negotiate-water-compact": {
          verb: "negotiate",
          targetKind: "actor",
          targetId: "crown-regent-and-bellwether-council",
          playerFacingLabel: "Choose the water compact Bellwether must honor",
          completion: {
            kind: "authored_choice",
            choiceIds: ["town-first-flow", "nursery-first-flow", "balanced-flow-compact"],
          },
          storyPaymentId: "fact-root-gate-compact-decided",
        },
      },
      reveals: [
        {
          id: "root-gate-history",
          objectiveId: "negotiate-water-compact",
          trigger: "objective_started",
          actorId: "morrowcap",
          factId: "fact-crown-predates-bellwether-water-grid",
        },
      ],
      outcomes: {
        success: outcome(
          ["fact-balanced-water-compact"],
          [],
          ["honor-fungal-embassy", "negotiate-fungal-labor-status"],
          [],
          true,
        ),
        partial: outcome(
          ["fact-provisional-root-gate-compact"],
          [],
          ["audit-lower-aquifer"],
          [],
          true,
        ),
        failure: outcome(
          ["fact-root-gate-talks-suspended"],
          [],
          [],
          [],
          true,
        ),
      },
      checkpointKey: "underdrain:root-gate:v1",
      extensions: {
        "underdrain.presentation@1": {
          placeId: "root-gate",
          playableSuccessor: true,
          demoTerminalAfterAcceptedCompact: true,
        },
      },
    },
  },
  extensions: {
    "underdrain.episode-order@1": [...UNDERDRAIN_EXPERIENCE_IDS],
  },
};

const RAW_UNDERDRAIN_ARC = {
  meta: {
    id: UNDERDRAIN_DEMO_ID,
    name: "UNDERDRAIN: The Bloom Below",
    description:
      "Bellwether's plumber discovers that its drain plague is a hidden water-rights war with a fungal kingdom beneath the town.",
    author: "AXM standalone-demo author",
    version: "2.0.0",
    engineVersion: "1.4.0",
    domain: "municipal-fungal-action-comedy",
    estimatedCycles: 3,
  },
  attributes: [
    { id: "pressure", name: "Pressure", description: "Hydraulic force, leverage, and the courage to open a live main." },
    { id: "diagnosis", name: "Diagnosis", description: "Reading infrastructure, symptoms, and hidden causes." },
    { id: "nerve", name: "Nerve", description: "Working under alarms, spores, and municipal observation." },
  ],
  roles: [
    { id: "pipefighter", name: "Pipefighter", attributeWeights: { pressure: 0.5, diagnosis: 0.25, nerve: 0.25 } },
    { id: "spotter", name: "Spotter", attributeWeights: { pressure: 0.15, diagnosis: 0.55, nerve: 0.3 } },
  ],
  tiers: [
    { id: "licensed", name: "Licensed", statBudgetMin: 30, statBudgetMax: 42, upkeepCost: 2, baseEfficiencyModifier: 1 },
    { id: "apprentice", name: "Apprentice", statBudgetMin: 20, statBudgetMax: 30, upkeepCost: 1, baseEfficiencyModifier: 1.1 },
  ],
  currencyName: "Civic Credit",
  materialName: "Burst Seals",
  tokenName: "Emergency Orders",
  reputationName: "Public Works Standing",
  tokensPerCycle: 2,
  maxTokens: 4,
  infrastructureTokenBonus: 0.1,
  namePool: {
    firstNames: ["Rhea", "Dax", "Tess", "Marta", "Morrowcap"],
    lastNames: ["Venn", "Loam", "Sump", "Rusk"],
  },
  customTraits: [],
  stateDefinitions: [
    {
      id: "town-water-pressure",
      label: "Town water pressure",
      description: "Bellwether's usable household and civic water pressure.",
      visibility: "public",
      kind: "number",
      initial: 2,
      min: 0,
      max: 10,
    },
    {
      id: "kett-water",
      label: "Mrs. Kett's water",
      description: "Whether the first household service call has actually restored water.",
      visibility: "public",
      kind: "boolean",
      initial: false,
    },
    {
      id: "fungus-contact",
      label: "Fungal contact",
      description: "The town's accepted relationship with the hidden Crown.",
      visibility: "public",
      kind: "enum",
      initial: "rumor",
      values: ["rumor", "confirmed", "parley", "compact", "hostile"],
    },
    {
      id: "crown-grievance",
      label: "Crown grievance",
      description: "Accumulated injury and distrust held by the fungal Crown.",
      visibility: "public",
      kind: "number",
      initial: 5,
      min: 0,
      max: 10,
    },
    {
      id: "rhea-status",
      label: "Rhea's civic status",
      description: "Whether Rhea is treated as a civilian plumber, drafted auxiliary, or recognized liaison.",
      visibility: "public",
      kind: "enum",
      initial: "civilian",
      values: ["civilian", "drafted", "liaison"],
    },
    {
      id: "evidence-custody",
      label: "Discharge evidence",
      description: "Custody state of the evidence connecting Bellwether's antifungal discharge to the nursery crisis.",
      visibility: "public",
      kind: "enum",
      initial: "unknown",
      values: ["unknown", "sampled", "public", "sealed"],
    },
    {
      id: "root-gate-open",
      label: "Root Gate access",
      description: "Whether the Root Gate parley is physically and politically accessible.",
      visibility: "public",
      kind: "boolean",
      initial: false,
    },
  ],
  progressionTiers: [{
    id: "mandatory-pipe-service",
    name: "Mandatory Pipe Service",
    flavorText: "A household repair exposes a hidden polity and drafts one plumber into the town's first water compact.",
    unlockConditions: { orgMilestones: [], reputationMinimum: null },
    challenges: [
      UNDERDRAIN_SERVICE_CHALLENGE_ID,
      UNDERDRAIN_CHALLENGE_ID,
      UNDERDRAIN_ROOT_GATE_CHALLENGE_ID,
    ],
    requiredChallenges: [UNDERDRAIN_SERVICE_CHALLENGE_ID, UNDERDRAIN_CHALLENGE_ID],
    optionalChallenges: [UNDERDRAIN_ROOT_GATE_CHALLENGE_ID],
  }],
  attunementChains: [],
  challenges: [
    {
      id: UNDERDRAIN_SERVICE_CHALLENGE_ID,
      name: "Mrs. Kett's Living Drain",
      description: "Diagnose the living trap joint and restore one household's water without turning the service call into combat.",
      rosterRequirements: {
        minAgents: 1,
        maxAgents: 2,
        roleRequirements: [{ roleId: "pipefighter", count: 1 }],
      },
      accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
      difficultyRating: 12,
      mechanicChecks: [
        {
          id: "inspect-living-trap",
          name: "Inspect the Living Trap Joint",
          description: "Read the luminous tissue as a pressure mechanism before cutting it.",
          attributeWeights: [
            { attributeId: "diagnosis", weight: 0.8 },
            { attributeId: "nerve", weight: 0.2 },
          ],
          difficultyThreshold: 5,
          scope: "team_aggregate" as const,
          failureConsequence: { type: "stress" as const, severity: 0.1 },
        },
        {
          id: "restore-kett-water",
          name: "Restore Mrs. Kett's Water",
          description: "Hold the clean bypass open until the household line runs clear.",
          attributeWeights: [
            { attributeId: "pressure", weight: 0.55 },
            { attributeId: "diagnosis", weight: 0.45 },
          ],
          difficultyThreshold: 6,
          scope: "team_aggregate" as const,
          failureConsequence: { type: "stress" as const, severity: 0.1 },
        },
      ],
      completionCriteria: { type: "all_mechanics_passed" as const, parameters: {} },
      timePressure: null,
      outcomes: {
        success: {
          rewardTable: [],
          narrative: "Mrs. Kett's tap runs. The living tissue reveals that Bellwether's drain plague is one connected pressure network.",
          reputationGain: 1,
          milestoneFlag: "kett-water-restored",
          stateEffects: [
            { stateId: "kett-water", reason: "service-call-success", operation: "set", value: true },
            { stateId: "town-water-pressure", reason: "east-line-restored", operation: "increment", value: 1, overflow: "clamp" },
            { stateId: "evidence-custody", reason: "living-sample-observed", operation: "transition", to: "sampled" },
          ],
        },
        partial: {
          rewardTable: [],
          narrative: "The tap sputters back for now. Rhea has a working bypass and an unfinished service obligation.",
          reputationGain: 0,
          stateEffects: [
            { stateId: "kett-water", reason: "temporary-bypass", operation: "set", value: true },
            { stateId: "town-water-pressure", reason: "temporary-household-flow", operation: "increment", value: 0.5, overflow: "clamp" },
            { stateId: "evidence-custody", reason: "living-sample-observed", operation: "transition", to: "sampled" },
          ],
        },
        failure: {
          rewardTable: [],
          narrative: "The bypass slips and the backflow worsens, but the living joint remains available for an immediate retry.",
          stressPenalty: 1,
          stateEffects: [
            { stateId: "evidence-custody", reason: "failed-service-still-observed", operation: "transition", to: "sampled" },
          ],
        },
      },
    },
    {
      id: UNDERDRAIN_CHALLENGE_ID,
      name: "Stabilize Pump Seven",
      description:
        "Diagnose three living valves, operate the purge wheel at shared-flow pressure, and balance the Crown Sluice before the city floods a fungal nursery.",
      rosterRequirements: {
        minAgents: 1,
        maxAgents: 3,
        roleRequirements: [{ roleId: "pipefighter", count: 1 }],
      },
      accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
      difficultyRating: 44,
      mechanicChecks: [
        {
          id: "diagnose-spore-valves",
          name: "Diagnose the Spore Valves",
          description: "Inspect and reroute the living valves while Caplings defend the nursery branch.",
          attributeWeights: [
            { attributeId: "diagnosis", weight: 0.6 },
            { attributeId: "pressure", weight: 0.4 },
          ],
          difficultyThreshold: 11,
          scope: "team_aggregate" as const,
          failureConsequence: { type: "stress" as const, severity: 0.3 },
        },
        {
          id: "operate-purge-wheel",
          name: "Operate the Purge Wheel",
          description: "Hold the wheel at a shared-flow setting while the Boleguard contests the mechanism.",
          attributeWeights: [
            { attributeId: "nerve", weight: 0.5 },
            { attributeId: "pressure", weight: 0.5 },
          ],
          difficultyThreshold: 12,
          scope: "team_aggregate" as const,
          failureConsequence: { type: "team_damage" as const, severity: 0.45 },
        },
        {
          id: "open-crown-sluice",
          name: "Balance the Crown Sluice",
          description: "Operate the sluice under Knight pressure and preserve a water route to the nursery and the town.",
          attributeWeights: [
            { attributeId: "pressure", weight: 0.45 },
            { attributeId: "diagnosis", weight: 0.4 },
            { attributeId: "nerve", weight: 0.15 },
          ],
          difficultyThreshold: 14,
          scope: "team_aggregate" as const,
          failureConsequence: { type: "cascade" as const, severity: 0.7 },
        },
      ],
      completionCriteria: { type: "all_mechanics_passed" as const, parameters: {} },
      timePressure: { rounds: 4, aggregateThreshold: 35, attributeId: "pressure" },
      outcomes: {
        success: {
          rewardTable: [],
          narrative: "Pump Seven reaches balanced flow. Bellwether has water, the nursery route survives, and the Root Gate opens for formal parley.",
          reputationGain: 4,
          currencyReward: 80,
          milestoneFlag: "pump-seven-balanced",
          stateEffects: [
            { stateId: "town-water-pressure", reason: "pump-seven-balanced", operation: "increment", value: 3, overflow: "clamp" },
            { stateId: "fungus-contact", reason: "crown-channel-open", operation: "transition", to: "parley" },
            { stateId: "crown-grievance", reason: "nursery-route-preserved", operation: "decrement", value: 2, overflow: "clamp" },
            { stateId: "rhea-status", reason: "civilian-repair-authority-recognized", operation: "transition", to: "liaison" },
            { stateId: "evidence-custody", reason: "discharge-cause-recorded", operation: "transition", to: "public" },
            { stateId: "root-gate-open", reason: "crown-sluice-contact", operation: "set", value: true },
          ],
        },
        partial: {
          rewardTable: [],
          narrative: "The pump holds under a ceasefire. Water returns unevenly, the nursery survives, and both sides agree to a tense Root Gate meeting.",
          reputationGain: 2,
          agentDowntimeCycles: 1,
          stateEffects: [
            { stateId: "town-water-pressure", reason: "pump-seven-ceasefire", operation: "increment", value: 1, overflow: "clamp" },
            { stateId: "fungus-contact", reason: "crown-confirmed", operation: "transition", to: "confirmed" },
            { stateId: "crown-grievance", reason: "sluice-damage", operation: "increment", value: 1, overflow: "clamp" },
            { stateId: "rhea-status", reason: "draft-remains-active", operation: "transition", to: "drafted" },
            { stateId: "root-gate-open", reason: "ceasefire-parley", operation: "set", value: true },
          ],
        },
        failure: {
          rewardTable: [],
          narrative: "The Crown controls Pump Seven. Bellwether enters toilet rationing and must negotiate access from the Root Gate under fungal terms.",
          stressPenalty: 3,
          tokenRefund: 0.5,
          stateEffects: [
            { stateId: "town-water-pressure", reason: "pump-seven-lost", operation: "decrement", value: 2, overflow: "clamp" },
            { stateId: "fungus-contact", reason: "crown-hostility", operation: "transition", to: "hostile" },
            { stateId: "crown-grievance", reason: "pump-seven-assault", operation: "increment", value: 2, overflow: "clamp" },
            { stateId: "rhea-status", reason: "emergency-draft", operation: "transition", to: "drafted" },
            { stateId: "root-gate-open", reason: "access-negotiation-required", operation: "set", value: true },
          ],
        },
      },
    },
    {
      id: UNDERDRAIN_ROOT_GATE_CHALLENGE_ID,
      name: "Parley at the Root Gate",
      description: "Choose the water compact that defines Bellwether's obligations to the older fungal polity beneath it.",
      rosterRequirements: {
        minAgents: 1,
        maxAgents: 3,
        roleRequirements: [{ roleId: "pipefighter", count: 1 }],
      },
      accessRequirements: { orgMilestones: [], agentAttunements: [], attunementThreshold: null },
      difficultyRating: 28,
      mechanicChecks: [{
        id: "negotiate-water-compact",
        name: "Negotiate the Water Compact",
        description: "Separate emergency flow rights from sovereignty and choose a compact both sides must remember.",
        attributeWeights: [
          { attributeId: "diagnosis", weight: 0.45 },
          { attributeId: "nerve", weight: 0.35 },
          { attributeId: "pressure", weight: 0.2 },
        ],
        difficultyThreshold: 10,
        scope: "team_aggregate" as const,
        failureConsequence: { type: "stress" as const, severity: 0.25 },
      }],
      completionCriteria: { type: "all_mechanics_passed" as const, parameters: {} },
      timePressure: null,
      outcomes: {
        success: {
          rewardTable: [],
          narrative: "The balanced-flow compact recognizes the Crown, protects the nursery, and makes Rhea Bellwether's first subsurface liaison.",
          reputationGain: 5,
          milestoneFlag: "root-gate-compact",
          stateEffects: [
            { stateId: "fungus-contact", reason: "water-compact-ratified", operation: "transition", to: "compact" },
            { stateId: "crown-grievance", reason: "shared-flow-recognized", operation: "decrement", value: 2, overflow: "clamp" },
            { stateId: "rhea-status", reason: "liaison-office-created", operation: "transition", to: "liaison" },
            { stateId: "evidence-custody", reason: "discharge-record-published", operation: "transition", to: "public" },
          ],
        },
        partial: {
          rewardTable: [],
          narrative: "A provisional compact keeps water moving while the city and Crown argue over labor, evidence, and meter custody.",
          reputationGain: 2,
          stateEffects: [
            { stateId: "fungus-contact", reason: "provisional-compact", operation: "transition", to: "parley" },
            { stateId: "crown-grievance", reason: "partial-recognition", operation: "decrement", value: 1, overflow: "clamp" },
            { stateId: "rhea-status", reason: "provisional-liaison", operation: "transition", to: "liaison" },
          ],
        },
        failure: {
          rewardTable: [],
          narrative: "The Root Gate closes without a compact. Water access continues under emergency terms and every side keeps its grievance ledger.",
          stressPenalty: 1,
          stateEffects: [
            { stateId: "fungus-contact", reason: "parley-suspended", operation: "transition", to: "hostile" },
            { stateId: "crown-grievance", reason: "recognition-refused", operation: "increment", value: 1, overflow: "clamp" },
            { stateId: "evidence-custody", reason: "discharge-record-sealed", operation: "transition", to: "sealed" },
          ],
        },
      },
    },
  ],
  difficultyModes: [
    {
      id: "service-tunnel",
      name: "Old Service Tunnel",
      globalModifiers: { difficultyMultiplier: 1.1, rewardMultiplier: 1.15, mechanicAdditions: [] },
    },
    {
      id: "truce-offer",
      name: "Carry the Truce",
      globalModifiers: { difficultyMultiplier: 0.85, rewardMultiplier: 0.9, mechanicAdditions: [] },
    },
  ],
  items: [],
  narrativeEvents: [],
  scaling: null,
  opening: {
    triggerType: "service-call",
    narrativeText:
      "Mrs. Kett's sink has grown a luminous second trap. Rhea can restore service, preserve the living tissue, or trace the pressure route before Bellwether's emergency office arrives.",
    options: [
      {
        id: "restore-service-first",
        label: "Restore service first",
        description: "Get the household tap running before the city takes custody of the repair.",
        effects: [{ scope: "all" as const, type: "morale" as const, value: 1 }],
      },
      {
        id: "preserve-living-sample",
        label: "Preserve a living sample",
        description: "Keep enough tissue intact for Tess to diagnose the pressure network.",
        effects: [{ scope: "all" as const, type: "loyalty" as const, value: 1 }],
      },
      {
        id: "trace-pressure-route",
        label: "Trace the pressure route",
        description: "Follow the living line toward Pump Seven before the backflow shifts again.",
        effects: [{ scope: "all" as const, type: "stress" as const, value: 1 }],
      },
    ],
  },
  founding: {
    organization: { id: "bellwether-sanitary-reserve", name: "Bellwether Sanitary Defense Reserve" },
    resources: { currency: 40, materials: 3, tokens: 2 },
    facilities: [
      { type: "Quarters" as const, level: 1 },
      { type: "Production" as const, level: 1 },
      { type: "Recreation" as const, level: 0 },
      { type: "Research" as const, level: 1 },
      { type: "Training" as const, level: 0 },
      { type: "Storage" as const, level: 1 },
      { type: "Medical" as const, level: 0 },
    ],
    distributionPolicy: "council" as const,
    roster: [
      { id: "rhea-venn", name: "Rhea Venn", tierId: "licensed", roleId: "pipefighter" },
      { id: "tess-loam", name: "Tess Loam", tierId: "apprentice", roleId: "spotter" },
    ],
    relationships: [{
      rosterSlotIds: ["rhea-venn", "tess-loam"] as [string, string],
      state: "Mentorship" as const,
      affinity: 8,
    }],
  },
  extensions: {
    [ACTION_EXTENSION_KEY]: UNDERDRAIN_ACTION_PROFILE,
    [ACTION_OBJECTIVE_EXTENSION_KEY]: UNDERDRAIN_ACTION_OBJECTIVE_PROFILE,
    [AUTHORED_EXPERIENCE_EXTENSION_KEY]: UNDERDRAIN_AUTHORED_EXPERIENCE_PROFILE,
    "axm.demo@1": {
      format: "axm-standalone-demo/2",
      episodeId: "mandatory-pipe-service",
      noAccount: true,
      noBackend: true,
      noNetwork: true,
      classification: "authored-pilot-candidate",
    },
  },
};

export const UNDERDRAIN_DRAFT_ARC: Arc = validateArc(RAW_UNDERDRAIN_ARC);
export const UNDERDRAIN_SERVICE_CHALLENGE = UNDERDRAIN_DRAFT_ARC.challenges.find(
  (challenge) => challenge.id === UNDERDRAIN_SERVICE_CHALLENGE_ID,
)!;
export const UNDERDRAIN_CHALLENGE = UNDERDRAIN_DRAFT_ARC.challenges.find(
  (challenge) => challenge.id === UNDERDRAIN_CHALLENGE_ID,
)!;
export const UNDERDRAIN_ROOT_GATE_CHALLENGE = UNDERDRAIN_DRAFT_ARC.challenges.find(
  (challenge) => challenge.id === UNDERDRAIN_ROOT_GATE_CHALLENGE_ID,
)!;
