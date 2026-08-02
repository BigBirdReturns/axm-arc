import { describe, expect, it } from "vitest";
import {
  advanceCanonicalStory,
  CANONICAL_STORY_EXTENSION_KEY,
  canonicalStoryCoverage,
  initialCanonicalStoryCursor,
  parseCanonicalStory,
  readCanonicalStoryExtension,
  retreatCanonicalStory,
} from "../../src/canonical-story/index.js";
import {
  BURN_PROTOCOL_CHAPTER_1_SOURCE,
  BURN_PROTOCOL_EXTENSION_KEY,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol canonical Chapter 1 source plane", () => {
  it("represents the whole Chapter 1 extent as ordinary ordered panel pieces", () => {
    const validation = validateBurnProtocol(BURN_PROTOCOL_CHAPTER_1_SOURCE);
    expect(validation.ok).toBe(true);

    const episode = BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory.episodes[0]!;
    const chapter = episode.chapters[0]!;
    expect({
      episode: [episode.id, episode.title, episode.complete, episode.nextChapterId],
      chapter: [
        chapter.id,
        chapter.title,
        chapter.complete,
        chapter.openingPanelId,
        chapter.terminalPanelId,
        chapter.nextPanelId,
      ],
      panels: chapter.panels.length,
      plates: chapter.plates.length,
    }).toEqual({
      episode: ["E01", "The Broken Road", false, "E01-C2"],
      chapter: [
        "E01-C1",
        "Impact",
        true,
        "E01-C1-P01",
        "E01-C1-P18",
        "E01-C2-P19",
      ],
      panels: 18,
      plates: 4,
    });
    expect(chapter.panels.map((panel) => panel.id)).toEqual(
      Array.from({ length: 18 }, (_, index) =>
        `E01-C1-P${String(index + 1).padStart(2, "0")}`),
    );
    expect(chapter.panels[0]!.previousPanelId).toBeNull();
    expect(chapter.panels.at(-1)!.nextPanelId).toBe("E01-C2-P19");
  });

  it("preserves exact source and asset custody without pretending missing text is present", () => {
    const story = BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory;
    const coverage = canonicalStoryCoverage(story);
    expect(coverage).toEqual({
      episodes: 1,
      chapters: 1,
      panels: 18,
      plates: 4,
      resolvedTextPanels: 0,
      unresolvedTextPanels: 18,
      resolvedPlateMappings: 0,
      unresolvedPlateMappings: 4,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: ["E01"],
      continuationPanelIds: ["E01-C2-P19"],
    });

    const receipts = new Map(story.sourceReceipts.map((receipt) => [receipt.id, receipt]));
    expect(receipts.get("episode-01-source")).toMatchObject({
      path: "source/episodes/episode-01.json",
      bytes: 68729,
      sha256: "de87f7cb5ed8f4fa5b5ebe6f8e7d63d1872740e0c29365108fc2aba0b1d0a35f",
      available: false,
    });
    expect(receipts.get("a01c1-lettering")).toMatchObject({
      path: "manifests/a01c1-lettering.json",
      sha256: "77a016ffa3193a0e0806df44f77bbfb99f50ea0951a55ced4f5713b5ccd1d564",
      available: false,
    });

    const chapter = story.episodes[0]!.chapters[0]!;
    expect(chapter.panels.every((panel) => panel.text.status === "source-required")).toBe(true);
    expect(chapter.panels.every((panel) =>
      panel.asset.path.endsWith(`/panels/${panel.id}.webp`)
      && panel.asset.availability === "manifested-external"
      && panel.asset.visualStanding === "q02-review-required")).toBe(true);
  });

  it("compiles into one content-addressed Arc with exact Burn and canonical-story recovery", () => {
    const arc = compileBurnProtocol(BURN_PROTOCOL_CHAPTER_1_SOURCE);
    expect(arc.meta.domain).toBe("burn-protocol-canonical-story");
    expect(arc.challenges).toEqual([]);
    expect(arc.roles).toEqual([]);
    expect(arc.extensions?.[BURN_PROTOCOL_EXTENSION_KEY]).toEqual(
      BURN_PROTOCOL_CHAPTER_1_SOURCE,
    );
    expect(arc.extensions?.[CANONICAL_STORY_EXTENSION_KEY]).toEqual(
      BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory,
    );
    expect(readBurnProtocolExtension(arc)).toEqual(BURN_PROTOCOL_CHAPTER_1_SOURCE);
    expect(readCanonicalStoryExtension(arc)).toEqual(
      BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory,
    );
    expect(cartridgeDigest(arc)).toMatch(/^cart1_[0-9a-f]{64}$/);
  });

  it("executes the fixed canonical path from P01 through P18 and stops at P19", () => {
    const story = BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory;
    const opened = initialCanonicalStoryCursor(story);
    expect(opened.cursor.panelId).toBe("E01-C1-P01");
    expect(opened.receipt.action).toBe("open");
    expect(opened.receipt.digest).toMatch(/^story1_[0-9a-f]{64}$/);

    let cursor = opened.cursor;
    const visited = [cursor.panelId];
    for (let expected = 2; expected <= 18; expected += 1) {
      const result = advanceCanonicalStory(story, cursor);
      expect(result.kind).toBe("panel");
      if (result.kind !== "panel") throw new Error("Chapter ended before P18.");
      cursor = result.cursor;
      visited.push(cursor.panelId);
      expect(cursor.panelId).toBe(`E01-C1-P${String(expected).padStart(2, "0")}`);
      expect(result.receipt.canonical).toBe(true);
    }
    const end = advanceCanonicalStory(story, cursor);
    expect(end).toEqual({
      kind: "extent-complete",
      cursor,
      continuationPanelId: "E01-C2-P19",
    });
    expect(visited).toHaveLength(18);

    const prior = retreatCanonicalStory(story, cursor);
    expect(prior.kind).toBe("panel");
    if (prior.kind === "panel") expect(prior.cursor.panelId).toBe("E01-C1-P17");
  });

  it("refuses a broken panel link and any invented choice field", () => {
    const broken = structuredClone(BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory);
    broken.episodes[0]!.chapters[0]!.panels[5]!.nextPanelId = "E01-C1-P18";
    expect(() => parseCanonicalStory(broken)).toThrow(/nextPanelId/);

    const invented = structuredClone(BURN_PROTOCOL_CHAPTER_1_SOURCE) as unknown as {
      canonicalStory: {
        episodes: Array<{
          chapters: Array<{
            panels: Array<Record<string, unknown>>;
          }>;
        }>;
      };
    };
    invented.canonicalStory.episodes[0]!.chapters[0]!.panels[0]!.choices = [
      { id: "invented-branch" },
    ];
    expect(validateBurnProtocol(invented).ok).toBe(false);
  });
});
