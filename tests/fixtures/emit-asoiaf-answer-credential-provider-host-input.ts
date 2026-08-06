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

function run(command: string, args: string[], output?: string): unknown {
  const stdout = Bun.spawnSync([command, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdout: "pipe",
    stderr: "inherit",
  });
  if (stdout.exitCode !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited ${stdout.exitCode}`);
  }
  const text = new TextDecoder().decode(stdout.stdout).trim();
  if (output) fs.writeFileSync(output, text ? `${text}\n` : "", "utf8");
  return text ? JSON.parse(text) : null;
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
  throw new Error("provider fixture requires one active deployment state entry");
}
const stateEntry = deployment.state.entries[0]!;
const device = deployment.devices.find((entry) => entry.deviceId === stateEntry.deviceId)!;
const plan = deployment.plans.find((entry) => entry.planId === stateEntry.planId)!;
const activation = deployment.activations.find((entry) => entry.activationId === stateEntry.activationId)!;
const keyReference = deployment.keys.find((entry) => entry.keyReferenceId === stateEntry.keyReferenceId)!;
const base = Date.parse(activation.statement.activatedAt);

const brokerPolicyInput = {
  root: estateRoot,
  brokerId: "broker:qualification:provider-host",
  deviceId: device.deviceId,
  serviceId: plan.serviceId,
  localEndpoint: "unix:///run/axm/answer-credential-provider-host.sock",
  allowedProviderClasses: [keyReference.providerClass],
  allowedOperations: ["prove-possession", "mutual-tls-request"],
  maxInvocationLifetimeMilliseconds: 10 * 60 * 1000,
  maxPossessionProofAgeMilliseconds: 15 * 60 * 1000,
  maxResponseBytes: 1_048_576,
  createdAt: new Date(base + 60_000).toISOString(),
  operatorId: "operator:qualification:provider-broker-policy",
};
write(path.join(outputDirectory, "broker-policy-input.json"), brokerPolicyInput);
run("npm", [
  "run", "--silent", "asoiaf:answer-credential-broker", "--",
  "policy", "--input", path.join(outputDirectory, "broker-policy-input.json"),
  "--out", path.join(outputDirectory, "broker-policy-result.json"),
]);
const brokerPolicy = read<{ policy: { policyId: string; policyFingerprint: string } }>(
  path.join(outputDirectory, "broker-policy-result.json"),
).policy;

const brokerBindingInput = {
  root: estateRoot,
  policyId: brokerPolicy.policyId,
  boundAt: new Date(base + 120_000).toISOString(),
  operatorId: "operator:qualification:provider-broker-binding",
};
write(path.join(outputDirectory, "broker-binding-input.json"), brokerBindingInput);
run("npm", [
  "run", "--silent", "asoiaf:answer-credential-broker", "--",
  "bind", "--input", path.join(outputDirectory, "broker-binding-input.json"),
  "--out", path.join(outputDirectory, "broker-binding-result.json"),
]);
const brokerBinding = read<{ binding: { bindingId: string; bindingFingerprint: string } }>(
  path.join(outputDirectory, "broker-binding-result.json"),
).binding;

const providerProfileInput = {
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
};
write(path.join(outputDirectory, "provider-profile-input.json"), providerProfileInput);
for (const output of ["provider-profile-first.json", "provider-profile-replay.json"]) {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-provider-host", "--",
    "profile", "--input", path.join(outputDirectory, "provider-profile-input.json"),
    "--out", path.join(outputDirectory, output),
  ]);
}
const providerProfile = read<{ profile: { profileId: string; profileFingerprint: string } }>(
  path.join(outputDirectory, "provider-profile-first.json"),
).profile;

const possessionBrokerInput = {
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
};
write(path.join(outputDirectory, "possession-broker-input.json"), possessionBrokerInput);
run("npm", [
  "run", "--silent", "asoiaf:answer-credential-broker", "--",
  "invoke", "--input", path.join(outputDirectory, "possession-broker-input.json"),
  "--out", path.join(outputDirectory, "possession-broker-result.json"),
]);
const possessionBroker = read<{ invocation: { invocationId: string; invocationFingerprint: string } }>(
  path.join(outputDirectory, "possession-broker-result.json"),
).invocation;

const possessionPrepareInput = {
  root: estateRoot,
  profileId: providerProfile.profileId,
  brokerInvocationId: possessionBroker.invocationId,
  idempotencyKey: "qualification-provider-possession-host-v1",
  preparedAt: new Date(base + 190_000).toISOString(),
  expiresAt: new Date(base + 470_000).toISOString(),
  operatorId: "operator:qualification:provider-possession-prepare",
};
write(path.join(outputDirectory, "possession-provider-prepare-input.json"), possessionPrepareInput);
for (const output of ["possession-provider-prepare-first.json", "possession-provider-prepare-replay.json"]) {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-provider-host", "--",
    "prepare", "--input", path.join(outputDirectory, "possession-provider-prepare-input.json"),
    "--out", path.join(outputDirectory, output),
  ]);
}
const possessionProvider = read<{ invocation: { providerInvocationId: string } }>(
  path.join(outputDirectory, "possession-provider-prepare-first.json"),
).invocation;
const possessionExecutionInput = {
  root: estateRoot,
  providerInvocationId: possessionProvider.providerInvocationId,
  credentialPrivateKeyPem: fs.readFileSync(path.join(materialDirectory, "deployment-initial.key"), "utf8"),
  completedAt: new Date(base + 240_000).toISOString(),
  operatorId: "operator:qualification:provider-possession-execute",
};
write(path.join(outputDirectory, "possession-provider-execution-input.json"), possessionExecutionInput);
for (const output of ["possession-provider-result-first.json", "possession-provider-result-replay.json"]) {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-provider-host", "--",
    "synthetic-proof", "--input", path.join(outputDirectory, "possession-provider-execution-input.json"),
    "--out", path.join(outputDirectory, output),
  ]);
}
const possessionProviderResult = read<{
  result: { resultId: string; resultFingerprint: string; output: { brokerAdmissionInput: unknown } };
}>(path.join(outputDirectory, "possession-provider-result-first.json"));
write(
  path.join(outputDirectory, "possession-broker-admission-input.json"),
  { root: estateRoot, ...(possessionProviderResult.result.output.brokerAdmissionInput as object) },
);
for (const output of ["possession-broker-admission-first.json", "possession-broker-admission-replay.json"]) {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-broker", "--",
    "admit-proof", "--input", path.join(outputDirectory, "possession-broker-admission-input.json"),
    "--out", path.join(outputDirectory, output),
  ]);
}
const proof = read<{ proof: { proofId: string; proofFingerprint: string } }>(
  path.join(outputDirectory, "possession-broker-admission-first.json"),
).proof;

const serverCertificateFingerprint = sha256("qualification-provider-server-certificate");
const serverIssuerFingerprint = sha256("qualification-provider-server-issuer");
const requestBody = Buffer.from(JSON.stringify({ operation: "qualification-provider-request" }), "utf8");
const transportBrokerInput = {
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
};
write(path.join(outputDirectory, "transport-broker-input.json"), transportBrokerInput);
run("npm", [
  "run", "--silent", "asoiaf:answer-credential-broker", "--",
  "invoke", "--input", path.join(outputDirectory, "transport-broker-input.json"),
  "--out", path.join(outputDirectory, "transport-broker-result.json"),
]);
const transportBroker = read<{ invocation: { invocationId: string; invocationFingerprint: string } }>(
  path.join(outputDirectory, "transport-broker-result.json"),
).invocation;

const transportPrepareInput = {
  root: estateRoot,
  profileId: providerProfile.profileId,
  brokerInvocationId: transportBroker.invocationId,
  idempotencyKey: "qualification-provider-transport-host-v1",
  preparedAt: new Date(base + 310_000).toISOString(),
  expiresAt: new Date(base + 590_000).toISOString(),
  operatorId: "operator:qualification:provider-transport-prepare",
};
write(path.join(outputDirectory, "transport-provider-prepare-input.json"), transportPrepareInput);
for (const output of ["transport-provider-prepare-first.json", "transport-provider-prepare-replay.json"]) {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-provider-host", "--",
    "prepare", "--input", path.join(outputDirectory, "transport-provider-prepare-input.json"),
    "--out", path.join(outputDirectory, output),
  ]);
}
const transportProvider = read<{ invocation: { providerInvocationId: string } }>(
  path.join(outputDirectory, "transport-provider-prepare-first.json"),
).invocation;
const responseBody = Buffer.from(JSON.stringify({ ok: true, source: "synthetic-provider" }), "utf8");
const transportExecutionInput = {
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
};
write(path.join(outputDirectory, "transport-provider-execution-input.json"), transportExecutionInput);
for (const output of ["transport-provider-result-first.json", "transport-provider-result-replay.json"]) {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-provider-host", "--",
    "synthetic-transport", "--input", path.join(outputDirectory, "transport-provider-execution-input.json"),
    "--out", path.join(outputDirectory, output),
  ]);
}
const transportProviderResult = read<{
  result: { resultId: string; resultFingerprint: string; output: { brokerAdmissionInput: unknown } };
}>(path.join(outputDirectory, "transport-provider-result-first.json"));
write(
  path.join(outputDirectory, "transport-broker-admission-input.json"),
  { root: estateRoot, ...(transportProviderResult.result.output.brokerAdmissionInput as object) },
);
for (const output of ["transport-broker-admission-first.json", "transport-broker-admission-replay.json"]) {
  run("npm", [
    "run", "--silent", "asoiaf:answer-credential-broker", "--",
    "admit-transport", "--input", path.join(outputDirectory, "transport-broker-admission-input.json"),
    "--out", path.join(outputDirectory, output),
  ]);
}

for (const [operator, command, output] of [
  ["asoiaf:answer-credential-provider-host", "status", "provider-status.json"],
  ["asoiaf:answer-credential-provider-host", "verify", "provider-verification.json"],
  ["asoiaf:answer-credential-provider-host", "paths", "provider-paths.json"],
  ["asoiaf:answer-credential-broker", "status", "broker-status.json"],
  ["asoiaf:answer-credential-broker", "verify", "broker-verification.json"],
] as const) {
  run("npm", [
    "run", "--silent", operator, "--",
    command, "--root", estateRoot,
    "--out", path.join(outputDirectory, output),
  ]);
}

const providerStatus = readAsoiafAnswerCredentialProviderStatus(estateRoot);
const brokerStatus = readAsoiafAnswerCredentialBrokerStatus(estateRoot);
write(path.join(outputDirectory, "expected.json"), {
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
  fs.rmSync(path.join(outputDirectory, name), { force: true });
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
