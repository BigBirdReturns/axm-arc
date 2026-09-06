import { advanceWorldTick, adjudicateProposal, buildActorObservation } from "./contract.js";
import { appendValidatedContinuityEvent, assertContinuityState } from "./state.js";
import type {
  ActionProposalV1,
  ActorObservationV1,
  ActorSeatV1,
  ContinuityHostV1,
  ContinuityStateV1,
  WorldEventV1,
} from "./types.js";

export interface ContinuityTickResultV1 {
  state: ContinuityStateV1;
  observation: ActorObservationV1;
  proposal: ActionProposalV1;
  event: WorldEventV1;
}

async function runValidatedTick(params: {
  state: ContinuityStateV1;
  actorId: string;
  seat: ActorSeatV1;
  host: ContinuityHostV1;
}): Promise<ContinuityTickResultV1> {
  if (params.state.snapshot.clock.mode === "paused") throw new Error("Continuity clock is paused.");
  const ticking = advanceWorldTick(params.state.snapshot);
  const observation = buildActorObservation(ticking, params.actorId, params.host.observe(ticking, params.actorId));
  const proposal = await params.seat(observation);
  const adjudicated = adjudicateProposal({ snapshot: ticking, observation, proposal, host: params.host });
  const state = appendValidatedContinuityEvent(params.state, adjudicated.snapshot, adjudicated.event);
  return { state, observation, proposal, event: adjudicated.event };
}

export async function runContinuityTick(params: {
  state: ContinuityStateV1;
  actorId: string;
  seat: ActorSeatV1;
  host: ContinuityHostV1;
}): Promise<ContinuityTickResultV1> {
  const current = assertContinuityState(params.state);
  return runValidatedTick({ ...params, state: current });
}

export async function runContinuitySchedule(params: {
  state: ContinuityStateV1;
  actorIds: readonly string[];
  ticks: number;
  seatFor(actorId: string): ActorSeatV1;
  host: ContinuityHostV1;
}): Promise<{ state: ContinuityStateV1; events: WorldEventV1[] }> {
  if (!Number.isSafeInteger(params.ticks) || params.ticks < 0) {
    throw new Error("Continuity schedule ticks must be a non-negative safe integer.");
  }
  if (params.ticks > 100_000) throw new Error("Continuity schedule exceeds the 100000-tick safety bound.");
  if (params.actorIds.length === 0 && params.ticks > 0) throw new Error("Continuity schedule needs at least one actor.");

  const initial = assertContinuityState(params.state);
  let snapshot = initial.snapshot;
  const retained = [...initial.events];
  const events: WorldEventV1[] = [];
  for (let index = 0; index < params.ticks; index += 1) {
    if (snapshot.clock.mode === "paused") throw new Error("Continuity clock is paused.");
    const actorId = params.actorIds[index % params.actorIds.length]!;
    const ticking = advanceWorldTick(snapshot);
    const observation = buildActorObservation(ticking, actorId, params.host.observe(ticking, actorId));
    const proposal = await params.seatFor(actorId)(observation);
    const adjudicated = adjudicateProposal({ snapshot: ticking, observation, proposal, host: params.host });
    retained.push(adjudicated.event);
    events.push(adjudicated.event);
    snapshot = adjudicated.snapshot;
  }
  const state = assertContinuityState({ ...initial, snapshot, events: retained });
  return { state, events };
}
