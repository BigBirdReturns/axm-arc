import { z } from "zod";
import { COMMON_SHIP_POCKET_FORMAT, type CommonShipPocketSource } from "./types.js";

const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase kebab-case id.");
const NonEmpty = z.string().trim().min(1);
const CanonTier = z.enum(["settled-canon", "contested-canon", "faction-doctrine", "story-facing-unknown"]);
const CanonRelation = z.enum(["foundational", "compatible", "contested", "alternate-sequence", "crossover", "private-branch"]);
const RoleId = z.enum(["response", "mediation", "analysis", "maintenance", "care", "continuity"]);
const AttributeId = z.enum(["care", "systems", "translation", "continuity", "judgment", "resolve"]);
const SystemKind = z.enum([
  "transit-body",
  "habitat-bands",
  "common-thresholds",
  "translation-mesh",
  "watch-lattice",
  "continuity-commons",
  "sovereign-core",
]);
const TemporalKind = z.enum([
  "external-interval",
  "subjective-resolution",
  "developmental-tempo",
  "recovery-cycle",
  "continuity-span",
  "life-fraction-cost",
]);
const TranslationKind = z.enum([
  "meaning",
  "tempo",
  "sensorium",
  "interface",
  "environment",
  "authority",
  "memory-and-handoff",
]);
const WatchTestKind = z.enum([
  "role-coverage",
  "temporal-overlap",
  "habitat-compatibility",
  "translation-resilience",
  "handoff-continuity",
  "life-fraction-fairness",
]);
const ShipStateKind = z.enum([
  "habitat-integrity",
  "temporal-coherence",
  "translation-trust",
  "roster-resilience",
  "stores-and-care",
  "continuity",
  "visibility",
  "compatibility-debt",
]);

const Pressure = z.object({
  kind: z.enum([
    "vessel-form",
    "mission",
    "host-baseline",
    "temporal-conflict",
    "ordinary-good",
    "excluded-actor",
    "approaching-trigger",
    "cost-of-adaptation",
    "scale-revelation",
  ]),
  id: Slug,
  label: NonEmpty,
  description: NonEmpty,
}).strict();

const System = z.object({
  kind: SystemKind,
  label: NonEmpty,
  description: NonEmpty,
  currentUse: NonEmpty,
  hostAssumption: NonEmpty,
  revisionAuthority: NonEmpty,
}).strict();

const TemporalDimension = z.object({
  kind: TemporalKind,
  description: NonEmpty,
  operationalUse: NonEmpty,
  captureRisk: NonEmpty,
}).strict();

const TranslationLayer = z.object({
  kind: TranslationKind,
  description: NonEmpty,
  intermediary: NonEmpty,
  failureMode: NonEmpty,
  refusalPath: NonEmpty,
}).strict();

const WatchTest = z.object({
  kind: WatchTestKind,
  description: NonEmpty,
  passCondition: NonEmpty,
  failureConsequence: NonEmpty,
}).strict();

const ShipStateTrack = z.object({
  kind: ShipStateKind,
  value: z.number().int().min(0).max(4),
  description: NonEmpty,
  crisisCondition: NonEmpty,
}).strict();

const JsonPrimitive: z.ZodType<unknown> = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const JsonValue: z.ZodType<unknown> = z.lazy(() => z.union([JsonPrimitive, z.array(JsonValue), z.record(JsonValue)]));

