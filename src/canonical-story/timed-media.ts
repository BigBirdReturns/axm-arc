import type { Arc } from "../engine/types.js";
import type { CanonicalStorySource } from "./types.js";

export const CANONICAL_STORY_TIMED_MEDIA_FORMAT = "axm-canonical-story-timed-media/1" as const;
export const CANONICAL_STORY_TIMED_MEDIA_EXTENSION_KEY = "axm.canonical-story.timed-media@1" as const;

export type TimedMediaSourceStanding = "reviewed-primary" | "reviewed-editorial" | "reviewed-derived";
export type TimedMediaCausalRelation = "necessary-cause" | "enables" | "explains" | "contradicts";
export type TimedMediaRevealMode = "seen" | "heard" | "explained" | "outcome-spoiled";

export interface TimedMediaSourceReceipt {
  id: string;
  sha256: string;
  locator: string;
  standing: TimedMediaSourceStanding;
}

export interface TimedMediaPosition {
  id: string;
  episodeId: string;
  chapterId: string;
  panelIds: string[];
  canonicalStartUs: number;
  canonicalEndUs: number;
  label: string;
  sourceReceiptIds: string[];
}

export interface TimedMediaFact {
  id: string;
  proposition: string;
  subjectIds: string[];
  sourceReceiptIds: string[];
}

export interface TimedMediaCausalEdge {
  id: string;
  fromFactId: string;
  toFactId: string;
  relation: TimedMediaCausalRelation;
  sourceReceiptIds: string[];
}

export interface TimedMediaReveal {
  id: string;
  factId: string;
  positionId: string;
  mode: TimedMediaRevealMode;
  sourceReceiptIds: string[];
}

export interface CanonicalStoryTimedMedia {
  format: typeof CANONICAL_STORY_TIMED_MEDIA_FORMAT;
  storyId: string;
  storyDigest: string;
  timeUnit: "microseconds";
  authority: {
    narrative: "arc";
    providerClock: "none";
    viewerState: "none";
    playbackControl: "none";
  };
  sourceReceipts: TimedMediaSourceReceipt[];
  positions: TimedMediaPosition[];
  facts: TimedMediaFact[];
  causalEdges: TimedMediaCausalEdge[];
  reveals: TimedMediaReveal[];
}

export type TimedMediaValidation =
  | { ok: true; timedMedia: CanonicalStoryTimedMedia }
  | { ok: false; errors: string[] };

const SHA256 = /^[0-9a-f]{64}$/;
const NON_EMPTY = /\S/;
const ROOT_KEYS = new Set(["format", "storyId", "storyDigest", "timeUnit", "authority", "sourceReceipts", "positions", "facts", "causalEdges", "reveals"]);
const AUTHORITY_KEYS = new Set(["narrative", "providerClock", "viewerState", "playbackControl"]);
const RECEIPT_KEYS = new Set(["id", "sha256", "locator", "standing"]);
const POSITION_KEYS = new Set(["id", "episodeId", "chapterId", "panelIds", "canonicalStartUs", "canonicalEndUs", "label", "sourceReceiptIds"]);
const FACT_KEYS = new Set(["id", "proposition", "subjectIds", "sourceReceiptIds"]);
const EDGE_KEYS = new Set(["id", "fromFactId", "toFactId", "relation", "sourceReceiptIds"]);
const REVEAL_KEYS = new Set(["id", "factId", "positionId", "mode", "sourceReceiptIds"]);
const SOURCE_STANDINGS = new Set<TimedMediaSourceStanding>(["reviewed-primary", "reviewed-editorial", "reviewed-derived"]);
const EDGE_RELATIONS = new Set<TimedMediaCausalRelation>(["necessary-cause", "enables", "explains", "contradicts"]);
const REVEAL_MODES = new Set<TimedMediaRevealMode>(["seen", "heard", "explained", "outcome-spoiled"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, path: string, errors: string[]): void {
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`[${path}] Unknown field "${key}".`);
  for (const key of allowed) if (!(key in value)) errors.push(`[${path}] Missing field "${key}".`);
}

