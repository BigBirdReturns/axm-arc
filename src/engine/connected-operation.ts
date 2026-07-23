import type { PendingRewardChoice } from "./cycle.js";
import { cartridgeDigest } from "./cartridge-digest.js";
import {
  buildPortableRun,
  parsePortableRun,
  type JsonValue,
  type PortableRunExtensions,
  type PortableRunV3,
  type RestoredPortableRunV3,
} from "./portable-run.js";
import type { Arc, Organization } from "./types.js";

export const CONNECTED_OPERATION_FORMAT = "axm-connected-operation/v1" as const;
export const CONNECTED_OPERATION_EXTENSION_KEY = "axm.connected-operation@1" as const;

export interface ConnectedTransferLedger {
  id: string;
  title: string;
  selectedWatchId: string;
  excludedActor: string;
  dependency: string;
  precedentId: string;
  people: string[];
  stores: string[];
  evidence: string[];
  translationPaths: string[];
  environmentalLoads: string[];
  exposureConsequences: string[];
}

export interface ConnectedReturnLedger {
  sourceStateBefore: Record<string, string | number | boolean | null>;
  sourceStateAfter: Record<string, string | number | boolean | null>;
  destinationStateBefore: Record<string, string | number | boolean | null>;
  destinationStateAfter: Record<string, string | number | boolean | null>;
  inheritedFacts: string[];
}

export interface ConnectedOperationV1 {
  format: typeof CONNECTED_OPERATION_FORMAT;
  sourceCartridgeDigest: string;
  destinationCartridgeDigest: string;
  destinationRun: PortableRunV3;
  transfer: ConnectedTransferLedger;
  returnLedger: ConnectedReturnLedger;
  status: "outbound" | "returned";
}

export interface BuildConnectedOperationParams {
  sourceArc: Arc;
  sourceOrg: Organization;
  destinationArc: Arc;
  destinationOrg: Organization;
  transfer: ConnectedTransferLedger;
  sourcePendingRewardChoices?: PendingRewardChoice[];
  destinationPendingRewardChoices?: PendingRewardChoice[];
  sourceExtensions?: PortableRunExtensions;
  destinationExtensions?: PortableRunExtensions;
  returnLedger?: ConnectedReturnLedger;
  status?: ConnectedOperationV1["status"];
}

function stateSnapshot(org: Organization): Record<string, string | number | boolean | null> {
  return Object.fromEntries(Object.entries(org.cartridgeState ?? {}).sort(([a], [b]) => a.localeCompare(b)));
}

function assertStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return [...value];
}

function plainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value as Record<string, unknown>;
}

function transferFrom(value: unknown): ConnectedTransferLedger {
  const raw = plainObject(value, "Connected operation transfer");
  for (const key of ["id", "title", "selectedWatchId", "excludedActor", "dependency", "precedentId"] as const) {
    if (typeof raw[key] !== "string" || (raw[key] as string).trim() === "") {
      throw new Error(`Connected operation transfer.${key} must be a non-empty string.`);
    }
  }
  return {
    id: raw.id as string,
    title: raw.title as string,
    selectedWatchId: raw.selectedWatchId as string,
    excludedActor: raw.excludedActor as string,
    dependency: raw.dependency as string,
    precedentId: raw.precedentId as string,
    people: assertStringArray(raw.people, "Connected operation transfer.people"),
    stores: assertStringArray(raw.stores, "Connected operation transfer.stores"),
    evidence: assertStringArray(raw.evidence, "Connected operation transfer.evidence"),
    translationPaths: assertStringArray(raw.translationPaths, "Connected operation transfer.translationPaths"),
    environmentalLoads: assertStringArray(raw.environmentalLoads, "Connected operation transfer.environmentalLoads"),
    exposureConsequences: assertStringArray(raw.exposureConsequences, "Connected operation transfer.exposureConsequences"),
  };
}

function stateRecord(value: unknown, label: string): Record<string, string | number | boolean | null> {
  const raw = plainObject(value, label);
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, entry] of Object.entries(raw).sort(([a], [b]) => a.localeCompare(b))) {
    if (entry !== null && typeof entry !== "string" && typeof entry !== "number" && typeof entry !== "boolean") {
      throw new Error(`${label}.${key} must be a primitive cartridge-state value.`);
    }
    out[key] = entry as string | number | boolean | null;
  }
  return out;
}

