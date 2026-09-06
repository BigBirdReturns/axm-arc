import { continuityDigest } from "./canonical.js";
import { parseContinuityState, parseWorldSnapshot } from "./schema.js";
import {
  CONTINUITY_STATE_FORMAT,
  type ContinuityJson,
  type ContinuityStateV1,
  type WorldEventV1,
  type WorldSnapshotV1,
} from "./types.js";

function eventDigest(event: WorldEventV1): string {
  const { eventId: _eventId, ...core } = event;
  return continuityDigest("evt1_", core as unknown as ContinuityJson);
}

export function createContinuityState(snapshot: WorldSnapshotV1): ContinuityStateV1 {
  return {
    format: CONTINUITY_STATE_FORMAT,
    snapshot: parseWorldSnapshot(snapshot) as WorldSnapshotV1,
    events: [],
  };
}

export function assertContinuityState(input: unknown): ContinuityStateV1 {
  const state = parseContinuityState(input) as ContinuityStateV1;
  let previousEventId: string | null = null;
  let previousRun = state.events[0]?.runDigestBefore ?? state.snapshot.runDigest;
  let previousState = state.events[0]?.stateDigestBefore ?? state.snapshot.stateDigest;
  let revision = state.events[0]?.revisionBefore ?? state.snapshot.clock.revision;

  for (const event of state.events) {
    if (event.eventId !== eventDigest(event)) throw new Error(`Continuity event ${event.eventId} digest mismatch.`);
    if (event.previousEventId !== previousEventId) throw new Error(`Continuity event ${event.eventId} breaks the event chain.`);
    if (event.runDigestBefore !== previousRun || event.stateDigestBefore !== previousState) {
      throw new Error(`Continuity event ${event.eventId} does not begin from the previous committed state.`);
    }
    if (event.revisionBefore !== revision) throw new Error(`Continuity event ${event.eventId} has a stale revisionBefore.`);
    const expectedAfter = event.status === "accepted" ? revision + 1 : revision;
    if (event.revisionAfter !== expectedAfter) throw new Error(`Continuity event ${event.eventId} has an invalid revision transition.`);
    if (event.status === "refused"
      && (event.runDigestAfter !== event.runDigestBefore || event.stateDigestAfter !== event.stateDigestBefore)) {
      throw new Error(`Refused continuity event ${event.eventId} changed committed state.`);
    }
    previousEventId = event.eventId;
    previousRun = event.runDigestAfter;
    previousState = event.stateDigestAfter;
    revision = event.revisionAfter;
  }

  if (state.snapshot.eventHead !== previousEventId) throw new Error("Continuity snapshot eventHead does not match the event chain.");
  if (state.events.length > 0 && state.snapshot.runDigest !== previousRun) throw new Error("Continuity snapshot run digest is stale.");
  if (state.events.length > 0 && state.snapshot.stateDigest !== previousState) throw new Error("Continuity snapshot state digest is stale.");
  if (state.events.length > 0 && state.snapshot.clock.revision !== revision) {
    throw new Error("Continuity snapshot revision is stale.");
  }
  if (state.events.some((event) => event.tick > state.snapshot.clock.tick)) {
    throw new Error("Continuity event occurs after the snapshot clock.");
  }
  return state;
}

export function appendValidatedContinuityEvent(
  state: ContinuityStateV1,
  snapshot: WorldSnapshotV1,
  event: WorldEventV1,
): ContinuityStateV1 {
  const tail = state.events.at(-1) ?? null;
  if (event.previousEventId !== (tail?.eventId ?? null)) throw new Error("Appended continuity event breaks the event chain.");
  if (snapshot.eventHead !== event.eventId) throw new Error("Appended continuity snapshot does not point at the new event.");
  if (snapshot.runDigest !== event.runDigestAfter || snapshot.stateDigest !== event.stateDigestAfter) {
    throw new Error("Appended continuity snapshot does not carry the event result.");
  }
  return { format: CONTINUITY_STATE_FORMAT, snapshot, events: [...state.events, event] };
}

export function appendContinuityEvent(
  state: ContinuityStateV1,
  snapshot: WorldSnapshotV1,
  event: WorldEventV1,
): ContinuityStateV1 {
  const validated = assertContinuityState(state);
  const next = appendValidatedContinuityEvent(validated, snapshot, event);
  return assertContinuityState(next);
}
