import { describe, expect, it } from "vitest";
import type { Arc } from "../../src/engine/types.js";
import {
  compileRegisteredSourcePlane,
  inspectArcSourcePlanes,
  recoverRegisteredSourcePlane,
  SOURCE_PLANE_REGISTRY,
  sourcePlaneByExtensionKey,
  sourcePlaneByFormat,
  sourcePlaneById,
  sourcePlaneForSource,
  sourcePlaneIdentity,
  validateRegisteredSourcePlane,
} from "../../src/source-planes/index.js";

const EXPECTED = [
  ["godscar-pocket", "godscar-pocket/1", "godscar.pocket@1"],
  ["dark-tomb-pocket", "dark-tomb-pocket/1", "godscar.dark-tomb@1"],
  ["common-ship-pocket", "common-ship-pocket/1", "godscar.common-ship@1"],
] as const;

describe("creator source-plane registry", () => {
  it("publishes one stable ordered definition for every accepted Codex source plane", () => {
    expect(SOURCE_PLANE_REGISTRY.map((definition) => [definition.id, definition.format, definition.extensionKey])).toEqual(EXPECTED);
    expect(new Set(SOURCE_PLANE_REGISTRY.map((definition) => definition.id)).size).toBe(SOURCE_PLANE_REGISTRY.length);
    expect(new Set(SOURCE_PLANE_REGISTRY.map((definition) => definition.format)).size).toBe(SOURCE_PLANE_REGISTRY.length);
    expect(new Set(SOURCE_PLANE_REGISTRY.map((definition) => definition.extensionKey)).size).toBe(SOURCE_PLANE_REGISTRY.length);
  });

  it("resolves definitions through id, format, extension, and source without switch statements", () => {
    for (const definition of SOURCE_PLANE_REGISTRY) {
      const source = definition.starter();
      expect(sourcePlaneById(definition.id)).toBe(definition);
      expect(sourcePlaneByFormat(definition.format)).toBe(definition);
      expect(sourcePlaneByExtensionKey(definition.extensionKey)).toBe(definition);
      expect(sourcePlaneForSource(source)).toBe(definition);
    }
    expect(sourcePlaneById("missing")).toBeNull();
    expect(sourcePlaneByFormat("missing/1")).toBeNull();
    expect(sourcePlaneByExtensionKey("missing.source@1")).toBeNull();
  });

  it("validates, compiles, and exactly recovers every registered starter", () => {
    for (const definition of SOURCE_PLANE_REGISTRY) {
      const source = definition.starter();
      const validation = validateRegisteredSourcePlane(source);
      expect(validation.ok).toBe(true);
      const compiled = compileRegisteredSourcePlane(source);
      expect(compiled.ok).toBe(true);
      if (!compiled.ok) continue;
      expect(compiled.definition).toBe(definition);
      expect(compiled.source).toEqual(source);
      expect(compiled.identity).toEqual(sourcePlaneIdentity(source));
      expect(compiled.arc.extensions?.[definition.extensionKey]).toEqual(source);
      expect(definition.recover(compiled.arc)).toEqual(source);
      expect(recoverRegisteredSourcePlane(compiled.arc, definition.id)).toEqual(source);
      expect(inspectArcSourcePlanes(compiled.arc)).toEqual([
        { definition, status: "valid", source },
      ]);
    }
  });

  it("refuses unknown formats without guessing a source plane", () => {
    const unknown = { format: "future-pocket/99", identity: { id: "x" } };
    expect(validateRegisteredSourcePlane(unknown)).toEqual({
      ok: false,
      errors: ['Unknown creator source-plane format "future-pocket/99".'],
    });
    expect(compileRegisteredSourcePlane(unknown)).toEqual({
      ok: false,
      errors: ['Unknown creator source-plane format "future-pocket/99".'],
    });
  });

  it("reports a recognized but invalid embedded source while leaving unknown extensions untouched", () => {
    const base = SOURCE_PLANE_REGISTRY[0]!.compile(SOURCE_PLANE_REGISTRY[0]!.starter());
    const arc: Arc = {
      ...base,
      extensions: {
        ...base.extensions,
        "godscar.dark-tomb@1": { format: "dark-tomb-pocket/1", broken: true },
        "holder.private@7": { keep: "exactly" },
      },
    };
    const inspections = inspectArcSourcePlanes(arc);
    expect(inspections).toHaveLength(2);
    expect(inspections[0]).toMatchObject({
      definition: SOURCE_PLANE_REGISTRY[0],
      status: "valid",
    });
    expect(inspections[1]!.definition).toBe(SOURCE_PLANE_REGISTRY[1]);
    expect(inspections[1]!.status).toBe("invalid");
    expect(inspections[1]!.errors?.[0]).toContain("Invalid Dark Tomb pocket");
    expect(arc.extensions?.["holder.private@7"]).toEqual({ keep: "exactly" });
  });
});
