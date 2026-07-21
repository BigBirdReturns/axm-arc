// Hub-side bridge for the shared axm-cartridge-run/v3 engine envelope.
// Browser effects stay outside the engine; this module coordinates the local
// cartridge library, exact save slot, and active-cartridge pointer without
// interpreting runtime-specific extension namespaces.

import type {
  ChallengeAssignment,
  PendingRewardChoice,
  RewardDecision,
} from "../../engine/cycle.js";
import {
  buildPortableRun,
  parsePortableRun,
  normalizePortableRunExtensions,
  type PortableRunExtensions,
  type RestoredPortableRunV3,
} from "../../engine/portable-run.js";
import type { Arc, Organization } from "../../engine/types.js";
import { cartridgeDigest } from "../../engine/cartridge-digest.js";
import {
  importArcFromJson,
  loadArcLibrary,
  saveActiveArc,
} from "./arc-library.js";
import { saveSave } from "./storage.js";


export const HUB_TURN_EXTENSION = "axm-arc.turn@1";

export interface HubTurnCheckpointV1 {
  version: 1;
  assignments: ChallengeAssignment[];
  rewardDecisions: RewardDecision[];
}

export function withHubTurnCheckpoint(
  extensions: PortableRunExtensions,
  assignments: ChallengeAssignment[],
  rewardDecisions: RewardDecision[],
): PortableRunExtensions {
  return normalizePortableRunExtensions({
    ...extensions,
    [HUB_TURN_EXTENSION]: {
      version: 1,
      assignments,
      rewardDecisions,
    },
  });
}

/** Restore only a checkpoint that refers to real records in this exact Arc and
 * organization. Unknown or malformed hub state is ignored while every other
 * extension remains preserved. */
export function readHubTurnCheckpoint(
  extensions: PortableRunExtensions,
  arc: Arc,
  org: Organization,
): HubTurnCheckpointV1 | null {
  const value = extensions[HUB_TURN_EXTENSION];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record["version"] !== 1 || !Array.isArray(record["assignments"]) || !Array.isArray(record["rewardDecisions"])) return null;
  const challengeIds = new Set(arc.challenges.map((challenge) => challenge.id));
  const itemIds = new Set(arc.items.map((item) => item.id));
  const agentIds = new Set(Object.keys(org.agents));
  const modeIds = new Set(arc.difficultyModes.map((mode) => mode.id));

  const assignments: ChallengeAssignment[] = [];
  for (const raw of record["assignments"]) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate["challengeId"] !== "string" || !challengeIds.has(candidate["challengeId"])) return null;
    if (!Array.isArray(candidate["agentIds"]) || !candidate["agentIds"].every((id) => typeof id === "string" && agentIds.has(id))) return null;
    if (new Set(candidate["agentIds"]).size !== candidate["agentIds"].length) return null;
    if (!Number.isSafeInteger(candidate["tokensSpent"]) || (candidate["tokensSpent"] as number) < 0) return null;
    if (candidate["difficultyModeId"] !== undefined
      && (typeof candidate["difficultyModeId"] !== "string" || !modeIds.has(candidate["difficultyModeId"]))) return null;
    assignments.push({
      challengeId: candidate["challengeId"],
      agentIds: [...candidate["agentIds"]] as string[],
      tokensSpent: candidate["tokensSpent"] as number,
      ...(typeof candidate["difficultyModeId"] === "string"
        ? { difficultyModeId: candidate["difficultyModeId"] }
        : {}),
    });
  }

  const rewardDecisions: RewardDecision[] = [];
  for (const raw of record["rewardDecisions"]) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate["itemId"] !== "string" || !itemIds.has(candidate["itemId"])) return null;
    if (typeof candidate["sourceChallenge"] !== "string" || !challengeIds.has(candidate["sourceChallenge"])) return null;
    if (typeof candidate["winner"] !== "string" || !agentIds.has(candidate["winner"])) return null;
    if (!Array.isArray(candidate["eligible"]) || !candidate["eligible"].every((id) => typeof id === "string" && agentIds.has(id))) return null;
    if (!candidate["eligible"].includes(candidate["winner"])) return null;
    rewardDecisions.push({
      itemId: candidate["itemId"],
      sourceChallenge: candidate["sourceChallenge"],
      winner: candidate["winner"],
      eligible: [...candidate["eligible"]] as string[],
    });
  }
  return { version: 1, assignments, rewardDecisions };
}

export interface PortableRunExport {
  filename: string;
  json: string;
  digest: string;
}

export type PortableRunImportResult =
  | { ok: true; restored: RestoredPortableRunV3; installedArc: boolean }
  | { ok: false; errors: string[] };

export function portableRunFilename(arcId: string): string {
  const slug = arcId.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "cartridge"}.run.json`;
}

export function exportPortableRunToJson(params: {
  arc: Arc;
  org: Organization;
  pendingRewardChoices?: PendingRewardChoice[];
  extensions?: PortableRunExtensions;
}): PortableRunExport {
  const run = buildPortableRun(params);
  return {
    filename: portableRunFilename(run.arc.meta.id),
    json: JSON.stringify(run, null, 2),
    digest: run.integrity.digest,
  };
}

/** Validate everything before the first write. A successful import guarantees
 * the exact engine state is restorable under the included Arc digest. */
export function importPortableRunFromJson(json: string): PortableRunImportResult {
  let restored: RestoredPortableRunV3;
  try {
    restored = parsePortableRun(json);
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }

  const alreadyHeld = loadArcLibrary().some(
    (entry) => cartridgeDigest(entry.arc) === restored.authoredArcDigest,
  );
  if (!alreadyHeld) {
    const installed = importArcFromJson(JSON.stringify(restored.arc));
    if (!installed.ok) return installed;
  }

  const saved = saveSave(
    restored.org,
    restored.arc,
    restored.pendingRewardChoices,
    restored.extensions,
  );
  if (!saved.ok) return { ok: false, errors: [saved.message] };

  const active = saveActiveArc(restored.arc);
  if (!active.ok) return { ok: false, errors: [active.message] };

  return { ok: true, restored, installedArc: !alreadyHeld };
}
