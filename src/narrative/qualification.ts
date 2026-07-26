import { compareCodepoints, orderedStrings } from "../engine/determinism.js";
import { commitNarrativeSelection } from "./ledger.js";
import { sortNarrativeCandidates } from "./rails.js";
import type {
  NarrativeBeatFunction,
  NarrativeCandidate,
  NarrativeConstitution,
  NarrativeRailFailureCode,
  NarrativeRuntimeState,
  NarrativeSelectionReceipt,
  NarrativeTrackStatus,
} from "./types.js";

export const NARRATIVE_QUALIFICATION_FORMAT = "axm-narrative-qualification/1" as const;

export interface NarrativeExpectedRejection {
  candidateId: string;
  codes: NarrativeRailFailureCode[];
}

export interface NarrativeExpectedCommit {
  beatFunction?: NarrativeBeatFunction;
  trackStatus?: NarrativeTrackStatus;
  openedObligationKinds?: string[];
  resolvedObligationKinds?: string[];
}

export interface NarrativeQualificationExpectation {
  selectedCandidateId?: string | null;
  selectedRecipeId?: string | null;
  minimumEligible?: number;
  maximumEligible?: number;
  rejections?: NarrativeExpectedRejection[];
  commit?: NarrativeExpectedCommit;
}

export interface NarrativeQualificationCase {
  id: string;
  constitution: NarrativeConstitution;
  state: NarrativeRuntimeState;
  candidates: NarrativeCandidate[];
  expected: NarrativeQualificationExpectation;
}

export interface NarrativeQualificationCaseReceipt {
  id: string;
  passed: boolean;
  failures: string[];
  selection: NarrativeSelectionReceipt;
}

export interface NarrativeQualificationReceipt {
  format: typeof NARRATIVE_QUALIFICATION_FORMAT;
  passed: boolean;
  cases: NarrativeQualificationCaseReceipt[];
}

function compareExpectedRejections(
  expected: readonly NarrativeExpectedRejection[],
  selection: NarrativeSelectionReceipt,
): string[] {
  const failures: string[] = [];
  const rejectionById = new Map(selection.rejected.map((rejection) => [rejection.candidateId, rejection] as const));
  for (const expectation of expected) {
    const actual = rejectionById.get(expectation.candidateId);
    if (!actual) {
      failures.push(`expected rejection ${expectation.candidateId} was absent`);
      continue;
    }
    const actualCodes = new Set(actual.failures.map((entry) => entry.code));
    for (const code of expectation.codes) {
      if (!actualCodes.has(code)) failures.push(`rejection ${expectation.candidateId} did not include ${code}`);
    }
  }
  return failures;
}

function compareCommit(
  expectation: NarrativeExpectedCommit,
  constitution: NarrativeConstitution,
  state: NarrativeRuntimeState,
  candidates: readonly NarrativeCandidate[],
  selection: NarrativeSelectionReceipt,
): string[] {
  const failures: string[] = [];
  const selected = candidates.find((candidate) => candidate.id === selection.selectedCandidateId);
  if (!selected) return ["commit expectation requires one selected candidate"];

  const committed = commitNarrativeSelection(constitution, state, candidates, selection);
  const beat = committed.state.ledger.beats[committed.state.ledger.beats.length - 1];
  if (!beat) return ["selected candidate did not append a beat"];

  if (expectation.beatFunction !== undefined && beat.beatFunction !== expectation.beatFunction) {
    failures.push(`expected committed beat ${expectation.beatFunction}, received ${beat.beatFunction}`);
  }
  if (expectation.trackStatus !== undefined && committed.receipt.trackStatus !== expectation.trackStatus) {
    failures.push(`expected track status ${expectation.trackStatus}, received ${committed.receipt.trackStatus}`);
  }

  const openedKinds = committed.state.ledger.obligations
    .filter((obligation) => beat.openedObligationIds.includes(obligation.id))
    .map((obligation) => obligation.kind)
    .sort(compareCodepoints);
  const resolvedKinds = committed.state.ledger.obligations
    .filter((obligation) => beat.resolvedObligationIds.includes(obligation.id))
    .map((obligation) => obligation.kind)
    .sort(compareCodepoints);

  if (expectation.openedObligationKinds !== undefined) {
    const expected = orderedStrings(expectation.openedObligationKinds);
    if (JSON.stringify(openedKinds) !== JSON.stringify(expected)) {
      failures.push(`expected opened obligation kinds ${expected.join(", ")}; received ${openedKinds.join(", ")}`);
    }
  }
  if (expectation.resolvedObligationKinds !== undefined) {
    const expected = orderedStrings(expectation.resolvedObligationKinds);
    if (JSON.stringify(resolvedKinds) !== JSON.stringify(expected)) {
      failures.push(`expected resolved obligation kinds ${expected.join(", ")}; received ${resolvedKinds.join(", ")}`);
    }
  }

  return failures;
}

function runCase(testCase: NarrativeQualificationCase): NarrativeQualificationCaseReceipt {
  const selection = sortNarrativeCandidates(testCase.constitution, testCase.state, testCase.candidates);
  const failures: string[] = [];
  const selectedCandidate = testCase.candidates.find((candidate) => candidate.id === selection.selectedCandidateId);

  if (
    testCase.expected.selectedCandidateId !== undefined &&
    selection.selectedCandidateId !== testCase.expected.selectedCandidateId
  ) {
    failures.push(
      `expected selected candidate ${String(testCase.expected.selectedCandidateId)}, received ${String(selection.selectedCandidateId)}`,
    );
  }
  if (testCase.expected.selectedRecipeId !== undefined) {
    const actual = selectedCandidate?.recipeId ?? null;
    if (actual !== testCase.expected.selectedRecipeId) {
      failures.push(`expected selected recipe ${String(testCase.expected.selectedRecipeId)}, received ${String(actual)}`);
    }
  }
  if (
    testCase.expected.minimumEligible !== undefined &&
    selection.eligible.length < testCase.expected.minimumEligible
  ) {
    failures.push(`expected at least ${testCase.expected.minimumEligible} eligible candidates, received ${selection.eligible.length}`);
  }
  if (
    testCase.expected.maximumEligible !== undefined &&
    selection.eligible.length > testCase.expected.maximumEligible
  ) {
    failures.push(`expected at most ${testCase.expected.maximumEligible} eligible candidates, received ${selection.eligible.length}`);
  }

  failures.push(...compareExpectedRejections(testCase.expected.rejections ?? [], selection));
  if (testCase.expected.commit) {
    failures.push(
      ...compareCommit(
        testCase.expected.commit,
        testCase.constitution,
        testCase.state,
        testCase.candidates,
        selection,
      ),
    );
  }

  return {
    id: testCase.id,
    passed: failures.length === 0,
    failures: failures.sort(compareCodepoints),
    selection,
  };
}

export function runNarrativeQualificationSuite(
  cases: readonly NarrativeQualificationCase[],
): NarrativeQualificationReceipt {
  const caseReceipts = [...cases]
    .sort((left, right) => compareCodepoints(left.id, right.id))
    .map(runCase);
  return {
    format: NARRATIVE_QUALIFICATION_FORMAT,
    passed: caseReceipts.every((receipt) => receipt.passed),
    cases: caseReceipts,
  };
}