const CommonShipPocketSchemaBase = z.object({
  format: z.literal(COMMON_SHIP_POCKET_FORMAT),
  identity: z.object({
    id: Slug,
    title: NonEmpty,
    description: NonEmpty,
    author: NonEmpty,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    estimatedCycles: z.number().int().positive().max(1000),
    parentCanons: z.array(NonEmpty).min(1),
    canonRelation: CanonRelation,
  }).strict(),
  controlQuestion: NonEmpty,
  pressures: z.tuple([Pressure, Pressure, Pressure, Pressure, Pressure, Pressure, Pressure, Pressure, Pressure]),
  evidence: z.object({
    tier: CanonTier,
    claim: NonEmpty,
    venue: NonEmpty,
    legitimacyTarget: NonEmpty,
    upsideIfAccepted: NonEmpty,
    downsideIfAccepted: NonEmpty,
    failureIfFalse: NonEmpty,
    receipts: z.array(z.object({
      id: Slug,
      label: NonEmpty,
      source: NonEmpty,
      intervention: NonEmpty,
      limits: NonEmpty,
    }).strict()).min(1),
  }).strict(),
  factionReceipts: z.array(z.object({
    factionId: Slug,
    factionName: NonEmpty,
    variableControlled: NonEmpty,
    publicGood: NonEmpty,
    characteristicFailure: NonEmpty,
  }).strict()).min(2),
  cast: z.array(z.object({
    id: Slug,
    name: NonEmpty,
    roleId: RoleId,
    responsibility: z.enum([
      "depends-on-host-baseline",
      "bears-adaptation-tax",
      "understands-maintenance-reality",
      "translates-excluded-actor",
      "benefits-from-delay",
      "sovereign-exception",
    ]),
    description: NonEmpty,
    factionId: Slug.optional(),
  }).strict()).min(6),
  anatomy: z.tuple([System, System, System, System, System, System, System]),
  temporalProfile: z.tuple([
    TemporalDimension,
    TemporalDimension,
    TemporalDimension,
    TemporalDimension,
    TemporalDimension,
    TemporalDimension,
  ]),
  translationStack: z.tuple([
    TranslationLayer,
    TranslationLayer,
    TranslationLayer,
    TranslationLayer,
    TranslationLayer,
    TranslationLayer,
    TranslationLayer,
  ]),
  watchTests: z.tuple([WatchTest, WatchTest, WatchTest, WatchTest, WatchTest, WatchTest]),
  shipState: z.tuple([
    ShipStateTrack,
    ShipStateTrack,
    ShipStateTrack,
    ShipStateTrack,
    ShipStateTrack,
    ShipStateTrack,
    ShipStateTrack,
    ShipStateTrack,
  ]),
  consequences: z.array(z.object({
    id: Slug,
    label: NonEmpty,
    kind: z.enum([
      "citizen",
      "dependency",
      "route",
      "archive",
      "doctrine",
      "adaptive-capacity",
      "trauma",
      "habitat",
      "schedule",
      "interface",
      "readiness-debt",
      "recovery-debt",
      "compatibility-debt",
      "continuity",
      "visibility",
      "jurisdiction",
    ]),
    description: NonEmpty,
    inheritedBy: NonEmpty,
  }).strict()).min(1),
  storyPhysics: z.object({
    noNeutralEnvironment: z.literal(true),
    clockIsNotExperience: z.literal(true),
    translationHasAuthorship: z.literal(true),
    rosterIsEcology: z.literal(true),
    everyAccommodationCreatesDependency: z.literal(true),
    emergencyRevealsNativeUser: z.literal(true),
    handoffsArePoliticalEvents: z.literal(true),
    travelSpendsUnequalLife: z.literal(true),
    vesselMayBePerson: z.literal(true),
    everyMissionRevisesConstitution: z.literal(true),
  }).strict(),
  watches: z.array(z.object({
    id: Slug,
    name: NonEmpty,
    description: NonEmpty,
    tierId: z.enum(["ordinary-life", "compose-watch", "resolve-pressure", "handoff"]),
    system: SystemKind,
    accessAfter: Slug.optional(),
    horizon: z.object({
      closesWhen: NonEmpty,
      physicalUrgency: NonEmpty,
      informationalUrgency: NonEmpty,
      institutionalUrgency: NonEmpty,
      manufacturedUrgency: NonEmpty,
    }).strict(),
    profiles: z.object({
      requiredBodies: z.array(NonEmpty).min(1),
      requiredHabitats: z.array(NonEmpty).min(1),
      requiredClocks: z.array(NonEmpty).min(1),
      requiredTranslators: z.array(NonEmpty).min(1),
      requiredReserves: z.array(NonEmpty).min(1),
      lifeFractionCosts: z.array(NonEmpty).min(1),
    }).strict(),
    composition: z.object({
      absentActor: NonEmpty,
      excludedBody: NonEmpty,
      dependency: NonEmpty,
    }).strict(),
    allocation: z.object({
      habitatBands: NonEmpty,
      translationPaths: NonEmpty,
      directInterfaces: NonEmpty,
      standby: NonEmpty,
      stores: NonEmpty,
      emergencyAuthority: NonEmpty,
    }).strict(),
    handoff: z.object({
      dissent: NonEmpty,
      injury: NonEmpty,
      readinessDebt: NonEmpty,
      promises: NonEmpty,
      missingPersons: NonEmpty,
      uncertainty: NonEmpty,
    }).strict(),
    precedent: z.object({
      newlyPossible: NonEmpty,
      newlyImpossible: NonEmpty,
      newlyGovernable: NonEmpty,
      inheritedAsInfrastructure: NonEmpty,
    }).strict(),
    difficulty: z.number().int().min(1).max(100),
    minAgents: z.number().int().min(1),
    maxAgents: z.number().int().min(1),
    requiredRoles: z.array(z.object({ roleId: RoleId, count: z.number().int().positive() }).strict()).optional(),
    checks: z.array(z.object({
      id: Slug,
      name: NonEmpty,
      description: NonEmpty,
      scope: z.enum(["team", "role", "per-agent"]),
      roleIds: z.array(RoleId).optional(),
      weights: z.record(AttributeId, z.number().min(0).max(1)),
      threshold: z.number().int(),
      failureType: z.enum(["agent_damage", "team_damage", "stress", "debuff", "cascade"]).optional(),
      severity: z.number().min(0).max(1).optional(),
    }).strict()).min(1),
    success: NonEmpty,
    partial: NonEmpty,
    failure: NonEmpty,
    reputationGain: z.number().int().min(0),
    currencyReward: z.number().int().min(0),
    consequenceId: Slug,
    shipStateEffects: z.array(z.object({
      track: ShipStateKind,
      delta: z.number().int().min(-4).max(4).refine((value) => value !== 0, "Ship-state effects must change the track."),
      reason: NonEmpty,
    }).strict()).min(1),
  }).strict()).min(4),
  notes: JsonValue.optional(),
}).strict();

