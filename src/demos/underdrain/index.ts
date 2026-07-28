import { NARRATIVE_RAILS_FORMAT } from "../../narrative/index.js";
import {
  UNDERDRAIN_ACTION_OBJECTIVE_PROFILE,
  UNDERDRAIN_ACTION_PROFILE,
  UNDERDRAIN_AUTHORED_EXPERIENCE_PROFILE,
  UNDERDRAIN_DEMO_ID,
  UNDERDRAIN_EXPERIENCE_IDS,
  UNDERDRAIN_ROOT_GATE_CHALLENGE_ID,
  UNDERDRAIN_SERVICE_CHALLENGE_ID,
  UNDERDRAIN_CHALLENGE_ID,
} from "./arc.js";
import { UNDERDRAIN_CONSTITUTION } from "./constitution.js";

export * from "./arc.js";
export * from "./constitution.js";
export * from "./pre-action.js";
export * from "./return-binding.js";

export const UNDERDRAIN_STANDALONE_MANIFEST = {
  format: "rodoh-underdrain-standalone/2",
  id: UNDERDRAIN_DEMO_ID,
  version: "2.0.0",
  title: "UNDERDRAIN: The Bloom Below",
  classification: "authored-pilot-candidate",
  arcAuthority: "axm-action-receipt/1",
  narrativeAuthority: NARRATIVE_RAILS_FORMAT,
  authoredExperienceAuthority: UNDERDRAIN_AUTHORED_EXPERIENCE_PROFILE.format,
  actionObjectiveAuthority: UNDERDRAIN_ACTION_OBJECTIVE_PROFILE.format,
  challengeOrder: [
    UNDERDRAIN_SERVICE_CHALLENGE_ID,
    UNDERDRAIN_CHALLENGE_ID,
    UNDERDRAIN_ROOT_GATE_CHALLENGE_ID,
  ],
  experienceOrder: [...UNDERDRAIN_EXPERIENCE_IDS],
  actionProfile: UNDERDRAIN_ACTION_PROFILE,
  actionObjectives: UNDERDRAIN_ACTION_OBJECTIVE_PROFILE,
  authoredExperiences: UNDERDRAIN_AUTHORED_EXPERIENCE_PROFILE,
  oneAmBoundary: {
    safeOpeningHasNoPressureEnemies: true,
    importantRevealOccursDuringPumpPlay: true,
    resultRequiresArcAcceptanceBeforeWorldDelta: true,
    rootGateSuccessorIsAuthored: true,
    independentPlayerReceiptRequired: true,
  },
  seriesConstitution: {
    identityAnchors: UNDERDRAIN_CONSTITUTION.identityAnchors.map((anchor) => anchor.id),
    noCleanReset: true,
    bPlotMustCollide: true,
    acceptedOutcomeCannotBeReinterpreted: true,
    hiddenCauseMustBeDiscoveredInPlay: true,
  },
} as const;
