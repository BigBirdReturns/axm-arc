import { addStarterEmbodimentProfiles } from "./embodiment.js";
import { COMMON_SHIP_STARTER as COMMON_SHIP_STARTER_BASE } from "./templates-base.js";

/**
 * The Book III starter carries explicit embodiment profiles in addition to the
 * original Watch Engine source. The preserved base module remains the exact
 * merged Book III fixture; this wrapper adds the Gate 0 profile layer without
 * turning bodies into occupations.
 */
export const COMMON_SHIP_STARTER = addStarterEmbodimentProfiles(COMMON_SHIP_STARTER_BASE);
