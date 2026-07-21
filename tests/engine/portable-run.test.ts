import { describe, expect, it } from "vitest";
import {
  buildPortableRun,
  isPortableRunV3,
  parsePortableRun,
  portableRunPayloadDigest,
  type PortableRunV3,
} from "../../src/engine/portable-run.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { SAVE_VERSION } from "../../src/engine/save.js";
import { FIRST_CHARTER } from "../../src/arcs/first-charter.js";
import { foundOrganization } from "../../src/engine/founding.js";
import type { PendingRewardChoice } from "../../src/engine/cycle.js";

function fixture() {
  const org = foundOrganization(FIRST_CHARTER, { format: "axm-founding-input/1", seed: 424242 });
  const agentId = Object.keys(org.agents)[0]!;
  const pendingRewardChoices: PendingRewardChoice[] = [{
    itemId: "rusty-blade",
    eligibleAgentIds: [agentId],
    sourceChallenge: "cellar",
    cycle: org.cycle,
  }];
  return { org, pendingRewardChoices };
}

function reseal(run: PortableRunV3): PortableRunV3 {
  const core = {
    format: run.format,
    authoredArcDigest: run.authoredArcDigest,
    arc: run.arc,
    engine: run.engine,
    extensions: run.extensions,
  };
  return {
    ...run,
    integrity: { ...run.integrity, digest: portableRunPayloadDigest(core) },
  };
}

describe("axm-cartridge-run/v3", () => {
  it("round-trips exact engine state, pending choices, and unknown client extensions", () => {
    const { org, pendingRewardChoices } = fixture();
    org.unlockedProgressionTiers = ["earned-tier"];
    const run = buildPortableRun({
      arc: FIRST_CHARTER,
      org,
      pendingRewardChoices,
      extensions: {
        "rodoh.ledger@2": { version: 2, entries: [{ seq: 0, outcome: "partial" }] },
        "future-player.private-state@7": { opaque: [true, 3, "kept"] },
      },
    });

    expect(run.authoredArcDigest).toBe(cartridgeDigest(FIRST_CHARTER));
    expect(run.engine.saveVersion).toBe(SAVE_VERSION);
    expect(run.integrity.digest).toMatch(/^run3_[0-9a-f]{64}$/);
    expect(isPortableRunV3(JSON.stringify(run))).toBe(true);

    const restored = parsePortableRun(JSON.stringify(run));
    expect(restored.org).toEqual(org);
    expect(restored.pendingRewardChoices).toEqual(pendingRewardChoices);
    expect(restored.extensions).toEqual(run.extensions);
    expect(restored.run).toEqual(run);
  });

  it("refuses any payload mutation before executing the save", () => {
    const { org } = fixture();
    const run = buildPortableRun({ arc: FIRST_CHARTER, org });
    const changed = structuredClone(run);
    changed.extensions["rodoh.view@1"] = { mode: "aperture" };
    expect(() => parsePortableRun(changed)).toThrow(/integrity mismatch/);
  });

  it("recomputes cartridge identity instead of trusting the envelope", () => {
    const { org } = fixture();
    const run = buildPortableRun({ arc: FIRST_CHARTER, org });
    run.authoredArcDigest = `cart1_${"0".repeat(64)}`;
    expect(() => parsePortableRun(reseal(run))).toThrow(/cartridge digest mismatch/);
  });

  it("binds the embedded engine save to the same Arc bytes", () => {
    const { org } = fixture();
    const run = buildPortableRun({ arc: FIRST_CHARTER, org });
    const game = JSON.parse(run.engine.game) as { arcRef: { digest: string } };
    game.arcRef.digest = `cart1_${"f".repeat(64)}`;
    run.engine.game = JSON.stringify(game);
    expect(() => parsePortableRun(reseal(run))).toThrow(/Cartridge digest mismatch/);
  });

  it("rejects disagreement between the envelope and serialized save versions", () => {
    const { org } = fixture();
    const run = buildPortableRun({ arc: FIRST_CHARTER, org });
    run.engine.saveVersion += 1;
    expect(() => parsePortableRun(reseal(run))).toThrow(/save-version mismatch/);
  });

  it("rejects unsupported formats, extra authority fields, and non-JSON extensions", () => {
    const { org } = fixture();
    const run = buildPortableRun({ arc: FIRST_CHARTER, org });
    expect(isPortableRunV3({ format: "something-else" })).toBe(false);
    expect(() => parsePortableRun({ ...run, format: "axm-cartridge-run/v4" })).toThrow(/Unsupported portable run format/);
    expect(() => parsePortableRun({ ...run, trust: "verified" })).toThrow(/fields must be exactly/);
    expect(() => buildPortableRun({
      arc: FIRST_CHARTER,
      org,
      extensions: { "bad@1": { value: undefined } as never },
    })).toThrow(/not JSON-compatible/);
  });
});
