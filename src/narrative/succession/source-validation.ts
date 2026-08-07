import { compareCodepoints, fingerprint, uniqueOrdered } from "./determinism.js";
import {
  NARRATIVE_AGENCY_FORMAT,
  NARRATIVE_HANDOFF_FORMAT,
  type BeatFunction,
  type ContinuingUniverseSource,
  type NarrativeHandoffPacket,
} from "./model.js";

export type NarrativeValidationSeverity = "error" | "warning";

export interface NarrativeValidationIssue {
  code: string;
  severity: NarrativeValidationSeverity;
  path: string;
  detail: string;
}

const GODSCAR_PRESSURES = [
  "pocket",
  "patron",
  "excluded-actor",
  "approaching-trigger",
  "cost-of-resistance",
  "scale-revelation",
] as const;

const TOMB_PRESSURES = [
  "tomb-form",
  "exterior-lie",
  "custodian",
  "ordinary-good",
  "excluded-actor",
  "approaching-breach",
  "cost-of-opening-or-closing",
  "scale-revelation",
] as const;

const GODSCAR_RESPONSIBILITIES = [
  "depends-on-system",
  "translates-excluded-actor",
  "holds-evidence",
  "benefits-from-delay",
  "sovereign-exception",
] as const;

const TOMB_RESPONSIBILITIES = [
  "depends-on-alarm",
  "bears-cost-of-concealment",
  "understands-quiet-works",
  "translates-excluded-actor",
  "holds-map-changing-evidence",
  "benefits-from-delay",
  "sovereign-exception",
] as const;

const REQUIRED_RAIL_ORDER: BeatFunction[] = ["establish", "pressure", "reveal", "escalate", "choose", "consequence"];

export type NarrativeHandoffFingerprintInput =
  | NarrativeHandoffPacket
  | Omit<NarrativeHandoffPacket, "handoffFingerprint">;

/** Canonical digest of the complete public handoff authority. The digest field
 * itself is excluded so validation can recompute it without recursion. */
export function computeNarrativeHandoffFingerprint(packet: NarrativeHandoffFingerprintInput): string {
  const { handoffFingerprint: _ignored, ...authority } = packet as NarrativeHandoffPacket;
  return fingerprint(authority);
}

function issue(code: string, path: string, detail: string, severity: NarrativeValidationSeverity = "error"): NarrativeValidationIssue {
  return { code, path, detail, severity };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requireText(issues: NarrativeValidationIssue[], value: unknown, path: string): void {
  if (!nonEmpty(value)) issues.push(issue("missing-text", path, `${path} must be non-empty`));
}

function duplicateIds(values: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value).sort(compareCodepoints);
}

function requireUniqueIds(issues: NarrativeValidationIssue[], values: readonly string[], path: string): void {
  for (const id of duplicateIds(values)) issues.push(issue("duplicate-id", path, `${path} contains duplicate id ${id}`));
}

function requireExactVocabulary(
  issues: NarrativeValidationIssue[],
  actual: readonly string[],
  required: readonly string[],
  path: string,
): void {
  const counts = new Map<string, number>();
  for (const value of actual) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const value of required) {
    const count = counts.get(value) ?? 0;
    if (count !== 1) issues.push(issue("required-vocabulary", path, `${path} requires exactly one ${value}; received ${count}`));
  }
  for (const value of uniqueOrdered(actual)) {
    if (!required.includes(value)) issues.push(issue("unknown-vocabulary", path, `${path} contains unsupported ${value}`));
  }
}

