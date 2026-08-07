import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
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
  readAsoiafAnswerCredentialBrokerServiceStatus,
  type AsoiafAnswerCredentialBrokerServicePayload,
  type AsoiafAnswerCredentialBrokerServiceRequest,
} from "../../tools/lib/asoiaf-answer-credential-broker-service.js";
import {
  asoiafAnswerCredentialBrokerLoopbackTlsPaths,
  invokeAsoiafAnswerCredentialBrokerLoopbackTls,
  probeAsoiafAnswerCredentialBrokerLoopbackTls,
  readAsoiafAnswerCredentialBrokerLoopbackTlsStatus,
  startAsoiafAnswerCredentialBrokerLoopbackTls,
  verifyAsoiafAnswerCredentialBrokerLoopbackTlsEstate,
  type AsoiafAnswerCredentialBrokerLoopbackTlsPolicy,
  type AsoiafAnswerCredentialBrokerLoopbackTlsSession,
} from "../../tools/lib/asoiaf-answer-credential-broker-loopback-tls.js";
import {
  admitAsoiafAnswerTransportCertificate,
  advertiseAsoiafAnswerTransportEndpoint,
  readAsoiafAnswerTransportOperationsStatus,
  verifyAsoiafAnswerTransportOperationsEstate,
} from "../../tools/lib/asoiaf-answer-desk-transport-operations.js";
import {
  fingerprintAsoiafAnswerTransportCertificate,
} from "../../tools/lib/asoiaf-answer-desk-transport.js";
import {
  sha256,
} from "../../tools/lib/asoiaf-external-estate.js";

const outputDirectory = path.resolve(process.argv[2] ?? "");
const estateRoot = path.resolve(process.argv[3] ?? "");
const materialDirectory = path.resolve(process.argv[4] ?? "");
if (!process.argv[2] || !process.argv[3] || !process.argv[4]) {
  throw new Error(
    "output directory, estate root, and transient material directory are required",
  );
}

const deskFixture = path.join(outputDirectory, "answer-desk-fixture");
const deploymentFixture = path.join(outputDirectory, "deployment-fixture");
const credentialMaterial = path.join(materialDirectory, "credential");
const tlsMaterial = path.join(materialDirectory, "tls");
const serviceSocket = path.join(
  os.tmpdir(),
  `axm-asoiaf-loopback-tls-parent-${process.pid}.sock`,
);
const serviceEndpoint = process.platform === "win32"
  ? `npipe://axm-asoiaf-loopback-tls-parent-${process.pid}`
  : `unix://${serviceSocket}`;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

fs.mkdirSync(outputDirectory, { recursive: true });
fs.mkdirSync(materialDirectory, { recursive: true });
fs.mkdirSync(credentialMaterial, { recursive: true });
fs.mkdirSync(tlsMaterial, { recursive: true });

function run(
  command: string,
  args: string[],
  receipt?: string,
): string {
  const stdout = execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
  if (receipt) fs.writeFileSync(receipt, stdout ? `${stdout}\n` : "", "utf8");
  return stdout;
}

function runNpm(
  script: string,
  args: string[],
  receipt?: string,
): string {
  return run(npm, ["run", "--silent", script, "--", ...args], receipt);
}

function runOpenSsl(args: string[]): void {
  execFileSync("openssl", args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "ignore", "pipe"],
  });
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

function deployment(
  command: string,
  inputName: string,
  outputName: string,
): void {
  runNpm("asoiaf:answer-credential-deployment", [
    command,
    "--input", path.join(deploymentFixture, inputName),
    "--out", output(outputName),
  ]);
}

function broker(
  command: string,
  inputName: string,
  outputName: string,
): void {
  runNpm("asoiaf:answer-credential-broker", [
    command,
    "--input", output(inputName),
    "--out", output(outputName),
  ]);
}

function provider(
  command: string,
  inputName: string,
  outputName: string,
): void {
  runNpm("asoiaf:answer-credential-provider-host", [
    command,
    "--input", output(inputName),
    "--out", output(outputName),
  ]);
}

function service(
  command: string,
  inputPath: string,
  outputName: string,
): void {
  runNpm("asoiaf:answer-credential-broker-service", [
    command,
    "--input", inputPath,
    "--out", output(outputName),
  ]);
}

function listener(
  command: string,
  inputPath: string,
  outputName: string,
): void {
  runNpm("asoiaf:answer-credential-broker-loopback-tls", [
    command,
    "--input", inputPath,
    "--out", output(outputName),
  ]);
}

function rootCommand(
  script: string,
  command: string,
  outputName: string,
): void {
  runNpm(script, [
    command,
    "--root", estateRoot,
    "--out", output(outputName),
  ]);
}

