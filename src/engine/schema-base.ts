import { z } from "zod";
import type { Arc } from "./types";
import { assertEngineCompatible, compareEngineVersions } from "./version.js";
import { compareCodepoints } from "./determinism.js";


const JsonPrimitiveSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), z.record(JsonValueSchema)]),
);
const ArcExtensionsSchema = z.record(
  z.string().regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*@\d+$/,
    'Extension keys must be lowercase namespaced identifiers ending in @<version>.'),
  JsonValueSchema,
);

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

const AuthoredOpeningEffectSchema = z.object({
  scope: z.literal("all"),
  type: z.enum(["morale", "stress", "loyalty"]),
  value: z.number().finite(),
});

const AuthoredOpeningOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  effects: z.array(AuthoredOpeningEffectSchema).min(1),
});

const AuthoredOpeningSchema = z.object({
  triggerType: z.string().min(1),
  narrativeText: z.string().min(1),
  options: z.array(AuthoredOpeningOptionSchema).min(2),
});

const InfrastructureFacilitySchema = z.enum([
  "Quarters",
  "Production",
  "Recreation",
  "Research",
  "Training",
  "Storage",
  "Medical",
]);

const FoundingRosterSlotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  tierId: z.string().min(1),
  roleId: z.string().min(1).optional(),
  morale: z.number().min(0).max(100).optional(),
  stress: z.number().min(0).max(10).optional(),
});

const FoundingLawSchema = z.object({
  organization: z.object({ id: z.string().min(1), name: z.string().min(1) }),
  resources: z.object({
    currency: z.number().int().min(0),
    materials: z.number().int().min(0),
    tokens: z.number().int().min(0),
  }),
  facilities: z.array(z.object({
    type: InfrastructureFacilitySchema,
    level: z.number().int().min(0),
  })).length(7),
  distributionPolicy: z.enum(["council", "points", "rotation"]),
  roster: z.array(FoundingRosterSlotSchema).min(1),
  relationships: z.array(z.object({
    rosterSlotIds: z.tuple([z.string().min(1), z.string().min(1)]),
    state: z.enum(["Neutral", "Allied", "Rivalrous", "Hostile", "Mentorship", "Bonded"]),
    affinity: z.number().min(-100).max(100),
  })),
});

const ArcBaseSchema = z.object({
  meta: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    author: z.string(),
    version: z.string(),
    engineVersion: z.string().regex(/^\d+(?:\.\d+){0,2}$/),
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
  opening: AuthoredOpeningSchema.optional(),
  founding: FoundingLawSchema.optional(),
  extensions: ArcExtensionsSchema.optional(),
});

type ArcBase = z.infer<typeof ArcBaseSchema>;

