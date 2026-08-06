import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  buildAsoiafAnswerCredentialTransportResultStatement,
  serializeAsoiafAnswerCredentialBrokerInvocation,
  serializeAsoiafAnswerCredentialTransportResultStatement,
  type AsoiafAnswerCredentialBrokerInvocation,
  type AsoiafAnswerCredentialPossessionProof,
} from "../../tools/lib/asoiaf-answer-credential-broker.js";
import {
  readAsoiafAnswerCredentialDeploymentStatus,
} from "../../tools/lib/asoiaf-answer-credential-deployment.js";
import {
  sha256,
} from "../../tools/lib/asoiaf-external-estate.js";

const outputDirectory = path.resolve(process.argv[2] ?? "");
const estateRoot = path.resolve(process.argv[3] ?? "");
if (!process.argv[2] || !process.argv[3]) {
  throw new Error("output directory and estate root arguments are required");
}
const deploymentFixture = path.join(outputDirectory, "deployment-fixture");
const materialDirectory = path.join(outputDirectory, "ephemeral-material");
fs.mkdirSync(outputDirectory, { recursive: true });

function run(command: string, args: string[], output?: string): unknown {
  const stdout = execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
  if (output) fs.writeFileSync(output, stdout, "utf8");
  return stdout.trim() ? JSON.parse(stdout) : null;
}

function npm(operator: string, command: string, input?: string, output?: string): unknown {
  const args = ["run", "--silent", operator, "--", command];
  if (input) args.push("--input", input);
  if (output) args.push("--out", output);
  return run("npm", args, output ? undefined : undefined);
}

function read<T>(target: string): T {
  return JSON.parse(fs.readFileSync(target, "utf8")) as T;
}

function write(target: string, value: unknown): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

run("npx", [
  "vite-node",
  "tests/fixtures/emit-asoiaf-answer-credential-deployment-input.ts",
  deploymentFixture,
  estateRoot,
  materialDirectory,
], path.join(outputDirectory, "deployment-fixture-emission.json"));

for (const [command, input, output] of [
  ["register-device", "device-input.json", "device-result.json"],
  ["register-key", "initial-key-input.json", "initial-key-result.json"],
  ["plan", "initial-plan-input.json", "initial-plan-result.json"],
  ["admit-installation", "initial-installation-input.json", "initial-installation-result.json"],
  ["admit-activation", "initial-activation-input.json", "initial-activation-result.json"],
] as const) {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-deployment", "--",
    command,
    "--input", path.join(deploymentFixture, input),
    "--out", path.join(outputDirectory, output),
  ]);
}
run("npm", [
  "run", "--silent", "asoiaf:answer-credential-deployment", "--",
  "verify", "--root", estateRoot,
  "--out", path.join(outputDirectory, "deployment-verification.json"),
]);

const deployment = readAsoiafAnswerCredentialDeploymentStatus(estateRoot);
if (!deployment.state || deployment.state.entries.length !== 1) {
  throw new Error("credential broker fixture requires one active deployment state entry");
}
const stateEntry = deployment.state.entries[0]!;
const device = deployment.devices.find((entry) => entry.deviceId === stateEntry.deviceId)!;
const plan = deployment.plans.find((entry) => entry.planId === stateEntry.planId)!;
const activation = deployment.activations.find(
  (entry) => entry.activationId === stateEntry.activationId,
)!;
const keyReference = deployment.keys.find(
  (entry) => entry.keyReferenceId === stateEntry.keyReferenceId,
)!;
const base = Date.parse(activation.statement.activatedAt);
const policyInput = {
  root: estateRoot,
  brokerId: "broker:qualification:device-local",
  deviceId: device.deviceId,
  serviceId: plan.serviceId,
  localEndpoint: "unix:///run/axm/answer-credential-broker.sock",
  allowedProviderClasses: [keyReference.providerClass],
  allowedOperations: ["prove-possession", "mutual-tls-request"],
  maxInvocationLifetimeMilliseconds: 10 * 60 * 1000,
  maxPossessionProofAgeMilliseconds: 15 * 60 * 1000,
  maxResponseBytes: 1_048_576,
  createdAt: new Date(base + 60_000).toISOString(),
  operatorId: "operator:qualification:broker-policy",
};
write(path.join(outputDirectory, "broker-policy-input.json"), policyInput);
run("npm", [
  "run", "--silent", "asoiaf:answer-credential-broker", "--",
  "policy", "--input", path.join(outputDirectory, "broker-policy-input.json"),
  "--out", path.join(outputDirectory, "broker-policy-result.json"),
]);
const policyResult = read<{ policy: { policyId: string; policyFingerprint: string } }>(
  path.join(outputDirectory, "broker-policy-result.json"),
);
const bindingInput = {
  root: estateRoot,
  policyId: policyResult.policy.policyId,
  boundAt: new Date(base + 120_000).toISOString(),
  operatorId: "operator:qualification:broker-binding",
};
write(path.join(outputDirectory, "broker-binding-input.json"), bindingInput);
run("npm", [
  "run", "--silent", "asoiaf:answer-credential-broker", "--",
  "bind", "--input", path.join(outputDirectory, "broker-binding-input.json"),
  "--out", path.join(outputDirectory, "broker-binding-result.json"),
]);
const bindingResult = read<{ binding: { bindingId: string; bindingFingerprint: string } }>(
  path.join(outputDirectory, "broker-binding-result.json"),
);

