import { compareCodepoints } from "../engine/determinism.js";
import type { JsonValue } from "../engine/portable-run.js";
import { canonicalContinuityJson, continuityDigest } from "./canonical.js";
import {
  parseActionProposal,
  parseActorObservation,
  parseWorldSnapshot,
} from "./schema.js";
import {
  ACTION_PROPOSAL_FORMAT,
  ACTOR_OBSERVATION_FORMAT,
  WORLD_CLOCK_FORMAT,
  WORLD_EVENT_FORMAT,
  WORLD_SNAPSHOT_FORMAT,
  type ActionProposalCoreV1,
  type ActionProposalV1,
  type ActorObservationV1,
  type ActorSeatIdentityV1,
  type ActorViewV1,
  type ContinuityHostV1,
  type ContinuityJson,
  type WorldClockMode,
  type WorldClockV1,
  type WorldEventV1,
  type WorldSnapshotV1,
} from "./types.js";

export function createWorldClock(mode: WorldClockMode = "paused"): WorldClockV1 {
  return { format: WORLD_CLOCK_FORMAT, tick: 0, revision: 0, mode };
}

export function createWorldSnapshot(params: {
  cartridgeDigest: string;
  runDigest: string;
  state: JsonValue;
  mode?: WorldClockMode;
}): WorldSnapshotV1 {
  const snapshot: WorldSnapshotV1 = {
    format: WORLD_SNAPSHOT_FORMAT,
    cartridgeDigest: params.cartridgeDigest,
    runDigest: params.runDigest,
    stateDigest: continuityDigest("state1_", params.state),
    clock: createWorldClock(params.mode),
    eventHead: null,
  };
  return parseWorldSnapshot(snapshot) as WorldSnapshotV1;
}

export function advanceWorldTick(snapshot: WorldSnapshotV1, steps = 1): WorldSnapshotV1 {
  parseWorldSnapshot(snapshot);
  if (!Number.isSafeInteger(steps) || steps < 1) throw new Error("World tick steps must be a positive safe integer.");
  return {
    ...snapshot,
    clock: { ...snapshot.clock, tick: snapshot.clock.tick + steps },
  };
}

function observationCore(observation: Omit<ActorObservationV1, "observationDigest">): ContinuityJson {
  return observation as unknown as ContinuityJson;
}

function proposalCore(proposal: ActionProposalCoreV1): ContinuityJson {
  return proposal as unknown as ContinuityJson;
}

export function buildActorObservation(
  snapshot: WorldSnapshotV1,
  actorId: string,
  view: ActorViewV1,
): ActorObservationV1 {
  parseWorldSnapshot(snapshot);
  const affordances = [...view.affordances].sort((a, b) => compareCodepoints(a.id, b.id));
  if (new Set(affordances.map((entry) => entry.id)).size !== affordances.length) {
    throw new Error("Actor observation contains duplicate affordance ids.");
  }
  const core: Omit<ActorObservationV1, "observationDigest"> = {
    format: ACTOR_OBSERVATION_FORMAT,
    cartridgeDigest: snapshot.cartridgeDigest,
    runDigest: snapshot.runDigest,
    revision: snapshot.clock.revision,
    tick: snapshot.clock.tick,
    actorId,
    visible: view.visible,
    affordances,
  };
  const observation: ActorObservationV1 = {
    ...core,
    observationDigest: continuityDigest("obs1_", observationCore(core)),
  };
  return parseActorObservation(observation) as ActorObservationV1;
}

export function buildActionProposal(params: {
  observation: ActorObservationV1;
  actionId: string;
  arguments?: JsonValue;
  seat: ActorSeatIdentityV1;
  utterance?: string | null;
}): ActionProposalV1 {
  const observation = parseActorObservation(params.observation) as ActorObservationV1;
  assertObservationDigest(observation);
  const core: ActionProposalCoreV1 = {
    format: ACTION_PROPOSAL_FORMAT,
    cartridgeDigest: observation.cartridgeDigest,
    runDigest: observation.runDigest,
    revision: observation.revision,
    tick: observation.tick,
    actorId: observation.actorId,
    observationDigest: observation.observationDigest,
    actionId: params.actionId,
    arguments: params.arguments ?? null,
    seat: params.seat,
    ...(params.utterance === undefined ? {} : { utterance: params.utterance }),
  };
  const proposal: ActionProposalV1 = {
    ...core,
    proposalDigest: continuityDigest("prop1_", proposalCore(core)),
  };
  return parseActionProposal(proposal) as ActionProposalV1;
}

export function assertObservationDigest(observation: ActorObservationV1): void {
  const { observationDigest, ...core } = observation;
  const expected = continuityDigest("obs1_", observationCore(core));
  if (expected !== observationDigest) throw new Error("Actor observation digest mismatch.");
}

export function assertProposalDigest(proposal: ActionProposalV1): void {
  const { proposalDigest, ...core } = proposal;
  const expected = continuityDigest("prop1_", proposalCore(core));
  if (expected !== proposalDigest) throw new Error("Action proposal digest mismatch.");
}

