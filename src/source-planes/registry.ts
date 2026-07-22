import type { Arc } from "../engine/types.js";
import {
  compileGodscarPocket,
  GODSCAR_EXTENSION_KEY,
  GODSCAR_POCKET_FORMAT,
  newGodscarPocketSkeleton,
  readGodscarPocketExtension,
  validateGodscarPocket,
} from "../godscar/index.js";
import {
  compileDarkTombPocket,
  DARK_TOMB_EXTENSION_KEY,
  DARK_TOMB_POCKET_FORMAT,
  DARK_TOMB_STARTER,
  readDarkTombPocketExtension,
  validateDarkTombPocket,
} from "../dark-tomb/index.js";
import {
  compileCommonShipPocket,
  COMMON_SHIP_EXTENSION_KEY,
  COMMON_SHIP_POCKET_FORMAT,
  COMMON_SHIP_STARTER,
  readCommonShipPocketExtension,
  validateCommonShipPocket,
} from "../common-ship/index.js";

export type SourcePlaneId = "godscar-pocket" | "dark-tomb-pocket" | "common-ship-pocket";

export type SourcePlaneValidation =
  | { ok: true; source: unknown }
  | { ok: false; errors: string[] };

export interface SourcePlaneIdentity {
  id: string;
  title: string;
  version: string;
  author: string;
}

export interface SourcePlaneDefinition {
  id: SourcePlaneId;
  format: string;
  extensionKey: string;
  label: string;
  shortLabel: string;
  description: string;
  sourceFileExtension: string;
  arcFileExtension: ".arc.json";
  starter(): unknown;
  validate(input: unknown): SourcePlaneValidation;
  compile(input: unknown): Arc;
  recover(arc: Arc): unknown | null;
}

export interface SourcePlaneInspection {
  definition: SourcePlaneDefinition;
  status: "valid" | "invalid";
  source?: unknown;
  errors?: string[];
}

export type SourcePlaneCompileResult =
  | {
      ok: true;
      definition: SourcePlaneDefinition;
      source: unknown;
      identity: SourcePlaneIdentity;
      arc: Arc;
    }
  | { ok: false; errors: string[] };

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeValidation<T>(result: { ok: true; source: T } | { ok: false; errors: string[] }): SourcePlaneValidation {
  return result.ok ? { ok: true, source: result.source } : result;
}

function unknownFormatError(input: unknown): { ok: false; errors: string[] } {
  const format = input && typeof input === "object" && !Array.isArray(input)
    ? String((input as { format?: unknown }).format ?? "missing")
    : "missing";
  return { ok: false, errors: [`Unknown creator source-plane format "${format}".`] };
}

const DEFINITIONS: readonly SourcePlaneDefinition[] = Object.freeze([
  {
    id: "godscar-pocket",
    format: GODSCAR_POCKET_FORMAT,
    extensionKey: GODSCAR_EXTENSION_KEY,
    label: "Open Universe Pocket",
    shortLabel: "Pocket",
    description: "Book I pocket stories built from the six-pressure Story Engine and the shared evidence ledger.",
    sourceFileExtension: ".pocket.json",
    arcFileExtension: ".arc.json",
    starter: () => newGodscarPocketSkeleton(),
    validate: (input) => normalizeValidation(validateGodscarPocket(input)),
    compile: compileGodscarPocket,
    recover: readGodscarPocketExtension,
  },
  {
    id: "dark-tomb-pocket",
    format: DARK_TOMB_POCKET_FORMAT,
    extensionKey: DARK_TOMB_EXTENSION_KEY,
    label: "Dark Tomb Pocket",
    shortLabel: "Dark Tomb",
    description: "Book II maintained-misclassification stories built from the Tomb Engine, Long Alarm, signature budget, and layered descent.",
    sourceFileExtension: ".tomb.json",
    arcFileExtension: ".arc.json",
    starter: () => clone(DARK_TOMB_STARTER),
    validate: (input) => normalizeValidation(validateDarkTombPocket(input)),
    compile: compileDarkTombPocket,
    recover: readDarkTombPocketExtension,
  },
  {
    id: "common-ship-pocket",
    format: COMMON_SHIP_POCKET_FORMAT,
    extensionKey: COMMON_SHIP_EXTENSION_KEY,
    label: "Common Ship Pocket",
    shortLabel: "Common Ship",
    description: "Book III embodied-operation stories built from the Watch Engine, structured embodiment profiles, and constitutional handoff.",
    sourceFileExtension: ".ship.json",
    arcFileExtension: ".arc.json",
    starter: () => clone(COMMON_SHIP_STARTER),
    validate: (input) => normalizeValidation(validateCommonShipPocket(input)),
    compile: compileCommonShipPocket,
    recover: readCommonShipPocketExtension,
  },
]);

