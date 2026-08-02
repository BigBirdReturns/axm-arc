import { z } from "zod";
import type { Arc, JsonValue } from "../engine/types.js";
import {
  CANONICAL_STORY_EXTENSION_KEY,
  CanonicalStorySchema,
  parseCanonicalStory,
} from "../canonical-story/index.js";
import {
  BURN_PROTOCOL_EXTENSION_KEY,
  BURN_PROTOCOL_SOURCE_FORMAT,
  type BurnProtocolSource,
} from "./types.js";

const NonEmpty = z.string().trim().min(1);
const JsonPrimitive: z.ZodType<JsonValue> = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitive, z.array(JsonValueSchema), z.record(JsonValueSchema)]));

const BurnProtocolSchema: z.ZodType<BurnProtocolSource> = z.object({
  format: z.literal(BURN_PROTOCOL_SOURCE_FORMAT),
  identity: z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: NonEmpty,
    description: NonEmpty,
    author: NonEmpty,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
  }).strict(),
  estate: z.object({
    release: z.string().regex(/^\d+\.\d+\.\d+$/),
    archiveReceiptId: NonEmpty,
    canonicalSourceReceiptId: NonEmpty,
    compiledSourceReceiptId: NonEmpty,
    productionStanding: z.enum(["source-ledger-only", "canonical-source-complete"]),
    missingRequiredReceiptIds: z.array(NonEmpty),
    boundary: NonEmpty,
  }).strict(),
  canonicalStory: CanonicalStorySchema,
  notes: JsonValueSchema.optional(),
}).strict();

export type BurnProtocolValidation =
  | { ok: true; source: BurnProtocolSource }
  | { ok: false; errors: string[] };