export function validateContinuingUniverseSource(source: ContinuingUniverseSource): NarrativeValidationIssue[] {
  const issues: NarrativeValidationIssue[] = [];
  if (source.format !== "godscar-pocket/1" && source.format !== "dark-tomb-pocket/1") {
    issues.push(issue("unsupported-source-format", "format", `unsupported source format ${String(source.format)}`));
    return issues;
  }

  requireText(issues, source.identity?.id, "identity.id");
  requireText(issues, source.identity?.title, "identity.title");
  requireText(issues, source.identity?.description, "identity.description");
  requireText(issues, source.identity?.version, "identity.version");
  requireText(issues, source.controlQuestion, "controlQuestion");

  requireUniqueIds(issues, source.pressures.map((entry) => entry.id), "pressures");
  requireExactVocabulary(
    issues,
    source.pressures.map((entry) => entry.kind),
    source.format === "godscar-pocket/1" ? GODSCAR_PRESSURES : TOMB_PRESSURES,
    "pressures.kind",
  );
  source.pressures.forEach((entry, index) => {
    requireText(issues, entry.id, `pressures[${index}].id`);
    requireText(issues, entry.label, `pressures[${index}].label`);
    requireText(issues, entry.description, `pressures[${index}].description`);
  });

  requireText(issues, source.evidence?.tier, "evidence.tier");
  requireText(issues, source.evidence?.claim, "evidence.claim");
  requireText(issues, source.evidence?.venue, "evidence.venue");
  requireText(issues, source.evidence?.legitimacyTarget, "evidence.legitimacyTarget");
  requireText(issues, source.evidence?.upsideIfAccepted, "evidence.upsideIfAccepted");
  requireText(issues, source.evidence?.downsideIfAccepted, "evidence.downsideIfAccepted");
  requireText(issues, source.evidence?.failureIfFalse, "evidence.failureIfFalse");
  if ((source.evidence?.receipts.length ?? 0) === 0) {
    issues.push(issue("missing-evidence-receipt", "evidence.receipts", "at least one provenance receipt is required"));
  }
  requireUniqueIds(issues, source.evidence.receipts.map((entry) => entry.id), "evidence.receipts");
  source.evidence.receipts.forEach((entry, index) => {
    requireText(issues, entry.id, `evidence.receipts[${index}].id`);
    requireText(issues, entry.label, `evidence.receipts[${index}].label`);
    requireText(issues, entry.source, `evidence.receipts[${index}].source`);
    requireText(issues, entry.intervention, `evidence.receipts[${index}].intervention`);
    requireText(issues, entry.limits, `evidence.receipts[${index}].limits`);
  });

  if (source.factionReceipts.length < 2) {
    issues.push(issue("insufficient-factions", "factionReceipts", "at least two incompatible institutional methods are required"));
  }
  requireUniqueIds(issues, source.factionReceipts.map((entry) => entry.factionId), "factionReceipts");
  source.factionReceipts.forEach((entry, index) => {
    requireText(issues, entry.factionId, `factionReceipts[${index}].factionId`);
    requireText(issues, entry.factionName, `factionReceipts[${index}].factionName`);
    requireText(issues, entry.variableControlled, `factionReceipts[${index}].variableControlled`);
    requireText(issues, entry.publicGood, `factionReceipts[${index}].publicGood`);
    requireText(issues, entry.characteristicFailure, `factionReceipts[${index}].characteristicFailure`);
  });

  requireUniqueIds(issues, source.cast.map((entry) => entry.id), "cast");
  requireExactVocabulary(
    issues,
    source.cast.map((entry) => entry.responsibility),
    source.format === "godscar-pocket/1" ? GODSCAR_RESPONSIBILITIES : TOMB_RESPONSIBILITIES,
    "cast.responsibility",
  );
  const factionIds = new Set(source.factionReceipts.map((entry) => entry.factionId));
  source.cast.forEach((entry, index) => {
    requireText(issues, entry.id, `cast[${index}].id`);
    requireText(issues, entry.name, `cast[${index}].name`);
    requireText(issues, entry.roleId, `cast[${index}].roleId`);
    requireText(issues, entry.responsibility, `cast[${index}].responsibility`);
    requireText(issues, entry.description, `cast[${index}].description`);
    if (entry.factionId && !factionIds.has(entry.factionId)) {
      issues.push(issue("missing-faction-reference", `cast[${index}].factionId`, `unknown faction ${entry.factionId}`));
    }
  });

  if (source.consequences.length === 0) {
    issues.push(issue("missing-consequence", "consequences", "at least one persistent consequence is required"));
  }
  requireUniqueIds(issues, source.consequences.map((entry) => entry.id), "consequences");
  source.consequences.forEach((entry, index) => {
    requireText(issues, entry.id, `consequences[${index}].id`);
    requireText(issues, entry.label, `consequences[${index}].label`);
    requireText(issues, entry.kind, `consequences[${index}].kind`);
    requireText(issues, entry.description, `consequences[${index}].description`);
    requireText(issues, entry.inheritedBy, `consequences[${index}].inheritedBy`);
  });

  const physics = Object.entries(source.storyPhysics ?? {});
  if (physics.length === 0) issues.push(issue("missing-story-physics", "storyPhysics", "Story Physics cannot be empty"));
  for (const [key, enabled] of physics) {
    if (enabled !== true) issues.push(issue("disabled-story-physics", `storyPhysics.${key}`, `${key} must remain true`));
  }

  return issues.sort(
    (left, right) => compareCodepoints(left.path, right.path) || compareCodepoints(left.code, right.code),
  );
}

