import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildAsoiafAnswerDeskFixture,
} from "../../fixtures/asoiaf-answer-desk-fixture.js";
import {
  adoptAsoiafAnswerDeskWorkOrder,
  readAsoiafAnswerDeskStatus,
} from "../../../tools/lib/asoiaf-answer-desk-estate.js";
import {
  renderAsoiafReviewedAnswerPacket,
} from "../../../tools/lib/asoiaf-reviewed-answer-packet.js";
import {
  ASOIAF_REVIEWED_RENDER_WORKER_ID,
  asoiafAnswerDeskWorkerPaths,
  buildAsoiafAnswerWorkerManifest,
  planAsoiafAnswerDeskWorkers,
  readAsoiafAnswerDeskWorkerStatus,
  runAsoiafAnswerDeskWorker,
  validateAsoiafAnswerWorkerManifest,
  validateAsoiafAnswerWorkerPlan,
  verifyAsoiafAnswerDeskWorkerEstate,
  type AsoiafAnswerDeskWorkerRunInput,
} from "../../../tools/lib/asoiaf-answer-desk-worker.js";

const roots: string[] = [];

function estateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-answer-worker-"));
  roots.push(root);
  return root;
}

function adoptOpen(root: string) {
  const fixture = buildAsoiafAnswerDeskFixture();
  adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder: fixture.openWorkOrder,
    adoptedAt: "2026-08-05T06:20:01.000Z",
    operatorId: "operator:worker-open",
  });
  return fixture;
}

function adoptReady(root: string) {
  const fixture = buildAsoiafAnswerDeskFixture();
  adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder: fixture.readyWorkOrder,
    adoptedAt: "2026-08-05T06:40:01.000Z",
    operatorId: "operator:worker-ready",
  });
  return fixture;
}

