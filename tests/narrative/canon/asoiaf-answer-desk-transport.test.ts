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
  readAsoiafAnswerExchangeStatus,
  verifyAsoiafAnswerExchangeEstate,
} from "../../../tools/lib/asoiaf-answer-desk-exchange.js";
import {
  runAsoiafAnswerDeskWorker,
} from "../../../tools/lib/asoiaf-answer-desk-worker.js";
import {
  ASOIAF_ANSWER_TRANSPORT_ADMIT_ROUTE,
  ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
  processAsoiafAnswerTransportRequest,
  readAsoiafAnswerTransportStatus,
  registerAsoiafAnswerTransportActor,
  revokeAsoiafAnswerTransportActor,
  verifyAsoiafAnswerTransportEstate,
  type AsoiafAnswerTransportAdmitBody,
  type AsoiafAnswerTransportIssueBody,
} from "../../../tools/lib/asoiaf-answer-desk-transport.js";
import {
  sha256,
} from "../../../tools/lib/asoiaf-external-estate.js";
import type {
  AsoiafAnswerWorkAction,
  AsoiafAnswerWorkItem,
  AsoiafAnswerWorkOrder,
} from "../../../tools/lib/asoiaf-answer-work-order.js";

const roots: string[] = [];

function estateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-answer-transport-"));
  roots.push(root);
  return root;
}

function certificateFingerprint(label: string): `sha256:${string}` {
  return sha256(`synthetic-certificate:${label}`);
}

function item(
  workOrder: AsoiafAnswerWorkOrder,
  action: AsoiafAnswerWorkAction,
): AsoiafAnswerWorkItem {
  const result = workOrder.items.find((entry) => entry.action === action);
  if (!result) throw new Error(`fixture work order lacks ${action}`);
  return result;
}

function adoptOpen(root: string) {
  const fixture = buildAsoiafAnswerDeskFixture();
  adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder: fixture.openWorkOrder,
    adoptedAt: "2026-08-05T06:20:01.000Z",
    operatorId: "operator:transport-open",
  });
  return fixture;
}

function registerReviewActor(root: string, label = "review") {
  return registerAsoiafAnswerTransportActor({
    root,
    certificateFingerprint: certificateFingerprint(label),
    actorId: `actor:transport:${label}:exact-locator-reviewer`,
    actorRole: "exact-locator-reviewer",
    registeredAt: "2026-08-05T06:00:00.000Z",
    operatorId: "operator:transport-register-review",
  });
}

function registerAssembler(root: string, label = "assembler") {
  return registerAsoiafAnswerTransportActor({
    root,
    certificateFingerprint: certificateFingerprint(label),
    actorId: `actor:transport:${label}:answer-assembler`,
    actorRole: "answer-assembler",
    registeredAt: "2026-08-05T06:00:00.000Z",
    operatorId: "operator:transport-register-assembler",
  });
}

function reviewIssueBody(
  workOrder: AsoiafAnswerWorkOrder,
): AsoiafAnswerTransportIssueBody {
  return {
    itemId: item(workOrder, "review-exact-locator").itemId,
    claimedAt: "2026-08-05T06:21:00.000Z",
    issuedAt: "2026-08-05T06:21:01.000Z",
    leaseMilliseconds: 600_000,
  };
}

function reviewAdmitBody(
  assignmentId: string,
  fixture: ReturnType<typeof buildAsoiafAnswerDeskFixture>,
): AsoiafAnswerTransportAdmitBody {
  return {
    assignmentId,
    completedAt: "2026-08-05T06:30:00.000Z",
    outcome: "satisfied",
    afterWorkOrder: fixture.reconciledWorkOrder,
    resultReferences: [
      {
        kind: "reviewed-answer-transaction",
        objectId: fixture.transaction.transactionId,
        fingerprint: fixture.transaction.transactionFingerprint,
        uri: null,
      },
    ],
    reason:
      "The authenticated exact-locator reviewer returned the exact reconciliation transaction that proves the stable review item satisfied.",
  };
}

function closeIssueBody(
  workOrder: AsoiafAnswerWorkOrder,
): AsoiafAnswerTransportIssueBody {
  return {
    itemId: item(workOrder, "close-gap").itemId,
    claimedAt: "2026-08-05T06:31:00.000Z",
    issuedAt: "2026-08-05T06:31:01.000Z",
    leaseMilliseconds: 600_000,
  };
}

