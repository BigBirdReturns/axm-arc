import { describe, expect, it } from "vitest";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { foundOrganization } from "../../src/engine/founding.js";
import { validateArc } from "../../src/engine/schema.js";
import { KIND_GODS_OF_ILYON } from "../../src/arcs/kind-gods-of-ilyon.js";
import {
  GODSCAR_EXTENSION_KEY,
  KIND_GODS_OF_ILYON_BLUEPRINT,
  compileGodscarPocket,
  newGodscarPocketSkeleton,
  readGodscarPocketExtension,
  validateGodscarPocket,
} from "../../src/godscar/index.js";

describe("Godscar pocket grammar", () => {
  it("validates the six ordered pressures and compiles a normal Arc", () => {
    const validation = validateGodscarPocket(KIND_GODS_OF_ILYON_BLUEPRINT);
    expect(validation.ok).toBe(true);
    expect(validateArc(KIND_GODS_OF_ILYON)).toEqual(KIND_GODS_OF_ILYON);
    expect(KIND_GODS_OF_ILYON.meta.engineVersion).toBe("1.2.0");
    expect(KIND_GODS_OF_ILYON.challenges).toHaveLength(6);
    expect(KIND_GODS_OF_ILYON.progressionTiers.map((tier) => tier.id)).toEqual(["arrival", "disclosure", "refusal"]);
  });

  it("keeps the creator source inside cartridge identity", () => {
    const extension = readGodscarPocketExtension(KIND_GODS_OF_ILYON);
    expect(extension).toEqual(KIND_GODS_OF_ILYON_BLUEPRINT);
    expect(KIND_GODS_OF_ILYON.extensions?.[GODSCAR_EXTENSION_KEY]).toBeDefined();
    const changed = compileGodscarPocket({
      ...KIND_GODS_OF_ILYON_BLUEPRINT,
      controlQuestion: `${KIND_GODS_OF_ILYON_BLUEPRINT.controlQuestion} Who certifies the refusal?`,
    });
    expect(cartridgeDigest(changed)).not.toBe(cartridgeDigest(KIND_GODS_OF_ILYON));
  });

  it("founds the exact named cast through Arc law", () => {
    const org = foundOrganization(KIND_GODS_OF_ILYON);
    expect(Object.values(org.agents).map((agent) => agent.name).sort()).toEqual(
      KIND_GODS_OF_ILYON_BLUEPRINT.cast.map((member) => member.name).sort(),
    );
    expect(Object.keys(org.agents)).toEqual(expect.arrayContaining([
      "founder:aster-neral",
      "founder:nacre-deep-tide",
    ]));
  });

  it("rejects a collage missing story physics, cast responsibility, or pressure order", () => {
    const invalid = structuredClone(KIND_GODS_OF_ILYON_BLUEPRINT);
    invalid.pressures[0] = { ...invalid.pressures[0], kind: "patron" };
    invalid.cast = invalid.cast.filter((member) => member.responsibility !== "sovereign-exception");
    const validation = validateGodscarPocket(invalid);
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.errors.join("\n")).toMatch(/Pressure 1 must be pocket/);
    expect(validation.errors.join("\n")).toMatch(/sovereign-exception/);
  });

  it("creates a complete forkable skeleton rather than an empty page", () => {
    const skeleton = newGodscarPocketSkeleton();
    expect(skeleton.identity.id).toBe("my-godscar-pocket");
    expect(skeleton.pressures).toHaveLength(6);
    expect(skeleton.cast).toHaveLength(5);
    expect(skeleton.beats).toHaveLength(6);
    expect(validateGodscarPocket(skeleton).ok).toBe(true);
  });
});
