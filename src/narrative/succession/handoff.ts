import { fingerprint, uniqueOrdered } from "./determinism.js";
import {
  assertValidContinuingUniverseSource,
  assertValidNarrativeHandoffPacket,
  computeNarrativeHandoffFingerprint,
} from "./source-validation.js";
import {
  NARRATIVE_AGENCY_FORMAT,
  NARRATIVE_HANDOFF_FORMAT,
  type BeatFunction,
  type ContinuingUniverseSource,
  type HandoffActor,
  type HandoffFactSeed,
  type NarrativeActorBelief,
  type NarrativeActorGoal,
  type NarrativeAgencyEstate,
  type NarrativeHandoffPacket,
  type NarrativeProposition,
  type SourceCastMember,
} from "./model.js";

const AGENCY_POLICY = {
  requireIntentionReceipts: true,
  requireKnowledgeReceipts: true,
  requirePositiveGoalEffect: true,
  requireRiskReceipt: true,
  minimumBeliefConfidence: 500,
  allowSuspectedBeliefs: true,
} as const;

interface ResponsibilityPolicy {
  moves: string[];
  movePreferences: Partial<Record<BeatFunction, string>>;
  forbidden: string[];
}

const RESPONSIBILITY_POLICIES: Record<string, ResponsibilityPolicy> = {
  "depends-on-system": {
    moves: ["protect-working-good", "warn-withdrawal-cost"],
    movePreferences: { establish: "protect-working-good", pressure: "warn-withdrawal-cost", choose: "warn-withdrawal-cost" },
    forbidden: ["abandon-dependents", "deny-dependency"],
  },
  "translates-excluded-actor": {
    moves: ["translate-excluded-actor", "refuse-single-speaker"],
    movePreferences: { reveal: "translate-excluded-actor", escalate: "translate-excluded-actor", choose: "refuse-single-speaker" },
    forbidden: ["collapse-excluded-actor", "erase-speaker"],
  },
  "holds-evidence": {
    moves: ["verify-evidence", "publish-with-limits"],
    movePreferences: { reveal: "verify-evidence", escalate: "verify-evidence", consequence: "publish-with-limits" },
    forbidden: ["claim-certainty-without-receipt", "destroy-evidence"],
  },
  "benefits-from-delay": {
    moves: ["delay-certification", "demand-verification"],
    movePreferences: { pressure: "demand-verification", reveal: "delay-certification" },
    forbidden: ["erase-evidence", "declare-certainty"],
  },
  "sovereign-exception": {
    moves: ["refuse-model", "invalidate-authority"],
    movePreferences: { choose: "refuse-model", consequence: "invalidate-authority" },
    forbidden: ["accept-total-integration", "accept-ownership"],
  },
  "depends-on-alarm": {
    moves: ["preserve-alarm", "convert-dispute-to-audit"],
    movePreferences: { pressure: "preserve-alarm", choose: "convert-dispute-to-audit" },
    forbidden: ["declare-peace-without-audit", "erase-threat"],
  },
  "bears-cost-of-concealment": {
    moves: ["demand-recognition", "withdraw-sacrifice"],
    movePreferences: { establish: "demand-recognition", reveal: "demand-recognition", choose: "withdraw-sacrifice" },
    forbidden: ["accept-asset-classification", "erase-household-cost"],
  },
  "understands-quiet-works": {
    moves: ["trace-physical-margin", "expose-administrative-margin"],
    movePreferences: { establish: "trace-physical-margin", escalate: "expose-administrative-margin" },
    forbidden: ["invent-capacity", "ignore-wake"],
  },
  "holds-map-changing-evidence": {
    moves: ["verify-route", "publish-map-with-limits"],
    movePreferences: { reveal: "verify-route", escalate: "verify-route", consequence: "publish-map-with-limits" },
    forbidden: ["claim-inert-lattice", "destroy-evidence"],
  },
};

const GROUP_ORDER: BeatFunction[] = ["establish", "pressure", "reveal", "escalate", "choose", "consequence"];

const CONTINUING_UNIVERSE_RAIL = {
  id: "continuing-universe-causal-rail/1",
  functionOrder: [...GROUP_ORDER],
  prerequisites: {
    establish: [],
    pressure: ["establish"],
    reveal: ["establish", "pressure"],
    escalate: ["establish", "pressure", "reveal"],
    choose: ["establish", "pressure", "reveal", "escalate"],
    consequence: ["establish", "pressure", "reveal", "escalate", "choose"],
  },
  transitions: {
    start: ["establish"],
    establish: ["pressure"],
    pressure: ["reveal"],
    reveal: ["escalate"],
    escalate: ["choose"],
    choose: ["consequence"],
    consequence: [],
  },
  terminalFunctions: ["consequence"],
} as const;

