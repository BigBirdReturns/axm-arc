import type { Agent, Relationship } from "../engine/types.js";
import { generateAgent } from "../engine/character.js";
import { Rng, hashSeed } from "../engine/prng.js";
import { FIRST_CHARTER } from "./first-charter.js";

interface SeedSpec {
  tierId: "recruit" | "veteran" | "champion";
  preferredRoleId?: "vanguard" | "skirmisher" | "mender";
}

const ROSTER_SEEDS: SeedSpec[] = [
  { tierId: "veteran", preferredRoleId: "vanguard" },
  { tierId: "veteran", preferredRoleId: "mender" },
  { tierId: "veteran", preferredRoleId: "skirmisher" },
  { tierId: "recruit", preferredRoleId: "skirmisher" },
  { tierId: "champion" },
  { tierId: "recruit" },
];

function buildRoster(): Agent[] {
  const tiers = Object.fromEntries(FIRST_CHARTER.tiers.map((t) => [t.id, t]));
  const agents = ROSTER_SEEDS.map((spec, i) => {
    const tier = tiers[spec.tierId];
    if (!tier) throw new Error(`unknown tier ${spec.tierId}`);
    const rng = new Rng(hashSeed("first-charter", "starting-roster", i));
    return generateAgent({
      rng,
      tier,
      arc: FIRST_CHARTER,
      cycle: 0,
      preferredRoleId: spec.preferredRoleId,
    });
  });

  // Veteran skirmisher carries some wear; recruit starts slightly demoralized by the comparison.
  return agents.map((a) => {
    if (a.role === "skirmisher" && a.tier === "veteran") return { ...a, stress: 3 };
    if (a.role === "skirmisher" && a.tier === "recruit") return { ...a, morale: 38 };
    return a;
  });
}

export const FIRST_CHARTER_STARTING_ROSTER: Agent[] = buildRoster();

export const FIRST_CHARTER_STARTING_SKIRMISHERS = {
  veteran: FIRST_CHARTER_STARTING_ROSTER.find(
    (a) => a.role === "skirmisher" && a.tier === "veteran",
  )!,
  recruit: FIRST_CHARTER_STARTING_ROSTER.find(
    (a) => a.role === "skirmisher" && a.tier === "recruit",
  )!,
};

// The two skirmishers ship with a budding rivalry per tutorial design.
export const FIRST_CHARTER_STARTING_RELATIONSHIPS: Relationship[] = (() => {
  const skirmishers = FIRST_CHARTER_STARTING_ROSTER.filter(
    (a) => a.role === "skirmisher",
  );
  if (skirmishers.length < 2) return [];
  return [
    {
      agentIds: [skirmishers[0]!.id, skirmishers[1]!.id],
      state: "Rivalrous",
      affinity: -5,
    },
  ];
})();
