import { sha256Hex } from "../engine/cartridge-digest.js";
import { orderRecordKeysDeep } from "../engine/determinism.js";
import { parseCanonicalStory } from "./schema.js";
import {
  CANONICAL_STORY_TRANSITION_FORMAT,
  type CanonicalStoryAdvanceResult,
  type CanonicalStoryChapter,
  type CanonicalStoryCoverage,
  type CanonicalStoryCursor,
  type CanonicalStoryManifestedAssetReference,
  type CanonicalStoryAssetReference,
  type CanonicalStoryPanel,
  type CanonicalStorySource,
  type CanonicalStoryTransitionReceipt,
} from "./types.js";

interface LocatedPanel {
  episodeId: string;
  chapter: CanonicalStoryChapter;
  panel: CanonicalStoryPanel;
}

export function canonicalStoryAssetIsManifested(
  asset: CanonicalStoryAssetReference,
): asset is CanonicalStoryManifestedAssetReference {
  return asset.status !== "source-required";
}

function allPanels(story: CanonicalStorySource): LocatedPanel[] {
  return story.episodes.flatMap((episode) =>
    episode.chapters.flatMap((chapter) =>
      chapter.panels.map((panel) => ({ episodeId: episode.id, chapter, panel }))));
}

export function canonicalStoryPanel(
  story: CanonicalStorySource,
  panelId: string,
): LocatedPanel {
  const found = allPanels(story).find((entry) => entry.panel.id === panelId);
  if (!found) throw new Error(`Canonical story does not contain panel "${panelId}".`);
  return found;
}

export function canonicalStoryCursorForPanel(
  input: unknown,
  panelId: string,
): CanonicalStoryCursor {
  const story = parseCanonicalStory(input);
  const located = canonicalStoryPanel(story, panelId);
  return {
    storyId: story.identity.id,
    episodeId: located.episodeId,
    chapterId: located.chapter.id,
    panelId: located.panel.id,
  };
}

function transitionReceipt(
  story: CanonicalStorySource,
  action: CanonicalStoryTransitionReceipt["action"],
  fromPanelId: string | null,
  target: LocatedPanel,
): CanonicalStoryTransitionReceipt {
  const core = {
    format: CANONICAL_STORY_TRANSITION_FORMAT,
    storyId: story.identity.id,
    episodeId: target.episodeId,
    action,
    fromPanelId,
    toPanelId: target.panel.id,
    chapterId: target.chapter.id,
    canonical: true as const,
  };
  const digest = `story1_${sha256Hex(JSON.stringify(orderRecordKeysDeep(core)))}`;
  return { ...core, digest };
}

export function initialCanonicalStoryCursor(input: unknown): {
  cursor: CanonicalStoryCursor;
  receipt: CanonicalStoryTransitionReceipt;
} {
  const story = parseCanonicalStory(input);
  const episode = story.episodes[0]!;
  const chapter = episode.chapters[0]!;
  const panel = chapter.panels[0]!;
  const target = { episodeId: episode.id, chapter, panel };
  return {
    cursor: { storyId: story.identity.id, episodeId: episode.id, chapterId: chapter.id, panelId: panel.id },
    receipt: transitionReceipt(story, "open", null, target),
  };
}

export function advanceCanonicalStory(input: unknown, cursor: CanonicalStoryCursor): CanonicalStoryAdvanceResult {
  const story = parseCanonicalStory(input);
  if (cursor.storyId !== story.identity.id) throw new Error(`Cursor belongs to "${cursor.storyId}", not "${story.identity.id}".`);
  const current = canonicalStoryPanel(story, cursor.panelId);
  if (current.episodeId !== cursor.episodeId || current.chapter.id !== cursor.chapterId) {
    throw new Error("Cursor episode or chapter does not match its panel.");
  }
  const nextPanelId = current.panel.nextPanelId;
  if (nextPanelId === null) return { kind: "extent-complete", cursor, continuationPanelId: null };
  const next = allPanels(story).find((entry) => entry.panel.id === nextPanelId);
  if (!next) {
    if (current.chapter.nextPanelId !== nextPanelId) {
      throw new Error(`Panel "${current.panel.id}" points outside the story to "${nextPanelId}" without an extent declaration.`);
    }
    return { kind: "extent-complete", cursor, continuationPanelId: nextPanelId };
  }
  return {
    kind: "panel",
    cursor: { storyId: story.identity.id, episodeId: next.episodeId, chapterId: next.chapter.id, panelId: next.panel.id },
    receipt: transitionReceipt(story, "next", current.panel.id, next),
  };
}

export function retreatCanonicalStory(input: unknown, cursor: CanonicalStoryCursor): CanonicalStoryAdvanceResult {
  const story = parseCanonicalStory(input);
  if (cursor.storyId !== story.identity.id) throw new Error(`Cursor belongs to "${cursor.storyId}", not "${story.identity.id}".`);
  const current = canonicalStoryPanel(story, cursor.panelId);
  const previousPanelId = current.panel.previousPanelId;
  if (previousPanelId === null) return { kind: "extent-complete", cursor, continuationPanelId: null };
  const previous = allPanels(story).find((entry) => entry.panel.id === previousPanelId);
  if (!previous) {
    if (current.chapter.previousPanelId !== previousPanelId) {
      throw new Error(`Panel "${current.panel.id}" points outside the story to "${previousPanelId}" without an extent declaration.`);
    }
    return { kind: "extent-complete", cursor, continuationPanelId: previousPanelId };
  }
  return {
    kind: "panel",
    cursor: { storyId: story.identity.id, episodeId: previous.episodeId, chapterId: previous.chapter.id, panelId: previous.panel.id },
    receipt: transitionReceipt(story, "previous", current.panel.id, previous),
  };
}

export function canonicalStoryCoverage(input: unknown): CanonicalStoryCoverage {
  const story = parseCanonicalStory(input);
  const chapters = story.episodes.flatMap((episode) => episode.chapters);
  const panels = chapters.flatMap((chapter) => chapter.panels);
  const plates = chapters.flatMap((chapter) => chapter.plates);
  const panelIds = new Set(panels.map((panel) => panel.id));
  const unresolvedTextPanels = panels.filter((panel) => panel.text.status === "source-required").length;
  const unresolvedPlateMappings = plates.filter((plate) => plate.panelMapping.status === "source-required").length;
  const unresolvedAssets = [
    ...panels.map((panel) => panel.asset),
    ...plates.map((plate) => plate.asset),
  ].filter((asset) => !canonicalStoryAssetIsManifested(asset)).length;
  return {
    episodes: story.episodes.length,
    chapters: chapters.length,
    panels: panels.length,
    plates: plates.length,
    resolvedTextPanels: panels.length - unresolvedTextPanels,
    unresolvedTextPanels,
    resolvedPlateMappings: plates.length - unresolvedPlateMappings,
    unresolvedPlateMappings,
    choiceNodes: 0,
    productionReady: unresolvedTextPanels === 0
      && unresolvedPlateMappings === 0
      && unresolvedAssets === 0
      && story.episodes.every((episode) => episode.complete),
    incompleteEpisodeIds: story.episodes.filter((episode) => !episode.complete).map((episode) => episode.id),
    continuationPanelIds: chapters
      .map((chapter) => chapter.nextPanelId)
      .filter((panelId): panelId is string => panelId !== null && !panelIds.has(panelId)),
  };
}
