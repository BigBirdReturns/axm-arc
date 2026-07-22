import type { JsonPrimitive } from "./types.js";

export type CartridgeStateValue = JsonPrimitive;
export type CartridgeStateVisibility = "public" | "operator" | "private";

interface CartridgeStateDefinitionBase {
  id: string;
  label: string;
  description: string;
  visibility: CartridgeStateVisibility;
}

export interface NumberStateDefinition extends CartridgeStateDefinitionBase {
  kind: "number";
  initial: number;
  min: number;
  max: number;
}

export interface EnumStateDefinition extends CartridgeStateDefinitionBase {
  kind: "enum";
  initial: string;
  values: string[];
}

export interface BooleanStateDefinition extends CartridgeStateDefinitionBase {
  kind: "boolean";
  initial: boolean;
}

export type CartridgeStateDefinition =
  | NumberStateDefinition
  | EnumStateDefinition
  | BooleanStateDefinition;

interface CartridgeStateEffectBase {
  stateId: string;
  reason: string;
}

export type CartridgeStateEffect =
  | (CartridgeStateEffectBase & {
      operation: "set";
      value: CartridgeStateValue;
    })
  | (CartridgeStateEffectBase & {
      operation: "increment" | "decrement";
      value: number;
      overflow?: "reject" | "clamp";
    })
  | (CartridgeStateEffectBase & {
      operation: "transition";
      from?: string;
      to: string;
    });

export interface CartridgeStateChange {
  stateId: string;
  before: CartridgeStateValue;
  after: CartridgeStateValue;
  operation: CartridgeStateEffect["operation"];
  reason: string;
  source: {
    challengeId: string;
    outcome: "success" | "partial" | "failure";
    cycle: number;
  };
}

export interface CompositionRange {
  min: number;
  max: number;
}

export interface CompositionProfile {
  id: string;
  name: string;
  description: string;
  tags: string[];
  metrics: Record<string, number>;
  ranges: Record<string, CompositionRange>;
  dependencies: string[];
}

interface CompositionConstraintBase {
  id: string;
  label: string;
  category?: string;
}

export type CompositionComparison = "gte" | "lte" | "eq";

export type CompositionConstraint =
  | (CompositionConstraintBase & {
      kind: "role-count";
      roleId: string;
      min: number;
      max?: number;
    })
  | (CompositionConstraintBase & {
      kind: "profile-count";
      profileIds: string[];
      min: number;
      max?: number;
    })
  | (CompositionConstraintBase & {
      kind: "tag-count";
      tag: string;
      min: number;
      max?: number;
    })
  | (CompositionConstraintBase & {
      kind: "metric-sum";
      metric: string;
      comparison: CompositionComparison;
      threshold: number;
    })
  | (CompositionConstraintBase & {
      kind: "range-overlap";
      range: string;
      required: CompositionRange;
      minProfiles: number;
    })
  | (CompositionConstraintBase & {
      kind: "fraction";
      tag: string;
      minFraction: number;
    })
  | (CompositionConstraintBase & {
      kind: "redundancy";
      tag: string;
      minDistinctProfiles: number;
    })
  | (CompositionConstraintBase & {
      kind: "all" | "any";
      constraints: CompositionConstraint[];
    });

export interface CompositionConstraintResult {
  id: string;
  label: string;
  kind: CompositionConstraint["kind"];
  category?: string;
  passed: boolean;
  reason: string;
  matchedAgentIds: string[];
  children?: CompositionConstraintResult[];
}

export interface CompositionEvaluation {
  feasible: boolean;
  results: CompositionConstraintResult[];
  rejectionReasons: string[];
  dependencies: string[];
  singlePointsOfFailure: string[];
}

declare module "./types.js" {
  interface Agent {
    /** Optional engine-1.3 profile binding. The profile is authored by the Arc. */
    compositionProfileId?: string;
  }

  interface FoundingRosterSlot {
    compositionProfileId?: string;
  }

  interface Organization {
    /** Engine-owned, cartridge-authored state. Missing on v2 saves and backfilled deterministically. */
    cartridgeState?: Record<string, CartridgeStateValue>;
  }

  interface Outcome {
    stateEffects?: CartridgeStateEffect[];
  }

  interface Challenge {
    compositionConstraints?: CompositionConstraint[];
  }

  interface RunReport {
    stateChanges?: CartridgeStateChange[];
    composition?: CompositionEvaluation;
  }

  interface Arc {
    stateDefinitions?: CartridgeStateDefinition[];
    compositionProfiles?: CompositionProfile[];
  }
}
