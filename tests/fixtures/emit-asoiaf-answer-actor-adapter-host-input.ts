import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  acceptAsoiafAnswerActorRuntimeDelivery,
  prepareAsoiafAnswerActorRuntimeExecution,
  readAsoiafAnswerActorRuntimeStatus,
  recordAsoiafAnswerActorRuntimeResult,
  retainAsoiafAnswerActorRuntimeSlot,
} from "../../tools/lib/asoiaf-answer-actor-runtime.js";
import {
  readAsoiafAnswerSupervisedDeliveryStatus,
} from "../../tools/lib/asoiaf-answer-desk-supervised-delivery.js";
import {
  readAsoiafAnswerCredentialProviderStatus,
} from "../../tools/lib/asoiaf-answer-credential-provider-host.js";
import {
  readAsoiafAnswerExchangeStatus,
} from "../../tools/lib/asoiaf-answer-desk-exchange.js";
import {
  readAsoiafAnswerActorAdapterHostStatus,
  verifyAsoiafAnswerActorAdapterHostEstate,
} from "../../tools/lib/asoiaf-answer-actor-adapter-host.js";
import {
  sha256,
} from "../../tools/lib/asoiaf-external-estate.js";

const outputDirectory = path.resolve(process.argv[2] ?? "");
const estateRoot = path.resolve(process.argv[3] ?? "");
if (!process.argv[2] || !process.argv[3]) {
  throw new Error("actor adapter fixture requires output directory and estate root arguments");
}
fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.rmSync(estateRoot, { recursive: true, force: true });
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
    maxBuffer: 256 * 1024 * 1024,
    timeout: 45 * 60 * 1000,
    stdio: ["ignore", "pipe", "inherit"],
  });
  fs.writeFileSync(path.join(outputDirectory, receipt), stdout, "utf8");
}

