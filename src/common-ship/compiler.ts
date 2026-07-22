import type {
  Arc,
  ArcAttribute,
  ArcRole,
  ArcTier,
  Challenge,
  FoundingFacility,
  JsonValue,
  MechanicCheck,
} from "../engine/types.js";
import { validateArc } from "../engine/schema.js";
import { parseCommonShipPocket } from "./schema.js";
import {
  COMMON_SHIP_EXTENSION_KEY,
  type CommonShipPocketSource,
  type CommonShipWatchBlueprint,
} from "./types.js";

const ATTRIBUTES: ArcAttribute[] = [
  { id: "care", name: "Care", description: "Keep bodies, ordinary goods, recovery, and consent visible inside operational decisions." },
  { id: "systems", name: "Systems", description: "Read and maintain habitat, transit, stores, interfaces, and compatibility dependencies." },
  { id: "translation", name: "Translation", description: "Preserve meaning, tempo, sensorium, provenance, and refusal across incompatible persons." },
  { id: "continuity", name: "Continuity", description: "Carry memory, kinship, standing, and unfinished obligations across watches and generations." },
  { id: "judgment", name: "Judgment", description: "Separate physical urgency from institutional pressure and choose bounded authority under uncertainty." },
  { id: "resolve", name: "Resolve", description: "Act before the decision horizon closes while accepting that the ship will inherit the precedent." },
];

const ROLES: ArcRole[] = [
  { id: "response", name: "Response", attributeWeights: { care: 0.05, systems: 0.15, translation: 0.05, continuity: 0.1, judgment: 0.25, resolve: 0.4 } },
  { id: "mediation", name: "Mediation", attributeWeights: { care: 0.2, systems: 0.05, translation: 0.35, continuity: 0.1, judgment: 0.2, resolve: 0.1 } },
  { id: "analysis", name: "Analysis", attributeWeights: { care: 0.05, systems: 0.2, translation: 0.15, continuity: 0.15, judgment: 0.4, resolve: 0.05 } },
  { id: "maintenance", name: "Maintenance", attributeWeights: { care: 0.15, systems: 0.45, translation: 0.05, continuity: 0.15, judgment: 0.1, resolve: 0.1 } },
  { id: "care", name: "Care", attributeWeights: { care: 0.45, systems: 0.05, translation: 0.15, continuity: 0.15, judgment: 0.1, resolve: 0.1 } },
  { id: "continuity", name: "Continuity", attributeWeights: { care: 0.1, systems: 0.1, translation: 0.15, continuity: 0.4, judgment: 0.2, resolve: 0.05 } },
];

const TIERS: ArcTier[] = [
  { id: "resident", name: "Ship Resident", statBudgetMin: 40, statBudgetMax: 48, upkeepCost: 1, baseEfficiencyModifier: 1.15 },
  { id: "watch", name: "Watch Officer", statBudgetMin: 46, statBudgetMax: 54, upkeepCost: 2, baseEfficiencyModifier: 1.05 },
  { id: "sovereign", name: "Sovereign Exception", statBudgetMin: 52, statBudgetMax: 60, upkeepCost: 3, baseEfficiencyModifier: 0.95 },
];

const FACILITIES: FoundingFacility[] = [
  { type: "Quarters", level: 1 },
  { type: "Production", level: 1 },
  { type: "Recreation", level: 1 },
  { type: "Research", level: 1 },
  { type: "Training", level: 0 },
  { type: "Storage", level: 1 },
  { type: "Medical", level: 1 },
];

