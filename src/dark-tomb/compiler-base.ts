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
import { parseDarkTombPocket } from "./schema.js";
import {
  DARK_TOMB_EXTENSION_KEY,
  type DarkTombDelveBlueprint,
  type DarkTombPocketSource,
} from "./types.js";

const ATTRIBUTES: ArcAttribute[] = [
  { id: "care", name: "Care", description: "Keep the ordinary lives protected by the tomb visible inside every emergency calculation." },
  { id: "evidence", name: "Evidence", description: "Recover, qualify, preserve, and communicate claims whose verification changes the map." },
  { id: "systems", name: "Systems", description: "Read and maintain the buried commons, quiet works, inherited defenses, and dependencies." },
  { id: "jurisdiction", name: "Jurisdiction", description: "Navigate doors, credentials, maps, sovereignties, and incompatible claims to authority." },
  { id: "opacity", name: "Opacity", description: "Manage wake and exterior classification without granting one system total internal observability." },
  { id: "resolve", name: "Resolve", description: "Act under asymmetric risk before the new classification can be made certain." },
];

const ROLES: ArcRole[] = [
  { id: "wakekeeper", name: "Wakekeeper", attributeWeights: { care: 0.05, evidence: 0.05, systems: 0.3, jurisdiction: 0.2, opacity: 0.35, resolve: 0.05 } },
  { id: "surface-bearer", name: "Surface Bearer", attributeWeights: { care: 0.35, evidence: 0.05, systems: 0.05, jurisdiction: 0.1, opacity: 0.2, resolve: 0.25 } },
  { id: "maintainer", name: "Maintainer", attributeWeights: { care: 0.15, evidence: 0.05, systems: 0.45, jurisdiction: 0.05, opacity: 0.2, resolve: 0.1 } },
  { id: "interlocutor", name: "Interlocutor", attributeWeights: { care: 0.25, evidence: 0.15, systems: 0.05, jurisdiction: 0.25, opacity: 0.15, resolve: 0.15 } },
  { id: "witness", name: "Witness", attributeWeights: { care: 0.1, evidence: 0.45, systems: 0.1, jurisdiction: 0.15, opacity: 0.1, resolve: 0.1 } },
  { id: "deliberator", name: "Deliberator", attributeWeights: { care: 0.15, evidence: 0.2, systems: 0.05, jurisdiction: 0.25, opacity: 0.2, resolve: 0.15 } },
  { id: "exception", name: "Sovereign Exception", attributeWeights: { care: 0.15, evidence: 0.05, systems: 0.05, jurisdiction: 0.15, opacity: 0.3, resolve: 0.3 } },
];

