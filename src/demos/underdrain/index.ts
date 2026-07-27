import { NARRATIVE_RAILS_FORMAT } from "../../narrative/index.js";
import { UNDERDRAIN_ACTION_PROFILE, UNDERDRAIN_DEMO_ID } from "./arc.js";
import { UNDERDRAIN_CONSTITUTION } from "./constitution.js";

export * from "./arc.js";
export * from "./constitution.js";
export * from "./pre-action.js";
export * from "./return-binding.js";

export const UNDERDRAIN_STANDALONE_MANIFEST = {
  format: "rodoh-underdrain-standalone/1",
  id: UNDERDRAIN_DEMO_ID,
  version: "1.0.0",
  title: "UNDERDRAIN: The Bloom Below",
  arcAuthority: "axm-action-receipt/1",
  narrativeAuthority: NARRATIVE_RAILS_FORMAT,
  actionProfile: UNDERDRAIN_ACTION_PROFILE,
  seriesConstitution: {
    identityAnchors: UNDERDRAIN_CONSTITUTION.identityAnchors.map((anchor) => anchor.id),
    noCleanReset: true,
    bPlotMustCollide: true,
    acceptedOutcomeCannotBeReinterpreted: true,
  },
} as const;
