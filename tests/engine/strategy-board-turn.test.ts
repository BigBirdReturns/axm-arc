// Strategy Board turn machine — NON-BEHAVIORAL scaffold tests.
//
// Proves the enumeration-side invariants of the turn machine without any
// resolution: deterministic initial state, phase-valid legal actions, rejection
// of illegal actions, enumeration mutates nothing (no ledger change without an
// event), and no action listed without a named resolver. See
// docs/design/STRATEGY_BOARD_TURN_MACHINE_DECISION.md.

import { describe, expect, it } from "vitest";
import {
  loadProgramOfRecordMini,
  initialStrategyState,
  listLegalActions,
  isActionLegal,
  PHASE_ORDER,
  CHOICE_PHASES,
  type StrategyPhase,
  type LegalAction,
} from "../../src/engine/strategy-board";

const def = loadProgramOfRecordMini();
const SEATS = ["seat-a", "seat-b"];
const LEGAL_EVENT_KINDS = new Set([
  "income", "purchase", "auctionSettlement", "tollPayment", "obligationSettlement",
  "programActionCost", "programActionYield", "interferenceCost", "milestoneReward",
]);

const stateIn = (phase: StrategyPhase) => ({ ...initialStrategyState(def, SEATS), phase });

describe("deterministic initial strategy state", () => {
  it("two builds are deep-equal (seed-free)", () => {
    expect(initialStrategyState(def, SEATS)).toEqual(initialStrategyState(def, SEATS));
  });
  it("balances come from each seat's assigned doctrine; assets start unowned", () => {
    const s = initialStrategyState(def, SEATS);
    expect(s.phase).toBe("quarterStart");
    expect(s.quarter).toBe(1);
    // seat-a -> doctrines[0] (PRIME): capital 5, influence 1
    expect(s.seats[0]!.doctrineId).toBe(def.doctrines[0]!.id);
    expect(s.seats[0]!.balances.capital).toBe(5);
    expect(s.seats[0]!.balances.influence).toBe(1);
    // every asset present and unowned
    for (const a of def.controlAssets) expect(s.ownership[a.id]).toBeNull();
  });
});

describe("legal actions are phase-valid", () => {
  it("every listed action's honoredByPhase equals the current phase", () => {
    for (const phase of PHASE_ORDER) {
      const actions = listLegalActions(def, stateIn(phase));
      for (const a of actions) expect(a.honoredByPhase).toBe(phase);
    }
  });
  it("only the three choice phases surface any actions", () => {
    for (const phase of PHASE_ORDER) {
      const actions = listLegalActions(def, stateIn(phase));
      if (CHOICE_PHASES.has(phase)) expect(actions.length).toBeGreaterThan(0);
      else expect(actions).toHaveLength(0);
    }
  });
  it("programAction lists only doctrine-permitted actions", () => {
    const actions = listLegalActions(def, stateIn("programAction"));
    const listed = new Set(actions.map((a) => a.refId));
    // seat-a is PRIME, permitted: act-consolidate, act-pressure
    expect(listed).toEqual(new Set(["act-consolidate", "act-pressure"]));
  });
});

describe("illegal actions are rejected", () => {
  it("an action valid in one phase is rejected in another", () => {
    const buy: Pick<LegalAction, "kind" | "refId"> = { kind: "programAction", refId: "act-pressure" };
    expect(isActionLegal(def, stateIn("programAction"), buy)).toBe(true);
    expect(isActionLegal(def, stateIn("buyAuctionPass"), buy)).toBe(false);
  });
  it("an action a doctrine does not permit is rejected", () => {
    // Make the active seat DECENTRALIZED (permits only act-consolidate).
    const s = { ...stateIn("programAction") };
    s.seats = s.seats.map((seat, i) => (i === s.activeSeatIndex ? { ...seat, doctrineId: "DECENTRALIZED" } : seat));
    expect(isActionLegal(def, s, { kind: "programAction", refId: "act-consolidate" })).toBe(true);
    expect(isActionLegal(def, s, { kind: "programAction", refId: "act-pressure" })).toBe(false);
  });
  it("an unknown ref is rejected", () => {
    expect(isActionLegal(def, stateIn("programAction"), { kind: "programAction", refId: "ghost" })).toBe(false);
  });
});

describe("no ledger mutation without an explicit event", () => {
  it("enumeration mutates neither the state nor the definition", () => {
    const s = stateIn("programAction");
    const before = JSON.stringify(s);
    const defBefore = JSON.stringify(def);
    listLegalActions(def, s);
    expect(JSON.stringify(s)).toBe(before);
    expect(JSON.stringify(def)).toBe(defBefore);
  });
  it("every declared mutation on a listed action carries a legal event kind", () => {
    for (const phase of CHOICE_PHASES) {
      for (const a of listLegalActions(def, stateIn(phase))) {
        for (const m of a.declaredMutations) expect(LEGAL_EVENT_KINDS.has(m.eventKind)).toBe(true);
      }
    }
  });
});

describe("no action is listed without a named resolver", () => {
  it("every listed action names a non-empty future resolver", () => {
    for (const phase of CHOICE_PHASES) {
      const actions = listLegalActions(def, stateIn(phase));
      for (const a of actions) {
        expect(typeof a.resolver).toBe("string");
        expect(a.resolver.length).toBeGreaterThan(0);
      }
    }
  });
});
