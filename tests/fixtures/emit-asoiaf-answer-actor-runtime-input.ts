import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  acceptAsoiafAnswerActorRuntimeDelivery,
  prepareAsoiafAnswerActorRuntimeExecution,
  prepareAsoiafAnswerActorRuntimeReturn,
  readAsoiafAnswerActorRuntimeStatus,
  recordAsoiafAnswerActorRuntimeResult,
  recordAsoiafAnswerActorRuntimeReturn,
  retainAsoiafAnswerActorRuntimeSlot,
  retireAsoiafAnswerActorRuntimeSlot,
  verifyAsoiafAnswerActorRuntimeEstate,
} from "../../tools/lib/asoiaf-answer-actor-runtime.js";
import {
  readAsoiafAnswerSupervisedDeliveryStatus,
} from "../../tools/lib/asoiaf-answer-desk-supervised-delivery.js";
import {
  readAsoiafAnswerExchangeStatus,
} from "../../tools/lib/asoiaf-answer-desk-exchange.js";
import {
  readAsoiafAnswerCredentialProviderStatus,
} from "../../tools/lib/asoiaf-answer-credential-provider-host.js";
import {
  sha256,
} from "../../tools/lib/asoiaf-external-estate.js";

const outputDirectory = path.resolve(process.argv[2] ?? "");
const estateRoot = path.resolve(process.argv[3] ?? "");
if (!process.argv[2] || !process.argv[3]) {
  throw new Error("actor runtime fixture requires output directory and estate root arguments");
}
const deliveryReceipts = path.join(outputDirectory, "parent-supervised-delivery");
const providerReceipts = path.join(outputDirectory, "parent-provider-host");
const parentsReady = process.argv.includes("--parents-ready");
if (!parentsReady) {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.rmSync(estateRoot, { recursive: true, force: true });
}
fs.mkdirSync(outputDirectory, { recursive: true });
fs.mkdirSync(estateRoot, { recursive: true });

function write(name: string, value: unknown): string {
  const target = path.join(outputDirectory, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return target;
}

function read<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(outputDirectory, name), "utf8")) as T;
}

function runFixture(script: string, args: string[], receipt: string): void {
  const stdout = execFileSync(process.execPath, [
    path.join("node_modules", "vite-node", "vite-node.mjs"),
    script,
    ...args,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
    timeout: 30 * 60 * 1000,
    stdio: ["ignore", "pipe", "inherit"],
  });
  fs.writeFileSync(path.join(outputDirectory, receipt), stdout, "utf8");
}

