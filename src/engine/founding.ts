import { generateAgent } from "./character.js";
import { compareCodepoints } from "./determinism.js";
import { enqueueAuthoredOpening } from "./opening.js";
import { hashSeed, Rng } from "./prng.js";
import type {
  Arc,
  ArcTier,
  Facility,
  FoundingLaw,
  FoundingRosterSlot,
  InfrastructureFacility,
  Organization,
} from "./types.js";

export interface FoundingInputV1 {
  format: "axm-founding-input/1";
  /** Exact unsigned seed. This is run input, not ambient randomness. */
  seed: number;
}

const FACILITIES: InfrastructureFacility[] = [
  "Quarters",
  "Production",
  "Recreation",
  "Research",
  "Training",
  "Storage",
  "Medical",
];

export function defaultFoundingInput(arc: Arc): FoundingInputV1 {
  return {
    format: "axm-founding-input/1",
    seed: hashSeed(arc.meta.id, "founding-input-v1"),
  };
}

function roleFloor(arc: Arc): Record<string, number> {
  const floor: Record<string, number> = {};
  for (const challenge of arc.challenges) {
    for (const requirement of challenge.rosterRequirements.roleRequirements) {
      floor[requirement.roleId] = Math.max(floor[requirement.roleId] ?? 0, requirement.count);
    }
  }
  return floor;
}

function defaultRoleSlots(arc: Arc, size: number): Array<string | undefined> {
  const roles = [...arc.roles].sort((a, b) => compareCodepoints(a.id, b.id));
  if (roles.length === 0) return new Array<string | undefined>(size).fill(undefined);
  const assignments = Array.from({ length: size }, (_, index) => roles[index % roles.length]!.id);
  const floor = roleFloor(arc);
  const counts = new Map<string, number>();
  for (const roleId of assignments) counts.set(roleId, (counts.get(roleId) ?? 0) + 1);

  for (const role of roles) {
    const required = floor[role.id] ?? 0;
    while ((counts.get(role.id) ?? 0) < required) {
      let donor = -1;
      for (let index = assignments.length - 1; index >= 0; index--) {
        const candidate = assignments[index]!;
        if (candidate !== role.id && (counts.get(candidate) ?? 0) > (floor[candidate] ?? 0)) {
          donor = index;
          break;
        }
      }
      if (donor < 0) break;
      const from = assignments[donor]!;
      assignments[donor] = role.id;
      counts.set(from, (counts.get(from) ?? 0) - 1);
      counts.set(role.id, (counts.get(role.id) ?? 0) + 1);
    }
  }
  return assignments;
}

/** Frozen v1 fallback for legacy arcs. It is deliberately derived only from
 * validated Arc data and the v1 engine contract; clients must not substitute
 * their own bootstrap policy. */
export function legacyFoundingLaw(arc: Arc): FoundingLaw {
  const tiers = [...arc.tiers].sort((a, b) =>
    a.statBudgetMin - b.statBudgetMin || compareCodepoints(a.id, b.id),
  );
  const baseTier = tiers[0]!;
  const stepTier = tiers[Math.min(1, tiers.length - 1)]!;
  const maxParty = arc.challenges.reduce(
    (max, challenge) => Math.max(max, challenge.rosterRequirements.maxAgents),
    0,
  );
  const composition = Object.values(roleFloor(arc)).reduce((sum, count) => sum + count, 0);
  const size = Math.max(6, maxParty, composition);
  const roles = defaultRoleSlots(arc, size);
  const roster: FoundingRosterSlot[] = Array.from({ length: size }, (_, index) => ({
    id: `legacy-${index + 1}`,
    tierId: (index % 3 === 2 ? stepTier : baseTier).id,
    ...(roles[index] ? { roleId: roles[index] } : {}),
  }));

  return {
    organization: { id: "player-charter", name: "Your Charter" },
    resources: { currency: 100, materials: 0, tokens: Math.min(2, arc.maxTokens) },
    facilities: FACILITIES.map((type) => ({
      type,
      level: type === "Quarters" || type === "Recreation" ? 1 : 0,
    })),
    distributionPolicy: "council",
    roster,
    relationships: [],
  };
}

function facilitiesFor(law: FoundingLaw): Record<InfrastructureFacility, Facility> {
  const out = {} as Record<InfrastructureFacility, Facility>;
  for (const facility of law.facilities) {
    out[facility.type] = { ...facility, assignedAgents: [] };
  }
  return out;
}

/** The one deterministic founding transition. Same Arc bytes + same founding
 * input produce byte-identical Organization state in every client. */
export function foundOrganization(
  arc: Arc,
  input: FoundingInputV1 = defaultFoundingInput(arc),
): Organization {
  if (input.format !== "axm-founding-input/1") {
    throw new Error(`Unsupported founding input format "${String(input.format)}".`);
  }
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffff_ffff) {
    throw new Error(`Founding seed must be an unsigned 32-bit integer.`);
  }
  const law = arc.founding ?? legacyFoundingLaw(arc);
  const tiers = new Map<string, ArcTier>(arc.tiers.map((tier) => [tier.id, tier]));
  const agents: Organization["agents"] = {};
  const agentIdBySlot = new Map<string, string>();

  law.roster.forEach((slot, index) => {
    const tier = tiers.get(slot.tierId);
    if (!tier) throw new Error(`Founding roster slot "${slot.id}" has unknown tier "${slot.tierId}".`);
    const generated = generateAgent({
      rng: new Rng(hashSeed(input.seed >>> 0, "founder", slot.id, index)),
      tier,
      arc,
      cycle: 0,
      preferredRoleId: slot.roleId,
    });
    const agent = {
      ...generated,
      // Authored slot identity prevents probabilistic generated-id collisions
      // and gives cross-client journals a stable founder handle.
      id: `founder:${slot.id}`,
      ...(slot.name !== undefined ? { name: slot.name } : {}),
      ...(slot.morale !== undefined ? { morale: slot.morale } : {}),
      ...(slot.stress !== undefined ? { stress: slot.stress } : {}),
    };
    agents[agent.id] = agent;
    agentIdBySlot.set(slot.id, agent.id);
  });

  const relationships = law.relationships.map((relationship) => ({
    agentIds: relationship.rosterSlotIds
      .map((slotId) => agentIdBySlot.get(slotId)!)
      .sort(compareCodepoints) as [string, string],
    state: relationship.state,
    affinity: relationship.affinity,
  }));

  const base: Organization = {
    id: law.organization.id,
    name: law.organization.name,
    reputation: 0,
    resources: { ...law.resources },
    infrastructure: facilitiesFor(law),
    agents,
    relationships,
    precedents: [],
    dramaQueue: [],
    cycle: 0,
    distributionPolicy: law.distributionPolicy,
    rngSeed: input.seed >>> 0,
  };
  return enqueueAuthoredOpening(base, arc);
}
