import type { Agent } from "../engine/types.js";
import { generateAgent } from "../engine/character.js";
import { Rng, hashSeed } from "../engine/prng.js";
import { KARAZHAN } from "./karazhan.js";

// Ten raiders — a full Karazhan roster with every role covered twice, so the
// wing-1 encounters are winnable out of the box and the harder wings demand
// recruitment, gearing, and tier growth. Deterministic: same seeds, same
// roster, every boot (same pattern as first-charter.starting-roster).

interface SeedSpec {
  tierId: "recruit" | "member" | "veteran";
  preferredRoleId: "tank" | "healer" | "melee" | "ranged" | "support";
}

const ROSTER_SEEDS: SeedSpec[] = [
  { tierId: "veteran", preferredRoleId: "tank" },
  { tierId: "member", preferredRoleId: "tank" },
  { tierId: "veteran", preferredRoleId: "healer" },
  { tierId: "member", preferredRoleId: "healer" },
  { tierId: "veteran", preferredRoleId: "melee" },
  { tierId: "recruit", preferredRoleId: "melee" },
  { tierId: "veteran", preferredRoleId: "ranged" },
  { tierId: "member", preferredRoleId: "ranged" },
  { tierId: "member", preferredRoleId: "support" },
  { tierId: "recruit", preferredRoleId: "support" },
];

function buildRoster(): Agent[] {
  const tiers = Object.fromEntries(KARAZHAN.tiers.map((t) => [t.id, t]));
  return ROSTER_SEEDS.map((spec, i) => {
    const tier = tiers[spec.tierId];
    if (!tier) throw new Error(`unknown tier ${spec.tierId}`);
    const rng = new Rng(hashSeed("karazhan", "starting-roster", i));
    return generateAgent({
      rng,
      tier,
      arc: KARAZHAN,
      cycle: 0,
      preferredRoleId: spec.preferredRoleId,
    });
  });
}

export const KARAZHAN_STARTING_ROSTER: Agent[] = buildRoster();
