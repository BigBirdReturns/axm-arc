import fs from "node:fs";
import path from "node:path";
import {
  buildAsoiafAnswerDeskFixture,
} from "./asoiaf-answer-desk-fixture.js";
import type {
  AsoiafAnswerDeskAdoptInput,
} from "../../tools/lib/asoiaf-answer-desk-estate.js";
import type {
  AsoiafAnswerExchangeResultInput,
} from "../../tools/lib/asoiaf-answer-desk-exchange.js";
import {
  buildAsoiafAnswerSupervisorPolicy,
  type AsoiafAnswerSupervisorTickInput,
} from "../../tools/lib/asoiaf-answer-desk-supervisor.js";
import type {
  AsoiafAnswerWorkAction,
  AsoiafAnswerWorkOrder,
} from "../../tools/lib/asoiaf-answer-work-order.js";

const OUTPUT_DIRECTORY = process.argv[2];
const ESTATE_ROOT = process.argv[3];
if (!OUTPUT_DIRECTORY || !ESTATE_ROOT) {
  throw new Error("output directory and estate root arguments are required");
}

function itemId(
  workOrder: AsoiafAnswerWorkOrder,
  action: AsoiafAnswerWorkAction,
): string {
  const item = workOrder.items.find((entry) => entry.action === action);
  if (!item) throw new Error(`supervisor fixture work order lacks ${action}`);
  return item.itemId;
}

const outputDirectory = path.resolve(OUTPUT_DIRECTORY);
const estateRoot = path.resolve(ESTATE_ROOT);
const fixture = buildAsoiafAnswerDeskFixture();
const policy = buildAsoiafAnswerSupervisorPolicy({
  createdBy: "qualification:answer-supervisor-policy",
  createdAt: "2026-08-05T06:20:00.000Z",
  automaticWorkerEnabled: true,
  automaticLeaseMilliseconds: 60_000,
  actorBindings: [
    {
      actorRole: "exact-locator-reviewer",
      actorId: "actor:qualification:supervisor-locator-reviewer",
      capacity: 1,
      leaseMilliseconds: 600_000,
      priority: 10,
    },
    {
      actorRole: "answer-assembler",
      actorId: "actor:qualification:supervisor-answer-assembler",
      capacity: 1,
      leaseMilliseconds: 600_000,
      priority: 20,
    },
  ],
});

const adoptInput: AsoiafAnswerDeskAdoptInput = {
  root: estateRoot,
  workOrder: fixture.openWorkOrder,
  adoptedAt: "2026-08-05T06:20:01.000Z",
  operatorId: "qualification:answer-supervisor-adopt",
};
const reviewTickInput: AsoiafAnswerSupervisorTickInput = {
  root: estateRoot,
  requestKey: "qualification:answer-supervisor-review",
  policy,
  requestedAt: "2026-08-05T06:21:00.000Z",
  automaticCompletedAt: null,
  operatorId: "qualification:answer-supervisor",
};
const reviewResultTemplate: AsoiafAnswerExchangeResultInput = {
  root: estateRoot,
  assignmentId: "__REVIEW_ASSIGNMENT_ID__",
  actorId: "actor:qualification:supervisor-locator-reviewer",
  actorRole: "exact-locator-reviewer",
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
    "The qualification locator reviewer admitted the exact transaction that proves the supervisor-dispatched review item satisfied.",
  operatorId: "qualification:answer-supervisor-review-admit",
};
const closeTickInput: AsoiafAnswerSupervisorTickInput = {
  root: estateRoot,
  requestKey: "qualification:answer-supervisor-close",
  policy,
  requestedAt: "2026-08-05T06:31:00.000Z",
  automaticCompletedAt: null,
  operatorId: "qualification:answer-supervisor",
};
const closeResultTemplate: AsoiafAnswerExchangeResultInput = {
  root: estateRoot,
  assignmentId: "__CLOSE_ASSIGNMENT_ID__",
  actorId: "actor:qualification:supervisor-answer-assembler",
  actorRole: "answer-assembler",
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
    "The qualification answer assembler admitted the reviewed packet that closes the supervisor-dispatched immutable gap.",
  operatorId: "qualification:answer-supervisor-close-admit",
};
const renderTickInput: AsoiafAnswerSupervisorTickInput = {
  root: estateRoot,
  requestKey: "qualification:answer-supervisor-render",
  policy,
  requestedAt: "2026-08-05T06:41:10.000Z",
  automaticCompletedAt: "2026-08-05T06:41:20.000Z",
  operatorId: "qualification:answer-supervisor",
};
const expected = {
  estateRoot,
  policyId: policy.policyId,
  policyFingerprint: policy.policyFingerprint,
  openWorkOrderId: fixture.openWorkOrder.workOrderId,
  reconciledWorkOrderId: fixture.reconciledWorkOrder.workOrderId,
  readyWorkOrderId: fixture.readyWorkOrder.workOrderId,
  reviewItemId: itemId(fixture.openWorkOrder, "review-exact-locator"),
  closeItemId: itemId(fixture.reconciledWorkOrder, "close-gap"),
  renderItemId: itemId(fixture.readyWorkOrder, "render-reviewed-answer"),
  transactionId: fixture.transaction.transactionId,
  transactionFingerprint: fixture.transaction.transactionFingerprint,
  answerPacketId: fixture.answerPacket.answerPacketId,
  answerPacketFingerprint: fixture.answerPacket.answerPacketFingerprint,
  renderedTextDigest: fixture.answerPacket.renderedTextDigest,
  renderedTextCharacters: fixture.answerPacket.renderedTextCharacters,
  reviewRequestKey: reviewTickInput.requestKey,
  closeRequestKey: closeTickInput.requestKey,
  renderRequestKey: renderTickInput.requestKey,
};

fs.mkdirSync(outputDirectory, { recursive: true });
for (const [name, value] of [
  ["policy.json", policy],
  ["adopt-input.json", adoptInput],
  ["review-tick-input.json", reviewTickInput],
  ["review-result-template.json", reviewResultTemplate],
  ["close-tick-input.json", closeTickInput],
  ["close-result-template.json", closeResultTemplate],
  ["render-tick-input.json", renderTickInput],
  ["expected.json", expected],
] as const) {
  fs.writeFileSync(
    path.join(outputDirectory, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    outputDirectory,
    estateRoot,
    policyId: policy.policyId,
    openWorkOrderId: expected.openWorkOrderId,
    reviewItemId: expected.reviewItemId,
    closeItemId: expected.closeItemId,
    renderItemId: expected.renderItemId,
  }, null, 2)}\n`,
);
