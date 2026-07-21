import type { Arc, ArcAttribute, ArcRole, ArcTier, Challenge, FoundingFacility, JsonValue, MechanicCheck } from "../engine/types.js";
import { validateArc } from "../engine/schema.js";
import { parseGodscarPocket } from "./schema.js";
import { GODSCAR_EXTENSION_KEY, type GodscarBeatBlueprint, type GodscarPocketSource } from "./types.js";

const ATTRIBUTES: ArcAttribute[] = [
  { id: "care", name: "Care", description: "Keep concrete lives visible while institutions argue over worlds." },
  { id: "evidence", name: "Evidence", description: "Recover, test, preserve, and communicate contested knowledge." },
  { id: "exteriority", name: "Exteriority", description: "Recognize and defend actors a governing model cannot own." },
  { id: "systems", name: "Systems", description: "Understand infrastructure, dependencies, routes, and institutional power." },
  { id: "resolve", name: "Resolve", description: "Act before uncertainty can be made comfortable or complete." },
];

const ROLES: ArcRole[] = [
  { id: "auditor", name: "Auditor", attributeWeights: { care: 0.1, evidence: 0.45, exteriority: 0.1, systems: 0.25, resolve: 0.1 } },
  { id: "interlocutor", name: "Interlocutor", attributeWeights: { care: 0.35, evidence: 0.1, exteriority: 0.35, systems: 0.1, resolve: 0.1 } },
  { id: "witness", name: "Witness", attributeWeights: { care: 0.15, evidence: 0.5, exteriority: 0.15, systems: 0.1, resolve: 0.1 } },
  { id: "protector", name: "Protector", attributeWeights: { care: 0.25, evidence: 0.05, exteriority: 0.15, systems: 0.15, resolve: 0.4 } },
  { id: "exception", name: "Sovereign Exception", attributeWeights: { care: 0.15, evidence: 0.15, exteriority: 0.25, systems: 0.1, resolve: 0.35 } },
];

const TIERS: ArcTier[] = [
  { id: "local", name: "Local Actor", statBudgetMin: 34, statBudgetMax: 42, upkeepCost: 1, baseEfficiencyModifier: 1.15 },
  { id: "pocket", name: "Pocket Actor", statBudgetMin: 40, statBudgetMax: 48, upkeepCost: 2, baseEfficiencyModifier: 1.05 },
  { id: "sovereign", name: "Sovereign Exception", statBudgetMin: 46, statBudgetMax: 54, upkeepCost: 3, baseEfficiencyModifier: 0.95 },
];

const FACILITIES: FoundingFacility[] = [
  { type: "Quarters", level: 1 },
  { type: "Production", level: 0 },
  { type: "Recreation", level: 1 },
  { type: "Research", level: 1 },
  { type: "Training", level: 1 },
  { type: "Storage", level: 0 },
  { type: "Medical", level: 1 },
];

