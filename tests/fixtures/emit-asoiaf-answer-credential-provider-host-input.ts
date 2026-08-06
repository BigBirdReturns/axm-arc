import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  readAsoiafAnswerCredentialBrokerStatus,
} from "../../tools/lib/asoiaf-answer-credential-broker.js";
import {
  readAsoiafAnswerCredentialDeploymentStatus,
} from "../../tools/lib/asoiaf-answer-credential-deployment.js";
import {
  readAsoiafAnswerCredentialProviderStatus,
} from "../../tools/lib/asoiaf-answer-credential-provider-host.js";
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

function run(command: string, args: string[], receipt?: string): string {
  const stdout = execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
  if (receipt) fs.writeFileSync(receipt, stdout ? `${stdout}\n` : "", "utf8");
  return stdout;
}

function read<T>(target: string): T {
  return JSON.parse(fs.readFileSync(target, "utf8")) as T;
}

function write(target: string, value: unknown): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function output(name: string): string {
  return path.join(outputDirectory, name);
}

function deployment(command: string, inputName: string, outputName: string): void {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-deployment", "--",
    command,
    "--input", path.join(deploymentFixture, inputName),
    "--out", output(outputName),
  ]);
}

function broker(command: string, inputName: string, outputName: string): void {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-broker", "--",
    command,
    "--input", output(inputName),
    "--out", output(outputName),
  ]);
}

function provider(command: string, inputName: string, outputName: string): void {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-provider-host", "--",
    command,
    "--input", output(inputName),
    "--out", output(outputName),
  ]);
}

function rootCommand(operator: string, command: string, outputName: string): void {
  run("npm", [
    "run", "--silent", operator, "--",
    command,
    "--root", estateRoot,
    "--out", output(outputName),
  ]);
}

run("npx", [
  "vite-node",
  "tests/fixtures/emit-asoiaf-answer-credential-deployment-input.ts",
  deploymentFixture,
  estateRoot,
  materialDirectory,
], output("deployment-fixture-emission.json"));

deployment("register-device", "device-input.json", "device-result.json");
deployment("register-key", "initial-key-input.json", "initial-key-result.json");
deployment("plan", "initial-plan-input.json", "initial-plan-result.json");
deployment("admit-installation", "initial-installation-input.json", "initial-installation-result.json");
deployment("admit-activation", "initial-activation-input.json", "initial-activation-result.json");
rootCommand("asoiaf:answer-credential-deployment", "verify", "deployment-verification.json");

const deploymentStatus = readAsoiafAnswerCredentialDeploymentStatus(estateRoot);
if (!deploymentStatus.state || deploymentStatus.state.entries.length !== 1) {
  throw new Error("provider fixture requires one active deployment state entry");
}
const deploymentState = deploymentStatus.state.entries[0]!;
const device = deploymentStatus.devices.find((entry) => entry.deviceId === deploymentState.deviceId)!;
const plan = deploymentStatus.plans.find((entry) => entry.planId === deploymentState.planId)!;
const activation = deploymentStatus.activations.find((entry) => entry.activationId === deploymentState.activationId)!;
const keyReference = deploymentStatus.keys.find((entry) => entry.keyReferenceId === deploymentState.keyReferenceId)!;
const base = Date.parse(activation.statement.activatedAt);

write(output("broker-policy-input.json"), {
  root: estateRoot,
  brokerId: "broker:qualification:provider-host",
  deviceId: device.deviceId,
  serviceId: plan.serviceId,
  localEndpoint: "unix:///run/axm/answer-credential-provider-host.sock",
  allowedProviderClasses: [keyReference.providerClass],
  allowedOperations: ["prove-possession", "mutual-tls-request"],
  maxInvocationLifetimeMilliseconds: 600_000,
  maxPossessionProofAgeMilliseconds: 900_000,
  maxResponseBytes: 1_048_576,
  createdAt: new Date(base + 60_000).toISOString(),
  operatorId: "operator:qualification:provider-broker-policy",
});
broker("policy", "broker-policy-input.json", "broker-policy-result.json");
const brokerPolicy = read<{ policy: { policyId: string; policyFingerprint: string } }>(
  output("broker-policy-result.json"),
).policy;

