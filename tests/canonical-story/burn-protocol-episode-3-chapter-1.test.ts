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
  appendBurnProtocolEpisode,
  BURN_PROTOCOL_EPISODE_3_CHAPTER_1,
  BURN_PROTOCOL_EPISODE_3_THROUGH_CHAPTER_1,
  BURN_PROTOCOL_EXTENSION_KEY,
  BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol through Episode 3, Chapter 1", () => {
  it("appends Headquarters as ordinary Episode 3 data under the stable cartridge identity", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE;
    expect(validateBurnProtocol(source).ok).toBe(true);
    expect(source.identity).toMatchObject({ id: "burn-protocol", version: "0.5.0" });
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
        complete: true,
        nextChapterId: null,
        chapterIds: ["E02-C1", "E02-C2", "E02-C3"],
      },
      {
        id: "E03",
        number: 3,
        title: "The Omega Thread",
        complete: false,
        nextChapterId: "E03-C2",
        chapterIds: ["E03-C1"],
      },
    ]);
    expect(BURN_PROTOCOL_EPISODE_3_THROUGH_CHAPTER_1).toEqual(
      source.canonicalStory.episodes[2],
    );
  });

  it("represents all twenty Headquarters panels and four plates from the v0.62 ledger", () => {
    const chapter = BURN_PROTOCOL_EPISODE_3_CHAPTER_1;
    expect(chapter).toMatchObject({
      id: "E03-C1",
      number: 1,
      title: "Headquarters",
      complete: true,
      openingPanelId: "E03-C1-P01",
      terminalPanelId: "E03-C1-P20",
      previousPanelId: "E02-C3-P60",
      nextPanelId: "E03-C2-P21",
    });
    expect(chapter.panels.map((panel) => panel.id)).toEqual(
      Array.from({ length: 20 }, (_, index) =>
        `E03-C1-P${String(index + 1).padStart(2, "0")}`),
    );
    expect(chapter.panels[0]!.asset).toMatchObject({
      path: "site/assets/art/A03C1/panels/E03-C1-P01.webp",
      bytes: 174158,
      sha256: "77fc8652214c06c5f6c6e9cb00193185f823db8d090331012a469e698160d7ac",
    });
    expect(chapter.panels.at(-1)!.asset).toMatchObject({
      path: "site/assets/art/A03C1/panels/E03-C1-P20.webp",
      bytes: 126060,
      sha256: "f1f4ad0e80b4235b4793a559a0822246e12bf565c627cef46d3564ea3b6599d3",
    });
    expect(chapter.panels.every((panel) =>
      panel.text.status === "source-required"
      && panel.asset.availability === "manifested-external"
      && panel.asset.visualStanding === "q02-review-required"))
      .toBe(true);
    expect(chapter.plates.map((plate) => [
      plate.id,
      plate.asset.bytes,
      plate.asset.sha256,
    ])).toEqual([
      ["A03C1-plate-01", 543238, "8b873d0d3ec6951cacc318cdb270ef8010a572f0d3dbbbf9a4beccdc5c01d5c0"],
      ["A03C1-plate-02", 630502, "c9e162e3816a567734b23dc121a201e6947d4954d5a5f25e8302308d2603007f"],
      ["A03C1-plate-03", 632808, "e17b782aa1435803ef2e31a55bb2432a3ddee78b6be0fe16da9b8efc5fd3b9fb"],
      ["A03C1-plate-04", 631940, "8fcfc3b0027472219993fea2956f48847b9821aa3b45bde5f7a7bd66ae146d94"],
    ]);
  });

  it("recovers the exact omitted A02C3 plate row before extending the series", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE;
    const chapter = source.canonicalStory.episodes[1]!.chapters[2]!;
    expect(chapter.plates).toHaveLength(4);
    expect(chapter.plates.at(-1)).toMatchObject({
      id: "A02C3-plate-04",
      ordinal: 4,
      asset: {
        path: "site/assets/art/A02C3/plates/A02C3-plate-04.webp",
        bytes: 332220,
        sha256: "ea21b4b95e72da8c8d8372bdf1b76c65ec8d97c88dd14aa266094458cfa3d65d",
      },
    });
    expect(source.estate.missingRequiredReceiptIds).not.toContain("a02c3-art-manifest");
    expect(source.notes).toMatchObject({
      inheritedAssetLedgerRecovery: {
        id: "A02C3-plate-04",
        bytes: 332220,
      },
    });
  });

  it("preserves exact Episode 3 source custody without inventing a compiled receipt", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE;
    const receipts = new Map(
      source.canonicalStory.sourceReceipts.map((receipt) => [receipt.id, receipt]),
    );
    expect(receipts.get("episode-03-source")).toEqual({
      id: "episode-03-source",
      path: "source/episodes/episode-03.json",
      bytes: 107884,
      sha256: "5960f8f6849a5c03d28f286fdca49259056fc18a07f85a4a1b2a69a79e903998",
      role: "canonical-story-source",
      available: false,
    });
    expect(receipts.get("episode-03-script")).toMatchObject({
      path: "scripts/episode-03-the-omega-thread.md",
      bytes: 73375,
      sha256: "633fcaa5a1ff302e0aefbeeaf3afb4b4d5f64dc9574df9997bc35db2d0530d44",
    });
    expect(source.estate.canonicalSourceReceiptIds).toEqual([
      "episode-01-source",
      "episode-02-source",
      "episode-03-source",
    ]);
    expect(source.estate.compiledSourceReceiptIds).toEqual([
      "episode-01-compiled",
      "episode-02-compiled",
    ]);
    expect(source.notes).toMatchObject({
      sourceLedgerGaps: [{
        id: "episode-03-compiled",
        path: "site/data/episode-03.json",
      }],
    });
  });

  it("internalizes the E02-to-E03 seam in both directions and stops at E03-C2-P21", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE.canonicalStory;
    const prior = canonicalStoryCursorForPanel(story, "E02-C3-P60");
    const forward = advanceCanonicalStory(story, prior);
    expect(forward.kind).toBe("panel");
    if (forward.kind !== "panel") throw new Error("Episode 3 opening was not internalized.");
    expect(forward.cursor).toEqual({
      storyId: "burn-protocol",
      episodeId: "E03",
      chapterId: "E03-C1",
      panelId: "E03-C1-P01",
    });
    expect(forward.receipt).toMatchObject({
      fromPanelId: "E02-C3-P60",
      toPanelId: "E03-C1-P01",
      episodeId: "E03",
      chapterId: "E03-C1",
      canonical: true,
    });
    const reverse = retreatCanonicalStory(story, forward.cursor);
    expect(reverse.kind).toBe("panel");
    if (reverse.kind === "panel") expect(reverse.cursor.panelId).toBe("E02-C3-P60");

    let cursor = forward.cursor;
    for (let panel = 2; panel <= 20; panel += 1) {
      const result = advanceCanonicalStory(story, cursor);
      expect(result.kind).toBe("panel");
      if (result.kind !== "panel") throw new Error(`Headquarters ended before P${panel}.`);
      cursor = result.cursor;
    }
    expect(advanceCanonicalStory(story, cursor)).toEqual({
      kind: "extent-complete",
      cursor,
      continuationPanelId: "E03-C2-P21",
    });
  });

  it("executes all 140 fixed panels and reports only the next unpublished Episode 3 chapter", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE.canonicalStory;
    const coverage = canonicalStoryCoverage(story);
    expect(coverage).toEqual({
      episodes: 3,
      chapters: 7,
      panels: 140,
      plates: 28,
      resolvedTextPanels: 0,
      unresolvedTextPanels: 140,
      resolvedPlateMappings: 0,
      unresolvedPlateMappings: 28,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: ["E03"],
      continuationPanelIds: ["E03-C2-P21"],
    });

    let cursor = initialCanonicalStoryCursor(story).cursor;
    const visited = [cursor.panelId];
    while (true) {
      const result = advanceCanonicalStory(story, cursor);
      if (result.kind === "extent-complete") {
        expect(result.continuationPanelId).toBe("E03-C2-P21");
        break;
      }
      cursor = result.cursor;
      visited.push(cursor.panelId);
    }
    expect(visited).toHaveLength(140);
    expect(visited[119]).toBe("E02-C3-P60");
    expect(visited[120]).toBe("E03-C1-P01");
    expect(visited.at(-1)).toBe("E03-C1-P20");
    expect(new Set(visited).size).toBe(140);
  });

  it("compiles one content-addressed Arc and refuses seam, duplicate, and choice drift", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_1_SOURCE;
    const arc = compileBurnProtocol(source);
    expect(arc.meta.id).toBe("burn-protocol");
    expect(arc.challenges).toEqual([]);
    expect(arc.roles).toEqual([]);
    expect(arc.extensions?.[BURN_PROTOCOL_EXTENSION_KEY]).toEqual(source);
    expect(arc.extensions?.[CANONICAL_STORY_EXTENSION_KEY]).toEqual(source.canonicalStory);
    expect(readBurnProtocolExtension(arc)).toEqual(source);
    expect(readCanonicalStoryExtension(arc)).toEqual(source.canonicalStory);
    expect(cartridgeDigest(arc)).toMatch(/^cart1_[0-9a-f]{64}$/);

    const broken = structuredClone(source);
    broken.canonicalStory.episodes[2]!.chapters[0]!.previousPanelId = "E02-C3-P59";
    broken.canonicalStory.episodes[2]!.chapters[0]!.panels[0]!.previousPanelId =
      "E02-C3-P59";
    expect(validateBurnProtocol(broken).ok).toBe(false);

    expect(() => appendBurnProtocolEpisode(source, {
      identity: source.identity,
      storyVersion: "0.5.1",
      sourceReceipts: [],
      canonicalSourceReceiptIds: source.estate.canonicalSourceReceiptIds!,
      compiledSourceReceiptIds: source.estate.compiledSourceReceiptIds!,
      missingRequiredReceiptIds: source.estate.missingRequiredReceiptIds,
      boundary: source.estate.boundary,
      episode: BURN_PROTOCOL_EPISODE_3_THROUGH_CHAPTER_1,
    })).toThrow(/duplicates episode/i);

    const invented = structuredClone(source.canonicalStory) as unknown as {
      episodes: Array<{
        chapters: Array<{ panels: Array<Record<string, unknown>> }>;
      }>;
    };
    invented.episodes[2]!.chapters[0]!.panels[0]!.choices = [
      { id: "invented-omega-choice" },
    ];
    expect(() => parseCanonicalStory(invented)).toThrow(/choices/);
  });
});