const GODSCAR_GROUPS: Record<BeatFunction, string[]> = {
  establish: ["pocket"],
  pressure: ["patron"],
  reveal: ["excluded-actor"],
  escalate: ["approaching-trigger"],
  choose: ["cost-of-resistance"],
  consequence: ["scale-revelation"],
  inherit: [],
};

const TOMB_GROUPS: Record<BeatFunction, string[]> = {
  establish: ["tomb-form", "ordinary-good"],
  pressure: ["exterior-lie", "custodian"],
  reveal: ["excluded-actor"],
  escalate: ["approaching-breach"],
  choose: ["cost-of-opening-or-closing"],
  consequence: ["scale-revelation"],
  inherit: [],
};

const GODSCAR_RESPONSIBILITIES: Record<BeatFunction, string[]> = {
  establish: ["depends-on-system"],
  pressure: ["benefits-from-delay", "depends-on-system"],
  reveal: ["holds-evidence", "translates-excluded-actor"],
  escalate: ["translates-excluded-actor", "holds-evidence"],
  choose: ["depends-on-system", "sovereign-exception"],
  consequence: ["sovereign-exception", "holds-evidence"],
  inherit: [],
};

const TOMB_RESPONSIBILITIES: Record<BeatFunction, string[]> = {
  establish: ["bears-cost-of-concealment", "understands-quiet-works"],
  pressure: ["depends-on-alarm", "benefits-from-delay"],
  reveal: ["holds-map-changing-evidence", "translates-excluded-actor"],
  escalate: ["understands-quiet-works", "sovereign-exception"],
  choose: ["depends-on-alarm", "bears-cost-of-concealment"],
  consequence: ["sovereign-exception", "holds-map-changing-evidence"],
  inherit: [],
};

const PAYMENT_KIND: Record<BeatFunction, string> = {
  establish: "dependency",
  pressure: "precedent",
  reveal: "evidence-standing",
  escalate: "exposure-risk",
  choose: "control-decision",
  consequence: "map-inheritance",
  inherit: "inheritance",
};

const REQUIRED_PAYMENT_KINDS: Record<BeatFunction, string[]> = {
  establish: [],
  pressure: ["dependency"],
  reveal: ["precedent"],
  escalate: ["evidence-standing"],
  choose: ["dependency", "precedent", "evidence-standing", "exposure-risk"],
  consequence: ["control-decision"],
  inherit: ["map-inheritance"],
};

const OPEN_OBLIGATION: Partial<Record<BeatFunction, string>> = {
  establish: "dependency",
  pressure: "legitimacy",
  reveal: "evidence",
  escalate: "exposure",
  choose: "decision-cost",
};

const RESOLVE_OBLIGATIONS: Record<BeatFunction, string[]> = {
  establish: [],
  pressure: [],
  reveal: [],
  escalate: [],
  choose: ["dependency", "legitimacy", "evidence"],
  consequence: ["exposure", "decision-cost"],
  inherit: [],
};

const PHYSICS_GROUP_HINTS: Record<BeatFunction, string[]> = {
  establish: ["hub", "comfort", "good", "dependency"],
  pressure: ["map", "opacity", "concentration", "faction"],
  reveal: ["exclusion", "residue", "evidence", "answer"],
  escalate: ["defense", "distance", "scale"],
  choose: ["reset", "cost", "wake", "claim"],
  consequence: ["victory", "inherit", "constituency", "distributed", "changes"],
  inherit: ["inherit"],
};

function kebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function responsibilityPolicy(member: SourceCastMember): ResponsibilityPolicy {
  return RESPONSIBILITY_POLICIES[member.responsibility] ?? {
    moves: [`act-as-${kebab(member.responsibility)}`],
    movePreferences: {},
    forbidden: [],
  };
}

function sourceAuthorityProjection(source: ContinuingUniverseSource): unknown {
  return {
    format: source.format,
    identity: source.identity,
    controlQuestion: source.controlQuestion,
    pressures: source.pressures,
    evidence: source.evidence,
    factionReceipts: source.factionReceipts,
    cast: source.cast,
    consequences: source.consequences,
    storyPhysics: source.storyPhysics,
  };
}

