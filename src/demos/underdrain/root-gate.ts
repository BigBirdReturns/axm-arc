import { cartridgeDigest, sha256Hex } from "../../engine/cartridge-digest.js";
import { orderRecordKeysDeep } from "../../engine/determinism.js";
import type { CartridgeStateEffect, CartridgeStateValue } from "../../engine/abi13.js";
import type { Arc } from "../../engine/types.js";
import {
  UNDERDRAIN_DRAFT_ARC,
  UNDERDRAIN_ROOT_GATE_CHALLENGE,
  UNDERDRAIN_ROOT_GATE_CHALLENGE_ID,
} from "./arc.js";

export const UNDERDRAIN_ROOT_GATE_RECEIPT_FORMAT = "axm-authored-choice-receipt/1" as const;
export const UNDERDRAIN_ROOT_GATE_CHOICE_IDS = [
  "town-first-flow",
  "nursery-first-flow",
  "balanced-flow-compact",
] as const;
export type UnderdrainRootGateChoiceId = typeof UNDERDRAIN_ROOT_GATE_CHOICE_IDS[number];
export type UnderdrainCampaignState = Record<string, CartridgeStateValue>;

export interface UnderdrainRootGateReceiptCore {
  format: typeof UNDERDRAIN_ROOT_GATE_RECEIPT_FORMAT;
  arcDigest: string;
  challengeId: typeof UNDERDRAIN_ROOT_GATE_CHALLENGE_ID;
  experienceId: "root-gate-parley";
  choiceId: UnderdrainRootGateChoiceId;
  outcome: "success" | "partial";
  campaignBefore: UnderdrainCampaignState;
  campaignAfter: UnderdrainCampaignState;
  stateEffects: CartridgeStateEffect[];
  narrative: string;
  milestoneFlag: string | null;
}

export interface UnderdrainRootGateReceipt extends UnderdrainRootGateReceiptCore {
  receiptDigest: string;
}

function canonical(value: unknown): string {
  return JSON.stringify(orderRecordKeysDeep(value));
}

export function initialUnderdrainCampaignState(arc: Arc = UNDERDRAIN_DRAFT_ARC): UnderdrainCampaignState {
  return Object.fromEntries((arc.stateDefinitions ?? []).map((definition) => [definition.id, definition.initial]));
}

export function applyUnderdrainStateEffects(
  before: UnderdrainCampaignState,
  effects: readonly CartridgeStateEffect[],
  arc: Arc = UNDERDRAIN_DRAFT_ARC,
): UnderdrainCampaignState {
  const definitions = new Map((arc.stateDefinitions ?? []).map((definition) => [definition.id, definition]));
  const next = structuredClone(before);
  for (const effect of effects) {
    const definition = definitions.get(effect.stateId);
    if (!definition) throw new Error(`Underdrain state effect references unknown state ${effect.stateId}.`);
    const current = next[effect.stateId];
    if (effect.operation === "set") {
      next[effect.stateId] = effect.value;
      continue;
    }
    if (effect.operation === "transition") {
      if (definition.kind !== "enum") throw new Error(`State ${effect.stateId} is not an enum.`);
      if (effect.from !== undefined && current !== effect.from) {
        throw new Error(`State ${effect.stateId} expected ${effect.from}, found ${String(current)}.`);
      }
      if (!definition.values.includes(effect.to)) throw new Error(`State ${effect.stateId} rejects transition target ${effect.to}.`);
      next[effect.stateId] = effect.to;
      continue;
    }
    if (definition.kind !== "number" || typeof current !== "number") {
      throw new Error(`State ${effect.stateId} cannot apply ${effect.operation}.`);
    }
    const signed = effect.operation === "increment" ? effect.value : -effect.value;
    const proposed = current + signed;
    if (proposed < definition.min || proposed > definition.max) {
      if (effect.overflow !== "clamp") throw new Error(`State ${effect.stateId} would leave its declared range.`);
      next[effect.stateId] = Math.max(definition.min, Math.min(definition.max, proposed));
    } else {
      next[effect.stateId] = proposed;
    }
  }
  return orderRecordKeysDeep(next);
}

export function acceptUnderdrainRootGateChoice(params: {
  choiceId: UnderdrainRootGateChoiceId;
  campaignBefore: UnderdrainCampaignState;
  arc?: Arc;
}): UnderdrainRootGateReceipt {
  const arc = params.arc ?? UNDERDRAIN_DRAFT_ARC;
  if (!UNDERDRAIN_ROOT_GATE_CHOICE_IDS.includes(params.choiceId)) {
    throw new Error(`Unknown Root Gate choice ${String(params.choiceId)}.`);
  }
  const authoredChoices = arc.extensions?.["axm.authored-experience@1"] as {
    experiences?: Record<string, { commitments?: Array<{ id: string }> }>;
  } | undefined;
  const commitmentIds = authoredChoices?.experiences?.["root-gate-parley"]?.commitments?.map((entry) => entry.id) ?? [];
  if (!commitmentIds.includes(params.choiceId)) {
    throw new Error(`Root Gate choice ${params.choiceId} is not present in the authored experience.`);
  }

  const outcome = params.choiceId === "balanced-flow-compact" ? "success" : "partial";
  const authoredOutcome = UNDERDRAIN_ROOT_GATE_CHALLENGE.outcomes[outcome];
  const stateEffects = structuredClone(authoredOutcome.stateEffects ?? []);
  const campaignBefore = orderRecordKeysDeep(structuredClone(params.campaignBefore));
  const campaignAfter = applyUnderdrainStateEffects(campaignBefore, stateEffects, arc);
  const core: UnderdrainRootGateReceiptCore = {
    format: UNDERDRAIN_ROOT_GATE_RECEIPT_FORMAT,
    arcDigest: cartridgeDigest(arc),
    challengeId: UNDERDRAIN_ROOT_GATE_CHALLENGE_ID,
    experienceId: "root-gate-parley",
    choiceId: params.choiceId,
    outcome,
    campaignBefore,
    campaignAfter,
    stateEffects,
    narrative: authoredOutcome.narrative,
    milestoneFlag: authoredOutcome.milestoneFlag ?? null,
  };
  return orderRecordKeysDeep({
    ...core,
    receiptDigest: "choice1_" + sha256Hex(canonical(core)),
  });
}

export function verifyUnderdrainRootGateReceipt(params: {
  receipt: UnderdrainRootGateReceipt;
  arc?: Arc;
}): UnderdrainRootGateReceipt {
  const rebuilt = acceptUnderdrainRootGateChoice({
    choiceId: params.receipt.choiceId,
    campaignBefore: params.receipt.campaignBefore,
    arc: params.arc,
  });
  if (canonical(rebuilt) !== canonical(params.receipt)) {
    throw new Error("Root Gate authored-choice receipt replay mismatch.");
  }
  return rebuilt;
}
