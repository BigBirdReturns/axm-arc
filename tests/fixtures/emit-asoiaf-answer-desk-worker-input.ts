import fs from "node:fs";
import path from "node:path";
import {
  buildAsoiafAnswerDeskFixture,
} from "./asoiaf-answer-desk-fixture.js";
import {
  renderAsoiafReviewedAnswerPacket,
} from "../../tools/lib/asoiaf-reviewed-answer-packet.js";
import {
  ASOIAF_REVIEWED_RENDER_WORKER_ID,
  type AsoiafAnswerDeskWorkerRunInput,
} from "../../tools/lib/asoiaf-answer-desk-worker.js";
import type {
  AsoiafAnswerDeskAdoptInput,
} from "../../tools/lib/asoiaf-answer-desk-estate.js";

const OUTPUT_DIRECTORY = process.argv[2];
const ESTATE_ROOT = process.argv[3];
if (!OUTPUT_DIRECTORY || !ESTATE_ROOT) {
  throw new Error("output directory and estate root arguments are required");
}

const outputDirectory = path.resolve(OUTPUT_DIRECTORY);
const estateRoot = path.resolve(ESTATE_ROOT);
const fixture = buildAsoiafAnswerDeskFixture();
const renderItem = fixture.readyWorkOrder.items.find(
  (entry) => entry.action === "render-reviewed-answer",
);
if (!renderItem) {
  throw new Error("answer worker fixture lacks a render-reviewed-answer item");
}

const adoptInput: AsoiafAnswerDeskAdoptInput = {
  root: estateRoot,
  workOrder: fixture.readyWorkOrder,
  adoptedAt: "2026-08-05T06:40:01.000Z",
  operatorId: "qualification:answer-worker-adopt",
};
const runInput: AsoiafAnswerDeskWorkerRunInput = {
  root: estateRoot,
  itemId: renderItem.itemId,
  workerId: ASOIAF_REVIEWED_RENDER_WORKER_ID,
  claimedAt: "2026-08-05T06:41:10.000Z",
  requestedAt: "2026-08-05T06:41:11.000Z",
  completedAt: "2026-08-05T06:41:20.000Z",
  leaseMilliseconds: 60_000,
  operatorId: "qualification:answer-worker-run",
};
const renderedText = renderAsoiafReviewedAnswerPacket(fixture.answerPacket);
const expected = {
  estateRoot,
  workerId: ASOIAF_REVIEWED_RENDER_WORKER_ID,
  workOrderId: fixture.readyWorkOrder.workOrderId,
  workOrderFingerprint: fixture.readyWorkOrder.workOrderFingerprint,
  answerPacketId: fixture.answerPacket.answerPacketId,
  answerPacketFingerprint: fixture.answerPacket.answerPacketFingerprint,
  renderedText,
  renderedTextDigest: fixture.answerPacket.renderedTextDigest,
  renderedTextCharacters: fixture.answerPacket.renderedTextCharacters,
  renderItemId: renderItem.itemId,
};

fs.mkdirSync(outputDirectory, { recursive: true });
for (const [name, value] of [
  ["adopt-input.json", adoptInput],
  ["run-input.json", runInput],
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
    workOrderId: expected.workOrderId,
    answerPacketId: expected.answerPacketId,
    renderItemId: expected.renderItemId,
  }, null, 2)}\n`,
);
