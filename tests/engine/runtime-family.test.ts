import { describe, expect, it } from "vitest";
import { ArcSchema, validateArc } from "../../src/engine/schema.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { buildPortableRun, parsePortableRun } from "../../src/engine/portable-run.js";
import { foundOrganization } from "../../src/engine/founding.js";
import { RUNTIME_FAMILIES, RUNTIME_FAMILY_EXTENSION_KEY as KEY, RUNTIME_FAMILY_FORMAT as FORMAT, readRuntimeFamilyContract, selectRuntimeFamily } from "../../src/engine/runtime-family.js";
import { compileBurnProtocol, BURN_PROTOCOL_CHAPTER_1_SOURCE } from "../../src/burn-protocol/index.js";
import { advanceCanonicalStory, initialCanonicalStoryCursor } from "../../src/canonical-story/index.js";
import { MINI_ARC } from "../fixtures/mini-arc.js";
import { DISPATCH_RUNTIME_ARC } from "../fixtures/runtime-family-arc.js";
import { strategyBoardProgramExtension } from "../fixtures/strategy-board-program.js";

const storyHost = compileBurnProtocol(BURN_PROTOCOL_CHAPTER_1_SOURCE);
const storyArc = validateArc({ ...storyHost, extensions: { ...storyHost.extensions, [KEY]: { format: FORMAT, family: "fixed-canonical-sequence" } } });

function familyExtensions(family: (typeof RUNTIME_FAMILIES)[number]) {
  return {
    [KEY]: { format: FORMAT, family },
    ...(family === "strategy-board" ? strategyBoardProgramExtension() : {}),
  };
}

describe("authored runtime-family contract", () => {
  it.each(RUNTIME_FAMILIES)("selects %s only with receiver capability", (family) => {
    const arc = validateArc({ ...DISPATCH_RUNTIME_ARC, extensions: familyExtensions(family) });
    const before = JSON.stringify(arc);
    expect(selectRuntimeFamily(arc, RUNTIME_FAMILIES)).toEqual({ kind: "selected", contract: { format: FORMAT, family } });
    expect(selectRuntimeFamily(arc, RUNTIME_FAMILIES.filter((candidate) => candidate !== family))).toEqual({ kind: "unsupported", reason: "family" });
    expect(JSON.stringify(arc)).toBe(before);
  });

  it.each([null, {}, { format: FORMAT }, { format: "axm-runtime-family/2", family: "encounter-simulation" }, { format: FORMAT, family: "unknown" }, { format: FORMAT, family: "strategy-board", screen: "board" }])("rejects malformed known declarations through both Arc gates: %j", (value) => {
    const input = { ...DISPATCH_RUNTIME_ARC, extensions: { [KEY]: value } };
    expect(() => validateArc(input)).toThrow(/extensions.axm.runtime-family@1/);
    expect(ArcSchema.safeParse(input).success).toBe(false);
  });

  it("preserves legacy identity without guessing from source, domain, or id", () => {
    for (const arc of [MINI_ARC, storyHost]) {
      const before = JSON.stringify(arc);
      const digest = cartridgeDigest(arc);
      expect(readRuntimeFamilyContract(arc)).toBeNull();
      expect(selectRuntimeFamily(arc, RUNTIME_FAMILIES)).toEqual({ kind: "legacy" });
      expect(validateArc(arc)).toEqual(arc);
      expect(cartridgeDigest(validateArc(arc))).toBe(digest);
      expect(JSON.stringify(arc)).toBe(before);
    }
  });

  it("keeps future contracts in custody and refuses fallback even alongside v1", () => {
    for (const extensions of [{ "axm.runtime-family@2": { opaque: true } }, { ...DISPATCH_RUNTIME_ARC.extensions, "axm.runtime-family@2": { opaque: true } }]) {
      const arc = validateArc({ ...DISPATCH_RUNTIME_ARC, extensions });
      expect(arc.extensions).toEqual(extensions);
      expect(selectRuntimeFamily(arc, RUNTIME_FAMILIES)).toEqual({ kind: "unsupported", reason: "contract-version" });
    }
  });

  it("binds selection to authored digest, independent of key insertion order", () => {
    const digests = RUNTIME_FAMILIES.map((family) => {
      const authority = family === "strategy-board" ? strategyBoardProgramExtension() : {};
      const arc = validateArc({ ...DISPATCH_RUNTIME_ARC, extensions: { [KEY]: { format: FORMAT, family }, ...authority } });
      const reordered = validateArc({ ...arc, extensions: { ...authority, [KEY]: { family, format: FORMAT } } });
      expect(cartridgeDigest(reordered)).toBe(cartridgeDigest(arc));
      return cartridgeDigest(arc);
    });
    expect(new Set(digests).size).toBe(RUNTIME_FAMILIES.length);
    expect(cartridgeDigest(storyArc)).not.toBe(cartridgeDigest(storyHost));
    expect(storyArc.meta).toEqual(storyHost.meta);
  });

  it("leaves fixed sequence transitions and extent termination with canonical law", () => {
    expect(selectRuntimeFamily(storyArc, ["fixed-canonical-sequence"]).kind).toBe("selected");
    const story = BURN_PROTOCOL_CHAPTER_1_SOURCE.canonicalStory;
    let { cursor } = initialCanonicalStoryCursor(story);
    const count = story.episodes.flatMap((episode) => episode.chapters.flatMap((chapter) => chapter.panels)).length;
    for (let index = 1; index < count; index++) {
      const next = advanceCanonicalStory(story, cursor);
      expect(next.kind).toBe("panel");
      cursor = next.cursor;
    }
    expect(advanceCanonicalStory(story, cursor).kind).toBe("extent-complete");
    expect(storyArc.extensions).toMatchObject(storyHost.extensions!);
  });

  it("round-trips an unrelated simulation and opaque run memory without selecting from memory", () => {
    const arc = DISPATCH_RUNTIME_ARC;
    const org = foundOrganization(arc, { format: "axm-founding-input/1", seed: 17 });
    const run = buildPortableRun({ arc, org, extensions: { "other-player.runtime@9": { family: "strategy-board", opaque: [null, true, 3] } } });
    const restored = parsePortableRun(JSON.stringify(run));
    expect(restored.run).toEqual(run);
    expect(restored.run.arc.extensions).toEqual(arc.extensions);
    expect(selectRuntimeFamily(restored.run.arc, ["encounter-simulation"])).toEqual({ kind: "selected", contract: readRuntimeFamilyContract(arc) });
  });
});
