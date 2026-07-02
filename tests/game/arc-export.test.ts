// Hub arc export: the outbound half of the cartridge loop. World's cartridge
// bay (axm-world src/world/cartridge-bay.ts) vendors this repo's engine at a
// pinned commit, so "importArcFromJson accepts it" here is the same statement
// as "world's importer accepts it" — both run the identical validateArc().
//
// Contract under test:
//   - export produces the raw Arc object, no library envelope
//   - export re-runs validateArc(); invalid arcs yield errors and no payload
//   - filename is deterministic: <arc-id>.arc.json
//   - exported JSON round-trips through the importer unchanged

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import {
  exportArcToJson,
  exportFilename,
  importArcFromJson,
} from "../../src/game/lib/arc-library.js";
import { MINI_ARC } from "../fixtures/mini-arc.js";

// arc-library.ts reads/writes the ambient `localStorage` global directly.
// Vitest's node environment doesn't provide one, so install a minimal
// in-memory shim (same pattern as designer-storage.test.ts).
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

describe("exportFilename", () => {
  it("is deterministic: <arc-id>.arc.json", () => {
    expect(exportFilename("mini-arc")).toBe("mini-arc.arc.json");
    expect(exportFilename("first-charter")).toBe("first-charter.arc.json");
  });

  it("slugifies defensively so the name is always filesystem-safe", () => {
    expect(exportFilename("My Arc!!")).toBe("my-arc.arc.json");
    expect(exportFilename("///")).toBe("arc.arc.json");
  });
});

describe("exportArcToJson", () => {
  it("exports a valid saved arc as JSON matching the arc exactly", () => {
    const result = exportArcToJson(MINI_ARC);
    if (!result.ok) throw new Error(`expected ok, got errors: ${result.errors.join("; ")}`);
    expect(result.payload.filename).toBe("mini-arc.arc.json");
    expect(JSON.parse(result.payload.json)).toEqual(MINI_ARC);
  });

  it("exports the raw Arc object only — no library envelope fields", () => {
    const result = exportArcToJson(MINI_ARC);
    if (!result.ok) throw new Error("expected ok");
    const parsed = JSON.parse(result.payload.json) as Record<string, unknown>;
    // Provenance belongs to the loading system, never the file: a file must
    // not be able to claim its own trust level.
    expect(parsed).not.toHaveProperty("trust");
    expect(parsed).not.toHaveProperty("source");
    expect(parsed).not.toHaveProperty("importedAt");
    expect(parsed).not.toHaveProperty("arc");
    expect(parsed).toHaveProperty("meta");
  });

  it("runs validateArc: an invalid arc surfaces errors and produces no download payload", () => {
    const broken = structuredClone(MINI_ARC) as unknown as Record<string, unknown>;
    delete broken.meta;
    const result = exportArcToJson(broken as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("meta"))).toBe(true);
    expect(result).not.toHaveProperty("payload");
  });

  it("rejects field-level corruption, not just missing sections", () => {
    const broken = structuredClone(MINI_ARC) as unknown as { meta: Record<string, unknown> };
    broken.meta.version = 42; // schema wants a string
    const result = exportArcToJson(broken as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes("meta.version"))).toBe(true);
  });
});

describe("export → import round-trip (the cartridge loop)", () => {
  it("an exported file is accepted by the importer and reproduces the arc unchanged", () => {
    const exported = exportArcToJson(MINI_ARC);
    if (!exported.ok) throw new Error("expected ok");
    const imported = importArcFromJson(exported.payload.json);
    if (!imported.ok) throw new Error(`round-trip rejected: ${imported.errors.join("; ")}`);
    expect(imported.entry.arc).toEqual(MINI_ARC);
    // Provenance is assigned by the loader, exactly as world's bay does it.
    expect(imported.entry.trust).toBe("imported-unsigned");
    expect(imported.entry.source).toBe("imported");
  });
});

describe("library screen export wiring (shell-regression guards)", () => {
  const screen = fs.readFileSync(
    new URL("../../src/game/components/LibraryScreen.tsx", import.meta.url),
    "utf8",
  );

  it("every library entry gets an Export button wired to exportArcToJson", () => {
    expect(screen).toContain("data-testid={`export-arc-${entry.arc.meta.id}`}");
    expect(screen).toContain("exportArcToJson(entry.arc)");
  });

  it("a blocked export renders validation errors; a good one confirms the filename", () => {
    expect(screen).toContain('data-testid="export-errors"');
    expect(screen).toContain('data-testid="export-success"');
    // The download must come from the validated payload, not re-stringified state:
    expect(screen).toContain("result.payload.json");
    expect(screen).toContain("result.payload.filename");
  });
});
