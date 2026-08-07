import { z } from "zod";
import type { Arc, Challenge } from "../engine/types.js";
import { sha256Hex } from "../engine/cartridge-digest.js";
import { orderRecordKeysDeep, orderedStrings } from "../engine/determinism.js";
import { verifyActionReceipt } from "../engine/action/receipt.js";
import type { ActionOutcome, ActionReceipt, VerifiedActionReceipt } from "../engine/action/types.js";
import { narrativeStateFingerprint } from "./fingerprint.js";
import type {
  NarrativeBeatFunction,
  NarrativeCandidate,
  NarrativeFact,
  NarrativeRuntimeState,
  NarrativeStatePayment,
  NarrativeTrackDisposition,
} from "./types.js";

export const ACTION_NARRATIVE_BINDING_FORMAT = "axm-action-narrative-binding/1" as const;
export const ACTION_NARRATIVE_INGESTION_FORMAT = "axm-action-narrative-ingestion/1" as const;

const Id = z.string().min(1).max(256);
const TagList = z.array(Id).max(128);
const BeatFunction = z.enum([
  "establish",
  "pressure",
  "escalate",
  "reveal",
  "choose",
  "reverse",
  "consequence",
  "inherit",
]);
const TrackDisposition = z.enum(["continue", "resolve", "inherit"]);
const Track = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("open"),
    trackId: Id,
    railId: Id,
    controllingQuestion: z.string().min(1).max(2048),
    pressureTags: TagList,
  }).strict(),
  z.object({
    kind: z.literal("advance"),
    trackId: Id,
  }).strict(),
]);
const StatePayment = z.object({
  kind: Id,
  target: Id,
  tags: TagList,
}).strict();
const Obligation = z.object({
  id: Id,
  kind: Id,
  actorScope: z.enum(["controlled", "party"]),
  tags: TagList,
  pressure: z.number().int().min(0).max(100),
  dueCycleOffset: z.number().int().min(0).max(10_000).optional(),
}).strict();
const OutcomeRule = z.object({
  beatFunction: BeatFunction,
  trackDisposition: TrackDisposition.optional(),
  severity: z.number().int().min(0).max(100),
  tags: TagList,
  pressureTags: TagList,
  controlledMoveTag: Id,
  statePayments: z.array(StatePayment).max(64),
  opensObligations: z.array(Obligation).max(64),
  resolvesObligationIds: TagList,
  authoredPriority: z.number().int().min(-10_000).max(10_000),
  conditionComplexity: z.number().int().min(0).max(10_000),
  cooldownCycles: z.number().int().min(0).max(10_000),
  presentationKey: Id,
}).strict();
const BindingSchema = z.object({
  format: z.literal(ACTION_NARRATIVE_BINDING_FORMAT),
  id: Id,
  version: Id,
  challengeId: Id,
  track: Track,
  outcomes: z.object({
    success: OutcomeRule,
    partial: OutcomeRule,
    failure: OutcomeRule,
  }).strict(),
}).strict();

export type ActionNarrativeBinding = z.infer<typeof BindingSchema>;
export type ActionNarrativeOutcomeRule = z.infer<typeof OutcomeRule>;

export interface ActionNarrativeIngestionReceiptCore {
  format: typeof ACTION_NARRATIVE_INGESTION_FORMAT;
  bindingId: string;
  bindingVersion: string;
  bindingFingerprint: string;
  actionReceiptDigest: string;
  actionOutcome: ActionOutcome;
  factId: string;
  candidateId: string;
  stateBeforeFingerprint: string;
  stateAfterFingerprint: string;
  inserted: boolean;
}

export interface ActionNarrativeIngestionReceipt extends ActionNarrativeIngestionReceiptCore {
  receiptDigest: string;
}

export interface AcceptedActionNarrativeIngestion {
  state: NarrativeRuntimeState;
  fact: NarrativeFact;
  candidate: NarrativeCandidate;
  action: VerifiedActionReceipt;
  receipt: ActionNarrativeIngestionReceipt;
}

function canonical(value: unknown): string {
  return JSON.stringify(orderRecordKeysDeep(value));
}

function uniqueOrdered(values: readonly string[]): string[] {
  return orderedStrings([...new Set(values)]);
}

function bindingFingerprint(binding: ActionNarrativeBinding): string {
  return "actnarrbind1_" + sha256Hex(canonical(binding));
}

function ingestionDigest(core: ActionNarrativeIngestionReceiptCore): string {
  return "actnarr1_" + sha256Hex(canonical(core));
}

