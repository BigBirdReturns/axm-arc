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
  BURN_PROTOCOL_EPISODE_3_CHAPTER_3,
  BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol canonical Episode 3", () => {
  it("completes The Omega Thread as ordinary fixed story pieces", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE;
    expect(validateBurnProtocol(source).ok).toBe(true);
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
    ]);
    expect(BURN_PROTOCOL_EPISODE_3_CHAPTER_3).toMatchObject({
      id: "E03-C3",
      title: "Prime Incident",
      openingPanelId: "E03-C3-P41",
      terminalPanelId: "E03-C3-P60",
      previousPanelId: "E03-C2-P40",
      nextPanelId: "E04-C1-P01",
    });
    expect(BURN_PROTOCOL_EPISODE_3_CHAPTER_3.panels).toHaveLength(20);
    expect(BURN_PROTOCOL_EPISODE_3_CHAPTER_3.plates).toHaveLength(4);
  });

  it("crosses every Episode 3 seam in both directions", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE.canonicalStory;
    for (const [fromPanelId, toPanelId] of [
      ["E02-C3-P60", "E03-C1-P01"],
      ["E03-C1-P20", "E03-C2-P21"],
      ["E03-C2-P40", "E03-C3-P41"],
    ] as const) {
      const start = canonicalStoryCursorForPanel(story, fromPanelId);
      const forward = advanceCanonicalStory(story, start);
      expect(forward.kind).toBe("panel");
      if (forward.kind !== "panel") throw new Error(`Expected ${toPanelId}.`);
      expect(forward.cursor.panelId).toBe(toPanelId);
      const reverse = retreatCanonicalStory(story, forward.cursor);
      expect(reverse.kind).toBe("panel");
      if (reverse.kind === "panel") expect(reverse.cursor.panelId).toBe(fromPanelId);
    }
  });

  it("traverses 180 fixed panels and stops only at Episode 4", () => {
    const story = BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE.canonicalStory;
    expect(canonicalStoryCoverage(story)).toMatchObject({
      episodes: 3,
      chapters: 9,
      panels: 180,
      plates: 36,
      unresolvedTextPanels: 180,
      unresolvedPlateMappings: 36,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: [],
      continuationPanelIds: ["E04-C1-P01"],
    });

    let cursor = initialCanonicalStoryCursor(story).cursor;
    const visited = [cursor.panelId];
    while (true) {
      const result = advanceCanonicalStory(story, cursor);
      if (result.kind === "extent-complete") {
        expect(result.continuationPanelId).toBe("E04-C1-P01");
        break;
      }
      cursor = result.cursor;
      visited.push(cursor.panelId);
    }
    expect(visited).toHaveLength(180);
    expect(visited[159]).toBe("E03-C2-P40");
    expect(visited[160]).toBe("E03-C3-P41");
    expect(visited.at(-1)).toBe("E03-C3-P60");
    expect(new Set(visited).size).toBe(180);
  });

  it("retains the single source-required asset and compiles no simulation law", () => {
    const source = BURN_PROTOCOL_THROUGH_EPISODE_3_SOURCE;
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
