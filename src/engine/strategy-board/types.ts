// Strategy Board Runtime — canonical schema TYPES (scaffold only).
//
// This is the axm-arc-side type surface for the new Strategy Board Runtime
// family (see axm-world docs/runtime/STRATEGY_BOARD_RUNTIME_PROPOSAL.md). It
// defines the SHAPE of an authored strategy-board cartridge and the ledger-event
// vocabulary its resolution will use. It contains NO behavior: no turn machine,
// no movement, no auction execution, no interference resolution, no opponent AI.
// Those land later, arc-first, gated by property tests.
//
// Two invariants are baked into the types so a scaffold cannot lie:
//   1. Every resource change is a declared ledger MUTATION carrying an event
//      kind — never an implicit side effect. (No hidden cost.)
//   2. Every player-facing CHOICE object (program action, auction, interference)
//      names the runtime phase that will honor it. (No UI without a resolver.)

/** The canonical turn phases. Vocabulary only — the turn machine that orders and
 *  runs these is a later, separate arc-first step (Phase 4). Choice objects name
 *  the phase that will honor them, so the sovereignty rule is checkable now. */
export type StrategyPhase =
  | "quarterStart"
  | "movementResolution"
  | "buyAuctionPass"
  | "programAction"
  | "reactionInterference"
  | "milestoneAttempt"
  | "receiptLedger";

/** The kinds of ledger event a resource mutation can be recorded as. Every
 *  mutation MUST name one — this is what makes a run auditable and forbids a
 *  silent debit/credit. */
export type StrategyLedgerEventKind =
  | "income"
  | "purchase"
  | "auctionSettlement"
  | "tollPayment"
  | "obligationSettlement"
  | "programActionCost"
  | "programActionYield"
  | "interferenceCost"
  | "milestoneReward";

/** A single declared change to a seat's resource balance. `eventKind` ties it to
 *  a recordable ledger event — a mutation with no event kind is not expressible. */
export interface ResourceLedgerMutation {
  resourceId: string;
  /** Signed: negative debits the acting seat, positive credits it. */
  delta: number;
  eventKind: StrategyLedgerEventKind;
}

/** The recordable ledger event shape the runtime will emit. Defined here so the
 *  event model is canonical from the start; not populated by the static scaffold. */
export interface StrategyLedgerEvent {
  kind: StrategyLedgerEventKind;
  seatId: string;
  mutations: ResourceLedgerMutation[];
  note: string;
}

export type BoardSpaceType =
  | "start"
  | "asset"
  | "auction"
  | "hazard"
  | "milestone"
  | "neutral";

export interface BoardSpace {
  id: string;
  name: string;
  type: BoardSpaceType;
  region: string;
  /** Adjacency graph — ids of directly reachable spaces. */
  adjacentSpaceIds: string[];
  /** Set iff type is "asset" or "auction": the control asset sited here. */
  assetId?: string;
}

export interface PlayerDoctrine {
  id: string;
  name: string;
  description: string;
  startingResources: { resourceId: string; amount: number }[];
  /** The program actions this doctrine is permitted to take. This is the
   *  declarative doctrine-gating hook the legal-action envelope will read. */
  permittedActionIds: string[];
}

export interface StrategyResource {
  id: string;
  name: string;
  description: string;
}

/** Where a control asset's effect reaches. */
export type AssetEffectScope = "owner" | "occupant" | "region" | "global";

/** How a control asset changes hands. */
export type OwnershipModel = "buyable" | "auctionOnly" | "fixed";

export interface ControlAsset {
  id: string;
  name: string;
  description: string;
  sitedOnSpaceId: string;
  ownershipModel: OwnershipModel;
  effectScope: AssetEffectScope;
  /** List-price acquisition (absent for auctionOnly / fixed). */
  acquisitionCost?: { resourceId: string; amount: number };
  /** Quarter-start income paid to the owner, if any. */
  income?: { resourceId: string; amountPerQuarter: number };
  /** Toll charged on a non-owner occupant, if any. */
  toll?: TollSpec;
}

/** Runtime state: who owns an asset. Defined for the future resolver; the static
 *  scaffold does not instantiate ownership. */
export interface OwnershipState {
  assetId: string;
  ownerSeatId: string | null;
}

export interface TollSpec {
  resourceId: string;
  amount: number;
  /** Canonical trigger — a toll is charged only on a non-owner occupant. */
  chargedWhen: "nonOwnerOccupant";
  eventKind: "tollPayment";
}

export interface ObligationSpec {
  id: string;
  name: string;
  resourceId: string;
  amountPerQuarter: number;
  termQuarters: number;
  eventKind: "obligationSettlement";
}

export type AuctionFormat = "englishAscending" | "sealedBid";

export interface AuctionSpec {
  id: string;
  /** The control asset put up for competitive resolution. */
  assetId: string;
  format: AuctionFormat;
  resourceId: string;
  minIncrement: number;
  /** The phase that will honor this choice. Must be "buyAuctionPass". */
  honoredBy: StrategyPhase;
  eventKind: "auctionSettlement";
}

/** What a program action targets. */
export type ProgramActionTarget = "self" | "space" | "asset" | "seat" | "none";

export interface ProgramAction {
  id: string;
  name: string;
  description: string;
  /** Declared cost — one or more debits, each a ledger mutation. */
  cost: ResourceLedgerMutation[];
  /** Declared effect: a summary plus the mutations it records. */
  effect: { summary: string; mutations: ResourceLedgerMutation[] };
  target: ProgramActionTarget;
  /** The phase that will honor this choice. Must be "programAction". */
  honoredBy: StrategyPhase;
}

export interface InterferenceSpec {
  id: string;
  name: string;
  description: string;
  /** The program actions a non-active seat may interfere with. */
  interferableActionIds: string[];
  cost: ResourceLedgerMutation[];
  effect: { summary: string; mutations: ResourceLedgerMutation[] };
  /** The phase that will honor this choice. Must be "reactionInterference". */
  honoredBy: StrategyPhase;
}

export interface MilestoneSpec {
  id: string;
  name: string;
  description: string;
  /** Non-empty: at least one requirement must be declared. */
  requirements: {
    resourceThresholds?: { resourceId: string; atLeast: number }[];
    ownedAssetIds?: string[];
  };
  /** What clearing it yields. */
  reward: { mutations: ResourceLedgerMutation[]; unlocks: string[] };
  /** The ending this milestone advances. */
  contributesToEndingId: string;
}

export type EndingConditionType =
  | "inevitabilityReached"
  | "evidenceOverwhelms"
  | "timeout";

export interface EndingSpec {
  id: string;
  name: string;
  description: string;
  condition: { type: EndingConditionType; note: string };
  scoringNote: string;
}

/** The top-level authored strategy-board cartridge definition. */
export interface StrategyBoardDefinition {
  id: string;
  name: string;
  description: string;
  seatCountRange: { min: number; max: number };
  spaces: BoardSpace[];
  doctrines: PlayerDoctrine[];
  resources: StrategyResource[];
  controlAssets: ControlAsset[];
  auctions: AuctionSpec[];
  programActions: ProgramAction[];
  interferences: InterferenceSpec[];
  obligations: ObligationSpec[];
  milestones: MilestoneSpec[];
  endings: EndingSpec[];
}
