export const NARRATIVE_CAUSAL_AUDIT_FORMAT = "axm-narrative-causal-audit/1" as const;

export type NarrativeCausalAuditFindingCode =
  | "missing-causal-parent"
  | "non-prior-causal-parent"
  | "missing-obligation-opening-beat"
  | "missing-obligation-closing-beat"
  | "loose-beat"
  | "stalled-track"
  | "terminal-track-open-obligation"
  | "overdue-obligation"
  | "high-pressure-obligation"
  | "recipe-run"
  | "actor-concentration";

export type NarrativeCausalAuditSeverity = "error" | "warning" | "notice";

export interface NarrativeCausalAuditPolicy {
  looseBeatGraceCycles: number;
  stalledTrackCycles: number;
  highPressureThreshold: number;
  maximumRecipeRun: number;
  maximumActorSharePermille: number;
}

export interface NarrativeCausalAuditFinding {
  code: NarrativeCausalAuditFindingCode;
  severity: NarrativeCausalAuditSeverity;
  subjectId: string;
  detail: string;
  relatedIds: string[];
}

export interface NarrativeBeatCausalReceipt {
  beatId: string;
  cycle: number;
  trackId: string;
  parentBeatIds: string[];
  childBeatIds: string[];
  obligationOpenedIds: string[];
  obligationClosedIds: string[];
  terminal: boolean;
  activeFrontier: boolean;
  structurallyUsed: boolean;
}

export interface NarrativeCausalAuditReceipt {
  format: typeof NARRATIVE_CAUSAL_AUDIT_FORMAT;
  stateFingerprint: string;
  cycle: number;
  policy: NarrativeCausalAuditPolicy;
  beatCount: number;
  trackCount: number;
  obligationCount: number;
  structuralCausalWidth: number;
  looseBeatIds: string[];
  stalledTrackIds: string[];
  overdueObligationIds: string[];
  highPressureObligationIds: string[];
  maximumRecipeRunObserved: number;
  maximumActorSharePermilleObserved: number;
  beats: NarrativeBeatCausalReceipt[];
  findings: NarrativeCausalAuditFinding[];
  passed: boolean;
}

export const DEFAULT_NARRATIVE_CAUSAL_AUDIT_POLICY: NarrativeCausalAuditPolicy = {
  looseBeatGraceCycles: 1,
  stalledTrackCycles: 3,
  highPressureThreshold: 10,
  maximumRecipeRun: 3,
  maximumActorSharePermille: 750,
};