function iso(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

function certificateFingerprint(value: Buffer): `sha256:${string}` {
  return fingerprintAsoiafAnswerTransportCertificate(value);
}

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("qualification could not allocate one loopback TCP port");
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return port;
}

run("npx", [
  "vite-node",
  "tests/fixtures/emit-asoiaf-answer-desk-transport-operations-input.ts",
  deskFixture,
  estateRoot,
], output("answer-desk-fixture-emission.json"));
runNpm("asoiaf:answer-desk", [
  "adopt",
  "--input", path.join(deskFixture, "adopt-input.json"),
  "--out", output("answer-desk-adoption.json"),
]);

run("npx", [
  "vite-node",
  "tests/fixtures/emit-asoiaf-answer-credential-deployment-input.ts",
  deploymentFixture,
  estateRoot,
  credentialMaterial,
], output("deployment-fixture-emission.json"));

deployment("register-device", "device-input.json", "device-result.json");
deployment("register-key", "initial-key-input.json", "initial-key-result.json");
deployment("plan", "initial-plan-input.json", "initial-plan-result.json");
deployment(
  "admit-installation",
  "initial-installation-input.json",
  "initial-installation-result.json",
);
deployment(
  "admit-activation",
  "initial-activation-input.json",
  "initial-activation-result.json",
);
rootCommand(
  "asoiaf:answer-credential-deployment",
  "verify",
  "deployment-verification.json",
);

const caKey = path.join(tlsMaterial, "loopback-ca.key");
const caCertificatePath = path.join(tlsMaterial, "loopback-ca.crt");
const serverKey = path.join(tlsMaterial, "loopback-server.key");
const serverRequest = path.join(tlsMaterial, "loopback-server.csr");
const serverCertificatePath = path.join(tlsMaterial, "loopback-server.crt");
const clientKey = path.join(tlsMaterial, "loopback-client.key");
const clientRequest = path.join(tlsMaterial, "loopback-client.csr");
const clientCertificatePath = path.join(tlsMaterial, "loopback-client.crt");
const wrongClientKey = path.join(tlsMaterial, "wrong-client.key");
const wrongClientRequest = path.join(tlsMaterial, "wrong-client.csr");
const wrongClientCertificatePath = path.join(tlsMaterial, "wrong-client.crt");
const serverExtensions = path.join(tlsMaterial, "server.ext");
const clientExtensions = path.join(tlsMaterial, "client.ext");

runOpenSsl([
  "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256",
  "-days", "2",
  "-subj", "/CN=AXM loopback TLS qualification CA",
  "-addext", "basicConstraints=critical,CA:TRUE",
  "-addext", "keyUsage=critical,keyCertSign,cRLSign",
  "-keyout", caKey,
  "-out", caCertificatePath,
]);
fs.writeFileSync(serverExtensions, [
  "basicConstraints=CA:FALSE",
  "keyUsage=digitalSignature,keyEncipherment",
  "extendedKeyUsage=serverAuth",
  "subjectAltName=IP:127.0.0.1",
  "",
].join("\n"), "utf8");
runOpenSsl([
  "req", "-new", "-newkey", "rsa:2048", "-nodes", "-sha256",
  "-subj", "/CN=127.0.0.1",
  "-keyout", serverKey,
  "-out", serverRequest,
]);
runOpenSsl([
  "x509", "-req", "-sha256", "-days", "2",
  "-in", serverRequest,
  "-CA", caCertificatePath,
  "-CAkey", caKey,
  "-CAcreateserial",
  "-extfile", serverExtensions,
  "-out", serverCertificatePath,
]);
fs.writeFileSync(clientExtensions, [
  "basicConstraints=CA:FALSE",
  "keyUsage=digitalSignature,keyEncipherment",
  "extendedKeyUsage=clientAuth",
  "",
].join("\n"), "utf8");
for (const [label, keyPath, requestPath, certificatePath] of [
  ["loopback-client", clientKey, clientRequest, clientCertificatePath],
  ["wrong-client", wrongClientKey, wrongClientRequest, wrongClientCertificatePath],
] as const) {
  runOpenSsl([
    "req", "-new", "-newkey", "rsa:2048", "-nodes", "-sha256",
    "-subj", `/CN=${label}`,
    "-keyout", keyPath,
    "-out", requestPath,
  ]);
  runOpenSsl([
    "x509", "-req", "-sha256", "-days", "2",
    "-in", requestPath,
    "-CA", caCertificatePath,
    "-CAkey", caKey,
    "-CAserial", path.join(tlsMaterial, "loopback-ca.srl"),
    "-extfile", clientExtensions,
    "-out", certificatePath,
  ]);
}

