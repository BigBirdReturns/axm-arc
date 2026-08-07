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
  invokeAsoiafAnswerCredentialBrokerService,
  readAsoiafAnswerCredentialBrokerServiceStatus,
  startAsoiafAnswerCredentialBrokerService,
  type AsoiafAnswerCredentialBrokerServicePayload,
  type AsoiafAnswerCredentialBrokerServiceRequest,
  type AsoiafAnswerCredentialBrokerServiceWireResponse,
} from "../../tools/lib/asoiaf-answer-credential-broker-service.js";
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
const socketPath = "/tmp/axm-asoiaf-answer-credential-broker-service-qualification.sock";
const pipeName = "axm-asoiaf-answer-credential-broker-service-qualification";
const localEndpoint = process.platform === "win32"
  ? `npipe://${pipeName}`
  : `unix://${socketPath}`;
fs.mkdirSync(outputDirectory, { recursive: true });
fs.mkdirSync(materialDirectory, { recursive: true });

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

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
  run(npm, [
    "run", "--silent", "asoiaf:answer-credential-deployment", "--",
    command,
    "--input", path.join(deploymentFixture, inputName),
    "--out", output(outputName),
  ]);
}

function broker(command: string, inputName: string, outputName: string): void {
  run(npm, [
    "run", "--silent", "asoiaf:answer-credential-broker", "--",
    command,
    "--input", output(inputName),
    "--out", output(outputName),
  ]);
}

function provider(command: string, inputName: string, outputName: string): void {
  run(npm, [
    "run", "--silent", "asoiaf:answer-credential-provider-host", "--",
    command,
    "--input", output(inputName),
    "--out", output(outputName),
  ]);
}

function service(command: string, inputPath: string, outputName: string): void {
  run(npm, [
    "run", "--silent", "asoiaf:answer-credential-broker-service", "--",
    command,
    "--input", inputPath,
    "--out", output(outputName),
  ]);
}