export function parseActionNarrativeBinding(input: unknown): ActionNarrativeBinding {
  const parsed = BindingSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => `${issue.path.join(".") || "binding"}: ${issue.message}`);
    throw new Error(`Invalid ${ACTION_NARRATIVE_BINDING_FORMAT}:\n${messages.join("\n")}`);
  }
  return structuredClone(parsed.data);
}

function actionFact(
  receipt: ActionReceipt,
  challenge: Challenge,
  rule: ActionNarrativeOutcomeRule,
): NarrativeFact {
  const actorRoles: Record<string, string> = {};
  for (const actorId of receipt.partyAgentIds) {
    actorRoles[actorId] = actorId === receipt.controlledAgentId ? "controlled" : "party";
  }
  return {
    id: `fact_action_${sha256Hex(receipt.receiptDigest)}`,
    type: "accepted-action-result",
    cycle: receipt.cycle,
    actorIds: uniqueOrdered(receipt.partyAgentIds),
    actorRoles,
    tags: uniqueOrdered([
      "authority:arc-accepted",
      `action:${receipt.result.outcome}`,
      `challenge:${challenge.id}`,
      ...rule.tags,
      ...rule.pressureTags,
    ]),
    severity: rule.severity,
    receiptRef: receipt.receiptDigest,
    data: {
      actionReceiptDigest: receipt.receiptDigest,
      arcDigest: receipt.arcDigest,
      challengeId: receipt.challengeId,
      actionSpecDigest: receipt.actionSpecDigest,
      traceDigest: receipt.traceDigest,
      stateDigest: receipt.stateDigest,
      outcome: receipt.result.outcome,
      totalTicks: receipt.totalTicks,
      completedObjectiveCount: receipt.result.completedObjectiveIds.length,
      playerHealth: receipt.result.playerHealth,
      playerDefeated: receipt.result.playerDefeated,
      enemiesDefeated: receipt.result.stats.enemiesDefeated,
      damageTaken: receipt.result.stats.damageTaken,
      parries: receipt.result.stats.parries,
      dodgedAttacks: receipt.result.stats.dodgedAttacks,
    },
  };
}

function narrativeCandidate(params: {
  binding: ActionNarrativeBinding;
  rule: ActionNarrativeOutcomeRule;
  receipt: ActionReceipt;
  challenge: Challenge;
  fact: NarrativeFact;
  state: NarrativeRuntimeState;
  causalParentBeatIds: readonly string[];
}): NarrativeCandidate {
  const { binding, rule, receipt, challenge, fact, state } = params;
  const track = binding.track.kind === "open"
    ? {
        kind: "open" as const,
        trackId: binding.track.trackId,
        railId: binding.track.railId,
        controllingQuestion: binding.track.controllingQuestion,
        actorIds: uniqueOrdered(receipt.partyAgentIds),
        pressureTags: uniqueOrdered([...binding.track.pressureTags, ...rule.pressureTags]),
      }
    : {
        kind: "advance" as const,
        trackId: binding.track.trackId,
      };
  const automaticPayment: NarrativeStatePayment = {
    kind: "action-result",
    target: challenge.id,
    tags: uniqueOrdered(["payment:action-result", `action:${receipt.result.outcome}`]),
    receiptRef: receipt.receiptDigest,
  };
  const statePayments: NarrativeStatePayment[] = [
    automaticPayment,
    ...rule.statePayments.map((payment) => ({
      ...payment,
      tags: uniqueOrdered(payment.tags),
      receiptRef: receipt.receiptDigest,
    })),
  ];
  const opensObligations = rule.opensObligations.map((obligation) => ({
    id: obligation.id,
    kind: obligation.kind,
    actorIds: obligation.actorScope === "controlled"
      ? [receipt.controlledAgentId]
      : uniqueOrdered(receipt.partyAgentIds),
    tags: uniqueOrdered(obligation.tags),
    pressure: obligation.pressure,
    ...(obligation.dueCycleOffset === undefined
      ? {}
      : { dueCycle: state.cycle + obligation.dueCycleOffset }),
  }));
  const candidateIdentity = {
    bindingId: binding.id,
    bindingVersion: binding.version,
    receiptDigest: receipt.receiptDigest,
  };
  return {
    id: `candidate_action_${sha256Hex(canonical(candidateIdentity))}`,
    recipeId: `accepted-action:${binding.id}@${binding.version}`,
    authority: "authoritative",
    track,
    trackDisposition: (rule.trackDisposition ?? "continue") as NarrativeTrackDisposition,
    beatFunction: rule.beatFunction as NarrativeBeatFunction,
    sourceFactIds: [fact.id],
    causalParentBeatIds: uniqueOrdered(params.causalParentBeatIds),
    roleBindings: { controlled: receipt.controlledAgentId },
    actorMoves: [{
      actorId: receipt.controlledAgentId,
      moveTag: rule.controlledMoveTag,
      justificationFactIds: [fact.id],
    }],
    tags: uniqueOrdered([
      "authority:arc-accepted",
      `action:${receipt.result.outcome}`,
      `challenge:${challenge.id}`,
      ...rule.tags,
    ]),
    pressureTags: uniqueOrdered(rule.pressureTags),
    statePayments,
    opensObligations,
    resolvesObligationIds: uniqueOrdered(rule.resolvesObligationIds),
    authoredPriority: rule.authoredPriority,
    conditionComplexity: rule.conditionComplexity,
    cooldownCycles: rule.cooldownCycles,
    presentationKey: rule.presentationKey,
  };
}

