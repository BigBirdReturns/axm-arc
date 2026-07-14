import { foundOrganization } from "../engine/founding.js";
import type { Agent, Relationship } from "../engine/types.js";
import { FIRST_CHARTER } from "./first-charter.js";

// Compatibility exports for simulations and older callers. They are projections
// of the canonical founding transition, never a second client-authored start.
const FOUNDING_ORG = foundOrganization(FIRST_CHARTER);

export const FIRST_CHARTER_STARTING_ROSTER: Agent[] = Object.values(FOUNDING_ORG.agents);

export const FIRST_CHARTER_STARTING_SKIRMISHERS = {
  veteran: FIRST_CHARTER_STARTING_ROSTER.find(
    (agent) => agent.role === "skirmisher" && agent.tier === "veteran",
  )!,
  recruit: FIRST_CHARTER_STARTING_ROSTER.find(
    (agent) => agent.role === "skirmisher" && agent.tier === "recruit",
  )!,
};

export const FIRST_CHARTER_STARTING_RELATIONSHIPS: Relationship[] =
  FOUNDING_ORG.relationships.map((relationship) => structuredClone(relationship));
