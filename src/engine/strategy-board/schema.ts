// Strategy Board Runtime — schema validation (scaffold only).
//
// zod schemas for the authored strategy-board cartridge, mirroring the engine's
// existing validateArc discipline (see ../schema.ts). Structural validation plus
// cross-reference refinements that encode the two scaffold invariants:
//   1. every resource mutation names a ledger event kind (enforced by the type);
//   2. every player-facing choice object names the phase that will honor it, and
//      names the CORRECT phase.
// No behavior — this only accepts or rejects authored data.

import { z } from "zod";
import type { StrategyBoardDefinition } from "./types";

const PHASES = [
  "quarterStart",
  "movementResolution",
  "buyAuctionPass",
  "programAction",
  "reactionInterference",
  "milestoneAttempt",
  "receiptLedger",
] as const;

const LEDGER_EVENT_KINDS = [
  "income",
  "purchase",
  "auctionSettlement",
  "tollPayment",
  "obligationSettlement",
  "programActionCost",
  "programActionYield",
  "interferenceCost",
  "milestoneReward",
] as const;

const ResourceLedgerMutationSchema = z.object({
  resourceId: z.string(),
  delta: z.number(),
  eventKind: z.enum(LEDGER_EVENT_KINDS),
});

const BoardSpaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["start", "asset", "auction", "hazard", "milestone", "neutral"]),
  region: z.string(),
  adjacentSpaceIds: z.array(z.string()),
  assetId: z.string().optional(),
});

const PlayerDoctrineSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  startingResources: z.array(z.object({ resourceId: z.string(), amount: z.number() })),
  permittedActionIds: z.array(z.string()),
});

const StrategyResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

const TollSpecSchema = z.object({
  resourceId: z.string(),
  amount: z.number().min(0),
  chargedWhen: z.literal("nonOwnerOccupant"),
  eventKind: z.literal("tollPayment"),
});

const ControlAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  sitedOnSpaceId: z.string(),
  ownershipModel: z.enum(["buyable", "auctionOnly", "fixed"]),
  effectScope: z.enum(["owner", "occupant", "region", "global"]),
  acquisitionCost: z.object({ resourceId: z.string(), amount: z.number().min(0) }).optional(),
  income: z.object({ resourceId: z.string(), amountPerQuarter: z.number() }).optional(),
  toll: TollSpecSchema.optional(),
});

const ObligationSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  resourceId: z.string(),
  amountPerQuarter: z.number(),
  termQuarters: z.number().int().min(1),
  eventKind: z.literal("obligationSettlement"),
});

const AuctionSpecSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  format: z.enum(["englishAscending", "sealedBid"]),
  resourceId: z.string(),
  minIncrement: z.number().gt(0),
  honoredBy: z.enum(PHASES),
  eventKind: z.literal("auctionSettlement"),
});

const ProgramActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  cost: z.array(ResourceLedgerMutationSchema),
  effect: z.object({ summary: z.string(), mutations: z.array(ResourceLedgerMutationSchema) }),
  target: z.enum(["self", "space", "asset", "seat", "none"]),
  honoredBy: z.enum(PHASES),
});

const InterferenceSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  interferableActionIds: z.array(z.string()).min(1),
  cost: z.array(ResourceLedgerMutationSchema),
  effect: z.object({ summary: z.string(), mutations: z.array(ResourceLedgerMutationSchema) }),
  honoredBy: z.enum(PHASES),
});

const MilestoneSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  requirements: z
    .object({
      resourceThresholds: z.array(z.object({ resourceId: z.string(), atLeast: z.number() })).optional(),
      ownedAssetIds: z.array(z.string()).optional(),
    })
    .refine(
      (r) => (r.resourceThresholds?.length ?? 0) + (r.ownedAssetIds?.length ?? 0) > 0,
      { message: "milestone must declare at least one requirement" },
    ),
  reward: z.object({ mutations: z.array(ResourceLedgerMutationSchema), unlocks: z.array(z.string()) }),
  contributesToEndingId: z.string(),
});

const EndingSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  condition: z.object({
    type: z.enum(["inevitabilityReached", "evidenceOverwhelms", "timeout"]),
    note: z.string(),
  }),
  scoringNote: z.string(),
});

const StrategyBoardBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  seatCountRange: z.object({ min: z.number().int().min(2), max: z.number().int().min(2) }),
  spaces: z.array(BoardSpaceSchema).min(1),
  doctrines: z.array(PlayerDoctrineSchema).min(1),
  resources: z.array(StrategyResourceSchema).min(1),
  controlAssets: z.array(ControlAssetSchema),
  auctions: z.array(AuctionSpecSchema),
  programActions: z.array(ProgramActionSchema).min(1),
  interferences: z.array(InterferenceSpecSchema),
  obligations: z.array(ObligationSpecSchema),
  milestones: z.array(MilestoneSpecSchema),
  endings: z.array(EndingSpecSchema).min(1),
});

type StrategyBoardBase = z.infer<typeof StrategyBoardBaseSchema>;

/** The canonical phase each choice object must be honored by. Encodes the
 *  sovereignty rule: a choice's honoring phase is not free text, it is fixed. */