function returnLedgerFrom(value: unknown): ConnectedReturnLedger {
  const raw = plainObject(value, "Connected operation returnLedger");
  return {
    sourceStateBefore: stateRecord(raw.sourceStateBefore, "returnLedger.sourceStateBefore"),
    sourceStateAfter: stateRecord(raw.sourceStateAfter, "returnLedger.sourceStateAfter"),
    destinationStateBefore: stateRecord(raw.destinationStateBefore, "returnLedger.destinationStateBefore"),
    destinationStateAfter: stateRecord(raw.destinationStateAfter, "returnLedger.destinationStateAfter"),
    inheritedFacts: assertStringArray(raw.inheritedFacts, "returnLedger.inheritedFacts"),
  };
}

export function buildConnectedOperation(params: BuildConnectedOperationParams): {
  operation: ConnectedOperationV1;
  sourceRun: PortableRunV3;
} {
  const destinationRun = buildPortableRun({
    arc: params.destinationArc,
    org: params.destinationOrg,
    pendingRewardChoices: params.destinationPendingRewardChoices,
    extensions: params.destinationExtensions,
  });
  const sourceBefore = stateSnapshot(params.sourceOrg);
  const destinationBefore = stateSnapshot(params.destinationOrg);
  const returnLedger = params.returnLedger ?? {
    sourceStateBefore: sourceBefore,
    sourceStateAfter: sourceBefore,
    destinationStateBefore: destinationBefore,
    destinationStateAfter: destinationBefore,
    inheritedFacts: ["Connected operation opened; no return effects have yet been certified."],
  };
  const operation: ConnectedOperationV1 = {
    format: CONNECTED_OPERATION_FORMAT,
    sourceCartridgeDigest: cartridgeDigest(params.sourceArc),
    destinationCartridgeDigest: cartridgeDigest(params.destinationArc),
    destinationRun,
    transfer: structuredClone(params.transfer),
    returnLedger: structuredClone(returnLedger),
    status: params.status ?? "outbound",
  };
  const sourceExtensions: PortableRunExtensions = {
    ...(params.sourceExtensions ?? {}),
    [CONNECTED_OPERATION_EXTENSION_KEY]: operation as unknown as JsonValue,
  };
  return {
    operation,
    sourceRun: buildPortableRun({
      arc: params.sourceArc,
      org: params.sourceOrg,
      pendingRewardChoices: params.sourcePendingRewardChoices,
      extensions: sourceExtensions,
    }),
  };
}

export function parseConnectedOperation(value: unknown, sourceArc?: Arc): {
  operation: ConnectedOperationV1;
  destination: RestoredPortableRunV3;
} {
  const raw = plainObject(value, "Connected operation");
  if (raw.format !== CONNECTED_OPERATION_FORMAT) throw new Error(`Unsupported connected operation format "${String(raw.format)}".`);
  if (typeof raw.sourceCartridgeDigest !== "string" || typeof raw.destinationCartridgeDigest !== "string") {
    throw new Error("Connected operation must name source and destination cartridge digests.");
  }
  if (raw.status !== "outbound" && raw.status !== "returned") throw new Error("Connected operation status is invalid.");
  if (sourceArc && raw.sourceCartridgeDigest !== cartridgeDigest(sourceArc)) {
    throw new Error("Connected operation source cartridge digest does not match the containing run.");
  }
  const destination = parsePortableRun(raw.destinationRun);
  if (destination.authoredArcDigest !== raw.destinationCartridgeDigest) {
    throw new Error("Connected operation destination digest does not match its portable run.");
  }
  const operation: ConnectedOperationV1 = {
    format: CONNECTED_OPERATION_FORMAT,
    sourceCartridgeDigest: raw.sourceCartridgeDigest,
    destinationCartridgeDigest: raw.destinationCartridgeDigest,
    destinationRun: destination.run,
    transfer: transferFrom(raw.transfer),
    returnLedger: returnLedgerFrom(raw.returnLedger),
    status: raw.status,
  };
  return { operation, destination };
}

export function connectedOperationFromRun(restored: RestoredPortableRunV3): {
  operation: ConnectedOperationV1;
  destination: RestoredPortableRunV3;
} | null {
  const value = restored.extensions[CONNECTED_OPERATION_EXTENSION_KEY];
  return value === undefined ? null : parseConnectedOperation(value, restored.arc);
}
