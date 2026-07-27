import type { Arc, Challenge } from "../engine/types.js";
import { sha256Hex } from "../engine/cartridge-digest.js";
import { orderRecordKeysDeep } from "../engine/determinism.js";
import { narrativeSelectionFingerprint, narrativeStateFingerprint } from "./fingerprint.js";
import { commitNarrativeSelection } from "./ledger.js";
import { sortNarrativeCandidates } from "./rails.js";
import {
  ingestAcceptedActionReceipt,
  type AcceptedActionNarrativeIngestion,
} from "./action-receipt-seam.js";
import type {
  NarrativeCommitResult,
  NarrativeConstitution,
  NarrativeRuntimeState,
  NarrativeSelectionReceipt,
} from "./types.js";

export const ACTION_NARRATIVE_TRANSITION_FORMAT = "axm-action-narrative-transition/1" as const;

export interface ActionNarrativeTransitionReceiptCore {
  format: typeof ACTION_NARRATIVE_TRANSITION_FORMAT;
  actionReceiptDigest: string;
  actionOutcome: "success" | "partial" | "failure";
  ingestionReceiptDigest: string;
  bindingFingerprint: string;
  factId: string;
  candidateId: string;
  selectionFingerprint: string;
  commitBeatId: string;
  commitSequence: number;
  stateBeforeFingerprint: string;
  stateAfterFingerprint: string;
}

export interface ActionNarrativeTransitionReceipt extends ActionNarrativeTransitionReceiptCore {
  receiptDigest: string;
}

export interface AcceptedActionNarrativeTransition {
  ingestion: AcceptedActionNarrativeIngestion;
  selection: NarrativeSelectionReceipt;
  commit: NarrativeCommitResult;
  receipt: ActionNarrativeTransitionReceipt;
}

function canonical(value: unknown): string {
  return JSON.stringify(orderRecordKeysDeep(value));
}

function transitionDigest(core: ActionNarrativeTransitionReceiptCore): string {
  return "actnarrtx1_" + sha256Hex(canonical(core));
}

/** Complete the immediate authoritative consequence of one accepted action
 * receipt. The action outcome is replay-verified by ingestAcceptedActionReceipt.
 * The resulting candidate then passes the ordinary narrative sorter and commit
 * law; this function does not grant the seam a privileged commit path. */
export function commitAcceptedActionNarrative(params: {
  arc: Arc;
  challenge: Challenge;
  difficultyModeId?: string | null;
  cycle: number;
  orgSeed: number;
  partyAgentIds: string[];
  narrativeState: NarrativeRuntimeState;
  constitution: NarrativeConstitution;
  binding: unknown;
  receipt: unknown;
  causalParentBeatIds?: string[];
}): AcceptedActionNarrativeTransition {
  const stateBeforeFingerprint = narrativeStateFingerprint(params.narrativeState);
  const ingestion = ingestAcceptedActionReceipt(params);
  const candidates = [ingestion.candidate];
  const selection = sortNarrativeCandidates(params.constitution, ingestion.state, candidates);
  if (selection.selectedCandidateId !== ingestion.candidate.id) {
    const rejection = selection.rejected.find((entry) => entry.candidateId === ingestion.candidate.id);
    const details = rejection?.failures.map((failure) => `${failure.code}: ${failure.detail}`).join("; ")
      ?? "candidate was not selected";
    throw new Error(`Accepted action narrative consequence is not committable: ${details}`);
  }
  const commit = commitNarrativeSelection(params.constitution, ingestion.state, candidates, selection);
  const core: ActionNarrativeTransitionReceiptCore = {
    format: ACTION_NARRATIVE_TRANSITION_FORMAT,
    actionReceiptDigest: ingestion.action.receipt.receiptDigest,
    actionOutcome: ingestion.action.receipt.result.outcome,
    ingestionReceiptDigest: ingestion.receipt.receiptDigest,
    bindingFingerprint: ingestion.receipt.bindingFingerprint,
    factId: ingestion.fact.id,
    candidateId: ingestion.candidate.id,
    selectionFingerprint: narrativeSelectionFingerprint(selection),
    commitBeatId: commit.receipt.beatId,
    commitSequence: commit.receipt.sequence,
    stateBeforeFingerprint,
    stateAfterFingerprint: narrativeStateFingerprint(commit.state),
  };
  return {
    ingestion,
    selection,
    commit,
    receipt: orderRecordKeysDeep({ ...core, receiptDigest: transitionDigest(core) }),
  };
}
