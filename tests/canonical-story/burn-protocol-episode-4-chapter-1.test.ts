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
  BURN_PROTOCOL_EPISODE_4_CHAPTER_1,
  BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_1_SOURCE,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol Episode 4 Chapter 1", () => {
  it("appends Osyraa's Offer as ordinary episode and chapter pieces", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_1_SOURCE;
    expect(validateBurnProtocol(source).ok).toBe(true);
    expect(source.identity).toMatchObject({ id: "burn-protocol", version: "0.8.0" });
    expect(source.canonicalStory.episodes.map((episode) => [
      episode.id,
      episode.number,
      episode.title,
      episode.complete,
      episode.nextChapterId,
    ])).toEqual([
      ["E01", 1, "The Broken Road", true, null],
      ["E02", 2, "Ghosts of Then", true, null],
      ["E03", 3, "The Omega Thread", true, null],
      ["E04", 4, "Fractured Allegiances", false, "E04-C2"],
    ]);
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_1).toMatchObject({
      id: "E04-C1",
      title: "Osyraa's Offer",
      openingPanelId: "E04-C1-P01",
      terminalPanelId: "E04-C1-P20",
      previousPanelId: "E03-C3-P60",
      nextPanelId: "E04-C2-P21",
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_1.panels).toHaveLength(20);
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_1.plates).toHaveLength(4);
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_1.panels.map((panel) => panel.id)).toEqual(
      Array.from({ length: 20 }, (_, index) =>
        `E04-C1-P${String(index + 1).padStart(2, "0")}`),
    );
  });

  it("crosses the Episode 3 to Episode 4 seam in both directions", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_1_SOURCE.canonicalStory;
    const terminal = canonicalStoryCursorForPanel(story, "E03-C3-P60");
    const forward = advanceCanonicalStory(story, terminal);
    expect(forward.kind).toBe("panel");
    if (forward.kind !== "panel") throw new Error("Expected E04-C1-P01.");
    expect(forward.cursor).toMatchObject({
      episodeId: "E04",
      chapterId: "E04-C1",
      panelId: "E04-C1-P01",
    });
    expect(forward.receipt).toMatchObject({
      fromPanelId: "E03-C3-P60",
      toPanelId: "E04-C1-P01",
      episodeId: "E04",
      chapterId: "E04-C1",
      canonical: true,
    });

    const reverse = retreatCanonicalStory(story, forward.cursor);
    expect(reverse.kind).toBe("panel");
    if (reverse.kind === "panel") {
      expect(reverse.cursor).toMatchObject({
        episodeId: "E03",
        chapterId: "E03-C3",
        panelId: "E03-C3-P60",
      });
    }
  });

  it("traverses 200 fixed panels and stops only at Episode 4 Chapter 2", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_1_SOURCE.canonicalStory;
    expect(canonicalStoryCoverage(story)).toMatchObject({
      episodes: 4,
      chapters: 10,
      panels: 200,
      plates: 40,
      unresolvedTextPanels: 200,
      unresolvedPlateMappings: 40,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: ["E04"],
      continuationPanelIds: ["E04-C2-P21"],
    });

    let cursor = initialCanonicalStoryCursor(story).cursor;
    const visited = [cursor.panelId];
    while (true) {
      const result = advanceCanonicalStory(story, cursor);
      if (result.kind === "extent-complete") {
        expect(result.continuationPanelId).toBe("E04-C2-P21");
        break;
      }
      cursor = result.cursor;
      visited.push(cursor.panelId);
    }
    expect(visited).toHaveLength(200);
    expect(visited[179]).toBe("E03-C3-P60");
    expect(visited[180]).toBe("E04-C1-P01");
    expect(visited.at(-1)).toBe("E04-C1-P20");
    expect(new Set(visited).size).toBe(200);
  });

  it("binds exact Episode 4 and A04C1 receipts without resolving absent text", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_1_SOURCE;
    const receipts = new Map(source.canonicalStory.sourceReceipts.map((receipt) => [
      receipt.id,
      receipt,
    ]));
    expect(receipts.get("episode-04-source")).toMatchObject({
      path: "source/episodes/episode-04.json",
      bytes: 111285,
      sha256: "a6c18aef5acdbc4108b955ebfa5c50e6be2b08adb49987502f9a0bd533c9bdda",
      available: false,
    });
    expect(receipts.get("episode-04-compiled")).toMatchObject({
      path: "site/data/episode-04.json",
      bytes: 164954,
      sha256: "a92f19d2b04e8589da86471ad81771a68710111105e3e80dca8279c9aa570884",
      available: false,
    });
    expect(receipts.get("a04c1-lettering-source")).toMatchObject({
      path: "source/art/A04C1/lettering.json",
      bytes: 25330,
      sha256: "2c825035d0fc05dd3e8fc6151f75df70c4cd8745f8686ad3b80e4ebaa78cd093",
      available: false,
    });
    expect(receipts.get("a04c1-scroll-plates")).toMatchObject({
      path: "manifests/a04c1-scroll-plates.json",
      bytes: 1521,
      sha256: "bca6a43a880eb30433f9c3f0665c3b1e22fc38a4bbe725167e1c41b5e48fecc0",
      available: false,
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_1.panels.every(
      (panel) => panel.text.status === "source-required",
    )).toBe(true);
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_1.plates.every(
      (plate) => plate.panelMapping.status === "source-required",
    )).toBe(true);
  });

  it("retains the inherited asset gap and compiles no simulation law", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_1_SOURCE;
    const assets = source.canonicalStory.episodes.flatMap((episode) => episode.chapters)
      .flatMap((chapter) => [
        ...chapter.panels.map((panel) => panel.asset),
        ...chapter.plates.map((plate) => plate.asset),
      ]);
    expect(assets.filter((asset) => !canonicalStoryAssetIsManifested(asset)).map((asset) => asset.id))
      .toEqual(["asset:E03-C2-P31"]);

    const arc = compileBurnProtocol(source);
    expect(arc.meta.id).toBe("burn-protocol");
    expect(arc.challenges).toEqual([]);
    expect(arc.roles).toEqual([]);
    expect(readBurnProtocolExtension(arc)).toEqual(source);
    expect(cartridgeDigest(arc)).toMatch(/^cart1_[0-9a-f]{64}$/);
  });
});
