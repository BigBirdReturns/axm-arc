import { z } from "zod";
import { DARK_TOMB_POCKET_FORMAT, type DarkTombPocketSource } from "./types.js";

const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase kebab-case id.");
const NonEmpty = z.string().trim().min(1);
const CanonTier = z.enum(["settled-canon", "contested-canon", "faction-doctrine", "story-facing-unknown"]);
const CanonRelation = z.enum(["foundational", "compatible", "contested", "alternate-sequence", "crossover", "private-branch"]);
const RoleId = z.enum(["wakekeeper", "surface-bearer", "maintainer", "interlocutor", "witness", "deliberator", "exception"]);
const AttributeId = z.enum(["care", "evidence", "systems", "jurisdiction", "opacity", "resolve"]);
const LayerKind = z.enum(["grave-skin", "shroud", "quiet-works", "common-depths", "custodial-ring", "war-layer", "black-core"]);
const DepthKind = z.enum(["material", "signal", "administrative", "historical", "interpretive"]);
const AlarmPhase = z.enum(["shadow", "hush", "fold", "black", "cut", "wake"]);

const Pressure = z.object({
  kind: z.enum([
    "tomb-form",
    "exterior-lie",
    "custodian",
    "ordinary-good",
    "excluded-actor",
    "approaching-breach",
    "cost-of-opening-or-closing",
    "scale-revelation",
  ]),
  id: Slug,
  label: NonEmpty,
  description: NonEmpty,
}).strict();

const Layer = z.object({
  kind: LayerKind,
  label: NonEmpty,
  description: NonEmpty,
  currentUse: NonEmpty,
  inheritedPurpose: NonEmpty,
  officialClassification: NonEmpty,
}).strict();

const Depth = z.object({
  kind: DepthKind,
  description: NonEmpty,
  barrier: NonEmpty,
  beneficiary: NonEmpty,
}).strict();

const AlarmPhaseRecord = z.object({
  phase: AlarmPhase,
  description: NonEmpty,
  protection: NonEmpty,
  internalCost: NonEmpty,
}).strict();

const JsonPrimitive: z.ZodType<unknown> = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const JsonValue: z.ZodType<unknown> = z.lazy(() => z.union([JsonPrimitive, z.array(JsonValue), z.record(JsonValue)]));

const DarkTombPocketSchemaBase = z.object({
  format: z.literal(DARK_TOMB_POCKET_FORMAT),
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
  pressures: z.tuple([Pressure, Pressure, Pressure, Pressure, Pressure, Pressure, Pressure, Pressure]),
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
      "depends-on-alarm",
      "bears-cost-of-concealment",
      "understands-quiet-works",
      "translates-excluded-actor",
      "holds-map-changing-evidence",
      "benefits-from-delay",
      "sovereign-exception",
    ]),
    description: NonEmpty,
    factionId: Slug.optional(),
  }).strict()).min(7),
  anatomy: z.tuple([Layer, Layer, Layer, Layer, Layer, Layer, Layer]),
  depths: z.tuple([Depth, Depth, Depth, Depth, Depth]),
  signatureBudget: z.object({
    observer: NonEmpty,
    exteriorClassification: NonEmpty,
    wakeSources: z.array(NonEmpty).min(1),
    operations: z.array(z.object({
      kind: z.enum(["sink", "spread", "shift", "mask", "counterfeit", "sacrifice"]),
      description: NonEmpty,
      cost: NonEmpty,
    }).strict()).min(1).max(6),
    allocations: z.array(z.object({
      id: Slug,
      label: NonEmpty,
      claimant: NonEmpty,
      ordinaryGood: NonEmpty,
      wake: NonEmpty,
      denialCost: NonEmpty,
    }).strict()).min(1),
  }).strict(),
  alarm: z.object({
    originalThreat: NonEmpty,
    auditProblem: NonEmpty,
    currentPhase: AlarmPhase,
    phases: z.tuple([
      AlarmPhaseRecord,
      AlarmPhaseRecord,
      AlarmPhaseRecord,
      AlarmPhaseRecord,
      AlarmPhaseRecord,
      AlarmPhaseRecord,
    ]),
  }).strict(),
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
      "visibility",
      "jurisdiction",
      "alarm-state",
      "habitat",
      "constituency",
    ]),
    description: NonEmpty,
    inheritedBy: NonEmpty,
  }).strict()).min(1),
  storyPhysics: z.object({
    noPerfectInvisibility: z.literal(true),
    everyComfortHasWake: z.literal(true),
    everyLayerHasResidue: z.literal(true),
    mapIsPoliticalClaim: z.literal(true),
    defensesOutliveEnemies: z.literal(true),
    externalOpacityCanCrownWithin: z.literal(true),
    hubIsStory: z.literal(true),
    everyDelveChangesTomb: z.literal(true),
    treasureCreatesConstituencies: z.literal(true),
    scaleIsDistributed: z.literal(true),
  }).strict(),
  delves: z.array(z.object({
    id: Slug,
    name: NonEmpty,
    description: NonEmpty,
    tierId: z.enum(["ordinary-life", "descent", "breach", "return"]),
    layer: LayerKind,
    depth: z.record(DepthKind, z.number().int().min(0).max(5)),
    accessAfter: Slug.optional(),
    expedition: z.object({
      objective: NonEmpty,
      authorizedRoute: NonEmpty,
      signatureBudget: NonEmpty,
      authority: NonEmpty,
      claimToProve: NonEmpty,
      inheritance: NonEmpty,
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
  }).strict()).min(4),
  notes: JsonValue.optional(),
}).strict();