function mechanicFor(check: CommonShipWatchBlueprint["checks"][number]): MechanicCheck {
  const weights = Object.entries(check.weights)
    .filter((entry): entry is [string, number] => entry[1] !== undefined)
    .map(([attributeId, weight]) => ({ attributeId, weight }));
  return {
    id: check.id,
    name: check.name,
    description: check.description,
    attributeWeights: weights,
    difficultyThreshold: check.threshold,
    scope: check.scope === "team" ? "team_aggregate" : check.scope === "role" ? "role_specific" : "per_agent",
    ...(check.scope === "team" ? { thresholdMode: "perAssignedAgent" as const } : {}),
    ...(check.scope === "role" ? { roleIds: check.roleIds } : {}),
    failureConsequence: { type: check.failureType ?? "stress", severity: check.severity ?? 0.2 },
  };
}

function challengeFor(watch: CommonShipWatchBlueprint): Challenge {
  const stateReceipt = watch.shipStateEffects
    .map((effect) => `${effect.track} ${effect.delta > 0 ? "+" : ""}${effect.delta}: ${effect.reason}`)
    .join(" · ");
  return {
    id: watch.id,
    name: watch.name,
    description: `${watch.description} Decision horizon: ${watch.horizon.closesWhen}`,
    rosterRequirements: {
      minAgents: watch.minAgents,
      maxAgents: watch.maxAgents,
      roleRequirements: watch.requiredRoles ?? [],
    },
    accessRequirements: {
      orgMilestones: watch.accessAfter ? [`${watch.accessAfter}-cleared`] : [],
      agentAttunements: [],
      attunementThreshold: null,
    },
    difficultyRating: watch.difficulty,
    mechanicChecks: watch.checks.map(mechanicFor),
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    resourceSpend: { maxTokens: 1, steadinessPerToken: 0.25, minSteadiness: 0.7 },
    outcomes: {
      success: {
        rewardTable: [],
        narrative: `${watch.success} ${stateReceipt}`,
        reputationGain: watch.reputationGain,
        currencyReward: watch.currencyReward,
        milestoneFlag: `${watch.id}-cleared`,
      },
      partial: {
        rewardTable: [],
        narrative: `${watch.partial} ${stateReceipt}`,
        reputationGain: Math.max(0, watch.reputationGain - 1),
        agentDowntimeCycles: 1,
      },
      failure: {
        rewardTable: [],
        narrative: `${watch.failure} ${stateReceipt}`,
        stressPenalty: 2,
        tokenRefund: 0.5,
      },
    },
  };
}

