// Strategy Board turn machine — NON-BEHAVIORAL scaffold.
//
// Phase vocabulary, turn-state type, legal-action type, deterministic initial
// state, and a PURE `listLegalActions` enumerator. This resolves NOTHING: no
// executor, no phase advance, no movement, no auction/interference/milestone
// resolution, no income/toll/obligation settlement, no opponent AI. See
// docs/design/STRATEGY_BOARD_TURN_MACHINE_DECISION.md.
//
// Two invariants are honored by construction:
//   - enumeration mutates nothing (no ledger change without a recorded event);
//   - no action is listed without a named future resolver (no choice the runtime
//     cannot honor — the sovereignty rule).

import type {
  StrategyBoardDefinition,
  StrategyPhase,
  ResourceLedgerMutation,
} from "./types";

/** Canonical phase order (see the decision memo §1). */
export const PHASE_ORDER: readonly StrategyPhase[] = [
  "quarterStart",
  "movementResolution",
  "buyAuctionPass",
  "programAction",
  "reactionInterference",
  "milestoneAttempt",
  "receiptLedger",
] as const;

/** The three phases in which a seat makes a choice. The rest are resolver-driven. */
export const CHOICE_PHASES: ReadonlySet<StrategyPhase> = new Set<StrategyPhase>([
  "buyAuctionPass",
  "programAction",
  "reactionInterference",
]);

export interface SeatState {
  seatId: string;
  doctrineId: string;
  /** resourceId -> balance. Every resource in the definition is present. */
  balances: Record<string, number>;
}

/** The turn machine's state. Plain data; the scaffold never mutates it. */
export interface TurnState {
  boardId: string;
  quarter: number;
  phase: StrategyPhase;
  /** Index into `seats` of the active seat. */
  activeSeatIndex: number;
  seats: SeatState[];
  /** assetId -> owning seatId, or null when unowned. */
  ownership: Record<string, string | null>;
}

export type LegalActionKind = "programAction" | "auction" | "interference" | "pass";

/** A choice legal in the current phase. Carries the phase that will honor it and
 *  the NAME of the future resolver — a choice with no resolver is not emitted. */
export interface LegalAction {
  kind: LegalActionKind;
  /** Authored object id (action/auction/interference), or null for `pass`. */
  refId: string | null;
  honoredByPhase: StrategyPhase;
  /** Name of the future resolver that will honor this choice. Never empty. */
  resolver: string;
  /** The resource cost the choice would incur; each mutation names a ledger
   *  event kind. Empty for choices whose cost is determined at resolution
   *  (e.g. an auction bid) or that cost nothing (`pass`). */
  declaredMutations: ResourceLedgerMutation[];
}

/** Deterministic, seed-free initial state. Doctrines are assigned to seats by
 *  index (round-robin over the authored doctrines); balances come from the
 *  assigned doctrine's startingResources with every resource defaulted to 0;
 *  all assets start unowned. Same inputs -> byte-identical state. */
export function initialStrategyState(
  def: StrategyBoardDefinition,
  seatIds: string[],
): TurnState {
  if (def.doctrines.length === 0) throw new Error("definition has no doctrines");
  const { min, max } = def.seatCountRange;
  if (seatIds.length < min || seatIds.length > max) {
    throw new Error(
      `seat count ${seatIds.length} out of range [${min}, ${max}]`,
    );
  }
  const seats: SeatState[] = seatIds.map((seatId, i) => {
    const doctrine = def.doctrines[i % def.doctrines.length]!;
    const balances: Record<string, number> = {};
    for (const r of def.resources) balances[r.id] = 0;
    for (const sr of doctrine.startingResources) balances[sr.resourceId] = sr.amount;
    return { seatId, doctrineId: doctrine.id, balances };
  });
  const ownership: Record<string, string | null> = {};
  for (const a of def.controlAssets) ownership[a.id] = null;
  return { boardId: def.id, quarter: 1, phase: "quarterStart", activeSeatIndex: 0, seats, ownership };
}

/** Enumerate the choices legal for the active seat in the current phase. PURE:
 *  reads (def, state), returns a list, mutates nothing, resolves nothing. Returns
 *  [] for resolver-driven phases (quarterStart / movementResolution /
 *  milestoneAttempt / receiptLedger). */
export function listLegalActions(def: StrategyBoardDefinition, state: TurnState): LegalAction[] {
  const active = state.seats[state.activeSeatIndex];
  if (!active) return [];

  switch (state.phase) {
    case "programAction": {
      const doctrine = def.doctrines.find((d) => d.id === active.doctrineId);
      const permitted = new Set(doctrine?.permittedActionIds ?? []);
      const out: LegalAction[] = [];
      for (const a of def.programActions) {
        if (!permitted.has(a.id)) continue;
        out.push({
          kind: "programAction",
          refId: a.id,
          honoredByPhase: "programAction",
          resolver: "resolveProgramAction",
          declaredMutations: [...a.cost],
        });
      }
      return out;
    }
    case "buyAuctionPass": {
      const out: LegalAction[] = def.auctions.map((au) => ({
        kind: "auction" as const,
        refId: au.id,
        honoredByPhase: "buyAuctionPass" as StrategyPhase,
        resolver: "resolveAuction",
        declaredMutations: [],
      }));
      out.push({ kind: "pass", refId: null, honoredByPhase: "buyAuctionPass", resolver: "resolvePass", declaredMutations: [] });
      return out;
    }
    case "reactionInterference": {
      const out: LegalAction[] = def.interferences.map((itf) => ({
        kind: "interference" as const,
        refId: itf.id,
        honoredByPhase: "reactionInterference" as StrategyPhase,
        resolver: "resolveInterference",
        declaredMutations: [...itf.cost],
      }));
      out.push({ kind: "pass", refId: null, honoredByPhase: "reactionInterference", resolver: "resolvePass", declaredMutations: [] });
      return out;
    }
    default:
      // quarterStart, movementResolution, milestoneAttempt, receiptLedger:
      // resolver-driven, no player choice.
      return [];
  }
}

/** Whether `candidate` is among the actions legal in the current phase/state.
 *  Matches on (kind, refId). Pure; used to reject illegal actions. */
export function isActionLegal(
  def: StrategyBoardDefinition,
  state: TurnState,
  candidate: Pick<LegalAction, "kind" | "refId">,
): boolean {
  return listLegalActions(def, state).some(
    (a) => a.kind === candidate.kind && a.refId === candidate.refId,
  );
}