function propositionForPressure(source: ContinuingUniverseSource, pressureId: string): NarrativeProposition {
  const pressure = source.pressures.find((entry) => entry.id === pressureId);
  if (!pressure) throw new Error(`Unknown pressure ${pressureId}`);
  return {
    id: `proposition:pressure:${pressure.id}`,
    tags: [`source:${source.identity.id}`, `pressure:${pressure.kind}`, `pressure-id:${pressure.id}`],
    truth: "true",
    sourceReceiptRefs: [`source-pressure:${pressure.id}`],
  };
}

function buildPropositions(source: ContinuingUniverseSource): NarrativeProposition[] {
  const pressurePropositions = source.pressures.map((pressure) => propositionForPressure(source, pressure.id));
  const evidenceProposition: NarrativeProposition = {
    id: `proposition:evidence:${source.identity.id}`,
    tags: [
      `source:${source.identity.id}`,
      `evidence-tier:${source.evidence.tier}`,
      "claim:map-changing",
      "claim:contested",
    ],
    truth: "unknown",
    sourceReceiptRefs: source.evidence.receipts.map((receipt) => `evidence:${receipt.id}`),
  };
  const factionPropositions = source.factionReceipts.flatMap((faction) => [
    {
      id: `proposition:faction-good:${faction.factionId}`,
      tags: [`source:${source.identity.id}`, `faction:${faction.factionId}`, "claim:public-good"],
      truth: "true" as const,
      sourceReceiptRefs: [`faction-receipt:${faction.factionId}:public-good`],
    },
    {
      id: `proposition:faction-failure:${faction.factionId}`,
      tags: [`source:${source.identity.id}`, `faction:${faction.factionId}`, "claim:characteristic-failure"],
      truth: "true" as const,
      sourceReceiptRefs: [`faction-receipt:${faction.factionId}:failure`],
    },
  ]);
  return [...pressurePropositions, evidenceProposition, ...factionPropositions];
}

function goalForMember(source: ContinuingUniverseSource, member: SourceCastMember): NarrativeActorGoal[] {
  const responsibilityGoal: NarrativeActorGoal = {
    id: `goal:${member.id}:${member.responsibility}`,
    actorId: member.id,
    tags: [
      `source:${source.identity.id}`,
      `goal:${member.responsibility}`,
      `responsibility:${member.responsibility}`,
      ...(member.factionId ? [`faction:${member.factionId}`] : []),
    ],
    priority: member.responsibility === "sovereign-exception" ? 900 : 800,
    status: "open",
    openedByReceipt: `source-cast:${member.id}`,
  };
  if (!member.factionId) return [responsibilityGoal];
  return [
    responsibilityGoal,
    {
      id: `goal:${member.id}:public-good`,
      actorId: member.id,
      tags: [`source:${source.identity.id}`, "goal:public-good", `faction:${member.factionId}`],
      priority: 650,
      status: "open",
      openedByReceipt: `faction-receipt:${member.factionId}`,
    },
  ];
}

function relevantPressureKinds(responsibility: string): string[] {
  const map: Record<string, string[]> = {
    "depends-on-system": ["patron", "cost-of-resistance", "pocket"],
    "holds-evidence": ["approaching-trigger", "scale-revelation"],
    "translates-excluded-actor": ["excluded-actor"],
    "benefits-from-delay": ["approaching-trigger"],
    "sovereign-exception": ["excluded-actor", "scale-revelation"],
    "depends-on-alarm": ["custodian", "exterior-lie", "cost-of-opening-or-closing"],
    "bears-cost-of-concealment": ["ordinary-good", "excluded-actor", "cost-of-opening-or-closing"],
    "understands-quiet-works": ["tomb-form", "approaching-breach", "ordinary-good"],
    "holds-map-changing-evidence": ["approaching-breach", "scale-revelation"],
  };
  return map[responsibility] ?? [];
}

