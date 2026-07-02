import { describe, it, expect, beforeEach } from "vitest";
import {
  emptyDraft,
  loadRosterDraft,
  saveRosterDraft,
  clearRosterDraft,
  type RosterDraft,
} from "../../src/game/lib/designer-storage.js";

// designer-storage.ts reads/writes the ambient `localStorage` global directly
// (same pattern as src/game/lib/storage.ts and arc-library.ts). Vitest's
// node environment doesn't provide one, so this file installs a minimal
// in-memory shim for its own use. The "unavailable" test below relies on the
// module's own try/catch (already exercised implicitly whenever this global
// is absent) rather than adding new fallback logic.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? (this.store.get(key) as string) : null; }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, value); }
}

const STORAGE_KEY = "axm-arc:roster-draft:v1";

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
});

describe("designer-storage round-trip", () => {
  it("returns an empty draft when nothing is stored yet", () => {
    expect(loadRosterDraft("arc-a")).toEqual(emptyDraft("arc-a"));
  });

  it("round-trips a saved draft for the same arc", () => {
    const draft: RosterDraft = {
      version: 1,
      arcId: "arc-a",
      agents: [],
      selectedId: null,
      section: "items",
    };
    saveRosterDraft(draft);
    expect(loadRosterDraft("arc-a")).toEqual(draft);
  });

  it("round-trips agents and selectedId untouched", () => {
    const agent = { id: "agent-1", name: "Test Agent" };
    const draft: RosterDraft = {
      version: 1,
      arcId: "arc-a",
      // Storage is a plain JSON round-trip; a minimal shape is enough to
      // prove agents/selectedId survive intact.
      agents: [agent as unknown as RosterDraft["agents"][number]],
      selectedId: "agent-1",
      section: "roster",
    };
    saveRosterDraft(draft);
    const loaded = loadRosterDraft("arc-a");
    expect(loaded.agents).toEqual([agent]);
    expect(loaded.selectedId).toBe("agent-1");
  });

  it("resets to empty when the stored draft's arcId doesn't match the requested arc", () => {
    const draft: RosterDraft = { version: 1, arcId: "arc-a", agents: [], selectedId: "x", section: "roster" };
    saveRosterDraft(draft);
    expect(loadRosterDraft("arc-b")).toEqual(emptyDraft("arc-b"));
  });

  it("falls back to empty draft on corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(loadRosterDraft("arc-a")).toEqual(emptyDraft("arc-a"));
  });

  it("falls back to empty draft on wrong version", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, arcId: "arc-a", agents: [], selectedId: null, section: "roster" }));
    expect(loadRosterDraft("arc-a")).toEqual(emptyDraft("arc-a"));
  });

  it("clearRosterDraft removes the stored draft", () => {
    saveRosterDraft({ version: 1, arcId: "arc-a", agents: [], selectedId: null, section: "roster" });
    clearRosterDraft();
    expect(loadRosterDraft("arc-a")).toEqual(emptyDraft("arc-a"));
  });

  it("never throws when localStorage is unavailable — boot never blocks on a corrupt/absent store", () => {
    // @ts-expect-error deliberately simulating an environment without localStorage
    delete globalThis.localStorage;
    expect(() => saveRosterDraft(emptyDraft("arc-a"))).not.toThrow();
    expect(() => loadRosterDraft("arc-a")).not.toThrow();
    expect(loadRosterDraft("arc-a")).toEqual(emptyDraft("arc-a"));
  });
});
