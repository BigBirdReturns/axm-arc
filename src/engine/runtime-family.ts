import { z } from "zod";
import type { Arc } from "./types.js";

/** Authored execution selection, not a player representation preference. */
export const RUNTIME_FAMILY_EXTENSION_KEY = "axm.runtime-family@1";
export const RUNTIME_FAMILY_FORMAT = "axm-runtime-family/1";
export const RUNTIME_FAMILIES = [
  "fixed-canonical-sequence",
  "encounter-simulation",
  "strategy-board",
] as const;
export type RuntimeFamily = typeof RUNTIME_FAMILIES[number];

export const RuntimeFamilyContractSchema = z.object({
  format: z.literal(RUNTIME_FAMILY_FORMAT),
  family: z.enum(RUNTIME_FAMILIES),
}).strict();
export type RuntimeFamilyContract = z.infer<typeof RuntimeFamilyContractSchema>;

export function validateRuntimeFamilyContract(input: unknown): RuntimeFamilyContract {
  return RuntimeFamilyContractSchema.parse(input);
}

/** Missing is legacy, never an inferred family. Only call with a validated Arc. */
export function readRuntimeFamilyContract(arc: Arc): RuntimeFamilyContract | null {
  const raw = arc.extensions?.[RUNTIME_FAMILY_EXTENSION_KEY];
  return raw === undefined ? null : validateRuntimeFamilyContract(raw);
}

export type RuntimeFamilySelection =
  | { kind: "legacy" }
  | { kind: "unsupported"; reason: "contract-version" | "family" }
  | { kind: "selected"; contract: RuntimeFamilyContract };

/** Call before founding or restoring execution state. Capability is supplied by
 * the receiver; recognizing a family does not implement its executor. Unknown
 * contract versions remain in custody but may never fall back to simulation. */
export function selectRuntimeFamily(
  arc: Arc,
  supportedFamilies: readonly RuntimeFamily[],
): RuntimeFamilySelection {
  const keys = Object.keys(arc.extensions ?? {}).filter((key) => key.startsWith("axm.runtime-family@"));
  if (keys.some((key) => key !== RUNTIME_FAMILY_EXTENSION_KEY)) {
    return { kind: "unsupported", reason: "contract-version" };
  }
  const contract = readRuntimeFamilyContract(arc);
  if (contract === null) return { kind: "legacy" };
  if (!supportedFamilies.includes(contract.family)) return { kind: "unsupported", reason: "family" };
  return { kind: "selected", contract };
}
