import type { ActionOutcome } from "../action/types.js";
import type { JsonValue } from "../types.js";

export const AUTHORED_EXPERIENCE_FORMAT = "axm-authored-experience/1" as const;
export const AUTHORED_EXPERIENCE_EXTENSION_KEY = "axm.authored-experience@1" as const;

export type AuthoredObjectiveVerb =
  | "diagnose"
  | "inspect"
  | "operate"
  | "repair"
  | "reroute"
  | "defend"
  | "escort"
  | "subdue"
  | "negotiate";

export type AuthoredObjectiveTargetKind = "actor" | "mechanism" | "area" | "item";

export type AuthoredObjectiveCompletion =
  | {
      kind: "defeat_count";
      targetCount: number;
    }
  | {
      kind: "interact_count";
      targetCount: number;
    }
  | {
      kind: "hold_ticks";
      targetTicks: number;
    }
  | {
      kind: "authored_choice";
      choiceIds: string[];
    };

export interface AuthoredObjectiveBinding {
  verb: AuthoredObjectiveVerb;
  targetKind: AuthoredObjectiveTargetKind;
  targetId: string;
  playerFacingLabel: string;
  completion: AuthoredObjectiveCompletion;
  /** Stable authored identity paid or revealed when this objective completes.
   * Presentation copy is not authority; this identity is what later narrative
   * consequence law may reference. */
  storyPaymentId: string;
}

export type AuthoredRuntimeSignalKind = "information" | "actor" | "route" | "presentation" | "affordance";

export interface AuthoredRuntimeSignal {
  kind: AuthoredRuntimeSignalKind;
  id: string;
}

export interface AuthoredCommitment {
  id: string;
  label: string;
  description: string;
  /** At least one runtime-visible signal must differ before the deterministic
   * action begins. A remembered result-screen sentence is not a runtime change. */
  runtimeSignals: AuthoredRuntimeSignal[];
}

export type AuthoredRevealTrigger = "objective_started" | "objective_completed";

export interface AuthoredReveal {
  id: string;
  objectiveId: string;
  trigger: AuthoredRevealTrigger;
  actorId: string;
  factId: string;
}

export interface AuthoredExperienceOutcome {
  factIds: string[];
  openedObligationIds: string[];
  resolvedObligationIds: string[];
  nextExperienceIds: string[];
  terminal?: boolean;
}

export interface AuthoredExperienceEntry {
  beatId: string;
  title: string;
  playerRoleId: string;
  playerRoleLabel: string;
  ordinaryStake: string;
  primaryActionLabel: string;
}

export interface AuthoredExperienceDefinition {
  challengeId: string;
  entry: AuthoredExperienceEntry;
  commitments: AuthoredCommitment[];
  objectiveBindings: Record<string, AuthoredObjectiveBinding>;
  reveals: AuthoredReveal[];
  outcomes: Record<ActionOutcome, AuthoredExperienceOutcome>;
  checkpointKey: string;
  extensions?: Record<string, JsonValue>;
}

export interface AuthoredExperienceProfile {
  format: typeof AUTHORED_EXPERIENCE_FORMAT;
  experiences: Record<string, AuthoredExperienceDefinition>;
  extensions?: Record<string, JsonValue>;
}
