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
  BURN_PROTOCOL_EPISODE_4_CHAPTER_3,
  BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol complete Episode 4", () => {
  it("appends The Dead Man's Checksum and closes Episode 4", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE;
    expect(validateBurnProtocol(source).ok).toBe(true);
    expect(source.identity).toMatchObject({ id: "burn-protocol", version: "0.10.0" });
    expect(source.canonicalStory.episodes.map((episode) => [
      episode.id,
      episode.number,
      episode.title,
      episode.complete,
      episode.nextChapterId,
      episode.chapters.length,
    ])).toEqual([
      ["E01", 1, "The Broken Road", true, null, 3],
      ["E02", 2, "Ghosts of Then", true, null, 3],
      ["E03", 3, "The Omega Thread", true, null, 3],
      ["E04", 4, "Fractured Allegiances", true, null, 3],
    ]);
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_3).toMatchObject({
      id: "E04-C3",
      number: 3,
      title: "The Dead Man's Checksum",
      openingPanelId: "E04-C3-P41",
      terminalPanelId: "E04-C3-P60",
      previousPanelId: "E04-C2-P40",
      nextPanelId: "E05-C1-P01",
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_3.panels).toHaveLength(20);
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_3.plates).toHaveLength(4);
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_3.panels.map((panel) => panel.id)).toEqual(
      Array.from({ length: 20 }, (_, index) =>
        `E04-C3-P${String(index + 41).padStart(2, "0")}`),
    );
  });

  it("crosses the final Episode 4 chapter seam in both directions", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE.canonicalStory;
    const terminal = canonicalStoryCursorForPanel(story, "E04-C2-P40");
    const forward = advanceCanonicalStory(story, terminal);
    expect(forward.kind).toBe("panel");
    if (forward.kind !== "panel") throw new Error("Expected E04-C3-P41.");
    expect(forward.cursor).toEqual({
      storyId: "burn-protocol",
      episodeId: "E04",
      chapterId: "E04-C3",
      panelId: "E04-C3-P41",
    });
    expect(forward.receipt).toMatchObject({
      fromPanelId: "E04-C2-P40",
      toPanelId: "E04-C3-P41",
      episodeId: "E04",
      chapterId: "E04-C3",
      canonical: true,
    });

    const reverse = retreatCanonicalStory(story, forward.cursor);
    expect(reverse.kind).toBe("panel");
    if (reverse.kind === "panel") {
      expect(reverse.cursor).toMatchObject({
        episodeId: "E04",
        chapterId: "E04-C2",
        panelId: "E04-C2-P40",
      });
    }
  });

  it("traverses 240 fixed panels and stops only at Episode 5", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE.canonicalStory;
    expect(canonicalStoryCoverage(story)).toMatchObject({
      episodes: 4,
      chapters: 12,
      panels: 240,
      plates: 48,
      unresolvedTextPanels: 240,
      unresolvedPlateMappings: 48,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: [],
      continuationPanelIds: ["E05-C1-P01"],
    });

    let cursor = initialCanonicalStoryCursor(story).cursor;
    const visited = [cursor.panelId];
    while (true) {
      const result = advanceCanonicalStory(story, cursor);
      if (result.kind === "extent-complete") {
        expect(result.continuationPanelId).toBe("E05-C1-P01");
        break;
      }
      cursor = result.cursor;
      visited.push(cursor.panelId);
    }
    expect(visited).toHaveLength(240);
    expect(visited[219]).toBe("E04-C2-P40");
    expect(visited[220]).toBe("E04-C3-P41");
    expect(visited.at(-1)).toBe("E04-C3-P60");
    expect(new Set(visited).size).toBe(240);
  });

  it("binds the exact A04C3 source and media ledger without promoting expression", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE;
    const receipts = new Map(source.canonicalStory.sourceReceipts.map((receipt) => [
      receipt.id,
      receipt,
    ]));
    expect(receipts.get("a04c3-chapter-source")).toMatchObject({
      path: "source/art/A04C3/chapter.json",
      bytes: 2016,
      sha256: "b2ff5fbf635b677684a3c3eb843fc358a0be101edaa1610fb05966b4e92cf814",
      available: false,
    });
    expect(receipts.get("a04c3-lettering-source")).toMatchObject({
      path: "source/art/A04C3/lettering.json",
      bytes: 28761,
      sha256: "4f13e90c9616cd1e13025ac4e5c51b497593ce1a65f08dd36c384feb1e0d4012",
      available: false,
    });
    expect(receipts.get("a04c3-scroll-plates")).toMatchObject({
      path: "manifests/a04c3-scroll-plates.json",
      bytes: 1521,
      sha256: "96d12414747c00f6073016f2ddcff5b5fa45f4f167b610d4a7087612f98fbdd8",
      available: false,
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_3.panels[0]?.asset).toMatchObject({
      path: "site/assets/art/A04C3/panels/E04-C3-P41.webp",
      bytes: 105096,
      sha256: "ba23bf753e07a318fd54659b0bfebdd2ebbc96669bc86a82a5ee399b776d5cc8",
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_3.panels.at(-1)?.asset).toMatchObject({
      path: "site/assets/art/A04C3/panels/E04-C3-P60.webp",
      bytes: 105160,
      sha256: "0c2b8a54ba8e6e7ea9eb3de86a1ab1af6d79e15ba2de34193ef329488b7cb96d",
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_3.plates[0]?.asset).toMatchObject({
      path: "site/assets/art/A04C3/plates/A04C3-plate-01.webp",
      bytes: 442138,
      sha256: "d86850d47dee3e6bb83d5c2742fa9220fbe5a0ef087b89cdc7eab86c4c2e4d4a",
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_3.plates.at(-1)?.asset).toMatchObject({
      path: "site/assets/art/A04C3/plates/A04C3-plate-04.webp",
      bytes: 474020,
      sha256: "2b53efc4f8a1cc1d41468f405e4813b191a3c9a710ee9d9715b6929afaa93420",
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_3.panels.every(
      (panel) => panel.text.status === "source-required",
    )).toBe(true);
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_3.plates.every(
      (plate) => plate.panelMapping.status === "source-required",
    )).toBe(true);
  });

  it("retains the inherited asset gap and compiles no simulation law", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE;
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