write(output("broker-binding-input.json"), {
  root: estateRoot,
  policyId: brokerPolicy.policyId,
  boundAt: new Date(base + 120_000).toISOString(),
  operatorId: "operator:qualification:provider-broker-binding",
});
broker("bind", "broker-binding-input.json", "broker-binding-result.json");
const brokerBinding = read<{ binding: { bindingId: string; bindingFingerprint: string } }>(
  output("broker-binding-result.json"),
).binding;

write(output("provider-profile-input.json"), {
  root: estateRoot,
  brokerPolicyId: brokerPolicy.policyId,
  brokerBindingId: brokerBinding.bindingId,
  hostKind: "synthetic-fixture",
  credentialSelector: "synthetic:qualification:deployment-initial",
  deviceAgentSelector: "synthetic:qualification:device-agent",
  allowedTargetOrigins: ["https://answer-desk.example.test"],
  maxResponseBytes: 65_536,
  createdAt: new Date(base + 150_000).toISOString(),
  operatorId: "operator:qualification:provider-profile",
});
provider("profile", "provider-profile-input.json", "provider-profile-first.json");
provider("profile", "provider-profile-input.json", "provider-profile-replay.json");
const providerProfile = read<{ profile: { profileId: string; profileFingerprint: string } }>(
  output("provider-profile-first.json"),
).profile;

write(output("possession-broker-input.json"), {
  root: estateRoot,
  policyId: brokerPolicy.policyId,
  bindingId: brokerBinding.bindingId,
  operation: "prove-possession",
  idempotencyKey: "qualification-provider-possession-broker-v1",
  request: {
    kind: "possession",
    challengeDigest: sha256("qualification-provider-possession-challenge"),
    contextDigest: sha256("qualification-provider-possession-context"),
  },
  createdAt: new Date(base + 180_000).toISOString(),
  expiresAt: new Date(base + 480_000).toISOString(),
  operatorId: "operator:qualification:provider-possession-broker",
});
broker("invoke", "possession-broker-input.json", "possession-broker-result.json");
const possessionBroker = read<{ invocation: { invocationId: string; invocationFingerprint: string } }>(
  output("possession-broker-result.json"),
).invocation;

write(output("possession-provider-prepare-input.json"), {
  root: estateRoot,
  profileId: providerProfile.profileId,
  brokerInvocationId: possessionBroker.invocationId,
  idempotencyKey: "qualification-provider-possession-host-v1",
  preparedAt: new Date(base + 190_000).toISOString(),
  expiresAt: new Date(base + 470_000).toISOString(),
  operatorId: "operator:qualification:provider-possession-prepare",
});
provider("prepare", "possession-provider-prepare-input.json", "possession-provider-prepare-first.json");
provider("prepare", "possession-provider-prepare-input.json", "possession-provider-prepare-replay.json");
const possessionProvider = read<{ invocation: { providerInvocationId: string } }>(
  output("possession-provider-prepare-first.json"),
).invocation;