function rootCommand(operator: string, command: string, outputName: string): void {
  run(npm, [
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
  throw new Error("broker-service fixture requires one active credential deployment");
}
const deploymentState = deploymentStatus.state.entries[0]!;
const device = deploymentStatus.devices.find((entry) => entry.deviceId === deploymentState.deviceId)!;
const plan = deploymentStatus.plans.find((entry) => entry.planId === deploymentState.planId)!;
const activation = deploymentStatus.activations.find(
  (entry) => entry.activationId === deploymentState.activationId,
)!;
const keyReference = deploymentStatus.keys.find(
  (entry) => entry.keyReferenceId === deploymentState.keyReferenceId,
)!;
const base = Date.parse(activation.statement.activatedAt);

write(output("broker-policy-input.json"), {
  root: estateRoot,
  brokerId: "broker:qualification:local-service",
  deviceId: device.deviceId,
  serviceId: plan.serviceId,
  localEndpoint,
  allowedProviderClasses: [keyReference.providerClass],
  allowedOperations: ["prove-possession", "mutual-tls-request"],
  maxInvocationLifetimeMilliseconds: 600_000,
  maxPossessionProofAgeMilliseconds: 900_000,
  maxResponseBytes: 1_048_576,
  createdAt: new Date(base + 60_000).toISOString(),
  operatorId: "operator:qualification:local-service-broker-policy",
});
broker("policy", "broker-policy-input.json", "broker-policy-result.json");
broker("policy", "broker-policy-input.json", "broker-policy-replay.json");
const brokerPolicy = read<{
  policy: { policyId: string; policyFingerprint: `sha256:${string}` };
}>(output("broker-policy-result.json")).policy;

write(output("broker-binding-input.json"), {
  root: estateRoot,
  policyId: brokerPolicy.policyId,
  boundAt: new Date(base + 120_000).toISOString(),
  operatorId: "operator:qualification:local-service-broker-binding",
});
broker("bind", "broker-binding-input.json", "broker-binding-result.json");
const brokerBinding = read<{
  binding: { bindingId: string; bindingFingerprint: `sha256:${string}` };
}>(output("broker-binding-result.json")).binding;

write(output("provider-profile-input.json"), {
  root: estateRoot,
  brokerPolicyId: brokerPolicy.policyId,
  brokerBindingId: brokerBinding.bindingId,
  hostKind: "synthetic-fixture",
  credentialSelector: "synthetic:qualification:local-service-credential",
  deviceAgentSelector: "synthetic:qualification:local-service-agent",
  allowedTargetOrigins: ["https://answer-desk.example.test"],
  maxResponseBytes: 65_536,
  createdAt: new Date(base + 150_000).toISOString(),
  operatorId: "operator:qualification:local-service-provider-profile",
});
provider("profile", "provider-profile-input.json", "provider-profile-result.json");
const providerProfile = read<{
  profile: { profileId: string; profileFingerprint: `sha256:${string}` };
}>(output("provider-profile-result.json")).profile;

const clientKeys = crypto.generateKeyPairSync("ed25519");
const clientPrivateKeyPem = clientKeys.privateKey.export({
  type: "pkcs8",
  format: "pem",
}).toString();
const clientPrivateKeyPath = path.join(materialDirectory, "service-client.key");
fs.writeFileSync(clientPrivateKeyPath, clientPrivateKeyPem, { mode: 0o600 });
const clientPublicKeySpkiBase64 = (clientKeys.publicKey.export({
  type: "spki",
  format: "der",
}) as Buffer).toString("base64");

write(output("service-policy-input.json"), {
  root: estateRoot,
  brokerPolicyId: brokerPolicy.policyId,
  providerProfileId: providerProfile.profileId,
  clientId: "client:qualification:local-broker-service",
  clientPublicKeySpkiBase64,
  allowedOperations: [
    "prepare-provider-invocation",
    "execute-possession",
    "execute-transport",
  ],
  maxRequestLifetimeMilliseconds: 600_000,
  maxRequestBytes: 1_048_576,
  maxResponseBytes: 4_194_304,
  createdAt: new Date(base + 160_000).toISOString(),
  operatorId: "operator:qualification:local-broker-service-policy",
});
service("policy", output("service-policy-input.json"), "service-policy-first.json");
service("policy", output("service-policy-input.json"), "service-policy-replay.json");
const servicePolicy = read<{
  policy: { servicePolicyId: string; servicePolicyFingerprint: `sha256:${string}` };
}>(output("service-policy-first.json")).policy;

write(output("possession-broker-input.json"), {
  root: estateRoot,
  policyId: brokerPolicy.policyId,
  bindingId: brokerBinding.bindingId,
  operation: "prove-possession",
  idempotencyKey: "qualification-local-service-possession-broker-v1",
  request: {
    kind: "possession",
    challengeDigest: sha256("qualification-local-service-possession-challenge"),
    contextDigest: sha256("qualification-local-service-possession-context"),
  },
  createdAt: new Date(base + 180_000).toISOString(),
  expiresAt: new Date(base + 720_000).toISOString(),
  operatorId: "operator:qualification:local-service-possession-broker",
});
broker("invoke", "possession-broker-input.json", "possession-broker-result.json");
const possessionBroker = read<{
  invocation: { invocationId: string; invocationFingerprint: `sha256:${string}` };
}>(output("possession-broker-result.json")).invocation;

function signRequest(input: {
  name: string;
  operation: "prepare-provider-invocation" | "execute-possession" | "execute-transport";
  idempotencyKey: string;
  payload: AsoiafAnswerCredentialBrokerServicePayload;
  issuedAt: string;
  expiresAt: string;
}): AsoiafAnswerCredentialBrokerServiceRequest {
  const transient = path.join(materialDirectory, `${input.name}-sign-input.json`);
  write(transient, {
    root: estateRoot,
    servicePolicyId: servicePolicy.servicePolicyId,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    clientPrivateKeyPem,
  });
  service("sign", transient, `${input.name}-request.json`);
  fs.rmSync(transient, { force: true });
  return read<{ request: AsoiafAnswerCredentialBrokerServiceRequest }>(
    output(`${input.name}-request.json`),
  ).request;
}

let clockNow = new Date(base + 165_000).toISOString();
const server = await startAsoiafAnswerCredentialBrokerService({
  root: estateRoot,
  servicePolicyId: servicePolicy.servicePolicyId,
  maxRequests: 5,
  clock: () => clockNow,
});
write(output("service-listener-ready.json"), {
  endpoint: server.endpoint,
  endpointKind: server.endpointKind,
  startedAt: server.startedAt,
  unixSocketMode: process.platform === "win32"
    ? null
    : (fs.statSync(server.address).mode & 0o777).toString(8).padStart(3, "0"),
});

async function invokeRequest(input: {
  name: string;
  request: AsoiafAnswerCredentialBrokerServiceRequest;
  payload: AsoiafAnswerCredentialBrokerServicePayload;
  receivedAt: string;
}): Promise<Extract<AsoiafAnswerCredentialBrokerServiceWireResponse, { ok: true }>> {
  clockNow = input.receivedAt;
  const response = await invokeAsoiafAnswerCredentialBrokerService({
    endpoint: localEndpoint,
    request: input.request,
    payload: input.payload,
    timeoutMilliseconds: 30_000,
    maxResponseBytes: 4_456_448,
  });
  write(output(`${input.name}-response.json`), response);
  if (!response.ok) throw new Error(response.error.message);
  return response;
}

const lifecycle: Record<string, string> = {};

try {
  const possessionPreparePayload: AsoiafAnswerCredentialBrokerServicePayload = {
    kind: "prepare-provider-invocation",
    brokerInvocationId: possessionBroker.invocationId,
    providerIdempotencyKey: "qualification-local-service-possession-provider-v1",
    preparedAt: new Date(base + 200_000).toISOString(),
    expiresAt: new Date(base + 680_000).toISOString(),
  };
  const possessionPrepareRequest = signRequest({
    name: "possession-prepare",
    operation: "prepare-provider-invocation",
    idempotencyKey: "qualification-local-service-request-possession-prepare-v1",
    payload: possessionPreparePayload,
    issuedAt: new Date(base + 190_000).toISOString(),
    expiresAt: new Date(base + 700_000).toISOString(),
  });
  lifecycle.possessionPrepareRequestId = possessionPrepareRequest.requestId;
  const possessionPrepare = await invokeRequest({
    name: "possession-prepare",
    request: possessionPrepareRequest,
    payload: possessionPreparePayload,
    receivedAt: new Date(base + 205_000).toISOString(),
  });
  if (possessionPrepare.result.response.kind !== "provider-invocation") {
    throw new Error("service possession preparation did not return a provider invocation");
  }
  lifecycle.possessionPrepareReceiptId = possessionPrepare.result.receipt.receiptId;
  const possessionProviderInvocation = possessionPrepare.result.response.invocation;
  lifecycle.possessionProviderInvocationId = possessionProviderInvocation.providerInvocationId;

  const possessionExecutePayload: AsoiafAnswerCredentialBrokerServicePayload = {
    kind: "execute-possession",
    hostKind: "synthetic-fixture",
    providerInvocationId: possessionProviderInvocation.providerInvocationId,
    credentialPrivateKeyPem: fs.readFileSync(
      path.join(materialDirectory, "deployment-initial.key"),
      "utf8",
    ),
    completedAt: new Date(base + 240_000).toISOString(),
  };
  const possessionExecuteRequest = signRequest({
    name: "possession-execute",
    operation: "execute-possession",
    idempotencyKey: "qualification-local-service-request-possession-execute-v1",
    payload: possessionExecutePayload,
    issuedAt: new Date(base + 210_000).toISOString(),
    expiresAt: new Date(base + 700_000).toISOString(),
  });
  lifecycle.possessionExecuteRequestId = possessionExecuteRequest.requestId;
  const possessionExecute = await invokeRequest({
    name: "possession-execute",
    request: possessionExecuteRequest,
    payload: possessionExecutePayload,
    receivedAt: new Date(base + 245_000).toISOString(),
  });
  if (possessionExecute.result.response.kind !== "provider-result") {
    throw new Error("service possession execution did not return a provider result");
  }
  lifecycle.possessionExecuteReceiptId = possessionExecute.result.receipt.receiptId;
  const possessionProviderResult = possessionExecute.result.response.result;
  lifecycle.possessionProviderResultId = possessionProviderResult.resultId;
  if (possessionProviderResult.output.kind !== "possession-proof") {
    throw new Error("service possession result has the wrong public output kind");
  }
  write(output("possession-broker-admission-input.json"), {
    root: estateRoot,
    ...possessionProviderResult.output.brokerAdmissionInput,
  });
  broker("admit-proof", "possession-broker-admission-input.json", "possession-broker-admission.json");
  const proof = read<{
    proof: { proofId: string; proofFingerprint: `sha256:${string}` };
  }>(output("possession-broker-admission.json")).proof;
  lifecycle.proofId = proof.proofId;

  const serverCertificateFingerprint = sha256("qualification-local-service-server-certificate");
  const serverIssuerFingerprint = sha256("qualification-local-service-server-issuer");
  const requestBody = Buffer.from(JSON.stringify({ operation: "local-service-qualification" }), "utf8");
  write(output("transport-broker-input.json"), {
    root: estateRoot,
    policyId: brokerPolicy.policyId,
    bindingId: brokerBinding.bindingId,
    operation: "mutual-tls-request",
    idempotencyKey: "qualification-local-service-transport-broker-v1",
    request: {
      kind: "mutual-tls",
      possessionProofId: proof.proofId,
      possessionProofFingerprint: proof.proofFingerprint,
      method: "POST",
      targetUrl: "https://answer-desk.example.test/v1/assignments/issue",
      requestBodyDigest: `sha256:${crypto.createHash("sha256").update(requestBody).digest("hex")}`,
      requestBodyBytes: requestBody.length,
      lowerIdempotencyKeyDigest: sha256("qualification-local-service-lower-idempotency"),
      expectedServerCertificateFingerprint: serverCertificateFingerprint,
      expectedServerIssuerFingerprint: serverIssuerFingerprint,
      maxResponseBytes: 65_536,
    },
    createdAt: new Date(base + 300_000).toISOString(),
    expiresAt: new Date(base + 900_000).toISOString(),
    operatorId: "operator:qualification:local-service-transport-broker",
  });
  broker("invoke", "transport-broker-input.json", "transport-broker-result.json");
  const transportBroker = read<{
    invocation: { invocationId: string; invocationFingerprint: `sha256:${string}` };
  }>(output("transport-broker-result.json")).invocation;
  lifecycle.transportBrokerInvocationId = transportBroker.invocationId;

  const transportPreparePayload: AsoiafAnswerCredentialBrokerServicePayload = {
    kind: "prepare-provider-invocation",
    brokerInvocationId: transportBroker.invocationId,
    providerIdempotencyKey: "qualification-local-service-transport-provider-v1",
    preparedAt: new Date(base + 320_000).toISOString(),
    expiresAt: new Date(base + 850_000).toISOString(),
  };
  const transportPrepareRequest = signRequest({
    name: "transport-prepare",
    operation: "prepare-provider-invocation",
    idempotencyKey: "qualification-local-service-request-transport-prepare-v1",
    payload: transportPreparePayload,
    issuedAt: new Date(base + 310_000).toISOString(),
    expiresAt: new Date(base + 800_000).toISOString(),
  });
  lifecycle.transportPrepareRequestId = transportPrepareRequest.requestId;
  const transportPrepare = await invokeRequest({
    name: "transport-prepare",
    request: transportPrepareRequest,
    payload: transportPreparePayload,
    receivedAt: new Date(base + 325_000).toISOString(),
  });
  if (transportPrepare.result.response.kind !== "provider-invocation") {
    throw new Error("service transport preparation did not return a provider invocation");
  }
  lifecycle.transportPrepareReceiptId = transportPrepare.result.receipt.receiptId;
  const transportProviderInvocation = transportPrepare.result.response.invocation;
  lifecycle.transportProviderInvocationId = transportProviderInvocation.providerInvocationId;

  const responseBody = Buffer.from(JSON.stringify({
    ok: true,
    source: "authenticated-local-service",
  }), "utf8");
  const transportExecutePayload: AsoiafAnswerCredentialBrokerServicePayload = {
    kind: "execute-transport",
    hostKind: "synthetic-fixture",
    providerInvocationId: transportProviderInvocation.providerInvocationId,
    deviceAgentPrivateKeyPem: fs.readFileSync(
      path.join(materialDirectory, "device-agent.key"),
      "utf8",
    ),
    lowerRequestId: "asoiaf-answer-transport-request:qualification-local-service",
    lowerRequestFingerprint: sha256("qualification-local-service-lower-request"),
    lowerResponseId: "asoiaf-answer-transport-response:qualification-local-service",
    lowerResponseFingerprint: sha256("qualification-local-service-lower-response"),
    observedServerCertificateFingerprint: serverCertificateFingerprint,
    observedServerIssuerFingerprint: serverIssuerFingerprint,
    httpStatus: 200,
    responseBodyBase64: responseBody.toString("base64"),
    providerReceiptDigest: sha256("qualification-local-service-provider-receipt"),
    startedAt: new Date(base + 360_000).toISOString(),
    completedAt: new Date(base + 420_000).toISOString(),
  };
  const transportExecuteRequest = signRequest({
    name: "transport-execute",
    operation: "execute-transport",
    idempotencyKey: "qualification-local-service-request-transport-execute-v1",
    payload: transportExecutePayload,
    issuedAt: new Date(base + 340_000).toISOString(),
    expiresAt: new Date(base + 800_000).toISOString(),
  });
  lifecycle.transportExecuteRequestId = transportExecuteRequest.requestId;
  const transportExecute = await invokeRequest({
    name: "transport-execute-first",
    request: transportExecuteRequest,
    payload: transportExecutePayload,
    receivedAt: new Date(base + 425_000).toISOString(),
  });
  const transportReplay = await invokeRequest({
    name: "transport-execute-replay",
    request: transportExecuteRequest,
    payload: transportExecutePayload,
    receivedAt: new Date(base + 430_000).toISOString(),
  });
  if (
    transportExecute.result.response.kind !== "provider-result"
    || transportReplay.result.response.kind !== "provider-result"
    || !transportReplay.result.requestReplayed
    || !transportReplay.result.receiptReplayed
  ) {
    throw new Error("service transport execution did not preserve exact replay custody");
  }
  lifecycle.transportExecuteReceiptId = transportExecute.result.receipt.receiptId;
  const transportProviderResult = transportExecute.result.response.result;
  lifecycle.transportProviderResultId = transportProviderResult.resultId;
  if (transportProviderResult.output.kind !== "transport-result") {
    throw new Error("service transport result has the wrong public output kind");
  }
  write(output("transport-broker-admission-input.json"), {
    root: estateRoot,
    ...transportProviderResult.output.brokerAdmissionInput,
  });
  broker("admit-transport", "transport-broker-admission-input.json", "transport-broker-admission.json");
} finally {
  if (server.servedRequests() < 5) await server.close();
}

const listenerSummary = await server.closed;
write(output("service-listener-summary.json"), listenerSummary);
fs.rmSync(materialDirectory, { recursive: true, force: true });
if (process.platform !== "win32") fs.rmSync(socketPath, { force: true });

rootCommand("asoiaf:answer-credential-broker-service", "status", "service-status.json");
rootCommand("asoiaf:answer-credential-broker-service", "verify", "service-verification.json");
rootCommand("asoiaf:answer-credential-broker-service", "paths", "service-paths.json");
rootCommand("asoiaf:answer-credential-provider-host", "status", "provider-status.json");
rootCommand("asoiaf:answer-credential-provider-host", "verify", "provider-verification.json");
rootCommand("asoiaf:answer-credential-broker", "status", "broker-status.json");
rootCommand("asoiaf:answer-credential-broker", "verify", "broker-verification.json");

const serviceStatus = readAsoiafAnswerCredentialBrokerServiceStatus(estateRoot);
const providerStatus = readAsoiafAnswerCredentialProviderStatus(estateRoot);
const brokerStatus = readAsoiafAnswerCredentialBrokerStatus(estateRoot);
write(output("expected.json"), {
  estateRoot,
  localEndpoint,
  deviceId: device.deviceId,
  serviceId: plan.serviceId,
  brokerPolicyId: brokerPolicy.policyId,
  brokerBindingId: brokerBinding.bindingId,
  providerProfileId: providerProfile.profileId,
  servicePolicyId: servicePolicy.servicePolicyId,
  possessionBrokerInvocationId: possessionBroker.invocationId,
  possessionPrepareRequestId: lifecycle.possessionPrepareRequestId,
  possessionPrepareReceiptId: lifecycle.possessionPrepareReceiptId,
  possessionProviderInvocationId: lifecycle.possessionProviderInvocationId,
  possessionExecuteRequestId: lifecycle.possessionExecuteRequestId,
  possessionExecuteReceiptId: lifecycle.possessionExecuteReceiptId,
  possessionProviderResultId: lifecycle.possessionProviderResultId,
  proofId: lifecycle.proofId,
  transportBrokerInvocationId: lifecycle.transportBrokerInvocationId,
  transportPrepareRequestId: lifecycle.transportPrepareRequestId,
  transportPrepareReceiptId: lifecycle.transportPrepareReceiptId,
  transportProviderInvocationId: lifecycle.transportProviderInvocationId,
  transportExecuteRequestId: lifecycle.transportExecuteRequestId,
  transportExecuteReceiptId: lifecycle.transportExecuteReceiptId,
  transportProviderResultId: lifecycle.transportProviderResultId,
  serviceCounts: {
    policies: serviceStatus.policies.length,
    requests: serviceStatus.requests.length,
    receipts: serviceStatus.receipts.length,
    stateEntries: serviceStatus.state?.entries.length ?? 0,
    pendingRequests: serviceStatus.state?.entries.reduce(
      (total, entry) => total + entry.pendingRequestIds.length,
      0,
    ) ?? 0,
  },
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
  listenerSummary,
});

process.stdout.write(`${JSON.stringify({
  ok: true,
  outputDirectory,
  estateRoot,
  servicePolicyId: servicePolicy.servicePolicyId,
  requests: serviceStatus.requests.length,
  receipts: serviceStatus.receipts.length,
}, null, 2)}\n`);
