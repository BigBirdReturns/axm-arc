import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  admitAsoiafAnswerCredentialActivation,
  admitAsoiafAnswerCredentialInstallation,
  buildAsoiafAnswerCredentialActivationStatement,
  buildAsoiafAnswerCredentialInstallationStatement,
  buildAsoiafAnswerCredentialRollbackStatement,
  planAsoiafAnswerCredentialDeployment,
  retainAsoiafAnswerCredentialDevice,
  retainAsoiafAnswerCredentialKeyReference,
  retainAsoiafAnswerCredentialRollback,
  serializeAsoiafAnswerCredentialActivationStatement,
  serializeAsoiafAnswerCredentialInstallationStatement,
  serializeAsoiafAnswerCredentialRollbackStatement,
  type AsoiafAnswerCredentialActivation,
  type AsoiafAnswerCredentialDeploymentPlan,
} from "../../tools/lib/asoiaf-answer-credential-deployment.js";
import {
  buildAsoiafAnswerTransportApprovalStatement,
  buildAsoiafAnswerTransportProofStatement,
  compileAsoiafAnswerTransportIssuanceOrder,
  linkAsoiafAnswerTransportRuntimeAdmission,
  recordAsoiafAnswerTransportIssuedCertificate,
  retainAsoiafAnswerTransportEnrollmentApproval,
  retainAsoiafAnswerTransportIssuerPolicy,
  serializeAsoiafAnswerTransportApprovalStatement,
  serializeAsoiafAnswerTransportProofStatement,
  submitAsoiafAnswerTransportEnrollmentRequest,
  type AsoiafAnswerTransportAdmissionLink,
  type AsoiafAnswerTransportEnrollmentMode,
  type AsoiafAnswerTransportIssuanceReceipt,
  type AsoiafAnswerTransportIssuerPolicy,
} from "../../tools/lib/asoiaf-answer-desk-transport-enrollment.js";
import {
  sha256,
} from "../../tools/lib/asoiaf-external-estate.js";

const OUTPUT_DIRECTORY = process.argv[2];
const ESTATE_ROOT = process.argv[3];
const MATERIAL_DIRECTORY = process.argv[4];
if (!OUTPUT_DIRECTORY || !ESTATE_ROOT || !MATERIAL_DIRECTORY) {
  throw new Error("output directory, estate root, and material directory are required");
}

interface KeyMaterial {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  privateKeyPath: string;
  publicKeyPath: string;
  handleDigest: `sha256:${string}`;
}

interface EnrollmentLeaf {
  issuance: AsoiafAnswerTransportIssuanceReceipt;
  admissionLink: AsoiafAnswerTransportAdmissionLink;
  certificatePath: string;
  key: KeyMaterial;
}

const outputDirectory = path.resolve(OUTPUT_DIRECTORY);
const estateRoot = path.resolve(ESTATE_ROOT);
const materialDirectory = path.resolve(MATERIAL_DIRECTORY);
const scratchRoot = path.join(materialDirectory, "scratch-estate");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.mkdirSync(materialDirectory, { recursive: true });
fs.mkdirSync(scratchRoot, { recursive: true });

function runOpenSsl(args: string[]): void {
  execFileSync("openssl", args, { stdio: ["ignore", "ignore", "pipe"] });
}

