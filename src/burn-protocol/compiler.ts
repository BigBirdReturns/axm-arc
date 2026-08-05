import {
  CANONICAL_STORY_EXTENSION_KEY,
} from "../canonical-story/index.js";
import type {
  Arc,
  ArcAttribute,
  ArcTier,
  JsonValue,
} from "../engine/types.js";
import { validateArc } from "../engine/schema.js";
import {
  BURN_PROTOCOL_EXTENSION_KEY,
  type BurnProtocolSource,
} from "./types.js";
import { parseBurnProtocol } from "./schema.js";

const HOST_ATTRIBUTES: ArcAttribute[] = [
  {
    id: "sequence",
    name: "Sequence",
    description: "Compatibility-host field. Canonical order is owned by axm.canonical-story@1.",
  },
  {
    id: "continuity",
    name: "Continuity",
    description: "Compatibility-host field. Canonical continuity is owned by the fixed story graph.",
  },
  {
    id: "custody",
    name: "Custody",
    description: "Compatibility-host field. Source and asset receipts remain inside the Arc identity.",
  },
];

const HOST_TIER: ArcTier = {
  id: "story",
  name: "Canonical Story",
  statBudgetMin: 1,
  statBudgetMax: 1,
  upkeepCost: 0,
  baseEfficiencyModifier: 1,
};

/** Compile Burn source into the existing Arc ABI without translating panels
 * into challenges. World must capability-dispatch on axm.canonical-story@1
 * before organization founding. The inert host fields are identical for every
 * Burn sequence cartridge and carry no player-facing or state-changing law. */
export function compileBurnProtocol(input: unknown): Arc {
  const source = parseBurnProtocol(input);
  const arc: Arc = {
    meta: {
      id: source.identity.id,
      name: source.identity.title,
      description: source.identity.description,
      author: source.identity.author,
      version: source.identity.version,
      engineVersion: "1.2.0",
      domain: "burn-protocol-canonical-story",
      estimatedCycles: 1,
    },
    attributes: HOST_ATTRIBUTES,
    roles: [],
    tiers: [HOST_TIER],
    currencyName: "Not used",
    materialName: "Not used",
    tokenName: "Not used",
    reputationName: "Not used",
    tokensPerCycle: 1,
    maxTokens: 1,
    infrastructureTokenBonus: 0,
    namePool: { firstNames: ["Reader"], lastNames: [] },
    customTraits: [],
    progressionTiers: [],
    attunementChains: [],
    challenges: [],
    difficultyModes: [],
    items: [],
    narrativeEvents: [],
    scaling: null,
    extensions: {
      [BURN_PROTOCOL_EXTENSION_KEY]: source as unknown as JsonValue,
      [CANONICAL_STORY_EXTENSION_KEY]: source.canonicalStory as unknown as JsonValue,
    },
  };
  return validateArc(arc);
}

export function recoverBurnProtocol(arc: Arc): BurnProtocolSource | null {
  const raw = arc.extensions?.[BURN_PROTOCOL_EXTENSION_KEY];
  return raw === undefined ? null : parseBurnProtocol(raw);
}
