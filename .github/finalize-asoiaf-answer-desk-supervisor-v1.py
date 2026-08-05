from pathlib import Path

core_path = Path("tools/lib/asoiaf-answer-desk-supervisor.ts")
text = core_path.read_text(encoding="utf-8")

operation_old = """function operationReference(
  kind: AsoiafAnswerSupervisorOperationReference[\"kind\"],
  objectId: string,
  fingerprint: `sha256:${string}`,
  uri: string | null,
): AsoiafAnswerSupervisorOperationReference {
  return { kind, objectId, fingerprint, uri };
}
"""
operation_new = """function operationReference(
  kind: AsoiafAnswerSupervisorOperationReference[\"kind\"],
  objectId: string,
  fingerprint: string,
  uri: string | null,
): AsoiafAnswerSupervisorOperationReference {
  if (!validFingerprint(fingerprint)) {
    throw new Error(`answer supervisor operation reference ${objectId} has an invalid fingerprint`);
  }
  return {
    kind,
    objectId,
    fingerprint: fingerprint as `sha256:${string}`,
    uri,
  };
}
"""
if operation_old not in text:
    raise SystemExit("cannot locate exact operation-reference type boundary")
text = text.replace(operation_old, operation_new, 1)

projection_field_old = """  automaticDisabledItemIds: string[];
  decision: AsoiafAnswerSupervisorDecision;
"""
projection_field_new = """  automaticDisabledItemIds: string[];
  dependencyBlockedItemIds: string[];
  decision: AsoiafAnswerSupervisorDecision;
"""
if projection_field_old not in text:
    raise SystemExit("cannot locate supervisor projection blocked-item fields")
text = text.replace(projection_field_old, projection_field_new, 1)

selection_head_old = """  automaticDisabledItemIds: string[];
} {
  const unboundExternalItemIds: string[] = [];
  const saturatedExternalItemIds: string[] = [];
  const automaticDisabledItemIds: string[] = [];

  for (const assignment of input.workerPlan.assignments) {
    if (assignment.deskStatus !== \"available\") continue;
"""
selection_head_new = """  automaticDisabledItemIds: string[];
  dependencyBlockedItemIds: string[];
} {
  const unboundExternalItemIds: string[] = [];
  const saturatedExternalItemIds: string[] = [];
  const automaticDisabledItemIds: string[] = [];
  const dependencyBlockedItemIds: string[] = [];
  const assignmentsById = new Map(
    input.workerPlan.assignments.map((assignment) => [assignment.itemId, assignment] as const),
  );

  for (const assignment of input.workerPlan.assignments) {
    if (assignment.deskStatus !== \"available\") continue;
    const dependenciesSatisfied = assignment.dependencyItemIds.every(
      (dependencyItemId) => {
        const dependency = assignmentsById.get(dependencyItemId);
        return Boolean(
          dependency
          && (
            dependency.itemStatus === \"satisfied\"
            || dependency.itemStatus === \"preserved-as-limitation\"
          )
        );
      },
    );
    if (!dependenciesSatisfied) {
      dependencyBlockedItemIds.push(assignment.itemId);
      continue;
    }
"""
if selection_head_old not in text:
    raise SystemExit("cannot locate supervisor selection initialization")
text = text.replace(selection_head_old, selection_head_new, 1)

selection_start = text.index("function selectDecision(")
selection_end = text.index("\nfunction projectionCore(", selection_start)
selection = text[selection_start:selection_end]
patched_lines: list[str] = []
return_insertions = 0
for line in selection.splitlines(keepends=True):
    patched_lines.append(line)
    if line.strip() == "automaticDisabledItemIds,":
        indent = line[: len(line) - len(line.lstrip())]
        patched_lines.append(f"{indent}dependencyBlockedItemIds,\n")
        return_insertions += 1
if return_insertions != 7:
    raise SystemExit(f"expected seven supervisor selection returns, found {return_insertions}")
