import { z } from "zod";
import type { Arc } from "./types";

const AttributeWeightSchema = z.object({
  attributeId: z.string(),
  weight: z.number().min(0).max(1),
});

const FailureConsequenceSchema = z.object({
  type: z.enum(["agent_damage", "team_damage", "stress", "debuff", "cascade"]),
  severity: z.number().min(0).max(1),
});

const ResourceSpendLeverSchema = z.object({
  maxTokens: z.number().int().min(1),
  steadinessPerToken: z.number().min(0).max(1),
  minSteadiness: z.number().gt(0).max(1),
});

const MechanicCheckSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  attributeWeights: z.array(AttributeWeightSchema).min(1),
  difficultyThreshold: z.number().int(),
  thresholdMode: z.enum(["fixed", "perAssignedAgent"]).optional(),
  scope: z.enum(["per_agent", "team_aggregate", "role_specific"]),
  roleIds: z.array(z.string()).optional(),
  failureConsequence: FailureConsequenceSchema,
  resourceSpend: ResourceSpendLeverSchema.optional(),
});

const RosterRequirementsSchema = z.object({
  minAgents: z.number().int().min(1),
  maxAgents: z.number().int().min(1),
  roleRequirements: z.array(z.object({ roleId: z.string(), count: z.number().int().min(1) })),
});

const AccessRequirementsSchema = z.object({
  orgMilestones: z.array(z.string()),
  agentAttunements: z.array(z.string()),
  attunementThreshold: z.number().min(0).max(1).nullable(),
});


const RewardTableEntrySchema = z.union([
  z.string(),
  z.object({
    itemId: z.string(),
    dropRate: z.number().min(0).max(1),
  }),
]);

const normalizeRewardTable = (entries: Array<string | { itemId: string; dropRate: number }>) =>
  entries.map((entry) =>
    typeof entry === "string"
      ? { itemId: entry, dropRate: 1.0 }
      : { itemId: entry.itemId, dropRate: entry.dropRate },
  );

const OutcomeSchema = z.object({
  rewardTable: z.array(RewardTableEntrySchema).transform(normalizeRewardTable),
  narrative: z.string(),
  reputationGain: z.number().int().optional(),
  currencyReward: z.number().int().min(0).optional(),
  milestoneFlag: z.string().optional(),
  agentDowntimeCycles: z.number().int().optional(),
  stressPenalty: z.number().int().optional(),
  tokenRefund: z.number().min(0).max(1).optional(),
});

const TimePressureSchema = z.object({
  rounds: z.number().int().min(1),
  aggregateThreshold: z.number().int(),
  attributeId: z.string(),
});

const ChallengeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  rosterRequirements: RosterRequirementsSchema,
  accessRequirements: AccessRequirementsSchema,
  difficultyRating: z.number().int().min(1).max(100),
  mechanicChecks: z
    .array(MechanicCheckSchema)
    .min(1)
    .superRefine((checks: z.infer<typeof MechanicCheckSchema>[], ctx: z.RefinementCtx) => {
      // placeholder: attribute ID validation happens in ArcSchema refinement
      for (const check of checks) {
        const total = check.attributeWeights.reduce((s: number, w: { weight: number }) => s + w.weight, 0);
        if (Math.abs(total - 1.0) > 0.001) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Mechanic check "${check.id}" attribute weights must sum to 1.0 (got ${total.toFixed(3)})`,
          });
        }
        if (check.thresholdMode !== undefined && check.scope !== "team_aggregate") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Mechanic check "${check.id}" sets thresholdMode but has scope "${check.scope}" — thresholdMode only applies to team_aggregate checks`,
          });
        }
      }
    }),
  completionCriteria: z.object({
    type: z.enum([
      "all_mechanics_passed",
      "threshold_passed",
      "dps_check",
      "survival_check",
      "composite",
    ]),
    parameters: z.record(z.unknown()),
  }),
  timePressure: TimePressureSchema.nullable(),
  outcomes: z.object({
    success: OutcomeSchema,
    partial: OutcomeSchema,
    failure: OutcomeSchema,
  }),
  resourceSpend: ResourceSpendLeverSchema.optional(),
});

const ArcAttributeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

const ArcRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  attributeWeights: z.record(z.number().min(0).max(1)),
});

const ArcTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  statBudgetMin: z.number().int().min(1),
  statBudgetMax: z.number().int().min(1),
  upkeepCost: z.number().int().min(0),
  baseEfficiencyModifier: z.number(),
});

