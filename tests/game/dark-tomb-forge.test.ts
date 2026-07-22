import { describe, expect, it } from "vitest";
import {
  clearDarkTombDraft,
  compileDarkTombJson,
  darkTombStarterJson,
  lampDistrictJson,
  loadDarkTombDraft,
  parseEditableDarkTombSource,
  playtestDarkTombArc,
  saveDarkTombDraft,
  updateEditableDarkTombSource,
} from "../../src/game/lib/dark-tomb-forge.js";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("Dark Tomb Forge", () => {
  it("starts from a complete private source and loads the canonical Lamp District", () => {
    const starter = parseEditableDarkTombSource(darkTombStarterJson());
    expect(starter.ok).toBe(true);
    if (starter.ok) expect(starter.source.identity.canonRelation).toBe("private-branch");

    const lamp = parseEditableDarkTombSource(lampDistrictJson());
    expect(lamp.ok).toBe(true);
    if (lamp.ok) {
      expect(lamp.source.identity.id).toBe("lamp-district");
      expect(lamp.source.delves).toHaveLength(8);
    }
  });

  it("edits the same validated source object used by exact-source mode", () => {
    const updated = updateEditableDarkTombSource(lampDistrictJson(), (source) => {
      source.identity.title = "Lamp District Revision";
      source.pressures[3].label = "Night school under pressure";
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    const reparsed = parseEditableDarkTombSource(updated.text);
    expect(reparsed.ok).toBe(true);
    if (reparsed.ok) {
      expect(reparsed.source.identity.title).toBe("Lamp District Revision");
      expect(reparsed.source.pressures[3].label).toBe("Night school under pressure");
    }
  });

  it("persists and clears exact creator source without changing it", () => {
    const storage = new MemoryStorage();
    const text = lampDistrictJson();
    expect(saveDarkTombDraft(text, storage)).toEqual({ ok: true });
    expect(loadDarkTombDraft(storage)).toBe(text);
    expect(clearDarkTombDraft(storage)).toEqual({ ok: true });
    expect(loadDarkTombDraft(storage)).toBeNull();
  });

  it("compiles through the registered source plane and preserves exact editable custody", () => {
    const compiled = compileDarkTombJson(lampDistrictJson());
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.arc.meta).toMatchObject({
      id: "lamp-district",
      domain: "godscar-dark-tomb",
      engineVersion: "1.3.0",
    });
    expect(compiled.arc.extensions?.["godscar.dark-tomb@1"]).toEqual(compiled.source);
  });

  it("refuses malformed or wrong-plane source instead of guessing", () => {
    expect(compileDarkTombJson("{")).toEqual(expect.objectContaining({ ok: false }));
    const wrong = JSON.stringify({ format: "future-pocket/9" });
    const result = compileDarkTombJson(wrong);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toContain("Unknown creator source-plane format");
  });

  it("runs a bounded deterministic campaign acceptance from the compiled Arc", () => {
    const compiled = compileDarkTombJson(lampDistrictJson());
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const result = playtestDarkTombArc(compiled.arc, [101, 211], 100);
    expect(result.cleared).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.gateViolations).toBe(0);
    expect(result.warnings).toEqual([]);
  });
});
