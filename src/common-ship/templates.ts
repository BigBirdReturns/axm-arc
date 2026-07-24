import { addStarterEmbodimentProfiles } from "./embodiment.js";
import { COMMON_SHIP_STARTER as COMMON_SHIP_STARTER_BASE } from "./templates-base.js";
import { COMMON_SHIP_STARTER_EXPANDED_LEDGER, withSecondRecensionNote } from "../godscar/second-recension.js";

/**
 * The Book III starter carries explicit embodiment profiles in addition to the
 * original Watch Engine source. The preserved base module remains the exact
 * merged Book III fixture; this wrapper adds the Gate 0 profile layer without
 * turning bodies into occupations.
 */
const starter = addStarterEmbodimentProfiles(COMMON_SHIP_STARTER_BASE);
starter.notes = withSecondRecensionNote(starter.notes, "book-iii", COMMON_SHIP_STARTER_EXPANDED_LEDGER);
export const COMMON_SHIP_STARTER = starter;
