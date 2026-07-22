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

  it("keeps malformed source in Source mode instead of inventing missing law", () => {
    expect(parseEditableGodscarSource("{")).toMatchObject({ ok: false });
    expect(parseEditableGodscarSource(JSON.stringify({ format: "godscar-pocket/1" }))).toMatchObject({ ok: false });
  });
});
