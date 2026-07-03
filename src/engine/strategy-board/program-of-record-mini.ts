// program-of-record-mini — a TINY reference strategy-board fixture.
//
// This is a reference fixture that exercises every schema object at minimum size
// (not the shipped ~40-space Program of Record). It exists to validate the schema
// and to seed future runtime property tests. It is content-shaped, but it is NOT
// a shipped cartridge: no runtime executes it yet.
//
// Size: 6 spaces, 3 doctrines, 2 resources, 2 control assets (1 auction-capable),
// 2 program actions, 1 interference, 1 obligation, 1 milestone, 1 ending.

import type { StrategyBoardDefinition } from "./types";
import { validateStrategyBoard } from "./schema";

export const PROGRAM_OF_RECORD_MINI: StrategyBoardDefinition = {
  id: "program-of-record-mini",
  name: "Program of Record (Mini)",
  description: "Minimal reference strategy board: convert capital into standing before rivals turn it into evidence.",
  seatCountRange: { min: 2, max: 3 },

  resources: [
    { id: "capital", name: "Capital", description: "Fungible spend used to acquire assets and take actions." },
    { id: "influence", name: "Influence", description: "Standing that hardens a lead into structural position." },
  ],

  doctrines: [
    {
      id: "PRIME",
      name: "Prime",
      description: "Centralized first-mover: concentrates capital, moves fast, accepts exposure.",
      startingResources: [{ resourceId: "capital", amount: 5 }, { resourceId: "influence", amount: 1 }],
      permittedActionIds: ["act-consolidate", "act-pressure"],
    },
    {
      id: "NEO-PRIME",
      name: "Neo-Prime",
      description: "Reformed centralizer: trades some speed for defensibility.",
      startingResources: [{ resourceId: "capital", amount: 4 }, { resourceId: "influence", amount: 2 }],
      permittedActionIds: ["act-consolidate", "act-pressure"],
    },
    {
      id: "DECENTRALIZED",
      name: "Decentralized",
      description: "Distributed posture: slower to concentrate, harder to turn into evidence.",
      startingResources: [{ resourceId: "capital", amount: 3 }, { resourceId: "influence", amount: 3 }],
      permittedActionIds: ["act-consolidate"],
    },
  ],

  spaces: [
    { id: "s0", name: "Founding", type: "start", region: "core", adjacentSpaceIds: ["s1", "s5"] },
    { id: "s1", name: "Supply Depot", type: "asset", region: "core", adjacentSpaceIds: ["s0", "s2"], assetId: "a-depot" },
    { id: "s2", name: "Contract Office", type: "auction", region: "market", adjacentSpaceIds: ["s1", "s3"], assetId: "a-office" },
    { id: "s3", name: "Audit Chamber", type: "hazard", region: "market", adjacentSpaceIds: ["s2", "s4"] },
    { id: "s4", name: "Standards Board", type: "milestone", region: "civic", adjacentSpaceIds: ["s3", "s5"] },
    { id: "s5", name: "Records Hall", type: "neutral", region: "civic", adjacentSpaceIds: ["s4", "s0"] },
  ],

  controlAssets: [
    {
      id: "a-depot",
      name: "Supply Depot",
      description: "A buyable income asset; non-owners pay a small toll to pass.",
      sitedOnSpaceId: "s1",
      ownershipModel: "buyable",
      effectScope: "owner",
      acquisitionCost: { resourceId: "capital", amount: 3 },
      income: { resourceId: "capital", amountPerQuarter: 1 },
      toll: { resourceId: "influence", amount: 1, chargedWhen: "nonOwnerOccupant", eventKind: "tollPayment" },
    },
    {
      id: "a-office",
      name: "Contract Office",
      description: "An auction-only regional asset yielding influence to its owner.",
      sitedOnSpaceId: "s2",
      ownershipModel: "auctionOnly",
      effectScope: "region",
      income: { resourceId: "influence", amountPerQuarter: 1 },
    },
  ],

  auctions: [
    {
      id: "au-office",
      assetId: "a-office",
      format: "englishAscending",
      resourceId: "capital",
      minIncrement: 1,
      honoredBy: "buyAuctionPass",
      eventKind: "auctionSettlement",
    },
  ],

  programActions: [
    {
      id: "act-consolidate",
      name: "Consolidate",
      description: "Convert capital into standing influence.",
      cost: [{ resourceId: "capital", delta: -1, eventKind: "programActionCost" }],
      effect: { summary: "Spend capital to gain influence.", mutations: [{ resourceId: "influence", delta: 1, eventKind: "programActionYield" }] },
      target: "self",
      honoredBy: "programAction",
    },
    {
      id: "act-pressure",
      name: "Apply Pressure",
      description: "Spend influence to extract capital advantage from a rival's position.",
      cost: [{ resourceId: "influence", delta: -1, eventKind: "programActionCost" }],
      effect: { summary: "Spend influence to gain capital.", mutations: [{ resourceId: "capital", delta: 1, eventKind: "programActionYield" }] },
      target: "seat",
      honoredBy: "programAction",
    },
  ],

  interferences: [
    {
      id: "itf-contest",
      name: "Contest",
      description: "A non-active seat spends capital to contest a pressure action, blunting it.",
      interferableActionIds: ["act-pressure"],
      cost: [{ resourceId: "capital", delta: -1, eventKind: "interferenceCost" }],
      effect: { summary: "Blunt the contested action's yield (recorded).", mutations: [] },
      honoredBy: "reactionInterference",
    },
  ],

  obligations: [
    {
      id: "ob-retainer",
      name: "Standing Retainer",
      resourceId: "capital",
      amountPerQuarter: 1,
      termQuarters: 4,
      eventKind: "obligationSettlement",
    },
  ],

  milestones: [
    {
      id: "m-standard",
      name: "Set the Standard",
      description: "Own the Contract Office and hold enough influence to make the position self-reinforcing.",
      requirements: {
        resourceThresholds: [{ resourceId: "influence", atLeast: 5 }],
        ownedAssetIds: ["a-office"],
      },
      reward: { mutations: [{ resourceId: "influence", delta: 2, eventKind: "milestoneReward" }], unlocks: ["end-inevitability"] },
      contributesToEndingId: "end-inevitability",
    },
  ],

  endings: [
    {
      id: "end-inevitability",
      name: "Institutional Inevitability",
      description: "The position is locked in: rivals catching up on capability no longer dislodges it.",
      condition: { type: "inevitabilityReached", note: "Standard set and influence lead held through the term." },
      scoringNote: "Score by influence lead and owned regional assets at lock-in.",
    },
  ],
};

/** Deterministically load and validate the mini fixture. Returns a freshly
 *  validated definition; two calls are deep-equal. Throws if the fixture ever
 *  drifts out of schema. */
export function loadProgramOfRecordMini(): StrategyBoardDefinition {
  return validateStrategyBoard(PROGRAM_OF_RECORD_MINI);
}
