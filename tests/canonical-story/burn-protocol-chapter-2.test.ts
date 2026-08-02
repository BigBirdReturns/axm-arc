import { describe, expect, it } from "vitest";
import {
  advanceCanonicalStory,
  CANONICAL_STORY_EXTENSION_KEY,
  canonicalStoryCoverage,
  canonicalStoryCursorForPanel,
  initialCanonicalStoryCursor,
  readCanonicalStoryExtension,
  retreatCanonicalStory,
} from "../../src/canonical-story/index.js";
import {
  BURN_PROTOCOL_CHAPTER_1_SOURCE,
  BURN_PROTOCOL_EXTENSION_KEY,
  BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE,
  compileBurnProtocol,
  readBurnProtocolExtension,
  validateBurnProtocol,
} from "../../src/burn-protocol/index.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";

describe("The Burn Protocol canonical Chapter 2 continuation", () => {
  it("adds Chapter 2 as ordinary pieces without mutating the accepted Chapter 1 source", () => {
    expect(BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory.episodes[0]!.chapters).toHaveLength(1);

    const validation = validateBurnProtocol(BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE);
    expect(validation.ok).toBe(true);
    const episode = BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE.canonicalStory.episodes[0]!;
    const [chapter1, chapter2] = episode.chapters;
    expect({
      identity: BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE.identity.id,
      episode: [episode.id, episode.complete, episode.nextChapterId],
      chapter1: [chapter1?.terminalPanelId, chapter1?.nextPanelId],
      chapter2: [
        chapter2?.id,
        chapter2?.title,
        chapter2?.openingPanelId,
        chapter2?.terminalPanelId,
        chapter2?.previousPanelId,
        chapter2?.nextPanelId,
      ],
      panels: chapter2?.panels.length,
      plates: chapter2?.plates.length,
    }).toEqual({
      identity: "burn-protocol",
      episode: ["E01", false, "E01-C3"],
      chapter1: ["E01-C1-P18", "E01-C2-P19"],
      chapter2: [
        "E01-C2",
        "The Black Box",
        "E01-C2-P19",
        "E01-C2-P38",
        "E01-C1-P18",
        "E01-C3-P39",
      ],
      panels: 20,
      plates: 4,
    });
    expect(chapter2!.panels.map((panel) => panel.id)).toEqual(
      Array.from({ length: 20 }, (_, index) =>
        `E01-C2-P${String(index + 19).padStart(2, "0")}`),
    );
    expect(chapter2!.panels.map((panel) => panel.ordinal)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it("reports only the genuinely unpublished continuation after internalizing P19", () => {
    const story = BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE.canonicalStory;
    expect(canonicalStoryCoverage(story)).toEqual({
      episodes: 1,
      chapters: 2,
      panels: 38,
      plates: 8,
      resolvedTextPanels: 0,
      unresolvedTextPanels: 38,
      resolvedPlateMappings: 0,
      unresolvedPlateMappings: 8,
      choiceNodes: 0,
      productionReady: false,
      incompleteEpisodeIds: ["E01"],
      continuationPanelIds: ["E01-C3-P39"],
    });

    const receipts = new Map(story.sourceReceipts.map((receipt) => [receipt.id, receipt]));
    expect(receipts.get("a01c2-lettering")).toMatchObject({
      path: "manifests/a01c2-lettering.json",
      bytes: 19056,
      sha256: "fe2d36e4d26dee3d0d3b5e1d7f1da2819064e84c8ce0136512ae6a9489ff7e17",
      available: false,
    });
    expect(receipts.get("a01c2-scroll-plates")).toMatchObject({
      path: "manifests/a01c2-scroll-plates.json",
      sha256: "f2ba06488c4db7d21bb2afae2a4a2cbf77ba214c77e56e8f1a698a655bec1855",
      available: false,
    });
  });

  it("compiles the combined source into one stable-series Arc and exactly recovers it", () => {
    const source = BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE;
    const arc = compileBurnProtocol(source);
    expect(arc.meta.id).toBe("burn-protocol");
    expect(arc.meta.domain).toBe("burn-protocol-canonical-story");
    expect(arc.challenges).toEqual([]);
    expect(arc.roles).toEqual([]);
    expect(arc.extensions?.[BURN_PROTOCOL_EXTENSION_KEY]).toEqual(source);
    expect(arc.extensions?.[CANONICAL_STORY_EXTENSION_KEY]).toEqual(source.canonicalStory);
    expect(readBurnProtocolExtension(arc)).toEqual(source);
    expect(readCanonicalStoryExtension(arc)).toEqual(source.canonicalStory);
    expect(cartridgeDigest(arc)).toMatch(/^cart1_[0-9a-f]{64}$/);
  });

  it("traverses P01 through P38, crossing P18 to P19 inside the same canonical run", () => {
    const story = BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE.canonicalStory;
    let { cursor } = initialCanonicalStoryCursor(story);
    const visited = [cursor.panelId];

    for (let ordinal = 2; ordinal <= 38; ordinal += 1) {
      const result = advanceCanonicalStory(story, cursor);
      expect(result.kind).toBe("panel");
      if (result.kind !== "panel") throw new Error(`Story ended before panel ${ordinal}.`);
      cursor = result.cursor;
      visited.push(cursor.panelId);
      if (ordinal === 19) {
        expect(result.receipt).toMatchObject({
          fromPanelId: "E01-C1-P18",
          toPanelId: "E01-C2-P19",
          chapterId: "E01-C2",
          canonical: true,
        });
      }
    }

    expect(visited).toHaveLength(38);
    expect(cursor.panelId).toBe("E01-C2-P38");
    expect(advanceCanonicalStory(story, cursor)).toEqual({
      kind: "extent-complete",
      cursor,
      continuationPanelId: "E01-C3-P39",
    });

    const chapter2Opening = canonicalStoryCursorForPanel(story, "E01-C2-P19");
    const prior = retreatCanonicalStory(story, chapter2Opening);
    expect(prior.kind).toBe("panel");
    if (prior.kind === "panel") {
      expect(prior.cursor.panelId).toBe("E01-C1-P18");
      expect(prior.receipt).toMatchObject({
        fromPanelId: "E01-C2-P19",
        toPanelId: "E01-C1-P18",
        chapterId: "E01-C1",
      });
    }
  });

  it("refuses a broken cross-chapter seam and any invented choice field", () => {
    const broken = structuredClone(BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE);
    broken.canonicalStory.episodes[0]!.chapters[0]!.nextPanelId = "E01-C2-P20";
    broken.canonicalStory.episodes[0]!.chapters[0]!.panels.at(-1)!.nextPanelId = "E01-C2-P20";
    const brokenValidation = validateBurnProtocol(broken);
    expect(brokenValidation.ok).toBe(false);
    if (!brokenValidation.ok) {
      expect(brokenValidation.errors.join("\n")).toMatch(/next chapter opening/i);
    }

    const invented = structuredClone(
      BURN_PROTOCOL_THROUGH_CHAPTER_2_SOURCE,
    ) as unknown as {
      canonicalStory: {
        episodes: Array<{
          chapters: Array<{
            panels: Array<Record<string, unknown>>;
          }>;
        }>;
      };
    };
    invented.canonicalStory.episodes[0]!.chapters[1]!.panels[0]!.choices = [
      { id: "invented-branch" },
    ];
    expect(validateBurnProtocol(invented).ok).toBe(false);
  });
});
