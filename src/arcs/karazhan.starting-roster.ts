import { foundOrganization } from "../engine/founding.js";
import type { Agent } from "../engine/types.js";
import { KARAZHAN } from "./karazhan.js";

// Compatibility export derived from the one Arc-authored founding transition.
export const KARAZHAN_STARTING_ROSTER: Agent[] = Object.values(
  foundOrganization(KARAZHAN).agents,
);
