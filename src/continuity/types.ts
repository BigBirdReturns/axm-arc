import type { JsonValue } from "../engine/portable-run.js";

export const CONTINUITY_EXTENSION_KEY = "axm.continuity@1" as const;
export const WORLD_CLOCK_FORMAT = "axm-world-clock/v1" as const;
export const ACTOR_OBSERVATION_FORMAT = "axm-actor-observation/v1" as const;
export const ACTION_PROPOSAL_FORMAT = "axm-action-proposal/v1" as const;
export const WORLD_EVENT_FORMAT = "axm-world-event/v1" as const;
export const WORLD_SNAPSHOT_FORMAT = "axm-world-snapshot/v1" as const;
export const CONTINUITY_STATE_FORMAT = "axm-continuity-state/v1" as const;

export type ContinuityJson = JsonValue;
export type ContinuityObject = Record<string, JsonValue>;
export type WorldClockMode = "paused" | "manual" | "bounded-autonomous";
export type ActorSeatKind = "deterministic-policy" | "local-model" | "remote-model" | "human";
export type WorldEventStatus = "accepted" | "refused";

export interface WorldClockV1 {
  format: typeof WORLD_CLOCK_FORMAT;
  tick: number;
  revision: number;
  mode: WorldClockMode;
}

export interface ActorAffordanceV1 {
  id: string;
  arguments?: ContinuityJson;
  cost?: ContinuityJson;
}

export interface ActorObservationV1 {
  format: typeof ACTOR_OBSERVATION_FORMAT;
  cartridgeDigest: string;
  runDigest: string;
  revision: number;
  tick: number;
  actorId: string;
  visible: ContinuityObject;
  affordances: ActorAffordanceV1[];
  observationDigest: string;
}

export interface ActorSeatIdentityV1 {
  kind: ActorSeatKind;
  provider?: string;
  model?: string;
  instance?: string;
}

export interface ActionProposalCoreV1 {
  format: typeof ACTION_PROPOSAL_FORMAT;
  cartridgeDigest: string;
  runDigest: string;
  revision: number;
  tick: number;
  actorId: string;
  observationDigest: string;
  actionId: string;
  arguments: ContinuityJson;
  seat: ActorSeatIdentityV1;
  utterance?: string | null;
}

export interface ActionProposalV1 extends ActionProposalCoreV1 {
  proposalDigest: string;
}

export interface WorldSnapshotV1 {
  format: typeof WORLD_SNAPSHOT_FORMAT;
  cartridgeDigest: string;
  runDigest: string;
  stateDigest: string;
  clock: WorldClockV1;
  eventHead: string | null;
}

export interface WorldEventV1 {
  format: typeof WORLD_EVENT_FORMAT;
  eventId: string;
  previousEventId: string | null;
  proposalDigest: string;
  actorId: string;
  actionId: string;
  tick: number;
  revisionBefore: number;
  revisionAfter: number;
  status: WorldEventStatus;
  reason: string;
  runDigestBefore: string;
  runDigestAfter: string;
  stateDigestBefore: string;
  stateDigestAfter: string;
  effects: ContinuityJson;
}

export interface ContinuityStateV1 {
  format: typeof CONTINUITY_STATE_FORMAT;
  snapshot: WorldSnapshotV1;
  events: WorldEventV1[];
}

export interface ActorViewV1 {
  visible: ContinuityObject;
  affordances: ActorAffordanceV1[];
}

export interface HostPreflightResultV1 {
  allowed: boolean;
  reason: string;
}

export interface HostApplyResultV1 {
  runDigest: string;
  stateDigest: string;
  effects: ContinuityJson;
}

export interface ContinuityHostV1 {
  observe(snapshot: WorldSnapshotV1, actorId: string): ActorViewV1;
  preflight(snapshot: WorldSnapshotV1, proposal: ActionProposalV1): HostPreflightResultV1;
  apply(snapshot: WorldSnapshotV1, proposal: ActionProposalV1): HostApplyResultV1;
}

export type ActorSeatV1 = (
  observation: ActorObservationV1,
) => ActionProposalV1 | Promise<ActionProposalV1>;