const possessionInput = {
  root: estateRoot,
  policyId: policyResult.policy.policyId,
  bindingId: bindingResult.binding.bindingId,
  operation: "prove-possession",
  idempotencyKey: "qualification-broker-possession-v1",
  request: {
    kind: "possession",
    challengeDigest: sha256("qualification-broker-possession-challenge"),
    contextDigest: sha256("qualification-broker-possession-context"),
  },
  createdAt: new Date(base + 180_000).toISOString(),
  expiresAt: new Date(base + 480_000).toISOString(),
  operatorId: "operator:qualification:broker-possession-invocation",
};
write(path.join(outputDirectory, "possession-invocation-input.json"), possessionInput);
run("npm", [
  "run", "--silent", "asoiaf:answer-credential-broker", "--",
  "invoke", "--input", path.join(outputDirectory, "possession-invocation-input.json"),
  "--out", path.join(outputDirectory, "possession-invocation-first.json"),
]);
run("npm", [
  "run", "--silent", "asoiaf:answer-credential-broker", "--",
  "invoke", "--input", path.join(outputDirectory, "possession-invocation-input.json"),
  "--out", path.join(outputDirectory, "possession-invocation-replay.json"),
]);
const possessionInvocation = read<{ invocation: AsoiafAnswerCredentialBrokerInvocation }>(
  path.join(outputDirectory, "possession-invocation-first.json"),
).invocation;
const credentialPrivateKey = crypto.createPrivateKey(
  fs.readFileSync(path.join(materialDirectory, "initial-client-key.pem")),
);
const possessionSignature = crypto.sign(
  "sha256",
  serializeAsoiafAnswerCredentialBrokerInvocation(possessionInvocation),
  credentialPrivateKey,
);
const possessionSignaturePath = path.join(materialDirectory, "possession-signature.bin");
fs.writeFileSync(possessionSignaturePath, possessionSignature);
const proofInput = {
  root: estateRoot,
  invocationId: possessionInvocation.invocationId,
  signatureAlgorithm: "rsa-sha256",
  signatureFile: possessionSignaturePath,
  provedAt: new Date(base + 240_000).toISOString(),
  operatorId: "operator:qualification:broker-proof",
};
write(path.join(outputDirectory, "possession-proof-input.json"), proofInput);
for (const output of ["possession-proof-first.json", "possession-proof-replay.json"]) {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-broker", "--",
    "admit-proof", "--input", path.join(outputDirectory, "possession-proof-input.json"),
    "--out", path.join(outputDirectory, output),
  ]);
}
const proof = read<{ proof: AsoiafAnswerCredentialPossessionProof }>(
  path.join(outputDirectory, "possession-proof-first.json"),
).proof;

