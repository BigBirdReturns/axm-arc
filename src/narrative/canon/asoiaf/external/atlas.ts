import {
  compareCodepoints,
  orderedStrings,
} from "../../../../engine/determinism.js";
import { narrativeFingerprint } from "../../../fingerprint.js";
import {
  ASOIAF_RECALL_ESTATE_MANIFEST,
  ASOIAF_RECALL_ESTATE_PACKETS,
} from "../recall/index.js";
import {
  asoiafExternalLaneFingerprint,
  asoiafExternalSourceFingerprint,
  canonicalAsoiafExternalQueryLane,
  canonicalAsoiafExternalSource,
} from "./canonical.js";
import { ASOIAF_EXTERNAL_SOURCES } from "./catalog.js";
import { ASOIAF_EXTERNAL_QUERY_LANES } from "./query-lanes.js";
import type {
  AsoiafExternalAtlasManifest,
  AsoiafExternalAuthorityClass,
  AsoiafExternalCollectionStep,
  AsoiafExternalHarvestWorkOrder,
  AsoiafExternalQueryLane,
  AsoiafExternalRole,
  AsoiafExternalRouteRequest,
  AsoiafExternalRouteResult,
  AsoiafExternalRouteSource,
  AsoiafExternalSource,
  AsoiafExternalSourcePlane,
} from "./types.js";
import {
  ASOIAF_EXTERNAL_ATLAS_MANIFEST_FORMAT,
  ASOIAF_EXTERNAL_HARVEST_WORK_ORDER_FORMAT,
} from "./types.js";

const AUTHORITY_CLASSES: AsoiafExternalAuthorityClass[] = [
  "primary-text",
  "companion-text",
  "released-author-text",
  "author-statement",
  "adaptation-canon",
  "production-testimony",
  "licensed-reference",
  "official-bibliography",
  "structured-dataset",
  "community-reference",
  "community-analysis",
  "discussion-provenance",
  "scholarly-analogue",
  "archival-custody",
  "discovery-only",
];

const SOURCE_PLANES: AsoiafExternalSourcePlane[] = [
  "local-primary",
  "official-author",
  "official-adaptation",
  "publisher-reference",
  "structured-tool",
  "community-reference",
  "community-analysis",
  "discussion",
  "scholarly",
  "archive",
  "discovery",
];

const ALL_RECALL_CANDIDATES = ASOIAF_RECALL_ESTATE_PACKETS.flatMap(
  (packet) => packet.candidates,
);