text = text[:selection_start] + "".join(patched_lines) + text[selection_end:]

projection_build_old = """    automaticDisabledItemIds: selected.automaticDisabledItemIds,
    decision: selected.decision,
"""
projection_build_new = """    automaticDisabledItemIds: selected.automaticDisabledItemIds,
    dependencyBlockedItemIds: selected.dependencyBlockedItemIds,
    decision: selected.decision,
"""
if projection_build_old not in text:
    raise SystemExit("cannot locate supervisor projection selection fields")
text = text.replace(projection_build_old, projection_build_new, 1)

projection_validation_old = """    || JSON.stringify(projection.automaticDisabledItemIds)
      !== JSON.stringify(selected.automaticDisabledItemIds)
    || JSON.stringify(projection.automaticAvailableItemIds)
"""
projection_validation_new = """    || JSON.stringify(projection.automaticDisabledItemIds)
      !== JSON.stringify(selected.automaticDisabledItemIds)
    || JSON.stringify(projection.dependencyBlockedItemIds)
      !== JSON.stringify(selected.dependencyBlockedItemIds)
    || JSON.stringify(projection.automaticAvailableItemIds)
"""
if projection_validation_old not in text:
    raise SystemExit("cannot locate supervisor projection selection validation")
text = text.replace(projection_validation_old, projection_validation_new, 1)
core_path.write_text(text, encoding="utf-8")

test_path = Path("tests/narrative/canon/asoiaf-answer-desk-supervisor.test.ts")
test_text = test_path.read_text(encoding="utf-8")
test_old = """    expect(closeTick.run.action).toBe(\"close-gap\");
    const closeAssignment = closeTick.externalIssue!.assignment;
"""
test_new = """    expect(closeTick.run.action).toBe(\"close-gap\");
    expect(closeTick.intent.beforeProjection.dependencyBlockedItemIds).toContain(
      item(fixture.reconciledWorkOrder, \"assemble-reviewed-answer\").itemId,
    );
    const closeAssignment = closeTick.externalIssue!.assignment;
"""
if test_old not in test_text:
    raise SystemExit("cannot locate supervisor rotation dependency assertion")
test_text = test_text.replace(test_old, test_new, 1)

import_anchor = """import {
  buildAsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkItem,
  type AsoiafAnswerWorkOrder,
} from \"../../../tools/lib/asoiaf-answer-work-order.js\";
"""
if import_anchor not in test_text:
    type_only_anchor = """import type {
  AsoiafAnswerWorkAction,
  AsoiafAnswerWorkItem,
  AsoiafAnswerWorkOrder,
} from \"../../../tools/lib/asoiaf-answer-work-order.js\";
"""
    import_replacement = """import {
  buildAsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkAction,
  type AsoiafAnswerWorkItem,
  type AsoiafAnswerWorkOrder,
} from \"../../../tools/lib/asoiaf-answer-work-order.js\";
import {
  buildAsoiafResearchQuestionDossier,
} from \"../../../tools/lib/asoiaf-research-question-dossier.js\";
"""
    if type_only_anchor not in test_text:
        raise SystemExit("cannot locate supervisor work-order test import")
    test_text = test_text.replace(type_only_anchor, import_replacement, 1)