const serverCertificateFingerprint = sha256("qualification-server-certificate");
const serverIssuerFingerprint = sha256("qualification-server-issuer");
const transportInvocationInput = {
  root: estateRoot,
  policyId: policyResult.policy.policyId,
  bindingId: bindingResult.binding.bindingId,
  operation: "mutual-tls-request",
  idempotencyKey: "qualification-broker-transport-v1",
  request: {
    kind: "mutual-tls",
    possessionProofId: proof.proofId,
    possessionProofFingerprint: proof.proofFingerprint,
    method: "POST",
    targetUrl: "https://answer-desk.example.test/v1/assignments/issue",
    requestBodyDigest: sha256("qualification-lower-request-body"),
    requestBodyBytes: 256,
    lowerIdempotencyKeyDigest: sha256("qualification-lower-idempotency-key"),
    expectedServerCertificateFingerprint: serverCertificateFingerprint,
    expectedServerIssuerFingerprint: serverIssuerFingerprint,
    maxResponseBytes: 65_536,
  },
  createdAt: new Date(base + 300_000).toISOString(),
  expiresAt: new Date(base + 600_000).toISOString(),
  operatorId: "operator:qualification:broker-transport-invocation",
};
write(path.join(outputDirectory, "transport-invocation-input.json"), transportInvocationInput);
for (const output of ["transport-invocation-first.json", "transport-invocation-replay.json"]) {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-broker", "--",
    "invoke", "--input", path.join(outputDirectory, "transport-invocation-input.json"),
    "--out", path.join(outputDirectory, output),
  ]);
}
const transportInvocation = read<{ invocation: AsoiafAnswerCredentialBrokerInvocation }>(
  path.join(outputDirectory, "transport-invocation-first.json"),
).invocation;
const transportStatementInput = {
  root: estateRoot,
  invocationId: transportInvocation.invocationId,
  lowerRequestId: "asoiaf-answer-transport-request:qualification-broker",
  lowerRequestFingerprint: sha256("qualification-lower-request"),
  lowerResponseId: "asoiaf-answer-transport-response:qualification-broker",
  lowerResponseFingerprint: sha256("qualification-lower-response"),
  observedServerCertificateFingerprint: serverCertificateFingerprint,
  observedServerIssuerFingerprint: serverIssuerFingerprint,
  httpStatus: 200,
  responseBytes: 1_024,
  responseDigest: sha256("qualification-lower-response-body"),
  providerReceiptDigest: sha256("qualification-provider-receipt"),
  startedAt: new Date(base + 360_000).toISOString(),
  completedAt: new Date(base + 420_000).toISOString(),
};
const statement = buildAsoiafAnswerCredentialTransportResultStatement(
  transportStatementInput,
);
write(path.join(outputDirectory, "transport-result-statement.json"), statement);
const agentPrivateKey = crypto.createPrivateKey(
  fs.readFileSync(path.join(materialDirectory, "device-agent-key.pem")),
);
const transportSignature = crypto.sign(
  null,
  serializeAsoiafAnswerCredentialTransportResultStatement(statement),
  agentPrivateKey,
);
const transportSignaturePath = path.join(materialDirectory, "transport-signature.bin");
fs.writeFileSync(transportSignaturePath, transportSignature);
const transportResultInput = {
  ...transportStatementInput,
  deviceAgentSignatureAlgorithm: "ed25519",
  signatureFile: transportSignaturePath,
  operatorId: "operator:qualification:broker-transport-result",
};
write(path.join(outputDirectory, "transport-result-input.json"), transportResultInput);
for (const output of ["transport-result-first.json", "transport-result-replay.json"]) {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-broker", "--",
    "admit-transport", "--input", path.join(outputDirectory, "transport-result-input.json"),
    "--out", path.join(outputDirectory, output),
  ]);
}
for (const [command, output] of [
  ["status", "broker-status.json"],
  ["verify", "broker-verification.json"],
  ["paths", "broker-paths.json"],
] as const) {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-broker", "--",
    command, "--root", estateRoot,
    "--out", path.join(outputDirectory, output),
  ]);
}

const brokerStatus = read<{
  counts: Record<string, number>;
  state: { stateId: string; stateFingerprint: string; entries: unknown[] };
}>(path.join(outputDirectory, "broker-status.json"));
const transportResult = read<{
  result: { resultId: string; resultFingerprint: string };
}>(path.join(outputDirectory, "transport-result-first.json"));
write(path.join(outputDirectory, "expected.json"), {
  estateRoot,
  serviceId: plan.serviceId,
  deviceId: device.deviceId,
  keyReferenceId: keyReference.keyReferenceId,
  planId: plan.planId,
  activationId: activation.activationId,
  certificateFingerprint: plan.certificateFingerprint,
  policyId: policyResult.policy.policyId,
  policyFingerprint: policyResult.policy.policyFingerprint,
  bindingId: bindingResult.binding.bindingId,
  bindingFingerprint: bindingResult.binding.bindingFingerprint,
  possessionInvocationId: possessionInvocation.invocationId,
  proofId: proof.proofId,
  proofFingerprint: proof.proofFingerprint,
  transportInvocationId: transportInvocation.invocationId,
  transportResultId: transportResult.result.resultId,
  transportResultFingerprint: transportResult.result.resultFingerprint,
  stateId: brokerStatus.state.stateId,
  stateFingerprint: brokerStatus.state.stateFingerprint,
  counts: brokerStatus.counts,
});

fs.rmSync(materialDirectory, { recursive: true, force: true });
for (const name of fs.readdirSync(deploymentFixture)) {
  if (/\.(?:key|crt|pem|csr|p12|pfx|bin)$/i.test(name)) {
    fs.rmSync(path.join(deploymentFixture, name), { force: true });
  }
}
process.stdout.write(`${JSON.stringify({
  ok: true,
  outputDirectory,
  estateRoot,
  policyId: policyResult.policy.policyId,
  bindingId: bindingResult.binding.bindingId,
  proofId: proof.proofId,
  transportResultId: transportResult.result.resultId,
}, null, 2)}\n`);
