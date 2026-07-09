// PR 073 — import preflight honesty: before anything persists, the incoming
// digest and the custody action (new · update · exact duplicate) are reported.
// importPreflight is a pure, read-only derivation that reuses validateArcJson
// verbatim (no second validator) and never mutates the entries it reads
// (RFC_CARTRIDGE_LIBRARY, ruling 2 — additive report; the one-click
// Validate & Save write path is untouched).

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  importPreflight,
  importArcFromJson,
  loadArcLibrary,
  ensureBundledArc,
  type ArcLibraryEntry,
} from "../../src/game/lib/arc-library.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { FIRST_CHARTER } from "../../src/arcs/index.js";

// arc-library.ts reads/writes the ambient `localStorage` global directly.
// Vitest's node environment doesn't provide one, so install a minimal
// in-memory shim (same pattern as expansion-archive.test.ts / workshop.test.ts).
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

function readCartridgeJson(): string {
  return fs.readFileSync(CARTRIDGE_PATH, "utf8");
}

describe("importPreflight", () => {
  it("invalid JSON reports the same errors validateArcJson gives, and is not ok", () => {
    const entries = loadArcLibrary();
    const pre = importPreflight("not json at all", entries);
    expect(pre.ok).toBe(false);
    if (pre.ok) throw new Error("unreachable");
    expect(pre.errors.length).toBeGreaterThan(0);
    expect(pre.errors[0]).toMatch(/JSON parse error/);
  });

  it("a schema-invalid arc reports errors, not a crash", () => {
    const entries = loadArcLibrary();
    const pre = importPreflight(JSON.stringify({ meta: { id: "x" } }), entries);
    expect(pre.ok).toBe(false);
    if (pre.ok) throw new Error("unreachable");
    expect(pre.errors.length).toBeGreaterThan(0);
  });

  it("fresh library (no same id/digest): action new, existing null, digest matches cartridgeDigest", () => {
    const json = readCartridgeJson();
    const entries = loadArcLibrary(); // empty
    const pre = importPreflight(json, entries);
    expect(pre.ok).toBe(true);
    if (!pre.ok) throw new Error("unreachable");
    expect(pre.action).toBe("new");
    expect(pre.existing).toBeNull();
    expect(pre.sameIdBundled).toBeNull();
    const parsed = JSON.parse(json);
    expect(pre.digest).toBe(cartridgeDigest(parsed));
  });

  it("after importArcFromJson: preflight of the SAME json reports an exact duplicate", () => {
    const json = readCartridgeJson();
    const imported = importArcFromJson(json);
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("unreachable");

    const entries = loadArcLibrary();
    const pre = importPreflight(json, entries);
    expect(pre.ok).toBe(true);
    if (!pre.ok) throw new Error("unreachable");
    expect(pre.action).toBe("duplicate");
    expect(pre.existing).not.toBeNull();
    expect(pre.existing!.source).toBe("imported");
    expect(pre.existing!.digest).toBe(pre.digest);
    expect(pre.digest).toBe(cartridgeDigest(imported.entry.arc));
  });

  it("a same-id, different-digest re-import reports an update, with existing = the previously imported digest", () => {
    const json = readCartridgeJson();
    const imported = importArcFromJson(json);
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error("unreachable");
    const originalDigest = cartridgeDigest(imported.entry.arc);

    const parsed = JSON.parse(json);
    parsed.meta.version = parsed.meta.version + "-preflight-test";
    const updatedJson = JSON.stringify(parsed);

    const entries = loadArcLibrary();
    const pre = importPreflight(updatedJson, entries);
    expect(pre.ok).toBe(true);
    if (!pre.ok) throw new Error("unreachable");
    expect(pre.action).toBe("update");
    expect(pre.existing).not.toBeNull();
    expect(pre.existing!.source).toBe("imported");
    expect(pre.existing!.digest).toBe(originalDigest);
    expect(pre.digest).not.toBe(originalDigest);
  });

  it("sameIdBundled: an incoming arc sharing a bundled arc's id surfaces the bundled digest honestly", () => {
    ensureBundledArc(FIRST_CHARTER);
    const entries = loadArcLibrary();
    const bundledDigest = cartridgeDigest(FIRST_CHARTER);

    const json = JSON.stringify(FIRST_CHARTER);
    const pre = importPreflight(json, entries);
    expect(pre.ok).toBe(true);
    if (!pre.ok) throw new Error("unreachable");

    expect(pre.sameIdBundled).not.toBeNull();
    expect(pre.sameIdBundled!.digest).toBe(bundledDigest);
    expect(pre.sameIdBundled!.version).toBe(FIRST_CHARTER.meta.version);

    // Byte-identical content against the bundled entry itself → duplicate,
    // consistently with the digests actually computed above.
    expect(pre.digest).toBe(bundledDigest);
    expect(pre.action).toBe("duplicate");
    expect(pre.existing).not.toBeNull();
    expect(pre.existing!.source).toBe("bundled");
    expect(pre.existing!.digest).toBe(bundledDigest);
  });

  it("is pure — never mutates the entries array it is given", () => {
    ensureBundledArc(FIRST_CHARTER);
    const json = readCartridgeJson();
    importArcFromJson(json);
    const entries: ArcLibraryEntry[] = loadArcLibrary();
    const snapshot = JSON.stringify(entries);

    importPreflight(json, entries);
    importPreflight(JSON.stringify(FIRST_CHARTER), entries);
    importPreflight("garbage", entries);

    expect(JSON.stringify(entries)).toBe(snapshot);
  });
});
