import type { JsonValue } from "../engine/types.js";
import type {
  CanonRelation,
  CanonTier,
  GodscarEvidenceLedger,
  GodscarFactionReceipt,
  GodscarPocketIdentity,
} from "../godscar/types.js";

export const DARK_TOMB_POCKET_FORMAT = "dark-tomb-pocket/1" as const;
export const DARK_TOMB_EXTENSION_KEY = "godscar.dark-tomb@1" as const;

/** Book II remains inside the Book I evidence and canon discipline. */
export type DarkTombCanonTier = CanonTier;
export type DarkTombCanonRelation = CanonRelation;
export type DarkTombPocketIdentity = GodscarPocketIdentity;
export type DarkTombEvidenceLedger = GodscarEvidenceLedger;
export type DarkTombFactionReceipt = GodscarFactionReceipt;

export type DarkTombPressureKind =
  | "tomb-form"
  | "exterior-lie"
  | "custodian"
  | "ordinary-good"
  | "excluded-actor"
  | "approaching-breach"
  | "cost-of-opening-or-closing"
  | "scale-revelation";

export interface DarkTombPressure {
  kind: DarkTombPressureKind;
  id: string;
  label: string;
  description: string;
}

export type DarkTombLayerKind =
  | "grave-skin"
  | "shroud"
  | "quiet-works"
  | "common-depths"
  | "custodial-ring"
  | "war-layer"
  | "black-core";

export interface DarkTombLayer {
  kind: DarkTombLayerKind;
  label: string;
  description: string;
  currentUse: string;
  inheritedPurpose: string;
  officialClassification: string;
}

export type DarkTombDepthKind =
  | "material"
  | "signal"
  | "administrative"
  | "historical"
  | "interpretive";

export interface DarkTombDepth {
  kind: DarkTombDepthKind;
  description: string;
  barrier: string;
  beneficiary: string;
}

export type SignatureOperationKind =
  | "sink"
  | "spread"
  | "shift"
  | "mask"
  | "counterfeit"
  | "sacrifice";

export interface SignatureOperation {
  kind: SignatureOperationKind;
  description: string;
  cost: string;
}

export interface SignatureAllocation {
  id: string;
  label: string;
  claimant: string;
  ordinaryGood: string;
  wake: string;
  denialCost: string;
}

export interface DarkTombSignatureBudget {
  observer: string;
  exteriorClassification: string;
  wakeSources: string[];
  operations: SignatureOperation[];
  allocations: SignatureAllocation[];
}

export type LongAlarmPhase = "shadow" | "hush" | "fold" | "black" | "cut" | "wake";

export interface LongAlarmPhaseRecord {
  phase: LongAlarmPhase;
  description: string;
  protection: string;
  internalCost: string;
}

export interface DarkTombLongAlarm {
  originalThreat: string;
  auditProblem: string;
  currentPhase: LongAlarmPhase;
  phases: [
    LongAlarmPhaseRecord,
    LongAlarmPhaseRecord,
    LongAlarmPhaseRecord,
    LongAlarmPhaseRecord,
    LongAlarmPhaseRecord,
    LongAlarmPhaseRecord,
  ];
}

export type DarkTombCastResponsibility =
  | "depends-on-alarm"
  | "bears-cost-of-concealment"
  | "understands-quiet-works"
  | "translates-excluded-actor"
  | "holds-map-changing-evidence"
  | "benefits-from-delay"
  | "sovereign-exception";

export type DarkTombRoleId =
  | "wakekeeper"
  | "surface-bearer"
  | "maintainer"
  | "interlocutor"
  | "witness"
  | "deliberator"
  | "exception";

export interface DarkTombCastMember {
  id: string;
  name: string;
  roleId: DarkTombRoleId;
  responsibility: DarkTombCastResponsibility;
  description: string;
  factionId?: string;
}

export type DarkTombConsequenceKind =
  | "citizen"
  | "dependency"
  | "route"
  | "archive"
  | "doctrine"
  | "adaptive-capacity"
  | "trauma"
  | "visibility"
  | "jurisdiction"
  | "alarm-state"
  | "habitat"
  | "constituency";

export interface DarkTombConsequence {
  id: string;
  label: string;
  kind: DarkTombConsequenceKind;
  description: string;
  inheritedBy: string;
}

export interface DarkTombStoryPhysics {
  noPerfectInvisibility: boolean;
  everyComfortHasWake: boolean;
  everyLayerHasResidue: boolean;
  mapIsPoliticalClaim: boolean;
  defensesOutliveEnemies: boolean;
  externalOpacityCanCrownWithin: boolean;
  hubIsStory: boolean;
  everyDelveChangesTomb: boolean;
  treasureCreatesConstituencies: boolean;
  scaleIsDistributed: boolean;
}

export type DarkTombAttributeId =
  | "care"
  | "evidence"
  | "systems"
  | "jurisdiction"
  | "opacity"
  | "resolve";

export interface DarkTombCheckBlueprint {
  id: string;
  name: string;
  description: string;
  scope: "team" | "role" | "per-agent";
  roleIds?: DarkTombRoleId[];
  weights: Partial<Record<DarkTombAttributeId, number>>;
  threshold: number;
  failureType?: "agent_damage" | "team_damage" | "stress" | "debuff" | "cascade";
  severity?: number;
}

export type DarkTombDelveTier = "ordinary-life" | "descent" | "breach" | "return";

export interface DarkTombExpeditionLedger {
  objective: string;
  authorizedRoute: string;
  signatureBudget: string;
  authority: string;
  claimToProve: string;
  inheritance: string;
}

export interface DarkTombDelveBlueprint {
  id: string;
  name: string;
  description: string;
  tierId: DarkTombDelveTier;
  layer: DarkTombLayerKind;
  depth: Partial<Record<DarkTombDepthKind, number>>;
  accessAfter?: string;
  expedition: DarkTombExpeditionLedger;
  difficulty: number;
  minAgents: number;
  maxAgents: number;
  requiredRoles?: Array<{ roleId: DarkTombRoleId; count: number }>;
  checks: DarkTombCheckBlueprint[];
  success: string;
  partial: string;
  failure: string;
  reputationGain: number;
  currencyReward: number;
  consequenceId: string;
}

export interface DarkTombPocketSource {
  format: typeof DARK_TOMB_POCKET_FORMAT;
  identity: DarkTombPocketIdentity;
  controlQuestion: string;
  pressures: [
    DarkTombPressure,
    DarkTombPressure,
    DarkTombPressure,
    DarkTombPressure,
    DarkTombPressure,
    DarkTombPressure,
    DarkTombPressure,
    DarkTombPressure,
  ];
  evidence: DarkTombEvidenceLedger;
  factionReceipts: DarkTombFactionReceipt[];
  cast: DarkTombCastMember[];
  anatomy: [
    DarkTombLayer,
    DarkTombLayer,
    DarkTombLayer,
    DarkTombLayer,
    DarkTombLayer,
    DarkTombLayer,
    DarkTombLayer,
  ];
  depths: [DarkTombDepth, DarkTombDepth, DarkTombDepth, DarkTombDepth, DarkTombDepth];
  signatureBudget: DarkTombSignatureBudget;
  alarm: DarkTombLongAlarm;
  consequences: DarkTombConsequence[];
  storyPhysics: DarkTombStoryPhysics;
  delves: DarkTombDelveBlueprint[];
  notes?: JsonValue;
}

/** The compiled Arc carries this exact source under the namespaced extension. */
export type DarkTombPocketExtension = DarkTombPocketSource;