const caCertificate = fs.readFileSync(caCertificatePath);
const serverCertificate = fs.readFileSync(serverCertificatePath);
const clientCertificate = fs.readFileSync(clientCertificatePath);
const wrongClientCertificate = fs.readFileSync(wrongClientCertificatePath);
const serverX509 = new crypto.X509Certificate(serverCertificate);
const clientX509 = new crypto.X509Certificate(clientCertificate);

const deploymentStatus = readAsoiafAnswerCredentialDeploymentStatus(estateRoot);
if (!deploymentStatus.state || deploymentStatus.state.entries.length !== 1) {
  throw new Error("loopback TLS fixture requires one active credential deployment");
}
const deploymentState = deploymentStatus.state.entries[0]!;
const device = deploymentStatus.devices.find(
  (entry) => entry.deviceId === deploymentState.deviceId,
)!;
const plan = deploymentStatus.plans.find(
  (entry) => entry.planId === deploymentState.planId,
)!;
const activation = deploymentStatus.activations.find(
  (entry) => entry.activationId === deploymentState.activationId,
)!;
const keyReference = deploymentStatus.keys.find(
  (entry) => entry.keyReferenceId === deploymentState.keyReferenceId,
)!;
const base = Math.max(
  Date.now(),
  Date.parse(activation.statement.activatedAt),
  serverX509.validFromDate.getTime(),
  clientX509.validFromDate.getTime(),
) + 120_000;
const serviceClientId =
  "actor:qualification:loopback-tls:exact-locator-reviewer";
const serverId = "server:qualification:credential-broker-loopback-tls";
const port = await freePort();
const baseUrl = `https://127.0.0.1:${port}/`;

write(output("broker-policy-input.json"), {
  root: estateRoot,
  brokerId: "broker:qualification:loopback-tls",
  deviceId: device.deviceId,
  serviceId: plan.serviceId,
  localEndpoint: serviceEndpoint,
  allowedProviderClasses: [keyReference.providerClass],
  allowedOperations: ["prove-possession", "mutual-tls-request"],
  maxInvocationLifetimeMilliseconds: 1_800_000,
  maxPossessionProofAgeMilliseconds: 1_800_000,
  maxResponseBytes: 1_048_576,
  createdAt: iso(base),
  operatorId: "operator:qualification:loopback-tls-broker-policy",
});
broker("policy", "broker-policy-input.json", "broker-policy-result.json");
const brokerPolicy = read<{
  policy: { policyId: string; policyFingerprint: `sha256:${string}` };
}>(output("broker-policy-result.json")).policy;

write(output("broker-binding-input.json"), {
  root: estateRoot,
  policyId: brokerPolicy.policyId,
  boundAt: iso(base + 60_000),
  operatorId: "operator:qualification:loopback-tls-broker-binding",
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
  credentialSelector: "synthetic:qualification:loopback-tls-credential",
  deviceAgentSelector: "synthetic:qualification:loopback-tls-agent",
  allowedTargetOrigins: ["https://answer-desk.example.test"],
  maxResponseBytes: 65_536,
  createdAt: iso(base + 120_000),
  operatorId: "operator:qualification:loopback-tls-provider-profile",
});
provider("profile", "provider-profile-input.json", "provider-profile-result.json");
const providerProfile = read<{
  profile: { profileId: string; profileFingerprint: `sha256:${string}` };
}>(output("provider-profile-result.json")).profile;

const clientPrivateKeyPem = fs.readFileSync(clientKey, "utf8");
const clientPublicKeySpkiBase64 = (
  clientX509.publicKey.export({ type: "spki", format: "der" }) as Buffer
).toString("base64");
write(output("service-policy-input.json"), {
  root: estateRoot,
  brokerPolicyId: brokerPolicy.policyId,
  providerProfileId: providerProfile.profileId,
  clientId: serviceClientId,
  clientPublicKeySpkiBase64,
  allowedOperations: [
    "prepare-provider-invocation",
    "execute-possession",
    "execute-transport",
  ],
  maxRequestLifetimeMilliseconds: 900_000,
  maxRequestBytes: 1_048_576,
  maxResponseBytes: 4_194_304,
  createdAt: iso(base + 180_000),
  operatorId: "operator:qualification:loopback-tls-service-policy",
});
service("policy", output("service-policy-input.json"), "service-policy-result.json");
const servicePolicy = read<{
  policy: {
    servicePolicyId: string;
    servicePolicyFingerprint: `sha256:${string}`;
  };
}>(output("service-policy-result.json")).policy;