export function validateNarrativeHandoffPacket(packet: NarrativeHandoffPacket): NarrativeValidationIssue[] {
  const issues: NarrativeValidationIssue[] = [];
  if (packet.format !== NARRATIVE_HANDOFF_FORMAT) {
    issues.push(issue("invalid-handoff-format", "format", `expected ${NARRATIVE_HANDOFF_FORMAT}`));
    return issues;
  }
  if (packet.referencePlotExcluded !== true) {
    issues.push(issue("reference-plot-not-excluded", "referencePlotExcluded", "handoff must explicitly exclude reference plot"));
  }
  requireText(issues, packet.source?.id, "source.id");
  requireText(issues, packet.source?.title, "source.title");
  requireText(issues, packet.source?.version, "source.version");
  requireText(issues, packet.source?.description, "source.description");
  requireText(issues, packet.source?.controlQuestion, "source.controlQuestion");
  requireText(issues, packet.sourceFingerprint, "sourceFingerprint");
  requireText(issues, packet.handoffFingerprint, "handoffFingerprint");
  if (nonEmpty(packet.handoffFingerprint)) {
    const expected = computeNarrativeHandoffFingerprint(packet);
    if (packet.handoffFingerprint !== expected) {
      issues.push(issue("handoff-fingerprint-mismatch", "handoffFingerprint", `expected ${expected}`));
    }
  }

  requireUniqueIds(issues, packet.identityAnchors.map((entry) => entry.id), "identityAnchors");
  if (!packet.identityAnchors.some((entry) => entry.id === "world" && entry.required)) {
    issues.push(issue("missing-world-anchor", "identityAnchors", "a required world identity anchor is mandatory"));
  }
  for (const [index, anchor] of packet.identityAnchors.entries()) {
    if (anchor.anyOfTags.length === 0) issues.push(issue("empty-anchor", `identityAnchors[${index}]`, `${anchor.id} has no tags`));
  }
  if (
    !Number.isInteger(packet.minimumIdentityAnchorMatches) ||
    packet.minimumIdentityAnchorMatches < 1 ||
    packet.minimumIdentityAnchorMatches > packet.identityAnchors.length
  ) {
    issues.push(
      issue(
        "invalid-identity-threshold",
        "minimumIdentityAnchorMatches",
        `identity threshold must be an integer from 1 through ${packet.identityAnchors.length}`,
      ),
    );
  }

  requireUniqueIds(issues, packet.actors.map((entry) => entry.id), "actors");
  for (const [index, actor] of packet.actors.entries()) {
    requireText(issues, actor.id, `actors[${index}].id`);
    requireText(issues, actor.name, `actors[${index}].name`);
    requireText(issues, actor.roleId, `actors[${index}].roleId`);
    requireText(issues, actor.responsibility, `actors[${index}].responsibility`);
    if (actor.baselineMoves.length === 0) issues.push(issue("missing-actor-method", `actors[${index}].baselineMoves`, `${actor.id} has no method`));
    if (actor.goalIds.length === 0) issues.push(issue("missing-actor-goal", `actors[${index}].goalIds`, `${actor.id} has no goal`));
    const forbidden = new Set(actor.forbiddenMoves);
    const overlap = actor.baselineMoves.filter((move) => forbidden.has(move));
    if (overlap.length > 0) {
      issues.push(
        issue(
          "contradictory-actor-method",
          `actors[${index}]`,
          `${actor.id} both permits and forbids ${uniqueOrdered(overlap).join(", ")}`,
        ),
      );
    }
  }

  const packetActorIds = new Set(packet.actors.map((entry) => entry.id));
  const packetResponsibilities = new Set(packet.actors.map((entry) => entry.responsibility));
  const packetPressureIds = new Set(packet.pressures.map((entry) => entry.id));
  const packetPropositionIds = new Set(packet.agency.propositions.map((entry) => entry.id));

  requireUniqueIds(issues, packet.factSeeds.map((entry) => entry.id), "factSeeds");
  const groups = packet.factSeeds.map((entry) => entry.group);
  const expectedRailOrder = packet.activeIncident ? packet.rail.functionOrder : REQUIRED_RAIL_ORDER;
  if (JSON.stringify(groups) !== JSON.stringify(expectedRailOrder)) {
    issues.push(issue("invalid-fact-group-order", "factSeeds.group", `expected ${expectedRailOrder.join(" -> ")}`));
  }
  for (const [index, seed] of packet.factSeeds.entries()) {
    if (seed.tags.length === 0) issues.push(issue("missing-fact-tags", `factSeeds[${index}].tags`, `${seed.id} has no tags`));
    if (seed.sourcePressureIds.length === 0) issues.push(issue("missing-source-pressure", `factSeeds[${index}]`, `${seed.id} has no source pressure`));
    for (const pressureId of seed.sourcePressureIds) {
      if (!packetPressureIds.has(pressureId)) {
        issues.push(issue("missing-source-pressure-reference", `factSeeds[${index}].sourcePressureIds`, `unknown pressure ${pressureId}`));
      }
    }
    if (seed.propositionIds.length === 0) issues.push(issue("missing-fact-knowledge", `factSeeds[${index}]`, `${seed.id} has no knowledge proposition`));
    for (const propositionId of seed.propositionIds) {
      if (!packetPropositionIds.has(propositionId)) {
        issues.push(issue("missing-proposition-reference", `factSeeds[${index}].propositionIds`, `unknown proposition ${propositionId}`));
      }
    }
    if (seed.preferredResponsibilities.length === 0) issues.push(issue("missing-cast-function", `factSeeds[${index}]`, `${seed.id} has no cast responsibility`));
    for (const responsibility of seed.preferredResponsibilities) {
      if (!packetResponsibilities.has(responsibility)) {
        issues.push(issue("missing-cast-function-reference", `factSeeds[${index}].preferredResponsibilities`, `unknown responsibility ${responsibility}`));
      }
    }
    for (const actorId of seed.preferredActorIds) {
      if (!packetActorIds.has(actorId)) {
        issues.push(issue("missing-actor-reference", `factSeeds[${index}].preferredActorIds`, `unknown actor ${actorId}`));
      }
    }
    if (!Number.isInteger(seed.requiredActorCount) || seed.requiredActorCount < 1) issues.push(issue("invalid-actor-count", `factSeeds[${index}].requiredActorCount`, `${seed.id} has invalid actor count`));
    requireText(issues, seed.statePaymentKind, `factSeeds[${index}].statePaymentKind`);
  }

  const railOrder = packet.rail.functionOrder;
  if (!packet.activeIncident && railOrder.join("|") !== REQUIRED_RAIL_ORDER.join("|")) {
    issues.push(issue("invalid-rail-order", "rail.functionOrder", `expected ${REQUIRED_RAIL_ORDER.join(" -> ")}`));
  }
  if (packet.activeIncident) {
    const allowed = new Set<BeatFunction>(REQUIRED_RAIL_ORDER);
    if (railOrder.length < 4 || railOrder.length > REQUIRED_RAIL_ORDER.length) {
      issues.push(issue("invalid-incident-rail-length", "rail.functionOrder", "incident rail must contain four through six semantic functions"));
    }
    if (railOrder[0] !== "establish") issues.push(issue("invalid-incident-opening", "rail.functionOrder", "incident rail must begin with establish"));
    if (railOrder[railOrder.length - 1] !== "consequence") issues.push(issue("invalid-incident-ending", "rail.functionOrder", "incident rail must end with consequence"));
    if (!railOrder.includes("choose")) issues.push(issue("missing-incident-choice", "rail.functionOrder", "incident rail must contain choose"));
    if (new Set(railOrder).size !== railOrder.length) issues.push(issue("duplicate-incident-function", "rail.functionOrder", "incident rail functions must be unique"));
    for (const entry of railOrder) if (!allowed.has(entry)) issues.push(issue("unknown-incident-function", "rail.functionOrder", `unsupported incident function ${entry}`));
  }
  if (packet.rail.terminalFunctions.join("|") !== "consequence") {
    issues.push(issue("invalid-terminal-function", "rail.terminalFunctions", "consequence must be the terminal function"));
  }
  for (let index = 0; index < railOrder.length; index++) {
    const current = index === 0 ? "start" : railOrder[index - 1]!;
    const expected = railOrder[index]!;
    if (!(packet.rail.transitions[current] ?? []).includes(expected)) {
      issues.push(issue("missing-rail-transition", `rail.transitions.${current}`, `${current} must permit ${expected}`));
    }
    const authoredPrerequisites = packet.rail.prerequisites[expected] ?? [];
    const expectedPrerequisites = railOrder.slice(0, index);
    if (JSON.stringify(authoredPrerequisites) !== JSON.stringify(expectedPrerequisites)) {
      issues.push(
        issue(
          "invalid-rail-prerequisite",
          `rail.prerequisites.${expected}`,
          `${expected} requires exactly ${expectedPrerequisites.join(", ") || "no prior function"}`,
        ),
      );
    }
  }

  if (packet.agency.format !== NARRATIVE_AGENCY_FORMAT) issues.push(issue("invalid-agency-format", "agency.format", `expected ${NARRATIVE_AGENCY_FORMAT}`));
  requireUniqueIds(issues, packet.agency.goals.map((entry) => entry.id), "agency.goals");
  requireUniqueIds(issues, packet.agency.propositions.map((entry) => entry.id), "agency.propositions");
  const goalIds = new Set(packet.agency.goals.map((entry) => entry.id));
  const actorIds = new Set(packet.actors.map((entry) => entry.id));
  const propositionIds = new Set(packet.agency.propositions.map((entry) => entry.id));
  const goalById = new Map(packet.agency.goals.map((entry) => [entry.id, entry] as const));
  for (const goal of packet.agency.goals) {
    if (!actorIds.has(goal.actorId)) issues.push(issue("orphan-goal", `agency.goals.${goal.id}`, `unknown actor ${goal.actorId}`));
    if (!nonEmpty(goal.openedByReceipt)) issues.push(issue("missing-goal-provenance", `agency.goals.${goal.id}`, `${goal.id} has no opening receipt`));
  }
  for (const actor of packet.actors) {
    for (const goalId of actor.goalIds) {
      if (!goalIds.has(goalId)) {
        issues.push(issue("missing-goal-reference", `actors.${actor.id}.goalIds`, `unknown goal ${goalId}`));
      } else if (goalById.get(goalId)?.actorId !== actor.id) {
        issues.push(issue("foreign-goal-reference", `actors.${actor.id}.goalIds`, `${goalId} belongs to ${goalById.get(goalId)?.actorId}`));
      }
    }
  }
  for (const proposition of packet.agency.propositions) {
    if (proposition.sourceReceiptRefs.length === 0) issues.push(issue("missing-proposition-provenance", `agency.propositions.${proposition.id}`, `${proposition.id} has no source receipt`));
  }
  const beliefKeys = packet.agency.beliefs.map((belief) => `${belief.actorId}\u001f${belief.propositionId}`);
  for (const key of duplicateIds(beliefKeys)) {
    const [actorId, propositionId] = key.split("\u001f");
    issues.push(issue("duplicate-belief", "agency.beliefs", `${actorId}/${propositionId} appears more than once`));
  }
  for (const belief of packet.agency.beliefs) {
    if (!actorIds.has(belief.actorId)) issues.push(issue("orphan-belief", `agency.beliefs`, `unknown actor ${belief.actorId}`));
    if (!propositionIds.has(belief.propositionId)) issues.push(issue("missing-proposition-reference", `agency.beliefs`, `unknown proposition ${belief.propositionId}`));
    if (!nonEmpty(belief.sourceReceiptRef)) issues.push(issue("missing-belief-provenance", `agency.beliefs`, `${belief.actorId}/${belief.propositionId} has no receipt`));
    if (!Number.isInteger(belief.confidence) || belief.confidence < 0 || belief.confidence > 1000) {
      issues.push(issue("invalid-belief-confidence", "agency.beliefs", `${belief.actorId}/${belief.propositionId} confidence must be 0..1000`));
    }
  }
  if (
    !Number.isInteger(packet.agencyPolicy.minimumBeliefConfidence) ||
    packet.agencyPolicy.minimumBeliefConfidence < 0 ||
    packet.agencyPolicy.minimumBeliefConfidence > 1000
  ) {
    issues.push(issue("invalid-agency-policy", "agencyPolicy.minimumBeliefConfidence", "minimum belief confidence must be 0..1000"));
  }
  for (const propositionId of packet.agency.commonKnowledgePropositionIds) {
    if (!propositionIds.has(propositionId)) issues.push(issue("missing-common-knowledge-reference", "agency.commonKnowledgePropositionIds", `unknown proposition ${propositionId}`));
  }

  if (packet.pressures.length === 0) issues.push(issue("missing-pressure-estate", "pressures", "handoff has no source pressures"));
  if (packet.evidence.receipts.length === 0) issues.push(issue("missing-evidence-estate", "evidence.receipts", "handoff has no evidence receipts"));
  if (packet.factions.length < 2) issues.push(issue("missing-faction-estate", "factions", "handoff requires incompatible institutional methods"));
  if (packet.consequences.length === 0) issues.push(issue("missing-consequence-estate", "consequences", "handoff has no persistent consequences"));
  if (packet.storyPhysicsTags.length === 0) issues.push(issue("missing-physics-estate", "storyPhysicsTags", "handoff has no Story Physics"));

  return issues.sort(
    (left, right) => compareCodepoints(left.path, right.path) || compareCodepoints(left.code, right.code),
  );
}

export function assertValidContinuingUniverseSource(source: ContinuingUniverseSource): void {
  const issues = validateContinuingUniverseSource(source).filter((entry) => entry.severity === "error");
  if (issues.length > 0) throw new Error(`Invalid continuing-universe source ${fingerprint(issues)}: ${issues.map((entry) => `${entry.path}: ${entry.detail}`).join("; ")}`);
}

export function assertValidNarrativeHandoffPacket(packet: NarrativeHandoffPacket): void {
  const issues = validateNarrativeHandoffPacket(packet).filter((entry) => entry.severity === "error");
  if (issues.length > 0) throw new Error(`Invalid narrative handoff ${fingerprint(issues)}: ${issues.map((entry) => `${entry.path}: ${entry.detail}`).join("; ")}`);
}