function closeAdmitBody(
  assignmentId: string,
  fixture: ReturnType<typeof buildAsoiafAnswerDeskFixture>,
): AsoiafAnswerTransportAdmitBody {
  return {
    assignmentId,
    completedAt: "2026-08-05T06:40:00.000Z",
    outcome: "satisfied",
    afterWorkOrder: fixture.readyWorkOrder,
    resultReferences: [
      {
        kind: "reviewed-answer-packet",
        objectId: fixture.answerPacket.answerPacketId,
        fingerprint: fixture.answerPacket.answerPacketFingerprint,
        uri: null,
      },
    ],
    reason:
      "The authenticated answer assembler returned the exact reviewed packet that closes the immutable gap and proves the stable close item satisfied.",
  };
}

function processReviewIssue(
  root: string,
  fingerprint: string,
  workOrder: AsoiafAnswerWorkOrder,
  key = "transport-review-issue-0001",
) {
  return processAsoiafAnswerTransportRequest({
    root,
    certificateFingerprint: fingerprint,
    route: ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
    idempotencyKey: key,
    body: reviewIssueBody(workOrder),
    receivedAt: "2026-08-05T06:20:30.000Z",
    completedAt: "2026-08-05T06:21:02.000Z",
    operatorId: "operator:transport-review-issue",
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF authenticated answer desk transport", () => {
  it("derives the external actor from certificate registration and replays exact issuance", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const registered = registerReviewActor(root);
    const first = processReviewIssue(
      root,
      registered.registration.certificateFingerprint,
      fixture.openWorkOrder,
    );
    const second = processAsoiafAnswerTransportRequest({
      root,
      certificateFingerprint: registered.registration.certificateFingerprint,
      route: ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
      idempotencyKey: "transport-review-issue-0001",
      body: reviewIssueBody(fixture.openWorkOrder),
      receivedAt: "2026-08-05T06:22:00.000Z",
      completedAt: "2026-08-05T06:22:01.000Z",
    });

    expect(first.request).toEqual(
      expect.objectContaining({
        actorRegistrationId: registered.registration.registrationId,
        actorId: registered.registration.actorId,
        actorRole: "exact-locator-reviewer",
        peerCertificateFingerprint: registered.registration.certificateFingerprint,
        privateTextIncluded: false,
        sourceTextIncluded: false,
        authority: "none",
      }),
    );
    expect(first.response.outcome).toBe("succeeded");
    expect(first.response.payload).toEqual(
      expect.objectContaining({
        assignment: expect.objectContaining({
          actorId: registered.registration.actorId,
          actorRole: registered.registration.actorRole,
          action: "review-exact-locator",
        }),
      }),
    );
    expect(second.request).toEqual(first.request);
    expect(second.response).toEqual(first.response);
    expect(second.requestReplayed).toBe(true);
    expect(second.responseReplayed).toBe(true);
    expect(readAsoiafAnswerDeskStatus(root).leases).toHaveLength(1);
    expect(readAsoiafAnswerExchangeStatus(root).assignments).toHaveLength(1);
    expect(readAsoiafAnswerTransportStatus(root).requests).toHaveLength(1);
    expect(readAsoiafAnswerTransportStatus(root).responses).toHaveLength(1);
  });

  it("refuses reuse of one idempotency key across changed bodies or authenticated peers", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const firstActor = registerReviewActor(root, "review-one");
    const secondActor = registerReviewActor(root, "review-two");
    processReviewIssue(
      root,
      firstActor.registration.certificateFingerprint,
      fixture.openWorkOrder,
      "transport-conflict-key-0001",
    );

    expect(() =>
      processAsoiafAnswerTransportRequest({
        root,
        certificateFingerprint: firstActor.registration.certificateFingerprint,
        route: ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
        idempotencyKey: "transport-conflict-key-0001",
        body: {
          ...reviewIssueBody(fixture.openWorkOrder),
          leaseMilliseconds: 300_000,
        },
        receivedAt: "2026-08-05T06:22:00.000Z",
      }),
    ).toThrow(/already bound to a different actor, route, method, or body/);

    expect(() =>
      processAsoiafAnswerTransportRequest({
        root,
        certificateFingerprint: secondActor.registration.certificateFingerprint,
        route: ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
        idempotencyKey: "transport-conflict-key-0001",
        body: reviewIssueBody(fixture.openWorkOrder),
        receivedAt: "2026-08-05T06:22:00.000Z",
      }),
    ).toThrow(/already bound to a different actor, route, method, or body/);

    expect(readAsoiafAnswerTransportStatus(root).requests).toHaveLength(1);
    expect(readAsoiafAnswerDeskStatus(root).leases).toHaveLength(1);
  });

  it("allows neither unregistered nor revoked certificates to create request custody", () => {
    const unregisteredRoot = estateRoot();
    const unregisteredFixture = adoptOpen(unregisteredRoot);
    expect(() =>
      processReviewIssue(
        unregisteredRoot,
        certificateFingerprint("unregistered"),
        unregisteredFixture.openWorkOrder,
      ),
    ).toThrow(/not registered/);
    expect(readAsoiafAnswerTransportStatus(unregisteredRoot).requests).toEqual([]);

    const revokedRoot = estateRoot();
    const revokedFixture = adoptOpen(revokedRoot);
    const registered = registerReviewActor(revokedRoot, "revoked");
    revokeAsoiafAnswerTransportActor({
      root: revokedRoot,
      certificateFingerprint: registered.registration.certificateFingerprint,
      revokedAt: "2026-08-05T06:10:00.000Z",
      reason:
        "The synthetic transport qualification certificate is retired before any remote assignment transaction is accepted.",
      operatorId: "operator:transport-revoke",
    });
    expect(() =>
      processReviewIssue(
        revokedRoot,
        registered.registration.certificateFingerprint,
        revokedFixture.openWorkOrder,
      ),
    ).toThrow(/has been revoked/);
    expect(readAsoiafAnswerTransportStatus(revokedRoot).requests).toEqual([]);
  });

  it("retains an authenticated role mismatch as one replayable refusal without claiming work", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const assembler = registerAssembler(root);
    const first = processAsoiafAnswerTransportRequest({
      root,
      certificateFingerprint: assembler.registration.certificateFingerprint,
      route: ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
      idempotencyKey: "transport-role-refusal-0001",
      body: reviewIssueBody(fixture.openWorkOrder),
      receivedAt: "2026-08-05T06:20:30.000Z",
      completedAt: "2026-08-05T06:21:02.000Z",
    });
    const second = processAsoiafAnswerTransportRequest({
      root,
      certificateFingerprint: assembler.registration.certificateFingerprint,
      route: ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
      idempotencyKey: "transport-role-refusal-0001",
      body: reviewIssueBody(fixture.openWorkOrder),
      receivedAt: "2026-08-05T06:22:00.000Z",
    });

    expect(first.response).toEqual(
      expect.objectContaining({
        outcome: "refused",
        httpStatus: 409,
        payload: null,
        errorCode: "exchange-operation-refused",
      }),
    );
    expect(first.response.errorMessage).toMatch(/not available to external actor role/);
    expect(second.response).toEqual(first.response);
    expect(second.responseReplayed).toBe(true);
    expect(readAsoiafAnswerDeskStatus(root).leases).toEqual([]);
    expect(
      verifyAsoiafAnswerTransportEstate(root).filter(
        (entry) => entry.severity === "error",
      ),
    ).toEqual([]);
  });

  it("recovers an interrupted response through the exchange replay boundary", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const registered = registerReviewActor(root, "recovery");
    const first = processReviewIssue(
      root,
      registered.registration.certificateFingerprint,
      fixture.openWorkOrder,
      "transport-recovery-key-0001",
    );
    fs.rmSync(path.resolve(root, first.responseUri));

    const recovered = processAsoiafAnswerTransportRequest({
      root,
      certificateFingerprint: registered.registration.certificateFingerprint,
      route: ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
      idempotencyKey: "transport-recovery-key-0001",
      body: reviewIssueBody(fixture.openWorkOrder),
      receivedAt: "2026-08-05T06:22:00.000Z",
      completedAt: "2026-08-05T06:22:01.000Z",
    });

    expect(recovered.request).toEqual(first.request);
    expect(recovered.requestReplayed).toBe(true);
    expect(recovered.response.outcome).toBe("succeeded");
    expect(
      (recovered.response.payload as typeof first.response.payload),
    ).toEqual(
      expect.objectContaining({
        claim: expect.objectContaining({ replayed: true }),
        assignmentReplayed: true,
      }),
    );
    expect(readAsoiafAnswerDeskStatus(root).leases).toHaveLength(1);
    expect(readAsoiafAnswerExchangeStatus(root).assignments).toHaveLength(1);
    expect(
      verifyAsoiafAnswerTransportEstate(root).filter(
        (entry) => entry.severity === "error",
      ),
    ).toEqual([]);
  });

  it("authenticates two external transitions and leaves automatic rendering to the worker", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const reviewer = registerReviewActor(root, "lifecycle-review");
    const assembler = registerAssembler(root, "lifecycle-assembler");

    const reviewIssue = processReviewIssue(
      root,
      reviewer.registration.certificateFingerprint,
      fixture.openWorkOrder,
      "transport-lifecycle-review-issue",
    );
    const reviewAssignment = (
      reviewIssue.response.payload as { assignment: { assignmentId: string } }
    ).assignment;
    const reviewAdmit = processAsoiafAnswerTransportRequest({
      root,
      certificateFingerprint: reviewer.registration.certificateFingerprint,
      route: ASOIAF_ANSWER_TRANSPORT_ADMIT_ROUTE,
      idempotencyKey: "transport-lifecycle-review-admit",
      body: reviewAdmitBody(reviewAssignment.assignmentId, fixture),
      receivedAt: "2026-08-05T06:29:00.000Z",
      completedAt: "2026-08-05T06:30:01.000Z",
    });
    expect(reviewAdmit.response.outcome).toBe("succeeded");

    const closeIssue = processAsoiafAnswerTransportRequest({
      root,
      certificateFingerprint: assembler.registration.certificateFingerprint,
      route: ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
      idempotencyKey: "transport-lifecycle-close-issue",
      body: closeIssueBody(fixture.reconciledWorkOrder),
      receivedAt: "2026-08-05T06:30:30.000Z",
      completedAt: "2026-08-05T06:31:02.000Z",
    });
    const closeAssignment = (
      closeIssue.response.payload as { assignment: { assignmentId: string } }
    ).assignment;
    const closeAdmit = processAsoiafAnswerTransportRequest({
      root,
      certificateFingerprint: assembler.registration.certificateFingerprint,
      route: ASOIAF_ANSWER_TRANSPORT_ADMIT_ROUTE,
      idempotencyKey: "transport-lifecycle-close-admit",
      body: closeAdmitBody(closeAssignment.assignmentId, fixture),
      receivedAt: "2026-08-05T06:39:00.000Z",
      completedAt: "2026-08-05T06:40:01.000Z",
    });
    expect(closeAdmit.response.outcome).toBe("succeeded");

    const rendered = runAsoiafAnswerDeskWorker({
      root,
      itemId: item(fixture.readyWorkOrder, "render-reviewed-answer").itemId,
      claimedAt: "2026-08-05T06:41:10.000Z",
      requestedAt: "2026-08-05T06:41:11.000Z",
      completedAt: "2026-08-05T06:41:20.000Z",
      leaseMilliseconds: 60_000,
      operatorId: "operator:transport-lifecycle-render",
    });

    const desk = readAsoiafAnswerDeskStatus(root);
    const exchange = readAsoiafAnswerExchangeStatus(root);
    const transport = readAsoiafAnswerTransportStatus(root);
    expect(rendered.result.resultReferences.some(
      (entry) => entry.fingerprint === fixture.answerPacket.renderedTextDigest,
    )).toBe(true);
    expect(desk.workOrders).toHaveLength(3);
    expect(desk.leases).toHaveLength(3);
    expect(desk.settlements).toHaveLength(3);
    expect(exchange.assignments).toHaveLength(2);
    expect(exchange.results).toHaveLength(2);
    expect(transport.registrations).toHaveLength(2);
    expect(transport.requests).toHaveLength(4);
    expect(transport.responses).toHaveLength(4);
    expect(transport.responses.every((entry) => entry.outcome === "succeeded")).toBe(true);
    expect(desk.state.nextAvailableItemId).toBeNull();
    expect(
      verifyAsoiafAnswerExchangeEstate(root).filter(
        (entry) => entry.severity === "error",
      ),
    ).toEqual([]);
    expect(
      verifyAsoiafAnswerTransportEstate(root).filter(
        (entry) => entry.severity === "error",
      ),
    ).toEqual([]);
  });

  it("refuses remote attempts to supply root, actor, role, or operator authority", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const registered = registerReviewActor(root, "override");
    for (const [field, value] of [
      ["root", "/tmp/other-estate"],
      ["actorId", "actor:forged"],
      ["actorRole", "answer-assembler"],
      ["operatorId", "operator:forged"],
    ] as const) {
      expect(() =>
        processAsoiafAnswerTransportRequest({
          root,
          certificateFingerprint: registered.registration.certificateFingerprint,
          route: ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
          idempotencyKey: `transport-override-${field}-0001`,
          body: {
            ...reviewIssueBody(fixture.openWorkOrder),
            [field]: value,
          },
          receivedAt: "2026-08-05T06:20:30.000Z",
        }),
      ).toThrow(/forbidden or unknown fields/);
    }
    expect(readAsoiafAnswerTransportStatus(root).requests).toEqual([]);
    expect(readAsoiafAnswerDeskStatus(root).leases).toEqual([]);
  });

  it("detects changed registration, request, and response bytes", () => {
    const registrationRoot = estateRoot();
    adoptOpen(registrationRoot);
    const registered = registerReviewActor(registrationRoot, "tamper-registration");
    const registrationPath = path.resolve(registrationRoot, registered.registrationUri);
    const changedRegistration = JSON.parse(
      fs.readFileSync(registrationPath, "utf8"),
    ) as Record<string, unknown>;
    changedRegistration.actorId = "actor:tampered";
    fs.writeFileSync(registrationPath, `${JSON.stringify(changedRegistration, null, 2)}\n`);
    expect(
      verifyAsoiafAnswerTransportEstate(registrationRoot).some(
        (entry) => entry.code === "transport-actor-projection"
          || entry.code === "transport-actor-fingerprint",
      ),
    ).toBe(true);

    const requestRoot = estateRoot();
    const requestFixture = adoptOpen(requestRoot);
    const requestActor = registerReviewActor(requestRoot, "tamper-request");
    const requestResult = processReviewIssue(
      requestRoot,
      requestActor.registration.certificateFingerprint,
      requestFixture.openWorkOrder,
      "transport-tamper-request-0001",
    );
    const requestPathname = path.resolve(requestRoot, requestResult.requestUri);
    const changedRequest = JSON.parse(
      fs.readFileSync(requestPathname, "utf8"),
    ) as Record<string, unknown>;
    changedRequest.bodyDigest = sha256("tampered-body");
    fs.writeFileSync(requestPathname, `${JSON.stringify(changedRequest, null, 2)}\n`);
    expect(
      verifyAsoiafAnswerTransportEstate(requestRoot).some(
        (entry) => entry.code === "transport-request-projection"
          || entry.code === "transport-request-fingerprint",
      ),
    ).toBe(true);

    const responseRoot = estateRoot();
    const responseFixture = adoptOpen(responseRoot);
    const responseActor = registerReviewActor(responseRoot, "tamper-response");
    const responseResult = processReviewIssue(
      responseRoot,
      responseActor.registration.certificateFingerprint,
      responseFixture.openWorkOrder,
      "transport-tamper-response-0001",
    );
    const responsePathname = path.resolve(responseRoot, responseResult.responseUri);
    const changedResponse = JSON.parse(
      fs.readFileSync(responsePathname, "utf8"),
    ) as Record<string, unknown>;
    changedResponse.authority = "transport";
    fs.writeFileSync(responsePathname, `${JSON.stringify(changedResponse, null, 2)}\n`);
    expect(
      verifyAsoiafAnswerTransportEstate(responseRoot).some(
        (entry) => entry.code === "transport-response-authority"
          || entry.code === "transport-response-fingerprint",
      ),
    ).toBe(true);
  });
});
