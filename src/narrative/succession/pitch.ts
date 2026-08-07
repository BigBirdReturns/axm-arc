import { compareCodepoints, uniqueOrdered } from "./determinism.js";
import type { NarrativeHandoffPacket } from "./model.js";
import type { SeriesIncident, SeriesIncidentFamily } from "./series.js";

export const NARRATIVE_PITCH_FORMAT = "axm-narrative-pitch/1" as const;

export interface NarrativePitchSourceRefs {
  pressureIds: string[];
  evidenceReceiptIds: string[];
  factionIds: string[];
  consequenceIds: string[];
}

export interface NarrativeMechanismPitch {
  format: typeof NARRATIVE_PITCH_FORMAT;
  id: string;
  version: string;
  title: string;
  family: SeriesIncidentFamily;
  primarySourceObjectId: string;
  ordinaryGood: string;
  actorMethod: string;
  pressure: string;
  affectedActor: string;
  affectedResponsibility: string;
  evidenceLimit: string;
  concreteCost: string;
  persistentChange: string;
  controlQuestion: string;
  sourceRefs: NarrativePitchSourceRefs;
  severity: number;
  tags?: string[];
}

export interface NarrativePitchIssue {
  code: string;
  path: string;
  detail: string;
}

export interface NarrativePitchCompilationReceipt {
  format: "axm-narrative-pitch-compilation/1";
  pitchId: string;
  sourceId: string;
  issues: NarrativePitchIssue[];
  incident: SeriesIncident | null;
  passed: boolean;
}