const TraitEffectSchema: z.ZodType = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("infraEfficiencyMultiplier"), multiplier: z.number() }),
  z.object({
    kind: z.literal("moralePenaltyMultiplierOnRewardDisappointment"),
    multiplier: z.number(),
  }),
  z.object({ kind: z.literal("mentorshipTierGapBonus"), reducedGapRequired: z.number().int() }),
  z.object({ kind: z.literal("relationshipFormationMultiplier"), multiplier: z.number() }),
  z.object({ kind: z.literal("hostileStressImmunity") }),
  z.object({ kind: z.literal("recklessAfflictionChanceBonus"), bonus: z.number() }),
  z.object({
    kind: z.literal("attributeBonusWhenMoraleHigh"),
    attributeId: z.string(),
    threshold: z.number(),
    bonus: z.number(),
  }),
  z.object({ kind: z.literal("stressAccumulationMultiplier"), multiplier: z.number() }),
  z.object({ kind: z.literal("moraleGainMultiplier"), multiplier: z.number() }),
  z.object({ kind: z.literal("attributeCheckBonus"), attributeId: z.string(), bonus: z.number() }),
  z.object({ kind: z.literal("stressOnPartialSuccess"), amount: z.number() }),
  z.object({ kind: z.literal("relationshipAffinityMultiplier"), multiplier: z.number() }),
  z.object({ kind: z.literal("moraleSensitivityToTeamLoss"), multiplier: z.number() }),
  z.object({ kind: z.literal("ambitionSignal") }),
]);

const TraitSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  effects: z.array(TraitEffectSchema),
});

const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slot: z.string(),
  statBonuses: z.record(z.number()),
  tierRequirement: z.string(),
  flavorText: z.string(),
});

const AttunementStepSchema = z.object({
  type: z.enum(["challenge_clear", "reputation_threshold", "item_acquire", "chain_complete"]),
  target: z.string(),
});

const AttunementChainSchema = z.object({
  id: z.string(),
  name: z.string(),
  steps: z.array(AttunementStepSchema).min(1),
  grantsAccessTo: z.array(z.string()),
});

const ProgressionTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  flavorText: z.string(),
  unlockConditions: z.object({
    orgMilestones: z.array(z.string()),
    reputationMinimum: z.number().int().nullable(),
  }),
  challenges: z.array(z.string()),
  requiredChallenges: z.array(z.string()),
  optionalChallenges: z.array(z.string()),
});

const NarrativeEventSchema = z.object({
  trigger: z.object({
    type: z.enum([
      "first_clear",
      "tier_complete",
      "arc_complete",
      "agent_milestone",
      "reputation_threshold",
    ]),
    target: z.string(),
  }),
  title: z.string(),
  text: z.string(),
  rewards: z.array(z.string()),
  agentUnlock: z
    .object({ agentTemplate: z.record(z.unknown()) })
    .nullable(),
});

const DifficultyModeSchema = z.object({
  id: z.string(),
  name: z.string(),
  globalModifiers: z.object({
    difficultyMultiplier: z.number().positive(),
    rewardMultiplier: z.number().positive(),
    mechanicAdditions: z.array(MechanicCheckSchema),
  }),
});

const ArcScalingSchema = z.object({
  type: z.enum(["fixed", "scaled", "invocation"]),
  scalingRules: z.record(z.unknown()),
});

const ArcBaseSchema = z.object({
  meta: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    author: z.string(),
    version: z.string(),
    engineVersion: z.string(),
    domain: z.string(),
    estimatedCycles: z.number().int().positive(),
  }),
  attributes: z.array(ArcAttributeSchema).min(3).max(8),
  roles: z.array(ArcRoleSchema),
  tiers: z.array(ArcTierSchema).min(1),
  currencyName: z.string(),
  materialName: z.string(),
  tokenName: z.string(),
  reputationName: z.string(),
  tokensPerCycle: z.number().int().positive(),
  maxTokens: z.number().int().positive(),
  infrastructureTokenBonus: z.number().min(0).max(1),
  namePool: z.object({
    firstNames: z.array(z.string()).min(1),
    lastNames: z.array(z.string()),
  }),
  customTraits: z.array(TraitSchema),
  progressionTiers: z.array(ProgressionTierSchema),
  attunementChains: z.array(AttunementChainSchema),
  challenges: z.array(ChallengeSchema),
  difficultyModes: z.array(DifficultyModeSchema),
  items: z.array(ItemSchema),
  narrativeEvents: z.array(NarrativeEventSchema),
  scaling: ArcScalingSchema.nullable(),
});

type ArcBase = z.infer<typeof ArcBaseSchema>;

export const ArcSchema = ArcBaseSchema.superRefine((arc: ArcBase, ctx: z.RefinementCtx) => {
  const attrIds = new Set(arc.attributes.map((a: { id: string }) => a.id));

  for (const challenge of arc.challenges) {
    for (const check of challenge.mechanicChecks) {
      for (const aw of check.attributeWeights) {
        if (!attrIds.has(aw.attributeId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Challenge "${challenge.id}", mechanic "${check.id}": unknown attributeId "${aw.attributeId}". Valid: ${[...attrIds].join(", ")}`,
          });
        }
      }
    }
  }
});

export function validateArc(input: unknown): Arc {
  const result = ArcSchema.safeParse(input);
  if (!result.success) {
    const messages = result.error.errors
      .map((e: z.ZodIssue) => `[${e.path.join(".") || "root"}] ${e.message}`)
      .join("\n");
    throw new Error(`Invalid arc:\n${messages}`);
  }
  return result.data as Arc;
}
