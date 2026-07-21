import type { JsonValue } from "../engine/types.js";

export const GODSCAR_POCKET_FORMAT = "godscar-pocket/1" as const;
export const GODSCAR_EXTENSION_KEY = "godscar.pocket@1" as const;

export type CanonTier =
  | "settled-canon"
  | "contested-canon"
  | "faction-doctrine"
  | "story-facing-unknown";

export type CanonRelation =
  | "foundational"
  | "compatible"
  | "contested"
  | "alternate-sequence"
  | "crossover"
  | "private-branch";

export type GodscarPressureKind =
  | "pocket"
  | "patron"
  | "excluded-actor"
  | "approaching-trigger"
  | "cost-of-resistance"
  | "scale-revelation";

export interface GodscarPressure {
  kind: GodscarPressureKind;
  id: string;
  label: string;
  description: string;
}

export interface GodscarProvenanceReceipt {
  id: string;
  label: string;
  source: string;
  intervention: string;
  limits: string;
}

export interface GodscarEvidenceLedger {
  tier: CanonTier;
  claim: string;
  venue: string;
  legitimacyTarget: string;
  upsideIfAccepted: string;
  downsideIfAccepted: string;
  failureIfFalse: string;
  receipts: GodscarProvenanceReceipt[];
}

export interface GodscarFactionReceipt {
  factionId: string;
  factionName: string;
  variableControlled: string;
  publicGood: string;
  characteristicFailure: string;
}

export type GodscarCastResponsibility =
  | "depends-on-system"
  | "translates-excluded-actor"
  | "holds-evidence"
  | "benefits-from-delay"
  | "sovereign-exception";

export interface GodscarCastMember {
  id: string;
  name: string;
  roleId: "auditor" | "interlocutor" | "witness" | "protector" | "exception";
  responsibility: GodscarCastResponsibility;
  description: string;
  factionId?: string;
}

export interface GodscarConsequence {
  id: string;
  label: string;
  kind: "citizen" | "dependency" | "route" | "archive" | "doctrine" | "adaptive-capacity" | "trauma";
  description: string;
  inheritedBy: string;
}

export interface GodscarStoryPhysics {
  noCleanReset: boolean;
  crowningIsConcentration: boolean;
  answerReflectsExclusion: boolean;
  counterformInheritsClaim: boolean;
  scaleIsDistributed: boolean;
  distanceRemainsPolitical: boolean;
  factionReceiptsRequired: boolean;
  everyVictoryChangesMap: boolean;
}

export interface GodscarCheckBlueprint {
  id: string;
  name: string;
  description: string;
  scope: "team" | "role" | "per-agent";
  roleIds?: Array<GodscarCastMember["roleId"]>;
  weights: Partial<Record<"care" | "evidence" | "exteriority" | "systems" | "resolve", number>>;
  threshold: number;
  failureType?: "agent_damage" | "team_damage" | "stress" | "debuff" | "cascade";
  severity?: number;
}

export interface GodscarBeatBlueprint {
  id: string;
  name: string;
  description: string;
  tierId: "arrival" | "disclosure" | "refusal";
  accessAfter?: string;
  difficulty: number;
  minAgents: number;
  maxAgents: number;
  requiredRoles?: Array<{ roleId: GodscarCastMember["roleId"]; count: number }>;
  checks: GodscarCheckBlueprint[];
  success: string;
  partial: string;
  failure: string;
  reputationGain: number;
  currencyReward: number;
  consequenceId: string;
}

export interface GodscarPocketIdentity {
  id: string;
  title: string;
  description: string;
  author: string;
  version: string;
  estimatedCycles: number;
  parentCanons: string[];
  canonRelation: CanonRelation;
}

export interface GodscarPocketSource {
  format: typeof GODSCAR_POCKET_FORMAT;
  identity: GodscarPocketIdentity;
  controlQuestion: string;
  pressures: [GodscarPressure, GodscarPressure, GodscarPressure, GodscarPressure, GodscarPressure, GodscarPressure];
  evidence: GodscarEvidenceLedger;
  factionReceipts: GodscarFactionReceipt[];
  cast: GodscarCastMember[];
  consequences: GodscarConsequence[];
  storyPhysics: GodscarStoryPhysics;
  beats: GodscarBeatBlueprint[];
  notes?: JsonValue;
}

/** The value stored inside Arc.extensions. Kept identical to the source so the
 * cartridge remains inspectable, forkable, and exportable without a server. */
export type GodscarPocketExtension = GodscarPocketSource;
