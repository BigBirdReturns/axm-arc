import { z } from "zod";
import { GODSCAR_POCKET_FORMAT, type GodscarPocketSource } from "./types.js";

const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase kebab-case id.");
const NonEmpty = z.string().trim().min(1);
const CanonTier = z.enum(["settled-canon", "contested-canon", "faction-doctrine", "story-facing-unknown"]);
const CanonRelation = z.enum(["foundational", "compatible", "contested", "alternate-sequence", "crossover", "private-branch"]);
const RoleId = z.enum(["auditor", "interlocutor", "witness", "protector", "exception"]);
const AttributeId = z.enum(["care", "evidence", "exteriority", "systems", "resolve"]);

const Pressure = z.object({
  kind: z.enum(["pocket", "patron", "excluded-actor", "approaching-trigger", "cost-of-resistance", "scale-revelation"]),
  id: Slug,
  label: NonEmpty,
  description: NonEmpty,
}).strict();

const JsonPrimitive: z.ZodType<unknown> = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const JsonValue: z.ZodType<unknown> = z.lazy(() => z.union([JsonPrimitive, z.array(JsonValue), z.record(JsonValue)]));

const PocketSchemaBase = z.object({
  format: z.literal(GODSCAR_POCKET_FORMAT),
  identity: z.object({
    id: Slug,
    title: NonEmpty,
    description: NonEmpty,
    author: NonEmpty,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    estimatedCycles: z.number().int().positive().max(1000),
    parentCanons: z.array(NonEmpty),
    canonRelation: CanonRelation,
  }).strict(),
  controlQuestion: NonEmpty,
  pressures: z.tuple([Pressure, Pressure, Pressure, Pressure, Pressure, Pressure]),
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
    responsibility: z.enum(["depends-on-system", "translates-excluded-actor", "holds-evidence", "benefits-from-delay", "sovereign-exception"]),
    description: NonEmpty,
    factionId: Slug.optional(),
  }).strict()).min(5),
  consequences: z.array(z.object({
    id: Slug,
    label: NonEmpty,
    kind: z.enum(["citizen", "dependency", "route", "archive", "doctrine", "adaptive-capacity", "trauma"]),
    description: NonEmpty,
    inheritedBy: NonEmpty,
  }).strict()).min(1),
  storyPhysics: z.object({
    noCleanReset: z.literal(true),
    crowningIsConcentration: z.literal(true),
    answerReflectsExclusion: z.literal(true),
    counterformInheritsClaim: z.literal(true),
    scaleIsDistributed: z.literal(true),
    distanceRemainsPolitical: z.literal(true),
    factionReceiptsRequired: z.literal(true),
    everyVictoryChangesMap: z.literal(true),
  }).strict(),
  beats: z.array(z.object({
    id: Slug,
    name: NonEmpty,
    description: NonEmpty,
    tierId: z.enum(["arrival", "disclosure", "refusal"]),
    accessAfter: Slug.optional(),
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
  }).strict()).min(3),
  notes: JsonValue.optional(),
}).strict();

export const GodscarPocketSchema = PocketSchemaBase.superRefine((source, ctx) => {
  const expectedKinds = ["pocket", "patron", "excluded-actor", "approaching-trigger", "cost-of-resistance", "scale-revelation"];
  source.pressures.forEach((pressure, index) => {
    if (pressure.kind !== expectedKinds[index]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pressures", index, "kind"], message: `Pressure ${index + 1} must be ${expectedKinds[index]}.` });
    }
  });

  const unique = (values: string[], path: (string | number)[], label: string) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, index], message: `Duplicate ${label} "${value}".` });
      seen.add(value);
    });
  };
  unique(source.cast.map((v) => v.id), ["cast"], "cast id");
  unique(source.beats.map((v) => v.id), ["beats"], "beat id");
  unique(source.consequences.map((v) => v.id), ["consequences"], "consequence id");
  unique(source.evidence.receipts.map((v) => v.id), ["evidence", "receipts"], "receipt id");

  const responsibility = new Set(source.cast.map((member) => member.responsibility));
  for (const required of ["depends-on-system", "translates-excluded-actor", "holds-evidence", "benefits-from-delay", "sovereign-exception"] as const) {
    if (!responsibility.has(required)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cast"], message: `Cast must include responsibility ${required}.` });
  }

  const beatIds = new Set(source.beats.map((beat) => beat.id));
  const consequenceIds = new Set(source.consequences.map((consequence) => consequence.id));
  source.beats.forEach((beat, beatIndex) => {
    if (beat.minAgents > beat.maxAgents) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["beats", beatIndex], message: "minAgents cannot exceed maxAgents." });
    if (beat.accessAfter && !beatIds.has(beat.accessAfter)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["beats", beatIndex, "accessAfter"], message: `Unknown prior beat ${beat.accessAfter}.` });
    if (!consequenceIds.has(beat.consequenceId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["beats", beatIndex, "consequenceId"], message: `Unknown consequence ${beat.consequenceId}.` });
    beat.checks.forEach((check, checkIndex) => {
      const total = Object.values(check.weights).reduce((sum, value) => sum + value, 0);
      if (Math.abs(total - 1) > 0.001) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["beats", beatIndex, "checks", checkIndex, "weights"], message: `Weights must sum to 1.0 (got ${total.toFixed(3)}).` });
      if (check.scope === "role" && (!check.roleIds || check.roleIds.length === 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["beats", beatIndex, "checks", checkIndex, "roleIds"], message: "Role checks require roleIds." });
    });
  });
});

export type GodscarValidation =
  | { ok: true; source: GodscarPocketSource }
  | { ok: false; errors: string[] };

export function validateGodscarPocket(input: unknown): GodscarValidation {
  const result = GodscarPocketSchema.safeParse(input);
  if (result.success) return { ok: true, source: result.data as GodscarPocketSource };
  return { ok: false, errors: result.error.issues.map((issue) => `[${issue.path.join(".") || "root"}] ${issue.message}`) };
}

export function parseGodscarPocket(input: unknown): GodscarPocketSource {
  const result = validateGodscarPocket(input);
  if (!result.ok) throw new Error(`Invalid Godscar pocket:\n${result.errors.join("\n")}`);
  return result.source;
}
