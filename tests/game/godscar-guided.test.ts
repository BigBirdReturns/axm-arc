import { describe, expect, it } from "vitest";
import { newGodscarPocketSkeleton } from "../../src/godscar/templates.js";
import {
  newBeat,
  newCastMember,
  newConsequence,
  newEvidenceReceipt,
  newFactionReceipt,
  newGodscarCheck,
  parseEditableGodscarSource,
  serializeEditableGodscarSource,
  uniqueGodscarId,
  updateEditableGodscarSource,
} from "../../src/game/lib/godscar-guided.js";

describe("guided Godscar source editing", () => {
  it("round-trips the complete source without changing the canonical format", () => {
    const source = newGodscarPocketSkeleton();
    const text = serializeEditableGodscarSource(source);
    const parsed = parseEditableGodscarSource(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.source).toEqual(source);
  });

  it("edits one source object and preserves all untouched sections", () => {
    const source = newGodscarPocketSkeleton();
    const result = updateEditableGodscarSource(JSON.stringify(source), (draft) => {
      draft.controlQuestion = "Who may close the route?";
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source.controlQuestion).toBe("Who may close the route?");
    expect(result.source.pressures).toEqual(source.pressures);
  });

  it("creates unique, typed entries for every expandable guided section", () => {
    const source = newGodscarPocketSkeleton();
    expect(uniqueGodscarId("new receipt", ["new-receipt"])).toBe("new-receipt-2");
    expect(newEvidenceReceipt(source).id).not.toBe("");
    expect(newFactionReceipt(source).factionId).not.toBe("");
    expect(newCastMember(source).roleId).toBe("auditor");
    expect(newConsequence(source).kind).toBe("doctrine");
    const beat = newBeat(source);
    expect(beat.checks).toHaveLength(1);
    expect(newGodscarCheck(beat).scope).toBe("team");
  });

  it("keeps semantically unfinished but structurally renderable drafts in Guided mode", () => {
    const draft = structuredClone(newGodscarPocketSkeleton()) as unknown as Record<string, any>;
    draft.identity.canonRelation = "author-is-still-deciding";
    draft.pressures = [];
    draft.beats[0].difficulty = -40;
    const parsed = parseEditableGodscarSource(JSON.stringify(draft));
    expect(parsed.ok).toBe(true);
  });

  it.each([
    ["nested evidence receipt", (draft: any) => { draft.evidence.receipts = [null]; }, "evidence.receipts[0]"],
    ["beat checks collection", (draft: any) => { draft.beats[0].checks = "not-an-array"; }, "beats[0].checks"],
    ["check weights object", (draft: any) => { draft.beats[0].checks[0].weights = null; }, "beats[0].checks[0].weights"],
    ["cast scalar", (draft: any) => { draft.cast[0].name = 42; }, "cast[0].name"],
    ["Story Physics boolean", (draft: any) => { draft.storyPhysics.noCleanReset = "yes"; }, "storyPhysics.noCleanReset"],
  ])("refuses malformed %s before Guided rendering", (_label, mutate, path) => {
    const draft = structuredClone(newGodscarPocketSkeleton()) as unknown as Record<string, any>;
    mutate(draft);
    expect(() => parseEditableGodscarSource(JSON.stringify(draft))).not.toThrow();
    const parsed = parseEditableGodscarSource(JSON.stringify(draft));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toContain(path);
  });

  it("keeps malformed source in Source mode instead of inventing missing law", () => {
    expect(parseEditableGodscarSource("{")).toMatchObject({ ok: false });
    expect(parseEditableGodscarSource(JSON.stringify({ format: "godscar-pocket/1" }))).toMatchObject({ ok: false });
  });
});