function mechanicFor(check: GodscarBeatBlueprint["checks"][number]): MechanicCheck {
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

function challengeFor(beat: GodscarBeatBlueprint): Challenge {
  return {
    id: beat.id,
    name: beat.name,
    description: beat.description,
    rosterRequirements: {
      minAgents: beat.minAgents,
      maxAgents: beat.maxAgents,
      roleRequirements: beat.requiredRoles ?? [],
    },
    accessRequirements: {
      orgMilestones: beat.accessAfter ? [`${beat.accessAfter}-cleared`] : [],
      agentAttunements: [],
      attunementThreshold: null,
    },
    difficultyRating: beat.difficulty,
    mechanicChecks: beat.checks.map(mechanicFor),
    completionCriteria: { type: "all_mechanics_passed", parameters: {} },
    timePressure: null,
    resourceSpend: { maxTokens: 1, steadinessPerToken: 0.25, minSteadiness: 0.7 },
    outcomes: {
      success: {
        rewardTable: [], narrative: beat.success,
        reputationGain: beat.reputationGain, currencyReward: beat.currencyReward,
        milestoneFlag: `${beat.id}-cleared`,
      },
      partial: { rewardTable: [], narrative: beat.partial, reputationGain: Math.max(0, beat.reputationGain - 1), agentDowntimeCycles: 1 },
      failure: { rewardTable: [], narrative: beat.failure, stressPenalty: 2, tokenRefund: 0.5 },
    },
  };
}

export function compileGodscarPocket(input: unknown): Arc {
  const source = parseGodscarPocket(input);
  const castById = new Map(source.cast.map((member) => [member.id, member]));
  const beatsByTier = (tier: GodscarBeatBlueprint["tierId"]) => source.beats.filter((beat) => beat.tierId === tier).map((beat) => beat.id);
  const finalBeat = source.beats[source.beats.length - 1]!;
  const arc: Arc = {
    meta: {
      id: source.identity.id,
      name: source.identity.title,
      description: source.identity.description,
      author: source.identity.author,
      version: source.identity.version,
      engineVersion: "1.2.0",
      domain: "godscar-pocket",
      estimatedCycles: source.identity.estimatedCycles,
    },
    attributes: ATTRIBUTES,
    roles: ROLES,
    tiers: TIERS,
    currencyName: "Leverage",
    materialName: "Evidence",
    tokenName: "Mandates",
    reputationName: "Legitimacy",
    tokensPerCycle: 2,
    maxTokens: 6,
    infrastructureTokenBonus: 0.1,
    namePool: {
      firstNames: source.cast.map((member) => member.name.split(/\s+/)[0]!).filter(Boolean),
      lastNames: source.cast.map((member) => member.name.split(/\s+/).slice(1).join(" ")).filter(Boolean),
    },
    customTraits: [],
    progressionTiers: [
      { id: "arrival", name: "Arrival", flavorText: "The pocket experiences the controlling system as a concrete public good.", unlockConditions: { orgMilestones: [], reputationMinimum: null }, challenges: beatsByTier("arrival"), requiredChallenges: beatsByTier("arrival"), optionalChallenges: [] },
      { id: "disclosure", name: "Disclosure", flavorText: "Evidence changes what the rescue, cure, or governing order means.", unlockConditions: { orgMilestones: beatsByTier("arrival").slice(-1).map((id) => `${id}-cleared`), reputationMinimum: null }, challenges: beatsByTier("disclosure"), requiredChallenges: beatsByTier("disclosure"), optionalChallenges: [] },
      { id: "refusal", name: "Refusal", flavorText: "The pocket acts before uncertainty can be made complete.", unlockConditions: { orgMilestones: beatsByTier("disclosure").slice(-1).map((id) => `${id}-cleared`), reputationMinimum: null }, challenges: beatsByTier("refusal"), requiredChallenges: beatsByTier("refusal"), optionalChallenges: [] },
    ],
    attunementChains: [],
    challenges: source.beats.map(challengeFor),
    difficultyModes: [],
    items: [],
    narrativeEvents: [{
      trigger: { type: "arc_complete", target: finalBeat.id },
      title: "The pocket remains open",
      text: `The immediate decision is recorded. ${source.controlQuestion} The answer now belongs to whoever inherits the changed map.`,
      rewards: source.consequences.map((consequence) => consequence.label),
      agentUnlock: null,
    }],
    scaling: null,
    opening: {
      triggerType: "godscar-pocket-opening",
      narrativeText: source.controlQuestion,
      options: [
        { id: "accept-the-gift", label: "Accept the indispensable gift", description: "Preserve the concrete lives already dependent on the controlling system while entering its ledger.", effects: [{ scope: "all", type: "morale", value: 6 }] },
        { id: "preserve-refusal", label: "Preserve the right to refuse", description: "Keep the pocket outside closure, accepting the immediate uncertainty and cost.", effects: [{ scope: "all", type: "loyalty", value: 6 }] },
      ],
    },
    founding: {
      organization: { id: `${source.identity.id}-coalition`, name: `${source.identity.title} Coalition` },
      resources: { currency: 120, materials: 30, tokens: 3 },
      facilities: FACILITIES,
      distributionPolicy: "council",
      roster: source.cast.map((member) => ({
        id: member.id,
        name: castById.get(member.id)!.name,
        tierId: member.responsibility === "sovereign-exception" ? "sovereign" : member.responsibility === "holds-evidence" ? "pocket" : "local",
        roleId: member.roleId,
        morale: member.responsibility === "depends-on-system" ? 68 : 62,
      })),
      relationships: [],
    },
    extensions: { [GODSCAR_EXTENSION_KEY]: source as unknown as JsonValue },
  };
  return validateArc(arc);
}

export function readGodscarPocketExtension(arc: Arc): GodscarPocketSource | null {
  const value = arc.extensions?.[GODSCAR_EXTENSION_KEY];
  if (value === undefined) return null;
  return parseGodscarPocket(value);
}