helper_anchor = """function adoptReady(root: string) {
  const fixture = buildAsoiafAnswerDeskFixture();
  adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder: fixture.readyWorkOrder,
    adoptedAt: \"2026-08-05T06:40:01.000Z\",
    operatorId: \"operator:supervisor-ready\",
  });
  return fixture;
}

"""
helper_replacement = helper_anchor + """function adoptDoubleReview(root: string): AsoiafAnswerWorkOrder {
  const dossier = buildAsoiafResearchQuestionDossier({
    questionText:
      \"Which two exact holder-controlled passages require independent locator review?\",
    createdBy: \"researcher:supervisor-double-review\",
    createdAt: \"2026-08-05T06:10:00.000Z\",
    laneIds: [\"entity-resolution\"],
    continuityIds: [\"book-main\"],
    privateReferences: [
      {
        sourceId: \"local-agot\",
        editionKey: \"supervisor-double-review-edition\",
        continuityId: \"book-main\",
        unitId: \"supervisor-double-review-unit\",
        paragraphId: \"supervisor-double-review-a\",
        locator:
          \"local-agot/supervisor-double-review-edition/supervisor-double-review-unit/supervisor-double-review-a\",
        paragraphDigest:
          \"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",
        queryMode: \"phrase\",
        matchedTerms: [\"first\", \"passage\"],
        tokenPositions: [1, 5],
        snippetDigest: null,
        snippetCharacters: null,
      },
      {
        sourceId: \"local-agot\",
        editionKey: \"supervisor-double-review-edition\",
        continuityId: \"book-main\",
        unitId: \"supervisor-double-review-unit\",
        paragraphId: \"supervisor-double-review-b\",
        locator:
          \"local-agot/supervisor-double-review-edition/supervisor-double-review-unit/supervisor-double-review-b\",
        paragraphDigest:
          \"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",
        queryMode: \"phrase\",
        matchedTerms: [\"second\", \"passage\"],
        tokenPositions: [2, 8],
        snippetDigest: null,
        snippetCharacters: null,
      },
    ],
    gaps: [],
  });
  const workOrder = buildAsoiafAnswerWorkOrder({
    dossier,
    createdBy: \"operator:supervisor-double-review-order\",
    createdAt: \"2026-08-05T06:20:00.000Z\",
    transactions: [],
    answerPacket: null,
  });
  adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder,
    adoptedAt: \"2026-08-05T06:20:01.000Z\",
    operatorId: \"operator:supervisor-double-review-adopt\",
  });
  return workOrder;
}

"""
if helper_anchor not in test_text:
    raise SystemExit("cannot locate supervisor ready-adoption helper")
test_text = test_text.replace(helper_anchor, helper_replacement, 1)

fanout_start_marker = (
    '  it("fans out independent external work and exposes actor saturation without over-claiming", () => {\n'
)
fanout_end_marker = (
    '\n  it("runs and replays the bounded automatic renderer from an answer-ready desk", () => {\n'
)
if test_text.count(fanout_start_marker) != 1 or test_text.count(fanout_end_marker) != 1:
    raise SystemExit("cannot locate supervisor fanout test boundaries")