export const ArcSchema = ArcBaseSchema.superRefine((arc: ArcBase, ctx: z.RefinementCtx) => {
  const attrIds = new Set(arc.attributes.map((a: { id: string }) => a.id));
  const roleIds = new Set(arc.roles.map((r: { id: string }) => r.id));
  const tierIds = new Set(arc.tiers.map((tier: { id: string }) => tier.id));

  if (arc.opening) {
    const optionIds = new Set<string>();
    for (const [optionIndex, option] of arc.opening.options.entries()) {
      if (optionIds.has(option.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["opening", "options", optionIndex, "id"],
          message: `Authored opening has duplicate option id "${option.id}".`,
        });
      }
      optionIds.add(option.id);
    }
  }

  if ((arc.opening || arc.founding) && compareEngineVersions(arc.meta.engineVersion, "1.1.0") < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["meta", "engineVersion"],
      message: `Authored opening/founding law requires engineVersion 1.1.0 or newer.`,
    });
  }

  const hasAuthoredFounderNames = arc.founding?.roster.some((slot) => slot.name !== undefined) ?? false;
  if ((arc.extensions || hasAuthoredFounderNames) && compareEngineVersions(arc.meta.engineVersion, "1.2.0") < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["meta", "engineVersion"],
      message: `Arc extensions and authored founder names require engineVersion 1.2.0 or newer.`,
    });
  }

  if (arc.founding) {
    const slotIds = new Set<string>();
    for (const [slotIndex, slot] of arc.founding.roster.entries()) {
      if (slotIds.has(slot.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["founding", "roster", slotIndex, "id"],
          message: `Founding roster has duplicate slot id "${slot.id}".`,
        });
      }
      slotIds.add(slot.id);
      if (!tierIds.has(slot.tierId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["founding", "roster", slotIndex, "tierId"],
          message: `Founding roster slot "${slot.id}" references unknown tierId "${slot.tierId}".`,
        });
      }
      if (slot.roleId !== undefined && !roleIds.has(slot.roleId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["founding", "roster", slotIndex, "roleId"],
          message: `Founding roster slot "${slot.id}" references unknown roleId "${slot.roleId}".`,
        });
      }
    }

    const facilityTypes = new Set<string>();
    for (const [facilityIndex, facility] of arc.founding.facilities.entries()) {
      if (facilityTypes.has(facility.type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["founding", "facilities", facilityIndex, "type"],
          message: `Founding law has duplicate facility "${facility.type}".`,
        });
      }
      facilityTypes.add(facility.type);
    }

    if (arc.founding.resources.tokens > arc.maxTokens) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["founding", "resources", "tokens"],
        message: `Founding tokens (${arc.founding.resources.tokens}) exceed maxTokens (${arc.maxTokens}).`,
      });
    }

    const relationshipPairs = new Set<string>();
    for (const [relationshipIndex, relationship] of arc.founding.relationships.entries()) {
      const [left, right] = relationship.rosterSlotIds;
      if (left === right) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["founding", "relationships", relationshipIndex, "rosterSlotIds"],
          message: `Founding relationship must reference two different roster slots.`,
        });
      }
      for (const slotId of relationship.rosterSlotIds) {
        if (!slotIds.has(slotId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["founding", "relationships", relationshipIndex, "rosterSlotIds"],
            message: `Founding relationship references unknown roster slot "${slotId}".`,
          });
        }
      }
      const pair = JSON.stringify(
        compareCodepoints(left, right) <= 0 ? [left, right] : [right, left],
      );
      if (relationshipPairs.has(pair)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["founding", "relationships", relationshipIndex, "rosterSlotIds"],
          message: `Founding law has duplicate relationship between "${left}" and "${right}".`,
        });
      }
      relationshipPairs.add(pair);
    }
  }

  for (const [challengeIndex, challenge] of arc.challenges.entries()) {
    for (const [checkIndex, check] of challenge.mechanicChecks.entries()) {
      for (const aw of check.attributeWeights) {
        if (!attrIds.has(aw.attributeId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Challenge "${challenge.id}", mechanic "${check.id}": unknown attributeId "${aw.attributeId}". Valid: ${[...attrIds].join(", ")}`,
          });
        }
      }

      // Explicit role scopes must reference authored roles. Omitted and empty
      // roleIds intentionally remain the v1 compatibility form: resolver,
      // projections, and diagnostics fall back to this challenge's required
      // roles. Do not materialize that fallback here; doing so would rewrite
      // valid cartridge identity and save/ledger digests.
      if (check.scope === "role_specific" && check.roleIds?.length) {
        for (const [roleIndex, roleId] of check.roleIds.entries()) {
          if (!roleIds.has(roleId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [
                "challenges",
                challengeIndex,
                "mechanicChecks",
                checkIndex,
                "roleIds",
                roleIndex,
              ],
              message: `Challenge "${challenge.id}", mechanic "${check.id}": roleIds references unknown roleId "${roleId}". Valid: ${[...roleIds].join(", ")}`,
            });
          }
        }
      }
    }

    // Roster requirements must describe a composition some legal party can
    // actually field. The field schema only guarantees positive integers; these
    // cross-checks reject a challenge that is impossible by construction — a
    // roster no client could ever seat — so it fails loudly at validation
    // rather than being discovered at boot (a runtime that can't prove a
    // cartridge is fieldable must not claim it is). (roster-requirement validation)
    const rr = challenge.rosterRequirements;
    if (rr.minAgents > rr.maxAgents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Challenge "${challenge.id}": rosterRequirements.minAgents (${rr.minAgents}) exceeds maxAgents (${rr.maxAgents}).`,
      });
    }
    const seenRoles = new Set<string>();
    let demanded = 0;
    for (const req of rr.roleRequirements) {
      demanded += req.count;
      if (!roleIds.has(req.roleId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Challenge "${challenge.id}": rosterRequirements references unknown roleId "${req.roleId}". Valid: ${[...roleIds].join(", ")}`,
        });
      }
      if (seenRoles.has(req.roleId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Challenge "${challenge.id}": duplicate rosterRequirements entry for roleId "${req.roleId}".`,
        });
      }
      seenRoles.add(req.roleId);
    }
    if (demanded > rr.maxAgents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Challenge "${challenge.id}": rosterRequirements demand ${demanded} agents across roles but maxAgents is ${rr.maxAgents}.`,
      });
    }
  }
});

export function validateArc(input: unknown): Arc {
  const requiredEngine = input && typeof input === "object"
    && "meta" in input && input.meta && typeof input.meta === "object"
    && "engineVersion" in input.meta && typeof input.meta.engineVersion === "string"
    ? input.meta.engineVersion
    : null;
  if (requiredEngine !== null) assertEngineCompatible(requiredEngine);
  const result = ArcSchema.safeParse(input);
  if (!result.success) {
    const messages = result.error.errors
      .map((e: z.ZodIssue) => `[${e.path.join(".") || "root"}] ${e.message}`)
      .join("\n");
    throw new Error(`Invalid arc:\n${messages}`);
  }
  return result.data as Arc;
}