const certificateAdmittedAt = iso(base + 240_000);
const certificateActivateAt = iso(base + 240_000);
const certificateRenewAfter = iso(base + 6 * 60 * 60_000);
const certificateRetireAfter = iso(base + 20 * 60 * 60_000);
const serverAdmission = admitAsoiafAnswerTransportCertificate({
  root: estateRoot,
  usage: "server-auth",
  principalId: serverId,
  certificate: serverCertificate,
  issuerCertificate: caCertificate,
  admittedAt: certificateAdmittedAt,
  activateAt: certificateActivateAt,
  renewAfter: certificateRenewAfter,
  retireAfter: certificateRetireAfter,
  rotationReason:
    "The qualification operator admits one loopback-only server certificate for the separately governed credential broker listener.",
  operatorId: "operator:qualification:loopback-tls-admit-server",
}).admission;
const clientAdmission = admitAsoiafAnswerTransportCertificate({
  root: estateRoot,
  usage: "client-auth",
  principalId: serviceClientId,
  actorRole: "exact-locator-reviewer",
  certificate: clientCertificate,
  issuerCertificate: caCertificate,
  admittedAt: certificateAdmittedAt,
  activateAt: certificateActivateAt,
  renewAfter: certificateRenewAfter,
  retireAfter: certificateRetireAfter,
  rotationReason:
    "The qualification operator admits the exact certificate whose public key authenticates the retained broker service client.",
  operatorId: "operator:qualification:loopback-tls-admit-client",
}).admission;
write(output("server-certificate-admission.json"), serverAdmission);
write(output("client-certificate-admission.json"), clientAdmission);

const endpoint = advertiseAsoiafAnswerTransportEndpoint({
  root: estateRoot,
  serverId,
  baseUrl,
  networkScope: "loopback",
  priority: 0,
  serverCertificateFingerprint: serverAdmission.certificateFingerprint,
  acceptedClientCaCertificateFingerprint: certificateFingerprint(caCertificate),
  advertisedAt: iso(base + 300_000),
  availableFrom: iso(base + 360_000),
  expiresAt: iso(base + 10 * 60 * 60_000),
  operatorId: "operator:qualification:loopback-tls-endpoint",
}).endpoint;
write(output("endpoint-lease.json"), endpoint);

write(output("listener-policy-input.json"), {
  root: estateRoot,
  brokerServicePolicyId: servicePolicy.servicePolicyId,
  endpointLeaseId: endpoint.endpointLeaseId,
  clientCertificateFingerprint: clientAdmission.certificateFingerprint,
  maxSessionLifetimeMilliseconds: 3_600_000,
  createdAt: iso(base + 330_000),
  operatorId: "operator:qualification:loopback-tls-listener-policy",
});
listener("policy", output("listener-policy-input.json"), "listener-policy-first.json");
listener("policy", output("listener-policy-input.json"), "listener-policy-replay.json");
const listenerPolicy = read<{
  policy: AsoiafAnswerCredentialBrokerLoopbackTlsPolicy;
  replayed: boolean;
}>(output("listener-policy-first.json")).policy;

function prepareSession(input: {
  name: string;
  idempotencyKey: string;
  preparedAt: number;
  expiresAt: number;
  operatorId: string;
}): AsoiafAnswerCredentialBrokerLoopbackTlsSession {
  const inputPath = output(`${input.name}-input.json`);
  write(inputPath, {
    root: estateRoot,
    listenerPolicyId: listenerPolicy.listenerPolicyId,
    idempotencyKey: input.idempotencyKey,
    preparedAt: iso(input.preparedAt),
    expiresAt: iso(input.expiresAt),
    operatorId: input.operatorId,
  });
  listener("prepare", inputPath, `${input.name}-first.json`);
  listener("prepare", inputPath, `${input.name}-replay.json`);
  return read<{
    session: AsoiafAnswerCredentialBrokerLoopbackTlsSession;
  }>(output(`${input.name}-first.json`)).session;
}

function signRequest(input: {
  name: string;
  operation:
    | "prepare-provider-invocation"
    | "execute-possession"
    | "execute-transport";
  idempotencyKey: string;
  payload: AsoiafAnswerCredentialBrokerServicePayload;
  issuedAt: number;
  expiresAt: number;
}): AsoiafAnswerCredentialBrokerServiceRequest {
  const transient = path.join(materialDirectory, `${input.name}-sign-input.json`);
  write(transient, {
    root: estateRoot,
    servicePolicyId: servicePolicy.servicePolicyId,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload,
    issuedAt: iso(input.issuedAt),
    expiresAt: iso(input.expiresAt),
    clientPrivateKeyPem,
  });
  service("sign", transient, `${input.name}-request.json`);
  fs.rmSync(transient, { force: true });
  return read<{ request: AsoiafAnswerCredentialBrokerServiceRequest }>(
    output(`${input.name}-request.json`),
  ).request;
}