fanout_start = test_text.index(fanout_start_marker)
fanout_end = test_text.index(fanout_end_marker, fanout_start)
fanout_new = """  it("fans out independent external work and waits without over-claiming", () => {
  const root = estateRoot();
  adoptOpen(root);
  const currentPolicy = policy({ includeReconcile: true, includeAssembler: false });
  const review = tickAsoiafAnswerDeskSupervisor(tickInput({
    root,
    policy: currentPolicy,
    requestKey: "request:fanout-review",
    requestedAt: "2026-08-05T06:21:00.000Z",
  }));
  const reconcile = tickAsoiafAnswerDeskSupervisor(tickInput({
    root,
    policy: currentPolicy,
    requestKey: "request:fanout-reconcile",
    requestedAt: "2026-08-05T06:21:01.000Z",
  }));
  const wait = tickAsoiafAnswerDeskSupervisor(tickInput({
    root,
    policy: currentPolicy,
    requestKey: "request:fanout-wait",
    requestedAt: "2026-08-05T06:21:02.000Z",
  }));

  expect(review.run.outcome).toBe("external-issued");
  expect(review.run.action).toBe("review-exact-locator");
  expect(reconcile.run.outcome).toBe("external-issued");
  expect(reconcile.run.action).toBe("reconcile-candidate");
  expect(wait.run.outcome).toBe("waiting-external");
  expect(wait.intent.decision.kind).toBe("wait-external");
  expect(wait.intent.beforeProjection.activeExternalAssignments).toHaveLength(2);
  expect(wait.run.leaseId).toBeNull();
  expect(wait.run.operationReferences).toEqual([]);
  expect(readAsoiafAnswerDeskStatus(root).leases).toHaveLength(2);
  expect(readAsoiafAnswerExchangeStatus(root).assignments).toHaveLength(2);
  expect(readAsoiafAnswerSupervisorStatus(root).runs).toHaveLength(3);
});

it("exposes actor saturation while independent dependency-ready work remains", () => {
  const root = estateRoot();
  const workOrder = adoptDoubleReview(root);
  const currentPolicy = policy({ includeAssembler: false });
  const first = tickAsoiafAnswerDeskSupervisor(tickInput({
    root,
    policy: currentPolicy,
    requestKey: "request:saturation-first",
    requestedAt: "2026-08-05T06:21:00.000Z",
  }));
  const saturated = tickAsoiafAnswerDeskSupervisor(tickInput({
    root,
    policy: currentPolicy,
    requestKey: "request:saturation-second",
    requestedAt: "2026-08-05T06:21:01.000Z",
  }));

  expect(
    workOrder.items.filter((entry) => entry.action === "review-exact-locator"),
  ).toHaveLength(2);
  expect(first.run.outcome).toBe("external-issued");
  expect(first.run.action).toBe("review-exact-locator");
  expect(saturated.run.outcome).toBe("saturated-external");
  expect(saturated.intent.decision.kind).toBe("saturated-external");
  expect(saturated.intent.beforeProjection.saturatedExternalItemIds).toHaveLength(1);
  expect(saturated.run.leaseId).toBeNull();
  expect(saturated.run.operationReferences).toEqual([]);
  expect(readAsoiafAnswerDeskStatus(root).leases).toHaveLength(1);
  expect(readAsoiafAnswerExchangeStatus(root).assignments).toHaveLength(1);
  expect(readAsoiafAnswerSupervisorStatus(root).runs).toHaveLength(2);
});
"""
test_text = test_text[:fanout_start] + fanout_new + test_text[fanout_end:]
test_path.write_text(test_text, encoding="utf-8")

doc_path = Path("docs/ASOIAF_ANSWER_DESK_SUPERVISOR.md")
doc = doc_path.read_text(encoding="utf-8")
replacements = [
    (
        "work-order-first selection law",
        "dependency-ready work-order-first selection law",
    ),
    (
        "Selection follows the work-order assignment order. The supervisor scans current `available` assignments and applies the following rules:",
        "Selection follows the work-order assignment order after dependency readiness. The supervisor scans current `available` assignments, skips any item whose named dependencies are not `satisfied` or `preserved-as-limitation`, and applies the following rules:",
    ),
    (
        "```text\nautomatic and eligible + automatic enabled  -> run-automatic",
        "```text\navailable + unmet named dependency           -> dependency-blocked and skipped\nautomatic and eligible + automatic enabled  -> run-automatic",
    ),
    (
        "The scan may skip an earlier unbound or saturated assignment and dispatch a later independent assignment with a valid actor slot.",
        "The scan may skip an earlier dependency-blocked, unbound, or saturated assignment and dispatch a later independent assignment with a valid actor slot.",
    ),
    (
        "The projection retains the exact policy, worker plan, active assignment references, actor loads, blocked item classes, selected decision, and a content-derived identity.",
        "The projection retains the exact policy, worker plan, active assignment references, actor loads, dependency-blocked and access-or-capacity-blocked item classes, selected decision, and a content-derived identity.",
    ),
]
for old, new in replacements:
    if old not in doc:
        raise SystemExit(f"cannot locate supervisor documentation boundary: {old}")
    doc = doc.replace(old, new, 1)
doc_path.write_text(doc, encoding="utf-8")
