import { describe, expect, it } from "vitest";
import { FIRST_CHARTER, KARAZHAN } from "../../src/arcs/index.js";
import {
  defaultFoundingInput,
  foundOrganization,
  legacyFoundingLaw,
} from "../../src/engine/founding.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { getRelationship } from "../../src/engine/relationships.js";
import { MINI_ARC } from "../fixtures/mini-arc.js";

describe("canonical founding transition", () => {
  it("is byte-identical for the same Arc and explicit input", () => {
    const input = { format: "axm-founding-input/1" as const, seed: 12345 };
    expect(JSON.stringify(foundOrganization(FIRST_CHARTER, input))).toBe(
      JSON.stringify(foundOrganization(FIRST_CHARTER, input)),
    );
  });

  it("makes the exact seed an explicit founding input", () => {
    const one = foundOrganization(FIRST_CHARTER, {
      format: "axm-founding-input/1",
      seed: 1,
    });
    const two = foundOrganization(FIRST_CHARTER, {
      format: "axm-founding-input/1",
      seed: 2,
    });
    expect(one.rngSeed).toBe(1);
    expect(two.rngSeed).toBe(2);
    expect(JSON.stringify(one.agents)).not.toBe(JSON.stringify(two.agents));
    expect(Object.keys(one.agents).every((id) => id.startsWith("founder:"))).toBe(true);
    expect(() => foundOrganization(FIRST_CHARTER, {
      format: "axm-founding-input/1",
      seed: -1,
    })).toThrow(/unsigned 32-bit integer/);
  });

  it("authors both bundled starts and their opening inside cartridge identity", () => {
    for (const arc of [FIRST_CHARTER, KARAZHAN]) {
      expect(arc.founding).toBeDefined();
      expect(arc.opening).toBeDefined();
      const org = foundOrganization(arc);
      expect(Object.keys(org.agents)).toHaveLength(arc.founding!.roster.length);
      expect(org.dramaQueue[0]?.id).toBe(`opening:${arc.opening!.triggerType}`);
    }
    expect(FIRST_CHARTER.meta.version).toBe("1.2.0");
    expect(KARAZHAN.meta.version).toBe("1.2.0");
    const charter = foundOrganization(FIRST_CHARTER);
    const authored = charter.relationships[0]!;
    expect(getRelationship(charter, authored.agentIds[1], authored.agentIds[0]).state).toBe("Rivalrous");
  });

  it("keeps legacy arcs playable through one frozen deterministic fallback", () => {
    const law = legacyFoundingLaw(MINI_ARC);
    expect(law.roster.length).toBeGreaterThanOrEqual(6);
    expect(foundOrganization(MINI_ARC)).toEqual(foundOrganization(MINI_ARC, defaultFoundingInput(MINI_ARC)));
    const lowCap = { ...MINI_ARC, maxTokens: 1 };
    expect(foundOrganization(lowCap).resources.tokens).toBe(1);
  });

  it("honors exact authored founder names without changing their stable ids", () => {
    const named = {
      ...FIRST_CHARTER,
      meta: { ...FIRST_CHARTER.meta, engineVersion: "1.2.0" },
      founding: {
        ...FIRST_CHARTER.founding!,
        roster: FIRST_CHARTER.founding!.roster.map((slot, index) =>
          index === 0 ? { ...slot, name: "Exact Founder" } : slot,
        ),
      },
    };
    const org = foundOrganization(named);
    expect(org.agents[`founder:${named.founding.roster[0]!.id}`]?.name).toBe("Exact Founder");
  });

  it("changes cart1 identity when founding state law changes", () => {
    const changed = {
      ...FIRST_CHARTER,
      founding: {
        ...FIRST_CHARTER.founding!,
        resources: { ...FIRST_CHARTER.founding!.resources, currency: 101 },
      },
    };
    expect(cartridgeDigest(changed)).not.toBe(cartridgeDigest(FIRST_CHARTER));
  });
});