function buildBeliefs(source: ContinuingUniverseSource): NarrativeActorBelief[] {
  const beliefs: NarrativeActorBelief[] = [];
  for (const member of source.cast) {
    for (const kind of relevantPressureKinds(member.responsibility)) {
      for (const pressure of source.pressures.filter((entry) => entry.kind === kind)) {
        beliefs.push({
          actorId: member.id,
          propositionId: `proposition:pressure:${pressure.id}`,
          stance: "knows",
          confidence: 900,
          acquiredCycle: 0,
          sourceReceiptRef: `source-cast:${member.id}:${pressure.id}`,
        });
      }
    }
    if (member.responsibility.includes("evidence")) {
      beliefs.push({
        actorId: member.id,
        propositionId: `proposition:evidence:${source.identity.id}`,
        stance: "knows",
        confidence: 900,
        acquiredCycle: 0,
        sourceReceiptRef: `source-cast:${member.id}:evidence-custody`,
      });
    } else if (member.responsibility === "benefits-from-delay") {
      beliefs.push({
        actorId: member.id,
        propositionId: `proposition:evidence:${source.identity.id}`,
        stance: "suspects",
        confidence: 650,
        acquiredCycle: 0,
        sourceReceiptRef: `source-cast:${member.id}:contested-evidence`,
      });
    }
    if (member.factionId) {
      beliefs.push({
        actorId: member.id,
        propositionId: `proposition:faction-good:${member.factionId}`,
        stance: "knows",
        confidence: 950,
        acquiredCycle: 0,
        sourceReceiptRef: `faction-receipt:${member.factionId}:public-good`,
      });
      beliefs.push({
        actorId: member.id,
        propositionId: `proposition:faction-failure:${member.factionId}`,
        stance: "believes",
        confidence: 700,
        acquiredCycle: 0,
        sourceReceiptRef: `faction-receipt:${member.factionId}:failure`,
      });
    }
  }
  return beliefs;
}

function actorRecord(source: ContinuingUniverseSource, member: SourceCastMember, goals: readonly NarrativeActorGoal[]): HandoffActor {
  const policy = responsibilityPolicy(member);
  return {
    id: member.id,
    name: member.name,
    roleId: member.roleId,
    responsibility: member.responsibility,
    factionId: member.factionId,
    baselineMoves: [...new Set(policy.moves)],
    movePreferences: { ...policy.movePreferences },
    forbiddenMoves: uniqueOrdered(policy.forbidden),
    goalIds: goals.filter((goal) => goal.actorId === member.id).map((goal) => goal.id),
  };
}

function groupPhysicsTags(source: ContinuingUniverseSource, group: BeatFunction): string[] {
  const hints = PHYSICS_GROUP_HINTS[group];
  return Object.entries(source.storyPhysics)
    .filter(([, enabled]) => enabled)
    .map(([key]) => kebab(key))
    .filter((key) => hints.some((hint) => key.includes(hint)))
    .map((key) => `physics:${key}`);
}

function factSeed(
  source: ContinuingUniverseSource,
  group: BeatFunction,
  kinds: readonly string[],
  preferredResponsibilities: readonly string[],
): HandoffFactSeed {
  const pressures = source.pressures.filter((pressure) => kinds.includes(pressure.kind));
  if (pressures.length === 0) throw new Error(`${source.identity.id} has no source pressure for ${group}`);
  const propositionIds = pressures.map((pressure) => `proposition:pressure:${pressure.id}`);
  if (group === "reveal") propositionIds.push(`proposition:evidence:${source.identity.id}`);
  return {
    id: `fact-seed:${source.identity.id}:${group}`,
    group,
    tags: uniqueOrdered([
      `source:${source.identity.id}`,
      `beat:${group}`,
      ...pressures.flatMap((pressure) => [`pressure:${pressure.kind}`, `pressure-id:${pressure.id}`]),
      ...groupPhysicsTags(source, group),
    ]),
    sourcePressureIds: pressures.map((pressure) => pressure.id),
    propositionIds: uniqueOrdered(propositionIds),
    preferredResponsibilities: [...preferredResponsibilities],
    preferredActorIds: [],
    requiredActorCount: group === "choose" || group === "consequence" ? 2 : 1,
    statePaymentKind: PAYMENT_KIND[group],
    requiresStatePaymentKinds: [...REQUIRED_PAYMENT_KINDS[group]],
    opensObligationKind: OPEN_OBLIGATION[group],
    resolvesObligationKinds: RESOLVE_OBLIGATIONS[group],
    severity: GROUP_ORDER.indexOf(group) * 10 + 20,
  };
}

