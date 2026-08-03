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
  BURN_PROTOCOL_EPISODE_5_CHAPTER_1,
  BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE,
  BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_1_SOURCE,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol Episode 5 Chapter 1", () => {
  it("appends Nursery World / The Song as one ordinary episode opening", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_1_SOURCE;
    expect(validateBurnProtocol(source).ok).toBe(true);
    expect(source.identity).toMatchObject({ id: "burn-protocol", version: "0.11.0" });
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
      ["E05", 5, "Nursery World", false, "E05-C2", 1],
    ]);
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_1).toMatchObject({
      id: "E05-C1",
      number: 1,
      title: "The Song",
      openingPanelId: "E05-C1-P01",
      terminalPanelId: "E05-C1-P20",
      previousPanelId: "E04-C3-P60",
      nextPanelId: "E05-C2-P21",
    });
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_1.panels).toHaveLength(20);
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_1.plates).toHaveLength(4);
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_1.panels.map((panel) => panel.id)).toEqual(
      Array.from({ length: 20 }, (_, index) =>
        `E05-C1-P${String(index + 1).padStart(2, "0")}`),
    );
  });

  it("crosses the Episode 4 to Episode 5 seam in both directions", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_1_SOURCE.canonicalStory;
    const terminal = canonicalStoryCursorForPanel(story, "E04-C3-P60");
    const forward = advanceCanonicalStory(story, terminal);
    expect(forward.kind).toBe("panel");
    if (forward.kind !== "panel") throw new Error("Expected E05-C1-P01.");
    expect(forward.cursor).toEqual({
      storyId: "burn-protocol",
      episodeId: "E05",
      chapterId: "E05-C1",
      panelId: "E05-C1-P01",
    });
    expect(forward.receipt).toMatchObject({
      fromPanelId: "E04-C3-P60",
      toPanelId: "E05-C1-P01",
      episodeId: "E05",
      chapterId: "E05-C1",
      canonical: true,
    });

    const reverse = retreatCanonicalStory(story, forward.cursor);
    expect(reverse.kind).toBe("panel");
    if (reverse.kind === "panel") {
      expect(reverse.cursor).toMatchObject({
        episodeId: "E04",
        chapterId: "E04-C3",
        panelId: "E04-C3-P60",
      });
    }
  });

  it("traverses 260 fixed panels and stops only at Episode 5 Chapter 2", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_1_SOURCE.canonicalStory;
    expect(canonicalStoryCoverage(story)).toMatchObject({
      episodes: 5,
      chapters: 13,
      panels: 260,
      plates: 52,
      unresolvedTextPanels: 260,
      unresolvedPlateMappings: 52,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: ["E05"],
      continuationPanelIds: ["E05-C2-P21"],
    });

    let cursor = initialCanonicalStoryCursor(story).cursor;
    const visited = [cursor.panelId];
    while (true) {
      const result = advanceCanonicalStory(story, cursor);
      if (result.kind === "extent-complete") {
        expect(result.continuationPanelId).toBe("E05-C2-P21");
        expect(result.cursor.panelId).toBe("E05-C1-P20");
        break;
      }
      cursor = result.cursor;
      visited.push(cursor.panelId);
    }
    expect(visited).toHaveLength(260);
    expect(visited[239]).toBe("E04-C3-P60");
    expect(visited[240]).toBe("E05-C1-P01");
    expect(visited.at(-1)).toBe("E05-C1-P20");
    expect(new Set(visited).size).toBe(260);
  });

  it("binds the exact A05C1 source and media ledger without promoting expression", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_1_SOURCE;
    const prior = BURN_PROTOCOL_THROUGH_EPISODE_4_SOURCE;
    expect(source.canonicalStory.sourceReceipts.slice(0, prior.canonicalStory.sourceReceipts.length))
      .toEqual(prior.canonicalStory.sourceReceipts);
    const receipts = new Map(source.canonicalStory.sourceReceipts.map((receipt) => [
      receipt.id,
      receipt,
    ]));
    expect(receipts.get("q01-dialogue-parity")).toMatchObject({
      path: "manifests/q01-dialogue-parity.json",
      bytes: 763244,
      sha256: "212493c941469d673f410d2e5771c91a5db1a59f8fc483238246cfd5d2084b7e",
      available: false,
    });
    expect(receipts.get("q01-causal-ledger")).toMatchObject({
      path: "manifests/q01-causal-ledger.json",
      bytes: 1493256,
      sha256: "fd9ec4a4bc4b42e2a97351d34eff07e462f14aabff9db5a88cf5886cd747a9cc",
      available: false,
    });
    expect(receipts.get("episode-05-source")).toMatchObject({
      path: "source/episodes/episode-05.json",
      bytes: 102175,
      sha256: "b0c738dfe510dc04437f9b0edfddcb9a5faa254d13109875470d02f0c1591fd7",
      available: false,
    });
    expect(receipts.get("episode-05-compiled")).toMatchObject({
      path: "site/data/episode-05.json",
      bytes: 155844,
      sha256: "d9dac19f58a7cedeacdb3af2cf52c95be327cd4eddfc578a8459bffef3e2ebc1",
      available: false,
    });
    expect(receipts.get("a05c1-chapter-source")).toMatchObject({
      path: "source/art/A05C1/chapter.json",
      bytes: 2001,
      sha256: "b9d6c568eacfd754d0f1d3a0635b3212bb2f352bd72a9076f535602343429e14",
      available: false,
    });
    expect(receipts.get("a05c1-lettering-source")).toMatchObject({
      path: "source/art/A05C1/lettering.json",
      bytes: 23862,
      sha256: "ad0ad5f24c5e594f4c6875acafda820838775849c9e664be1c5cbfee2755f7c7",
      available: false,
    });
    expect(receipts.get("a05c1-scroll-plates")).toMatchObject({
      path: "manifests/a05c1-scroll-plates.json",
      bytes: 1521,
      sha256: "6a399d9ffb32176f95aec7dde5e68cb7922747d5b45906d1bd816e1d679077b0",
      available: false,
    });
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_1.panels[0]?.asset).toMatchObject({
      path: "site/assets/art/A05C1/panels/E05-C1-P01.webp",
      bytes: 93284,
      sha256: "7c57604a1c63d035277169f0d2aaf4b5756fc222f8eff7443942e4cc6f546780",
    });
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_1.panels.at(-1)?.asset).toMatchObject({
      path: "site/assets/art/A05C1/panels/E05-C1-P20.webp",
      bytes: 61772,
      sha256: "1da033099e27be1ba9ccc169b0e753d6df0a79837bb83efaa87489249cca9ffd",
    });
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_1.plates[0]?.asset).toMatchObject({
      path: "site/assets/art/A05C1/plates/A05C1-plate-01.webp",
      bytes: 363048,
      sha256: "39ae7ea3783af3d28750ddafbae8acc6de53bd6c189a25f4e98a69ec8e061f33",
    });
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_1.plates.at(-1)?.asset).toMatchObject({
      path: "site/assets/art/A05C1/plates/A05C1-plate-04.webp",
      bytes: 278884,
      sha256: "241c9c4165e8778c813bea98011f564f8ee038ce2b4680bf5e170057df0ec822",
    });
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_1.panels.every(
      (panel) => panel.text.status === "source-required",
    )).toBe(true);
    expect(BURN_PROTOCOL_EPISODE_5_CHAPTER_1.plates.every(
      (plate) => plate.panelMapping.status === "source-required",
    )).toBe(true);
  });

  it("extends ordered source custody and retains the inherited asset gap", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_5_CHAPTER_1_SOURCE;
    expect(source.estate.canonicalSourceReceiptIds).toEqual([
      "episode-01-source",
      "episode-02-source",
      "episode-03-source",
      "episode-04-source",
      "episode-05-source",
    ]);
    expect(source.estate.compiledSourceReceiptIds).toEqual([
      "episode-01-compiled",
      "episode-02-compiled",
      "episode-04-compiled",
      "episode-05-compiled",
    ]);

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