function semanticErrors(source: BurnProtocolSource): string[] {
  const errors: string[] = [];
  const story = parseCanonicalStory(source.canonicalStory);
  if (story.sourcePlane.format !== BURN_PROTOCOL_SOURCE_FORMAT) {
    errors.push(`[canonicalStory.sourcePlane.format] Expected "${BURN_PROTOCOL_SOURCE_FORMAT}".`);
  }
  if (story.sourcePlane.extensionKey !== BURN_PROTOCOL_EXTENSION_KEY) {
    errors.push(`[canonicalStory.sourcePlane.extensionKey] Expected "${BURN_PROTOCOL_EXTENSION_KEY}".`);
  }

  const receiptById = new Map(story.sourceReceipts.map((receipt) => [receipt.id, receipt]));
  for (const [path, receiptId] of [
    ["estate.archiveReceiptId", source.estate.archiveReceiptId],
    ["estate.canonicalSourceReceiptId", source.estate.canonicalSourceReceiptId],
    ["estate.compiledSourceReceiptId", source.estate.compiledSourceReceiptId],
  ] as const) {
    if (!receiptById.has(receiptId)) errors.push(`[${path}] Unknown source receipt "${receiptId}".`);
  }

  for (const receiptId of source.estate.missingRequiredReceiptIds) {
    const receipt = receiptById.get(receiptId);
    if (!receipt) errors.push(`[estate.missingRequiredReceiptIds] Unknown source receipt "${receiptId}".`);
    else if (receipt.available) {
      errors.push(`[estate.missingRequiredReceiptIds] Receipt "${receiptId}" is marked available.`);
    }
  }

  if (source.estate.productionStanding === "source-ledger-only"
      && source.estate.missingRequiredReceiptIds.length === 0) {
    errors.push(`[estate.missingRequiredReceiptIds] Source-ledger-only standing must name the missing exact inputs.`);
  }
  if (source.estate.productionStanding === "canonical-source-complete") {
    if (source.estate.missingRequiredReceiptIds.length > 0) {
      errors.push(`[estate.missingRequiredReceiptIds] Complete standing cannot retain missing receipts.`);
    }
    const unresolvedText = story.episodes.flatMap((episode) => episode.chapters)
      .flatMap((chapter) => chapter.panels)
      .filter((panel) => panel.text.status !== "resolved");
    const unresolvedPlates = story.episodes.flatMap((episode) => episode.chapters)
      .flatMap((chapter) => chapter.plates)
      .filter((plate) => plate.panelMapping.status !== "resolved");
    if (unresolvedText.length > 0 || unresolvedPlates.length > 0) {
      errors.push(`[estate.productionStanding] Complete standing requires resolved text and plate mappings.`);
    }
  }

  for (const [episodeIndex, episode] of story.episodes.entries()) {
    const expectedEpisodeId = `E${String(episode.number).padStart(2, "0")}`;
    if (episode.id !== expectedEpisodeId) {
      errors.push(
        `[canonicalStory.episodes.${episodeIndex}.id] Expected "${expectedEpisodeId}", received "${episode.id}".`,
      );
    }

    const previousEpisode = story.episodes[episodeIndex - 1];
    if (previousEpisode) {
      const priorChapter = previousEpisode.chapters.at(-1);
      const openingChapter = episode.chapters[0];
      if (!priorChapter || !openingChapter) {
        errors.push(`[canonicalStory.episodes.${episode.id}] Episode continuity requires both terminal and opening chapters.`);
      } else {
        if (priorChapter.nextPanelId !== openingChapter.openingPanelId) {
          errors.push(
            `[canonicalStory.episodes.${previousEpisode.id}.${priorChapter.id}.nextPanelId] Expected next episode opening "${openingChapter.openingPanelId}".`,
          );
        }
        if (openingChapter.previousPanelId !== priorChapter.terminalPanelId) {
          errors.push(
            `[canonicalStory.episodes.${episode.id}.${openingChapter.id}.previousPanelId] Expected previous episode terminal "${priorChapter.terminalPanelId}".`,
          );
        }
      }
    }

    const presentChapterIds = new Set(episode.chapters.map((chapter) => chapter.id));
    if (episode.nextChapterId !== null && presentChapterIds.has(episode.nextChapterId)) {
      errors.push(`[canonicalStory.episodes.${episode.id}.nextChapterId] The next unpublished chapter is already present.`);
    }

    for (const [chapterIndex, chapter] of episode.chapters.entries()) {
      if (!new RegExp(`^${episode.id}-C\\d+$`).test(chapter.id)) {
        errors.push(`[canonicalStory.episodes.${episode.id}] Chapter "${chapter.id}" does not belong to the episode.`);
      }
      const previousChapter = episode.chapters[chapterIndex - 1];
      if (previousChapter) {
        if (previousChapter.nextPanelId !== chapter.openingPanelId) {
          errors.push(
            `[canonicalStory.episodes.${episode.id}.${previousChapter.id}.nextPanelId] Expected next chapter opening "${chapter.openingPanelId}".`,
          );
        }
        if (chapter.previousPanelId !== previousChapter.terminalPanelId) {
          errors.push(
            `[canonicalStory.episodes.${episode.id}.${chapter.id}.previousPanelId] Expected previous chapter terminal "${previousChapter.terminalPanelId}".`,
          );
        }
      }

      for (const panel of chapter.panels) {
        if (!new RegExp(`^${chapter.id}-P\\d{2,3}$`).test(panel.id)) {
          errors.push(`[canonicalStory.episodes.${episode.id}.${chapter.id}] Panel "${panel.id}" does not belong to the chapter.`);
        }
        if (!panel.asset.path.endsWith(`/panels/${panel.id}.webp`)
            && !panel.asset.path.endsWith(`/panels/${panel.id}.jpg`)
            && !panel.asset.path.endsWith(`/panels/${panel.id}.png`)) {
          errors.push(`[canonicalStory.episodes.${episode.id}.${chapter.id}.${panel.id}.asset.path] Asset path does not preserve panel identity.`);
        }
      }
    }
  }
  return errors;
}

export function validateBurnProtocol(input: unknown): BurnProtocolValidation {
  const parsed = BurnProtocolSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) =>
        `[${issue.path.join(".") || "root"}] ${issue.message}`),
    };
  }
  let errors: string[];
  try {
    errors = semanticErrors(parsed.data);
  } catch (error) {
    errors = [error instanceof Error ? error.message : String(error)];
  }
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, source: structuredClone(parsed.data) };
}

export function parseBurnProtocol(input: unknown): BurnProtocolSource {
  const result = validateBurnProtocol(input);
  if (!result.ok) throw new Error(`Invalid ${BURN_PROTOCOL_SOURCE_FORMAT}:\n${result.errors.join("\n")}`);
  return result.source;
}

export function readBurnProtocolExtension(arc: Arc): BurnProtocolSource | null {
  const raw = arc.extensions?.[BURN_PROTOCOL_EXTENSION_KEY];
  return raw === undefined ? null : parseBurnProtocol(raw);
}

export function burnProtocolHasCanonicalStory(arc: Arc): boolean {
  return arc.extensions?.[CANONICAL_STORY_EXTENSION_KEY] !== undefined;
}
