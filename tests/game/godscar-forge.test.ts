import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { KIND_GODS_OF_ILYON_BLUEPRINT } from "../../src/godscar/templates.js";
import {
  compileGodscarJson,
  godscarSkeletonJson,
  loadGodscarDraft,
  playtestGodscarArc,
  saveGodscarDraft,
} from "../../src/game/lib/godscar-forge.js";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("Godscar Pocket Forge", () => {
  it("starts from a complete compilable pocket rather than an empty document", () => {
    const result = compileGodscarJson(godscarSkeletonJson());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.pressures).toHaveLength(6);
    expect(result.summary.castCount).toBe(5);
    expect(result.summary.beatCount).toBe(6);
  });

  it("stores the creator source locally and reports write failure", () => {
    const storage = new MemoryStorage();
    expect(saveGodscarDraft("held by the creator", storage)).toEqual({ ok: true });
    expect(loadGodscarDraft(storage)).toBe("held by the creator");
    const denied = {
      getItem() { return null; },
      setItem() { throw new DOMException("denied", "SecurityError"); },
    } as unknown as Storage;
    expect(saveGodscarDraft("x", denied)).toMatchObject({ ok: false, reason: "denied" });
  });

  it("compiles Ilyon and runs a bounded exact-founding playtest", () => {
    const compiled = compileGodscarJson(JSON.stringify(KIND_GODS_OF_ILYON_BLUEPRINT));
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const report = playtestGodscarArc(compiled.arc, 3, 50);
    expect(report.clearRate).toBe(1);
    expect(report.totalGateViolations).toBe(0);
  });


  it("ships one canonical source through guided and exact-source authoring modes", () => {
    const screen = fs.readFileSync(new URL("../../src/game/components/GodscarForgeScreen.tsx", import.meta.url), "utf8");
    expect(screen).toContain('data-testid="godscar-guided-editor"');
    expect(screen).toContain('data-testid="godscar-forge-editor"');
    expect(screen).toContain("updateEditableGodscarSource");
    expect(screen).toContain("compileGodscarJson(text)");
    expect(screen).toContain("newGodscarCheck");
  });

  it("refuses malformed JSON and malformed story grammar before Arc compilation", () => {
    expect(compileGodscarJson("{")).toMatchObject({ ok: false });
    const invalid = { ...KIND_GODS_OF_ILYON_BLUEPRINT, pressures: [] };
    const result = compileGodscarJson(JSON.stringify(invalid));
    expect(result.ok).toBe(false);
  });
});