write(output("possession-provider-execution-input.json"), {
  root: estateRoot,
  providerInvocationId: possessionProvider.providerInvocationId,
  credentialPrivateKeyPem: fs.readFileSync(path.join(materialDirectory, "deployment-initial.key"), "utf8"),
  completedAt: new Date(base + 240_000).toISOString(),
  operatorId: "operator:qualification:provider-possession-execute",
});
provider("synthetic-proof", "possession-provider-execution-input.json", "possession-provider-result-first.json");
provider("synthetic-proof", "possession-provider-execution-input.json", "possession-provider-result-replay.json");
const possessionProviderResult = read<{
  result: { resultId: string; resultFingerprint: string; output: { brokerAdmissionInput: Record<string, unknown> } };
}>(output("possession-provider-result-first.json"));
write(output("possession-broker-admission-input.json"), {
  root: estateRoot,
  ...possessionProviderResult.result.output.brokerAdmissionInput,
});
broker("admit-proof", "possession-broker-admission-input.json", "possession-broker-admission-first.json");
broker("admit-proof", "possession-broker-admission-input.json", "possession-broker-admission-replay.json");
const proof = read<{ proof: { proofId: string; proofFingerprint: string } }>(
  output("possession-broker-admission-first.json"),
).proof;

const serverCertificateFingerprint = sha256("qualification-provider-server-certificate");
const serverIssuerFingerprint = sha256("qualification-provider-server-issuer");
const requestBody = Buffer.from(JSON.stringify({ operation: "qualification-provider-request" }), "utf8");
write(output("transport-broker-input.json"), {
  root: estateRoot,
  policyId: brokerPolicy.policyId,
  bindingId: brokerBinding.bindingId,
  operation: "mutual-tls-request",
  idempotencyKey: "qualification-provider-transport-broker-v1",
  request: {
    kind: "mutual-tls",
    possessionProofId: proof.proofId,
    possessionProofFingerprint: proof.proofFingerprint,
    method: "POST",
    targetUrl: "https://answer-desk.example.test/v1/assignments/issue",
    requestBodyDigest: `sha256:${crypto.createHash("sha256").update(requestBody).digest("hex")}`,
    requestBodyBytes: requestBody.length,
    lowerIdempotencyKeyDigest: sha256("qualification-provider-lower-idempotency"),
    expectedServerCertificateFingerprint: serverCertificateFingerprint,
    expectedServerIssuerFingerprint: serverIssuerFingerprint,
    maxResponseBytes: 65_536,
  },
  createdAt: new Date(base + 300_000).toISOString(),
  expiresAt: new Date(base + 600_000).toISOString(),
  operatorId: "operator:qualification:provider-transport-broker",
});
broker("invoke", "transport-broker-input.json", "transport-broker-result.json");
const transportBroker = read<{ invocation: { invocationId: string; invocationFingerprint: string } }>(
  output("transport-broker-result.json"),
).invocation;

write(output("transport-provider-prepare-input.json"), {
  root: estateRoot,
  profileId: providerProfile.profileId,
  brokerInvocationId: transportBroker.invocationId,
  idempotencyKey: "qualification-provider-transport-host-v1",
  preparedAt: new Date(base + 310_000).toISOString(),
  expiresAt: new Date(base + 590_000).toISOString(),
  operatorId: "operator:qualification:provider-transport-prepare",
});
provider("prepare", "transport-provider-prepare-input.json", "transport-provider-prepare-first.json");
provider("prepare", "transport-provider-prepare-input.json", "transport-provider-prepare-replay.json");
const transportProvider = read<{ invocation: { providerInvocationId: string } }>(
  output("transport-provider-prepare-first.json"),
).invocation;