const sessionOne = prepareSession({
  name: "listener-session-one",
  idempotencyKey: "qualification-loopback-tls-session-one-v1",
  preparedAt: base + 360_000,
  expiresAt: base + 1_800_000,
  operatorId: "operator:qualification:loopback-tls-session-one",
});

write(output("possession-broker-input.json"), {
  root: estateRoot,
  policyId: brokerPolicy.policyId,
  bindingId: brokerBinding.bindingId,
  operation: "prove-possession",
  idempotencyKey: "qualification-loopback-tls-possession-broker-v1",
  request: {
    kind: "possession",
    challengeDigest: sha256("qualification-loopback-tls-possession-challenge"),
    contextDigest: sha256("qualification-loopback-tls-possession-context"),
  },
  createdAt: iso(base + 370_000),
  expiresAt: iso(base + 1_700_000),
  operatorId: "operator:qualification:loopback-tls-possession-broker",
});
broker("invoke", "possession-broker-input.json", "possession-broker-result.json");
const possessionBroker = read<{
  invocation: { invocationId: string; invocationFingerprint: `sha256:${string}` };
}>(output("possession-broker-result.json")).invocation;

const preparePayload: AsoiafAnswerCredentialBrokerServicePayload = {
  kind: "prepare-provider-invocation",
  brokerInvocationId: possessionBroker.invocationId,
  providerIdempotencyKey: "qualification-loopback-tls-provider-possession-v1",
  preparedAt: iso(base + 390_000),
  expiresAt: iso(base + 1_600_000),
};
const prepareRequest = signRequest({
  name: "loopback-possession-prepare",
  operation: "prepare-provider-invocation",
  idempotencyKey: "qualification-loopback-tls-request-prepare-v1",
  payload: preparePayload,
  issuedAt: base + 380_000,
  expiresAt: base + 1_200_000,
});

const runtimeBase = base + 420_000;
let runtimeTick = 0;
const listenerOne = await startAsoiafAnswerCredentialBrokerLoopbackTls({
  root: estateRoot,
  sessionId: sessionOne.sessionId,
  serverCertificate,
  serverPrivateKey: fs.readFileSync(serverKey),
  clientCertificateAuthority: caCertificate,
  maxRequests: 10,
  clock: () => iso(runtimeBase + runtimeTick++ * 1_000),
});
write(output("listener-one-ready.json"), listenerOne.ready);

const availability = await probeAsoiafAnswerCredentialBrokerLoopbackTls({
  root: estateRoot,
  listenerPolicyId: listenerPolicy.listenerPolicyId,
  clientCertificate,
  clientPrivateKey: fs.readFileSync(clientKey),
  serverCertificateAuthority: caCertificate,
  observedAt: iso(runtimeBase + 250),
  timeoutMilliseconds: 10_000,
});
write(output("listener-availability.json"), availability);
if (availability.observation.outcome !== "available") {
  throw new Error("loopback TLS availability probe did not complete mutual TLS");
}

const unauthorized = await invokeAsoiafAnswerCredentialBrokerLoopbackTls({
  baseUrl,
  expectedServerCertificateFingerprint:
    serverAdmission.certificateFingerprint,
  clientCertificate: wrongClientCertificate,
  clientPrivateKey: fs.readFileSync(wrongClientKey),
  serverCertificateAuthority: caCertificate,
  request: prepareRequest,
  payload: preparePayload,
  timeoutMilliseconds: 30_000,
  maxResponseBytes: 4_456_448,
});
write(output("unauthorized-client-response.json"), unauthorized);
if (unauthorized.ok) {
  throw new Error("loopback TLS listener admitted the wrong client certificate");
}

const prepareResponse = await invokeAsoiafAnswerCredentialBrokerLoopbackTls({
  baseUrl,
  expectedServerCertificateFingerprint:
    serverAdmission.certificateFingerprint,
  clientCertificate,
  clientPrivateKey: fs.readFileSync(clientKey),
  serverCertificateAuthority: caCertificate,
  request: prepareRequest,
  payload: preparePayload,
  timeoutMilliseconds: 30_000,
  maxResponseBytes: 4_456_448,
});
write(output("loopback-possession-prepare-response.json"), prepareResponse);
if (
  !prepareResponse.ok
  || prepareResponse.result.response.kind !== "provider-invocation"
) {
  throw new Error("loopback TLS prepare request did not return a provider invocation");
}
const providerInvocation = prepareResponse.result.response.invocation;

