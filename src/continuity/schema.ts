import { z } from "zod";
import type { JsonValue } from "../engine/portable-run.js";
import {
  ACTION_PROPOSAL_FORMAT,
  ACTOR_OBSERVATION_FORMAT,
  CONTINUITY_STATE_FORMAT,
  WORLD_CLOCK_FORMAT,
  WORLD_EVENT_FORMAT,
  WORLD_SNAPSHOT_FORMAT,
} from "./types.js";

const JsonSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(),
  z.array(JsonSchema), z.record(JsonSchema),
]));
const NonEmptyId = z.string().min(1).max(256);
const CartridgeDigest = z.string().regex(/^cart1_[0-9a-f]{64}$/);
const RunDigest = z.string().regex(/^run3_[0-9a-f]{64}$/);
const StateDigest = z.string().regex(/^state1_[0-9a-f]{64}$/);

export const WorldClockSchema = z.object({
  format: z.literal(WORLD_CLOCK_FORMAT),
  tick: z.number().int().nonnegative().safe(),
  revision: z.number().int().nonnegative().safe(),
  mode: z.enum(["paused", "manual", "bounded-autonomous"]),
}).strict();

const AffordanceSchema = z.object({
  id: NonEmptyId,
  arguments: JsonSchema.optional(),
  cost: JsonSchema.optional(),
}).strict();

const SeatSchema = z.object({
  kind: z.enum(["deterministic-policy", "local-model", "remote-model", "human"]),
  provider: z.string().min(1).max(256).optional(),
  model: z.string().min(1).max(256).optional(),
  instance: z.string().min(1).max(256).optional(),
}).strict();

export const ActorObservationSchema = z.object({
  format: z.literal(ACTOR_OBSERVATION_FORMAT),
  cartridgeDigest: CartridgeDigest,
  runDigest: RunDigest,
  revision: z.number().int().nonnegative().safe(),
  tick: z.number().int().nonnegative().safe(),
  actorId: NonEmptyId,
  visible: z.record(JsonSchema),
  affordances: z.array(AffordanceSchema).max(256),
  observationDigest: z.string().regex(/^obs1_[0-9a-f]{64}$/),
}).strict();

export const ActionProposalSchema = z.object({
  format: z.literal(ACTION_PROPOSAL_FORMAT),
  cartridgeDigest: CartridgeDigest,
  runDigest: RunDigest,
  revision: z.number().int().nonnegative().safe(),
  tick: z.number().int().nonnegative().safe(),
  actorId: NonEmptyId,
  observationDigest: z.string().regex(/^obs1_[0-9a-f]{64}$/),
  actionId: NonEmptyId,
  arguments: JsonSchema,
  seat: SeatSchema,
  utterance: z.string().max(8192).nullable().optional(),
  proposalDigest: z.string().regex(/^prop1_[0-9a-f]{64}$/),
}).strict();

export const WorldSnapshotSchema = z.object({
  format: z.literal(WORLD_SNAPSHOT_FORMAT),
  cartridgeDigest: CartridgeDigest,
  runDigest: RunDigest,
  stateDigest: StateDigest,
  clock: WorldClockSchema,
  eventHead: z.string().regex(/^evt1_[0-9a-f]{64}$/).nullable(),
}).strict();

export const WorldEventSchema = z.object({
  format: z.literal(WORLD_EVENT_FORMAT),
  eventId: z.string().regex(/^evt1_[0-9a-f]{64}$/),
  previousEventId: z.string().regex(/^evt1_[0-9a-f]{64}$/).nullable(),
  proposalDigest: z.string().regex(/^prop1_[0-9a-f]{64}$/),
  actorId: NonEmptyId,
  actionId: NonEmptyId,
  tick: z.number().int().nonnegative().safe(),
  revisionBefore: z.number().int().nonnegative().safe(),
  revisionAfter: z.number().int().nonnegative().safe(),
  status: z.enum(["accepted", "refused"]),
  reason: z.string().min(1).max(2048),
  runDigestBefore: RunDigest,
  runDigestAfter: RunDigest,
  stateDigestBefore: StateDigest,
  stateDigestAfter: StateDigest,
  effects: JsonSchema,
}).strict();

export const ContinuityStateSchema = z.object({
  format: z.literal(CONTINUITY_STATE_FORMAT),
  snapshot: WorldSnapshotSchema,
  events: z.array(WorldEventSchema).max(100_000),
}).strict();

export function parseWorldClock(input: unknown) {
  return WorldClockSchema.parse(input);
}

export function parseActorObservation(input: unknown) {
  return ActorObservationSchema.parse(input);
}

export function parseActionProposal(input: unknown) {
  return ActionProposalSchema.parse(input);
}

export function parseWorldSnapshot(input: unknown) {
  return WorldSnapshotSchema.parse(input);
}

export function parseWorldEvent(input: unknown) {
  return WorldEventSchema.parse(input);
}

export function parseContinuityState(input: unknown) {
  return ContinuityStateSchema.parse(input);
}