const responseBody = Buffer.from(JSON.stringify({ ok: true, source: "synthetic-provider" }), "utf8");
write(output("transport-provider-execution-input.json"), {
  root: estateRoot,
  providerInvocationId: transportProvider.providerInvocationId,
  deviceAgentPrivateKeyPem: fs.readFileSync(path.join(materialDirectory, "device-agent.key"), "utf8"),
  lowerRequestId: "asoiaf-answer-transport-request:qualification-provider",
  lowerRequestFingerprint: sha256("qualification-provider-lower-request"),
  lowerResponseId: "asoiaf-answer-transport-response:qualification-provider",
  lowerResponseFingerprint: sha256("qualification-provider-lower-response"),
  observedServerCertificateFingerprint: serverCertificateFingerprint,
  observedServerIssuerFingerprint: serverIssuerFingerprint,
  httpStatus: 200,
  responseBodyBase64: responseBody.toString("base64"),
  providerReceiptDigest: sha256("qualification-provider-public-receipt"),
  startedAt: new Date(base + 360_000).toISOString(),
  completedAt: new Date(base + 420_000).toISOString(),
  operatorId: "operator:qualification:provider-transport-execute",
});
provider("synthetic-transport", "transport-provider-execution-input.json", "transport-provider-result-first.json");
provider("synthetic-transport", "transport-provider-execution-input.json", "transport-provider-result-replay.json");
const transportProviderResult = read<{
  result: { resultId: string; resultFingerprint: string; output: { brokerAdmissionInput: Record<string, unknown> } };
}>(output("transport-provider-result-first.json"));
write(output("transport-broker-admission-input.json"), {
  root: estateRoot,
  ...transportProviderResult.result.output.brokerAdmissionInput,
});
broker("admit-transport", "transport-broker-admission-input.json", "transport-broker-admission-first.json");
broker("admit-transport", "transport-broker-admission-input.json", "transport-broker-admission-replay.json");

rootCommand("asoiaf:answer-credential-provider-host", "status", "provider-status.json");
rootCommand("asoiaf:answer-credential-provider-host", "verify", "provider-verification.json");
rootCommand("asoiaf:answer-credential-provider-host", "paths", "provider-paths.json");
rootCommand("asoiaf:answer-credential-broker", "status", "broker-status.json");
rootCommand("asoiaf:answer-credential-broker", "verify", "broker-verification.json");

const providerStatus = readAsoiafAnswerCredentialProviderStatus(estateRoot);
const brokerStatus = readAsoiafAnswerCredentialBrokerStatus(estateRoot);
write(output("expected.json"), {
  estateRoot,
  deviceId: device.deviceId,
  serviceId: plan.serviceId,
  deploymentPlanId: plan.planId,
  deploymentActivationId: activation.activationId,
  brokerPolicyId: brokerPolicy.policyId,
  brokerBindingId: brokerBinding.bindingId,
  providerProfileId: providerProfile.profileId,
  possessionBrokerInvocationId: possessionBroker.invocationId,
  possessionProviderInvocationId: possessionProvider.providerInvocationId,
  possessionProviderResultId: possessionProviderResult.result.resultId,
  proofId: proof.proofId,
  transportBrokerInvocationId: transportBroker.invocationId,
  transportProviderInvocationId: transportProvider.providerInvocationId,
  transportProviderResultId: transportProviderResult.result.resultId,
  providerCounts: {
    profiles: providerStatus.profiles.length,
    invocations: providerStatus.invocations.length,
    results: providerStatus.results.length,
    stateEntries: providerStatus.state?.entries.length ?? 0,
  },
  brokerCounts: {
    policies: brokerStatus.policies.length,
    bindings: brokerStatus.bindings.length,
    invocations: brokerStatus.invocations.length,
    proofs: brokerStatus.proofs.length,
    transportResults: brokerStatus.transportResults.length,
  },
});

fs.rmSync(materialDirectory, { recursive: true, force: true });
for (const name of [
  "possession-provider-execution-input.json",
  "transport-provider-execution-input.json",
  "possession-broker-admission-input.json",
  "transport-broker-admission-input.json",
]) {
  fs.rmSync(output(name), { force: true });
}
for (const name of fs.readdirSync(deploymentFixture)) {
  if (/\.(?:key|crt|pem|csr|p12|pfx|bin)$/i.test(name)) {
    fs.rmSync(path.join(deploymentFixture, name), { force: true });
  }
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  outputDirectory,
  estateRoot,
  providerProfileId: providerProfile.profileId,
  possessionResultId: possessionProviderResult.result.resultId,
  transportResultId: transportProviderResult.result.resultId,
}, null, 2)}\n`);