function text(value: unknown, path: string, errors: string[]): value is string {
  if (typeof value !== "string" || !NON_EMPTY.test(value)) {
    errors.push(`[${path}] Expected a non-empty string.`);
    return false;
  }
  return true;
}

function stringArray(value: unknown, path: string, errors: string[], minimum = 0): value is string[] {
  if (!Array.isArray(value) || value.length < minimum || value.some((entry) => typeof entry !== "string" || !NON_EMPTY.test(entry))) {
    errors.push(`[${path}] Expected at least ${minimum} non-empty string values.`);
    return false;
  }
  return true;
}

function unique(values: readonly string[], path: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) errors.push(`[${path}] Duplicate identity "${value}".`);
    seen.add(value);
  }
}

function refs(values: readonly string[], known: ReadonlySet<string>, path: string, errors: string[]): void {
  for (const value of values) if (!known.has(value)) errors.push(`[${path}] Unknown reference "${value}".`);
}

function parseShape(input: unknown): TimedMediaValidation {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["[root] Expected an object."] };
  exactKeys(input, ROOT_KEYS, "root", errors);
  if (input.format !== CANONICAL_STORY_TIMED_MEDIA_FORMAT) errors.push(`[format] Expected "${CANONICAL_STORY_TIMED_MEDIA_FORMAT}".`);
  text(input.storyId, "storyId", errors);
  if (typeof input.storyDigest !== "string" || !SHA256.test(input.storyDigest)) errors.push("[storyDigest] Expected a lowercase SHA-256.");
  if (input.timeUnit !== "microseconds") errors.push('[timeUnit] Expected "microseconds".');

  if (!isRecord(input.authority)) errors.push("[authority] Expected an object.");
  else {
    exactKeys(input.authority, AUTHORITY_KEYS, "authority", errors);
    if (input.authority.narrative !== "arc") errors.push('[authority.narrative] Expected "arc".');
    for (const field of ["providerClock", "viewerState", "playbackControl"] as const) {
      if (input.authority[field] !== "none") errors.push(`[authority.${field}] Expected "none".`);
    }
  }

  const receiptRows: TimedMediaSourceReceipt[] = [];
  if (!Array.isArray(input.sourceReceipts) || input.sourceReceipts.length === 0) errors.push("[sourceReceipts] Expected at least one receipt.");
  else input.sourceReceipts.forEach((raw, index) => {
    const path = `sourceReceipts.${index}`;
    if (!isRecord(raw)) { errors.push(`[${path}] Expected an object.`); return; }
    exactKeys(raw, RECEIPT_KEYS, path, errors);
    const ok = text(raw.id, `${path}.id`, errors)
      && typeof raw.sha256 === "string" && SHA256.test(raw.sha256)
      && text(raw.locator, `${path}.locator`, errors)
      && typeof raw.standing === "string" && SOURCE_STANDINGS.has(raw.standing as TimedMediaSourceStanding);
    if (typeof raw.sha256 !== "string" || !SHA256.test(raw.sha256)) errors.push(`[${path}.sha256] Expected a lowercase SHA-256.`);
    if (typeof raw.standing !== "string" || !SOURCE_STANDINGS.has(raw.standing as TimedMediaSourceStanding)) errors.push(`[${path}.standing] Expected reviewed source standing.`);
    if (ok) receiptRows.push(raw as unknown as TimedMediaSourceReceipt);
  });

  const positionRows: TimedMediaPosition[] = [];
  if (!Array.isArray(input.positions) || input.positions.length === 0) errors.push("[positions] Expected at least one position.");
  else input.positions.forEach((raw, index) => {
    const path = `positions.${index}`;
    if (!isRecord(raw)) { errors.push(`[${path}] Expected an object.`); return; }
    exactKeys(raw, POSITION_KEYS, path, errors);
    const integerBounds = Number.isSafeInteger(raw.canonicalStartUs) && Number.isSafeInteger(raw.canonicalEndUs);
    if (!integerBounds || Number(raw.canonicalStartUs) < 0 || Number(raw.canonicalEndUs) <= Number(raw.canonicalStartUs)) errors.push(`[${path}] Expected a positive, safe canonical interval.`);
    const ok = text(raw.id, `${path}.id`, errors) && text(raw.episodeId, `${path}.episodeId`, errors)
      && text(raw.chapterId, `${path}.chapterId`, errors) && stringArray(raw.panelIds, `${path}.panelIds`, errors)
      && text(raw.label, `${path}.label`, errors) && stringArray(raw.sourceReceiptIds, `${path}.sourceReceiptIds`, errors, 1) && integerBounds;
    if (ok) positionRows.push(raw as unknown as TimedMediaPosition);
  });

  const factRows: TimedMediaFact[] = [];
  if (!Array.isArray(input.facts)) errors.push("[facts] Expected an array.");
  else input.facts.forEach((raw, index) => {
    const path = `facts.${index}`;
    if (!isRecord(raw)) { errors.push(`[${path}] Expected an object.`); return; }
    exactKeys(raw, FACT_KEYS, path, errors);
    const ok = text(raw.id, `${path}.id`, errors) && text(raw.proposition, `${path}.proposition`, errors)
      && stringArray(raw.subjectIds, `${path}.subjectIds`, errors) && stringArray(raw.sourceReceiptIds, `${path}.sourceReceiptIds`, errors, 1);
    if (ok) factRows.push(raw as unknown as TimedMediaFact);
  });

  const edgeRows: TimedMediaCausalEdge[] = [];
  if (!Array.isArray(input.causalEdges)) errors.push("[causalEdges] Expected an array.");
  else input.causalEdges.forEach((raw, index) => {
    const path = `causalEdges.${index}`;
    if (!isRecord(raw)) { errors.push(`[${path}] Expected an object.`); return; }
    exactKeys(raw, EDGE_KEYS, path, errors);
    const ok = text(raw.id, `${path}.id`, errors) && text(raw.fromFactId, `${path}.fromFactId`, errors)
      && text(raw.toFactId, `${path}.toFactId`, errors) && stringArray(raw.sourceReceiptIds, `${path}.sourceReceiptIds`, errors, 1)
      && typeof raw.relation === "string" && EDGE_RELATIONS.has(raw.relation as TimedMediaCausalRelation);
    if (typeof raw.relation !== "string" || !EDGE_RELATIONS.has(raw.relation as TimedMediaCausalRelation)) errors.push(`[${path}.relation] Unsupported causal relation.`);
    if (ok) edgeRows.push(raw as unknown as TimedMediaCausalEdge);
  });

  const revealRows: TimedMediaReveal[] = [];
  if (!Array.isArray(input.reveals)) errors.push("[reveals] Expected an array.");
  else input.reveals.forEach((raw, index) => {
    const path = `reveals.${index}`;
    if (!isRecord(raw)) { errors.push(`[${path}] Expected an object.`); return; }
    exactKeys(raw, REVEAL_KEYS, path, errors);
    const ok = text(raw.id, `${path}.id`, errors) && text(raw.factId, `${path}.factId`, errors)
      && text(raw.positionId, `${path}.positionId`, errors) && stringArray(raw.sourceReceiptIds, `${path}.sourceReceiptIds`, errors, 1)
      && typeof raw.mode === "string" && REVEAL_MODES.has(raw.mode as TimedMediaRevealMode);
    if (typeof raw.mode !== "string" || !REVEAL_MODES.has(raw.mode as TimedMediaRevealMode)) errors.push(`[${path}.mode] Unsupported reveal mode.`);
    if (ok) revealRows.push(raw as unknown as TimedMediaReveal);
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, timedMedia: structuredClone(input) as unknown as CanonicalStoryTimedMedia };
}

