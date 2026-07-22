import "../engine/abi13.js";
import type { CartridgeStateDefinition, CartridgeStateEffect } from "../engine/abi13.js";
import type { Arc } from "../engine/types.js";
import { validateArc } from "../engine/schema.js";
import { compileDarkTombPocket as compileBaseDarkTombPocket } from "./compiler-base.js";
import { parseDarkTombPocket } from "./schema.js";
import { DARK_TOMB_EXTENSION_KEY, type DarkTombPocketSource } from "./types.js";

function consequenceStateId(source: DarkTombPocketSource["consequences"][number]): string {
  return `consequence:${source.kind}:${source.id}`;
}

function stateDefinitions(source: DarkTombPocketSource): CartridgeStateDefinition[] {
  const alarmValues = source.alarm.phases.map((record) => record.phase);
  return [
    {
      id: "alarm-phase",
      label: "Long Alarm phase",
      description: source.alarm.auditProblem,
      visibility: "operator",
      kind: "enum",
      initial: source.alarm.currentPhase,
      values: alarmValues,
    },
    {
      id: "signature-status",
      label: "Signature status",
      description: `Whether ${source.signatureBudget.exteriorClassification} remains credible to ${source.signatureBudget.observer}.`,
      visibility: "operator",
      kind: "enum",
      initial: "credible",
      values: ["credible", "strained", "breached"],
    },
    {
      id: "visibility-status",
      label: "Visibility status",
      description: "How far the inhabited system has moved from maintained misclassification toward external recognition.",
      visibility: "public",
      kind: "enum",
      initial: "hidden",
      values: ["hidden", "suspected", "exposed"],
    },
    ...source.consequences.map((consequence) => ({
      id: consequenceStateId(consequence),
      label: consequence.label,
      description: `${consequence.description} Inherited by ${consequence.inheritedBy}.`,
      visibility: "public" as const,
      kind: "boolean" as const,
      initial: false,
    })),
  ];
}

function effectsFor(
  source: DarkTombPocketSource,
  delve: DarkTombPocketSource["delves"][number],
): CartridgeStateEffect[] {
  const consequence = source.consequences.find((candidate) => candidate.id === delve.consequenceId);
  if (!consequence) throw new Error(`Dark Tomb delve ${delve.id} references missing consequence ${delve.consequenceId}.`);
  const effects: CartridgeStateEffect[] = [{
    stateId: consequenceStateId(consequence),
    operation: "set",
    value: true,
    reason: consequence.description,
  }];

  if (delve.tierId === "breach") {
    effects.push({
      stateId: "signature-status",
      operation: "set",
      value: consequence.kind === "visibility" ? "breached" : "strained",
      reason: `The breach changes the credibility of ${source.signatureBudget.exteriorClassification}.`,
    });
    effects.push({
      stateId: "visibility-status",
      operation: "set",
      value: consequence.kind === "visibility" ? "exposed" : "suspected",
      reason: "The breach makes the tomb more legible to outside actors.",
    });
  }
  if (consequence.kind === "alarm-state") {
    effects.push({
      stateId: "alarm-phase",
      operation: "set",
      value: "wake",
      reason: consequence.description,
    });
  }
  if (consequence.kind === "visibility") {
    effects.push({
      stateId: "visibility-status",
      operation: "set",
      value: "exposed",
      reason: consequence.description,
    });
  }
  return effects;
}

export function compileDarkTombPocket(input: unknown): Arc {
  const source = parseDarkTombPocket(input);
  const base = compileBaseDarkTombPocket(source);
  const delveById = new Map(source.delves.map((delve) => [delve.id, delve]));
  const arc: Arc = {
    ...base,
    meta: { ...base.meta, engineVersion: "1.3.0" },
    stateDefinitions: stateDefinitions(source),
    challenges: base.challenges.map((challenge) => {
      const delve = delveById.get(challenge.id);
      if (!delve) throw new Error(`Dark Tomb challenge ${challenge.id} has no delve source.`);
      return {
        ...challenge,
        outcomes: {
          success: { ...challenge.outcomes.success, stateEffects: effectsFor(source, delve) },
          partial: challenge.outcomes.partial,
          failure: challenge.outcomes.failure,
        },
      };
    }),
  };
  return validateArc(arc);
}

export function readDarkTombPocketExtension(arc: Arc): DarkTombPocketSource | null {
  const value = arc.extensions?.[DARK_TOMB_EXTENSION_KEY];
  return value === undefined ? null : parseDarkTombPocket(value);
}
