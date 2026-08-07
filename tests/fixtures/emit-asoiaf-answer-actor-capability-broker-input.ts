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
  prepareAsoiafAnswerActorAdapterInvocation,
  readAsoiafAnswerActorAdapterHostStatus,
  retainAsoiafAnswerActorAdapterInstallation,
  retainAsoiafAnswerActorAdapterManifest,
} from "../../tools/lib/asoiaf-answer-actor-adapter-host.js";
import {
  readAsoiafAnswerActorCapabilityStatus,
  verifyAsoiafAnswerActorCapabilityBrokerEstate,
} from "../../tools/lib/asoiaf-answer-actor-capability-broker.js";
import {
  sha256,
} from "../../tools/lib/asoiaf-external-estate.js";

const outputDirectory = path.resolve(process.argv[2] ?? "");
const estateRoot = path.resolve(process.argv[3] ?? "");
if (!process.argv[2] || !process.argv[3]) {
  throw new Error("actor capability fixture requires output directory and estate root arguments");
}
if (process.platform !== "linux" || process.arch !== "x64") {
  throw new Error("actor capability fixture requires Linux x64");
}
fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.rmSync(estateRoot, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });
fs.mkdirSync(estateRoot, { recursive: true });
const compilerPath = fs.realpathSync(process.env.CC ?? "/usr/bin/cc");

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