function adapterCli(command: string, inputName: string, outputName: string): void {
  execFileSync(process.execPath, [
    path.join("node_modules", "vite-node", "vite-node.mjs"),
    "tools/asoiaf-answer-actor-adapter-host.ts",
    command,
    "--input", path.join(outputDirectory, inputName),
    "--out", path.join(outputDirectory, outputName),
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function rootCli(command: "status" | "verify" | "paths", root: string, outputName: string): void {
  execFileSync(process.execPath, [
    path.join("node_modules", "vite-node", "vite-node.mjs"),
    "tools/asoiaf-answer-actor-adapter-host.ts",
    command,
    "--root", root,
    "--out", path.join(outputDirectory, outputName),
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function replay(command: string, inputName: string, stem: string): void {
  adapterCli(command, inputName, `${stem}-first.json`);
  adapterCli(command, inputName, `${stem}-replay.json`);
}

function refusal(command: string, inputName: string, outputName: string): void {
  const run = spawnSync(process.execPath, [
    path.join("node_modules", "vite-node", "vite-node.mjs"),
    "tools/asoiaf-answer-actor-adapter-host.ts",
    command,
    "--input", path.join(outputDirectory, inputName),
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  });
  if (run.status === 0) throw new Error(`actor adapter ${command} unexpectedly succeeded`);
  write(outputName, {
    command,
    exitCode: run.status,
    stderrDigest: sha256(run.stderr),
    message: run.stderr.trim().split(/\r?\n/)[0] ?? "",
  });
}

function at(value: string, offset: number): string {
  return new Date(Date.parse(value) + offset).toISOString();
}

function bytes(value: unknown): { buffer: Buffer; digest: `sha256:${string}`; bytes: number } {
  const buffer = Buffer.from(JSON.stringify(value), "utf8");
  return {
    buffer,
    digest: `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`,
    bytes: buffer.length,
  };
}

function writeAdapter(name: string, source: string): string {
  const target = path.join(outputDirectory, "ephemeral-adapters", name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source, "utf8");
  return target;
}

const successAdapter = writeAdapter("digest-evidence.cjs", String.raw`
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  const input = JSON.parse(raw);
  const args = process.argv.slice(2);
  const value = (name) => {
    const index = args.indexOf(name);
    if (index < 0 || index + 1 >= args.length) throw new Error("missing " + name);
    return args[index + 1];
  };
  const output = {
    format: "axm-asoiaf-answer-actor-adapter-output/1",
    invocationId: input.invocationId,
    invocationFingerprint: input.invocationFingerprint,
    runtimeExecutionIntentId: input.runtimeExecutionIntentId,
    runtimeExecutionIntentFingerprint: input.runtimeExecutionIntentFingerprint,
    adapterId: input.adapterId,
    adapterVersion: input.adapterVersion,
    resultKind: value("--result-kind"),
    outputDigest: value("--output-digest"),
    outputBytes: Number(value("--output-bytes")),
    rawOutputRetained: false,
    evidenceAuthority: "digest-evidence-only",
  };
  process.stdout.write(JSON.stringify(output));
});
`);

const timeoutAdapter = writeAdapter("timeout.cjs", String.raw`
process.stdin.resume();
setTimeout(() => process.exit(0), 30_000);
`);
const malformedAdapter = writeAdapter("malformed.cjs", String.raw`
process.stdin.resume();
process.stdin.on("end", () => process.stdout.write("not-json"));
`);
const failureAdapter = writeAdapter("failure.cjs", String.raw`
process.stdin.resume();
process.stdin.on("end", () => {
  process.stderr.write("bounded adapter failure");
  process.exit(17);
});
`);

const parentReceipts = path.join(outputDirectory, "parent-receipts");
runFixture(
  "tests/fixtures/emit-asoiaf-answer-desk-supervised-delivery-input.ts",
  ["--run-qualification", path.join(parentReceipts, "supervised-delivery"), estateRoot],
  "parent-supervised-delivery-emission.json",
);
runFixture(
  "tests/fixtures/emit-asoiaf-answer-credential-provider-host-input.ts",
  [path.join(parentReceipts, "provider-host"), estateRoot],
  "parent-provider-host-emission.json",
);
const parentSnapshot = path.join(outputDirectory, "parent-snapshot");
fs.cpSync(estateRoot, parentSnapshot, { recursive: true });
interface RuntimeContext {
  root: string;
  intent: ReturnType<typeof readAsoiafAnswerActorRuntimeStatus>["executionIntents"][number];
  acceptance: ReturnType<typeof readAsoiafAnswerActorRuntimeStatus>["acceptances"][number];
  rawInput: Buffer;
  providerResultId: string;
}

function createPartialRuntime(
  root: string,
  action: string,
  adapterId: string,
  providerResultKind: "transport-result" | "possession-proof" = "transport-result",
): RuntimeContext {
  const delivery = readAsoiafAnswerSupervisedDeliveryStatus(root).deliveries.find(
    (entry) => entry.assignment.action === action,
  );
  const profile = readAsoiafAnswerCredentialProviderStatus(root).profiles[0];
  const providerResult = readAsoiafAnswerCredentialProviderStatus(root).results.find(
    (entry) => entry.output.kind === providerResultKind,
  );
  if (!delivery || !profile || !providerResult) {
    throw new Error(`partial runtime parent missing for ${action}`);
  }
  const slot = retainAsoiafAnswerActorRuntimeSlot({
    root,
    actorId: delivery.actorId,
    actorRole: delivery.actorRole,
    deliveryCertificateFingerprint: delivery.certificateFingerprint,
    providerProfileId: profile.profileId,
    credentialRelationship: "explicit-delegation",
    delegationReason:
      "The holder explicitly binds this provider profile to the certificate-specific adapter qualification slot without granting scheduling, task, settlement, graph, canon, or answer authority.",
    predecessorSlotId: null,
    createdAt: delivery.deliveredAt,
    operatorId: `operator:qualification:adapter-partial:${action}:slot`,
  }).slot;
  const acceptance = acceptAsoiafAnswerActorRuntimeDelivery({
    root,
    slotId: slot.slotId,
    deliveryId: delivery.deliveryId,
    importedAt: delivery.deliveredAt,
    operatorId: `operator:qualification:adapter-partial:${action}:accept`,
  }).acceptance;
  const raw = bytes({
    deliveryId: delivery.deliveryId,
    assignmentFingerprint: delivery.assignmentFingerprint,
    action: delivery.assignment.action,
  });
  const intent = prepareAsoiafAnswerActorRuntimeExecution({
    root,
    acceptanceId: acceptance.acceptanceId,
    adapterId,
    adapterVersion: "1.0.0",
    inputDigest: raw.digest,
    inputBytes: raw.bytes,
    preparedAt: delivery.deliveredAt,
    expiresAt: delivery.assignment.expiresAt,
    operatorId: `operator:qualification:adapter-partial:${action}:prepare`,
  }).intent;
  return {
    root,
    intent,
    acceptance,
    rawInput: raw.buffer,
    providerResultId: providerResult.resultId,
  };
}

interface AdapterCaseResult {
  manifestId: string;
  installationId: string;
  invocationId: string;
  terminalId: string | null;
}

function adapterCase(input: {
  stem: string;
  context: RuntimeContext;
  bundlePath: string;
  resultKind: string;
  outputDigest: `sha256:${string}`;
  outputBytes: number;
  timeoutMilliseconds: number;
  execute: boolean;
}): AdapterCaseResult {
  const { stem, context } = input;
  const args = input.bundlePath === successAdapter
    ? [
        "{adapterBundle}",
        "--result-kind", input.resultKind,
        "--output-digest", input.outputDigest,
        "--output-bytes", String(input.outputBytes),
      ]
    : ["{adapterBundle}"];
  write(`${stem}-manifest-input.json`, {
    root: context.root,
    adapterId: context.intent.adapterId,
    adapterVersion: context.intent.adapterVersion,
    executablePath: process.execPath,
    adapterBundlePath: input.bundlePath,
    fixedArgumentTemplate: args,
    fixedEnvironment: { LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC" },
    allowedResultKinds: [input.resultKind],
    maxInputBytes: 1024 * 1024,
    maxStdoutBytes: 64 * 1024,
    maxStderrBytes: 64 * 1024,
    timeoutMilliseconds: input.timeoutMilliseconds,
    createdAt: context.intent.preparedAt,
    operatorId: `operator:qualification:adapter:${stem}:manifest`,
  });
  replay("manifest", `${stem}-manifest-input.json`, `${stem}-manifest`);
  const manifest = read<{ manifest: { manifestId: string } }>(`${stem}-manifest-first.json`).manifest;
  write(`${stem}-installation-input.json`, {
    root: context.root,
    manifestId: manifest.manifestId,
    hostId: "host:qualification:actor-adapter",
    executablePath: process.execPath,
    adapterBundlePath: input.bundlePath,
    installedAt: context.intent.preparedAt,
    operatorId: `operator:qualification:adapter:${stem}:installation`,
  });
  replay("install", `${stem}-installation-input.json`, `${stem}-installation`);
  const installation = read<{ installation: { installationId: string } }>(
    `${stem}-installation-first.json`,
  ).installation;
  write(`${stem}-prepare-input.json`, {
    root: context.root,
    manifestId: manifest.manifestId,
    installationId: installation.installationId,
    runtimeExecutionIntentId: context.intent.executionIntentId,
    providerResultId: context.providerResultId,
    idempotencyKey: `qualification-actor-adapter-${stem}-0001`,
    preparedAt: at(context.intent.preparedAt, 1),
    expiresAt: context.intent.expiresAt,
    operatorId: `operator:qualification:adapter:${stem}:prepare`,
  });
  replay("prepare", `${stem}-prepare-input.json`, `${stem}-prepare`);
  const invocation = read<{ invocation: { invocationId: string } }>(
    `${stem}-prepare-first.json`,
  ).invocation;
  write(`${stem}-execute-input.json`, {
    root: context.root,
    invocationId: invocation.invocationId,
    executablePath: process.execPath,
    adapterBundlePath: input.bundlePath,
    inputBase64: context.rawInput.toString("base64"),
    startedAt: at(context.intent.preparedAt, 2),
    operatorId: `operator:qualification:adapter:${stem}:execute`,
  });
  if (input.execute) replay("execute", `${stem}-execute-input.json`, `${stem}-execute`);
  const terminalId = input.execute
    ? read<{ terminal: { terminalId: string } }>(`${stem}-execute-first.json`).terminal.terminalId
    : null;
  return {
    manifestId: manifest.manifestId,
    installationId: installation.installationId,
    invocationId: invocation.invocationId,
    terminalId,
  };
}

const review = createPartialRuntime(
  estateRoot,
  "review-exact-locator",
  "adapter:qualification:exact-locator-reviewer",
  "transport-result",
);
const close = createPartialRuntime(
  estateRoot,
  "close-gap",
  "adapter:qualification:answer-assembler",
  "possession-proof",
);
const exchange = readAsoiafAnswerExchangeStatus(estateRoot);
const reviewExchangeResult = exchange.results.find(
  (entry) => entry.assignmentId === review.acceptance.assignmentId,
);
const closeExchangeResult = exchange.results.find(
  (entry) => entry.assignmentId === close.acceptance.assignmentId,
);
if (!reviewExchangeResult || !closeExchangeResult) {
  throw new Error("main adapter qualification requires typed exchange result parents");
}
const reviewOutput = bytes({
  outcome: reviewExchangeResult.outcome,
  afterWorkOrderFingerprint: reviewExchangeResult.afterWorkOrderFingerprint,
  resultReferences: reviewExchangeResult.resultReferences,
});
const closeOutput = bytes({
  outcome: closeExchangeResult.outcome,
  afterWorkOrderFingerprint: closeExchangeResult.afterWorkOrderFingerprint,
  resultReferences: closeExchangeResult.resultReferences,
});
const reviewCase = adapterCase({
  stem: "review-success",
  context: review,
  bundlePath: successAdapter,
  resultKind: review.acceptance.acceptedResultKinds[0]!,
  outputDigest: reviewOutput.digest,
  outputBytes: reviewOutput.bytes,
  timeoutMilliseconds: 10_000,
  execute: true,
});
const closeCase = adapterCase({
  stem: "close-success",
  context: close,
  bundlePath: successAdapter,
  resultKind: close.acceptance.acceptedResultKinds[0]!,
  outputDigest: closeOutput.digest,
  outputBytes: closeOutput.bytes,
  timeoutMilliseconds: 10_000,
  execute: true,
});
const reviewTerminal = read<{ terminal: { completedAt: string } }>(
  "review-success-execute-first.json",
).terminal;
const closeTerminal = read<{ terminal: { completedAt: string } }>(
  "close-success-execute-first.json",
).terminal;
recordAsoiafAnswerActorRuntimeResult({
  root: estateRoot,
  executionIntentId: review.intent.executionIntentId,
  providerResultId: review.providerResultId,
  outcome: reviewExchangeResult.outcome,
  afterWorkOrder: reviewExchangeResult.afterWorkOrder,
  resultReferences: reviewExchangeResult.resultReferences,
  reason: reviewExchangeResult.reason,
  outputDigest: reviewOutput.digest,
  outputBytes: reviewOutput.bytes,
  completedAt: reviewTerminal.completedAt,
  operatorId: "operator:qualification:adapter:review-runtime-result",
});
recordAsoiafAnswerActorRuntimeResult({
  root: estateRoot,
  executionIntentId: close.intent.executionIntentId,
  providerResultId: close.providerResultId,
  outcome: closeExchangeResult.outcome,
  afterWorkOrder: closeExchangeResult.afterWorkOrder,
  resultReferences: closeExchangeResult.resultReferences,
  reason: closeExchangeResult.reason,
  outputDigest: closeOutput.digest,
  outputBytes: closeOutput.bytes,
  completedAt: closeTerminal.completedAt,
  operatorId: "operator:qualification:adapter:close-runtime-result",
});

write("wrong-input-execute.json", {
  root: estateRoot,
  invocationId: reviewCase.invocationId,
  executablePath: process.execPath,
  adapterBundlePath: successAdapter,
  inputBase64: Buffer.from("changed-input", "utf8").toString("base64"),
  startedAt: at(review.intent.preparedAt, 2),
  operatorId: "operator:qualification:adapter:wrong-input",
});
refusal("execute", "wrong-input-execute.json", "wrong-input-refusal.json");
write("wrong-bundle-execute.json", {
  root: estateRoot,
  invocationId: reviewCase.invocationId,
  executablePath: process.execPath,
  adapterBundlePath: failureAdapter,
  inputBase64: review.rawInput.toString("base64"),
  startedAt: at(review.intent.preparedAt, 2),
  operatorId: "operator:qualification:adapter:wrong-bundle",
});
refusal("execute", "wrong-bundle-execute.json", "wrong-bundle-refusal.json");
rootCli("status", estateRoot, "adapter-status.json");
rootCli("verify", estateRoot, "adapter-verification.json");
rootCli("paths", estateRoot, "adapter-paths.json");

function variantRoot(name: string): string {
  const target = path.join(outputDirectory, "variant-estates", name);
  fs.cpSync(parentSnapshot, target, { recursive: true });
  return target;
}

const timeoutRoot = variantRoot("timeout");
const timeoutContext = createPartialRuntime(
  timeoutRoot,
  "review-exact-locator",
  "adapter:qualification:timeout",
);
const timeoutCase = adapterCase({
  stem: "timeout",
  context: timeoutContext,
  bundlePath: timeoutAdapter,
  resultKind: timeoutContext.acceptance.acceptedResultKinds[0]!,
  outputDigest: sha256("timeout-output"),
  outputBytes: 14,
  timeoutMilliseconds: 250,
  execute: true,
});
rootCli("verify", timeoutRoot, "timeout-verification.json");

const protocolRoot = variantRoot("protocol");
const protocolContext = createPartialRuntime(
  protocolRoot,
  "review-exact-locator",
  "adapter:qualification:protocol",
);
const protocolCase = adapterCase({
  stem: "protocol",
  context: protocolContext,
  bundlePath: malformedAdapter,
  resultKind: protocolContext.acceptance.acceptedResultKinds[0]!,
  outputDigest: sha256("protocol-output"),
  outputBytes: 15,
  timeoutMilliseconds: 5_000,
  execute: true,
});
rootCli("verify", protocolRoot, "protocol-verification.json");

const failureRoot = variantRoot("failure");
const failureContext = createPartialRuntime(
  failureRoot,
  "review-exact-locator",
  "adapter:qualification:failure",
);
const failureCase = adapterCase({
  stem: "failure",
  context: failureContext,
  bundlePath: failureAdapter,
  resultKind: failureContext.acceptance.acceptedResultKinds[0]!,
  outputDigest: sha256("failure-output"),
  outputBytes: 14,
  timeoutMilliseconds: 5_000,
  execute: true,
});
rootCli("verify", failureRoot, "failure-verification.json");

const interruptedRoot = variantRoot("interrupted");
const interruptedContext = createPartialRuntime(
  interruptedRoot,
  "review-exact-locator",
  "adapter:qualification:interrupted",
);
const interruptedCase = adapterCase({
  stem: "interrupted",
  context: interruptedContext,
  bundlePath: timeoutAdapter,
  resultKind: interruptedContext.acceptance.acceptedResultKinds[0]!,
  outputDigest: sha256("interrupted-output"),
  outputBytes: 18,
  timeoutMilliseconds: 5_000,
  execute: false,
});
adapterCli("start", "interrupted-execute-input.json", "interrupted-start-first.json");
write("interrupted-recover-input.json", {
  root: interruptedRoot,
  invocationId: interruptedCase.invocationId,
  recoveredAt: at(interruptedContext.intent.preparedAt, 3),
  reason:
    "The host process restarted after retaining the exact start receipt, so the invocation is closed as interrupted without launching a duplicate process.",
  operatorId: "operator:qualification:adapter:interrupted:recover",
});
replay("recover", "interrupted-recover-input.json", "interrupted-recover");
rootCli("verify", interruptedRoot, "interrupted-verification.json");

const mainStatus = readAsoiafAnswerActorAdapterHostStatus(estateRoot);
const mainFindings = verifyAsoiafAnswerActorAdapterHostEstate(estateRoot);
const counts = {
  manifests: mainStatus.manifests.length,
  installations: mainStatus.installations.length,
  invocations: mainStatus.invocations.length,
  starts: mainStatus.starts.length,
  terminals: mainStatus.terminals.length,
  stateEntries: mainStatus.state?.entries.length ?? 0,
};
if (mainFindings.some((entry) => entry.severity === "error")) {
  throw new Error(`main adapter verification failed: ${mainFindings.filter((entry) => entry.severity === "error").map((entry) => entry.code).join(", ")}`);
}
for (const name of ["timeout", "protocol", "failure", "interrupted"] as const) {
  const verification = read<{ ok: boolean; counts: { errors: number } }>(`${name}-verification.json`);
  if (!verification.ok || verification.counts.errors !== 0) {
    throw new Error(`${name} adapter variant did not verify cleanly`);
  }
}
if (JSON.stringify(counts) !== JSON.stringify({
  manifests: 2,
  installations: 2,
  invocations: 2,
  starts: 2,
  terminals: 2,
  stateEntries: 2,
})) {
  throw new Error(`main adapter counts are unexpected: ${JSON.stringify(counts)}`);
}
const terminalOutcomes = mainStatus.terminals.map((entry) => entry.outcome).sort();
if (JSON.stringify(terminalOutcomes) !== JSON.stringify(["succeeded", "succeeded"])) {
  throw new Error(`main adapter terminal outcomes are unexpected: ${JSON.stringify(terminalOutcomes)}`);
}
write("expected.json", {
  estateRoot,
  counts,
  reviewInvocationId: reviewCase.invocationId,
  closeInvocationId: closeCase.invocationId,
  timeoutInvocationId: timeoutCase.invocationId,
  protocolInvocationId: protocolCase.invocationId,
  failureInvocationId: failureCase.invocationId,
  interruptedInvocationId: interruptedCase.invocationId,
  variantOutcomes: {
    timeout: read<{ terminal: { outcome: string } }>("timeout-execute-first.json").terminal.outcome,
    protocol: read<{ terminal: { outcome: string } }>("protocol-execute-first.json").terminal.outcome,
    failure: read<{ terminal: { outcome: string } }>("failure-execute-first.json").terminal.outcome,
    interrupted: read<{ terminal: { outcome: string } }>("interrupted-recover-first.json").terminal.outcome,
  },
  mainVerificationCounts: {
    errors: mainFindings.filter((entry) => entry.severity === "error").length,
    warnings: mainFindings.filter((entry) => entry.severity === "warning").length,
    notices: mainFindings.filter((entry) => entry.severity === "notice").length,
  },
});

fs.rmSync(path.join(outputDirectory, "ephemeral-adapters"), { recursive: true, force: true });
fs.rmSync(parentSnapshot, { recursive: true, force: true });
fs.rmSync(parentReceipts, { recursive: true, force: true });
fs.rmSync(path.join(outputDirectory, "variant-estates"), { recursive: true, force: true });
process.stdout.write(`${JSON.stringify({
  ok: true,
  outputDirectory,
  estateRoot,
  counts,
  outcomes: {
    main: terminalOutcomes,
    timeout: "timed-out",
    protocol: "protocol-refused",
    failure: "failed",
    interrupted: "interrupted",
  },
}, null, 2)}\n`);
