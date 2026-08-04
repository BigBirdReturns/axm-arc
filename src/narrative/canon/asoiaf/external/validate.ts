import { compareCodepoints } from "../../../../engine/determinism.js";
import { ASOIAF_RECALL_SOURCE_HINTS } from "../recall/index.js";
import { ASOIAF_EXTERNAL_PROVENANCE_LINEAGE } from "./lineage.js";
import type {
  AsoiafExternalAtlasManifest,
  AsoiafExternalFinding,
  AsoiafExternalHarvestWorkOrder,
  AsoiafExternalQueryLane,
  AsoiafExternalSource,
} from "./types.js";

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort(compareCodepoints);
}

export function validateAsoiafExternalAtlas(input: {
  sources: readonly AsoiafExternalSource[];
  lanes: readonly AsoiafExternalQueryLane[];
  workOrders: readonly AsoiafExternalHarvestWorkOrder[];
  manifest: AsoiafExternalAtlasManifest;
}): AsoiafExternalFinding[] {
  const findings: AsoiafExternalFinding[] = [];
  const sourceIds = new Set(input.sources.map((source) => source.id));
  const laneIds = new Set(input.lanes.map((lane) => lane.id));
  const hintIds = new Set(ASOIAF_RECALL_SOURCE_HINTS.map((hint) => hint.id));

  for (const id of duplicates(input.sources.map((source) => source.id))) {
    findings.push({
      code: "duplicate-source-id",
      severity: "error",
      subjectId: id,
      detail: "External source IDs must be unique.",
    });
  }
  for (const uri of duplicates(input.sources.map((source) => source.canonicalUri))) {
    findings.push({
      code: "shared-canonical-route",
      severity: "warning",
      subjectId: uri,
      detail:
        "Multiple bounded source identities share one landing route; collection must resolve a source-specific durable record identifier.",
    });
  }
  for (const id of duplicates(input.lanes.map((lane) => lane.id))) {
    findings.push({
      code: "duplicate-lane-id",
      severity: "error",
      subjectId: id,
      detail: "Question-routing lane IDs must be unique.",
    });
  }
  for (const id of duplicates(input.workOrders.map((workOrder) => workOrder.id))) {
    findings.push({
      code: "duplicate-work-order-id",
      severity: "error",
      subjectId: id,
      detail: "Harvest work-order IDs must be unique.",
    });
  }

  for (const source of input.sources) {
    if (!source.accessMethods.length) {
      findings.push({
        code: "source-without-access-method",
        severity: "error",
        subjectId: source.id,
        detail: "Every source requires at least one bounded access method.",
      });
    }
    if (!source.roles.length) {
      findings.push({
        code: "source-without-routing-role",
        severity: "error",
        subjectId: source.id,
        detail: "Every source must disclose at least one routing role.",
      });
    }
    for (const hintId of source.sourceHintRoutes) {
      if (!hintIds.has(hintId)) {
        findings.push({
          code: "unknown-source-hint-route",
          severity: "error",
          subjectId: source.id,
          detail: `Unknown recall source hint ${hintId}.`,
        });
      }
    }
    const local = source.sourcePlane === "local-primary";
    if (local && source.harvestPolicy.mode !== "local-private-only") {
      findings.push({
        code: "local-source-public-harvest",
        severity: "error",
        subjectId: source.id,
        detail: "User-held source bytes must remain in local-private-only custody.",
      });
    }
    if (local && source.rightsMode !== "user-controlled-private") {
      findings.push({
        code: "local-source-rights-mismatch",
        severity: "error",
        subjectId: source.id,
        detail: "User-held exact editions require user-controlled-private rights mode.",
      });
    }
    if (
      source.harvestPolicy.retainRawBody
      && !["cc0", "cc-by", "cc-by-sa", "public-domain"].includes(
        source.rightsMode,
      )
    ) {
      findings.push({
        code: "raw-body-without-compatible-rights",
        severity: "error",
        subjectId: source.id,
        detail:
          "Raw public bodies may be retained only under an explicit compatible license or public-domain status.",
      });
    }
    if (
      source.harvestPolicy.mode === "route-only-no-mirror"
      && (source.harvestPolicy.retainRawBody || source.harvestPolicy.excerptMaxChars > 0)
    ) {
      findings.push({
        code: "route-only-retention",
        severity: "error",
        subjectId: source.id,
        detail: "Route-only sources cannot retain bodies or excerpts.",
      });
    }
    if (source.harvestPolicy.hostDelayMs < 1_500 && !local) {
      findings.push({
        code: "host-delay-below-undercast-floor",
        severity: "error",
        subjectId: source.id,
        detail: "Network collection inherits the UnderCast 1,500 ms host-delay floor.",
      });
    }
    if (!source.harvestPolicy.robotsRespect) {
      findings.push({
        code: "robots-policy-disabled",
        severity: "error",
        subjectId: source.id,
        detail: "Every source work order must respect robots policy.",
      });
    }
  }

  for (const lane of input.lanes) {
    for (const sourceId of lane.preferredSourceIds) {
      if (!sourceIds.has(sourceId)) {
        findings.push({
          code: "lane-preferred-source-missing",
          severity: "error",
          subjectId: lane.id,
          detail: `Preferred source ${sourceId} does not exist.`,
        });
      }
    }
    const eligible = input.sources.filter(
      (source) =>
        source.roles.includes(lane.id)
        || lane.preferredSourceIds.includes(source.id),
    );
    if (!eligible.length) {
      findings.push({
        code: "lane-without-source",
        severity: "error",
        subjectId: lane.id,
        detail: "Every routing lane requires at least one eligible source.",
      });
    }
    if (
      lane.id === "exact-quotation"
      && lane.responsePolicy.verbatimHandling !== "exact-local-locator"
    ) {
      findings.push({
        code: "quotation-policy-can-mirror",
        severity: "error",
        subjectId: lane.id,
        detail: "Exact quotation must resolve through exact local locators.",
      });
    }
    if (
      lane.preferredAuthorityClasses.some((authority) =>
        ["community-reference", "community-analysis"].includes(authority),
      )
      && lane.responsePolicy.communityStanding !== "supporting-only"
    ) {
      findings.push({
        code: "community-standing-too-high",
        severity: "error",
        subjectId: lane.id,
        detail: "Community sources remain supporting authority only.",
      });
    }
    if (
      lane.preferredAuthorityClasses.includes("discussion-provenance")
      && lane.responsePolicy.communityStanding !== "provenance-only"
    ) {
      findings.push({
        code: "discussion-standing-too-high",
        severity: "error",
        subjectId: lane.id,
        detail: "Discussion sources may establish provenance, not fictional events.",
      });
    }
    if (
      lane.preferredAuthorityClasses.includes("scholarly-analogue")
      && lane.responsePolicy.analogueStanding !== "constraint-only"
    ) {
      findings.push({
        code: "analogue-standing-too-high",
        severity: "error",
        subjectId: lane.id,
        detail: "Scholarly analogues constrain hypotheses and do not create canon.",
      });
    }
  }

  const workOrderBySource = new Map(
    input.workOrders.map((workOrder) => [workOrder.sourceId, workOrder]),
  );
  for (const source of input.sources) {
    const workOrder = workOrderBySource.get(source.id);
    if (!workOrder) {
      findings.push({
        code: "source-without-work-order",
        severity: "error",
        subjectId: source.id,
        detail: "Every registered source requires one deterministic work order.",
      });
      continue;
    }
    for (const laneId of workOrder.laneIds) {
      if (!laneIds.has(laneId)) {
        findings.push({
          code: "work-order-unknown-lane",
          severity: "error",
          subjectId: workOrder.id,
          detail: `Unknown lane ${laneId}.`,
        });
      }
    }
    for (const required of [
      "claim-level-receipts-attached",
      "human-review-recorded",
      "reconciliation-transaction-passes",
    ]) {
      if (!workOrder.promotionForbiddenUntil.includes(required)) {
        findings.push({
          code: "promotion-firewall-incomplete",
          severity: "error",
          subjectId: workOrder.id,
          detail: `Missing promotion condition ${required}.`,
        });
      }
    }
  }
  for (const workOrder of input.workOrders) {
    if (!sourceIds.has(workOrder.sourceId)) {
      findings.push({
        code: "orphan-work-order",
        severity: "error",
        subjectId: workOrder.id,
        detail: `Unknown source ${workOrder.sourceId}.`,
      });
    }
  }

  if (input.manifest.sourceCount !== input.sources.length) {
    findings.push({
      code: "manifest-source-count-drift",
      severity: "error",
      subjectId: input.manifest.atlasFingerprint,
      detail: "Manifest source count does not match the source registry.",
    });
  }
  if (input.manifest.laneCount !== input.lanes.length) {
    findings.push({
      code: "manifest-lane-count-drift",
      severity: "error",
      subjectId: input.manifest.atlasFingerprint,
      detail: "Manifest lane count does not match the query router.",
    });
  }
  if (input.manifest.workOrderCount !== input.workOrders.length) {
    findings.push({
      code: "manifest-work-order-count-drift",
      severity: "error",
      subjectId: input.manifest.atlasFingerprint,
      detail: "Manifest work-order count does not match the work-order estate.",
    });
  }
  if (input.manifest.routedCandidateCount !== input.manifest.heldCandidateCount) {
    findings.push({
      code: "held-candidate-routing-gap",
      severity: "error",
      subjectId: input.manifest.atlasFingerprint,
      detail: `${input.manifest.heldCandidateCount - input.manifest.routedCandidateCount} held candidates have no external-source work-order route.`,
    });
  }
  if (input.manifest.authorityClasses.length !== 15) {
    findings.push({
      code: "authority-class-count-drift",
      severity: "error",
      subjectId: input.manifest.atlasFingerprint,
      detail: "The authority matrix must retain all 15 distinct authority classes.",
    });
  }

  if (
    ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.defaultCollectionPolicy.hostDelayMs
    !== 1_500
    || ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.defaultCollectionPolicy.concurrency
      !== 1
    || ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.defaultCollectionPolicy.graphEffect
      !== "none"
    || ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.defaultCollectionPolicy.canonEffect
      !== "none"
  ) {
    findings.push({
      code: "provenance-lineage-drift",
      severity: "error",
      subjectId: "asoiaf-external-provenance-lineage",
      detail: "Clifford Number and UnderCast collection invariants have drifted.",
    });
  }

  return findings.sort(
    (left, right) =>
      compareCodepoints(left.severity, right.severity)
      || compareCodepoints(left.code, right.code)
      || compareCodepoints(left.subjectId, right.subjectId),
  );
}