function refusalReason(
  snapshot: WorldSnapshotV1,
  observation: ActorObservationV1,
  proposal: ActionProposalV1,
): string | null {
  if (proposal.cartridgeDigest !== snapshot.cartridgeDigest) return "continuity/cartridge-mismatch";
  if (proposal.runDigest !== snapshot.runDigest) return "continuity/stale-run";
  if (proposal.revision !== snapshot.clock.revision) return "continuity/stale-revision";
  if (proposal.tick !== snapshot.clock.tick) return "continuity/stale-tick";
  if (observation.cartridgeDigest !== snapshot.cartridgeDigest) return "continuity/observation-cartridge-mismatch";
  if (observation.runDigest !== snapshot.runDigest) return "continuity/observation-stale-run";
  if (observation.revision !== snapshot.clock.revision) return "continuity/observation-stale-revision";
  if (observation.tick !== snapshot.clock.tick) return "continuity/observation-stale-tick";
  if (proposal.actorId !== observation.actorId) return "continuity/actor-mismatch";
  if (proposal.observationDigest !== observation.observationDigest) return "continuity/observation-mismatch";
  const affordance = observation.affordances.find((entry) => entry.id === proposal.actionId);
  if (!affordance) return "continuity/action-not-observed";
  if (affordance.arguments !== undefined
    && canonicalContinuityJson(affordance.arguments) !== canonicalContinuityJson(proposal.arguments)) {
    return "continuity/arguments-not-observed";
  }
  return null;
}

interface EventCore extends Omit<WorldEventV1, "eventId"> {}

function buildEvent(core: EventCore): WorldEventV1 {
  return {
    ...core,
    eventId: continuityDigest("evt1_", core as unknown as ContinuityJson),
  };
}

function refusedEvent(
  snapshot: WorldSnapshotV1,
  proposal: ActionProposalV1,
  reason: string,
): { snapshot: WorldSnapshotV1; event: WorldEventV1 } {
  const event = buildEvent({
    format: WORLD_EVENT_FORMAT,
    previousEventId: snapshot.eventHead,
    proposalDigest: proposal.proposalDigest,
    actorId: proposal.actorId,
    actionId: proposal.actionId,
    tick: snapshot.clock.tick,
    revisionBefore: snapshot.clock.revision,
    revisionAfter: snapshot.clock.revision,
    status: "refused",
    reason,
    runDigestBefore: snapshot.runDigest,
    runDigestAfter: snapshot.runDigest,
    stateDigestBefore: snapshot.stateDigest,
    stateDigestAfter: snapshot.stateDigest,
    effects: null,
  });
  return { snapshot: { ...snapshot, eventHead: event.eventId }, event };
}

export function adjudicateProposal(params: {
  snapshot: WorldSnapshotV1;
  observation: ActorObservationV1;
  proposal: ActionProposalV1;
  host: ContinuityHostV1;
}): { snapshot: WorldSnapshotV1; event: WorldEventV1 } {
  const snapshot = parseWorldSnapshot(params.snapshot) as WorldSnapshotV1;
  const observation = parseActorObservation(params.observation) as ActorObservationV1;
  const proposal = parseActionProposal(params.proposal) as ActionProposalV1;
  assertObservationDigest(observation);
  assertProposalDigest(proposal);

  const boundaryRefusal = refusalReason(snapshot, observation, proposal);
  if (boundaryRefusal) return refusedEvent(snapshot, proposal, boundaryRefusal);

  const preflight = params.host.preflight(snapshot, proposal);
  if (!preflight.allowed) {
    if (!preflight.reason.trim()) throw new Error("Host refusal must include a reason.");
    return refusedEvent(snapshot, proposal, `host/${preflight.reason}`);
  }

  const applied = params.host.apply(snapshot, proposal);
  if (!/^run3_[0-9a-f]{64}$/.test(applied.runDigest)) {
    throw new Error("Host apply returned an invalid run digest.");
  }
  if (!/^state1_[0-9a-f]{64}$/.test(applied.stateDigest)) {
    throw new Error("Host apply returned an invalid state digest.");
  }
  const revisionAfter = snapshot.clock.revision + 1;
  const event = buildEvent({
    format: WORLD_EVENT_FORMAT,
    previousEventId: snapshot.eventHead,
    proposalDigest: proposal.proposalDigest,
    actorId: proposal.actorId,
    actionId: proposal.actionId,
    tick: snapshot.clock.tick,
    revisionBefore: snapshot.clock.revision,
    revisionAfter,
    status: "accepted",
    reason: "host/accepted",
    runDigestBefore: snapshot.runDigest,
    runDigestAfter: applied.runDigest,
    stateDigestBefore: snapshot.stateDigest,
    stateDigestAfter: applied.stateDigest,
    effects: applied.effects,
  });
  return {
    snapshot: {
      ...snapshot,
      runDigest: applied.runDigest,
      stateDigest: applied.stateDigest,
      eventHead: event.eventId,
      clock: { ...snapshot.clock, revision: revisionAfter },
    },
    event,
  };
}
