import { describe, expect, it } from "vitest";
import {
  advanceCanonicalStory,
  canonicalStoryAssetIsManifested,
  canonicalStoryCoverage,
  canonicalStoryCursorForPanel,
  initialCanonicalStoryCursor,
  retreatCanonicalStory,
} from "../../src/canonical-story/index.js";
import {
  BURN_PROTOCOL_EPISODE_3_CHAPTER_2,
  BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_2_SOURCE,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol through Episode 3 Chapter 2", () => {
  it("appends Lockout as ordinary chapter, panel, plate, and receipt pieces", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_2_SOURCE;
    expect(validateBurnProtocol(source).ok).toBe(true);
    expect(source.identity.id).toBe("burn-protocol");
    expect(source.canonicalStory.episodes.map((episode) => [
      episode.id,
      episode.number,
      episode.complete,
      episode.nextChapterId,
    ])).toEqual([
      ["E01", 1, true, null],
      ["E02", 2, true, null],
      ["E03", 3, false, "E03-C3"],
    ]);
    expect(BURN_PROTOCOL_EPISODE_3_CHAPTER_2).toMatchObject({
      id: "E03-C2",
      title: "Lockout",
      openingPanelId: "E03-C2-P21",
      terminalPanelId: "E03-C2-P40",
      previousPanelId: "E03-C1-P20",
      nextPanelId: "E03-C3-P41",
    });
    expect(BURN_PROTOCOL_EPISODE_3_CHAPTER_2.panels).toHaveLength(20);
    expect(BURN_PROTOCOL_EPISODE_3_CHAPTER_2.plates).toHaveLength(4);
  });

  it("represents the unavailable P31 digest as source-required rather than fabricating custody", () => {
    const panel = BURN_PROTOCOL_EPISODE_3_CHAPTER_2.panels.find(
      (candidate) => candidate.id === "E03-C2-P31",
    );
    expect(panel).toBeDefined();
    expect(panel?.asset).toEqual({
      status: "source-required",
      id: "asset:E03-C2-P31",
      path: "site/assets/art/A03C2/panels/E03-C2-P31.webp",
      expectedBytes: 156208,
      mimeType: "image/webp",
      availability: "manifested-external",
      visualStanding: "missing",
      expectedSourceReceiptIds: ["a03c2-art-manifest"],
      reason: expect.stringMatching(/no digest has been invented/i),
    });
    expect(canonicalStoryAssetIsManifested(panel!.asset)).toBe(false);
    expect("sha256" in panel!.asset).toBe(false);
    expect(BURN_PROTOCOL_EPISODE_3_CHAPTER_2.panels.filter(
      (candidate) => canonicalStoryAssetIsManifested(candidate.asset),
    )).toHaveLength(19);
  });

  it("crosses the Chapter 1 to Chapter 2 seam in both directions", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_2_SOURCE.canonicalStory;
    const terminal = canonicalStoryCursorForPanel(story, "E03-C1-P20");
    const forward = advanceCanonicalStory(story, terminal);
    expect(forward.kind).toBe("panel");
    if (forward.kind !== "panel") throw new Error("Expected Episode 3 Chapter 2 opening.");
    expect(forward.cursor).toMatchObject({
      episodeId: "E03",
      chapterId: "E03-C2",
      panelId: "E03-C2-P21",
    });
    expect(forward.receipt).toMatchObject({
      fromPanelId: "E03-C1-P20",
      toPanelId: "E03-C2-P21",
      canonical: true,
    });
    const reverse = retreatCanonicalStory(story, forward.cursor);
    expect(reverse.kind).toBe("panel");
    if (reverse.kind === "panel") expect(reverse.cursor.panelId).toBe("E03-C1-P20");
  });

  it("traverses 160 fixed panels and exposes only E03-C3-P41 as continuation", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_2_SOURCE.canonicalStory;
    const coverage = canonicalStoryCoverage(story);
    expect(coverage).toMatchObject({
      episodes: 3,
      chapters: 8,
      panels: 160,
      plates: 32,
      unresolvedTextPanels: 160,
      unresolvedPlateMappings: 32,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: ["E03"],
      continuationPanelIds: ["E03-C3-P41"],
    });

    let cursor = initialCanonicalStoryCursor(story).cursor;
    const visited = [cursor.panelId];
    while (true) {
      const result = advanceCanonicalStory(story, cursor);
      if (result.kind === "extent-complete") {
        expect(result.continuationPanelId).toBe("E03-C3-P41");
        break;
      }
      cursor = result.cursor;
      visited.push(cursor.panelId);
    }
    expect(visited).toHaveLength(160);
    expect(visited[139]).toBe("E03-C1-P20");
    expect(visited[140]).toBe("E03-C2-P21");
    expect(visited.at(-1)).toBe("E03-C2-P40");
    expect(new Set(visited).size).toBe(160);
  });

  it("compiles one content-addressed Arc with no simulation or choice law", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_3_CHAPTER_2_SOURCE;
    const arc = compileBurnProtocol(source);
    expect(arc.meta.id).toBe("burn-protocol");
    expect(arc.challenges).toEqual([]);
    expect(arc.roles).toEqual([]);
    expect(readBurnProtocolExtension(arc)).toEqual(source);
    expect(cartridgeDigest(arc)).toMatch(/^cart1_[0-9a-f]{64}$/);
  });
});
