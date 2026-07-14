import type { Organization, Arc } from "./types.js";
import type { PendingRewardChoice } from "./cycle.js";
import { cartridgeDigest } from "./cartridge-digest.js";

// ── Version ───────────────────────────────────────────────────────────────────

export const SAVE_VERSION = 2;

// ── Map serialization helpers ─────────────────────────────────────────────────

export function mapToArray<K, V>(m: Map<K, V>): [K, V][] {
  return [...m.entries()];
}

export function arrayToMap<K, V>(a: [K, V][]): Map<K, V> {
  return new Map(a);
}

// ── Save format ───────────────────────────────────────────────────────────────

interface SaveFile {
  version: number;
  savedAt: string;
  arcRef: { id: string; version: string; digest: string };
  organization: SerializedOrg;
  pendingRewardChoices: PendingRewardChoice[];
}

// We need to handle the Organization's fields. The only Map-like structure
// in Organization is relationships (array) and Record (plain objects) — no JS Maps.
// But agents, infrastructure etc. are Records. We serialize the full org as-is.
// If future versions add Maps, add them here.

type SerializedOrg = Omit<Organization, never>; // same shape, kept for migration extensibility

// ── Migrations ────────────────────────────────────────────────────────────────

// Each migration transforms a save from version N to N+1.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MIGRATIONS: Record<number, (s: any) => any> = {};

// ── serializeGame ─────────────────────────────────────────────────────────────

export function serializeGame(
  org: Organization,
  arc: Arc,
  pendingRewardChoices: PendingRewardChoice[] = [],
): string {
  const save: SaveFile = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    arcRef: { id: arc.meta.id, version: arc.meta.version, digest: cartridgeDigest(arc) },
    organization: org,
    pendingRewardChoices,
  };
  return JSON.stringify(save);
}

// ── deserializeGame ───────────────────────────────────────────────────────────

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

  if (typeof raw !== "object" || raw === null) {
    throw new Error("Save data must be a JSON object");
  }

  if (typeof raw["version"] !== "number") {
    throw new Error("Save data missing required field: version");
  }

  if (raw["version"] > SAVE_VERSION) {
    throw new Error(
      `Save version ${raw["version"]} is newer than engine version ${SAVE_VERSION}`,
    );
  }

  // v1 saves did not bind the exact authored bytes and cannot be relabelled as
  // current state without laundering a historical same-id cartridge revision.
  if (raw["version"] < SAVE_VERSION) {
    throw new Error(
      `Legacy save version ${raw["version"]} lacks exact cartridge identity and cannot be resumed`,
    );
  }

  if (raw["arcRef"] == null || typeof raw["arcRef"]["id"] !== "string") {
    throw new Error("Save data missing required field: arcRef.id");
  }

  if (raw["arcRef"]["id"] !== arc.meta.id) {
    throw new Error(
      `Arc ID mismatch: save has "${raw["arcRef"]["id"]}", current arc is "${arc.meta.id}"`,
    );
  }

  if (typeof raw["arcRef"]["digest"] !== "string") {
    throw new Error("Save data missing required field: arcRef.digest");
  }
  const actualDigest = cartridgeDigest(arc);
  if (raw["arcRef"]["digest"] !== actualDigest) {
    throw new Error(
      `Cartridge digest mismatch: save has "${raw["arcRef"]["digest"]}", current arc is "${actualDigest}"`,
    );
  }

  if (raw["organization"] == null) {
    throw new Error("Save data missing required field: organization");
  }

  if (!Array.isArray(raw["pendingRewardChoices"])) {
    throw new Error("Save data missing required field: pendingRewardChoices");
  }

  // Run migrations from saved version up to current version
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let migrated: any = raw;
  for (let v = migrated["version"]; v < SAVE_VERSION; v++) {
    const migration = MIGRATIONS[v];
    if (!migration) {
      throw new Error(`No migration defined from version ${v} to ${v + 1}`);
    }
    migrated = migration(migrated);
  }

  const org = migrated["organization"] as Organization;
  return {
    org,
    cycle: org.cycle,
    pendingRewardChoices: migrated["pendingRewardChoices"] as PendingRewardChoice[],
  };
}
