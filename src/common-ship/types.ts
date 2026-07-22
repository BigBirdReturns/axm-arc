import type { JsonValue } from "../engine/types.js";
import type {
  CanonRelation,
  CanonTier,
  GodscarEvidenceLedger,
  GodscarFactionReceipt,
  GodscarPocketIdentity,
} from "../godscar/types.js";

export const COMMON_SHIP_POCKET_FORMAT = "common-ship-pocket/1" as const;
export const COMMON_SHIP_EXTENSION_KEY = "godscar.common-ship@1" as const;

/** Book III remains inside the evidence and canon discipline established by Books I and II. */
export type CommonShipCanonTier = CanonTier;
export type CommonShipCanonRelation = CanonRelation;
export type CommonShipPocketIdentity = GodscarPocketIdentity;
export type CommonShipEvidenceLedger = GodscarEvidenceLedger;
export type CommonShipFactionReceipt = GodscarFactionReceipt;

export type CommonShipPressureKind =
  | "vessel-form"
  | "mission"
  | "host-baseline"
  | "temporal-conflict"
  | "ordinary-good"
  | "excluded-actor"
  | "approaching-trigger"
  | "cost-of-adaptation"
  | "scale-revelation";

export interface CommonShipPressure {
  kind: CommonShipPressureKind;
  id: string;
  label: string;
  description: string;
}

export type CommonShipSystemKind =
  | "transit-body"
  | "habitat-bands"
  | "common-thresholds"
  | "translation-mesh"
  | "watch-lattice"
  | "continuity-commons"
  | "sovereign-core";

export interface CommonShipSystem {
  kind: CommonShipSystemKind;
  label: string;
  description: string;
  currentUse: string;
  hostAssumption: string;
  revisionAuthority: string;
}

export type TemporalDimensionKind =
  | "external-interval"
  | "subjective-resolution"
  | "developmental-tempo"
  | "recovery-cycle"
  | "continuity-span"
  | "life-fraction-cost";

export interface TemporalDimension {
  kind: TemporalDimensionKind;
  description: string;
  operationalUse: string;
  captureRisk: string;
}

export type TranslationLayerKind =
  | "meaning"
  | "tempo"
  | "sensorium"
  | "interface"
  | "environment"
  | "authority"
  | "memory-and-handoff";

export interface TranslationLayer {
  kind: TranslationLayerKind;
  description: string;
  intermediary: string;
  failureMode: string;
  refusalPath: string;
}

export type CommonWatchTestKind =
  | "role-coverage"
  | "temporal-overlap"
  | "habitat-compatibility"
  | "translation-resilience"
  | "handoff-continuity"
  | "life-fraction-fairness";

export interface CommonWatchTest {
  kind: CommonWatchTestKind;
  description: string;
  passCondition: string;
  failureConsequence: string;
}

export type ShipStateTrackKind =
  | "habitat-integrity"
  | "temporal-coherence"
  | "translation-trust"
  | "roster-resilience"
  | "stores-and-care"
  | "continuity"
  | "visibility"
  | "compatibility-debt";

export interface ShipStateTrack {
  kind: ShipStateTrackKind;
  value: number;
  description: string;
  crisisCondition: string;
}

export type CommonShipCastResponsibility =
  | "depends-on-host-baseline"
  | "bears-adaptation-tax"
  | "understands-maintenance-reality"
  | "translates-excluded-actor"
  | "benefits-from-delay"
  | "sovereign-exception";

export type CommonShipRoleId =
  | "response"
  | "mediation"
  | "analysis"
  | "maintenance"
  | "care"
  | "continuity";

export interface CommonShipCastMember {
  id: string;
  name: string;
  roleId: CommonShipRoleId;
  responsibility: CommonShipCastResponsibility;
  description: string;
  factionId?: string;
}

export type CommonShipConsequenceKind =
  | "citizen"
  | "dependency"
  | "route"
  | "archive"
  | "doctrine"
  | "adaptive-capacity"
  | "trauma"
  | "habitat"
  | "schedule"
  | "interface"
  | "readiness-debt"
  | "recovery-debt"
  | "compatibility-debt"
  | "continuity"
  | "visibility"
  | "jurisdiction";

export interface CommonShipConsequence {
  id: string;
  label: string;
  kind: CommonShipConsequenceKind;
  description: string;
  inheritedBy: string;
}

export interface CommonShipStoryPhysics {
  noNeutralEnvironment: boolean;
  clockIsNotExperience: boolean;
  translationHasAuthorship: boolean;
  rosterIsEcology: boolean;
  everyAccommodationCreatesDependency: boolean;
  emergencyRevealsNativeUser: boolean;
  handoffsArePoliticalEvents: boolean;
  travelSpendsUnequalLife: boolean;
  vesselMayBePerson: boolean;
  everyMissionRevisesConstitution: boolean;
}

