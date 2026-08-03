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
  BURN_PROTOCOL_EPISODE_5_CHAPTER_2,
  BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_2_SOURCE,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol Episode 5 Chapter 2", () => {
  it("appends The Mother as one ordinary chapter", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_2_SOURCE;
    expect(validateBurnProtocol(source).ok).toBe(true);
    expect(source.identity).toMatchObject({ id: "burn-protocol", version: "0.12.0" });
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
      ["E05", 5, "Nursery World", false, "E05-C3", 2],
    ]);
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_2).toMatchObject({
      id: "E05-C2",
      number: 2,
      title: "The Mother",
      openingPanelId: "E05-C2-P21",
      terminalPanelId: "E05-C2-P40",
      previousPanelId: "E05-C1-P20",
      nextPanelId: "E05-C3-P41",
    });
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_2.panels).toHaveLength(20);
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_2.plates).toHaveLength(4);
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_2.panels.map((panel) => panel.id)).toEqual(
      Array.from({ length: 20 }, (_, index) =>
        `E05-C2-P${String(index + 21).padStart(2, "0")}`),
    );
  });

  it("crosses the Episode 5 chapter seam in both directions", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_2_SOURCE.canonicalStory;
    const terminal = canonicalStoryCursorForPanel(story, "E05-C1-P20");
    const forward = advanceCanonicalStory(story, terminal);
    expect(forward.kind).toBe("panel");
    if (forward.kind !== "panel") throw new Error("Expected E05-C2-P21.");
    expect(forward.cursor).toEqual({
      storyId: "burn-protocol",
      episodeId: "E05",
      chapterId: "E05-C2",
      panelId: "E05-C2-P21",
    });
    expect(forward.receipt).toMatchObject({
      fromPanelId: "E05-C1-P20",
      toPanelId: "E05-C2-P21",
      episodeId: "E05",
      chapterId: "E05-C2",
      canonical: true,
    });

    const reverse = retreatCanonicalStory(story, forward.cursor);
    expect(reverse.kind).toBe("panel");
    if (reverse.kind === "panel") {
      expect(reverse.cursor).toMatchObject({
        episodeId: "E05",
        chapterId: "E05-C1",
        panelId: "E05-C1-P20",
      });
    }
  });

  it("traverses 280 fixed panels and stops only at Episode 5 Chapter 3", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_2_SOURCE.canonicalStory;
    expect(canonicalStoryCoverage(story)).toMatchObject({
      episodes: 5,
      chapters: 14,
      panels: 280,
      plates: 56,
      unresolvedTextPanels: 280,
      unresolvedPlateMappings: 56,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: ["E05"],
      continuationPanelIds: ["E05-C3-P41"],
    });

    let cursor = initialCanonicalStoryCursor(story).cursor;
    const visited = [cursor.panelId];
    while (true) {
      const result = advanceCanonicalStory(story, cursor);
      if (result.kind === "extent-complete") {
        expect(result.continuationPanelId).toBe("E05-C3-P41");
        break;
      }
      cursor = result.cursor;
      visited.push(cursor.panelId);
    }
    expect(visited).toHaveLength(280);
    expect(visited[259]).toBe("E05-C1-P20");
    expect(visited[260]).toBe("E05-C2-P21");
    expect(visited.at(-1)).toBe("E05-C2-P40");
    expect(new Set(visited).size).toBe(280);
  });

  it("binds the exact A05C2 source and media ledger without promoting expression", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_2_SOURCE;
    const receipts = new Map(source.canonicalStory.sourceReceipts.map((receipt) => [
      receipt.id,
      receipt,
    ]));
    expect(receipts.get("a05c2-chapter-source")).toMatchObject({
      path: "source/art/A05C2/chapter.json",
      bytes: 2003,
      sha256: "3c7c5919cdae2c100398c97f28e8e63045abec644d48245664c7ca2611b4025f",
      available: false,
    });
    expect(receipts.get("a05c2-lettering-source")).toMatchObject({
      path: "source/art/A05C2/lettering.json",
      bytes: 24420,
      sha256: "a91d050640b4a2cb105693b575e93b36fe17047772c566b239d906dd28a161b7",
      available: false,
    });
    expect(receipts.get("a05c2-panel-art-source")).toMatchObject({
      path: "source/art/A05C2/panel-art.json",
      bytes: 18482,
      sha256: "54262a4c55f17d67fc0db0f783f77c2c39775c2a2b1003ba0465717606ec777a",
      available: false,
    });
    expect(receipts.get("a05c2-provenance")).toMatchObject({
      path: "source/art/A05C2/provenance.json",
      bytes: 10094,
      sha256: "7dc1dbd08225e1cbdf331b649b9bcca6537e4b9a09453624c86de1bc2bd37631",
      available: false,
    });
    expect(receipts.get("a05c2-recovery")).toMatchObject({
      path: "manifests/a05c2-recovery.json",
      bytes: 5921,
      sha256: "8fd084f4f34495741e1373e74b1232e0ded6fcd445309e7b0fad02bda0a44743",
      available: false,
    });
    expect(receipts.get("a05c2-scroll-plates")).toMatchObject({
      path: "manifests/a05c2-scroll-plates.json",
      bytes: 1521,
      sha256: "027726e318eac73e97071a9964ec688979cdf53496171171d96c597f01861a2c",
      available: false,
    });
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_2.panels[0]?.asset).toMatchObject({
      path: "site/assets/art/A05C2/panels/E05-C2-P21.webp",
      bytes: 62096,
      sha256: "5c5c1d8024d8c9227b00c76b94d783941b800717d97f67846ac784fcdc1bd5b1",
    });
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_2.panels.at(-1)?.asset).toMatchObject({
      path: "site/assets/art/A05C2/panels/E05-C2-P40.webp",
      bytes: 74456,
      sha256: "a7a3320d2f5973715c7f5a61fa782f0abe5870213a72050491a96bdfeda3a27e",
    });
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_2.plates[0]?.asset).toMatchObject({
      path: "site/assets/art/A05C2/plates/A05C2-plate-01.webp",
      bytes: 349896,
      sha256: "3a438b907da64a5267504eb3f0a193bf56d7107f118443c4f097762cddd82876",
    });
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_2.plates.at(-1)?.asset).toMatchObject({
      path: "site/assets/art/A05C2/plates/A05C2-plate-04.webp",
      bytes: 304132,
      sha256: "c46f6978c15f268b2c1aa812e47a61393a7b56ae71b0b88a287d8d830361887c",
    });
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_2.panels.every(
      (panel) => panel.text.status === "source-required",
    )).toBe(true);
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_2.plates.every(
      (plate) => plate.panelMapping.status === "source-required",
    )).toBe(true);
  });

  it("retains the inherited asset gap and compiles no simulation law", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_2_SOURCE;
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