function appendFactIdempotently(
  state: NarrativeRuntimeState,
  fact: NarrativeFact,
): { state: NarrativeRuntimeState; inserted: boolean } {
  const existing = state.facts.find((entry) => entry.id === fact.id || entry.receiptRef === fact.receiptRef);
  if (!existing) {
    return {
      state: { ...state, facts: [...state.facts, fact] },
      inserted: true,
    };
  }
  if (canonical(existing) !== canonical(fact)) {
    throw new Error(`Accepted action fact collision for ${fact.receiptRef}.`);
  }
  return { state, inserted: false };
}

export function ingestAcceptedActionReceipt(params: {
  arc: Arc;
  challenge: Challenge;
  difficultyModeId?: string | null;
  cycle: number;
  orgSeed: number;
  partyAgentIds: string[];
  narrativeState: NarrativeRuntimeState;
  binding: unknown;
  receipt: unknown;
  causalParentBeatIds?: string[];
}): AcceptedActionNarrativeIngestion {
  const binding = parseActionNarrativeBinding(params.binding);
  if (binding.challengeId !== params.challenge.id) {
    throw new Error(`Action narrative binding ${binding.id} targets ${binding.challengeId}, not ${params.challenge.id}.`);
  }
  if (params.narrativeState.cycle !== params.cycle) {
    throw new Error(
      `Narrative cycle ${params.narrativeState.cycle} does not match accepted action cycle ${params.cycle}.`,
    );
  }
  const action = verifyActionReceipt({
    arc: params.arc,
    challenge: params.challenge,
    difficultyModeId: params.difficultyModeId,
    cycle: params.cycle,
    orgSeed: params.orgSeed,
    partyAgentIds: params.partyAgentIds,
    receipt: params.receipt,
  });
  const narrativeActorIds = new Set(params.narrativeState.actors.map((actor) => actor.id));
  const missingActors = action.receipt.partyAgentIds.filter((actorId) => !narrativeActorIds.has(actorId));
  if (missingActors.length > 0) {
    throw new Error(`Accepted action party is absent from narrative state: ${uniqueOrdered(missingActors).join(", ")}.`);
  }
  const rule = binding.outcomes[action.receipt.result.outcome];
  const fact = actionFact(action.receipt, params.challenge, rule);
  const before = narrativeStateFingerprint(params.narrativeState);
  const appended = appendFactIdempotently(params.narrativeState, fact);
  const candidate = narrativeCandidate({
    binding,
    rule,
    receipt: action.receipt,
    challenge: params.challenge,
    fact,
    state: appended.state,
    causalParentBeatIds: params.causalParentBeatIds ?? [],
  });
  const core: ActionNarrativeIngestionReceiptCore = {
    format: ACTION_NARRATIVE_INGESTION_FORMAT,
    bindingId: binding.id,
    bindingVersion: binding.version,
    bindingFingerprint: bindingFingerprint(binding),
    actionReceiptDigest: action.receipt.receiptDigest,
    actionOutcome: action.receipt.result.outcome,
    factId: fact.id,
    candidateId: candidate.id,
    stateBeforeFingerprint: before,
    stateAfterFingerprint: narrativeStateFingerprint(appended.state),
    inserted: appended.inserted,
  };
  return {
    state: appended.state,
    fact,
    candidate,
    action,
    receipt: orderRecordKeysDeep({ ...core, receiptDigest: ingestionDigest(core) }),
  };
}