export type CommonShipAttributeId =
  | "care"
  | "systems"
  | "translation"
  | "continuity"
  | "judgment"
  | "resolve";

export interface CommonShipCheckBlueprint {
  id: string;
  name: string;
  description: string;
  scope: "team" | "role" | "per-agent";
  roleIds?: CommonShipRoleId[];
  weights: Partial<Record<CommonShipAttributeId, number>>;
  threshold: number;
  failureType?: "agent_damage" | "team_damage" | "stress" | "debuff" | "cascade";
  severity?: number;
}

export type CommonShipWatchTier = "ordinary-life" | "compose-watch" | "resolve-pressure" | "handoff";

export interface DecisionHorizonLedger {
  closesWhen: string;
  physicalUrgency: string;
  informationalUrgency: string;
  institutionalUrgency: string;
  manufacturedUrgency: string;
}

export interface ProfileLedger {
  requiredBodies: string[];
  requiredHabitats: string[];
  requiredClocks: string[];
  requiredTranslators: string[];
  requiredReserves: string[];
  lifeFractionCosts: string[];
}

export interface WatchCompositionLedger {
  absentActor: string;
  excludedBody: string;
  dependency: string;
}

export interface CommonSystemsAllocation {
  habitatBands: string;
  translationPaths: string;
  directInterfaces: string;
  standby: string;
  stores: string;
  emergencyAuthority: string;
}

export interface HandoffLedger {
  dissent: string;
  injury: string;
  readinessDebt: string;
  promises: string;
  missingPersons: string;
  uncertainty: string;
}

export interface PrecedentLedger {
  newlyPossible: string;
  newlyImpossible: string;
  newlyGovernable: string;
  inheritedAsInfrastructure: string;
}

export interface ShipStateEffect {
  track: ShipStateTrackKind;
  delta: number;
  reason: string;
}

export interface CommonShipWatchBlueprint {
  id: string;
  name: string;
  description: string;
  tierId: CommonShipWatchTier;
  system: CommonShipSystemKind;
  accessAfter?: string;
  horizon: DecisionHorizonLedger;
  profiles: ProfileLedger;
  composition: WatchCompositionLedger;
  allocation: CommonSystemsAllocation;
  handoff: HandoffLedger;
  precedent: PrecedentLedger;
  difficulty: number;
  minAgents: number;
  maxAgents: number;
  requiredRoles?: Array<{ roleId: CommonShipRoleId; count: number }>;
  checks: CommonShipCheckBlueprint[];
  success: string;
  partial: string;
  failure: string;
  reputationGain: number;
  currencyReward: number;
  consequenceId: string;
  shipStateEffects: ShipStateEffect[];
}

export interface CommonShipPocketSource {
  format: typeof COMMON_SHIP_POCKET_FORMAT;
  identity: CommonShipPocketIdentity;
  controlQuestion: string;
  pressures: [
    CommonShipPressure,
    CommonShipPressure,
    CommonShipPressure,
    CommonShipPressure,
    CommonShipPressure,
    CommonShipPressure,
    CommonShipPressure,
    CommonShipPressure,
    CommonShipPressure,
  ];
  evidence: CommonShipEvidenceLedger;
  factionReceipts: CommonShipFactionReceipt[];
  cast: CommonShipCastMember[];
  anatomy: [
    CommonShipSystem,
    CommonShipSystem,
    CommonShipSystem,
    CommonShipSystem,
    CommonShipSystem,
    CommonShipSystem,
    CommonShipSystem,
  ];
  temporalProfile: [
    TemporalDimension,
    TemporalDimension,
    TemporalDimension,
    TemporalDimension,
    TemporalDimension,
    TemporalDimension,
  ];
  translationStack: [
    TranslationLayer,
    TranslationLayer,
    TranslationLayer,
    TranslationLayer,
    TranslationLayer,
    TranslationLayer,
    TranslationLayer,
  ];
  watchTests: [
    CommonWatchTest,
    CommonWatchTest,
    CommonWatchTest,
    CommonWatchTest,
    CommonWatchTest,
    CommonWatchTest,
  ];
  shipState: [
    ShipStateTrack,
    ShipStateTrack,
    ShipStateTrack,
    ShipStateTrack,
    ShipStateTrack,
    ShipStateTrack,
    ShipStateTrack,
    ShipStateTrack,
  ];
  consequences: CommonShipConsequence[];
  storyPhysics: CommonShipStoryPhysics;
  watches: CommonShipWatchBlueprint[];
  notes?: JsonValue;
}

/** The compiled Arc carries this exact source under the namespaced extension. */
export type CommonShipPocketExtension = CommonShipPocketSource;
