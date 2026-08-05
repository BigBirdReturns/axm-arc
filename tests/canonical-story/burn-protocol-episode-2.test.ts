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
  BURN_PROTOCOL_EPISODE_2,
  BURN_PROTOCOL_EXTENSION_KEY,
  BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE,
  appendBurnProtocolEpisode,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol canonical Episode 2 source plane", () => {
  it("adds Episode 2 as ordinary episode, chapter, panel, plate, and receipt pieces", () => {
    const validation = validateBurnProtocol(BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE);
    expect(validation.ok).toBe(true);

    const story = BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE.canonicalStory;
    expect(story.episodes.map((episode) => [
      episode.id,
      episode.number,
      episode.title,
      episode.complete,
      episode.nextChapterId,
    ])).toEqual([
      ["E01", 1, "The Broken Road", true, null],
      ["E02", 2, "Ghosts of Then", true, null],
    ]);

    const episode2 = story.episodes[1]!;
    expect(episode2.chapters.map((chapter) => [
      chapter.id,
      chapter.number,
      chapter.title,
      chapter.openingPanelId,
      chapter.terminalPanelId,
      chapter.previousPanelId,
      chapter.nextPanelId,
      chapter.panels.length,
      chapter.plates.length,
    ])).toEqual([
      ["E02-C1", 1, "Reunion", "E02-C1-P01", "E02-C1-P20", "E01-C3-P60", "E02-C2-P21", 20, 4],
      ["E02-C2", 2, "Earth and Titan", "E02-C2-P21", "E02-C2-P40", "E02-C1-P20", "E02-C3-P41", 20, 4],
      ["E02-C3", 3, "Discovery's Echo", "E02-C3-P41", "E02-C3-P60", "E02-C2-P40", "E03-C1-P01", 20, 3],
    ]);

    expect(episode2.chapters.flatMap((chapter) => chapter.panels).map((panel) => panel.id))
      .toEqual(Array.from({ length: 60 }, (_, index) => {
        const number = index + 1;
        const chapter = number <= 20 ? 1 : number <= 40 ? 2 : 3;
        return `E02-C${chapter}-P${String(number).padStart(2, "0")}`;
      }));
  });

  it("preserves multi-episode source custody and exposes the one unresolved plate receipt without inventing a digest", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE;
    expect(source.estate.canonicalSourceReceiptIds).toEqual([
      "episode-01-source",
      "episode-02-source",
    ]);
    expect(source.estate.compiledSourceReceiptIds).toEqual([
      "episode-01-compiled",
      "episode-02-compiled",
    ]);

    const receipts = new Map(
      source.canonicalStory.sourceReceipts.map((receipt) => [receipt.id, receipt]),
    );
    expect(receipts.get("episode-02-source")).toMatchObject({
      path: "source/episodes/episode-02.json",
      bytes: 85198,
      sha256: "dbf114eb62e1e20b9d88034a7bcbf27c1ee055841141bc96dd73048687c155cb",
      available: false,
    });
    expect(receipts.get("a02c3-art-manifest")).toMatchObject({
      path: "manifests/a02c3-art-manifest.csv",
      bytes: 3940,
      sha256: "ef2ae5c0fb30dc3899c9a0930e7fea06d0fbd8765f87178ca7b89a23715a04b3",
      available: false,
    });

    expect(source.notes).toMatchObject({
      assetLedgerGap: {
        id: "A02C3-plate-04",
        path: "site/assets/art/A02C3/plates/A02C3-plate-04.webp",
        expectedBytes: 332220,
        requiredReceiptId: "a02c3-art-manifest",
      },
    });

    const coverage = canonicalStoryCoverage(source.canonicalStory);
    expect(coverage).toEqual({
      episodes: 2,
      chapters: 6,
      panels: 120,
      plates: 23,
      resolvedTextPanels: 0,
      unresolvedTextPanels: 120,
      resolvedPlateMappings: 0,
      unresolvedPlateMappings: 23,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: [],
      continuationPanelIds: ["E03-C1-P01"],
    });
  });

  it("crosses the Episode 1 to Episode 2 seam and both Episode 2 chapter seams in both directions", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE.canonicalStory;
    for (const [fromPanelId, toPanelId] of [
      ["E01-C3-P60", "E02-C1-P01"],
      ["E02-C1-P20", "E02-C2-P21"],
      ["E02-C2-P40", "E02-C3-P41"],
    ] as const) {
      const from = canonicalStoryCursorForPanel(story, fromPanelId);
      const forward = advanceCanonicalStory(story, from);
      expect(forward.kind).toBe("panel");
      if (forward.kind !== "panel") throw new Error(`Expected ${toPanelId}.`);
      expect(forward.cursor.panelId).toBe(toPanelId);
      expect(forward.receipt).toMatchObject({
        fromPanelId,
        toPanelId,
        canonical: true,
      });

      const reverse = retreatCanonicalStory(story, forward.cursor);
      expect(reverse.kind).toBe("panel");
      if (reverse.kind === "panel") expect(reverse.cursor.panelId).toBe(fromPanelId);
    }
  });

  it("executes all 120 fixed panels and stops only at Episode 3", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE.canonicalStory;
    let cursor = initialCanonicalStoryCursor(story).cursor;
    const visited = [cursor.panelId];
    while (true) {
      const result = advanceCanonicalStory(story, cursor);
      if (result.kind === "extent-complete") {
        expect(result.continuationPanelId).toBe("E03-C1-P01");
        break;
      }
      cursor = result.cursor;
      visited.push(cursor.panelId);
    }
    expect(visited).toHaveLength(120);
    expect(visited[0]).toBe("E01-C1-P01");
    expect(visited[59]).toBe("E01-C3-P60");
    expect(visited[60]).toBe("E02-C1-P01");
    expect(visited.at(-1)).toBe("E02-C3-P60");
    expect(new Set(visited).size).toBe(120);
  });

  it("compiles one stable content-addressed Arc and recovers the exact continuing Burn source", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE;
    const arc = compileBurnProtocol(source);
    expect(arc.meta.id).toBe("burn-protocol");
    expect(arc.meta.domain).toBe("burn-protocol-canonical-story");
    expect(arc.challenges).toEqual([]);
    expect(arc.roles).toEqual([]);
    expect(arc.extensions?.[BURN_PROTOCOL_EXTENSION_KEY]).toEqual(source);
    expect(arc.extensions?.[CANONICAL_STORY_EXTENSION_KEY]).toEqual(
      source.canonicalStory,
    );
    expect(readBurnProtocolExtension(arc)).toEqual(source);
    expect(readCanonicalStoryExtension(arc)).toEqual(source.canonicalStory);
    expect(cartridgeDigest(arc)).toMatch(/^cart1_[0-9a-f]{64}$/);
  });

  it("refuses a broken inter-episode seam, duplicate episode, and invented branching", () => {
    const broken = structuredClone(BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE);
    broken.canonicalStory.episodes[1]!.chapters[0]!.previousPanelId = "E01-C3-P59";
    broken.canonicalStory.episodes[1]!.chapters[0]!.panels[0]!.previousPanelId =
      "E01-C3-P59";
    expect(validateBurnProtocol(broken).ok).toBe(false);

    expect(() => appendBurnProtocolEpisode(
      BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE,
      {
        identity: BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE.identity,
        storyVersion: "0.4.1",
        sourceReceipts: [],
        canonicalSourceReceiptIds: ["episode-01-source", "episode-02-source"],
        compiledSourceReceiptIds: ["episode-01-compiled", "episode-02-compiled"],
        missingRequiredReceiptIds:
          BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE.estate.missingRequiredReceiptIds,
        boundary: BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE.estate.boundary,
        episode: BURN_PROTOCOL_EPISODE_2,
      },
    )).toThrow(/duplicates episode/i);

    const invented = structuredClone(
      BURN_PROTOCOL_THROUGH_EPISODE_2_SOURCE.canonicalStory,
    ) as unknown as {
      episodes: Array<{
        chapters: Array<{ panels: Array<Record<string, unknown>> }>;
      }>;
    };
    invented.episodes[1]!.chapters[0]!.panels[0]!.choices = [
      { id: "invented-episode-branch" },
    ];
    expect(() => parseCanonicalStory(invented)).toThrow(/choices/);
  });
});
