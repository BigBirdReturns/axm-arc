import { z } from "zod";
import type { Arc } from "../engine/types.js";
import {
  CANONICAL_STORY_EXTENSION_KEY,
  CANONICAL_STORY_FORMAT,
  type CanonicalStorySource,
} from "./types.js";

const NonEmpty = z.string().trim().min(1);
const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const PositiveInteger = z.number().int().positive();
const NonNegativeInteger = z.number().int().nonnegative();

const SourceReceiptSchema = z.object({
  id: NonEmpty,
  path: NonEmpty,
  bytes: NonNegativeInteger,
  sha256: Sha256,
  role: NonEmpty,
  available: z.boolean(),
}).strict();

const ManifestedAssetSchema = z.object({
  status: z.literal("manifested").optional(),
  id: NonEmpty,
  path: NonEmpty,
  bytes: PositiveInteger,
  sha256: Sha256,
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  availability: z.enum(["manifested-external", "embedded"]),
  visualStanding: z.enum(["accepted", "q02-review-required", "missing"]),
}).strict();

const SourceRequiredAssetSchema = z.object({
  status: z.literal("source-required"),
  id: NonEmpty,
  path: NonEmpty,
  expectedBytes: PositiveInteger.optional(),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  availability: z.literal("manifested-external"),
  visualStanding: z.literal("missing"),
  expectedSourceReceiptIds: z.array(NonEmpty).min(1),
  reason: NonEmpty,
}).strict();

const AssetSchema = z.union([ManifestedAssetSchema, SourceRequiredAssetSchema]);

const CaptionSchema = z.object({
  id: NonEmpty,
  order: PositiveInteger,
  text: z.string(),
}).strict();

const UtteranceSchema = z.object({
  id: NonEmpty,
  order: PositiveInteger,
  speakerId: NonEmpty,
  label: NonEmpty,
  text: z.string(),
}).strict();

const SoundEffectSchema = z.object({
  id: NonEmpty,
  order: PositiveInteger,
  text: z.string(),
}).strict();

const TextLayerSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("resolved"),
    sourceReceiptIds: z.array(NonEmpty).min(1),
    captions: z.array(CaptionSchema),
    dialogue: z.array(UtteranceSchema),
    soundEffects: z.array(SoundEffectSchema),
    altText: NonEmpty,
  }).strict(),
  z.object({
    status: z.literal("source-required"),
    expectedSourceReceiptIds: z.array(NonEmpty).min(1),
    reason: NonEmpty,
  }).strict(),
]);

const AuditProjectionSchema = z.object({
  authority: z.literal("derived-q01-q02"),
  location: NonEmpty,
  actorIds: z.array(NonEmpty),
  summary: NonEmpty,
  sourceReceiptIds: z.array(NonEmpty).min(1),
}).strict();

const PanelSchema = z.object({
  id: NonEmpty,
  ordinal: PositiveInteger,
  chapterId: NonEmpty,
  previousPanelId: NonEmpty.nullable(),
  nextPanelId: NonEmpty.nullable(),
  asset: AssetSchema,
  text: TextLayerSchema,
  auditProjection: AuditProjectionSchema.optional(),
}).strict();

const PlateMappingSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("resolved"),
    sourceReceiptIds: z.array(NonEmpty).min(1),
    panelIds: z.array(NonEmpty).min(1),
  }).strict(),
  z.object({
    status: z.literal("source-required"),
    expectedSourceReceiptIds: z.array(NonEmpty).min(1),
    reason: NonEmpty,
  }).strict(),
]);

const PlateSchema = z.object({
  id: NonEmpty,
  ordinal: PositiveInteger,
  chapterId: NonEmpty,
  asset: AssetSchema,
  panelMapping: PlateMappingSchema,
}).strict();

const ChapterSchema = z.object({
  id: NonEmpty,
  number: PositiveInteger,
  title: NonEmpty,
  complete: z.boolean(),
  openingPanelId: NonEmpty,
  terminalPanelId: NonEmpty,
  previousPanelId: NonEmpty.nullable(),
  nextPanelId: NonEmpty.nullable(),
  panels: z.array(PanelSchema).min(1),
  plates: z.array(PlateSchema),
}).strict();

const EpisodeSchema = z.object({
  id: NonEmpty,
  number: PositiveInteger,
  title: NonEmpty,
  complete: z.boolean(),
  nextChapterId: NonEmpty.nullable(),
  chapters: z.array(ChapterSchema).min(1),
}).strict();