const TIERS: ArcTier[] = [
  { id: "local", name: "Common Depths Actor", statBudgetMin: 40, statBudgetMax: 48, upkeepCost: 1, baseEfficiencyModifier: 1.15 },
  { id: "layer", name: "Layer Custodian", statBudgetMin: 46, statBudgetMax: 54, upkeepCost: 2, baseEfficiencyModifier: 1.05 },
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

function mechanicFor(check: DarkTombDelveBlueprint["checks"][number]): MechanicCheck {
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

function challengeFor(delve: DarkTombDelveBlueprint): Challenge {
  return {
    id: delve.id,
    name: delve.name,
    description: delve.description,
    rosterRequirements: {
      minAgents: delve.minAgents,
      maxAgents: delve.maxAgents,
      roleRequirements: delve.requiredRoles ?? [],
    },
    accessRequirements: {
      orgMilestones: delve.accessAfter ? [`${delve.accessAfter}-cleared`] : [],
      agentAttunements: [],
      attunementThreshold: null,
    },
    difficultyRating: delve.difficulty,
    mechanicChecks: delve.checks.map(mechanicFor),
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    resourceSpend: { maxTokens: 1, steadinessPerToken: 0.25, minSteadiness: 0.7 },
    outcomes: {
      success: {
        rewardTable: [],
        narrative: delve.success,
        reputationGain: delve.reputationGain,
        currencyReward: delve.currencyReward,
        milestoneFlag: `${delve.id}-cleared`,
      },
      partial: {
        rewardTable: [],
        narrative: delve.partial,
        reputationGain: Math.max(0, delve.reputationGain - 1),
        agentDowntimeCycles: 1,
      },
      failure: {
        rewardTable: [],
        narrative: delve.failure,
        stressPenalty: 2,
        tokenRefund: 0.5,
      },
    },
  };
}

export function compileDarkTombPocket(input: unknown): Arc {
  const source = parseDarkTombPocket(input);
  const delvesByTier = (tier: DarkTombDelveBlueprint["tierId"]) =>
    source.delves.filter((delve) => delve.tierId === tier).map((delve) => delve.id);
  const finalDelve = source.delves[source.delves.length - 1]!;
  const tierFor = (responsibility: DarkTombPocketSource["cast"][number]["responsibility"]): string => {
    if (responsibility === "sovereign-exception") return "sovereign";
    if (responsibility === "holds-map-changing-evidence" || responsibility === "understands-quiet-works") return "layer";
    return "local";
  };
  // Quiet Tonnage must carry the exact founding cast through retries without
  // turning ordinary upkeep into a silent campaign softlock. Reserve six
  // authored campaign horizons at the maximum tier cost per resident; actual
  // lower tiers and authored rewards remain ordinary surplus.
  const foundingCurrency = Math.max(80, source.identity.estimatedCycles * source.cast.length * 3 * 6);

  const arc: Arc = {
    meta: {
      id: source.identity.id,
      name: source.identity.title,
      description: source.identity.description,
      author: source.identity.author,
      version: source.identity.version,
      engineVersion: "1.2.0",
      domain: "godscar-dark-tomb",
      estimatedCycles: source.identity.estimatedCycles,
    },
    attributes: ATTRIBUTES,
    roles: ROLES,
    tiers: TIERS,
    currencyName: "Quiet Tonnage",
    materialName: "Salvage",
    tokenName: "Wake",
    reputationName: "Standing",
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
        flavorText: "The hub establishes the life, pleasure, dependency, and local institution the descent must protect.",
        unlockConditions: { orgMilestones: [], reputationMinimum: null },
        challenges: delvesByTier("ordinary-life"),
        requiredChallenges: delvesByTier("ordinary-life"),
        optionalChallenges: [],
      },
      {
        id: "descent",
        name: "Descent",
        flavorText: "The party crosses inherited purpose, jurisdiction, and the systems that make absence plausible.",
        unlockConditions: { orgMilestones: delvesByTier("ordinary-life").slice(-1).map((id) => `${id}-cleared`), reputationMinimum: null },
        challenges: delvesByTier("descent"),
        requiredChallenges: delvesByTier("descent"),
        optionalChallenges: [],
      },
      {
        id: "breach",
        name: "Breach",
        flavorText: "A new classification becomes urgent before the threat, witness, rescuer, or neglected wake can be made certain.",
        unlockConditions: { orgMilestones: delvesByTier("descent").slice(-1).map((id) => `${id}-cleared`), reputationMinimum: null },
        challenges: delvesByTier("breach"),
        requiredChallenges: delvesByTier("breach"),
        optionalChallenges: [],
      },
      {
        id: "return",
        name: "Return",
        flavorText: "The hub inherits a changed route, population, dependency, visibility, or claim to control.",
        unlockConditions: { orgMilestones: delvesByTier("breach").slice(-1).map((id) => `${id}-cleared`), reputationMinimum: null },
        challenges: delvesByTier("return"),
        requiredChallenges: delvesByTier("return"),
        optionalChallenges: [],
      },
    ],
    attunementChains: [],
    challenges: source.delves.map(challengeFor),
    difficultyModes: [],
    items: [],
    narrativeEvents: [{
      trigger: { type: "arc_complete", target: finalDelve.id },
      title: "The tomb inherits the descent",
      text: `The immediate breach is resolved, but the previous map cannot be restored. ${source.controlQuestion}`,
      rewards: source.consequences.map((consequence) => consequence.label),
      agentUnlock: null,
    }],
    scaling: null,
    opening: {
      triggerType: "dark-tomb-pocket-opening",
      narrativeText: source.controlQuestion,
      options: [
        {
          id: "preserve-the-alarm",
          label: "Preserve the Alarm",
          description: "Protect the exterior classification while accepting the immediate deprivation and hidden cost.",
          effects: [{ scope: "all", type: "morale", value: 6 }],
        },
        {
          id: "authorize-the-breach",
          label: "Authorize a bounded breach",
          description: "Permit the descent or opening while accepting that recognition and wake cannot be recalled afterward.",
          effects: [{ scope: "all", type: "loyalty", value: 6 }],
        },
      ],
    },
    founding: {
      organization: { id: `${source.identity.id}-council`, name: `${source.identity.title} Council` },
      resources: { currency: foundingCurrency, materials: 40, tokens: 4 },
      facilities: FACILITIES,
      distributionPolicy: "council",
      roster: source.cast.map((member) => ({
        id: member.id,
        name: member.name,
        tierId: tierFor(member.responsibility),
        roleId: member.roleId,
        morale: member.responsibility === "depends-on-alarm" ? 68 : member.responsibility === "bears-cost-of-concealment" ? 52 : 62,
      })),
      relationships: [],
    },
    extensions: { [DARK_TOMB_EXTENSION_KEY]: source as unknown as JsonValue },
  };

  return validateArc(arc);
}

export function readDarkTombPocketExtension(arc: Arc): DarkTombPocketSource | null {
  const value = arc.extensions?.[DARK_TOMB_EXTENSION_KEY];
  if (value === undefined) return null;
  return parseDarkTombPocket(value);
}