function capabilityCli(command: string, inputName: string, outputName: string): void {
  execFileSync(process.execPath, [
    path.join("node_modules", "vite-node", "vite-node.mjs"),
    "tools/asoiaf-answer-actor-capability-broker.ts",
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
    "tools/asoiaf-answer-actor-capability-broker.ts",
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
  capabilityCli(command, inputName, `${stem}-first.json`);
  capabilityCli(command, inputName, `${stem}-replay.json`);
}

function refusal(command: string, inputName: string, outputName: string): void {
  const run = spawnSync(process.execPath, [
    path.join("node_modules", "vite-node", "vite-node.mjs"),
    "tools/asoiaf-answer-actor-capability-broker.ts",
    command,
    "--input", path.join(outputDirectory, inputName),
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  });
  if (run.status === 0) throw new Error(`actor capability ${command} unexpectedly succeeded`);
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

const successAdapter = writeAdapter("kernel-bound-digest-evidence.cjs", String.raw`
const fs = require("node:fs");
const net = require("node:net");
const { spawnSync } = require("node:child_process");
const { Worker } = require("node:worker_threads");

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", async () => {
  try {
    const expectedEnvironment = ["LANG", "LC_ALL", "TZ"];
    const actualEnvironment = Object.keys(process.env).sort();
    if (JSON.stringify(actualEnvironment) !== JSON.stringify(expectedEnvironment)) {
      throw new Error("unexpected environment: " + actualEnvironment.join(","));
    }
    const workerValue = await new Promise((resolve, reject) => {
      const worker = new Worker(
        'const { parentPort } = require("node:worker_threads"); parentPort.postMessage("thread-ok");',
        { eval: true },
      );
      worker.once("message", resolve);
      worker.once("error", reject);
    });
    if (workerValue !== "thread-ok") throw new Error("worker thread did not complete");
    let readCode = null;
    try { fs.readFileSync("/etc/passwd", "utf8"); }
    catch (error) { readCode = error.code; }
    if (readCode !== "EACCES") throw new Error("out-of-custody read was not denied: " + readCode);
    const forbiddenWrite = "/tmp/asoiaf-capability-forbidden-write";
    try { fs.unlinkSync(forbiddenWrite); } catch {}
    let writeCode = null;
    try { fs.writeFileSync(forbiddenWrite, "forbidden"); }
    catch (error) { writeCode = error.code; }
    if (writeCode !== "EACCES") throw new Error("out-of-custody write was not denied: " + writeCode);
    const processAttempt = spawnSync(process.execPath, ["-e", "process.exit(0)"]);
    if (processAttempt.error?.code !== "EPERM") {
      throw new Error("child process was not denied: " + (processAttempt.error?.code ?? processAttempt.status));
    }
    const networkCode = await new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port: 9 });
      socket.once("connect", () => resolve("CONNECTED"));
      socket.once("error", (error) => resolve(error.code));
    });
    if (networkCode !== "EPERM") throw new Error("network was not denied: " + networkCode);
    const input = JSON.parse(raw);
    const args = process.argv.slice(2);
    const value = (name) => {
      const index = args.indexOf(name);
      if (index < 0 || index + 1 >= args.length) throw new Error("missing " + name);
      return args[index + 1];
    };
    process.stdout.write(JSON.stringify({
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
    }));
  } catch (error) {
    process.stderr.write(String(error.stack ?? error));
    process.exitCode = 23;
  }
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
  process.stderr.write("bounded isolated adapter failure");
  process.exit(17);
});
`);
const oversizedAdapter = writeAdapter("oversized.cjs", String.raw`
const fs = require("node:fs");
process.stdin.resume();
process.stdin.on("end", () => {
  fs.writeFileSync("oversized.bin", Buffer.alloc(2 * 1024 * 1024));
  process.stdout.write("unexpected-success");
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
    throw new Error(`partial capability runtime parent missing for ${action}`);
  }
  const slot = retainAsoiafAnswerActorRuntimeSlot({
    root,
    actorId: delivery.actorId,
    actorRole: delivery.actorRole,
    deliveryCertificateFingerprint: delivery.certificateFingerprint,
    providerProfileId: profile.profileId,
    credentialRelationship: "explicit-delegation",
    delegationReason:
      "The holder explicitly binds this provider profile to the certificate-specific capability qualification slot without granting scheduling, task, settlement, graph, canon, or answer authority.",
    predecessorSlotId: null,
    createdAt: delivery.deliveredAt,
    operatorId: `operator:qualification:capability-partial:${action}:slot`,
  }).slot;
  const acceptance = acceptAsoiafAnswerActorRuntimeDelivery({
    root,
    slotId: slot.slotId,
    deliveryId: delivery.deliveryId,
    importedAt: delivery.deliveredAt,
    operatorId: `operator:qualification:capability-partial:${action}:accept`,
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
    operatorId: `operator:qualification:capability-partial:${action}:prepare`,
  }).intent;
  return {
    root,
    intent,
    acceptance,
    rawInput: raw.buffer,
    providerResultId: providerResult.resultId,
  };
}

interface CapabilityCaseResult {
  manifestId: string;
  installationId: string;
  invocationId: string;
  policyId: string;
  terminalId: string | null;
}

function capabilityCase(input: {
  stem: string;
  context: RuntimeContext;
  bundlePath: string;
  resultKind: string;
  outputDigest: `sha256:${string}`;
  outputBytes: number;
  timeoutMilliseconds: number;
  execute: boolean;
}): CapabilityCaseResult {
  const args = input.bundlePath === successAdapter
    ? [
        "{adapterBundle}",
        "--result-kind", input.resultKind,
        "--output-digest", input.outputDigest,
        "--output-bytes", String(input.outputBytes),
      ]
    : ["{adapterBundle}"];
  const manifest = retainAsoiafAnswerActorAdapterManifest({
    root: input.context.root,
    adapterId: input.context.intent.adapterId,
    adapterVersion: input.context.intent.adapterVersion,
    executablePath: process.execPath,
    adapterBundlePath: input.bundlePath,
    fixedArgumentTemplate: args,
    fixedEnvironment: { LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC" },
    allowedResultKinds: [input.resultKind],
    maxInputBytes: 1024 * 1024,
    maxStdoutBytes: 64 * 1024,
    maxStderrBytes: 64 * 1024,
    timeoutMilliseconds: input.timeoutMilliseconds,
    createdAt: input.context.intent.preparedAt,
    operatorId: `operator:qualification:capability:${input.stem}:manifest`,
  }).manifest;
  const installation = retainAsoiafAnswerActorAdapterInstallation({
    root: input.context.root,
    manifestId: manifest.manifestId,
    hostId: "host:qualification:actor-capability",
    executablePath: process.execPath,
    adapterBundlePath: input.bundlePath,
    installedAt: input.context.intent.preparedAt,
    operatorId: `operator:qualification:capability:${input.stem}:installation`,
  }).installation;
  write(`${input.stem}-bind-input.json`, {
    root: input.context.root,
    manifestId: manifest.manifestId,
    installationId: installation.installationId,
    compilerPath,
    executablePath: process.execPath,
    boundAt: at(input.context.intent.preparedAt, 1),
    operatorId: `operator:qualification:capability:${input.stem}:bind`,
  });
  replay("bind", `${input.stem}-bind-input.json`, `${input.stem}-bind`);
  const policy = read<{ policy: { policyId: string } }>(`${input.stem}-bind-first.json`).policy;
  const invocation = prepareAsoiafAnswerActorAdapterInvocation({
    root: input.context.root,
    manifestId: manifest.manifestId,
    installationId: installation.installationId,
    runtimeExecutionIntentId: input.context.intent.executionIntentId,
    providerResultId: input.context.providerResultId,
    idempotencyKey: `qualification-actor-capability-${input.stem}-0001`,
    preparedAt: at(input.context.intent.preparedAt, 2),
    expiresAt: input.context.intent.expiresAt,
    operatorId: `operator:qualification:capability:${input.stem}:prepare`,
  }).invocation;
  write(`${input.stem}-execute-input.json`, {
    root: input.context.root,
    policyId: policy.policyId,
    invocationId: invocation.invocationId,
    compilerPath,
    executablePath: process.execPath,
    adapterBundlePath: input.bundlePath,
    inputBase64: input.context.rawInput.toString("base64"),
    startedAt: at(input.context.intent.preparedAt, 3),
    operatorId: `operator:qualification:capability:${input.stem}:execute`,
  });
  if (input.execute) replay("execute", `${input.stem}-execute-input.json`, `${input.stem}-execute`);
  const terminalId = input.execute
    ? read<{ terminal: { terminalId: string } }>(`${input.stem}-execute-first.json`).terminal.terminalId
    : null;
  return {
    manifestId: manifest.manifestId,
    installationId: installation.installationId,
    invocationId: invocation.invocationId,
    policyId: policy.policyId,
    terminalId,
  };
}

const review = createPartialRuntime(
  estateRoot,
  "review-exact-locator",
  "adapter:qualification:kernel-bound-reviewer",
  "transport-result",
);
const close = createPartialRuntime(
  estateRoot,
  "close-gap",
  "adapter:qualification:kernel-bound-assembler",
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
  throw new Error("capability qualification requires typed exchange result parents");
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
const reviewCase = capabilityCase({
  stem: "review-success",
  context: review,
  bundlePath: successAdapter,
  resultKind: review.acceptance.acceptedResultKinds[0]!,
  outputDigest: reviewOutput.digest,
  outputBytes: reviewOutput.bytes,
  timeoutMilliseconds: 10_000,
  execute: true,
});
const closeCase = capabilityCase({
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
  operatorId: "operator:qualification:capability:review-runtime-result",
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
  operatorId: "operator:qualification:capability:close-runtime-result",
});

write("wrong-input-execute.json", {
  root: estateRoot,
  policyId: reviewCase.policyId,
  invocationId: reviewCase.invocationId,
  compilerPath,
  executablePath: process.execPath,
  adapterBundlePath: successAdapter,
  inputBase64: Buffer.from("changed-input", "utf8").toString("base64"),
  startedAt: at(review.intent.preparedAt, 3),
  operatorId: "operator:qualification:capability:wrong-input",
});
refusal("execute", "wrong-input-execute.json", "wrong-input-refusal.json");
write("wrong-bundle-execute.json", {
  root: estateRoot,
  policyId: reviewCase.policyId,
  invocationId: reviewCase.invocationId,
  compilerPath,
  executablePath: process.execPath,
  adapterBundlePath: failureAdapter,
  inputBase64: review.rawInput.toString("base64"),
  startedAt: at(review.intent.preparedAt, 3),
  operatorId: "operator:qualification:capability:wrong-bundle",
});
refusal("execute", "wrong-bundle-execute.json", "wrong-bundle-refusal.json");

function variantRoot(name: string): string {
  const root = path.join(outputDirectory, "variant-estates", name);
  fs.cpSync(parentSnapshot, root, { recursive: true });
  return root;
}

function variantCase(input: {
  name: string;
  bundlePath: string;
  timeoutMilliseconds: number;
  execute?: boolean;
}): CapabilityCaseResult {
  const root = variantRoot(input.name);
  const context = createPartialRuntime(
    root,
    "review-exact-locator",
    `adapter:qualification:capability:${input.name}`,
  );
  return capabilityCase({
    stem: input.name,
    context,
    bundlePath: input.bundlePath,
    resultKind: context.acceptance.acceptedResultKinds[0]!,
    outputDigest: bytes({ variant: input.name }).digest,
    outputBytes: bytes({ variant: input.name }).bytes,
    timeoutMilliseconds: input.timeoutMilliseconds,
    execute: input.execute ?? true,
  });
}

const timeoutCase = variantCase({ name: "timeout", bundlePath: timeoutAdapter, timeoutMilliseconds: 200 });
const protocolCase = variantCase({ name: "protocol", bundlePath: malformedAdapter, timeoutMilliseconds: 10_000 });
const failureCase = variantCase({ name: "failure", bundlePath: failureAdapter, timeoutMilliseconds: 10_000 });
const oversizedCase = variantCase({ name: "oversized", bundlePath: oversizedAdapter, timeoutMilliseconds: 10_000 });
const interruptedCase = variantCase({
  name: "interrupted",
  bundlePath: successAdapter,
  timeoutMilliseconds: 10_000,
  execute: false,
});
capabilityCli("start", "interrupted-execute-input.json", "interrupted-start-first.json");
capabilityCli("start", "interrupted-execute-input.json", "interrupted-start-replay.json");
write("interrupted-recover-input.json", {
  root: path.join(outputDirectory, "variant-estates", "interrupted"),
  invocationId: interruptedCase.invocationId,
  recoveredAt: at(new Date().toISOString(), 1),
  reason:
    "The retained isolated start is closed after restart without launching a duplicate process or releasing the task envelope.",
  operatorId: "operator:qualification:capability:interrupted:recover",
});
replay("recover", "interrupted-recover-input.json", "interrupted-recover");

rootCli("status", estateRoot, "capability-status.json");
rootCli("verify", estateRoot, "capability-verification.json");
rootCli("paths", estateRoot, "capability-paths.json");
const mainStatus = readAsoiafAnswerActorCapabilityStatus(estateRoot);
const mainFindings = verifyAsoiafAnswerActorCapabilityBrokerEstate(estateRoot);
const counts = {
  policies: mainStatus.policies.length,
  starts: mainStatus.starts.length,
  terminals: mainStatus.terminals.length,
  stateEntries: mainStatus.state?.entries.length ?? 0,
  isolatedTerminals: mainStatus.terminals.filter((entry) => entry.osIsolationEnforced).length,
};
const variantOutcomes = {
  timeout: read<{ terminal: { outcome: string } }>("timeout-execute-first.json").terminal.outcome,
  protocol: read<{ terminal: { outcome: string } }>("protocol-execute-first.json").terminal.outcome,
  failure: read<{ terminal: { outcome: string } }>("failure-execute-first.json").terminal.outcome,
  oversized: read<{ terminal: { outcome: string } }>("oversized-execute-first.json").terminal.outcome,
  interrupted: read<{ terminal: { outcome: string } }>("interrupted-recover-first.json").terminal.outcome,
};
write("expected.json", {
  counts,
  reviewInvocationId: reviewCase.invocationId,
  closeInvocationId: closeCase.invocationId,
  timeoutInvocationId: timeoutCase.invocationId,
  protocolInvocationId: protocolCase.invocationId,
  failureInvocationId: failureCase.invocationId,
  oversizedInvocationId: oversizedCase.invocationId,
  interruptedInvocationId: interruptedCase.invocationId,
  variantOutcomes,
  mainVerificationCounts: {
    errors: mainFindings.filter((entry) => entry.severity === "error").length,
    warnings: mainFindings.filter((entry) => entry.severity === "warning").length,
    notices: mainFindings.filter((entry) => entry.severity === "notice").length,
  },
  parentAdapterCounts: {
    manifests: readAsoiafAnswerActorAdapterHostStatus(estateRoot).manifests.length,
    installations: readAsoiafAnswerActorAdapterHostStatus(estateRoot).installations.length,
    invocations: readAsoiafAnswerActorAdapterHostStatus(estateRoot).invocations.length,
    starts: readAsoiafAnswerActorAdapterHostStatus(estateRoot).starts.length,
    terminals: readAsoiafAnswerActorAdapterHostStatus(estateRoot).terminals.length,
  },
});
process.stdout.write(`${JSON.stringify({ ok: true, counts, variantOutcomes })}\n`);
