import { describe, expect, it } from "vitest";
import { validateArc } from "../../src/engine/schema.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { foundOrganization } from "../../src/engine/founding.js";
import { buildPortableRun, parsePortableRun } from "../../src/engine/portable-run.js";
import {
  buildStrategyBoardRuntimeRun,
  parseRuntimeRun,
  runtimeRunPayloadDigest,
  strategyStateDigest,
  type RuntimeRunV1,
} from "../../src/engine/runtime-run.js";
import {
  RUNTIME_FAMILY_EXTENSION_KEY,
  RUNTIME_FAMILY_FORMAT,
} from "../../src/engine/runtime-family.js";
import type { StrategyInput } from "../../src/engine/strategy-board/index.js";
import { DISPATCH_RUNTIME_ARC } from "../fixtures/runtime-family-arc.js";
import {
  STRATEGY_BOARD_TEST_PROGRAM,
  strategyBoardProgramExtension,
} from "../fixtures/strategy-board-program.js";

const strategyArc = validateArc({
  ...structuredClone(DISPATCH_RUNTIME_ARC),
  meta: { ...DISPATCH_RUNTIME_ARC.meta, id: "runtime-run-board", name: "Runtime Run Board" },
  extensions: {
    [RUNTIME_FAMILY_EXTENSION_KEY]: { format: RUNTIME_FAMILY_FORMAT, family: "strategy-board" },
    ...strategyBoardProgramExtension(),
  },
});
const TRACE: StrategyInput[] = [
  { type: "advance" },
  { type: "advance", destinationSpaceId: "market" },
  { type: "action", seatId: "seat-1", kind: "purchase", refId: "lease" },
  { type: "action", seatId: "seat-1", kind: "programAction", refId: "invest" },
  { type: "action", seatId: "seat-2", kind: "pass", refId: null },
  { type: "advance" },
  { type: "advance" },
];

function build() {
  return buildStrategyBoardRuntimeRun({
    arc: strategyArc,
    seatIds: ["seat-1", "seat-2"],
    inputs: TRACE,
    extensions: {
      "holder.notes@9": { retained: [null, true, 7, "exact"] },
    },
  });
}

function rebind(run: RuntimeRunV1): RuntimeRunV1 {
  const core = {
    format: run.format,
    authoredArcDigest: run.authoredArcDigest,
    arc: run.arc,
    runtime: run.runtime,
    extensions: run.extensions,
  };
  run.integrity.digest = runtimeRunPayloadDigest(core);
  return run;
}

describe("portable runtime-run v1", () => {
  it("round-trips a Strategy Board trace and recomputes the exact state", () => {
    const run = build();
    expect(run.format).toBe("axm-runtime-run/v1");
    expect(run.authoredArcDigest).toBe(cartridgeDigest(strategyArc));
    expect(run.runtime.family).toBe("strategy-board");
    expect(run.runtime.stateDigest).toMatch(/^sstate1_[0-9a-f]{64}$/);
    expect(run.integrity.digest).toMatch(/^rr1_[0-9a-f]{64}$/);

    const restored = parseRuntimeRun(JSON.stringify(run));
    expect(restored.run).toEqual(run);
    expect(restored.state.execution.positions).toEqual({ "seat-1": "market", "seat-2": "home" });
    expect(restored.state.ownership.lease).toBe("seat-1");
    expect(restored.state.seats[0]!.balances).toEqual({ coin: 7, standing: 1 });
    expect(restored.state.phase).toBe("quarterStart");
    expect(restored.state.activeSeatIndex).toBe(1);
    expect(strategyStateDigest(restored.state)).toBe(run.runtime.stateDigest);
    expect(restored.extensions).toEqual(run.extensions);
  });

  it("rejects exact-byte payload tampering before replay", () => {
    const run = build();
    run.runtime.inputs[1] = { type: "advance", destinationSpaceId: "home" };
    expect(() => parseRuntimeRun(run)).toThrow(/integrity mismatch/i);
  });

  it("binds the trace to cart1 even when outer integrity is recomputed", () => {
    const run = build();
    run.arc.meta.name = "Changed law identity";
    rebind(run);
    expect(() => parseRuntimeRun(run)).toThrow(/cartridge digest mismatch/i);
  });
  it("rejects a trace that is structurally valid but illegal under Arc law", () => {
    const run = build();
    run.runtime.inputs[2] = {
      type: "action", seatId: "seat-2", kind: "purchase", refId: "lease",
    };
    run.runtime.stateDigest = "sstate1_" + "0".repeat(64);
    rebind(run);
    expect(() => parseRuntimeRun(run)).toThrow(/wrong actor|illegal action/i);
  });

  it("rejects ignored extras, malformed movement, and malformed bids", () => {
    const extra = build() as unknown as Record<string, any>;
    extra.runtime.inputs[0].screen = "board";
    rebind(extra as RuntimeRunV1);
    expect(() => parseRuntimeRun(extra)).toThrow(/fields must be exactly/i);

    const movement = build() as unknown as Record<string, any>;
    movement.runtime.inputs[1].destinationSpaceId = "";
    rebind(movement as RuntimeRunV1);
    expect(() => parseRuntimeRun(movement)).toThrow(/movement destination/i);

    const bids = build() as unknown as Record<string, any>;
    bids.runtime.inputs[2] = {
      type: "action", seatId: "seat-1", kind: "auction", refId: "none",
      bids: [{ seatId: "seat-1", amount: 1.5 }],
    };
    rebind(bids as RuntimeRunV1);
    expect(() => parseRuntimeRun(bids)).toThrow(/bids\[0\].*invalid/i);
  });
  it("rejects a recomputed outer digest when the claimed final state is false", () => {
    const run = build();
    run.runtime.stateDigest = "sstate1_" + "f".repeat(64);
    rebind(run);
    expect(() => parseRuntimeRun(run)).toThrow(/state digest mismatch/i);
  });

  it("preserves unknown JSON extension namespaces", () => {
    const restored = parseRuntimeRun(build());
    expect(restored.extensions["holder.notes@9"]).toEqual({
      retained: [null, true, 7, "exact"],
    });
  });

  it("does not alter portable-run v3 behavior", () => {
    const org = foundOrganization(DISPATCH_RUNTIME_ARC, {
      format: "axm-founding-input/1",
      seed: 41,
    });
    const v3 = buildPortableRun({
      arc: DISPATCH_RUNTIME_ARC,
      org,
      extensions: { "other.runtime@3": { opaque: true } },
    });
    expect(v3.format).toBe("axm-cartridge-run/v3");
    expect(parsePortableRun(JSON.stringify(v3)).run).toEqual(v3);
  });
});
