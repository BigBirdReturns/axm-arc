import { describe, expect, it } from "vitest";
import {
  advanceCanonicalStory,
  CANONICAL_STORY_EXTENSION_KEY,
  canonicalStoryCoverage,
  canonicalStoryCursorForPanel,
  readCanonicalStoryExtension,
  retreatCanonicalStory,
} from "../../src/canonical-story/index.js";
import {
  appendBurnProtocolEpisode,
  BURN_PROTOCOL_EPISODE_2_CHAPTER_1,
  BURN_PROTOCOL_EPISODE_2_THROUGH_CHAPTER_1,
  BURN_PROTOCOL_EXTENSION_KEY,
  BURN_PROTOCOL_THROUGH_EPISODE_2_CHAPTER_1_SOURCE,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol through Episode 2, Chapter 1", () => {
  it("appends Reunion as ordinary Episode 2 data under the stable cartridge identity", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_2_CHAPTER_1_SOURCE;
    expect(validateBurnProtocol(source).ok).toBe(true);
    expect(source.identity).toMatchObject({
      id: "burn-protocol",
      version: "0.4.0",
    });
    expect(source.canonicalStory.identity).toMatchObject({
      id: "burn-protocol",
      version: "0.4.0",
    });
    expect(source.canonicalStory.episodes.map((episode) => ({
      id: episode.id,
      number: episode.number,
      title: episode.title,
      complete: episode.complete,
      nextChapterId: episode.nextChapterId,
      chapterIds: episode.chapters.map((chapter) => chapter.id),
    }))).toEqual([
      {
        id: "E01",
        number: 1,
        title: "The Broken Road",
        complete: true,
        nextChapterId: null,
        chapterIds: ["E01-C1", "E01-C2", "E01-C3"],
      },
      {
        id: "E02",
        number: 2,
        title: "Ghosts of Then",
        complete: false,
        nextChapterId: "E02-C2",
        chapterIds: ["E02-C1"],
      },
    ]);
    expect(BURN_PROTOCOL_EPISODE_2_THROUGH_CHAPTER_1).toEqual(
      source.canonicalStory.episodes[1],
    );
  });

  it("represents all twenty Reunion panels and four plate assets from the manifest ledger", () => {
    const chapter = BURN_PROTOCOL_EPISODE_2_CHAPTER_1;
    expect(chapter).toMatchObject({
      id: "E02-C1",
      number: 1,
      title: "Reunion",
      complete: true,
      openingPanelId: "E02-C1-P01",
      terminalPanelId: "E02-C1-P20",
      previousPanelId: "E01-C3-P60",
      nextPanelId: "E02-C2-P21",
    });
    expect(chapter.panels.map((panel) => panel.id)).toEqual(
      Array.from({ length: 20 }, (_, index) =>
        `E02-C1-P${String(index + 1).padStart(2, "0")}`),
    );
    expect(chapter.panels.every((panel) =>
      panel.text.status === "source-required"
      && panel.asset.path === `site/assets/art/A02C1/panels/${panel.id}.webp`
      && panel.asset.availability === "manifested-external"
      && panel.asset.visualStanding === "q02-review-required"))
      .toBe(true);
    expect(chapter.panels[0]!.asset).toMatchObject({
      bytes: 126004,
      sha256: "f3327774a0461fd2f43fffd1107d772bcb26bd1716af1b4a4353fdd55258a086",
    });
    expect(chapter.panels.at(-1)!.asset).toMatchObject({
      bytes: 91158,
      sha256: "fbc06d81c06c354748cd2ad9a38770b257477f578f569c01f1527fbbc8934a8c",
    });
    expect(chapter.plates.map((plate) => plate.id)).toEqual([
      "A02C1-plate-01",
      "A02C1-plate-02",
      "A02C1-plate-03",
      "A02C1-plate-04",
    ]);
    expect(chapter.plates.every((plate) =>
      plate.panelMapping.status === "source-required"
      && plate.asset.path === `site/assets/art/A02C1/plates/${plate.id}.webp`))
      .toBe(true);
  });

  it("preserves exact Episode 2 and A02C1 source receipts without promoting unavailable expression", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_2_CHAPTER_1_SOURCE.canonicalStory;
    const receipts = new Map(story.sourceReceipts.map((receipt) => [receipt.id, receipt]));
    expect(receipts.get("episode-02-source")).toEqual({
      id: "episode-02-source",
      path: "source/episodes/episode-02.json",
      bytes: 85198,
      sha256: "dbf114eb62e1e20b9d88034a7bcbf27c1ee055841141bc96dd73048687c155cb",
      role: "canonical-story-source",
      available: false,
    });
    expect(receipts.get("episode-02-compiled")).toMatchObject({
      path: "site/data/episode-02.json",
      bytes: 105605,
      sha256: "a3ad82a545032668d58830563c330582b8130720a363abfbfcdb9596f551c67e",
      available: false,
    });
    expect(receipts.get("a02c1-lettering")).toMatchObject({
      bytes: 21161,
      sha256: "0823437970dcf437f82ab376e7525f002af5e202281975b3995e58901a56db79",
      available: false,
    });
    expect(receipts.get("a02c1-scroll-plates")).toMatchObject({
      bytes: 1521,
      sha256: "7ea379f40afddfb1c690096233df438b2042c3e5200594073d45b03e06ae0c04",
      available: false,
    });
  });

  it("internalizes the E01-to-E02 seam in both directions and stops at E02-C2-P21", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_2_CHAPTER_1_SOURCE.canonicalStory;
    const p60 = canonicalStoryCursorForPanel(story, "E01-C3-P60");
    const forward = advanceCanonicalStory(story, p60);
    expect(forward.kind).toBe("panel");
    if (forward.kind !== "panel") throw new Error("Episode 2 opening was not internalized.");
    expect(forward.cursor).toEqual({
      storyId: "burn-protocol",
      episodeId: "E02",
      chapterId: "E02-C1",
      panelId: "E02-C1-P01",
    });
    expect(forward.receipt).toMatchObject({
      action: "next",
      episodeId: "E02",
      chapterId: "E02-C1",
      fromPanelId: "E01-C3-P60",
      toPanelId: "E02-C1-P01",
      canonical: true,
    });

    const reverse = retreatCanonicalStory(story, forward.cursor);
    expect(reverse.kind).toBe("panel");
    if (reverse.kind !== "panel") throw new Error("Episode 1 reverse seam failed.");
    expect(reverse.cursor).toMatchObject({
      episodeId: "E01",
      chapterId: "E01-C3",
      panelId: "E01-C3-P60",
    });

    let cursor = forward.cursor;
    for (let panel = 2; panel <= 20; panel += 1) {
      const next = advanceCanonicalStory(story, cursor);
      expect(next.kind).toBe("panel");
      if (next.kind !== "panel") throw new Error(`Reunion ended before P${panel}.`);
      cursor = next.cursor;
      expect(cursor.panelId).toBe(`E02-C1-P${String(panel).padStart(2, "0")}`);
    }
    expect(advanceCanonicalStory(story, cursor)).toEqual({
      kind: "extent-complete",
      cursor,
      continuationPanelId: "E02-C2-P21",
    });
  });

  it("reports two episodes, eighty panels, and only the next unpublished Chapter 2 panel", () => {
    expect(canonicalStoryCoverage(
      BURN_PROTOCOL_THROUGH_EPISODE_2_CHAPTER_1_SOURCE.canonicalStory,
    )).toEqual({
      episodes: 2,
      chapters: 4,
      panels: 80,
      plates: 16,
      resolvedTextPanels: 0,
      unresolvedTextPanels: 80,
      resolvedPlateMappings: 0,
      unresolvedPlateMappings: 16,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: ["E02"],
      continuationPanelIds: ["E02-C2-P21"],
    });
  });

  it("compiles and recovers the expanded source through the same content-addressed Arc", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_2_CHAPTER_1_SOURCE;
    const arc = compileBurnProtocol(source);
    expect(arc.meta).toMatchObject({
      id: "burn-protocol",
      version: "0.4.0",
      domain: "burn-protocol-canonical-story",
    });
    expect(arc.challenges).toEqual([]);
    expect(arc.roles).toEqual([]);
    expect(arc.extensions?.[BURN_PROTOCOL_EXTENSION_KEY]).toEqual(source);
    expect(arc.extensions?.[CANONICAL_STORY_EXTENSION_KEY]).toEqual(source.canonicalStory);
    expect(readBurnProtocolExtension(arc)).toEqual(source);
    expect(readCanonicalStoryExtension(arc)).toEqual(source.canonicalStory);
    expect(cartridgeDigest(arc)).toMatch(/^cart1_[0-9a-f]{64}$/);
  });

  it("refuses a broken episode seam, duplicate episode, and invented choice", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_2_CHAPTER_1_SOURCE;
    const broken = structuredClone(source);
    broken.canonicalStory.episodes[1]!.chapters[0]!.previousPanelId = "E01-C2-P38";
    broken.canonicalStory.episodes[1]!.chapters[0]!.panels[0]!.previousPanelId = "E01-C2-P38";
    expect(validateBurnProtocol(broken).ok).toBe(false);

    expect(() => appendBurnProtocolEpisode(source, {
      identity: source.identity,
      storyVersion: source.canonicalStory.identity.version,
      sourceReceipts: [],
      missingRequiredReceiptIds: source.estate.missingRequiredReceiptIds,
      boundary: source.estate.boundary,
      episode: BURN_PROTOCOL_EPISODE_2_THROUGH_CHAPTER_1,
    })).toThrow(/duplicates episode/i);

    const invented = structuredClone(source) as unknown as {
      canonicalStory: {
        episodes: Array<{
          chapters: Array<{
            panels: Array<Record<string, unknown>>;
          }>;
        }>;
      };
    };
    invented.canonicalStory.episodes[1]!.chapters[0]!.panels[0]!.choices = [
      { id: "invented-reunion-choice" },
    ];
    expect(validateBurnProtocol(invented).ok).toBe(false);
  });
});
