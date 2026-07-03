// Strategy Board Runtime — schema scaffold tests.
//
// Proves the SHAPE contract of an authored strategy board, not any behavior.
// The invariants under test are the ones that keep a future runtime honest:
// legal space types, fully-declared actions/assets/milestones, every resource
// mutation carried as a ledger event, and every player-facing choice naming the
// phase that will honor it. Plus rejection tests so the schema actually bites.

import { describe, expect, it } from "vitest";
import {
  validateStrategyBoard,
  loadProgramOfRecordMini,
  PROGRAM_OF_RECORD_MINI,
  type StrategyLedgerEventKind,
  type ResourceLedgerMutation,
} from "../../src/engine/strategy-board";

const LEGAL_SPACE_TYPES = new Set(["start", "asset", "auction", "hazard", "milestone", "neutral"]);
const LEGAL_EVENT_KINDS = new Set<StrategyLedgerEventKind>([
  "income", "purchase", "auctionSettlement", "tollPayment", "obligationSettlement",
  "programActionCost", "programActionYield", "interferenceCost", "milestoneReward",
]);

/** Every ResourceLedgerMutation in the definition, wherever it lives. */
function allMutations(def = PROGRAM_OF_RECORD_MINI): ResourceLedgerMutation[] {
  return [
    ...def.programActions.flatMap((a) => [...a.cost, ...a.effect.mutations]),
    ...def.interferences.flatMap((i) => [...i.cost, ...i.effect.mutations]),
    ...def.milestones.flatMap((m) => m.reward.mutations),
  ];
}

describe("strategy-board schema accepts the mini fixture", () => {
  it("validates without throwing", () => {
    expect(() => validateStrategyBoard(PROGRAM_OF_RECORD_MINI)).not.toThrow();
  });
  it("meets the minimum-size brief (tiny, not the 40-space board)", () => {
    expect(PROGRAM_OF_RECORD_MINI.spaces.length).toBeGreaterThanOrEqual(4);
    expect(PROGRAM_OF_RECORD_MINI.spaces.length).toBeLessThanOrEqual(8);
    expect(PROGRAM_OF_RECORD_MINI.resources).toHaveLength(2);
    expect(PROGRAM_OF_RECORD_MINI.controlAssets).toHaveLength(2);
    expect(PROGRAM_OF_RECORD_MINI.programActions).toHaveLength(2);
    expect(PROGRAM_OF_RECORD_MINI.auctions).toHaveLength(1);
    expect(PROGRAM_OF_RECORD_MINI.interferences).toHaveLength(1);
    expect(PROGRAM_OF_RECORD_MINI.milestones).toHaveLength(1);
    expect(PROGRAM_OF_RECORD_MINI.endings).toHaveLength(1);
  });
});

describe("structural invariants", () => {
  it("every board space has a legal type", () => {
    for (const s of PROGRAM_OF_RECORD_MINI.spaces) expect(LEGAL_SPACE_TYPES.has(s.type)).toBe(true);
  });

  it("every action declares cost, effect, and target rules", () => {
    for (const a of PROGRAM_OF_RECORD_MINI.programActions) {
      expect(Array.isArray(a.cost)).toBe(true);
      expect(a.cost.length).toBeGreaterThan(0);
      expect(typeof a.effect.summary).toBe("string");
      expect(Array.isArray(a.effect.mutations)).toBe(true);
      expect(["self", "space", "asset", "seat", "none"]).toContain(a.target);
    }
  });

  it("every control asset declares ownership and effect scope", () => {
    for (const a of PROGRAM_OF_RECORD_MINI.controlAssets) {
      expect(["buyable", "auctionOnly", "fixed"]).toContain(a.ownershipModel);
      expect(["owner", "occupant", "region", "global"]).toContain(a.effectScope);
    }
  });

  it("every milestone declares requirements and an ending consequence", () => {
    for (const m of PROGRAM_OF_RECORD_MINI.milestones) {
      const reqCount = (m.requirements.resourceThresholds?.length ?? 0) + (m.requirements.ownedAssetIds?.length ?? 0);
      expect(reqCount).toBeGreaterThan(0);
      expect(typeof m.contributesToEndingId).toBe("string");
      expect(PROGRAM_OF_RECORD_MINI.endings.map((e) => e.id)).toContain(m.contributesToEndingId);
    }
  });

  it("every resource mutation is declared as a ledger event, not an implicit side effect", () => {
    const muts = allMutations();
    expect(muts.length).toBeGreaterThan(0);
    for (const m of muts) {
      expect(m.eventKind).toBeDefined();
      expect(LEGAL_EVENT_KINDS.has(m.eventKind)).toBe(true);
    }
  });

  it("no player-facing choice object exists without naming the phase that will honor it", () => {
    for (const a of PROGRAM_OF_RECORD_MINI.programActions) expect(a.honoredBy).toBe("programAction");
    for (const au of PROGRAM_OF_RECORD_MINI.auctions) expect(au.honoredBy).toBe("buyAuctionPass");
    for (const i of PROGRAM_OF_RECORD_MINI.interferences) expect(i.honoredBy).toBe("reactionInterference");
  });
});

describe("deterministic fixture load", () => {
  it("two loads are deep-equal", () => {
    expect(loadProgramOfRecordMini()).toEqual(loadProgramOfRecordMini());
  });
  it("the load validates the fixture", () => {
    expect(() => loadProgramOfRecordMini()).not.toThrow();
  });
});

describe("the schema bites (rejection cases)", () => {
  const clone = () => JSON.parse(JSON.stringify(PROGRAM_OF_RECORD_MINI));

  it("rejects an unknown adjacent space", () => {
    const bad = clone();
    bad.spaces[0].adjacentSpaceIds.push("s99");
    expect(() => validateStrategyBoard(bad)).toThrow(/Invalid strategy board/);
  });
  it("rejects an action honored by the wrong phase", () => {
    const bad = clone();
    bad.programActions[0].honoredBy = "quarterStart";
    expect(() => validateStrategyBoard(bad)).toThrow(/honoredBy must be/);
  });
  it("rejects a resource mutation with no event kind", () => {
    const bad = clone();
    delete bad.programActions[0].cost[0].eventKind;
    expect(() => validateStrategyBoard(bad)).toThrow(/Invalid strategy board/);
  });
  it("rejects a milestone with no declared requirement", () => {
    const bad = clone();
    bad.milestones[0].requirements = {};
    expect(() => validateStrategyBoard(bad)).toThrow(/at least one requirement/);
  });
  it("rejects an unknown resourceId in an action cost", () => {
    const bad = clone();
    bad.programActions[0].cost[0].resourceId = "nope";
    expect(() => validateStrategyBoard(bad)).toThrow(/unknown resourceId/);
  });
  it("rejects an auction referencing a missing asset", () => {
    const bad = clone();
    bad.auctions[0].assetId = "ghost";
    expect(() => validateStrategyBoard(bad)).toThrow(/unknown assetId/);
  });
});
