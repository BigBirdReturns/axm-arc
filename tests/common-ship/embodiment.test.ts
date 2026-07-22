import { describe, expect, it } from "vitest";
import { compileCommonShipPocket, readCommonShipPocketExtension } from "../../src/common-ship/compiler.js";
import { validateCommonShipPocket } from "../../src/common-ship/schema.js";
import { COMMON_SHIP_STARTER } from "../../src/common-ship/templates.js";
import { COMMON_SHIP_STARTER as COMMON_SHIP_STARTER_BASE } from "../../src/common-ship/templates-base.js";

const PROFILE_IDS = [
  "dry-humanoid-response",
  "aquatic-care-lineage",
  "heavy-maintainer-lineage",
  "manyborn-mediator-cloud",
  "nine-year-analyst-lineage",
  "counterborn-vessel-fork",
];

function errorsFor(input: unknown): string[] {
  const result = validateCommonShipPocket(input);
  return result.ok ? [] : result.errors;
}

describe("Common Ship embodiment profiles", () => {
  it("requires the Gate 0 embodiment layer on the canonical source", () => {
    expect(errorsFor(COMMON_SHIP_STARTER_BASE)).toEqual(expect.arrayContaining([
      expect.stringContaining("embodimentProfiles"),
      expect.stringContaining("profileId"),
      expect.stringContaining("requiredProfileIds"),
    ]));
    expect(validateCommonShipPocket(COMMON_SHIP_STARTER)).toEqual({
      ok: true,
      source: COMMON_SHIP_STARTER,
    });
  });

  it("binds every cast member and authored watch to declared profiles", () => {
    expect(COMMON_SHIP_STARTER.embodimentProfiles.map((profile) => profile.id)).toEqual(PROFILE_IDS);
    expect(COMMON_SHIP_STARTER.cast.map((member) => member.profileId).sort()).toEqual([...PROFILE_IDS].sort());
    for (const watch of COMMON_SHIP_STARTER.watches) {
      expect(watch.profiles.requiredProfileIds.length).toBeGreaterThan(0);
      for (const profileId of watch.profiles.requiredProfileIds) {
        expect(PROFILE_IDS).toContain(profileId);
      }
    }
  });

  it("preserves scale, environment, interface, and temporal difference", () => {
    const aquatic = COMMON_SHIP_STARTER.embodimentProfiles.find((profile) => profile.id === "aquatic-care-lineage")!;
    const large = COMMON_SHIP_STARTER.embodimentProfiles.find((profile) => profile.id === "heavy-maintainer-lineage")!;
    const shortLived = COMMON_SHIP_STARTER.embodimentProfiles.find((profile) => profile.id === "nine-year-analyst-lineage")!;
    const distributed = COMMON_SHIP_STARTER.embodimentProfiles.find((profile) => profile.id === "counterborn-vessel-fork")!;

    expect(aquatic.environment.medium).toBe("liquid");
    expect(aquatic.interface.forbiddenAssumptions).toContain("remote presence is equivalent to bodily access");
    expect(large.scale.minimumPassageMeters).toBeGreaterThan(2);
    expect(shortLived.temporal.expectedLifespan).toContain("Nine external years");
    expect(shortLived.temporal.lifeFractionAccounting).toContain("percentage");
    expect(distributed.scale.class).toBe("distributed");
    expect(distributed.scale.typicalHeightMeters).toBeNull();
  });

  it("rejects missing, duplicate, unknown, and uninhabited profile claims", () => {
    const unknown = structuredClone(COMMON_SHIP_STARTER);
    unknown.cast[0]!.profileId = "missing-profile";
    unknown.watches[0]!.profiles.requiredProfileIds[0] = "missing-profile";
    expect(errorsFor(unknown)).toEqual(expect.arrayContaining([
      expect.stringContaining("Unknown embodiment profile missing-profile"),
    ]));

    const duplicate = structuredClone(COMMON_SHIP_STARTER);
    duplicate.embodimentProfiles[1]!.id = duplicate.embodimentProfiles[0]!.id;
    expect(errorsFor(duplicate)).toEqual(expect.arrayContaining([
      expect.stringContaining("Duplicate embodiment profile id"),
    ]));

    const unused = structuredClone(COMMON_SHIP_STARTER);
    unused.cast[0]!.profileId = unused.cast[1]!.profileId;
    expect(errorsFor(unused)).toEqual(expect.arrayContaining([
      expect.stringContaining("is not assigned to a cast member"),
    ]));
  });

  it("embeds and recovers the exact profiled source through the ordinary Arc compiler", () => {
    const source = structuredClone(COMMON_SHIP_STARTER);
    const arc = compileCommonShipPocket(source);
    expect(arc.extensions?.["godscar.common-ship@1"]).toEqual(source);
    expect(readCommonShipPocketExtension(arc)).toEqual(source);
  });
});