function runInput(root: string): AsoiafAnswerDeskWorkerRunInput {
  return {
    root,
    claimedAt: "2026-08-05T06:41:10.000Z",
    requestedAt: "2026-08-05T06:41:11.000Z",
    completedAt: "2026-08-05T06:41:20.000Z",
    leaseMilliseconds: 60_000,
    operatorId: "operator:worker-run",
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF persistent answer desk worker", () => {
  it("publishes one deterministic render-only worker and explicit external actors for every other action", () => {
    const first = buildAsoiafAnswerWorkerManifest();
    const second = buildAsoiafAnswerWorkerManifest();

    expect(second).toEqual(first);
    expect(validateAsoiafAnswerWorkerManifest(first)).toEqual([]);
    expect(first.workerId).toBe(ASOIAF_REVIEWED_RENDER_WORKER_ID);
    expect(first.automaticActions).toEqual(["render-reviewed-answer"]);
    expect(first.capabilities).toHaveLength(12);
    expect(
      first.capabilities.filter((entry) => entry.executionMode === "automatic"),
    ).toEqual([
      expect.objectContaining({
        action: "render-reviewed-answer",
        workerId: ASOIAF_REVIEWED_RENDER_WORKER_ID,
        requiredActor: "reviewed-renderer",
        networkAccess: "none",
        privateTextAccess: "none",
        humanReview: "none",
      }),
    ]);
    expect(
      first.capabilities
        .filter((entry) => entry.action !== "render-reviewed-answer")
        .every(
          (entry) =>
            entry.executionMode === "external-required"
            && entry.workerId === null,
        ),
    ).toBe(true);
    expect(
      first.capabilities.find((entry) => entry.action === "acquire-public-record"),
    ).toEqual(
      expect.objectContaining({
        requiredActor: "network-collector",
        networkAccess: "required",
      }),
    );
    expect(
      first.capabilities.find((entry) => entry.action === "review-exact-locator"),
    ).toEqual(
      expect.objectContaining({
        requiredActor: "exact-locator-reviewer",
        privateTextAccess: "required",
        humanReview: "required",
      }),
    );
  });

  it("projects external work from an open desk and refuses to claim it as automatic work", () => {
    const root = estateRoot();
    adoptOpen(root);

    const plan = planAsoiafAnswerDeskWorkers(root);
    expect(validateAsoiafAnswerWorkerPlan(plan, root)).toEqual([]);
    expect(plan.nextAutomaticItemId).toBeNull();
    expect(plan.automaticAvailableItemIds).toEqual([]);
    expect(plan.externalAvailableItemIds.length).toBeGreaterThan(0);
    expect(
      plan.assignments
        .filter((entry) => plan.externalAvailableItemIds.includes(entry.itemId))
        .every(
          (entry) =>
            entry.executionMode === "external-required"
            && entry.eligible === false,
        ),
    ).toBe(true);

    expect(() => runAsoiafAnswerDeskWorker(runInput(root)))
      .toThrow(/requires external actor/);
    expect(readAsoiafAnswerDeskStatus(root).leases).toEqual([]);
    expect(readAsoiafAnswerDeskWorkerStatus(root).invocations).toEqual([]);
  });

  it("selects only the exact answer-ready render item for automatic execution", () => {
    const root = estateRoot();
    const fixture = adoptReady(root);

    const plan = planAsoiafAnswerDeskWorkers(root);
    const render = plan.assignments.find(
      (entry) => entry.action === "render-reviewed-answer",
    );

    expect(validateAsoiafAnswerWorkerPlan(plan, root)).toEqual([]);
    expect(render).toEqual(
      expect.objectContaining({
        deskStatus: "available",
        executionMode: "automatic",
        workerId: ASOIAF_REVIEWED_RENDER_WORKER_ID,
        requiredActor: "reviewed-renderer",
        eligible: true,
        subjectIds: [fixture.answerPacket.answerPacketId],
        networkAccess: "none",
        privateTextAccess: "none",
        humanReview: "none",
      }),
    );
    expect(plan.nextAutomaticItemId).toBe(render?.itemId);
    expect(plan.automaticAvailableItemIds).toEqual([render?.itemId]);
    expect(plan.externalAvailableItemIds).toEqual([]);
  });

  it("claims, invokes, renders, retains, settles, and reconstructs one exact automatic result", () => {
    const root = estateRoot();
    const fixture = adoptReady(root);
    const run = runAsoiafAnswerDeskWorker(runInput(root));
    const workerPaths = asoiafAnswerDeskWorkerPaths(root);
    const renderReference = run.result.resultReferences[0]!;
    const output = path.resolve(root, renderReference.uri!);

    expect(run.claim.replayed).toBe(false);
    expect(run.invocationReplayed).toBe(false);
    expect(run.resultReplayed).toBe(false);
    expect(run.invocation.workerId).toBe(ASOIAF_REVIEWED_RENDER_WORKER_ID);
    expect(run.invocation.action).toBe("render-reviewed-answer");
    expect(run.result.outcome).toBe("rendered");
    expect(run.result.resultReferences).toEqual([
      expect.objectContaining({
        kind: "reviewed-answer-render",
        objectId: `${fixture.answerPacket.answerPacketId}:rendered`,
        fingerprint: fixture.answerPacket.renderedTextDigest,
      }),
    ]);
    expect(fs.readFileSync(output, "utf8")).toBe(
      renderAsoiafReviewedAnswerPacket(fixture.answerPacket),
    );
    expect(path.basename(output)).toBe(
      `${fixture.answerPacket.renderedTextDigest.slice("sha256:".length)}.txt`,
    );
    expect(run.settlement.settlement.outcome).toBe("rendered");
    expect(run.settlement.settlement.resultReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "answer-worker-result",
          objectId: run.result.resultId,
          fingerprint: run.result.resultFingerprint,
        }),
        renderReference,
      ]),
    );
    expect(run.settlement.state.availableItemIds).toEqual([]);
    expect(run.settlement.state.nextAvailableItemId).toBeNull();

    const status = readAsoiafAnswerDeskWorkerStatus(root);
    expect(status.invocations).toEqual([run.invocation]);
    expect(status.results).toEqual([run.result]);
    expect(status.plan.nextAutomaticItemId).toBeNull();
    expect(status.plan.automaticAvailableItemIds).toEqual([]);
    expect(status.plan.assignments.find(
      (entry) => entry.itemId === run.claim.lease.itemId,
    )?.deskStatus).toBe("settled");
    expect(fs.readdirSync(workerPaths.invocations)).toEqual([
      `${run.invocation.invocationFingerprint.slice("sha256:".length)}.json`,
    ]);
    expect(fs.readdirSync(workerPaths.results)).toEqual([
      `${run.result.resultFingerprint.slice("sha256:".length)}.json`,
    ]);
    expect(verifyAsoiafAnswerDeskWorkerEstate(root)).toEqual([]);
  });

  it("replays the exact lease, invocation, output, result, and settlement without duplicate custody", () => {
    const root = estateRoot();
    adoptReady(root);
    const input = runInput(root);
    const first = runAsoiafAnswerDeskWorker(input);
    const second = runAsoiafAnswerDeskWorker(input);
    const desk = readAsoiafAnswerDeskStatus(root);
    const worker = readAsoiafAnswerDeskWorkerStatus(root);

    expect(second.claim.replayed).toBe(true);
    expect(second.claim.lease).toEqual(first.claim.lease);
    expect(second.invocationReplayed).toBe(true);
    expect(second.invocation).toEqual(first.invocation);
    expect(second.resultReplayed).toBe(true);
    expect(second.result).toEqual(first.result);
    expect(second.settlement.replayed).toBe(true);
    expect(second.settlement.settlement).toEqual(first.settlement.settlement);
    expect(desk.leases).toHaveLength(1);
    expect(desk.settlements).toHaveLength(1);
    expect(worker.invocations).toHaveLength(1);
    expect(worker.results).toHaveLength(1);
    expect(verifyAsoiafAnswerDeskWorkerEstate(root)).toEqual([]);
  });

  it("detects output tampering and refuses immutable replay over changed bytes", () => {
    const root = estateRoot();
    adoptReady(root);
    const input = runInput(root);
    const first = runAsoiafAnswerDeskWorker(input);
    const outputUri = first.result.resultReferences[0]!.uri!;
    fs.writeFileSync(path.resolve(root, outputUri), "tampered render", "utf8");

    expect(
      verifyAsoiafAnswerDeskWorkerEstate(root).map((entry) => entry.code),
    ).toContain("worker-result-output-digest");
    expect(() => runAsoiafAnswerDeskWorker(input))
      .toThrow(/immutable file collision/);
  });

  it("refuses unknown automatic workers and invocation times outside the lease", () => {
    const wrongWorkerRoot = estateRoot();
    adoptReady(wrongWorkerRoot);
    expect(() =>
      runAsoiafAnswerDeskWorker({
        ...runInput(wrongWorkerRoot),
        workerId: "asoiaf-answer-worker:unknown" as typeof ASOIAF_REVIEWED_RENDER_WORKER_ID,
      }),
    ).toThrow(/unknown automatic answer worker/);
    expect(readAsoiafAnswerDeskStatus(wrongWorkerRoot).leases).toEqual([]);

    const lateRoot = estateRoot();
    adoptReady(lateRoot);
    expect(() =>
      runAsoiafAnswerDeskWorker({
        ...runInput(lateRoot),
        requestedAt: "2026-08-05T06:42:11.000Z",
      }),
    ).toThrow(/invocation time is outside the active lease/);
    expect(readAsoiafAnswerDeskWorkerStatus(lateRoot).invocations).toEqual([]);
  });
});
