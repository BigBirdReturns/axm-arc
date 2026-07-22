import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { LAMP_DISTRICT } from "../../src/arcs/lamp-district.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { compileDarkTombPocket, readDarkTombPocketExtension } from "../../src/dark-tomb/compiler.js";
import { LAMP_DISTRICT_SOURCE } from "../../src/dark-tomb/lamp-district.js";
import { validateDarkTombPocket } from "../../src/dark-tomb/schema.js";
import { compileRegisteredSourcePlane, sourcePlaneById } from "../../src/source-planes/index.js";

const ROOT = new URL("../../", import.meta.url);

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(path, ROOT), "utf8")) as unknown;
}

function consequenceStateId(id: string): string {
  const consequence = LAMP_DISTRICT_SOURCE.consequences.find((candidate) => candidate.id === id);
  if (!consequence) throw new Error(`Missing Lamp District consequence ${id}`);
  return `consequence:${consequence.kind}:${consequence.id}`;
}

describe("The Lamp District canonical Dark Tomb reference", () => {
  it("is a complete canonical Book II source with eight linked civic and expedition movements", () => {
    expect(validateDarkTombPocket(LAMP_DISTRICT_SOURCE)).toEqual({ ok: true, source: LAMP_DISTRICT_SOURCE });
    expect(LAMP_DISTRICT_SOURCE.identity).toMatchObject({
      id: "lamp-district",
      title: "The Lamp District",
      version: "1.0.0",
      canonRelation: "compatible",
    });
    expect(LAMP_DISTRICT_SOURCE.delves.map((delve) => delve.tierId)).toEqual([
      "ordinary-life",
      "ordinary-life",
      "descent",
      "descent",
      "breach",
      "breach",
      "return",
      "return",
    ]);
    expect(LAMP_DISTRICT_SOURCE.delves.map((delve) => delve.id)).toEqual([
      "keep-the-school-lamps",
      "authorize-the-reservoir-route",
      "cross-the-drainage-liturgy",
      "read-the-sleeping-market",
      "wake-the-war-lattice",
      "interrupt-the-surface-sacrifice",
      "return-with-heat",
      "redraw-the-district-map",
    ]);
    expect(LAMP_DISTRICT_SOURCE.cast.map((member) => member.responsibility).sort()).toEqual([
      "bears-cost-of-concealment",
      "benefits-from-delay",
      "depends-on-alarm",
      "holds-map-changing-evidence",
      "sovereign-exception",
      "translates-excluded-actor",
      "understands-quiet-works",
    ]);
  });

  it("compiles through the registered source plane into one engine-1.3 Arc with exact source custody", () => {
    const direct = compileDarkTombPocket(LAMP_DISTRICT_SOURCE);
    const registered = compileRegisteredSourcePlane(LAMP_DISTRICT_SOURCE);
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;

    expect(sourcePlaneById("dark-tomb-pocket")?.extensionKey).toBe("godscar.dark-tomb@1");
    expect(registered.arc).toEqual(direct);
    expect(LAMP_DISTRICT).toEqual(direct);
    expect(readDarkTombPocketExtension(LAMP_DISTRICT)).toEqual(LAMP_DISTRICT_SOURCE);
    expect(LAMP_DISTRICT.meta).toMatchObject({
      id: "lamp-district",
      domain: "godscar-dark-tomb",
      engineVersion: "1.3.0",
      estimatedCycles: 18,
    });
    expect(LAMP_DISTRICT.challenges).toHaveLength(8);
    expect(LAMP_DISTRICT.founding?.roster.map((slot) => slot.name)).toEqual(
      LAMP_DISTRICT_SOURCE.cast.map((member) => member.name),
    );
  });

  it("turns Alarm, visibility, signature, and inherited consequences into engine-owned state", () => {
    const definitions = new Map(LAMP_DISTRICT.stateDefinitions?.map((definition) => [definition.id, definition]));
    expect(definitions.get("alarm-phase")).toMatchObject({ kind: "enum", initial: "hush" });
    expect(definitions.get("signature-status")).toMatchObject({ kind: "enum", initial: "credible" });
    expect(definitions.get("visibility-status")).toMatchObject({ kind: "enum", initial: "hidden" });
    for (const consequence of LAMP_DISTRICT_SOURCE.consequences) {
      expect(definitions.get(consequenceStateId(consequence.id))).toMatchObject({ kind: "boolean", initial: false });
    }

    const wake = LAMP_DISTRICT.challenges.find((challenge) => challenge.id === "wake-the-war-lattice")!;
    expect(wake.outcomes.success.stateEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ stateId: consequenceStateId("alarm-audit-opened"), operation: "set", value: true }),
      expect.objectContaining({ stateId: "alarm-phase", operation: "set", value: "wake" }),
      expect.objectContaining({ stateId: "signature-status", operation: "set", value: "strained" }),
      expect.objectContaining({ stateId: "visibility-status", operation: "set", value: "suspected" }),
    ]));

    const surface = LAMP_DISTRICT.challenges.find((challenge) => challenge.id === "interrupt-the-surface-sacrifice")!;
    expect(surface.outcomes.success.stateEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ stateId: consequenceStateId("surface-households-recognized"), operation: "set", value: true }),
      expect.objectContaining({ stateId: "signature-status", operation: "set", value: "breached" }),
      expect.objectContaining({ stateId: "visibility-status", operation: "set", value: "exposed" }),
    ]));
  });

  it("ships editable source and compiled cartridge artifacts that exactly match code authority", async () => {
    const sourceArtifact = await readJson("cartridges/lamp-district.tomb.json");
    const arcArtifact = await readJson("cartridges/lamp-district.arc.json");
    expect(sourceArtifact).toEqual(LAMP_DISTRICT_SOURCE);
    expect(arcArtifact).toEqual(LAMP_DISTRICT);
    expect(cartridgeDigest(arcArtifact as typeof LAMP_DISTRICT)).toBe(cartridgeDigest(LAMP_DISTRICT));
  });
});