export const CommonShipPocketSchema = CommonShipPocketSchemaBase.superRefine((source, ctx) => {
  const expectedPressureKinds = [
    "vessel-form",
    "mission",
    "host-baseline",
    "temporal-conflict",
    "ordinary-good",
    "excluded-actor",
    "approaching-trigger",
    "cost-of-adaptation",
    "scale-revelation",
  ] as const;
  source.pressures.forEach((pressure, index) => {
    if (pressure.kind !== expectedPressureKinds[index]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pressures", index, "kind"], message: `Pressure ${index + 1} must be ${expectedPressureKinds[index]}.` });
    }
  });

  const expectedSystems = [
    "transit-body",
    "habitat-bands",
    "common-thresholds",
    "translation-mesh",
    "watch-lattice",
    "continuity-commons",
    "sovereign-core",
  ] as const;
  source.anatomy.forEach((system, index) => {
    if (system.kind !== expectedSystems[index]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["anatomy", index, "kind"], message: `System ${index + 1} must be ${expectedSystems[index]}.` });
    }
  });

  const expectedTemporal = [
    "external-interval",
    "subjective-resolution",
    "developmental-tempo",
    "recovery-cycle",
    "continuity-span",
    "life-fraction-cost",
  ] as const;
  source.temporalProfile.forEach((dimension, index) => {
    if (dimension.kind !== expectedTemporal[index]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["temporalProfile", index, "kind"], message: `Temporal dimension ${index + 1} must be ${expectedTemporal[index]}.` });
    }
  });

  const expectedTranslation = ["meaning", "tempo", "sensorium", "interface", "environment", "authority", "memory-and-handoff"] as const;
  source.translationStack.forEach((layer, index) => {
    if (layer.kind !== expectedTranslation[index]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["translationStack", index, "kind"], message: `Translation layer ${index + 1} must be ${expectedTranslation[index]}.` });
    }
  });

  const expectedWatchTests = [
    "role-coverage",
    "temporal-overlap",
    "habitat-compatibility",
    "translation-resilience",
    "handoff-continuity",
    "life-fraction-fairness",
  ] as const;
  source.watchTests.forEach((test, index) => {
    if (test.kind !== expectedWatchTests[index]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["watchTests", index, "kind"], message: `Watch test ${index + 1} must be ${expectedWatchTests[index]}.` });
    }
  });

  const expectedShipState = [
    "habitat-integrity",
    "temporal-coherence",
    "translation-trust",
    "roster-resilience",
    "stores-and-care",
    "continuity",
    "visibility",
    "compatibility-debt",
  ] as const;
  source.shipState.forEach((track, index) => {
    if (track.kind !== expectedShipState[index]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["shipState", index, "kind"], message: `Ship-state track ${index + 1} must be ${expectedShipState[index]}.` });
    }
  });

  const unique = (values: string[], path: (string | number)[], label: string) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, index], message: `Duplicate ${label} "${value}".` });
      seen.add(value);
    });
  };

  unique(source.pressures.map((value) => value.id), ["pressures"], "pressure id");
  unique(source.cast.map((value) => value.id), ["cast"], "cast id");
  unique(source.watches.map((value) => value.id), ["watches"], "watch id");
  unique(source.consequences.map((value) => value.id), ["consequences"], "consequence id");
  unique(source.evidence.receipts.map((value) => value.id), ["evidence", "receipts"], "receipt id");
  unique(source.factionReceipts.map((value) => value.factionId), ["factionReceipts"], "faction id");

  const responsibilities = new Set(source.cast.map((member) => member.responsibility));
  for (const required of [
    "depends-on-host-baseline",
    "bears-adaptation-tax",
    "understands-maintenance-reality",
    "translates-excluded-actor",
    "benefits-from-delay",
    "sovereign-exception",
  ] as const) {
    if (!responsibilities.has(required)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cast"], message: `Cast must include responsibility ${required}.` });
    }
  }

  const factionIds = new Set(source.factionReceipts.map((faction) => faction.factionId));
  source.cast.forEach((member, memberIndex) => {
    if (member.factionId && !factionIds.has(member.factionId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cast", memberIndex, "factionId"], message: `Unknown faction ${member.factionId}.` });
    }
  });

  const watchIds = new Set(source.watches.map((watch) => watch.id));
  const consequenceIds = new Set(source.consequences.map((consequence) => consequence.id));
  const systemIds = new Set(source.anatomy.map((system) => system.kind));
  const trackIds = new Set(source.shipState.map((track) => track.kind));
  const tiers = new Set(source.watches.map((watch) => watch.tierId));
  for (const requiredTier of ["ordinary-life", "compose-watch", "resolve-pressure", "handoff"] as const) {
    if (!tiers.has(requiredTier)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["watches"], message: `Watches must include tier ${requiredTier}.` });
    }
  }

  source.watches.forEach((watch, watchIndex) => {
    if (watch.minAgents > watch.maxAgents) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["watches", watchIndex], message: "minAgents cannot exceed maxAgents." });
    }
    if (watch.accessAfter && !watchIds.has(watch.accessAfter)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["watches", watchIndex, "accessAfter"], message: `Unknown prior watch ${watch.accessAfter}.` });
    }
    if (watch.accessAfter === watch.id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["watches", watchIndex, "accessAfter"], message: "A watch cannot unlock itself." });
    }
    if (!consequenceIds.has(watch.consequenceId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["watches", watchIndex, "consequenceId"], message: `Unknown consequence ${watch.consequenceId}.` });
    }
    if (!systemIds.has(watch.system)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["watches", watchIndex, "system"], message: `Unknown ship system ${watch.system}.` });
    }
    const requiredCount = (watch.requiredRoles ?? []).reduce((sum, requirement) => sum + requirement.count, 0);
    if (requiredCount > watch.maxAgents) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["watches", watchIndex, "requiredRoles"], message: "Required role count cannot exceed maxAgents." });
    }
    watch.shipStateEffects.forEach((effect, effectIndex) => {
      if (!trackIds.has(effect.track)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["watches", watchIndex, "shipStateEffects", effectIndex, "track"], message: `Unknown ship-state track ${effect.track}.` });
      }
    });
    watch.checks.forEach((check, checkIndex) => {
      const total = Object.values(check.weights).reduce((sum, value) => sum + value, 0);
      if (Math.abs(total - 1) > 0.001) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["watches", watchIndex, "checks", checkIndex, "weights"], message: `Weights must sum to 1.0 (got ${total.toFixed(3)}).` });
      }
      if (check.scope === "role" && (!check.roleIds || check.roleIds.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["watches", watchIndex, "checks", checkIndex, "roleIds"], message: "Role checks require roleIds." });
      }
    });
  });
});

export type CommonShipValidation =
  | { ok: true; source: CommonShipPocketSource }
  | { ok: false; errors: string[] };

export function validateCommonShipPocket(input: unknown): CommonShipValidation {
  const result = CommonShipPocketSchema.safeParse(input);
  if (result.success) return { ok: true, source: result.data as CommonShipPocketSource };
  return { ok: false, errors: result.error.issues.map((issue) => `[${issue.path.join(".") || "root"}] ${issue.message}`) };
}

export function parseCommonShipPocket(input: unknown): CommonShipPocketSource {
  const result = validateCommonShipPocket(input);
  if (!result.ok) throw new Error(`Invalid Common Ship pocket:\n${result.errors.join("\n")}`);
  return result.source;
}
