import "./abi13.js";
import type { Arc, Organization } from "./types.js";
import type { PendingRewardChoice } from "./cycle.js";
import { cartridgeDigest } from "./cartridge-digest.js";
import { initializeCartridgeState } from "./state.js";

export const SAVE_VERSION = 3;

export function mapToArray<K, V>(map: Map<K, V>): [K, V][] {
  return [...map.entries()];
}

export function arrayToMap<K, V>(entries: [K, V][]): Map<K, V> {
  return new Map(entries);
}

interface SaveFileV3 {
  version: typeof SAVE_VERSION;
  savedAt: string;
  arcRef: { id: string; version: string; digest: string };
  organization: Organization;
  pendingRewardChoices: PendingRewardChoice[];
}

// Each migration transforms a save from version N to N+1. Version 2 already
// binds exact cartridge bytes; v3 adds engine-owned cartridge state and leaves
// its deterministic definition-based backfill to deserializeGame.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MIGRATIONS: Record<number, (save: any) => any> = {
  2: (save) => ({
    ...save,
    version: 3,
    organization: {
      ...save.organization,
      cartridgeState: save.organization?.cartridgeState ?? {},
    },
  }),
};

export function serializeGame(
  org: Organization,
  arc: Arc,
  pendingRewardChoices: PendingRewardChoice[] = [],
): string {
  const initialized = initializeCartridgeState(org, arc);
  const save: SaveFileV3 = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    arcRef: { id: arc.meta.id, version: arc.meta.version, digest: cartridgeDigest(arc) },
    organization: initialized,
    pendingRewardChoices,
  };
  return JSON.stringify(save);
}

export function deserializeGame(
  json: string,
  arc: Arc,
): { org: Organization; cycle: number; pendingRewardChoices: PendingRewardChoice[] } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let raw: any;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Save data is not valid JSON");
  }
  if (typeof raw !== "object" || raw === null) throw new Error("Save data must be a JSON object");
  if (typeof raw.version !== "number") throw new Error("Save data missing required field: version");
  if (raw.version > SAVE_VERSION) {
    throw new Error(`Save version ${raw.version} is newer than engine version ${SAVE_VERSION}`);
  }
  // v1 did not bind the authored digest and cannot be relabelled as current.
  if (raw.version < 2) {
    throw new Error(`Legacy save version ${raw.version} lacks exact cartridge identity and cannot be resumed`);
  }
  if (raw.arcRef == null || typeof raw.arcRef.id !== "string") {
    throw new Error("Save data missing required field: arcRef.id");
  }
  if (raw.arcRef.id !== arc.meta.id) {
    throw new Error(`Arc ID mismatch: save has "${raw.arcRef.id}", current arc is "${arc.meta.id}"`);
  }
  if (typeof raw.arcRef.digest !== "string") {
    throw new Error("Save data missing required field: arcRef.digest");
  }
  const actualDigest = cartridgeDigest(arc);
  if (raw.arcRef.digest !== actualDigest) {
    throw new Error(`Cartridge digest mismatch: save has "${raw.arcRef.digest}", current arc is "${actualDigest}"`);
  }
  if (raw.organization == null) throw new Error("Save data missing required field: organization");
  if (!Array.isArray(raw.pendingRewardChoices)) {
    throw new Error("Save data missing required field: pendingRewardChoices");
  }

  let migrated = raw;
  for (let version = migrated.version; version < SAVE_VERSION; version++) {
    const migration = MIGRATIONS[version];
    if (!migration) throw new Error(`No migration defined from version ${version} to ${version + 1}`);
    migrated = migration(migrated);
  }
  if (migrated.version !== SAVE_VERSION) {
    throw new Error(`Save migration ended at version ${String(migrated.version)} instead of ${SAVE_VERSION}`);
  }

  const org = initializeCartridgeState(migrated.organization as Organization, arc);
  return {
    org,
    cycle: org.cycle,
    pendingRewardChoices: migrated.pendingRewardChoices as PendingRewardChoice[],
  };
}
