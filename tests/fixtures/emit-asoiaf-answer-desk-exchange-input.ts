import fs from "node:fs";
import path from "node:path";
import {
  buildAsoiafAnswerDeskFixture,
} from "./asoiaf-answer-desk-fixture.js";
import type {
  AsoiafAnswerDeskAdoptInput,
} from "../../tools/lib/asoiaf-answer-desk-estate.js";
import type {
  AsoiafAnswerExchangeIssueInput,
  AsoiafAnswerExchangeResultInput,
} from "../../tools/lib/asoiaf-answer-desk-exchange.js";
import type {
  AsoiafAnswerDeskWorkerRunInput,
} from "../../tools/lib/asoiaf-answer-desk-worker.js";
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
  if (!item) throw new Error(`exchange fixture work order lacks ${action}`);
  return item.itemId;
}

const outputDirectory = path.resolve(OUTPUT_DIRECTORY);
const estateRoot = path.resolve(ESTATE_ROOT);
const fixture = buildAsoiafAnswerDeskFixture();

const adoptInput: AsoiafAnswerDeskAdoptInput = {
  root: estateRoot,
  workOrder: fixture.openWorkOrder,
  adoptedAt: "2026-08-05T06:20:01.000Z",
  operatorId: "qualification:answer-exchange-adopt",
};
const reviewIssueInput: AsoiafAnswerExchangeIssueInput = {
  root: estateRoot,
  itemId: itemId(fixture.openWorkOrder, "review-exact-locator"),
  actorId: "actor:qualification:exact-locator-reviewer",
  actorRole: "exact-locator-reviewer",
  claimedAt: "2026-08-05T06:21:00.000Z",
  issuedAt: "2026-08-05T06:21:01.000Z",
  leaseMilliseconds: 600_000,
  operatorId: "qualification:answer-exchange-review-issue",
};
const reviewResultTemplate: AsoiafAnswerExchangeResultInput = {
  root: estateRoot,
  assignmentId: "__REVIEW_ASSIGNMENT_ID__",
  actorId: reviewIssueInput.actorId,
  actorRole: reviewIssueInput.actorRole,
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
    "The qualification exact-locator reviewer admitted the content-addressed transaction that proves the stable review item satisfied.",
  operatorId: "qualification:answer-exchange-review-admit",
};
const closeIssueInput: AsoiafAnswerExchangeIssueInput = {
  root: estateRoot,
  itemId: itemId(fixture.reconciledWorkOrder, "close-gap"),
  actorId: "actor:qualification:answer-assembler",
  actorRole: "answer-assembler",
  claimedAt: "2026-08-05T06:31:00.000Z",
  issuedAt: "2026-08-05T06:31:01.000Z",
  leaseMilliseconds: 600_000,
  operatorId: "qualification:answer-exchange-gap-issue",
};
const closeResultTemplate: AsoiafAnswerExchangeResultInput = {
  root: estateRoot,
  assignmentId: "__CLOSE_ASSIGNMENT_ID__",
  actorId: closeIssueInput.actorId,
  actorRole: closeIssueInput.actorRole,
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
    "The qualification answer assembler admitted the exact reviewed packet that closes the immutable gap and proves the stable close item satisfied.",
  operatorId: "qualification:answer-exchange-gap-admit",
};
const renderRunInput: AsoiafAnswerDeskWorkerRunInput = {
  root: estateRoot,
  itemId: itemId(fixture.readyWorkOrder, "render-reviewed-answer"),
  claimedAt: "2026-08-05T06:41:10.000Z",
  requestedAt: "2026-08-05T06:41:11.000Z",
  completedAt: "2026-08-05T06:41:20.000Z",
  leaseMilliseconds: 60_000,
  operatorId: "qualification:answer-exchange-render",
};
const expected = {
  estateRoot,
  openWorkOrderId: fixture.openWorkOrder.workOrderId,
  reconciledWorkOrderId: fixture.reconciledWorkOrder.workOrderId,
  readyWorkOrderId: fixture.readyWorkOrder.workOrderId,
  reviewItemId: reviewIssueInput.itemId,
  closeItemId: closeIssueInput.itemId,
  renderItemId: renderRunInput.itemId,
  transactionId: fixture.transaction.transactionId,
  transactionFingerprint: fixture.transaction.transactionFingerprint,
  answerPacketId: fixture.answerPacket.answerPacketId,
  answerPacketFingerprint: fixture.answerPacket.answerPacketFingerprint,
  renderedTextDigest: fixture.answerPacket.renderedTextDigest,
  renderedTextCharacters: fixture.answerPacket.renderedTextCharacters,
};

fs.mkdirSync(outputDirectory, { recursive: true });
for (const [name, value] of [
  ["adopt-input.json", adoptInput],
  ["review-issue-input.json", reviewIssueInput],
  ["review-result-template.json", reviewResultTemplate],
  ["close-issue-input.json", closeIssueInput],
  ["close-result-template.json", closeResultTemplate],
  ["render-run-input.json", renderRunInput],
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
    openWorkOrderId: expected.openWorkOrderId,
    reviewItemId: expected.reviewItemId,
    closeItemId: expected.closeItemId,
    renderItemId: expected.renderItemId,
  }, null, 2)}\n`,
);
