import { beforeEach, describe, expect, it } from "vitest";
import { FIRST_CHARTER } from "../../src/arcs/first-charter.js";
import { foundOrganization } from "../../src/engine/founding.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import {
  exportPortableRunToJson,
  importPortableRunFromJson,
  readHubTurnCheckpoint,
  withHubTurnCheckpoint,
} from "../../src/game/lib/portable-run.js";
import {
  loadActiveArcSelection,
  loadArcLibrary,
} from "../../src/game/lib/arc-library.js";
import { loadSave } from "../../src/game/lib/storage.js";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const storage = new MemoryStorage();

beforeEach(() => {
  storage.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
});

describe("hub portable-run bridge", () => {
  it("installs the cartridge and resumes the exact changed run from one file", () => {
    const org = foundOrganization(FIRST_CHARTER, { format: "axm-founding-input/1", seed: 8181 });
    org.reputation = 17;
    const exported = exportPortableRunToJson({
      arc: FIRST_CHARTER,
      org,
      extensions: {
        "rodoh.ledger@2": { version: 2, entries: [{ seq: 0, challengeId: "cellar" }] },
        "rodoh.view@1": { representation: "aperture" },
      },
    });

    const imported = importPortableRunFromJson(exported.json);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    expect(imported.installedArc).toBe(true);
    expect(loadArcLibrary().some((entry) => cartridgeDigest(entry.arc) === cartridgeDigest(FIRST_CHARTER))).toBe(true);
    const saved = loadSave(imported.restored.arc);
    expect(saved?.org).toEqual(org);
    expect(saved?.extensions).toEqual(imported.restored.extensions);
  });

  it("preserves unknown runtime memory through a hub import and re-export", () => {
    const org = foundOrganization(FIRST_CHARTER);
    const first = exportPortableRunToJson({
      arc: FIRST_CHARTER,
      org,
      extensions: { "future-runtime.private@42": { untouched: [1, 2, 3] } },
    });
    const imported = importPortableRunFromJson(first.json);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const saved = loadSave(imported.restored.arc)!;
    const second = exportPortableRunToJson({
      arc: imported.restored.arc,
      org: saved.org,
      pendingRewardChoices: saved.pendingRewardChoices,
      extensions: saved.extensions,
    });
    expect(JSON.parse(second.json).extensions).toEqual(JSON.parse(first.json).extensions);
  });


  it("restores an exact in-progress hub turn and addresses a same-id revision by digest", () => {
    const org = foundOrganization(FIRST_CHARTER);
    const agentIds = Object.keys(org.agents);
    const extensions = withHubTurnCheckpoint(
      { "rodoh.view@1": { representation: "hall" } },
      [{ challengeId: "cellar", agentIds, tokensSpent: 1 }],
      [],
    );
    const exported = exportPortableRunToJson({ arc: FIRST_CHARTER, org, extensions });
    const imported = importPortableRunFromJson(exported.json);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    expect(loadActiveArcSelection()).toEqual({
      version: 2,
      id: FIRST_CHARTER.meta.id,
      digest: cartridgeDigest(FIRST_CHARTER),
    });
    const checkpoint = readHubTurnCheckpoint(imported.restored.extensions, imported.restored.arc, imported.restored.org);
    expect(checkpoint?.assignments).toEqual([{ challengeId: "cellar", agentIds, tokensSpent: 1 }]);
    expect(imported.restored.extensions["rodoh.view@1"]).toEqual({ representation: "hall" });
  });

  it("ignores malformed hub UI state without dropping other runtime namespaces", () => {
    const org = foundOrganization(FIRST_CHARTER);
    const extensions = {
      "axm-arc.turn@1": {
        version: 1,
        assignments: [{ challengeId: "not-real", agentIds: [], tokensSpent: 0 }],
        rewardDecisions: [],
      },
      "future-runtime@1": { preserved: true },
    };
    expect(readHubTurnCheckpoint(extensions, FIRST_CHARTER, org)).toBeNull();
    expect(extensions["future-runtime@1"]).toEqual({ preserved: true });
  });

  it("performs no writes when validation or integrity fails", () => {    const org = foundOrganization(FIRST_CHARTER);
    const exported = exportPortableRunToJson({ arc: FIRST_CHARTER, org });
    const raw = JSON.parse(exported.json) as { extensions: Record<string, unknown> };
    raw.extensions["tampered@1"] = true;

    const result = importPortableRunFromJson(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    expect(storage.length).toBe(0);
  });
});
