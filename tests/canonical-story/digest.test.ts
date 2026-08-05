import { describe, expect, it } from "vitest";
import { BURN_PROTOCOL_CHAPTER_1_SOURCE } from "../../src/burn-protocol/index.js";
import { canonicalStoryDigest } from "../../src/canonical-story/index.js";
import { orderRecordKeysDeep } from "../../src/engine/determinism.js";

describe("canonical story digest", () => {
  it("derives one lowercase SHA-256 from validated story law", () => {
    const story = BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory;
    expect(canonicalStoryDigest(story)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores object insertion order while retaining authored values", () => {
    const story = BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory;
    const reordered = orderRecordKeysDeep(structuredClone(story));
    expect(canonicalStoryDigest(reordered)).toBe(canonicalStoryDigest(story));

    const changed = structuredClone(story);
    changed.identity.title = `${changed.identity.title} changed`;
    expect(canonicalStoryDigest(changed)).not.toBe(canonicalStoryDigest(story));
  });

  it("refuses invalid canonical-story objects before deriving identity", () => {
    const invalid = structuredClone(
      BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory,
    ) as unknown as Record<string, unknown>;
    invalid.viewerState = { inferred: true };
    expect(() => canonicalStoryDigest(invalid)).toThrow(/Unrecognized key/);
  });
});