export const SOURCE_PLANE_REGISTRY: readonly SourcePlaneDefinition[] = DEFINITIONS;

export function sourcePlaneById(id: string): SourcePlaneDefinition | null {
  return DEFINITIONS.find((definition) => definition.id === id) ?? null;
}

export function sourcePlaneByFormat(format: string): SourcePlaneDefinition | null {
  return DEFINITIONS.find((definition) => definition.format === format) ?? null;
}

export function sourcePlaneByExtensionKey(extensionKey: string): SourcePlaneDefinition | null {
  return DEFINITIONS.find((definition) => definition.extensionKey === extensionKey) ?? null;
}

export function sourcePlaneForSource(input: unknown): SourcePlaneDefinition | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const format = (input as { format?: unknown }).format;
  return typeof format === "string" ? sourcePlaneByFormat(format) : null;
}

export function sourcePlaneIdentity(source: unknown): SourcePlaneIdentity {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error("Source-plane identity requires a validated source object.");
  }
  const identity = (source as { identity?: unknown }).identity;
  if (!identity || typeof identity !== "object" || Array.isArray(identity)) {
    throw new Error("Source-plane source is missing identity.");
  }
  const candidate = identity as Partial<SourcePlaneIdentity>;
  for (const field of ["id", "title", "version", "author"] as const) {
    if (typeof candidate[field] !== "string" || candidate[field]!.trim() === "") {
      throw new Error(`Source-plane identity.${field} must be a non-empty string.`);
    }
  }
  return candidate as SourcePlaneIdentity;
}

export function validateRegisteredSourcePlane(input: unknown): SourcePlaneValidation {
  const definition = sourcePlaneForSource(input);
  return definition ? definition.validate(input) : unknownFormatError(input);
}

export function compileRegisteredSourcePlane(input: unknown): SourcePlaneCompileResult {
  const definition = sourcePlaneForSource(input);
  if (!definition) return unknownFormatError(input);
  const validation = definition.validate(input);
  if (!validation.ok) return validation;
  try {
    const source = validation.source;
    return {
      ok: true,
      definition,
      source,
      identity: sourcePlaneIdentity(source),
      arc: definition.compile(source),
    };
  } catch (error) {
    return { ok: false, errors: [(error as Error).message] };
  }
}

export function inspectArcSourcePlanes(arc: Arc): SourcePlaneInspection[] {
  const extensions = arc.extensions ?? {};
  const inspections: SourcePlaneInspection[] = [];
  for (const definition of DEFINITIONS) {
    if (!(definition.extensionKey in extensions)) continue;
    try {
      const source = definition.recover(arc);
      if (source === null) {
        inspections.push({
          definition,
          status: "invalid",
          errors: [`Arc declares ${definition.extensionKey} but the source could not be recovered.`],
        });
      } else {
        inspections.push({ definition, status: "valid", source });
      }
    } catch (error) {
      inspections.push({ definition, status: "invalid", errors: [(error as Error).message] });
    }
  }
  return inspections;
}

export function recoverRegisteredSourcePlane(arc: Arc, id: SourcePlaneId): unknown | null {
  const definition = sourcePlaneById(id);
  if (!definition) return null;
  return definition.recover(arc);
}
