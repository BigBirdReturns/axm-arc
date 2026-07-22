import "./abi13.js";
import {
  defaultFoundingInput,
  foundOrganization as foundOrganizationBase,
  legacyFoundingLaw,
  type FoundingInputV1,
} from "./founding-base.js";
import { initializeCartridgeState } from "./state.js";
import type { Arc, Organization } from "./types.js";

export { defaultFoundingInput, legacyFoundingLaw };
export type { FoundingInputV1 };

/** Engine-1.3 founding adds cartridge state and composition-profile bindings to
 * the exact deterministic v1 founding transition. Legacy Arcs remain byte-shape
 * compatible except for state backfill when they explicitly declare state. */
export function foundOrganization(
  arc: Arc,
  input: FoundingInputV1 = defaultFoundingInput(arc),
): Organization {
  const base = foundOrganizationBase(arc, input);
  const law = arc.founding ?? legacyFoundingLaw(arc);
  let agents = base.agents;
  let changed = false;

  for (const slot of law.roster) {
    if (!slot.compositionProfileId) continue;
    const agentId = `founder:${slot.id}`;
    const agent = agents[agentId];
    if (!agent) throw new Error(`Founding profile binding references missing founder "${agentId}".`);
    if (!changed) agents = { ...agents };
    agents[agentId] = { ...agent, compositionProfileId: slot.compositionProfileId };
    changed = true;
  }

  return initializeCartridgeState(changed ? { ...base, agents } : base, arc);
}