export const CanonicalStorySchema: z.ZodType<CanonicalStorySource> = z.object({
  format: z.literal(CANONICAL_STORY_FORMAT),
  identity: z.object({
    id: NonEmpty,
    title: NonEmpty,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
  }).strict(),
  sourcePlane: z.object({
    format: NonEmpty,
    extensionKey: z.string().regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*@\d+$/),
  }).strict(),
  authority: z.object({
    pathPolicy: z.literal("canonical-fixed"),
    choicePolicy: z.literal("none"),
    textAuthority: z.literal("exact-source-required"),
    assetAuthority: z.literal("external-manifest"),
  }).strict(),
  sourceReceipts: z.array(SourceReceiptSchema).min(1),
  episodes: z.array(EpisodeSchema).min(1),
}).strict();

export type CanonicalStoryValidation =
  | { ok: true; source: CanonicalStorySource }
  | { ok: false; errors: string[] };

function duplicateValues(values: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

function orderedObjectIds<T extends { id: string }>(
  values: readonly T[],
  orderOf: (value: T) => number,
  orderField: string,
  path: string,
  errors: string[],
): void {
  for (const [index, value] of values.entries()) {
    const actual = orderOf(value);
    if (actual !== index + 1) {
      errors.push(`[${path}.${index}.${orderField}] Expected ${index + 1}, received ${actual}.`);
    }
  }
}

function receiptReferences(
  values: readonly string[],
  receiptIds: ReadonlySet<string>,
  path: string,
  errors: string[],
): void {
  for (const value of values) {
    if (!receiptIds.has(value)) errors.push(`[${path}] Unknown source receipt "${value}".`);
  }
}

function semanticErrors(source: CanonicalStorySource): string[] {
  const errors: string[] = [];
  const receiptIds = new Set(source.sourceReceipts.map((receipt) => receipt.id));
  for (const id of duplicateValues(source.sourceReceipts.map((receipt) => receipt.id))) {
    errors.push(`[sourceReceipts] Duplicate source receipt "${id}".`);
  }

  const episodeIds = source.episodes.map((episode) => episode.id);
  for (const id of duplicateValues(episodeIds)) errors.push(`[episodes] Duplicate episode "${id}".`);
  orderedObjectIds(source.episodes, (episode) => episode.number, "number", "episodes", errors);

  const globalChapterIds: string[] = [];
  const globalPanelIds: string[] = [];
  const globalPlateIds: string[] = [];

  for (const [episodeIndex, episode] of source.episodes.entries()) {
    const episodePath = `episodes.${episodeIndex}`;
    orderedObjectIds(
      episode.chapters,
      (chapter) => chapter.number,
      "number",
      `${episodePath}.chapters`,
      errors,
    );
    if (episode.complete && episode.nextChapterId !== null) {
      errors.push(`[${episodePath}.nextChapterId] A complete episode cannot declare a next unpublished chapter.`);
    }
    if (!episode.complete && episode.nextChapterId === null) {
      errors.push(`[${episodePath}.nextChapterId] An incomplete episode must declare its next canonical chapter.`);
    }

    for (const [chapterIndex, chapter] of episode.chapters.entries()) {
      const chapterPath = `${episodePath}.chapters.${chapterIndex}`;
      globalChapterIds.push(chapter.id);
      orderedObjectIds(
        chapter.panels,
        (panel) => panel.ordinal,
        "ordinal",
        `${chapterPath}.panels`,
        errors,
      );
      orderedObjectIds(
        chapter.plates,
        (plate) => plate.ordinal,
        "ordinal",
        `${chapterPath}.plates`,
        errors,
      );

      if (chapter.panels[0]?.id !== chapter.openingPanelId) {
        errors.push(`[${chapterPath}.openingPanelId] Does not match the first panel.`);
      }
      if (chapter.panels.at(-1)?.id !== chapter.terminalPanelId) {
        errors.push(`[${chapterPath}.terminalPanelId] Does not match the last panel.`);
      }

      const chapterPanelIds = new Set(chapter.panels.map((panel) => panel.id));
      for (const [panelIndex, panel] of chapter.panels.entries()) {
        const panelPath = `${chapterPath}.panels.${panelIndex}`;
        globalPanelIds.push(panel.id);
        if (panel.chapterId !== chapter.id) {
          errors.push(`[${panelPath}.chapterId] Expected "${chapter.id}", received "${panel.chapterId}".`);
        }
        const expectedPrevious = panelIndex === 0
          ? chapter.previousPanelId
          : chapter.panels[panelIndex - 1]!.id;
        const expectedNext = panelIndex === chapter.panels.length - 1
          ? chapter.nextPanelId
          : chapter.panels[panelIndex + 1]!.id;
        if (panel.previousPanelId !== expectedPrevious) {
          errors.push(`[${panelPath}.previousPanelId] Expected ${JSON.stringify(expectedPrevious)}.`);
        }
        if (panel.nextPanelId !== expectedNext) {
          errors.push(`[${panelPath}.nextPanelId] Expected ${JSON.stringify(expectedNext)}.`);
        }

        if (panel.asset.status === "source-required") {
          receiptReferences(
            panel.asset.expectedSourceReceiptIds,
            receiptIds,
            `${panelPath}.asset.expectedSourceReceiptIds`,
            errors,
          );
        }

        const refs = panel.text.status === "resolved"
          ? panel.text.sourceReceiptIds
          : panel.text.expectedSourceReceiptIds;
        receiptReferences(refs, receiptIds, `${panelPath}.text`, errors);
        if (panel.auditProjection) {
          receiptReferences(
            panel.auditProjection.sourceReceiptIds,
            receiptIds,
            `${panelPath}.auditProjection.sourceReceiptIds`,
            errors,
          );
        }

        if (panel.text.status === "resolved") {
          for (const [label, records] of [
            ["captions", panel.text.captions],
            ["dialogue", panel.text.dialogue],
            ["soundEffects", panel.text.soundEffects],
          ] as const) {
            orderedObjectIds(
              records,
              (record) => record.order,
              "order",
              `${panelPath}.text.${label}`,
              errors,
            );
            for (const id of duplicateValues(records.map((record) => record.id))) {
              errors.push(`[${panelPath}.text.${label}] Duplicate text id "${id}".`);
            }
          }
        }
      }

      for (const [plateIndex, plate] of chapter.plates.entries()) {
        const platePath = `${chapterPath}.plates.${plateIndex}`;
        globalPlateIds.push(plate.id);
        if (plate.chapterId !== chapter.id) {
          errors.push(`[${platePath}.chapterId] Expected "${chapter.id}", received "${plate.chapterId}".`);
        }
        if (plate.asset.status === "source-required") {
          receiptReferences(
            plate.asset.expectedSourceReceiptIds,
            receiptIds,
            `${platePath}.asset.expectedSourceReceiptIds`,
            errors,
          );
        }
        const refs = plate.panelMapping.status === "resolved"
          ? plate.panelMapping.sourceReceiptIds
          : plate.panelMapping.expectedSourceReceiptIds;
        receiptReferences(refs, receiptIds, `${platePath}.panelMapping`, errors);
        if (plate.panelMapping.status === "resolved") {
          for (const panelId of plate.panelMapping.panelIds) {
            if (!chapterPanelIds.has(panelId)) {
              errors.push(`[${platePath}.panelMapping.panelIds] Unknown chapter panel "${panelId}".`);
            }
          }
        }
      }
    }
  }

  for (const id of duplicateValues(globalChapterIds)) errors.push(`[episodes] Duplicate chapter "${id}".`);
  for (const id of duplicateValues(globalPanelIds)) errors.push(`[episodes] Duplicate panel "${id}".`);
  for (const id of duplicateValues(globalPlateIds)) errors.push(`[episodes] Duplicate plate "${id}".`);
  return errors;
}

export function validateCanonicalStory(input: unknown): CanonicalStoryValidation {
  const parsed = CanonicalStorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) =>
        `[${issue.path.join(".") || "root"}] ${issue.message}`),
    };
  }
  const errors = semanticErrors(parsed.data);
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, source: structuredClone(parsed.data) };
}

export function parseCanonicalStory(input: unknown): CanonicalStorySource {
  const result = validateCanonicalStory(input);
  if (!result.ok) throw new Error(`Invalid ${CANONICAL_STORY_FORMAT}:\n${result.errors.join("\n")}`);
  return result.source;
}

export function readCanonicalStoryExtension(arc: Arc): CanonicalStorySource | null {
  const raw = arc.extensions?.[CANONICAL_STORY_EXTENSION_KEY];
  return raw === undefined ? null : parseCanonicalStory(raw);
}
