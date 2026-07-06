// Cartridge Workshop helpers. Covers: the teaching skeleton passes the real
// validate path and produces a digest, the draft round-trips through
// localStorage, and summarizeArc's counts against a real cartridge on disk
// (cartridges/severed-march.arc.json).

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadWorkshopDraft,
  saveWorkshopDraft,
  summarizeArc,
  workshopSkeleton,
} from "../../src/game/lib/workshop.js";
import { validateArcJson } from "../../src/game/lib/arc-library.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { validateArc } from "../../src/engine/schema.js";

// workshop.ts reads/writes the ambient `localStorage` global directly (same
// pattern as src/game/lib/storage.ts and arc-library.ts). Vitest's node
// environment doesn't provide one, so install a minimal in-memory shim (same
// pattern as designer-storage.test.ts / arc-export.test.ts).
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.has(key) ? (this.store.get(key) as string) : null; }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, value); }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
});

const CARTRIDGE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../cartridges/severed-march.arc.json",
);

describe("workshopSkeleton", () => {
  it("passes the real validate path (validateArcJson, the same seam importArcFromJson uses)", () => {
    const skeleton = workshopSkeleton();
    const result = validateArcJson(skeleton);
    if (!result.ok) throw new Error(`skeleton failed validation: ${result.errors.join("; ")}`);
    expect(result.arc.meta.id).toBe("my-first-cartridge");
  });

  it("computes a cartridge digest for the validated skeleton", () => {
    const result = validateArcJson(workshopSkeleton());
    if (!result.ok) throw new Error("expected ok");
    const digest = cartridgeDigest(result.arc);
    expect(digest).toMatch(/^cart1_[0-9a-f]{64}$/);
  });

  it("is deterministic — the same skeleton text produces the same digest every time", () => {
    const a = validateArcJson(workshopSkeleton());
    const b = validateArcJson(workshopSkeleton());
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(cartridgeDigest(a.arc)).toBe(cartridgeDigest(b.arc));
  });

  it("is pretty-printed JSON (readable, not minified)", () => {
    expect(workshopSkeleton()).toContain("\n");
  });
});

describe("workshop draft round-trip", () => {
  it("returns null when nothing is stored yet", () => {
    expect(loadWorkshopDraft()).toBeNull();
  });

  it("round-trips saved draft text", () => {
    saveWorkshopDraft("{ \"hello\": \"world\" }");
    expect(loadWorkshopDraft()).toBe("{ \"hello\": \"world\" }");
  });

  it("overwrites the previous draft on a second save", () => {
    saveWorkshopDraft("first");
    saveWorkshopDraft("second");
    expect(loadWorkshopDraft()).toBe("second");
  });

  it("uses the exact key axm-arc:workshop-draft:v1", () => {
    saveWorkshopDraft("draft-text");
    expect(localStorage.getItem("axm-arc:workshop-draft:v1")).toBe("draft-text");
  });

  it("never throws when localStorage is unavailable", () => {
    // @ts-expect-error deliberately simulating an environment without localStorage
    delete globalThis.localStorage;
    expect(() => saveWorkshopDraft("x")).not.toThrow();
    expect(() => loadWorkshopDraft()).not.toThrow();
    expect(loadWorkshopDraft()).toBeNull();
  });
});

describe("summarizeArc", () => {
  it("counts challenges/roles/items/attunementChains/narrativeEvents/progressionTiers on a real cartridge", () => {
    const raw = JSON.parse(fs.readFileSync(CARTRIDGE_PATH, "utf8"));
    const arc = validateArc(raw);
    const summary = summarizeArc(arc);
    expect(summary).toEqual({
      challenges: arc.challenges.length,
      roles: arc.roles.length,
      items: arc.items.length,
      attunementChains: arc.attunementChains.length,
      narrativeEvents: arc.narrativeEvents.length,
      progressionTiers: arc.progressionTiers.length,
    });
    // Pin the actual shape so a silent regression in the cartridge or the
    // counter both surface as a red test, not just a passthrough tautology.
    expect(summary).toEqual({
      challenges: 8,
      roles: 4,
      items: arc.items.length,
      attunementChains: 1,
      narrativeEvents: arc.narrativeEvents.length,
      progressionTiers: 3,
    });
  });
});
