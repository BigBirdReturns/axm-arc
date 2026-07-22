import { z } from "zod";
import {
  validateCommonShipPocket as validateBaseCommonShipPocket,
} from "./schema-base.js";
import type { CommonShipPocketSource } from "./types.js";
import type {
  CommonShipEmbodimentProfile,
  CommonShipPocketSourceV2,
} from "./embodiment.js";

const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase kebab-case id.");
const NonEmpty = z.string().trim().min(1);
const NumericRange = z.object({
  min: z.number().finite(),
  max: z.number().finite(),
}).strict().refine((range) => range.min <= range.max, "Range minimum cannot exceed maximum.");

const EmbodimentProfileSchema: z.ZodType<CommonShipEmbodimentProfile> = z.object({
  id: Slug,
  name: NonEmpty,
  description: NonEmpty,
  scale: z.object({
    class: z.enum(["micro", "small", "human-scale", "large", "colossal", "distributed"]),
    typicalHeightMeters: z.number().positive().nullable(),
    typicalMassKg: z.number().positive().nullable(),
    occupiedVolumeCubicMeters: z.number().positive(),
    minimumPassageMeters: z.number().positive(),
    reachMeters: z.number().positive().nullable(),
    locomotion: z.array(NonEmpty).min(1),
    manipulationScale: NonEmpty,
  }).strict(),
  environment: z.object({
    medium: z.enum(["gas", "liquid", "vacuum", "solid-substrate", "field", "mixed"]),
    pressureKPa: NumericRange.nullable(),
    temperatureC: NumericRange,
    gravityG: NumericRange,
    radiationTolerance: NonEmpty,
    dependencies: z.array(NonEmpty).min(1),
  }).strict(),
  sensorium: z.object({
    channels: z.array(NonEmpty).min(1),
    communication: z.array(NonEmpty).min(1),
    hazards: z.array(NonEmpty).min(1),
  }).strict(),
  interface: z.object({
    directModes: z.array(NonEmpty).min(1),
    mediatedModes: z.array(NonEmpty).min(1),
    forbiddenAssumptions: z.array(NonEmpty).min(1),
  }).strict(),
  temporal: z.object({
    externalInterval: NonEmpty,
    subjectiveResolution: NonEmpty,
    developmentalTempo: NonEmpty,
    recoveryCycle: NonEmpty,
    continuitySpan: NonEmpty,
    expectedLifespan: NonEmpty,
    lifeFractionAccounting: NonEmpty,
  }).strict(),
  lineageDependencies: z.array(NonEmpty).min(1),
}).strict();

const EmbodimentOverlaySchema = z.object({
  embodimentProfiles: z.array(EmbodimentProfileSchema).min(2),
  cast: z.array(z.object({
    id: Slug,
    profileId: Slug,
  }).passthrough()).min(6),
  watches: z.array(z.object({
    id: Slug,
    profiles: z.object({
      requiredProfileIds: z.array(Slug).min(1),
    }).passthrough(),
  }).passthrough()).min(4),
}).passthrough();

function stripEmbodimentOverlay(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const source = input as Record<string, unknown>;
  const stripped: Record<string, unknown> = { ...source };
  delete stripped["embodimentProfiles"];
  if (Array.isArray(source["cast"])) {
    stripped["cast"] = source["cast"].map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const member = { ...(value as Record<string, unknown>) };
      delete member["profileId"];
      return member;
    });
  }
  if (Array.isArray(source["watches"])) {
    stripped["watches"] = source["watches"].map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const watch = { ...(value as Record<string, unknown>) };
      const profiles = watch["profiles"];
      if (profiles && typeof profiles === "object" && !Array.isArray(profiles)) {
        const nextProfiles = { ...(profiles as Record<string, unknown>) };
        delete nextProfiles["requiredProfileIds"];
        watch["profiles"] = nextProfiles;
      }
      return watch;
    });
  }
  return stripped;
}

function issueText(path: PropertyKey[], message: string): string {
  return `[${path.map(String).join(".") || "root"}] ${message}`;
}

export type CommonShipValidation =
  | { ok: true; source: CommonShipPocketSourceV2 }
  | { ok: false; errors: string[] };

export function validateCommonShipPocket(input: unknown): CommonShipValidation {
  const errors: string[] = [];
  const base = validateBaseCommonShipPocket(stripEmbodimentOverlay(input));
  if (!base.ok) errors.push(...base.errors);

  const overlay = EmbodimentOverlaySchema.safeParse(input);
  if (!overlay.success) {
    errors.push(...overlay.error.issues.map((issue) => issueText(issue.path, issue.message)));
  }

  if (errors.length > 0 || !overlay.success || !base.ok) {
    return { ok: false, errors };
  }

  const profileIds = new Set<string>();
  overlay.data.embodimentProfiles.forEach((profile, index) => {
    if (profileIds.has(profile.id)) {
      errors.push(issueText(["embodimentProfiles", index, "id"], `Duplicate embodiment profile id "${profile.id}".`));
    }
    profileIds.add(profile.id);
  });

  const usedProfiles = new Set<string>();
  overlay.data.cast.forEach((member, index) => {
    if (!profileIds.has(member.profileId)) {
      errors.push(issueText(["cast", index, "profileId"], `Unknown embodiment profile ${member.profileId}.`));
    }
    usedProfiles.add(member.profileId);
  });
  overlay.data.watches.forEach((watch, watchIndex) => {
    const seen = new Set<string>();
    watch.profiles.requiredProfileIds.forEach((profileId, profileIndex) => {
      if (!profileIds.has(profileId)) {
        errors.push(issueText(
          ["watches", watchIndex, "profiles", "requiredProfileIds", profileIndex],
          `Unknown embodiment profile ${profileId}.`,
        ));
      }
      if (seen.has(profileId)) {
        errors.push(issueText(
          ["watches", watchIndex, "profiles", "requiredProfileIds", profileIndex],
          `Duplicate required embodiment profile ${profileId}.`,
        ));
      }
      seen.add(profileId);
    });
  });
  overlay.data.embodimentProfiles.forEach((profile, index) => {
    if (!usedProfiles.has(profile.id)) {
      errors.push(issueText(
        ["embodimentProfiles", index, "id"],
        `Embodiment profile ${profile.id} is not assigned to a cast member.`,
      ));
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, source: input as CommonShipPocketSourceV2 };
}

export function parseCommonShipPocket(input: unknown): CommonShipPocketSourceV2 {
  const result = validateCommonShipPocket(input);
  if (!result.ok) throw new Error(`Invalid Common Ship pocket:\n${result.errors.join("\n")}`);
  return result.source;
}

export const CommonShipPocketSchema = z.unknown().superRefine((input, ctx) => {
  const result = validateCommonShipPocket(input);
  if (!result.ok) {
    result.errors.forEach((message) => ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
    }));
  }
}).transform((input) => input as CommonShipPocketSourceV2);

export type { CommonShipPocketSource };