const executePayload: AsoiafAnswerCredentialBrokerServicePayload = {
  kind: "execute-possession",
  hostKind: "synthetic-fixture",
  providerInvocationId: providerInvocation.providerInvocationId,
  credentialPrivateKeyPem: fs.readFileSync(
    path.join(credentialMaterial, "deployment-initial.key"),
    "utf8",
  ),
  completedAt: iso(runtimeBase + 3_500),
};
const executeRequest = signRequest({
  name: "loopback-possession-execute",
  operation: "execute-possession",
  idempotencyKey: "qualification-loopback-tls-request-execute-v1",
  payload: executePayload,
  issuedAt: base + 400_000,
  expiresAt: base + 1_250_000,
});
const executeResponse = await invokeAsoiafAnswerCredentialBrokerLoopbackTls({
  baseUrl,
  expectedServerCertificateFingerprint:
    serverAdmission.certificateFingerprint,
  clientCertificate,
  clientPrivateKey: fs.readFileSync(clientKey),
  serverCertificateAuthority: caCertificate,
  request: executeRequest,
  payload: executePayload,
  timeoutMilliseconds: 30_000,
  maxResponseBytes: 4_456_448,
});
write(output("loopback-possession-execute-first-response.json"), executeResponse);
const executeReplay = await invokeAsoiafAnswerCredentialBrokerLoopbackTls({
  baseUrl,
  expectedServerCertificateFingerprint:
    serverAdmission.certificateFingerprint,
  clientCertificate,
  clientPrivateKey: fs.readFileSync(clientKey),
  serverCertificateAuthority: caCertificate,
  request: executeRequest,
  payload: executePayload,
  timeoutMilliseconds: 30_000,
  maxResponseBytes: 4_456_448,
});
write(output("loopback-possession-execute-replay-response.json"), executeReplay);
if (
  !executeResponse.ok
  || !executeReplay.ok
  || executeResponse.result.response.kind !== "provider-result"
  || executeReplay.result.response.kind !== "provider-result"
  || executeResponse.result.requestReplayed
  || executeResponse.result.receiptReplayed
  || !executeReplay.result.requestReplayed
  || !executeReplay.result.receiptReplayed
  || executeReplay.result.request.requestId
    !== executeResponse.result.request.requestId
  || executeReplay.result.receipt.receiptId
    !== executeResponse.result.receipt.receiptId
) {
  throw new Error("loopback TLS exact replay custody is invalid");
}
const providerResult = executeResponse.result.response.result;
if (providerResult.output.kind !== "possession-proof") {
  throw new Error("loopback TLS provider result is not a possession proof");
}
write(output("possession-broker-admission-input.json"), {
  root: estateRoot,
  ...providerResult.output.brokerAdmissionInput,
});
broker(
  "admit-proof",
  "possession-broker-admission-input.json",
  "possession-broker-admission.json",
);
const proof = read<{
  proof: { proofId: string; proofFingerprint: `sha256:${string}` };
}>(output("possession-broker-admission.json")).proof;

await listenerOne.close(
  "The qualification operator closed the first loopback listener after exact request replay and downstream possession-proof admission completed.",
);
const listenerOneSummary = await listenerOne.closed;
write(output("listener-one-summary.json"), listenerOneSummary);

const sessionTwo = prepareSession({
  name: "listener-session-two",
  idempotencyKey: "qualification-loopback-tls-session-two-v1",
  preparedAt: base + 2_000_000,
  expiresAt: base + 3_000_000,
  operatorId: "operator:qualification:loopback-tls-session-two",
});
let sessionTwoTick = 0;
const listenerTwo = await startAsoiafAnswerCredentialBrokerLoopbackTls({
  root: estateRoot,
  sessionId: sessionTwo.sessionId,
  serverCertificate,
  serverPrivateKey: fs.readFileSync(serverKey),
  clientCertificateAuthority: caCertificate,
  clock: () => iso(base + 2_010_000 + sessionTwoTick++ * 1_000),
});
write(output("listener-two-ready.json"), listenerTwo.ready);
await listenerTwo.close(
  "The qualification fixture closes the second listener once so it can remove that terminal receipt and reproduce interrupted restart custody without killing the test process.",
);
const listenerTwoSummary = await listenerTwo.closed;
write(output("listener-two-pre-crash-summary.json"), listenerTwoSummary);