function replay(command: string, inputName: string, outputName: string): void {
  execFileSync(process.execPath, [
    path.join("node_modules", "vite-node", "vite-node.mjs"),
    "tools/asoiaf-answer-actor-runtime.ts",
    command,
    "--input", path.join(outputDirectory, inputName),
    "--out", path.join(outputDirectory, outputName),
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 5 * 60 * 1000,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function refusal(command: string, inputName: string, outputName: string): void {
  const run = spawnSync(process.execPath, [
    path.join("node_modules", "vite-node", "vite-node.mjs"),
    "tools/asoiaf-answer-actor-runtime.ts",
    command,
    "--input", path.join(outputDirectory, inputName),
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 5 * 60 * 1000,
  });
  if (run.status === 0) throw new Error(`actor runtime ${command} unexpectedly succeeded`);
  write(outputName, {
    command,
    exitCode: run.status,
    stderrDigest: sha256(run.stderr),
    message: run.stderr.trim().split(/\r?\n/)[0] ?? "",
  });
}

function at(value: string, offsetMilliseconds: number): string {
  return new Date(Date.parse(value) + offsetMilliseconds).toISOString();
}

function digestBytes(value: unknown): { digest: `sha256:${string}`; bytes: number } {
  const buffer = Buffer.from(JSON.stringify(value), "utf8");
  return {
    digest: `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`,
    bytes: buffer.length,
  };
}

if (!parentsReady) {
  runFixture(
    "tests/fixtures/emit-asoiaf-answer-desk-supervised-delivery-input.ts",
    ["--run-qualification", deliveryReceipts, estateRoot],
    "parent-supervised-delivery-emission.json",
  );
  runFixture(
    "tests/fixtures/emit-asoiaf-answer-credential-provider-host-input.ts",
    [providerReceipts, estateRoot],
    "parent-provider-host-emission.json",
  );
}

const deliveryStatus = readAsoiafAnswerSupervisedDeliveryStatus(estateRoot);
const exchangeStatus = readAsoiafAnswerExchangeStatus(estateRoot);
const providerStatus = readAsoiafAnswerCredentialProviderStatus(estateRoot);
const reviewDelivery = deliveryStatus.deliveries.find(
  (entry) => entry.assignment.action === "review-exact-locator",
);
const closeDelivery = deliveryStatus.deliveries.find(
  (entry) => entry.assignment.action === "close-gap",
);
if (!reviewDelivery || !closeDelivery) {
  throw new Error("actor runtime fixture requires review and close-gap supervised deliveries");
}
const reviewExchangeResult = exchangeStatus.results.find(
  (entry) => entry.assignmentId === reviewDelivery.assignmentId,
);
const closeExchangeResult = exchangeStatus.results.find(
  (entry) => entry.assignmentId === closeDelivery.assignmentId,
);
const reviewReturn = deliveryStatus.returns.find(
  (entry) => entry.deliveryId === reviewDelivery.deliveryId,
);
const profile = providerStatus.profiles[0];
const transportProviderResult = providerStatus.results.find(
  (entry) => entry.output.kind === "transport-result",
);
const possessionProviderResult = providerStatus.results.find(
  (entry) => entry.output.kind === "possession-proof",
);
if (
  !reviewExchangeResult
  || !closeExchangeResult
  || !reviewReturn
  || !profile
  || !transportProviderResult
  || !possessionProviderResult
) {
  throw new Error("actor runtime fixture lacks exact delivery, exchange, return, or provider parent custody");
}
const delegationReason =
  "The holder explicitly assigns this external-service provider profile to the certificate-bound answer actor; the mapping carries no scheduling, task, settlement, graph, canon, or answer authority.";

const reviewSlotInput = {
  root: estateRoot,
  actorId: reviewDelivery.actorId,
  actorRole: reviewDelivery.actorRole,
  deliveryCertificateFingerprint: reviewDelivery.certificateFingerprint,
  providerProfileId: profile.profileId,
  credentialRelationship: "explicit-delegation" as const,
  delegationReason,
  predecessorSlotId: null,
  createdAt: reviewDelivery.deliveredAt,
  operatorId: "operator:qualification:actor-runtime:review-slot",
};
write("review-slot-input.json", reviewSlotInput);
write("review-slot-first.json", retainAsoiafAnswerActorRuntimeSlot(reviewSlotInput));
replay("slot", "review-slot-input.json", "review-slot-replay.json");
const reviewSlot = read<{ slot: { slotId: string } }>("review-slot-first.json").slot;

const reviewAcceptInput = {
  root: estateRoot,
  slotId: reviewSlot.slotId,
  deliveryId: reviewDelivery.deliveryId,
  importedAt: reviewDelivery.deliveredAt,
  operatorId: "operator:qualification:actor-runtime:review-accept",
};
write("review-accept-input.json", reviewAcceptInput);
write("review-accept-first.json", acceptAsoiafAnswerActorRuntimeDelivery(reviewAcceptInput));
replay("accept", "review-accept-input.json", "review-accept-replay.json");
const reviewAcceptance = read<{ acceptance: { acceptanceId: string } }>("review-accept-first.json").acceptance;
const reviewInput = digestBytes({
  deliveryId: reviewDelivery.deliveryId,
  assignmentFingerprint: reviewDelivery.assignmentFingerprint,
  action: reviewDelivery.assignment.action,
});
const reviewPrepareInput = {
  root: estateRoot,
  acceptanceId: reviewAcceptance.acceptanceId,
  adapterId: "adapter:qualification:exact-locator-reviewer",
  adapterVersion: "1.0.0",
  inputDigest: reviewInput.digest,
  inputBytes: reviewInput.bytes,
  preparedAt: reviewDelivery.deliveredAt,
  expiresAt: reviewDelivery.assignment.expiresAt,
  operatorId: "operator:qualification:actor-runtime:review-prepare",
};
write("review-prepare-input.json", reviewPrepareInput);
write("review-prepare-first.json", prepareAsoiafAnswerActorRuntimeExecution(reviewPrepareInput));
replay("prepare", "review-prepare-input.json", "review-prepare-replay.json");
const reviewExecution = read<{ intent: { executionIntentId: string } }>("review-prepare-first.json").intent;
const reviewOutput = digestBytes({
  outcome: reviewExchangeResult.outcome,
  afterWorkOrderFingerprint: reviewExchangeResult.afterWorkOrderFingerprint,
  resultReferences: reviewExchangeResult.resultReferences,
});
const reviewResultInput = {
  root: estateRoot,
  executionIntentId: reviewExecution.executionIntentId,
  providerResultId: transportProviderResult.resultId,
  outcome: reviewExchangeResult.outcome,
  afterWorkOrder: reviewExchangeResult.afterWorkOrder,
  resultReferences: reviewExchangeResult.resultReferences,
  reason: reviewExchangeResult.reason,
  outputDigest: reviewOutput.digest,
  outputBytes: reviewOutput.bytes,
  completedAt: reviewDelivery.deliveredAt,
  operatorId: "operator:qualification:actor-runtime:review-result",
};
write("review-result-input.json", reviewResultInput);
write("review-result-first.json", recordAsoiafAnswerActorRuntimeResult(reviewResultInput));
replay("result", "review-result-input.json", "review-result-replay.json");
const reviewResult = read<{ result: { runtimeResultId: string } }>("review-result-first.json").result;
const reviewReturnIntentInput = {
  root: estateRoot,
  runtimeResultId: reviewResult.runtimeResultId,
  slotId: reviewSlot.slotId,
  idempotencyKey: "qualification-actor-runtime-review-return-0001",
  preparedAt: reviewDelivery.deliveredAt,
  operatorId: "operator:qualification:actor-runtime:review-return-intent",
};
write("review-return-intent-input.json", reviewReturnIntentInput);
write("review-return-intent-first.json", prepareAsoiafAnswerActorRuntimeReturn(reviewReturnIntentInput));
replay("prepare-return", "review-return-intent-input.json", "review-return-intent-replay.json");
const reviewReturnIntent = read<{ intent: { returnIntentId: string } }>("review-return-intent-first.json").intent;
const reviewReceiptInput = {
  root: estateRoot,
  returnIntentId: reviewReturnIntent.returnIntentId,
  supervisedReturnId: reviewReturn.returnId,
  recordedAt: reviewReturn.completedAt,
  operatorId: "operator:qualification:actor-runtime:review-return-receipt",
};
write("review-return-receipt-input.json", reviewReceiptInput);
write("review-return-receipt-first.json", recordAsoiafAnswerActorRuntimeReturn(reviewReceiptInput));
replay("record-return", "review-return-receipt-input.json", "review-return-receipt-replay.json");
const reviewRetirementInput = {
  root: estateRoot,
  slotId: reviewSlot.slotId,
  kind: "scheduled" as const,
  retiredAt: at(reviewReturn.completedAt, 1),
  reason: "Every assignment delivered under this exact review runtime slot has a retained supervised return and settlement acknowledgement.",
  operatorId: "operator:qualification:actor-runtime:review-retire",
};
write("review-retirement-input.json", reviewRetirementInput);
write("review-retirement-first.json", retireAsoiafAnswerActorRuntimeSlot(reviewRetirementInput));
replay("retire", "review-retirement-input.json", "review-retirement-replay.json");

const successorSlotInput = {
  root: estateRoot,
  actorId: reviewDelivery.actorId,
  actorRole: reviewDelivery.actorRole,
  deliveryCertificateFingerprint: sha256("qualification-runtime-successor-delivery-certificate"),
  providerProfileId: profile.profileId,
  credentialRelationship: "explicit-delegation" as const,
  delegationReason,
  predecessorSlotId: reviewSlot.slotId,
  createdAt: at(reviewReturn.completedAt, 2),
  operatorId: "operator:qualification:actor-runtime:successor-slot",
};
write("successor-slot-input.json", successorSlotInput);
write("successor-slot-first.json", retainAsoiafAnswerActorRuntimeSlot(successorSlotInput));
replay("slot", "successor-slot-input.json", "successor-slot-replay.json");
const successorSlot = read<{ slot: { slotId: string } }>("successor-slot-first.json").slot;
write("successor-return-refusal-input.json", {
  ...reviewReturnIntentInput,
  slotId: successorSlot.slotId,
  idempotencyKey: "qualification-actor-runtime-successor-return-refusal",
  preparedAt: at(reviewReturn.completedAt, 3),
  operatorId: "operator:qualification:actor-runtime:successor-return-refusal",
});
refusal("prepare-return", "successor-return-refusal-input.json", "successor-return-refusal.json");

const closeSlotInput = {
  root: estateRoot,
  actorId: closeDelivery.actorId,
  actorRole: closeDelivery.actorRole,
  deliveryCertificateFingerprint: closeDelivery.certificateFingerprint,
  providerProfileId: profile.profileId,
  credentialRelationship: "explicit-delegation" as const,
  delegationReason,
  predecessorSlotId: null,
  createdAt: closeDelivery.deliveredAt,
  operatorId: "operator:qualification:actor-runtime:close-slot",
};
write("close-slot-input.json", closeSlotInput);
write("close-slot-first.json", retainAsoiafAnswerActorRuntimeSlot(closeSlotInput));
replay("slot", "close-slot-input.json", "close-slot-replay.json");
const closeSlot = read<{ slot: { slotId: string } }>("close-slot-first.json").slot;
const closeAcceptInput = {
  root: estateRoot,
  slotId: closeSlot.slotId,
  deliveryId: closeDelivery.deliveryId,
  importedAt: closeDelivery.deliveredAt,
  operatorId: "operator:qualification:actor-runtime:close-accept",
};
write("close-accept-input.json", closeAcceptInput);
write("close-accept-first.json", acceptAsoiafAnswerActorRuntimeDelivery(closeAcceptInput));
replay("accept", "close-accept-input.json", "close-accept-replay.json");
const closeAcceptance = read<{ acceptance: { acceptanceId: string } }>("close-accept-first.json").acceptance;
const closeInput = digestBytes({
  deliveryId: closeDelivery.deliveryId,
  assignmentFingerprint: closeDelivery.assignmentFingerprint,
  action: closeDelivery.assignment.action,
});
const closePrepareInput = {
  root: estateRoot,
  acceptanceId: closeAcceptance.acceptanceId,
  adapterId: "adapter:qualification:answer-assembler",
  adapterVersion: "1.0.0",
  inputDigest: closeInput.digest,
  inputBytes: closeInput.bytes,
  preparedAt: closeDelivery.deliveredAt,
  expiresAt: closeDelivery.assignment.expiresAt,
  operatorId: "operator:qualification:actor-runtime:close-prepare",
};
write("close-prepare-input.json", closePrepareInput);
write("close-prepare-first.json", prepareAsoiafAnswerActorRuntimeExecution(closePrepareInput));
replay("prepare", "close-prepare-input.json", "close-prepare-replay.json");
const closeExecution = read<{ intent: { executionIntentId: string } }>("close-prepare-first.json").intent;
const closeOutput = digestBytes({
  outcome: closeExchangeResult.outcome,
  afterWorkOrderFingerprint: closeExchangeResult.afterWorkOrderFingerprint,
  resultReferences: closeExchangeResult.resultReferences,
});
const closeResultInput = {
  root: estateRoot,
  executionIntentId: closeExecution.executionIntentId,
  providerResultId: possessionProviderResult.resultId,
  outcome: closeExchangeResult.outcome,
  afterWorkOrder: closeExchangeResult.afterWorkOrder,
  resultReferences: closeExchangeResult.resultReferences,
  reason: closeExchangeResult.reason,
  outputDigest: closeOutput.digest,
  outputBytes: closeOutput.bytes,
  completedAt: closeDelivery.deliveredAt,
  operatorId: "operator:qualification:actor-runtime:close-result",
};
write("close-result-input.json", closeResultInput);
write("close-result-first.json", recordAsoiafAnswerActorRuntimeResult(closeResultInput));
replay("result", "close-result-input.json", "close-result-replay.json");
const closeResult = read<{ result: { runtimeResultId: string } }>("close-result-first.json").result;
const closeReturnIntentInput = {
  root: estateRoot,
  runtimeResultId: closeResult.runtimeResultId,
  slotId: closeSlot.slotId,
  idempotencyKey: "qualification-actor-runtime-close-return-0001",
  preparedAt: closeDelivery.deliveredAt,
  operatorId: "operator:qualification:actor-runtime:close-return-intent",
};
write("close-return-intent-input.json", closeReturnIntentInput);
write("close-return-intent-first.json", prepareAsoiafAnswerActorRuntimeReturn(closeReturnIntentInput));
replay("prepare-return", "close-return-intent-input.json", "close-return-intent-replay.json");
const closeRetirementBase = at(
  deliveryStatus.returns.find((entry) => entry.deliveryId === closeDelivery.deliveryId)?.completedAt
    ?? closeDelivery.deliveredAt,
  1,
);
const closeScheduledRetirementInput = {
  root: estateRoot,
  slotId: closeSlot.slotId,
  kind: "scheduled" as const,
  retiredAt: closeRetirementBase,
  reason: "Scheduled retirement must refuse because the close-gap assignment has no retained actor-runtime return receipt.",
  operatorId: "operator:qualification:actor-runtime:close-retire-scheduled",
};
write("close-scheduled-retirement-input.json", closeScheduledRetirementInput);
refusal("retire", "close-scheduled-retirement-input.json", "close-scheduled-retirement-refusal.json");
const closeEmergencyRetirementInput = {
  ...closeScheduledRetirementInput,
  kind: "emergency" as const,
  reason: "Emergency retirement permanently strands the unresolved close-gap assignment and forbids every successor slot from inheriting it.",
  operatorId: "operator:qualification:actor-runtime:close-retire-emergency",
};
write("close-emergency-retirement-input.json", closeEmergencyRetirementInput);
write("close-emergency-retirement-first.json", retireAsoiafAnswerActorRuntimeSlot(closeEmergencyRetirementInput));
replay("retire", "close-emergency-retirement-input.json", "close-emergency-retirement-replay.json");

const status = readAsoiafAnswerActorRuntimeStatus(estateRoot);
const findings = verifyAsoiafAnswerActorRuntimeEstate(estateRoot);
const counts = {
  slots: status.slots.length,
  acceptances: status.acceptances.length,
  executionIntents: status.executionIntents.length,
  results: status.results.length,
  returnIntents: status.returnIntents.length,
  returnReceipts: status.returnReceipts.length,
  retirements: status.retirements.length,
  stranded: status.stranded.length,
  stateEntries: status.state?.entries.length ?? 0,
};
write("runtime-status.json", { ok: true, ...status, counts });
write("runtime-verification.json", {
  ok: findings.every((entry) => entry.severity !== "error"),
  findings,
  counts: {
    errors: findings.filter((entry) => entry.severity === "error").length,
    warnings: findings.filter((entry) => entry.severity === "warning").length,
    notices: findings.filter((entry) => entry.severity === "notice").length,
  },
  runtimeCounts: counts,
});
write("runtime-paths.json", status.paths);
write("expected.json", {
  estateRoot,
  reviewSlotId: reviewSlot.slotId,
  successorSlotId: successorSlot.slotId,
  closeSlotId: closeSlot.slotId,
  reviewDeliveryId: reviewDelivery.deliveryId,
  closeDeliveryId: closeDelivery.deliveryId,
  reviewReturnId: reviewReturn.returnId,
  providerProfileId: profile.profileId,
  transportProviderResultId: transportProviderResult.resultId,
  possessionProviderResultId: possessionProviderResult.resultId,
  counts,
  verificationCounts: {
    errors: findings.filter((entry) => entry.severity === "error").length,
    warnings: findings.filter((entry) => entry.severity === "warning").length,
    notices: findings.filter((entry) => entry.severity === "notice").length,
  },
  notices: findings.filter((entry) => entry.severity === "notice").map((entry) => entry.code),
});
if (findings.some((entry) => entry.severity === "error")) {
  throw new Error(`actor runtime fixture verification failed: ${findings.filter((entry) => entry.severity === "error").map((entry) => entry.code).join(", ")}`);
}
if (JSON.stringify(counts) !== JSON.stringify({
  slots: 3,
  acceptances: 2,
  executionIntents: 2,
  results: 2,
  returnIntents: 2,
  returnReceipts: 1,
  retirements: 2,
  stranded: 1,
  stateEntries: 2,
})) {
  throw new Error(`actor runtime fixture counts are unexpected: ${JSON.stringify(counts)}`);
}
fs.rmSync(deliveryReceipts, { recursive: true, force: true });
fs.rmSync(providerReceipts, { recursive: true, force: true });
process.stdout.write(`${JSON.stringify({
  ok: true,
  outputDirectory,
  estateRoot,
  counts,
  reviewSlotId: reviewSlot.slotId,
  closeSlotId: closeSlot.slotId,
}, null, 2)}\n`);