function issue(code: string, path: string, detail: string): NarrativePitchIssue {
  return { code, path, detail };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requireText(issues: NarrativePitchIssue[], value: unknown, path: string): void {
  if (!nonEmpty(value)) issues.push(issue("missing-mechanism-field", path, `${path} must be non-empty`));
}

function familyDebt(family: SeriesIncidentFamily): { addresses: string[]; opens: string } {
  switch (family) {
    case "faction-overreach":
      return { addresses: ["constituency-debt", "knowledge-debt"], opens: "legitimacy-debt" };
    case "evidence-limit":
      return { addresses: ["legitimacy-debt", "constituency-debt"], opens: "knowledge-debt" };
    case "consequence-claim":
      return { addresses: ["knowledge-debt", "legitimacy-debt"], opens: "constituency-debt" };
  }
}

export function validateNarrativePitch(packet: NarrativeHandoffPacket, pitch: NarrativeMechanismPitch): NarrativePitchIssue[] {
  const issues: NarrativePitchIssue[] = [];
  if (pitch.format !== NARRATIVE_PITCH_FORMAT) issues.push(issue("invalid-pitch-format", "format", `expected ${NARRATIVE_PITCH_FORMAT}`));
  for (const [path, value] of [
    ["id", pitch.id],
    ["version", pitch.version],
    ["title", pitch.title],
    ["ordinaryGood", pitch.ordinaryGood],
    ["actorMethod", pitch.actorMethod],
    ["pressure", pitch.pressure],
    ["affectedActor", pitch.affectedActor],
    ["affectedResponsibility", pitch.affectedResponsibility],
    ["evidenceLimit", pitch.evidenceLimit],
    ["concreteCost", pitch.concreteCost],
    ["persistentChange", pitch.persistentChange],
    ["controlQuestion", pitch.controlQuestion],
    ["primarySourceObjectId", pitch.primarySourceObjectId],
  ] as const) requireText(issues, value, path);

  if (!Number.isInteger(pitch.severity) || pitch.severity < 1 || pitch.severity > 100) {
    issues.push(issue("invalid-severity", "severity", "severity must be an integer from 1 through 100"));
  }
  if (!pitch.controlQuestion.trim().endsWith("?")) {
    issues.push(issue("not-a-control-question", "controlQuestion", "control question must end with a question mark"));
  }

  const pressureIds = new Set(packet.pressures.map((entry) => entry.id));
  const evidenceIds = new Set(packet.evidence.receipts.map((entry) => entry.id));
  const factionIds = new Set(packet.factions.map((entry) => entry.factionId));
  const consequenceIds = new Set(packet.consequences.map((entry) => entry.id));
  for (const id of pitch.sourceRefs.pressureIds) if (!pressureIds.has(id)) issues.push(issue("unknown-source-reference", "sourceRefs.pressureIds", `unknown pressure ${id}`));
  for (const id of pitch.sourceRefs.evidenceReceiptIds) if (!evidenceIds.has(id)) issues.push(issue("unknown-source-reference", "sourceRefs.evidenceReceiptIds", `unknown evidence receipt ${id}`));
  for (const id of pitch.sourceRefs.factionIds) if (!factionIds.has(id)) issues.push(issue("unknown-source-reference", "sourceRefs.factionIds", `unknown faction ${id}`));
  for (const id of pitch.sourceRefs.consequenceIds) if (!consequenceIds.has(id)) issues.push(issue("unknown-source-reference", "sourceRefs.consequenceIds", `unknown consequence ${id}`));
  const totalRefs = Object.values(pitch.sourceRefs).reduce((sum, values) => sum + values.length, 0);
  if (totalRefs < 2 || pitch.sourceRefs.pressureIds.length === 0) {
    issues.push(issue("insufficient-source-binding", "sourceRefs", "pitch must cite a pressure plus at least one additional source object"));
  }

  const primaryAllowed =
    pitch.family === "faction-overreach"
      ? pitch.sourceRefs.factionIds
      : pitch.family === "evidence-limit"
        ? pitch.sourceRefs.evidenceReceiptIds
        : pitch.sourceRefs.consequenceIds;
  if (!primaryAllowed.includes(pitch.primarySourceObjectId)) {
    issues.push(issue("invalid-primary-source", "primarySourceObjectId", `${pitch.primarySourceObjectId} is not cited in the selected family`));
  }

  const methodActors = packet.actors.filter((actor) => actor.baselineMoves.includes(pitch.actorMethod));
  if (methodActors.length === 0) issues.push(issue("unknown-actor-method", "actorMethod", `${pitch.actorMethod} is not available to any actor`));
  if (!packet.actors.some((actor) => actor.responsibility === pitch.affectedResponsibility)) {
    issues.push(issue("unknown-cast-responsibility", "affectedResponsibility", `${pitch.affectedResponsibility} is not represented`));
  }
  if (methodActors.some((actor) => actor.responsibility === pitch.affectedResponsibility) && pitch.affectedActor === methodActors[0]?.name) {
    issues.push(issue("collapsed-conflict", "affectedActor", "the acting method and affected party must remain distinguishable"));
  }

  return issues.sort((left, right) => compareCodepoints(left.path, right.path) || compareCodepoints(left.code, right.code));
}

export function compileNarrativePitch(
  packet: NarrativeHandoffPacket,
  pitch: NarrativeMechanismPitch,
): NarrativePitchCompilationReceipt {
  const issues = validateNarrativePitch(packet, pitch);
  if (issues.length > 0) {
    return {
      format: "axm-narrative-pitch-compilation/1",
      pitchId: pitch.id,
      sourceId: packet.source.id,
      issues,
      incident: null,
      passed: false,
    };
  }
  const debt = familyDebt(pitch.family);
  const incident: SeriesIncident = {
    id: `incident:pitch:${pitch.id}`,
    family: pitch.family,
    title: pitch.title,
    summary: `${pitch.ordinaryGood} ${pitch.actorMethod} now converts ${pitch.pressure} into a conflict borne by ${pitch.affectedActor}. The evidentiary limit is ${pitch.evidenceLimit}. The concrete cost is ${pitch.concreteCost}. The required inheritance is ${pitch.persistentChange}`,
    sourceObjectId: pitch.primarySourceObjectId,
    tags: uniqueOrdered([
      `source:${packet.source.id}`,
      `pitch:${pitch.id}`,
      `series-family:${pitch.family}`,
      `move:${pitch.actorMethod}`,
      `responsibility:${pitch.affectedResponsibility}`,
      ...pitch.sourceRefs.pressureIds.map((id) => `pressure-id:${id}`),
      ...pitch.sourceRefs.evidenceReceiptIds.map((id) => `evidence:${id}`),
      ...pitch.sourceRefs.factionIds.map((id) => `faction:${id}`),
      ...pitch.sourceRefs.consequenceIds.map((id) => `consequence-id:${id}`),
      ...(pitch.tags ?? []),
    ]),
    severity: pitch.severity,
    addressesObligationKinds: debt.addresses,
    opensObligationKind: debt.opens,
    pitchId: pitch.id,
    mechanism: {
      ordinaryGood: pitch.ordinaryGood,
      actorMethod: pitch.actorMethod,
      pressure: pitch.pressure,
      affectedActor: pitch.affectedActor,
      evidenceLimit: pitch.evidenceLimit,
      concreteCost: pitch.concreteCost,
      persistentChange: pitch.persistentChange,
      controlQuestion: pitch.controlQuestion,
    },
  };
  return {
    format: "axm-narrative-pitch-compilation/1",
    pitchId: pitch.id,
    sourceId: packet.source.id,
    issues: [],
    incident,
    passed: true,
  };
}
