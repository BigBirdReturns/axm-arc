import { describe, expect, it } from "vitest";
import type { CanonicalStorySource } from "../../src/canonical-story/types.js";
import {
  CANONICAL_STORY_TIMED_MEDIA_FORMAT,
  parseCanonicalStoryTimedMedia,
  validateCanonicalStoryTimedMedia,
} from "../../src/canonical-story/timed-media.js";

const DIGEST = "a".repeat(64);
const RECEIPT = "b".repeat(64);
const story = {
  identity: { id: "story:fixture" },
  episodes: [{ id: "episode:1", chapters: [{ id: "chapter:1", panels: [{ id: "panel:1" }, { id: "panel:2" }] }] }],
} as unknown as CanonicalStorySource;

function fixture(): unknown {
  return {
    format: CANONICAL_STORY_TIMED_MEDIA_FORMAT,
    storyId: "story:fixture",
    storyDigest: DIGEST,
    timeUnit: "microseconds",
    authority: { narrative: "arc", providerClock: "none", viewerState: "none", playbackControl: "none" },
    sourceReceipts: [{ id: "receipt:1", sha256: RECEIPT, locator: "fixture:1", standing: "reviewed-primary" }],
    positions: [
      { id: "position:1", episodeId: "episode:1", chapterId: "chapter:1", panelIds: ["panel:1"], canonicalStartUs: 0, canonicalEndUs: 5_000_000, label: "Entry", sourceReceiptIds: ["receipt:1"] },
      { id: "position:2", episodeId: "episode:1", chapterId: "chapter:1", panelIds: ["panel:2"], canonicalStartUs: 5_000_000, canonicalEndUs: 9_000_000, label: "Consequence", sourceReceiptIds: ["receipt:1"] },
    ],
    facts: [
      { id: "fact:entry", proposition: "The courier enters.", subjectIds: ["character:courier"], sourceReceiptIds: ["receipt:1"] },
      { id: "fact:consequence", proposition: "The map changes hands.", subjectIds: ["character:courier"], sourceReceiptIds: ["receipt:1"] },
    ],
    causalEdges: [{ id: "edge:1", fromFactId: "fact:entry", toFactId: "fact:consequence", relation: "necessary-cause", sourceReceiptIds: ["receipt:1"] }],
    reveals: [{ id: "reveal:1", factId: "fact:consequence", positionId: "position:2", mode: "seen", sourceReceiptIds: ["receipt:1"] }],
  };
}

describe("canonical story timed media", () => {
  it("accepts reviewed positions, facts, causes and reveals bound to the exact story", () => {
    const value = parseCanonicalStoryTimedMedia(fixture(), story, DIGEST);
    expect(value.positions).toHaveLength(2);
    expect(value.authority.providerClock).toBe("none");
  });

  it("refuses story-digest substitution", () => {
    const result = validateCanonicalStoryTimedMedia(fixture(), story, "c".repeat(64));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toContain("different canonical story digest");
  });

  it("refuses overlap, foreign panels, unknown facts and playback authority", () => {
    const value = fixture() as any;
    value.positions[1].canonicalStartUs = 4_000_000;
    value.positions[1].panelIds = ["panel:foreign"];
    value.causalEdges[0].toFactId = "fact:foreign";
    value.authority.playbackControl = "arc";
    const result = validateCanonicalStoryTimedMedia(value, story, DIGEST);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const errors = result.errors.join("\n");
      expect(errors).toContain("Expected \"none\"");
      expect(errors).toContain("overlap");
      expect(errors).toContain("Panel does not belong");
      expect(errors).toContain("Unknown fact reference");
    }
  });
});