const listenerPaths = asoiafAnswerCredentialBrokerLoopbackTlsPaths(estateRoot);
const statusAfterTwo = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(
  estateRoot,
);
const sessionTwoStop = statusAfterTwo.lifecycle.find(
  (entry) => entry.sessionId === sessionTwo.sessionId && entry.kind === "stopped",
);
if (!sessionTwoStop) {
  throw new Error("restart fixture lacks the second listener stop lifecycle");
}
fs.rmSync(path.join(
  listenerPaths.lifecycle,
  `${sessionTwoStop.lifecycleFingerprint.slice("sha256:".length)}.json`,
));

const sessionThree = prepareSession({
  name: "listener-session-three",
  idempotencyKey: "qualification-loopback-tls-session-three-v1",
  preparedAt: base + 2_100_000,
  expiresAt: base + 3_100_000,
  operatorId: "operator:qualification:loopback-tls-session-three",
});
const staleLockBytes = Buffer.from(`${JSON.stringify({
  format: "synthetic-interrupted-loopback-listener-lock",
  sessionId: sessionTwo.sessionId,
  interruptedAt: iso(base + 2_050_000),
})}\n`, "utf8");
fs.writeFileSync(listenerPaths.lock, staleLockBytes, { mode: 0o600 });
const expectedStaleLockDigest = `sha256:${crypto
  .createHash("sha256")
  .update(staleLockBytes)
  .digest("hex")}` as const;

let sessionThreeTick = 0;
const listenerThree = await startAsoiafAnswerCredentialBrokerLoopbackTls({
  root: estateRoot,
  sessionId: sessionThree.sessionId,
  serverCertificate,
  serverPrivateKey: fs.readFileSync(serverKey),
  clientCertificateAuthority: caCertificate,
  clock: () => iso(base + 2_110_000 + sessionThreeTick++ * 1_000),
});
write(output("listener-three-ready.json"), listenerThree.ready);
await listenerThree.close(
  "The recovered loopback listener completed the bounded restart proof and closed with no active session or runtime lock remaining.",
);
const listenerThreeSummary = await listenerThree.closed;
write(output("listener-three-summary.json"), listenerThreeSummary);

rootCommand(
  "asoiaf:answer-credential-broker-loopback-tls",
  "status",
  "listener-status.json",
);
rootCommand(
  "asoiaf:answer-credential-broker-loopback-tls",
  "verify",
  "listener-verification.json",
);
rootCommand(
  "asoiaf:answer-credential-broker-loopback-tls",
  "paths",
  "listener-paths.json",
);
rootCommand(
  "asoiaf:answer-credential-broker-service",
  "status",
  "service-status.json",
);
rootCommand(
  "asoiaf:answer-credential-broker-service",
  "verify",
  "service-verification.json",
);
rootCommand(
  "asoiaf:answer-credential-provider-host",
  "status",
  "provider-status.json",
);
rootCommand(
  "asoiaf:answer-credential-provider-host",
  "verify",
  "provider-verification.json",
);
rootCommand(
  "asoiaf:answer-credential-broker",
  "status",
  "broker-status.json",
);
rootCommand(
  "asoiaf:answer-credential-broker",
  "verify",
  "broker-verification.json",
);
rootCommand(
  "asoiaf:answer-transport-operations",
  "status",
  "transport-operations-status.json",
);
rootCommand(
  "asoiaf:answer-transport-operations",
  "verify",
  "transport-operations-verification.json",
);

const listenerStatus = readAsoiafAnswerCredentialBrokerLoopbackTlsStatus(
  estateRoot,
);
const serviceStatus = readAsoiafAnswerCredentialBrokerServiceStatus(estateRoot);
const providerStatus = readAsoiafAnswerCredentialProviderStatus(estateRoot);
const brokerStatus = readAsoiafAnswerCredentialBrokerStatus(estateRoot);
const operationsStatus = readAsoiafAnswerTransportOperationsStatus(estateRoot);
const listenerFindings = verifyAsoiafAnswerCredentialBrokerLoopbackTlsEstate(
  estateRoot,
);
const operationsFindings = verifyAsoiafAnswerTransportOperationsEstate(
  estateRoot,
);
const recovery = listenerStatus.lifecycle.find(
  (entry) => entry.sessionId === sessionTwo.sessionId
    && entry.kind === "recovered",
);
if (
  listenerFindings.length !== 0
  || operationsFindings.some((entry) => entry.severity === "error")
  || !recovery
  || recovery.recoveredBySessionId !== sessionThree.sessionId
  || recovery.staleLockDigest !== expectedStaleLockDigest
  || fs.existsSync(listenerPaths.lock)
) {
  throw new Error("loopback TLS terminal qualification custody is invalid");
}

