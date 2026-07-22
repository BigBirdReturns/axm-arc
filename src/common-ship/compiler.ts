import "../engine/abi13.js";
import type {
  CartridgeStateDefinition,
  CartridgeStateEffect,
  CompositionConstraint,
  CompositionProfile,
} from "../engine/abi13.js";
import type { Arc } from "../engine/types.js";
import { validateArc } from "../engine/schema.js";
import {
  compileCommonShipPocket as compileBaseCommonShipPocket,
} from "./compiler-base.js";
import { parseCommonShipPocket } from "./schema.js";
import type { CommonShipEmbodimentProfile, CommonShipPocketSourceV2 } from "./embodiment.js";
import { COMMON_SHIP_EXTENSION_KEY } from "./types.js";

function profileFor(source: CommonShipEmbodimentProfile): CompositionProfile {
  const metrics: Record<string, number> = {
    "occupied-volume-m3": source.scale.occupiedVolumeCubicMeters,
    "minimum-passage-m": source.scale.minimumPassageMeters,
  };
  if (source.scale.typicalHeightMeters !== null) metrics["height-m"] = source.scale.typicalHeightMeters;
  if (source.scale.typicalMassKg !== null) metrics["mass-kg"] = source.scale.typicalMassKg;
  if (source.scale.reachMeters !== null) metrics["reach-m"] = source.scale.reachMeters;

  const ranges: CompositionProfile["ranges"] = {
    "temperature-c": { ...source.environment.temperatureC },
    "gravity-g": { ...source.environment.gravityG },
  };
  if (source.environment.pressureKPa) ranges["pressure-kpa"] = { ...source.environment.pressureKPa };

  return {
    id: source.id,
    name: source.name,
    description: source.description,
    tags: [
      `profile:${source.id}`,
      `scale:${source.scale.class}`,
      `medium:${source.environment.medium}`,
      "environment-profiled",
      "translation-path",
      "continuity-profiled",
      "life-fraction-accounted",
      ...(source.scale.class === "distributed" ? ["distributed-person"] : []),
    ],
    metrics,
    ranges,
    dependencies: [...new Set([
      ...source.environment.dependencies,
      ...source.lineageDependencies,
    ])],
  };
}

function requiredProfilesConstraint(
  watchId: string,
  requiredProfileIds: string[],
  category: string,
  label: string,
): CompositionConstraint {
  return {
    id: `${watchId}:${category}`,
    label,
    category,
    kind: "all",
    constraints: requiredProfileIds.map((profileId) => ({
      id: `${watchId}:${category}:${profileId}`,
      label: `Represent ${profileId}`,
      category,
      kind: "profile-count" as const,
      profileIds: [profileId],
      min: 1,
    })),
  };
}

function constraintsFor(
  source: CommonShipPocketSourceV2,
  watch: CommonShipPocketSourceV2["watches"][number],
): CompositionConstraint[] {
  const roleChildren: CompositionConstraint[] = (watch.requiredRoles ?? []).map((requirement) => ({
    id: `${watch.id}:role-coverage:${requirement.roleId}`,
    label: `Cover ${requirement.roleId}`,
    category: "role-coverage",
    kind: "role-count",
    roleId: requirement.roleId,
    min: requirement.count,
  }));
  const roleCoverage: CompositionConstraint = roleChildren.length > 0
    ? {
        id: `${watch.id}:role-coverage`,
        label: "Role coverage",
        category: "role-coverage",
        kind: "all",
        constraints: roleChildren,
      }
    : {
        id: `${watch.id}:role-coverage`,
        label: "Role coverage",
        category: "role-coverage",
        kind: "tag-count",
        tag: "environment-profiled",
        min: watch.minAgents,
      };

  const required = watch.profiles.requiredProfileIds;
  const minimumRedundancy = Math.min(2, Math.max(1, watch.minAgents));
  return [
    roleCoverage,
    requiredProfilesConstraint(watch.id, required, "temporal-overlap", "Temporal overlap"),
    requiredProfilesConstraint(watch.id, required, "habitat-compatibility", "Habitat compatibility"),
    {
      id: `${watch.id}:translation-resilience`,
      label: "Translation resilience",
      category: "translation-resilience",
      kind: "redundancy",
      tag: "translation-path",
      minDistinctProfiles: minimumRedundancy,
    },
    {
      id: `${watch.id}:handoff-continuity`,
      label: "Handoff continuity",
      category: "handoff-continuity",
      kind: "tag-count",
      tag: "continuity-profiled",
      min: watch.minAgents,
    },
    {
      id: `${watch.id}:life-fraction-fairness`,
      label: "Life-fraction fairness",
      category: "life-fraction-fairness",
      kind: "fraction",
      tag: "life-fraction-accounted",
      minFraction: 1,
    },
  ];
}

function stateDefinitions(source: CommonShipPocketSourceV2): CartridgeStateDefinition[] {
  return source.shipState.map((track) => ({
    id: track.kind,
    label: track.kind.split("-").map((part) => part[0]!.toUpperCase() + part.slice(1)).join(" "),
    description: track.description,
    visibility: "public" as const,
    kind: "number" as const,
    initial: track.value,
    min: 0,
    max: 4,
  }));
}

function stateEffects(
  watch: CommonShipPocketSourceV2["watches"][number],
): CartridgeStateEffect[] {
  return watch.shipStateEffects.map((effect) => ({
    stateId: effect.track,
    reason: effect.reason,
    operation: effect.delta >= 0 ? "increment" as const : "decrement" as const,
    value: Math.abs(effect.delta),
    overflow: "clamp" as const,
  }));
}

export function compileCommonShipPocket(input: unknown): Arc {
  const source = parseCommonShipPocket(input);
  const base = compileBaseCommonShipPocket(source);
  const castById = new Map(source.cast.map((member) => [member.id, member]));
  const watchById = new Map(source.watches.map((watch) => [watch.id, watch]));

  const arc: Arc = {
    ...base,
    meta: { ...base.meta, engineVersion: "1.3.0" },
    stateDefinitions: stateDefinitions(source),
    compositionProfiles: source.embodimentProfiles.map(profileFor),
    founding: base.founding
      ? {
          ...base.founding,
          roster: base.founding.roster.map((slot) => {
            const member = castById.get(slot.id);
            if (!member) throw new Error(`Common Ship founding slot ${slot.id} has no cast profile.`);
            return { ...slot, compositionProfileId: member.profileId };
          }),
        }
      : undefined,
    challenges: base.challenges.map((challenge) => {
      const watch = watchById.get(challenge.id);
      if (!watch) throw new Error(`Common Ship challenge ${challenge.id} has no watch source.`);
      return {
        ...challenge,
        compositionConstraints: constraintsFor(source, watch),
        outcomes: {
          success: {
            ...challenge.outcomes.success,
            narrative: watch.success,
            stateEffects: stateEffects(watch),
          },
          partial: { ...challenge.outcomes.partial, narrative: watch.partial },
          failure: { ...challenge.outcomes.failure, narrative: watch.failure },
        },
      };
    }),
  };
  return validateArc(arc);
}

export function readCommonShipPocketExtension(arc: Arc): CommonShipPocketSourceV2 | null {
  const value = arc.extensions?.[COMMON_SHIP_EXTENSION_KEY];
  return value === undefined ? null : parseCommonShipPocket(value);
}
