import { describe, expect, it } from "vitest";
import {
  advanceCanonicalStory,
  CANONICAL_STORY_EXTENSION_KEY,
  canonicalStoryCoverage,
  canonicalStoryCursorForPanel,
  initialCanonicalStoryCursor,
  parseCanonicalStory,
  readCanonicalStoryExtension,
  retreatCanonicalStory,
} from "../../src/canonical-story/index.js";
import {
  BURN_PROTOCOL_CHAPTER_3,
  BURN_PROTOCOL_EPISODE_1_SOURCE,
  BURN_PROTOCOL_EXTENSION_KEY,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol complete Episode 1 source", () => {
  it("adds Chapter 3 as ordinary chapter data and closes the episode", () => {
    const validation = validateBurnProtocol(BURN_PROTOCOL_EPISODE_1_SOURCE);
    expect(validation.ok).toBe(true);

    const episode = BURN_PROTOCOL_EPISODE_1_SOURCE.canonicalStory.episodes[0]!;
    expect({
      id: episode.id,
      title: episode.title,
      complete: episode.complete,
      nextChapterId: episode.nextChapterId,
      chapterIds: episode.chapters.map((chapter) => chapter.id),
      panels: episode.chapters.flatMap((chapter) => chapter.panels).length,
      plates: episode.chapters.flatMap((chapter) => chapter.plates).length,
    }).toEqual({
      id: "E01",
      title: "The Broken Road",
      complete: true,
      nextChapterId: null,
      chapterIds: ["E01-C1", "E01-C2", "E01-C3"],
      panels: 60,
      plates: 12,
    });

    expect(BURN_PROTOCOL_CHAPTER_3).toMatchObject({
      id: "E01-C3",
      number: 3,
      title: "A Direction in Time",
      complete: true,
      openingPanelId: "E01-C3-P39",
      terminalPanelId: "E01-C3-P60",
      previousPanelId: "E01-C2-P38",
      nextPanelId: "E02-C1-P01",
    });
    expect(BURN_PROTOCOL_CHAPTER_3.panels.map((panel) => panel.id)).toEqual(
      Array.from({ length: 22 }, (_, index) =>
        `E01-C3-P${String(index + 39).padStart(2, "0")}`),
    );
    expect(BURN_PROTOCOL_CHAPTER_3.plates.map((plate) => plate.id)).toEqual([
      "A01C3-plate-01",
      "A01C3-plate-02",
      "A01C3-plate-03",
      "A01C3-plate-04",
    ]);
  });

  it("preserves the exact Chapter 3 receipt and external asset ledger", () => {
    const story = BURN_PROTOCOL_EPISODE_1_SOURCE.canonicalStory;
    const receipts = new Map(story.sourceReceipts.map((receipt) => [receipt.id, receipt]));
    expect(receipts.get("a01c3-lettering")).toEqual({
      id: "a01c3-lettering",
      path: "manifests/a01c3-lettering.json",
      bytes: 20930,
      sha256: "8177cdf809545fdb12bfd7fd8988f7ae056b098bc1efa22c0e3826c4ad70afa3",
      role: "canonical-lettering",
      available: false,
    });
    expect(receipts.get("a01c3-scroll-plates")).toMatchObject({
      bytes: 1565,
      sha256: "9a0e110a37019df56ddd65aaac614b78ffdf148df8adc58163fbeaeada0d287f",
      available: false,
    });

    expect(BURN_PROTOCOL_CHAPTER_3.panels.every((panel) =>
      panel.text.status === "source-required"
      && panel.asset.path === `site/assets/art/A01C3/panels/${panel.id}.webp`
      && panel.asset.availability === "manifested-external"
      && panel.asset.visualStanding === "q02-review-required"))
      .toBe(true);
    expect(BURN_PROTOCOL_CHAPTER_3.panels[0]!.asset).toMatchObject({
      bytes: 76718,
      sha256: "8da76ebf5371cbee318a7bda2015a37a3be695f35477b8ae1f859fdc35172b70",
    });
    expect(BURN_PROTOCOL_CHAPTER_3.panels.at(-1)!.asset).toMatchObject({
      bytes: 69144,
      sha256: "dc198d90f11bd5a56669ec312d3ec8528c82cdc459efed6bcbdc60d8970ccb3a",
    });
    expect(BURN_PROTOCOL_CHAPTER_3.plates.every((plate) =>
      plate.panelMapping.status === "source-required"
      && plate.asset.path.endsWith(`/${plate.id}.webp`)))
      .toBe(true);
  });

  it("reports complete Episode 1 structure without promoting unresolved expression", () => {
    const coverage = canonicalStoryCoverage(
      BURN_PROTOCOL_EPISODE_1_SOURCE.canonicalStory,
    );
    expect(coverage).toEqual({
      episodes: 1,
      chapters: 3,
      panels: 60,
      plates: 12,
      resolvedTextPanels: 0,
      unresolvedTextPanels: 60,
      resolvedPlateMappings: 0,
      unresolvedPlateMappings: 12,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: [],
      continuationPanelIds: ["E02-C1-P01"],
    });
  });

  it("compiles the complete episode into the same content-addressed Arc authority", () => {
    const arc = compileBurnProtocol(BURN_PROTOCOL_EPISODE_1_SOURCE);
    expect(arc.meta).toMatchObject({
      id: "burn-protocol",
      domain: "burn-protocol-canonical-story",
      version: "0.3.0",
    });
    expect(arc.challenges).toEqual([]);
    expect(arc.roles).toEqual([]);
    expect(arc.extensions?.[BURN_PROTOCOL_EXTENSION_KEY]).toEqual(
      BURN_PROTOCOL_EPISODE_1_SOURCE,
    );
    expect(arc.extensions?.[CANONICAL_STORY_EXTENSION_KEY]).toEqual(
      BURN_PROTOCOL_EPISODE_1_SOURCE.canonicalStory,
    );
    expect(readBurnProtocolExtension(arc)).toEqual(BURN_PROTOCOL_EPISODE_1_SOURCE);
    expect(readCanonicalStoryExtension(arc)).toEqual(
      BURN_PROTOCOL_EPISODE_1_SOURCE.canonicalStory,
    );
    expect(cartridgeDigest(arc)).toMatch(/^cart1_[0-9a-f]{64}$/);
  });

  it("executes all sixty panels across both chapter seams and stops at Episode 2", () => {
    const story = BURN_PROTOCOL_EPISODE_1_SOURCE.canonicalStory;
    let cursor = initialCanonicalStoryCursor(story).cursor;
    const visited = [cursor.panelId];
    expect(cursor.panelId).toBe("E01-C1-P01");

    for (let expected = 2; expected <= 60; expected += 1) {
      const result = advanceCanonicalStory(story, cursor);
      expect(result.kind).toBe("panel");
      if (result.kind !== "panel") throw new Error(`Episode ended before P${expected}.`);
      cursor = result.cursor;
      visited.push(cursor.panelId);
      const chapter = expected <= 18 ? 1 : expected <= 38 ? 2 : 3;
      expect(cursor.panelId).toBe(
        `E01-C${chapter}-P${String(expected).padStart(2, "0")}`,
      );
      expect(result.receipt.canonical).toBe(true);
    }

    expect(visited).toHaveLength(60);
    expect(new Set(visited).size).toBe(60);
    expect(cursor).toEqual({
      storyId: "burn-protocol",
      episodeId: "E01",
      chapterId: "E01-C3",
      panelId: "E01-C3-P60",
    });
    expect(advanceCanonicalStory(story, cursor)).toEqual({
      kind: "extent-complete",
      cursor,
      continuationPanelId: "E02-C1-P01",
    });
  });

  it("crosses P38 and P39 in both directions without a runtime handoff", () => {
    const story = BURN_PROTOCOL_EPISODE_1_SOURCE.canonicalStory;
    const p38 = canonicalStoryCursorForPanel(story, "E01-C2-P38");
    const forward = advanceCanonicalStory(story, p38);
    expect(forward.kind).toBe("panel");
    if (forward.kind !== "panel") throw new Error("P39 was not internalized.");
    expect(forward.cursor).toMatchObject({
      chapterId: "E01-C3",
      panelId: "E01-C3-P39",
    });
    expect(forward.receipt).toMatchObject({
      action: "next",
      fromPanelId: "E01-C2-P38",
      toPanelId: "E01-C3-P39",
      canonical: true,
    });

    const backward = retreatCanonicalStory(story, forward.cursor);
    expect(backward.kind).toBe("panel");
    if (backward.kind !== "panel") throw new Error("P38 reverse seam failed.");
    expect(backward.cursor.panelId).toBe("E01-C2-P38");
  });

  it("refuses a broken terminal seam and any invented choice field", () => {
    const broken = structuredClone(BURN_PROTOCOL_EPISODE_1_SOURCE.canonicalStory);
    broken.episodes[0]!.chapters[2]!.panels[0]!.previousPanelId = "E01-C1-P18";
    expect(() => parseCanonicalStory(broken)).toThrow(/previousPanelId/);

    const invented = structuredClone(BURN_PROTOCOL_EPISODE_1_SOURCE) as unknown as {
      canonicalStory: {
        episodes: Array<{
          chapters: Array<{
            panels: Array<Record<string, unknown>>;
          }>;
        }>;
      };
    };
    invented.canonicalStory.episodes[0]!.chapters[2]!.panels[0]!.choices = [
      { id: "invented-episode-ending" },
    ];
    expect(validateBurnProtocol(invented).ok).toBe(false);
  });
});