export function compileCommonShipPocket(input: unknown): Arc {
  const source = parseCommonShipPocket(input);
  const watchesByTier = (tier: CommonShipWatchBlueprint["tierId"]) =>
    source.watches.filter((watch) => watch.tierId === tier).map((watch) => watch.id);
  const finalWatch = source.watches[source.watches.length - 1]!;
  const tierFor = (responsibility: CommonShipPocketSource["cast"][number]["responsibility"]): string => {
    if (responsibility === "sovereign-exception") return "sovereign";
    if (responsibility === "understands-maintenance-reality" || responsibility === "translates-excluded-actor") return "watch";
    return "resident";
  };

  const arc: Arc = {
    meta: {
      id: source.identity.id,
      name: source.identity.title,
      description: source.identity.description,
      author: source.identity.author,
      version: source.identity.version,
      engineVersion: "1.2.0",
      domain: "godscar-common-ship",
      estimatedCycles: source.identity.estimatedCycles,
    },
    attributes: ATTRIBUTES,
    roles: ROLES,
    tiers: TIERS,
    currencyName: "Common Standing",
    materialName: "Stores",
    tokenName: "Watch",
    reputationName: "Trust",
    tokensPerCycle: 2,
    maxTokens: 6,
    infrastructureTokenBonus: 0.1,
    namePool: {
      firstNames: source.cast.map((member) => member.name.split(/\s+/)[0]!).filter(Boolean),
      lastNames: source.cast.map((member) => member.name.split(/\s+/).slice(1).join(" ")).filter(Boolean),
    },
    customTraits: [],
    progressionTiers: [
      {
        id: "ordinary-life",
        name: "Ordinary Life",
        flavorText: "The school, meal, family, recovery cycle, or private habitat establishes what operation is supposed to preserve.",
        unlockConditions: { orgMilestones: [], reputationMinimum: null },
        challenges: watchesByTier("ordinary-life"),
        requiredChallenges: watchesByTier("ordinary-life"),
        optionalChallenges: [],
      },
      {
        id: "compose-watch",
        name: "Compose the Watch",
        flavorText: "Roles, bodies, clocks, habitats, translators, reserves, and absences are assembled into a temporary polity.",
        unlockConditions: { orgMilestones: watchesByTier("ordinary-life").slice(-1).map((id) => `${id}-cleared`), reputationMinimum: null },
        challenges: watchesByTier("compose-watch"),
        requiredChallenges: watchesByTier("compose-watch"),
        optionalChallenges: [],
      },
      {
        id: "resolve-pressure",
        name: "Resolve the Pressure",
        flavorText: "The watch acts before classification becomes certain and changes the ship state through a concrete allocation.",
        unlockConditions: { orgMilestones: watchesByTier("compose-watch").slice(-1).map((id) => `${id}-cleared`), reputationMinimum: null },
        challenges: watchesByTier("resolve-pressure"),
        requiredChallenges: watchesByTier("resolve-pressure"),
        optionalChallenges: [],
      },
      {
        id: "handoff",
        name: "Handoff and Precedent",
        flavorText: "Dissent, injury, debt, promises, missing persons, and uncertainty become the infrastructure inherited by the next watch.",
        unlockConditions: { orgMilestones: watchesByTier("resolve-pressure").slice(-1).map((id) => `${id}-cleared`), reputationMinimum: null },
        challenges: watchesByTier("handoff"),
        requiredChallenges: watchesByTier("handoff"),
        optionalChallenges: [],
      },
    ],
    attunementChains: [],
    challenges: source.watches.map(challengeFor),
    difficultyModes: [],
    items: [],
    narrativeEvents: [{
      trigger: { type: "arc_complete", target: finalWatch.id },
      title: "The next watch inherits the ship",
      text: `The immediate horizon is closed, but the prior constitution cannot be restored. ${source.controlQuestion}`,
      rewards: source.consequences.map((consequence) => consequence.label),
      agentUnlock: null,
    }],
    scaling: null,
    opening: {
      triggerType: "common-ship-pocket-opening",
      narrativeText: source.controlQuestion,
      options: [
        {
          id: "mark-the-baseline",
          label: "Mark the baseline",
          description: "Name the host body, clock, interface, and adaptation tax before composing the first watch.",
          effects: [{ scope: "all", type: "loyalty", value: 6 }],
        },
        {
          id: "accept-the-emergency-baseline",
          label: "Accept the emergency baseline",
          description: "Use the inherited standard for the immediate horizon while preserving the obligation to audit and revise it afterward.",
          effects: [{ scope: "all", type: "morale", value: 6 }],
        },
      ],
    },
    founding: {
      organization: { id: `${source.identity.id}-commonship`, name: source.identity.title },
      resources: { currency: 80, materials: 40, tokens: 4 },
      facilities: FACILITIES,
      distributionPolicy: "council",
      roster: source.cast.map((member) => ({
        id: member.id,
        name: member.name,
        tierId: tierFor(member.responsibility),
        roleId: member.roleId,
        morale: member.responsibility === "depends-on-host-baseline" ? 68 : member.responsibility === "bears-adaptation-tax" ? 52 : 62,
      })),
      relationships: [],
    },
    extensions: { [COMMON_SHIP_EXTENSION_KEY]: source as unknown as JsonValue },
  };

  return validateArc(arc);
}

export function readCommonShipPocketExtension(arc: Arc): CommonShipPocketSource | null {
  const value = arc.extensions?.[COMMON_SHIP_EXTENSION_KEY];
  if (value === undefined) return null;
  return parseCommonShipPocket(value);
}