write(output("expected.json"), {
  estateRoot,
  serviceEndpoint,
  baseUrl,
  port,
  deviceId: device.deviceId,
  brokerPolicyId: brokerPolicy.policyId,
  brokerBindingId: brokerBinding.bindingId,
  providerProfileId: providerProfile.profileId,
  servicePolicyId: servicePolicy.servicePolicyId,
  listenerPolicyId: listenerPolicy.listenerPolicyId,
  endpointLeaseId: endpoint.endpointLeaseId,
  serverCertificateAdmissionId: serverAdmission.admissionId,
  serverCertificateFingerprint: serverAdmission.certificateFingerprint,
  clientCertificateAdmissionId: clientAdmission.admissionId,
  clientCertificateFingerprint: clientAdmission.certificateFingerprint,
  sessionOneId: sessionOne.sessionId,
  sessionTwoId: sessionTwo.sessionId,
  sessionThreeId: sessionThree.sessionId,
  recoveredSessionId: recovery.sessionId,
  recoveredBySessionId: recovery.recoveredBySessionId,
  staleLockDigest: recovery.staleLockDigest,
  availabilityObservationId: availability.observation.observationId,
  prepareRequestId: prepareRequest.requestId,
  prepareReceiptId: prepareResponse.ok
    ? prepareResponse.result.receipt.receiptId
    : null,
  executeRequestId: executeRequest.requestId,
  executeReceiptId: executeResponse.ok
    ? executeResponse.result.receipt.receiptId
    : null,
  providerInvocationId: providerInvocation.providerInvocationId,
  providerResultId: providerResult.resultId,
  proofId: proof.proofId,
  listenerCounts: {
    policies: listenerStatus.policies.length,
    sessions: listenerStatus.sessions.length,
    ready: listenerStatus.lifecycle.filter((entry) => entry.kind === "ready").length,
    stopped: listenerStatus.lifecycle.filter((entry) => entry.kind === "stopped").length,
    recovered: listenerStatus.lifecycle.filter((entry) => entry.kind === "recovered").length,
    activeSessions: listenerStatus.state?.entries.reduce(
      (total, entry) => total + entry.activeSessionIds.length,
      0,
    ) ?? 0,
    preparedSessions: listenerStatus.state?.entries.reduce(
      (total, entry) => total + entry.preparedSessionIds.length,
      0,
    ) ?? 0,
  },
  serviceCounts: {
    policies: serviceStatus.policies.length,
    requests: serviceStatus.requests.length,
    receipts: serviceStatus.receipts.length,
    pendingRequests: serviceStatus.state?.entries.reduce(
      (total, entry) => total + entry.pendingRequestIds.length,
      0,
    ) ?? 0,
  },
  providerCounts: {
    profiles: providerStatus.profiles.length,
    invocations: providerStatus.invocations.length,
    results: providerStatus.results.length,
  },
  brokerCounts: {
    policies: brokerStatus.policies.length,
    bindings: brokerStatus.bindings.length,
    invocations: brokerStatus.invocations.length,
    proofs: brokerStatus.proofs.length,
    transportResults: brokerStatus.transportResults.length,
  },
  transportOperationsCounts: {
    certificates: operationsStatus.certificates.length,
    endpoints: operationsStatus.endpoints.length,
    availability: operationsStatus.availability.length,
  },
  unauthorizedClientRejected: !unauthorized.ok,
  executeReplay: executeReplay.ok
    ? {
        requestReplayed: executeReplay.result.requestReplayed,
        receiptReplayed: executeReplay.result.receiptReplayed,
      }
    : null,
  listenerOneSummary: {
    servedConnections: listenerOneSummary.servedConnections,
    servedRequests: listenerOneSummary.servedRequests,
    rejectedConnections: listenerOneSummary.rejectedConnections,
  },
  listenerThreeSummary: {
    servedConnections: listenerThreeSummary.servedConnections,
    servedRequests: listenerThreeSummary.servedRequests,
    rejectedConnections: listenerThreeSummary.rejectedConnections,
  },
});

if (process.platform !== "win32") fs.rmSync(serviceSocket, { force: true });
process.stdout.write(`${JSON.stringify({
  ok: true,
  outputDirectory,
  estateRoot,
  listenerPolicyId: listenerPolicy.listenerPolicyId,
  endpointLeaseId: endpoint.endpointLeaseId,
  sessions: listenerStatus.sessions.length,
  lifecycle: listenerStatus.lifecycle.length,
  serviceRequests: serviceStatus.requests.length,
  serviceReceipts: serviceStatus.receipts.length,
}, null, 2)}\n`);