function writeJson(name: string, value: unknown): void {
  fs.writeFileSync(
    path.join(outputDirectory, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function exportPublicKey(key: crypto.KeyObject, target: string): void {
  fs.writeFileSync(
    target,
    key.export({ format: "pem", type: "spki" }),
  );
}

function exportPrivateKey(key: crypto.KeyObject, target: string): void {
  fs.writeFileSync(
    target,
    key.export({ format: "pem", type: "pkcs8" }),
    { mode: 0o600 },
  );
}

function sign(
  algorithm: "rsa-sha256" | "ecdsa-sha256" | "ed25519",
  message: Buffer,
  privateKey: crypto.KeyObject,
): Buffer {
  return crypto.sign(algorithm === "ed25519" ? null : "sha256", message, privateKey);
}

function createCa() {
  const certificate = path.join(materialDirectory, "deployment-ca.crt");
  const key = path.join(materialDirectory, "deployment-ca.key");
  runOpenSsl([
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "5",
    "-subj", "/CN=ASOIAF credential deployment qualification CA",
    "-addext", "basicConstraints=critical,CA:TRUE",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    "-keyout", key,
    "-out", certificate,
  ]);
  return { certificate, key };
}

function keyMaterial(label: string): KeyMaterial {
  const pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPath = path.join(materialDirectory, `${label}.key`);
  const publicKeyPath = path.join(materialDirectory, `${label}.public.pem`);
  exportPrivateKey(pair.privateKey, privateKeyPath);
  exportPublicKey(pair.publicKey, publicKeyPath);
  return {
    ...pair,
    privateKeyPath,
    publicKeyPath,
    handleDigest: sha256(`opaque-provider-handle:${label}`),
  };
}

const ca = createCa();
const agent = crypto.generateKeyPairSync("ed25519");
const agentPrivateKeyPath = path.join(materialDirectory, "device-agent.key");
const agentPublicKeyPath = path.join(materialDirectory, "device-agent.public.pem");
exportPrivateKey(agent.privateKey, agentPrivateKeyPath);
exportPublicKey(agent.publicKey, agentPublicKeyPath);

const approvers: Record<string, {
  role: "issuer-operator" | "actor-owner" | "security-officer";
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
}> = {};
for (const [approverId, role] of [
  ["approver:deployment:issuer", "issuer-operator"],
  ["approver:deployment:owner", "actor-owner"],
  ["approver:deployment:security", "security-officer"],
] as const) {
  approvers[approverId] = { role, ...crypto.generateKeyPairSync("ed25519") };
}

const caCertificate = new crypto.X509Certificate(fs.readFileSync(ca.certificate));
const policy: AsoiafAnswerTransportIssuerPolicy =
  retainAsoiafAnswerTransportIssuerPolicy({
    root: scratchRoot,
    issuerId: "issuer:qualification:credential-deployment",
    issuerCertificate: fs.readFileSync(ca.certificate),
    allowedUsages: ["client-auth"],
    allowedActorRoles: ["exact-locator-reviewer"],
    allowedPrincipalPrefixes: ["actor:qualification:credential-deployment:"],
    allowedKeyCustodyClasses: ["hardware-backed", "external-agent"],
    allowExportablePrivateKeys: false,
    maxLeafLifetimeMilliseconds: 2 * 24 * 60 * 60 * 1000,
    maxRequestLifetimeMilliseconds: 4 * 60 * 60 * 1000,
    maxOrderLifetimeMilliseconds: 60 * 60 * 1000,
    minimumRenewalOverlapMilliseconds: 60 * 60 * 1000,
    approvalThreshold: 2,
    emergencyApprovalThreshold: 3,
    requiredApprovalRoles: ["issuer-operator", "actor-owner"],
    emergencyRequiredApprovalRoles: [
      "issuer-operator",
      "actor-owner",
      "security-officer",
    ],
    approvers: Object.entries(approvers).map(([approverId, entry]) => ({
      approverId,
      role: entry.role,
      publicKey: entry.publicKey,
    })),
    createdAt: new Date(caCertificate.validFromDate.getTime() + 1_000).toISOString(),
    operatorId: "operator:qualification:credential-deployment-policy",
  }).policy;

function issueLeaf(input: {
  label: string;
  key: KeyMaterial;
  mode: AsoiafAnswerTransportEnrollmentMode;
  predecessorCertificateFingerprint?: `sha256:${string}` | null;
  baseOffsetMinutes: number;
}): EnrollmentLeaf {
  const base = Date.parse(policy.createdAt) + input.baseOffsetMinutes * 60_000;
  const common = {
    policy,
    principalId: "actor:qualification:credential-deployment:reviewer",
    usage: "client-auth" as const,
    actorRole: "exact-locator-reviewer" as const,
    mode: input.mode,
    publicKey: input.key.publicKey,
    requestedSubject: "CN=credential-deployment-reviewer",
    requestedSubjectAltNames: [] as string[],
    requestedValidFrom: new Date(base - 2 * 60 * 60_000).toISOString(),
    requestedValidUntil: new Date(base + 45 * 60 * 60_000).toISOString(),
    activateAt: new Date(base + 5 * 60_000).toISOString(),
    renewAfter: new Date(base + 4 * 60 * 60_000).toISOString(),
    retireAfter: new Date(base + 8 * 60 * 60_000).toISOString(),
    predecessorCertificateFingerprint:
      input.predecessorCertificateFingerprint ?? null,
    custody: {
      custodyClass: "hardware-backed" as const,
      providerId: "provider:qualification:synthetic-hsm",
      keyReferenceDigest: input.key.handleDigest,
      attestationDigest: sha256(`attestation:${input.label}`),
      attestationUri: `attestations/${input.label}.json`,
      privateKeyExportable: false,
    },
    nonce: `credential-deployment-nonce-${input.label}-000000000001`,
    createdAt: new Date(base).toISOString(),
    expiresAt: new Date(base + 2 * 60 * 60_000).toISOString(),
    requesterId: `requester:qualification:${input.label}`,
  };
  const proofStatement = buildAsoiafAnswerTransportProofStatement(common);
  const request = submitAsoiafAnswerTransportEnrollmentRequest({
    root: scratchRoot,
    policyId: policy.policyId,
    principalId: common.principalId,
    usage: common.usage,
    actorRole: common.actorRole,
    mode: common.mode,
    publicKey: common.publicKey,
    proofAlgorithm: "rsa-sha256",
    proofSignature: sign(
      "rsa-sha256",
      serializeAsoiafAnswerTransportProofStatement(proofStatement),
      input.key.privateKey,
    ),
    requestedSubject: common.requestedSubject,
    requestedSubjectAltNames: common.requestedSubjectAltNames,
    requestedValidFrom: common.requestedValidFrom,
    requestedValidUntil: common.requestedValidUntil,
    activateAt: common.activateAt,
    renewAfter: common.renewAfter,
    retireAfter: common.retireAfter,
    predecessorCertificateFingerprint: common.predecessorCertificateFingerprint,
    custody: common.custody,
    nonce: common.nonce,
    createdAt: common.createdAt,
    expiresAt: common.expiresAt,
    requesterId: common.requesterId,
  }).request;

  for (const [index, approverId] of [
    "approver:deployment:issuer",
    "approver:deployment:owner",
  ].entries()) {
    const approver = approvers[approverId]!;
    const reason = `The ${approver.role} verified proof of possession, device custody, service scope, and the bounded ${input.label} issuance profile.`;
    const statement = buildAsoiafAnswerTransportApprovalStatement({
      policy,
      request,
      approverId,
      decision: "approve",
      decidedAt: new Date(base + (index + 1) * 60_000).toISOString(),
      reason,
    });
    retainAsoiafAnswerTransportEnrollmentApproval({
      root: scratchRoot,
      requestId: request.requestId,
      approverId,
      decision: "approve",
      decidedAt: statement.decidedAt,
      reason,
      signatureAlgorithm: "ed25519",
      signature: sign(
        "ed25519",
        serializeAsoiafAnswerTransportApprovalStatement(statement),
        approver.privateKey,
      ),
    });
  }

  const order = compileAsoiafAnswerTransportIssuanceOrder({
    root: scratchRoot,
    requestId: request.requestId,
    orderedAt: new Date(base + 10 * 60_000).toISOString(),
    expiresAt: new Date(base + 40 * 60_000).toISOString(),
    operatorId: `operator:qualification:${input.label}:order`,
  }).order;

  const csrPath = path.join(materialDirectory, `${input.label}.csr`);
  const extPath = path.join(materialDirectory, `${input.label}.ext`);
  const certificatePath = path.join(materialDirectory, `${input.label}.crt`);
  runOpenSsl([
    "req", "-new", "-sha256",
    "-key", input.key.privateKeyPath,
    "-subj", "/CN=credential-deployment-reviewer",
    "-out", csrPath,
  ]);
  fs.writeFileSync(
    extPath,
    [
      "basicConstraints=critical,CA:FALSE",
      "keyUsage=critical,digitalSignature,keyEncipherment",
      "extendedKeyUsage=clientAuth",
    ].join("\n") + "\n",
    "utf8",
  );
  runOpenSsl([
    "x509", "-req", "-sha256", "-days", "1",
    "-in", csrPath,
    "-CA", ca.certificate,
    "-CAkey", ca.key,
    "-set_serial", String(3000 + input.baseOffsetMinutes),
    "-extfile", extPath,
    "-out", certificatePath,
  ]);
  const issuedAt = new Date(base + 12 * 60_000).toISOString();
  const recordedAt = new Date(base + 13 * 60_000).toISOString();
  const issuance = recordAsoiafAnswerTransportIssuedCertificate({
    root: scratchRoot,
    orderId: order.orderId,
    certificate: fs.readFileSync(certificatePath),
    issuerCertificate: fs.readFileSync(ca.certificate),
    issuedAt,
    recordedAt,
    operatorId: `operator:qualification:${input.label}:record`,
  }).issuance;
  const admissionLink = linkAsoiafAnswerTransportRuntimeAdmission({
    root: scratchRoot,
    issuanceId: issuance.issuanceId,
    admission: {
      admissionId: `runtime-admission:${input.label}`,
      admissionFingerprint: sha256(`runtime-admission:${input.label}`),
      certificateFingerprint: issuance.certificate.certificateFingerprint,
      publicKeyFingerprint: issuance.certificate.publicKeyFingerprint,
      issuerCertificateFingerprint: issuance.certificate.issuerCertificateFingerprint,
      usage: issuance.admissionInstruction.usage,
      principalId: issuance.admissionInstruction.principalId,
      actorRole: issuance.admissionInstruction.actorRole,
      predecessorCertificateFingerprint:
        issuance.admissionInstruction.predecessorCertificateFingerprint,
      admittedAt: recordedAt,
    },
    linkedAt: new Date(base + 14 * 60_000).toISOString(),
    operatorId: `operator:qualification:${input.label}:link`,
  }).link;
  return { issuance, admissionLink, certificatePath, key: input.key };
}

function deploymentTimes(leaf: EnrollmentLeaf, offsetMinutes: number) {
  const start = Date.parse(leaf.issuance.admissionInstruction.activateAt)
    + offsetMinutes * 60_000;
  return {
    createdAt: new Date(start - 4 * 60_000).toISOString(),
    plannedInstallAt: new Date(start - 3 * 60_000).toISOString(),
    plannedActivateAt: new Date(start).toISOString(),
    rollbackUntil: new Date(start + 30 * 60_000).toISOString(),
    retirePredecessorAfter: new Date(start + 60 * 60_000).toISOString(),
  };
}

const initialKey = keyMaterial("deployment-initial");
const initialLeaf = issueLeaf({
  label: "deployment-initial",
  key: initialKey,
  mode: "initial" as const,
  baseOffsetMinutes: 30,
});

const deviceInput = {
  root: estateRoot,
  deviceAgentId: "device-agent:qualification:reviewer-host",
  deviceAgentPublicKeyPath: agentPublicKeyPath,
  platform: "synthetic" as const,
  trustDomain: "trust-domain:qualification:answer-estate",
  allowedProviderClasses: ["synthetic-fixture" as const, "tpm2-pkcs11" as const],
  registeredAt: new Date(Date.parse(policy.createdAt) + 20 * 60_000).toISOString(),
  operatorId: "operator:qualification:device-registration",
};
const scratchDevice = retainAsoiafAnswerCredentialDevice({
  ...deviceInput,
  root: scratchRoot,
  deviceAgentPublicKey: agent.publicKey,
}).device;
const initialKeyInput = {
  root: estateRoot,
  deviceId: scratchDevice.deviceId,
  providerClass: "synthetic-fixture" as const,
  providerKeyId: "provider-key:qualification:deployment-initial",
  providerHandleDigest: initialKey.handleDigest,
  publicKeyPath: initialKey.publicKeyPath,
  custodyClass: "hardware-backed" as const,
  privateKeyExportable: false,
  registeredAt: new Date(Date.parse(policy.createdAt) + 21 * 60_000).toISOString(),
  operatorId: "operator:qualification:deployment-initial:key-registration",
};
const scratchInitialKey = retainAsoiafAnswerCredentialKeyReference({
  ...initialKeyInput,
  root: scratchRoot,
  publicKey: initialKey.publicKey,
}).keyReference;
const initialPlanInput = {
  root: estateRoot,
  mode: "initial" as const,
  serviceId: "service:qualification:credential-deployment",
  deviceId: scratchDevice.deviceId,
  keyReferenceId: scratchInitialKey.keyReferenceId,
  issuance: initialLeaf.issuance,
  admissionLink: initialLeaf.admissionLink,
  ...deploymentTimes(initialLeaf, 10),
  operatorId: "operator:qualification:deployment-initial:plan",
};
const scratchInitialPlan = planAsoiafAnswerCredentialDeployment({
  ...initialPlanInput,
  root: scratchRoot,
}).plan;

function installAndActivate(input: {
  label: string;
  plan: AsoiafAnswerCredentialDeploymentPlan;
  leaf: EnrollmentLeaf;
}) {
  const providerReceiptDigest = sha256(`provider-installation:${input.label}`);
  const installationStatement = buildAsoiafAnswerCredentialInstallationStatement({
    root: scratchRoot,
    planId: input.plan.planId,
    installedAt: input.plan.plannedInstallAt,
    providerReceiptDigest,
  });
  const installationSignature = sign(
    "ed25519",
    serializeAsoiafAnswerCredentialInstallationStatement(installationStatement),
    agent.privateKey,
  );
  const installationInput = {
    root: estateRoot,
    planId: input.plan.planId,
    certificatePath: input.leaf.certificatePath,
    issuerCertificatePath: ca.certificate,
    installedAt: input.plan.plannedInstallAt,
    providerReceiptDigest,
    deviceAgentSignatureAlgorithm: "ed25519" as const,
    deviceAgentSignatureBase64: installationSignature.toString("base64"),
    operatorId: `operator:qualification:${input.label}:installation`,
  };
  const installation = admitAsoiafAnswerCredentialInstallation({
    root: scratchRoot,
    planId: input.plan.planId,
    certificate: fs.readFileSync(input.leaf.certificatePath),
    issuerCertificate: fs.readFileSync(ca.certificate),
    installedAt: input.plan.plannedInstallAt,
    providerReceiptDigest,
    deviceAgentSignatureAlgorithm: "ed25519" as const,
    deviceAgentSignature: installationSignature,
    operatorId: installationInput.operatorId,
  }).installation;

  const challengeDigest = sha256(`activation-challenge:${input.label}`);
  const activationStatement = buildAsoiafAnswerCredentialActivationStatement({
    root: scratchRoot,
    planId: input.plan.planId,
    installationId: installation.installationId,
    challengeDigest,
    activatedAt: input.plan.plannedActivateAt,
  });
  const activationBytes = serializeAsoiafAnswerCredentialActivationStatement(
    activationStatement,
  );
  const activationInput = {
    root: estateRoot,
    planId: input.plan.planId,
    installationId: installation.installationId,
    challengeDigest,
    activatedAt: input.plan.plannedActivateAt,
    credentialSignatureAlgorithm: "rsa-sha256" as const,
    credentialSignatureBase64: sign(
      "rsa-sha256",
      activationBytes,
      input.leaf.key.privateKey,
    ).toString("base64"),
    deviceAgentSignatureAlgorithm: "ed25519" as const,
    deviceAgentSignatureBase64: sign(
      "ed25519",
      activationBytes,
      agent.privateKey,
    ).toString("base64"),
    operatorId: `operator:qualification:${input.label}:activation`,
  };
  const activation = admitAsoiafAnswerCredentialActivation({
    ...activationInput,
    root: scratchRoot,
    credentialSignature: Buffer.from(
      activationInput.credentialSignatureBase64,
      "base64",
    ),
    deviceAgentSignature: Buffer.from(
      activationInput.deviceAgentSignatureBase64,
      "base64",
    ),
  }).activation;
  return { installationInput, activationInput, installation, activation };
}

const initialLifecycle = installAndActivate({
  label: "deployment-initial",
  plan: scratchInitialPlan,
  leaf: initialLeaf,
});

const successorKey = keyMaterial("deployment-successor");
const successorLeaf = issueLeaf({
  label: "deployment-successor",
  key: successorKey,
  mode: "renewal",
  predecessorCertificateFingerprint: scratchInitialPlan.certificateFingerprint,
  baseOffsetMinutes: 40,
});
const successorKeyInput = {
  root: estateRoot,
  deviceId: scratchDevice.deviceId,
  providerClass: "synthetic-fixture" as const,
  providerKeyId: "provider-key:qualification:deployment-successor",
  providerHandleDigest: successorKey.handleDigest,
  publicKeyPath: successorKey.publicKeyPath,
  custodyClass: "hardware-backed" as const,
  privateKeyExportable: false,
  registeredAt: new Date(Date.parse(policy.createdAt) + 22 * 60_000).toISOString(),
  operatorId: "operator:qualification:deployment-successor:key-registration",
};
const scratchSuccessorKey = retainAsoiafAnswerCredentialKeyReference({
  ...successorKeyInput,
  root: scratchRoot,
  publicKey: successorKey.publicKey,
}).keyReference;
const successorTimes = {
  createdAt: new Date(
    Date.parse(scratchInitialPlan.plannedActivateAt) + 2 * 60_000,
  ).toISOString(),
  plannedInstallAt: new Date(
    Date.parse(scratchInitialPlan.plannedActivateAt) + 3 * 60_000,
  ).toISOString(),
  plannedActivateAt: new Date(
    Date.parse(scratchInitialPlan.plannedActivateAt) + 5 * 60_000,
  ).toISOString(),
  rollbackUntil: new Date(
    Date.parse(scratchInitialPlan.plannedActivateAt) + 15 * 60_000,
  ).toISOString(),
  retirePredecessorAfter: new Date(
    Date.parse(scratchInitialPlan.plannedActivateAt) + 30 * 60_000,
  ).toISOString(),
};
const successorPlanInput = {
  root: estateRoot,
  mode: "successor" as const,
  serviceId: scratchInitialPlan.serviceId,
  deviceId: scratchDevice.deviceId,
  keyReferenceId: scratchSuccessorKey.keyReferenceId,
  issuance: successorLeaf.issuance,
  admissionLink: successorLeaf.admissionLink,
  predecessorPlanId: scratchInitialPlan.planId,
  predecessorActivationId: initialLifecycle.activation.activationId,
  ...successorTimes,
  operatorId: "operator:qualification:deployment-successor:plan",
};
const scratchSuccessorPlan = planAsoiafAnswerCredentialDeployment({
  ...successorPlanInput,
  root: scratchRoot,
}).plan;
const successorLifecycle = installAndActivate({
  label: "deployment-successor",
  plan: scratchSuccessorPlan,
  leaf: successorLeaf,
});

const rollbackReason =
  "The successor credential failed its post-activation service health check, so the bounded rollback restores the exact predecessor activation.";
const rollbackProviderReceiptDigest = sha256(
  "deployment-successor-rollback-provider-receipt",
);
const rolledBackAt = new Date(
  Date.parse(successorLifecycle.activation.statement.activatedAt) + 2 * 60_000,
).toISOString();
const rollbackStatement = buildAsoiafAnswerCredentialRollbackStatement({
  root: scratchRoot,
  planId: scratchSuccessorPlan.planId,
  activationId: successorLifecycle.activation.activationId,
  predecessorActivationId: initialLifecycle.activation.activationId,
  providerReceiptDigest: rollbackProviderReceiptDigest,
  rolledBackAt,
  reason: rollbackReason,
});
const rollbackInput = {
  root: estateRoot,
  planId: scratchSuccessorPlan.planId,
  activationId: successorLifecycle.activation.activationId,
  predecessorActivationId: initialLifecycle.activation.activationId,
  providerReceiptDigest: rollbackProviderReceiptDigest,
  rolledBackAt,
  reason: rollbackReason,
  deviceAgentSignatureAlgorithm: "ed25519" as const,
  deviceAgentSignatureBase64: sign(
    "ed25519",
    serializeAsoiafAnswerCredentialRollbackStatement(rollbackStatement),
    agent.privateKey,
  ).toString("base64"),
  operatorId: "operator:qualification:deployment-successor:rollback",
};
const scratchRollback = retainAsoiafAnswerCredentialRollback({
  ...rollbackInput,
  root: scratchRoot,
  deviceAgentSignature: Buffer.from(
    rollbackInput.deviceAgentSignatureBase64,
    "base64",
  ),
}).rollback;

writeJson("device-input.json", deviceInput);
writeJson("initial-key-input.json", initialKeyInput);
writeJson("initial-plan-input.json", initialPlanInput);
writeJson("initial-installation-input.json", initialLifecycle.installationInput);
writeJson("initial-activation-input.json", initialLifecycle.activationInput);
writeJson("successor-key-input.json", successorKeyInput);
writeJson("successor-plan-input.json", successorPlanInput);
writeJson("successor-installation-input.json", successorLifecycle.installationInput);
writeJson("successor-activation-input.json", successorLifecycle.activationInput);
writeJson("rollback-input.json", rollbackInput);
writeJson("expected.json", {
  estateRoot,
  deviceId: scratchDevice.deviceId,
  initialKeyReferenceId: scratchInitialKey.keyReferenceId,
  initialPlanId: scratchInitialPlan.planId,
  initialInstallationId: initialLifecycle.installation.installationId,
  initialActivationId: initialLifecycle.activation.activationId,
  initialCertificateFingerprint: scratchInitialPlan.certificateFingerprint,
  successorKeyReferenceId: scratchSuccessorKey.keyReferenceId,
  successorPlanId: scratchSuccessorPlan.planId,
  successorInstallationId: successorLifecycle.installation.installationId,
  successorActivationId: successorLifecycle.activation.activationId,
  successorCertificateFingerprint: scratchSuccessorPlan.certificateFingerprint,
  rollbackId: scratchRollback.rollbackId,
  finalServiceState: {
    serviceId: scratchInitialPlan.serviceId,
    planId: scratchInitialPlan.planId,
    activationId: initialLifecycle.activation.activationId,
    certificateFingerprint: scratchInitialPlan.certificateFingerprint,
    stateOrigin: "rollback",
  },
  transientMaterialDirectory: materialDirectory,
  transientMaterialFiles: fs.readdirSync(materialDirectory)
    .filter((name) => name !== "scratch-estate")
    .sort(),
});

fs.rmSync(scratchRoot, { recursive: true, force: true });
process.stdout.write(`${JSON.stringify({
  ok: true,
  outputDirectory,
  estateRoot,
  materialDirectory,
  deviceId: scratchDevice.deviceId,
  initialPlanId: scratchInitialPlan.planId,
  successorPlanId: scratchSuccessorPlan.planId,
  rollbackId: scratchRollback.rollbackId,
}, null, 2)}\n`);