const HONORED_BY: Record<"action" | "auction" | "interference", (typeof PHASES)[number]> = {
  action: "programAction",
  auction: "buyAuctionPass",
  interference: "reactionInterference",
};

export const StrategyBoardSchema = StrategyBoardBaseSchema.superRefine(
  (def: StrategyBoardBase, ctx: z.RefinementCtx) => {
    const spaceIds = new Set(def.spaces.map((s) => s.id));
    const resourceIds = new Set(def.resources.map((r) => r.id));
    const assetIds = new Set(def.controlAssets.map((a) => a.id));
    const actionIds = new Set(def.programActions.map((a) => a.id));
    const endingIds = new Set(def.endings.map((e) => e.id));

    const bad = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const checkResource = (id: string, where: string) => {
      if (!resourceIds.has(id)) bad(`${where}: unknown resourceId "${id}"`);
    };
    const checkMutations = (muts: { resourceId: string }[], where: string) => {
      for (const m of muts) checkResource(m.resourceId, where);
    };

    for (const s of def.spaces) {
      for (const adj of s.adjacentSpaceIds) {
        if (!spaceIds.has(adj)) bad(`space "${s.id}": unknown adjacent space "${adj}"`);
      }
      if (s.assetId !== undefined && !assetIds.has(s.assetId)) {
        bad(`space "${s.id}": unknown assetId "${s.assetId}"`);
      }
      if ((s.type === "asset" || s.type === "auction") && s.assetId === undefined) {
        bad(`space "${s.id}": type "${s.type}" requires an assetId`);
      }
    }

    for (const a of def.controlAssets) {
      if (!spaceIds.has(a.sitedOnSpaceId)) bad(`asset "${a.id}": unknown sitedOnSpaceId "${a.sitedOnSpaceId}"`);
      if (a.acquisitionCost) checkResource(a.acquisitionCost.resourceId, `asset "${a.id}" acquisitionCost`);
      if (a.income) checkResource(a.income.resourceId, `asset "${a.id}" income`);
      if (a.toll) checkResource(a.toll.resourceId, `asset "${a.id}" toll`);
    }

    for (const d of def.doctrines) {
      for (const sr of d.startingResources) checkResource(sr.resourceId, `doctrine "${d.id}" startingResources`);
      for (const aid of d.permittedActionIds) {
        if (!actionIds.has(aid)) bad(`doctrine "${d.id}": unknown permittedActionId "${aid}"`);
      }
    }

    for (const act of def.programActions) {
      checkMutations(act.cost, `action "${act.id}" cost`);
      checkMutations(act.effect.mutations, `action "${act.id}" effect`);
      if (act.honoredBy !== HONORED_BY.action) {
        bad(`action "${act.id}": honoredBy must be "${HONORED_BY.action}", got "${act.honoredBy}"`);
      }
    }

    for (const au of def.auctions) {
      if (!assetIds.has(au.assetId)) bad(`auction "${au.id}": unknown assetId "${au.assetId}"`);
      checkResource(au.resourceId, `auction "${au.id}"`);
      if (au.honoredBy !== HONORED_BY.auction) {
        bad(`auction "${au.id}": honoredBy must be "${HONORED_BY.auction}", got "${au.honoredBy}"`);
      }
    }

    for (const itf of def.interferences) {
      for (const aid of itf.interferableActionIds) {
        if (!actionIds.has(aid)) bad(`interference "${itf.id}": unknown interferableActionId "${aid}"`);
      }
      checkMutations(itf.cost, `interference "${itf.id}" cost`);
      checkMutations(itf.effect.mutations, `interference "${itf.id}" effect`);
      if (itf.honoredBy !== HONORED_BY.interference) {
        bad(`interference "${itf.id}": honoredBy must be "${HONORED_BY.interference}", got "${itf.honoredBy}"`);
      }
    }

    for (const ob of def.obligations) checkResource(ob.resourceId, `obligation "${ob.id}"`);

    for (const m of def.milestones) {
      for (const t of m.requirements.resourceThresholds ?? []) checkResource(t.resourceId, `milestone "${m.id}" requirement`);
      for (const aid of m.requirements.ownedAssetIds ?? []) {
        if (!assetIds.has(aid)) bad(`milestone "${m.id}": unknown required assetId "${aid}"`);
      }
      checkMutations(m.reward.mutations, `milestone "${m.id}" reward`);
      if (!endingIds.has(m.contributesToEndingId)) {
        bad(`milestone "${m.id}": unknown contributesToEndingId "${m.contributesToEndingId}"`);
      }
    }

    if (def.seatCountRange.max < def.seatCountRange.min) {
      bad(`seatCountRange: max (${def.seatCountRange.max}) < min (${def.seatCountRange.min})`);
    }
  },
);

export function validateStrategyBoard(input: unknown): StrategyBoardDefinition {
  const result = StrategyBoardSchema.safeParse(input);
  if (!result.success) {
    const messages = result.error.errors
      .map((e: z.ZodIssue) => `[${e.path.join(".") || "root"}] ${e.message}`)
      .join("\n");
    throw new Error(`Invalid strategy board:\n${messages}`);
  }
  return result.data as StrategyBoardDefinition;
}