export function compileNarrativeHandoff(source: ContinuingUniverseSource): NarrativeHandoffPacket {
  assertValidContinuingUniverseSource(source);
  const groups = source.format === "godscar-pocket/1" ? GODSCAR_GROUPS : TOMB_GROUPS;
  const responsibilities = source.format === "godscar-pocket/1" ? GODSCAR_RESPONSIBILITIES : TOMB_RESPONSIBILITIES;
  const goals = source.cast.flatMap((member) => goalForMember(source, member));
  const propositions = buildPropositions(source);
  const agency: NarrativeAgencyEstate = {
    format: NARRATIVE_AGENCY_FORMAT,
    goals,
    propositions,
    beliefs: buildBeliefs(source),
    commonKnowledgePropositionIds: source.pressures
      .filter((pressure) =>
        ["pocket", "tomb-form", "ordinary-good", "patron", "exterior-lie", "cost-of-resistance", "cost-of-opening-or-closing"].includes(
          pressure.kind,
        ),
      )
      .map((pressure) => `proposition:pressure:${pressure.id}`),
  };
  const storyPhysicsTags = Object.entries(source.storyPhysics)
    .filter(([, enabled]) => enabled)
    .map(([key]) => `physics:${kebab(key)}`);
  const consequenceTags = source.consequences.map((consequence) => `consequence:${consequence.kind}`);
  const controllingKinds = source.format === "godscar-pocket/1" ? ["patron"] : ["exterior-lie", "custodian"];
  const controllingTags = source.pressures
    .filter((pressure) => controllingKinds.includes(pressure.kind))
    .flatMap((pressure) => [`pressure:${pressure.kind}`, `pressure-id:${pressure.id}`]);
  const excludedTags = source.pressures
    .filter((pressure) => pressure.kind === "excluded-actor")
    .flatMap((pressure) => [`pressure:${pressure.kind}`, `pressure-id:${pressure.id}`]);
  const costTags = source.pressures
    .filter((pressure) => pressure.kind.includes("cost"))
    .flatMap((pressure) => [`pressure:${pressure.kind}`, `pressure-id:${pressure.id}`]);

  const packetAuthority: Omit<NarrativeHandoffPacket, "handoffFingerprint"> = {
    format: NARRATIVE_HANDOFF_FORMAT,
    source: {
      format: source.format,
      id: source.identity.id,
      title: source.identity.title,
      version: source.identity.version,
      description: source.identity.description,
      controlQuestion: source.controlQuestion,
    },
    sourceFingerprint: fingerprint(sourceAuthorityProjection(source)),
    referencePlotExcluded: true,
    identityAnchors: [
      { id: "world", anyOfTags: [`source:${source.identity.id}`], required: true },
      {
        id: "bounded-world",
        anyOfTags: source.pressures
          .filter((pressure) => ["pocket", "tomb-form", "ordinary-good"].includes(pressure.kind))
          .flatMap((pressure) => [`pressure:${pressure.kind}`, `pressure-id:${pressure.id}`]),
        required: false,
      },
      { id: "controlling-method", anyOfTags: uniqueOrdered(controllingTags), required: false },
      { id: "excluded-actor", anyOfTags: uniqueOrdered(excludedTags), required: false },
      { id: "concrete-cost", anyOfTags: uniqueOrdered(costTags), required: false },
      { id: "persistent-change", anyOfTags: uniqueOrdered([...storyPhysicsTags, ...consequenceTags]), required: false },
    ],
    minimumIdentityAnchorMatches: 2,
    prohibitedMoves: uniqueOrdered([
      "clean-reset",
      "costless-salvation",
      "erase-excluded-actor",
      "certainty-without-receipt",
      ...source.cast.flatMap((member) => responsibilityPolicy(member).forbidden),
    ]),
    storyPhysicsTags: uniqueOrdered(storyPhysicsTags),
    actors: source.cast.map((member) => actorRecord(source, member, goals)),
    factSeeds: GROUP_ORDER.map((group) => factSeed(source, group, groups[group], responsibilities[group])),
    rail: {
      id: CONTINUING_UNIVERSE_RAIL.id,
      functionOrder: [...CONTINUING_UNIVERSE_RAIL.functionOrder],
      prerequisites: Object.fromEntries(
        Object.entries(CONTINUING_UNIVERSE_RAIL.prerequisites).map(([key, value]) => [key, [...value]]),
      ),
      transitions: Object.fromEntries(
        Object.entries(CONTINUING_UNIVERSE_RAIL.transitions).map(([key, value]) => [key, [...value]]),
      ),
      terminalFunctions: [...CONTINUING_UNIVERSE_RAIL.terminalFunctions],
    },
    pressures: source.pressures.map((pressure) => ({ ...pressure })),
    evidence: {
      ...source.evidence,
      receipts: source.evidence.receipts.map((receipt) => ({ ...receipt })),
    },
    factions: source.factionReceipts.map((faction) => ({ ...faction })),
    consequences: source.consequences.map((consequence) => ({ ...consequence })),
    agency,
    agencyPolicy: { ...AGENCY_POLICY },
  };
  const packet: NarrativeHandoffPacket = {
    ...packetAuthority,
    handoffFingerprint: computeNarrativeHandoffFingerprint(packetAuthority),
  };
  assertValidNarrativeHandoffPacket(packet);
  return packet;
}
