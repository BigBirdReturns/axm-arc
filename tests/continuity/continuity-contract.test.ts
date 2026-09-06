import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/engine/cartridge-digest.js";
import { normalizePortableRunExtensions } from "../../src/engine/portable-run.js";
import {
  CONTINUITY_EXTENSION_KEY,
  adjudicateProposal,
  assertContinuityState,
  buildActionProposal,
  buildActorObservation,
  canonicalContinuityJson,
  continuityDigest,
  createContinuityState,
  createWorldSnapshot,
  runContinuitySchedule,
  runContinuityTick,
  type ActorObservationV1,
  type ActorViewV1,
  type ActorSeatV1,
  type ContinuityHostV1,
  type ContinuityJson,
  type ContinuityStateV1,
  type WorldSnapshotV1,
} from "../../src/continuity/index.js";

const CART = "cart1_" + "a".repeat(64);

interface DistrictState {
  water: number;
  reservoir: number;
  notices: number;
  actors: Record<string, { location: string }>;
}

function jsonState(state: DistrictState): ContinuityJson {
  return state as unknown as ContinuityJson;
}

function runDigest(state: DistrictState): string {
  return "run3_" + sha256Hex(canonicalContinuityJson(jsonState(state)));
}

function initialDistrict(): DistrictState {
  return {
    water: 4,
    reservoir: 0,
    notices: 0,
    actors: {
      anja: { location: "school" },
      sivek: { location: "archive" },
    },
  };
}

function cloneDistrict(state: DistrictState): DistrictState {
  return JSON.parse(JSON.stringify(state)) as DistrictState;
}

function initialSnapshot(state: DistrictState): WorldSnapshotV1 {
  return createWorldSnapshot({
    cartridgeDigest: CART,
    runDigest: runDigest(state),
    state: jsonState(state),
    mode: "bounded-autonomous",
  });
}

class DistrictHost implements ContinuityHostV1 {
  applyCalls = 0;

  constructor(public state: DistrictState) {}

  observe(_snapshot: WorldSnapshotV1, actorId: string): ActorViewV1 {
    if (actorId === "anja") {
      return {
        visible: {
          location: this.state.actors.anja!.location,
          water: this.state.water,
          reservoir: this.state.reservoir,
        },
        affordances: [
          ...(this.state.water > 0 ? [{ id: "move-water", arguments: { amount: 1 } }] : []),
          { id: "post-notice", arguments: { subject: "water" } },
          { id: "wait", arguments: null },
        ],
      };
    }
    return {
      visible: {
        location: this.state.actors.sivek!.location,
        notices: this.state.notices,
      },
      affordances: [{ id: "wait", arguments: null }],
    };
  }

  preflight(_snapshot: WorldSnapshotV1, proposal: Parameters<ContinuityHostV1["preflight"]>[1]) {
    if (proposal.actionId === "move-water") {
      return this.state.water > 0
        ? { allowed: true, reason: "water-available" }
        : { allowed: false, reason: "water-empty" };
    }
    if (proposal.actionId === "post-notice" || proposal.actionId === "wait") {
      return { allowed: true, reason: "lawful" };
    }
    return { allowed: false, reason: "unknown-action" };
  }

  apply(_snapshot: WorldSnapshotV1, proposal: Parameters<ContinuityHostV1["apply"]>[1]) {
    this.applyCalls += 1;
    if (proposal.actionId === "move-water") {
      this.state.water -= 1;
      this.state.reservoir += 1;
    } else if (proposal.actionId === "post-notice") {
      this.state.notices += 1;
    }
    return {
      runDigest: runDigest(this.state),
      stateDigest: continuityDigest("state1_", jsonState(this.state)),
      effects: { action: proposal.actionId, water: this.state.water, reservoir: this.state.reservoir },
    };
  }
}

const stewardSeat: ActorSeatV1 = (observation) => {
  const actionId = observation.affordances.some((entry) => entry.id === "move-water")
    ? "move-water"
    : "wait";
  const affordance = observation.affordances.find((entry) => entry.id === actionId)!;
  return buildActionProposal({
    observation,
    actionId,
    arguments: affordance.arguments ?? null,
    seat: { kind: "deterministic-policy", provider: "axm", model: "steward/v1" },
  });
};