export const DarkTombPocketSchema = DarkTombPocketSchemaBase.superRefine((source, ctx) => {
  const expectedPressureKinds = [
    "tomb-form",
    "exterior-lie",
    "custodian",
    "ordinary-good",
    "excluded-actor",
    "approaching-breach",
    "cost-of-opening-or-closing",
    "scale-revelation",
  ] as const;
  source.pressures.forEach((pressure, index) => {
    if (pressure.kind !== expectedPressureKinds[index]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pressures", index, "kind"],
        message: `Pressure ${index + 1} must be ${expectedPressureKinds[index]}.`,
      });
    }
  });

  const expectedLayers = ["grave-skin", "shroud", "quiet-works", "common-depths", "custodial-ring", "war-layer", "black-core"] as const;
  source.anatomy.forEach((layer, index) => {
    if (layer.kind !== expectedLayers[index]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["anatomy", index, "kind"], message: `Layer ${index + 1} must be ${expectedLayers[index]}.` });
    }
  });

  const expectedDepths = ["material", "signal", "administrative", "historical", "interpretive"] as const;
  source.depths.forEach((depth, index) => {
    if (depth.kind !== expectedDepths[index]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["depths", index, "kind"], message: `Depth ${index + 1} must be ${expectedDepths[index]}.` });
    }
  });

  const expectedPhases = ["shadow", "hush", "fold", "black", "cut", "wake"] as const;
  source.alarm.phases.forEach((phase, index) => {
    if (phase.phase !== expectedPhases[index]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["alarm", "phases", index, "phase"], message: `Alarm phase ${index + 1} must be ${expectedPhases[index]}.` });
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
  unique(source.delves.map((value) => value.id), ["delves"], "delve id");
  unique(source.consequences.map((value) => value.id), ["consequences"], "consequence id");
  unique(source.evidence.receipts.map((value) => value.id), ["evidence", "receipts"], "receipt id");
  unique(source.factionReceipts.map((value) => value.factionId), ["factionReceipts"], "faction id");
  unique(source.signatureBudget.operations.map((value) => value.kind), ["signatureBudget", "operations"], "signature operation");
  unique(source.signatureBudget.allocations.map((value) => value.id), ["signatureBudget", "allocations"], "signature allocation id");

  const responsibilities = new Set(source.cast.map((member) => member.responsibility));
  for (const required of [
    "depends-on-alarm",
    "bears-cost-of-concealment",
    "understands-quiet-works",
    "translates-excluded-actor",
    "holds-map-changing-evidence",
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

  const delveIds = new Set(source.delves.map((delve) => delve.id));
  const consequenceIds = new Set(source.consequences.map((consequence) => consequence.id));
  const layerIds = new Set(source.anatomy.map((layer) => layer.kind));
  source.delves.forEach((delve, delveIndex) => {
    if (delve.minAgents > delve.maxAgents) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["delves", delveIndex], message: "minAgents cannot exceed maxAgents." });
    }
    if (delve.accessAfter && !delveIds.has(delve.accessAfter)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["delves", delveIndex, "accessAfter"], message: `Unknown prior delve ${delve.accessAfter}.` });
    }
    if (delve.accessAfter === delve.id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["delves", delveIndex, "accessAfter"], message: "A delve cannot unlock itself." });
    }
    if (!consequenceIds.has(delve.consequenceId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["delves", delveIndex, "consequenceId"], message: `Unknown consequence ${delve.consequenceId}.` });
    }
    if (!layerIds.has(delve.layer)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["delves", delveIndex, "layer"], message: `Unknown layer ${delve.layer}.` });
    }
    if (Object.keys(delve.depth).length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["delves", delveIndex, "depth"], message: "A delve must declare at least one depth coordinate." });
    }
    delve.checks.forEach((check, checkIndex) => {
      const total = Object.values(check.weights).reduce((sum, value) => sum + value, 0);
      if (Math.abs(total - 1) > 0.001) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["delves", delveIndex, "checks", checkIndex, "weights"], message: `Weights must sum to 1.0 (got ${total.toFixed(3)}).` });
      }
      if (check.scope === "role" && (!check.roleIds || check.roleIds.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["delves", delveIndex, "checks", checkIndex, "roleIds"], message: "Role checks require roleIds." });
      }
    });
  });
});

export type DarkTombValidation =
  | { ok: true; source: DarkTombPocketSource }
  | { ok: false; errors: string[] };

export function validateDarkTombPocket(input: unknown): DarkTombValidation {
  const result = DarkTombPocketSchema.safeParse(input);
  if (result.success) return { ok: true, source: result.data as DarkTombPocketSource };
  return { ok: false, errors: result.error.issues.map((issue) => `[${issue.path.join(".") || "root"}] ${issue.message}`) };
}

export function parseDarkTombPocket(input: unknown): DarkTombPocketSource {
  const result = validateDarkTombPocket(input);
  if (!result.ok) throw new Error(`Invalid Dark Tomb pocket:\n${result.errors.join("\n")}`);
  return result.source;
}