function candidateLaneIds(candidate: (typeof ALL_RECALL_CANDIDATES)[number]): AsoiafExternalRole[] {
  const lanes = new Set<AsoiafExternalRole>();
  switch (candidate.domain) {
    case "core-entities":
      lanes.add("entity-resolution");
      lanes.add("networks");
      break;
    case "lineage-claims":
      lanes.add("genealogy-parentage");
      lanes.add("succession-legitimacy");
      lanes.add("gender-kinship");
      break;
    case "chronology-geography":
      lanes.add("chronology");
      lanes.add("geography-travel");
      lanes.add("maps");
      break;
    case "actor-knowledge":
      lanes.add("actor-knowledge");
      lanes.add("chapter-analysis");
      break;
    case "material-logistics":
      lanes.add("military-logistics");
      lanes.add("economics-smallfolk");
      lanes.add("food-agriculture");
      break;
    case "magic-physics":
      lanes.add("magic-world-physics");
      lanes.add("dragons");
      lanes.add("religion-sacrifice");
      lanes.add("prophecy");
      break;
    case "narrative-functions":
      lanes.add("chapter-analysis");
      lanes.add("adaptation-deltas");
      lanes.add("endgame-closure");
      break;
    case "adaptation-deltas":
      lanes.add("adaptation-deltas");
      lanes.add("production-intent");
      lanes.add("episode-dialogue");
      break;
    case "endgame-coordinates":
      lanes.add("endgame-closure");
      lanes.add("death-status");
      lanes.add("hotd-endpoints");
      break;
    case "smallfolk-systems":
      lanes.add("economics-smallfolk");
      lanes.add("law-governance");
      lanes.add("medicine-disease");
      lanes.add("food-agriculture");
      break;
  }

  const haystack = `${candidate.label} ${candidate.summary} ${candidate.tags.join(" ")}`.toLowerCase();
  const textRules: Array<[RegExp, AsoiafExternalRole]> = [
    [/varys|r['’]?hllor|red priest|flame/, "varys-rhllor"],
    [/blackfyre|bittersteel|golden company|young griff/, "blackfyres"],
    [/other|white walker|long night/, "others-long-night"],
    [/dance|green council|dragonseed|tumbleton|rhaenyra|aegon ii/, "dance-of-dragons"],
    [/dragon/, "dragons"],
    [/prophe|dream|vision/, "prophecy"],
    [/herald|sigil|house words|banner/, "heraldry"],
    [/language|valyrian|dothraki|translation/, "language"],
    [/disease|greyscale|plague|medicine|wound/, "medicine-disease"],
    [/death|dead|alive|survive|fate/, "death-status"],
    [/author|martin|grrm/, "author-intent"],
    [/adapt|show|episode|hbo/, "adaptation-deltas"],
  ];
  for (const [pattern, laneId] of textRules) {
    if (pattern.test(haystack)) lanes.add(laneId);
  }
  return [...lanes].sort(compareCodepoints);
}

function sourceLaneIds(
  source: AsoiafExternalSource,
  lanes: readonly AsoiafExternalQueryLane[],
): AsoiafExternalRole[] {
  const ids = new Set<AsoiafExternalRole>(source.roles);
  for (const lane of lanes) {
    if (lane.preferredSourceIds.includes(source.id)) ids.add(lane.id);
  }
  return [...ids].sort(compareCodepoints);
}

function collectionSteps(source: AsoiafExternalSource): AsoiafExternalCollectionStep[] {
  const steps: AsoiafExternalCollectionStep[] = [
    "establish-source-custody",
    "hash-source-record",
    "write-immutable-observation",
    "deduplicate-candidate",
    "reconcile-held-candidates",
    "record-honest-terminal-result",
  ];
  if (source.harvestPolicy.mode !== "local-private-only") {
    steps.splice(1, 0, "check-robots-and-terms");
  }
  if (
    source.accessMethods.some(
      (method) => method.machineReadable && method.kind !== "local-file",
    )
  ) {
    steps.splice(2, 0, "discover-schema");
  }
  if (source.harvestPolicy.mode !== "route-only-no-mirror") {
    steps.splice(steps.indexOf("hash-source-record"), 0, "fetch-bounded-records");
    steps.splice(
      steps.indexOf("write-immutable-observation"),
      0,
      "normalize-whitelisted-fields",
      "block-private-contact",
    );
  }
  if (source.rightsMode === "cc-by" || source.rightsMode === "cc-by-sa") {
    steps.splice(
      steps.indexOf("reconcile-held-candidates"),
      0,
      "generate-credit-if-required",
    );
  }
  return steps;
}

function buildWorkOrder(
  source: AsoiafExternalSource,
  lanes: readonly AsoiafExternalQueryLane[],
): AsoiafExternalHarvestWorkOrder {
  const laneIds = sourceLaneIds(source, lanes);
  const candidateIds = ALL_RECALL_CANDIDATES.filter((candidate) => {
    const direct = candidate.sourceHints.some((hint) =>
      source.sourceHintRoutes.includes(hint),
    );
    const routed = candidateLaneIds(candidate).some((laneId) =>
      laneIds.includes(laneId),
    );
    return direct || routed;
  })
    .map((candidate) => candidate.id)
    .sort(compareCodepoints);

  const core = {
    format: ASOIAF_EXTERNAL_HARVEST_WORK_ORDER_FORMAT,
    id: `asoiaf-external-harvest:${source.id}`,
    sourceId: source.id,
    sourceFingerprint: asoiafExternalSourceFingerprint(source),
    laneIds,
    sourceHintIds: orderedStrings(source.sourceHintRoutes),
    candidateIds,
    collectionSteps: collectionSteps(source),
    reviewActions: [
      "confirm",
      "correct",
      "split",
      "merge",
      "reject",
      "defer",
    ] as AsoiafExternalHarvestWorkOrder["reviewActions"],
    receiptRequirements: [
      "durable-source-record-identifier",
      "retrieval-timestamp",
      "upstream-content-sha256",
      "normalized-record-sha256",
      "rights-and-retention-decision",
      "source-specific-locator",
      "reviewer-identity-before-promotion",
    ],
    promotionForbiddenUntil: [
      "source-identity-resolved",
      "continuity-resolved",
      "rights-mode-satisfied",
      "claim-level-receipts-attached",
      "human-review-recorded",
      "reconciliation-transaction-passes",
    ],
  };
  return {
    ...core,
    workOrderFingerprint: narrativeFingerprint(core),
  };
}

function emptyPlaneCounts(): Record<AsoiafExternalSourcePlane, number> {
  return {
    "local-primary": 0,
    "official-author": 0,
    "official-adaptation": 0,
    "publisher-reference": 0,
    "structured-tool": 0,
    "community-reference": 0,
    "community-analysis": 0,
    discussion: 0,
    scholarly: 0,
    archive: 0,
    discovery: 0,
  };
}

function emptyAuthorityCounts(): Record<AsoiafExternalAuthorityClass, number> {
  return {
    "primary-text": 0,
    "companion-text": 0,
    "released-author-text": 0,
    "author-statement": 0,
    "adaptation-canon": 0,
    "production-testimony": 0,
    "licensed-reference": 0,
    "official-bibliography": 0,
    "structured-dataset": 0,
    "community-reference": 0,
    "community-analysis": 0,
    "discussion-provenance": 0,
    "scholarly-analogue": 0,
    "archival-custody": 0,
    "discovery-only": 0,
  };
}

export function buildAsoiafExternalAtlas(
  inputSources: readonly AsoiafExternalSource[] = ASOIAF_EXTERNAL_SOURCES,
  inputLanes: readonly AsoiafExternalQueryLane[] = ASOIAF_EXTERNAL_QUERY_LANES,
): {
  sources: AsoiafExternalSource[];
  lanes: AsoiafExternalQueryLane[];
  workOrders: AsoiafExternalHarvestWorkOrder[];
  manifest: AsoiafExternalAtlasManifest;
} {
  const sources = inputSources
    .map(canonicalAsoiafExternalSource)
    .sort((left, right) => compareCodepoints(left.id, right.id));
  const lanes = inputLanes
    .map(canonicalAsoiafExternalQueryLane)
    .sort((left, right) => compareCodepoints(left.id, right.id));
  const workOrders = sources
    .map((entry) => buildWorkOrder(entry, lanes))
    .sort((left, right) => compareCodepoints(left.id, right.id));
  const countsByPlane = emptyPlaneCounts();
  const countsByAuthority = emptyAuthorityCounts();
  for (const entry of sources) {
    countsByPlane[entry.sourcePlane] += 1;
    countsByAuthority[entry.authorityClass] += 1;
  }
  const routedCandidates = new Set(
    workOrders.flatMap((workOrder) => workOrder.candidateIds),
  );
  const sourceLaneEdgeCount = sources.reduce(
    (sum, entry) => sum + sourceLaneIds(entry, lanes).length,
    0,
  );
  const core = {
    format: ASOIAF_EXTERNAL_ATLAS_MANIFEST_FORMAT,
    universeId: "asoiaf" as const,
    sourceIds: sources.map((entry) => entry.id),
    laneIds: lanes.map((entry) => entry.id),
    workOrderIds: workOrders.map((entry) => entry.id),
    authorityClasses: [...AUTHORITY_CLASSES].sort(compareCodepoints),
    sourceCount: sources.length,
    laneCount: lanes.length,
    workOrderCount: workOrders.length,
    sourceLaneEdgeCount,
    heldCandidateCount: ASOIAF_RECALL_ESTATE_MANIFEST.candidateCount,
    routedCandidateCount: routedCandidates.size,
    countsByPlane,
    countsByAuthority,
    sourceFingerprints: sources.map((entry) => ({
      sourceId: entry.id,
      fingerprint: asoiafExternalSourceFingerprint(entry),
    })),
    laneFingerprints: lanes.map((entry) => ({
      laneId: entry.id,
      fingerprint: asoiafExternalLaneFingerprint(entry),
    })),
    workOrderFingerprints: workOrders.map((entry) => ({
      workOrderId: entry.id,
      fingerprint: entry.workOrderFingerprint,
    })),
  };
  const {
    sourceFingerprints: _sourceFingerprints,
    laneFingerprints: _laneFingerprints,
    workOrderFingerprints: _workOrderFingerprints,
    ...manifestCore
  } = core;
  return {
    sources,
    lanes,
    workOrders,
    manifest: {
      ...manifestCore,
      atlasFingerprint: narrativeFingerprint(core),
    },
  };
}

const BUILT_ATLAS = buildAsoiafExternalAtlas();

export const ASOIAF_EXTERNAL_ATLAS_SOURCES = BUILT_ATLAS.sources;
export const ASOIAF_EXTERNAL_ATLAS_LANES = BUILT_ATLAS.lanes;
export const ASOIAF_EXTERNAL_HARVEST_WORK_ORDERS = BUILT_ATLAS.workOrders;
export const ASOIAF_EXTERNAL_ATLAS_MANIFEST = BUILT_ATLAS.manifest;

function normalizedText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function routeLaneScores(request: AsoiafExternalRouteRequest): Map<AsoiafExternalRole, number> {
  const scores = new Map<AsoiafExternalRole, number>();
  const text = normalizedText(request.text);
  for (const lane of ASOIAF_EXTERNAL_ATLAS_LANES) {
    let score = request.laneIds?.includes(lane.id) ? 1_000 : 0;
    const idText = normalizedText(lane.id);
    if (text.includes(idText)) score += 200;
    for (const alias of lane.aliases) {
      const normalizedAlias = normalizedText(alias);
      if (normalizedAlias && text.includes(normalizedAlias)) {
        score += Math.max(20, normalizedAlias.length * 4);
      }
    }
    if (score > 0) scores.set(lane.id, score);
  }
  if (scores.size === 0) scores.set("entity-resolution", 1);
  return scores;
}

export function routeAsoiafExternalQuestion(
  request: AsoiafExternalRouteRequest,
): AsoiafExternalRouteResult {
  const laneScores = routeLaneScores(request);
  const selectedLanes = ASOIAF_EXTERNAL_ATLAS_LANES.filter((lane) =>
    laneScores.has(lane.id),
  ).sort(
    (left, right) =>
      (laneScores.get(right.id) ?? 0) - (laneScores.get(left.id) ?? 0)
      || compareCodepoints(left.id, right.id),
  );
  const sources: AsoiafExternalRouteSource[] = [];
  for (const entry of ASOIAF_EXTERNAL_ATLAS_SOURCES) {
    let score = 0;
    const reasons: string[] = [];
    for (const lane of selectedLanes) {
      const laneScore = laneScores.get(lane.id) ?? 0;
      if (entry.roles.includes(lane.id)) {
        score += laneScore + 80;
        reasons.push(`role:${lane.id}`);
      }
      if (lane.preferredSourceIds.includes(entry.id)) {
        score += laneScore + 250;
        reasons.push(`preferred:${lane.id}`);
      }
      if (lane.preferredAuthorityClasses.includes(entry.authorityClass)) {
        score += Math.max(10, Math.floor(laneScore / 2));
        reasons.push(`preferred-authority:${lane.id}`);
      } else if (lane.supportingAuthorityClasses.includes(entry.authorityClass)) {
        score += Math.max(5, Math.floor(laneScore / 5));
        reasons.push(`supporting-authority:${lane.id}`);
      }
    }
    if (request.continuityIds?.length) {
      if (
        request.continuityIds.some((continuity) =>
          entry.continuityIds.includes(continuity),
        )
      ) {
        score += 120;
        reasons.push("continuity-match");
      } else {
        score -= 100;
      }
    }
    if (score > 0) {
      sources.push({
        sourceId: entry.id,
        score,
        reasons: orderedStrings([...new Set(reasons)]),
      });
    }
  }
  sources.sort(
    (left, right) =>
      right.score - left.score || compareCodepoints(left.sourceId, right.sourceId),
  );
  const core = {
    request: {
      ...request,
      continuityIds: request.continuityIds
        ? orderedStrings(request.continuityIds)
        : undefined,
      laneIds: request.laneIds
        ? (orderedStrings(request.laneIds) as AsoiafExternalRole[])
        : undefined,
    },
    laneIds: selectedLanes.map((lane) => lane.id),
    sources: sources.slice(0, request.limit ?? 12),
    responsePolicies: selectedLanes.map((lane) => lane.responsePolicy),
  };
  return {
    ...core,
    routeFingerprint: narrativeFingerprint(core),
  };
}

export function getAsoiafExternalSource(
  sourceId: string,
): AsoiafExternalSource | undefined {
  return ASOIAF_EXTERNAL_ATLAS_SOURCES.find((entry) => entry.id === sourceId);
}

export function getAsoiafExternalLane(
  laneId: AsoiafExternalRole,
): AsoiafExternalQueryLane | undefined {
  return ASOIAF_EXTERNAL_ATLAS_LANES.find((entry) => entry.id === laneId);
}

export function getAsoiafExternalWorkOrder(
  sourceId: string,
): AsoiafExternalHarvestWorkOrder | undefined {
  return ASOIAF_EXTERNAL_HARVEST_WORK_ORDERS.find(
    (entry) => entry.sourceId === sourceId,
  );
}

export { AUTHORITY_CLASSES as ASOIAF_EXTERNAL_AUTHORITY_CLASSES };
export { SOURCE_PLANES as ASOIAF_EXTERNAL_SOURCE_PLANES };
