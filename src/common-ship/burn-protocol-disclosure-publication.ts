import type { CommonShipPocketSourceV2 } from "./embodiment.js";
import {
  BURN_PROTOCOL_DISCLOSURE_PROBE_SOURCE as AUTHORED_BURN_PROTOCOL_DISCLOSURE_PROBE_SOURCE,
} from "./burn-protocol-disclosure-probe.js";

/**
 * The raw A13C1 mapping passed schema, composition, and static projection, then
 * the first exact World journey exposed the historical team-aggregate resolver
 * law beneath those previews: one aggregate roll is resolved for every assigned
 * actor, and every roll must clear for an all-mechanics success. The publication
 * source therefore calibrates its four bounded checks against the exact default
 * founding path, all six named founders, and the authored one-Watch steadiness
 * spend. Composition, custody, access order, outcomes, and story law remain
 * unchanged.
 */
export const BURN_PROTOCOL_DISCLOSURE_PUBLICATION_THRESHOLDS = {
  "open-the-six-repository-hearing": 45,
  "assign-the-six-withdrawal-mandates": 50,
  "repair-the-first-public-corridor": 30,
  "publish-the-read-only-reconstruction": 40,
} as const;

const source = structuredClone(
  AUTHORED_BURN_PROTOCOL_DISCLOSURE_PROBE_SOURCE,
) as CommonShipPocketSourceV2;
source.identity.version = "0.1.1";

for (const watch of source.watches) {
  const threshold = BURN_PROTOCOL_DISCLOSURE_PUBLICATION_THRESHOLDS[
    watch.id as keyof typeof BURN_PROTOCOL_DISCLOSURE_PUBLICATION_THRESHOLDS
  ];
  if (threshold === undefined) {
    throw new Error(`No live-resolver calibration for Burn watch ${watch.id}.`);
  }
  if (watch.checks.length !== 1) {
    throw new Error(`Burn watch ${watch.id} must retain exactly one bounded check.`);
  }
  watch.checks = watch.checks.map((check) => ({ ...check, threshold }));
}

const inheritedNotes = source.notes
  && typeof source.notes === "object"
  && !Array.isArray(source.notes)
  ? source.notes
  : {};
source.notes = {
  ...inheritedNotes,
  receiverCalibration: {
    format: "burn-protocol-live-resolver-calibration/1",
    foundingInput: "default axm-founding-input/1 derived from the exact cartridge id",
    party: "all six named founders",
    tokensSpentPerWatch: 1,
    acceptance: "four ordered accepted successes through ordinary runCycle",
    mechanism:
      "Thresholds account for one historical team-aggregate roll per assigned actor; composition and authored steadiness remain the substantive admission law.",
  },
};

export const BURN_PROTOCOL_DISCLOSURE_PROBE_PUBLISHED_SOURCE: CommonShipPocketSourceV2 = source;
