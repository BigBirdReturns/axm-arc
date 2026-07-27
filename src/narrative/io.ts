import { z } from "zod";
import { validateBoundedJsonValue } from "../engine/bounded-json.js";
import { validateNarrativeConstitution } from "./validate.js";
import {
  NARRATIVE_LEDGER_FORMAT,
  NARRATIVE_RAILS_FORMAT,
  type NarrativeConstitution,
  type NarrativeRuntimeState,
} from "./types.js";

const Id = z.string().min(1).max(512);
const Text = z.string().min(1).max(16_384);
const SafeInteger = z.number().int().safe();
const NonNegativeInteger = SafeInteger.nonnegative();
const FiniteNumber = z.number().finite();
const Tags = z.array(Id).max(512);
const BeatFunction = z.enum([
  "establish",
  "pressure",
  "escalate",
  "reveal",
  "choose",
  "reverse",
  "consequence",
  "inherit",
]);
const TrackStatus = z.enum(["open", "resolved", "inherited"]);
const Authority = z.enum(["authoritative", "presentation"]);
const ObligationStatus = z.enum(["open", "resolved", "breached", "transferred"]);
const Primitive = z.union([z.string(), FiniteNumber, z.boolean(), z.null()]);

const FactSchema = z.object({
  id: Id,
  type: Id,
  cycle: NonNegativeInteger,
  actorIds: z.array(Id).max(256),
  actorRoles: z.record(Id).optional(),
  tags: Tags,
  severity: NonNegativeInteger.max(100),
  receiptRef: Id,
  data: z.record(Primitive).optional(),
}).strict();

const ActorSchema = z.object({
  id: Id,
  tags: Tags,
  metrics: z.record(FiniteNumber),
}).strict();

const StatePaymentSchema = z.object({
  kind: Id,
  target: Id,
  tags: Tags,
  receiptRef: Id.optional(),
}).strict();

const ActorMoveSchema = z.object({
  actorId: Id,
  moveTag: Id,
  justificationFactIds: z.array(Id).max(512).optional(),
}).strict();

const ScoreBreakdownSchema = z.object({
  authoredPriority: SafeInteger,
  sourceSeverity: SafeInteger,
  conditionComplexity: SafeInteger,
  obligationPressure: SafeInteger,
  identityRelevance: SafeInteger,
  closure: SafeInteger,
  freshness: SafeInteger,
  actorFit: SafeInteger,
  repetition: SafeInteger,
  trackUrgency: SafeInteger,
}).strict();

const CandidateScoreSchema = z.object({
  candidateId: Id,
  total: SafeInteger,
  breakdown: ScoreBreakdownSchema,
  matchedIdentityAnchors: z.array(Id).max(512),
  roleBindings: z.record(Id),
}).strict();

const BeatSchema = z.object({
  id: Id,
  sequence: NonNegativeInteger,
  cycle: NonNegativeInteger,
  candidateId: Id,
  recipeId: Id,
  authority: Authority,
  trackId: Id,
  beatFunction: BeatFunction,
  sourceFactIds: z.array(Id).max(512),
  causalParentBeatIds: z.array(Id).max(512),
  roleBindings: z.record(Id),
  actorMoves: z.array(ActorMoveSchema).max(256),
  tags: Tags,
  pressureTags: Tags,
  statePayments: z.array(StatePaymentSchema).max(512),
  openedObligationIds: z.array(Id).max(512),
  resolvedObligationIds: z.array(Id).max(512),
  presentationKey: Id,
  score: CandidateScoreSchema,
}).strict();

const ObligationSchema = z.object({
  id: Id,
  kind: Id,
  actorIds: z.array(Id).max(256),
  tags: Tags,
  pressure: NonNegativeInteger.max(100),
  dueCycle: NonNegativeInteger.optional(),
  openedByBeatId: Id,
  status: ObligationStatus,
  closedByBeatId: Id.optional(),
}).strict();

const TrackSchema = z.object({
  id: Id,
  railId: Id,
  controllingQuestion: Text,
  actorIds: z.array(Id).max(256),
  pressureTags: Tags,
  currentFunction: BeatFunction,
  beatIds: z.array(Id).max(100_000),
  openObligationIds: z.array(Id).max(100_000),
  status: TrackStatus,
}).strict();

const RuntimeStateSchema = z.object({
  cycle: NonNegativeInteger,
  facts: z.array(FactSchema).max(100_000),
  actors: z.array(ActorSchema).max(10_000),
  tracks: z.array(TrackSchema).max(100_000),
  ledger: z.object({
    format: z.literal(NARRATIVE_LEDGER_FORMAT),
    beats: z.array(BeatSchema).max(100_000),
    obligations: z.array(ObligationSchema).max(100_000),
  }).strict(),
}).strict();

const ConditionalMoveSchema = z.object({
  moveTag: Id,
  requiresAnyTags: Tags,
}).strict();

const ActorPolicySchema = z.object({
  actorId: Id,
  baselineMoves: Tags,
  conditionalMoves: z.array(ConditionalMoveSchema).max(512),
  forbiddenMoves: Tags,
  deviationPolicy: z.enum(["allow", "justify", "reject"]),
  deviationRequiresAnyTags: Tags.optional(),
}).strict();

const RailSchema = z.object({
  id: Id,
  openingFunctions: z.array(BeatFunction).max(8),
  transitions: z.record(z.array(BeatFunction).max(8)),
  terminalFunctions: z.array(BeatFunction).max(8),
}).strict();

const WeightsSchema = z.object({
  authoredPriority: NonNegativeInteger,
  sourceSeverity: NonNegativeInteger,
  conditionComplexity: NonNegativeInteger,
  obligationPressure: NonNegativeInteger,
  identityRelevance: NonNegativeInteger,
  closure: NonNegativeInteger,
  freshness: NonNegativeInteger,
  actorFit: NonNegativeInteger,
  repetition: NonNegativeInteger,
  trackUrgency: NonNegativeInteger,
}).strict();

const ConstitutionSchema = z.object({
  format: z.literal(NARRATIVE_RAILS_FORMAT),
  id: Id,
  version: Id,
  identityAnchors: z.array(z.object({ id: Id, anyOfTags: Tags }).strict()).max(512),
  prohibitedMoveTags: Tags,
  actorPolicies: z.array(ActorPolicySchema).max(10_000),
  rails: z.array(RailSchema).max(512),
  weights: WeightsSchema,
  freshnessCap: NonNegativeInteger,
}).strict();

function formatIssues(label: string, issues: readonly z.ZodIssue[]): Error {
  const details = issues.map((issue) => `${issue.path.join(".") || label}: ${issue.message}`);
  return new Error(`Invalid ${label}:\n${details.join("\n")}`);
}

export function parseNarrativeRuntimeState(input: unknown): NarrativeRuntimeState {
  validateBoundedJsonValue(input);
  const parsed = RuntimeStateSchema.safeParse(input);
  if (!parsed.success) throw formatIssues("narrative runtime state", parsed.error.issues);
  return structuredClone(parsed.data) as NarrativeRuntimeState;
}

export function parseNarrativeConstitution(input: unknown): NarrativeConstitution {
  validateBoundedJsonValue(input);
  const parsed = ConstitutionSchema.safeParse(input);
  if (!parsed.success) throw formatIssues("narrative constitution", parsed.error.issues);
  const constitution = structuredClone(parsed.data) as NarrativeConstitution;
  const issues = validateNarrativeConstitution(constitution);
  if (issues.length > 0) {
    throw new Error(
      `Invalid narrative constitution:\n${issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n")}`,
    );
  }
  return constitution;
}