const chroniclerSeat: ActorSeatV1 = (observation) => {
  const actionId = observation.affordances.some((entry) => entry.id === "post-notice")
    ? "post-notice"
    : "wait";
  const affordance = observation.affordances.find((entry) => entry.id === actionId)!;
  return buildActionProposal({
    observation,
    actionId,
    arguments: affordance.arguments ?? null,
    seat: { kind: "local-model", provider: "llama.cpp", model: "replacement-seat" },
    utterance: actionId === "post-notice" ? "The water ledger changed." : null,
  });
};

describe("Gate 8 continuity contract", () => {
  it("binds observations and proposals to one exact snapshot before host mutation", () => {
    const world = initialDistrict();
    const host = new DistrictHost(world);
    const snapshot = initialSnapshot(world);
    const observation = buildActorObservation(snapshot, "anja", host.observe(snapshot, "anja"));
    const proposal = buildActionProposal({
      observation,
      actionId: "move-water",
      arguments: { amount: 1 },
      seat: { kind: "local-model", provider: "llama.cpp", model: "qwen-test" },
    });
    const result = adjudicateProposal({ snapshot, observation, proposal, host });

    expect(result.event.status).toBe("accepted");
    expect(result.event.revisionBefore).toBe(0);
    expect(result.event.revisionAfter).toBe(1);
    expect(result.snapshot.clock.revision).toBe(1);
    expect(world).toMatchObject({ water: 3, reservoir: 1 });
    expect(result.event.proposalDigest).toBe(proposal.proposalDigest);
    expect(result.snapshot.eventHead).toBe(result.event.eventId);
  });

  it("refuses stale or unobserved acts before the host reducer runs", () => {
    const world = initialDistrict();
    const host = new DistrictHost(world);
    const snapshot = initialSnapshot(world);
    const observation = buildActorObservation(snapshot, "sivek", host.observe(snapshot, "sivek"));
    const forged = buildActionProposal({
      observation,
      actionId: "move-water",
      arguments: { amount: 1 },
      seat: { kind: "remote-model", provider: "test", model: "forger" },
    });
    const refusal = adjudicateProposal({ snapshot, observation, proposal: forged, host });
    expect(refusal.event.status).toBe("refused");
    expect(refusal.event.reason).toBe("continuity/action-not-observed");
    expect(host.applyCalls).toBe(0);
    expect(world).toEqual(initialDistrict());

    const staleSnapshot = { ...snapshot, clock: { ...snapshot.clock, tick: 1 } };
    const stale = adjudicateProposal({ snapshot: staleSnapshot, observation, proposal: forged, host });
    expect(stale.event.reason).toBe("continuity/stale-tick");
    expect(host.applyCalls).toBe(0);
  });

  it("refuses arguments that were not inside the actor's observation", () => {
    const world = initialDistrict();
    const host = new DistrictHost(world);
    const snapshot = initialSnapshot(world);
    const observation = buildActorObservation(snapshot, "anja", host.observe(snapshot, "anja"));
    const proposal = buildActionProposal({
      observation,
      actionId: "move-water",
      arguments: { amount: 4 },
      seat: { kind: "local-model", model: "overreach" },
    });
    const result = adjudicateProposal({ snapshot, observation, proposal, host });
    expect(result.event.status).toBe("refused");
    expect(result.event.reason).toBe("continuity/arguments-not-observed");
    expect(host.applyCalls).toBe(0);
  });

  it("rejects tampered proposal bytes rather than recording them as a lawful refusal", () => {
    const world = initialDistrict();
    const host = new DistrictHost(world);
    const snapshot = initialSnapshot(world);
    const observation = buildActorObservation(snapshot, "anja", host.observe(snapshot, "anja"));
    const proposal = buildActionProposal({ observation, actionId: "wait", seat: { kind: "human" } });
    const tampered = { ...proposal, actionId: "move-water" };
    expect(() => adjudicateProposal({ snapshot, observation, proposal: tampered, host })).toThrow(/digest mismatch/i);
    expect(host.applyCalls).toBe(0);
  });

  it("leaves the world unchanged when an actor seat dies before proposing", async () => {
    const world = initialDistrict();
    const host = new DistrictHost(world);
    const state = createContinuityState(initialSnapshot(world));
    const before = JSON.stringify(state);
    const deadSeat: ActorSeatV1 = () => { throw new Error("model process died"); };

    await expect(runContinuityTick({ state, actorId: "anja", seat: deadSeat, host }))
      .rejects.toThrow(/model process died/);
    expect(JSON.stringify(state)).toBe(before);
    expect(world).toEqual(initialDistrict());
    expect(host.applyCalls).toBe(0);
  });

  it("detects event-ledger tampering independently of the model seat", async () => {
    const world = initialDistrict();
    const host = new DistrictHost(world);
    const initial = createContinuityState(initialSnapshot(world));
    const result = await runContinuityTick({ state: initial, actorId: "anja", seat: stewardSeat, host });
    expect(assertContinuityState(result.state)).toEqual(result.state);
    const tampered = JSON.parse(JSON.stringify(result.state)) as ContinuityStateV1;
    tampered.events[0]!.reason = "model said so";
    expect(() => assertContinuityState(tampered)).toThrow(/digest mismatch/i);
  });

  it("fits inside the existing portable-run extension seam without reinterpretation", () => {
    const world = initialDistrict();
    const state = createContinuityState(initialSnapshot(world));
    const extensions = normalizePortableRunExtensions({
      [CONTINUITY_EXTENSION_KEY]: state as unknown as ContinuityJson,
      "future.other-player@7": { untouched: [1, true, "yes"] },
    });
    expect(extensions[CONTINUITY_EXTENSION_KEY]).toEqual(state);
    expect(extensions["future.other-player@7"]).toEqual({ untouched: [1, true, "yes"] });
  });

  it("runs ten thousand bounded ticks with one content-bound event chain", async () => {
    const world = initialDistrict();
    const host = new DistrictHost(world);
    const initial = createContinuityState(initialSnapshot(world));
    const result = await runContinuitySchedule({
      state: initial,
      actorIds: ["anja", "sivek"],
      ticks: 10_000,
      seatFor: () => stewardSeat,
      host,
    });
    expect(result.events).toHaveLength(10_000);
    expect(result.state.snapshot.clock.tick).toBe(10_000);
    expect(result.state.snapshot.clock.revision).toBe(10_000);
    expect(result.state.events.at(-1)?.eventId).toBe(result.state.snapshot.eventHead);
    expect(assertContinuityState(result.state)).toEqual(result.state);
    expect(world).toMatchObject({ water: 0, reservoir: 4 });
  }, 30_000);

  it("replaces a model seat after a checkpoint without rewriting prior world history", async () => {
    const world = initialDistrict();
    const host = new DistrictHost(world);
    const initial = createContinuityState(initialSnapshot(world));
    const prefix = await runContinuitySchedule({
      state: initial,
      actorIds: ["anja", "sivek"],
      ticks: 50,
      seatFor: () => stewardSeat,
      host,
    });
    const checkpointState = JSON.stringify(prefix.state);
    const checkpointWorld = cloneDistrict(world);

    const swapped = await runContinuitySchedule({
      state: prefix.state,
      actorIds: ["anja", "sivek"],
      ticks: 50,
      seatFor: (actorId) => actorId === "anja" ? chroniclerSeat : stewardSeat,
      host,
    });

    const restartedHost = new DistrictHost(cloneDistrict(checkpointWorld));
    const restartedState = JSON.parse(checkpointState) as ContinuityStateV1;
    const resumed = await runContinuitySchedule({
      state: restartedState,
      actorIds: ["anja", "sivek"],
      ticks: 50,
      seatFor: (actorId) => actorId === "anja" ? chroniclerSeat : stewardSeat,
      host: restartedHost,
    });

    expect(resumed.state.snapshot).toEqual(swapped.state.snapshot);
    expect(resumed.events.map((event) => event.eventId)).toEqual(swapped.events.map((event) => event.eventId));
    expect(restartedHost.state).toEqual(host.state);

    const baselineWorld = initialDistrict();
    const baseline = await runContinuitySchedule({
      state: createContinuityState(initialSnapshot(baselineWorld)),
      actorIds: ["anja", "sivek"],
      ticks: 100,
      seatFor: () => stewardSeat,
      host: new DistrictHost(baselineWorld),
    });
    expect(baseline.events.slice(0, 50).map((event) => event.eventId))
      .toEqual(prefix.events.map((event) => event.eventId));
    expect(baseline.events.slice(50).map((event) => event.eventId))
      .not.toEqual(swapped.events.map((event) => event.eventId));
    expect(swapped.state.events.slice(0, 50).map((event) => event.eventId))
      .toEqual(prefix.events.map((event) => event.eventId));
  });
});