export function validateCanonicalStoryTimedMedia(
  input: unknown,
  story: CanonicalStorySource,
  expectedStoryDigest: string,
): TimedMediaValidation {
  const shaped = parseShape(input);
  if (!shaped.ok) return shaped;
  const value = shaped.timedMedia;
  const errors: string[] = [];
  if (!SHA256.test(expectedStoryDigest)) errors.push("[expectedStoryDigest] Expected a lowercase SHA-256.");
  if (value.storyId !== story.identity.id) errors.push(`[storyId] Expected "${story.identity.id}".`);
  if (value.storyDigest !== expectedStoryDigest) errors.push("[storyDigest] Timed media is bound to a different canonical story digest.");

  unique(value.sourceReceipts.map((row) => row.id), "sourceReceipts", errors);
  const receipts = new Set(value.sourceReceipts.map((row) => row.id));
  const episodes = new Map(story.episodes.map((episode) => [episode.id, episode]));
  const chapters = new Map(story.episodes.flatMap((episode) => episode.chapters.map((chapter) => [chapter.id, chapter] as const)));
  const panels = new Set(story.episodes.flatMap((episode) => episode.chapters.flatMap((chapter) => chapter.panels.map((panel) => panel.id))));

  unique(value.positions.map((row) => row.id), "positions", errors);
  let priorEnd = -1;
  for (const [index, row] of value.positions.entries()) {
    if (row.canonicalStartUs < priorEnd) errors.push(`[positions.${index}] Canonical intervals overlap or are out of order.`);
    priorEnd = row.canonicalEndUs;
    const episode = episodes.get(row.episodeId);
    const chapter = chapters.get(row.chapterId);
    if (!episode) errors.push(`[positions.${index}.episodeId] Unknown canonical episode.`);
    if (!chapter || !episode?.chapters.some((candidate) => candidate.id === row.chapterId)) errors.push(`[positions.${index}.chapterId] Chapter does not belong to the declared episode.`);
    for (const panelId of row.panelIds) if (!panels.has(panelId) || !chapter?.panels.some((panel) => panel.id === panelId)) errors.push(`[positions.${index}.panelIds] Panel does not belong to the declared chapter.`);
    refs(row.sourceReceiptIds, receipts, `positions.${index}.sourceReceiptIds`, errors);
  }

  unique(value.facts.map((row) => row.id), "facts", errors);
  const facts = new Set(value.facts.map((row) => row.id));
  for (const [index, row] of value.facts.entries()) refs(row.sourceReceiptIds, receipts, `facts.${index}.sourceReceiptIds`, errors);

  unique(value.causalEdges.map((row) => row.id), "causalEdges", errors);
  for (const [index, row] of value.causalEdges.entries()) {
    if (!facts.has(row.fromFactId) || !facts.has(row.toFactId)) errors.push(`[causalEdges.${index}] Unknown fact reference.`);
    if (row.fromFactId === row.toFactId) errors.push(`[causalEdges.${index}] A fact cannot cause itself.`);
    refs(row.sourceReceiptIds, receipts, `causalEdges.${index}.sourceReceiptIds`, errors);
  }

  unique(value.reveals.map((row) => row.id), "reveals", errors);
  const positions = new Set(value.positions.map((row) => row.id));
  for (const [index, row] of value.reveals.entries()) {
    if (!facts.has(row.factId)) errors.push(`[reveals.${index}.factId] Unknown fact.`);
    if (!positions.has(row.positionId)) errors.push(`[reveals.${index}.positionId] Unknown position.`);
    refs(row.sourceReceiptIds, receipts, `reveals.${index}.sourceReceiptIds`, errors);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, timedMedia: structuredClone(value) };
}

export function parseCanonicalStoryTimedMedia(
  input: unknown,
  story: CanonicalStorySource,
  expectedStoryDigest: string,
): CanonicalStoryTimedMedia {
  const result = validateCanonicalStoryTimedMedia(input, story, expectedStoryDigest);
  if (!result.ok) throw new Error(`Invalid ${CANONICAL_STORY_TIMED_MEDIA_FORMAT}:\n${result.errors.join("\n")}`);
  return result.timedMedia;
}

export function readCanonicalStoryTimedMediaExtension(
  arc: Arc,
  story: CanonicalStorySource,
  expectedStoryDigest: string,
): CanonicalStoryTimedMedia | null {
  const raw = arc.extensions?.[CANONICAL_STORY_TIMED_MEDIA_EXTENSION_KEY];
  return raw === undefined ? null : parseCanonicalStoryTimedMedia(raw, story, expectedStoryDigest);
}
