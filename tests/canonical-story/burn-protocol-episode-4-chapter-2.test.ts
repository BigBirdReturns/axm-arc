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
  BURN_PROTOCOL_EPISODE_4_CHAPTER_2,
  BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_2_SOURCE,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol Episode 4 Chapter 2", () => {
  it("appends Georgiou's Pattern as one ordinary chapter", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_2_SOURCE;
    expect(validateBurnProtocol(source).ok).toBe(true);
    expect(source.identity).toMatchObject({ id: "burn-protocol", version: "0.9.0" });
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
      ["E04", 4, "Fractured Allegiances", false, "E04-C3", 2],
    ]);
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_2).toMatchObject({
      id: "E04-C2",
      number: 2,
      title: "Georgiou's Pattern",
      openingPanelId: "E04-C2-P21",
      terminalPanelId: "E04-C2-P40",
      previousPanelId: "E04-C1-P20",
      nextPanelId: "E04-C3-P41",
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_2.panels).toHaveLength(20);
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_2.plates).toHaveLength(4);
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_2.panels.map((panel) => panel.id)).toEqual(
      Array.from({ length: 20 }, (_, index) =>
        `E04-C2-P${String(index + 21).padStart(2, "0")}`),
    );
  });

  it("crosses the Episode 4 chapter seam in both directions", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_2_SOURCE.canonicalStory;
    const terminal = canonicalStoryCursorForPanel(story, "E04-C1-P20");
    const forward = advanceCanonicalStory(story, terminal);
    expect(forward.kind).toBe("panel");
    if (forward.kind !== "panel") throw new Error("Expected E04-C2-P21.");
    expect(forward.cursor).toEqual({
      storyId: "burn-protocol",
      episodeId: "E04",
      chapterId: "E04-C2",
      panelId: "E04-C2-P21",
    });
    expect(forward.receipt).toMatchObject({
      fromPanelId: "E04-C1-P20",
      toPanelId: "E04-C2-P21",
      episodeId: "E04",
      chapterId: "E04-C2",
      canonical: true,
    });

    const reverse = retreatCanonicalStory(story, forward.cursor);
    expect(reverse.kind).toBe("panel");
    if (reverse.kind === "panel") {
      expect(reverse.cursor).toMatchObject({
        episodeId: "E04",
        chapterId: "E04-C1",
        panelId: "E04-C1-P20",
      });
    }
  });

  it("traverses 220 fixed panels and stops only at Episode 4 Chapter 3", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_2_SOURCE.canonicalStory;
    expect(canonicalStoryCoverage(story)).toMatchObject({
      episodes: 4,
      chapters: 11,
      panels: 220,
      plates: 44,
      unresolvedTextPanels: 220,
      unresolvedPlateMappings: 44,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: ["E04"],
      continuationPanelIds: ["E04-C3-P41"],
    });

    let cursor = initialCanonicalStoryCursor(story).cursor;
    const visited = [cursor.panelId];
    while (true) {
      const result = advanceCanonicalStory(story, cursor);
      if (result.kind === "extent-complete") {
        expect(result.continuationPanelId).toBe("E04-C3-P41");
        break;
      }
      cursor = result.cursor;
      visited.push(cursor.panelId);
    }
    expect(visited).toHaveLength(220);
    expect(visited[199]).toBe("E04-C1-P20");
    expect(visited[200]).toBe("E04-C2-P21");
    expect(visited.at(-1)).toBe("E04-C2-P40");
    expect(new Set(visited).size).toBe(220);
  });

  it("binds the exact A04C2 source and media ledger without promoting expression", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_2_SOURCE;
    const receipts = new Map(source.canonicalStory.sourceReceipts.map((receipt) => [
      receipt.id,
      receipt,
    ]));
    expect(receipts.get("a04c2-chapter-source")).toMatchObject({
      path: "source/art/A04C2/chapter.json",
      bytes: 2011,
      sha256: "072d60a661e01ddd8669c729eab0f545d43648241f91ab77e2b671c1c1812553",
      available: false,
    });
    expect(receipts.get("a04c2-lettering-source")).toMatchObject({
      path: "source/art/A04C2/lettering.json",
      bytes: 28727,
      sha256: "7dc95ce86cdf38616177a2ad6bf743981f57f29223907c464aae5c8cba008636",
      available: false,
    });
    expect(receipts.get("a04c2-scroll-plates")).toMatchObject({
      path: "manifests/a04c2-scroll-plates.json",
      bytes: 1521,
      sha256: "f3e9d4be5dbf8e2f788357c7d909349d846072da983a124fb56edeef3dabf3f3",
      available: false,
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_2.panels[0]?.asset).toMatchObject({
      path: "site/assets/art/A04C2/panels/E04-C2-P21.webp",
      bytes: 179966,
      sha256: "af5e1b520c32d8a7c7c9fb2af529dd9c3bf68f940e38779c1240ab0ac53a67e6",
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_2.panels.at(-1)?.asset).toMatchObject({
      path: "site/assets/art/A04C2/panels/E04-C2-P40.webp",
      bytes: 147124,
      sha256: "0030e166fc6518998d9fba4416f8497649a528cdb1bc149a5e97eb8175c9f218",
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_2.plates[0]?.asset).toMatchObject({
      path: "site/assets/art/A04C2/plates/A04C2-plate-01.webp",
      bytes: 693458,
      sha256: "70c253211051166d075aa268c59a7f1c3e29419f5ad32d5e686e6ca6a5df4967",
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_2.plates.at(-1)?.asset).toMatchObject({
      path: "site/assets/art/A04C2/plates/A04C2-plate-04.webp",
      bytes: 690254,
      sha256: "d41bc352982b6082afbc738691a1badc4c695d9e57616e117a03d4918ed25f3b",
    });
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_2.panels.every(
      (panel) => panel.text.status === "source-required",
    )).toBe(true);
    expect(BURN_PROTOCOL_EPISODE_4_CHAPTER_2.plates.every(
      (plate) => plate.panelMapping.status === "source-required",
    )).toBe(true);
  });

  it("retains the inherited asset gap and compiles no simulation law", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_4_CHAPTER_2_SOURCE;
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
