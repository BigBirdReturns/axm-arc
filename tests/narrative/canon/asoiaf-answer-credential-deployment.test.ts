import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  admitAsoiafAnswerCredentialActivation,
  admitAsoiafAnswerCredentialInstallation,
  asoiafAnswerCredentialDeploymentPaths,
  buildAsoiafAnswerCredentialActivationStatement,
  buildAsoiafAnswerCredentialInstallationStatement,
  buildAsoiafAnswerCredentialRollbackStatement,
  planAsoiafAnswerCredentialDeployment,
  readAsoiafAnswerCredentialDeploymentStatus,
  rebuildAsoiafAnswerCredentialDeploymentState,
  retainAsoiafAnswerCredentialDevice,
  retainAsoiafAnswerCredentialKeyReference,
  retainAsoiafAnswerCredentialRollback,
  serializeAsoiafAnswerCredentialActivationStatement,
  serializeAsoiafAnswerCredentialInstallationStatement,
  serializeAsoiafAnswerCredentialRollbackStatement,
  verifyAsoiafAnswerCredentialDeploymentEstate,
  type AsoiafAnswerCredentialActivation,
  type AsoiafAnswerCredentialDeploymentPlan,
} from "../../../tools/lib/asoiaf-answer-credential-deployment.js";
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
} from "../../../tools/lib/asoiaf-answer-desk-transport-enrollment.js";
import {
  sha256,
} from "../../../tools/lib/asoiaf-external-estate.js";

interface KeyMaterial {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  handleDigest: `sha256:${string}`;
}

interface EnrollmentLeaf {
  issuance: AsoiafAnswerTransportIssuanceReceipt;
  admissionLink: AsoiafAnswerTransportAdmissionLink;
  certificatePath: string;
  key: KeyMaterial;
}

interface Fixture {
  root: string;
  certificateDirectory: string;
  caCertificate: string;
  caKey: string;
  agentPrivateKey: crypto.KeyObject;
  agentPublicKey: crypto.KeyObject;
  approvers: Record<string, {
    role: "issuer-operator" | "actor-owner" | "security-officer";
    privateKey: crypto.KeyObject;
    publicKey: crypto.KeyObject;
  }>;
  policy: AsoiafAnswerTransportIssuerPolicy;
}

const roots: string[] = [];

function runOpenSsl(args: string[]): void {
  execFileSync("openssl", args, { stdio: ["ignore", "ignore", "pipe"] });
}

function createCa(directory: string) {
  const certificate = path.join(directory, "deployment-ca.crt");
  const key = path.join(directory, "deployment-ca.key");
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

function fixture(): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-credential-deployment-"));
  roots.push(root);
  const certificateDirectory = path.join(root, "ephemeral-certificates");
  fs.mkdirSync(certificateDirectory, { recursive: true });
  const ca = createCa(certificateDirectory);
  const agent = crypto.generateKeyPairSync("ed25519");
  const approvers: Fixture["approvers"] = {};
  for (const [approverId, role] of [
    ["approver:deployment:issuer", "issuer-operator"],
    ["approver:deployment:owner", "actor-owner"],
    ["approver:deployment:security", "security-officer"],
  ] as const) {
    const pair = crypto.generateKeyPairSync("ed25519");
    approvers[approverId] = { role, ...pair };
  }
  const caCertificate = new crypto.X509Certificate(fs.readFileSync(ca.certificate));
  const policy = retainAsoiafAnswerTransportIssuerPolicy({
    root,
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
  return {
    root,
    certificateDirectory,
    caCertificate: ca.certificate,
    caKey: ca.key,
    agentPrivateKey: agent.privateKey,
    agentPublicKey: agent.publicKey,
    approvers,
    policy,
  };
}

function keyMaterial(label: string): KeyMaterial {
  const key = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    privateKey: key.privateKey,
    publicKey: key.publicKey,
    handleDigest: sha256(`opaque-provider-handle:${label}`),
  };
}

function sign(
  algorithm: "rsa-sha256" | "ecdsa-sha256" | "ed25519",
  message: Buffer,
  privateKey: crypto.KeyObject,
): Buffer {
  return crypto.sign(algorithm === "ed25519" ? null : "sha256", message, privateKey);
}

function issueLeaf(input: {
  f: Fixture;
  label: string;
  key: KeyMaterial;
  mode: AsoiafAnswerTransportEnrollmentMode;
  predecessorCertificateFingerprint?: `sha256:${string}` | null;
  baseOffsetMinutes: number;
}): EnrollmentLeaf {
  const base = Date.parse(input.f.policy.createdAt)
    + input.baseOffsetMinutes * 60_000;
  const common = {
    policy: input.f.policy,
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
    root: input.f.root,
    policyId: input.f.policy.policyId,
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
    const approver = input.f.approvers[approverId]!;
    const reason = `The ${approver.role} verified proof of possession, device custody, service scope, and the bounded ${input.label} issuance profile.`;
    const statement = buildAsoiafAnswerTransportApprovalStatement({
      policy: input.f.policy,
      request,
      approverId,
      decision: "approve",
      decidedAt: new Date(base + (index + 1) * 60_000).toISOString(),
      reason,
    });
    retainAsoiafAnswerTransportEnrollmentApproval({
      root: input.f.root,
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

  const orderedAt = new Date(base + 10 * 60_000).toISOString();
  const order = compileAsoiafAnswerTransportIssuanceOrder({
    root: input.f.root,
    requestId: request.requestId,
    orderedAt,
    expiresAt: new Date(base + 40 * 60_000).toISOString(),
    operatorId: `operator:qualification:${input.label}:order`,
  }).order;

  const keyPath = path.join(input.f.certificateDirectory, `${input.label}.key`);
  const csrPath = path.join(input.f.certificateDirectory, `${input.label}.csr`);
  const extPath = path.join(input.f.certificateDirectory, `${input.label}.ext`);
  const certificatePath = path.join(input.f.certificateDirectory, `${input.label}.crt`);
  fs.writeFileSync(
    keyPath,
    input.key.privateKey.export({ format: "pem", type: "pkcs8" }),
  );
  runOpenSsl([
    "req", "-new", "-sha256",
    "-key", keyPath,
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
    "-CA", input.f.caCertificate,
    "-CAkey", input.f.caKey,
    "-set_serial", String(2000 + input.baseOffsetMinutes),
    "-extfile", extPath,
    "-out", certificatePath,
  ]);
  const issuedAt = new Date(base + 12 * 60_000).toISOString();
  const recordedAt = new Date(base + 13 * 60_000).toISOString();
  const issuance = recordAsoiafAnswerTransportIssuedCertificate({
    root: input.f.root,
    orderId: order.orderId,
    certificate: fs.readFileSync(certificatePath),
    issuerCertificate: fs.readFileSync(input.f.caCertificate),
    issuedAt,
    recordedAt,
    operatorId: `operator:qualification:${input.label}:record`,
  }).issuance;
  const admissionReference = {
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
  };
  const admissionLink = linkAsoiafAnswerTransportRuntimeAdmission({
    root: input.f.root,
    issuanceId: issuance.issuanceId,
    admission: admissionReference,
    linkedAt: new Date(base + 14 * 60_000).toISOString(),
    operatorId: `operator:qualification:${input.label}:link`,
  }).link;
  return {
    issuance,
    admissionLink,
    certificatePath,
    key: input.key,
  };
}

function registerDevice(f: Fixture) {
  return retainAsoiafAnswerCredentialDevice({
    root: f.root,
    deviceAgentId: "device-agent:qualification:reviewer-host",
    deviceAgentPublicKey: f.agentPublicKey,
    platform: "synthetic",
    trustDomain: "trust-domain:qualification:answer-estate",
    allowedProviderClasses: ["synthetic-fixture", "tpm2-pkcs11"],
    registeredAt: new Date(Date.parse(f.policy.createdAt) + 20 * 60_000).toISOString(),
    operatorId: "operator:qualification:device-registration",
  });
}

function registerKey(f: Fixture, deviceId: string, leaf: EnrollmentLeaf, label: string) {
  return retainAsoiafAnswerCredentialKeyReference({
    root: f.root,
    deviceId,
    providerClass: "synthetic-fixture",
    providerKeyId: `provider-key:qualification:${label}`,
    providerHandleDigest: leaf.key.handleDigest,
    publicKey: leaf.key.publicKey,
    custodyClass: "hardware-backed",
    privateKeyExportable: false,
    registeredAt: new Date(Date.parse(f.policy.createdAt) + 21 * 60_000).toISOString(),
    operatorId: `operator:qualification:${label}:key-registration`,
  });
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

function installAndActivate(input: {
  f: Fixture;
  plan: AsoiafAnswerCredentialDeploymentPlan;
  leaf: EnrollmentLeaf;
  suffix: string;
}): AsoiafAnswerCredentialActivation {
  const installedAt = input.plan.plannedInstallAt;
  const providerReceiptDigest = sha256(`provider-installation:${input.suffix}`);
  const installationStatement = buildAsoiafAnswerCredentialInstallationStatement({
    root: input.f.root,
    planId: input.plan.planId,
    installedAt,
    providerReceiptDigest,
  });
  const installation = admitAsoiafAnswerCredentialInstallation({
    root: input.f.root,
    planId: input.plan.planId,
    certificate: fs.readFileSync(input.leaf.certificatePath),
    issuerCertificate: fs.readFileSync(input.f.caCertificate),
    installedAt,
    providerReceiptDigest,
    deviceAgentSignatureAlgorithm: "ed25519",
    deviceAgentSignature: sign(
      "ed25519",
      serializeAsoiafAnswerCredentialInstallationStatement(installationStatement),
      input.f.agentPrivateKey,
    ),
    operatorId: `operator:qualification:${input.suffix}:installation`,
  }).installation;

  const challengeDigest = sha256(`activation-challenge:${input.suffix}`);
  const activationStatement = buildAsoiafAnswerCredentialActivationStatement({
    root: input.f.root,
    planId: input.plan.planId,
    installationId: installation.installationId,
    challengeDigest,
    activatedAt: input.plan.plannedActivateAt,
  });
  return admitAsoiafAnswerCredentialActivation({
    root: input.f.root,
    planId: input.plan.planId,
    installationId: installation.installationId,
    challengeDigest,
    activatedAt: input.plan.plannedActivateAt,
    credentialSignatureAlgorithm: "rsa-sha256",
    credentialSignature: sign(
      "rsa-sha256",
      serializeAsoiafAnswerCredentialActivationStatement(activationStatement),
      input.leaf.key.privateKey,
    ),
    deviceAgentSignatureAlgorithm: "ed25519",
    deviceAgentSignature: sign(
      "ed25519",
      serializeAsoiafAnswerCredentialActivationStatement(activationStatement),
      input.f.agentPrivateKey,
    ),
    operatorId: `operator:qualification:${input.suffix}:activation`,
  }).activation;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF device-bound credential deployment", () => {
  it("registers one device and one non-exportable opaque key reference with exact replay", () => {
    const f = fixture();
    const leaf = issueLeaf({
      f,
      label: "initial",
      key: keyMaterial("initial"),
      mode: "initial",
      baseOffsetMinutes: 30,
    });
    const firstDevice = registerDevice(f);
    const replayDevice = registerDevice(f);
    const firstKey = registerKey(f, firstDevice.device.deviceId, leaf, "initial");
    const replayKey = registerKey(f, firstDevice.device.deviceId, leaf, "initial");

    expect(replayDevice.replayed).toBe(true);
    expect(replayDevice.device).toEqual(firstDevice.device);
    expect(replayKey.replayed).toBe(true);
    expect(replayKey.keyReference).toEqual(firstKey.keyReference);
    expect(firstKey.keyReference).toEqual(expect.objectContaining({
      providerClass: "synthetic-fixture",
      privateKeyExportable: false,
      privateKeyRetained: false,
      privateKeyPathRetained: false,
      rawProviderHandleRetained: false,
      providerSecretRetained: false,
      registrationAuthority: "opaque-key-reference-only",
      authority: "none",
      graphEffect: "none",
      canonEffect: "none",
      answerEffect: "none",
    }));
    expect(verifyAsoiafAnswerCredentialDeploymentEstate(f.root)).toEqual([]);
  });

  it("refuses exportable keys and provider classes outside device policy", () => {
    const exportable = fixture();
    const exportableLeaf = issueLeaf({
      f: exportable,
      label: "exportable",
      key: keyMaterial("exportable"),
      mode: "initial",
      baseOffsetMinutes: 30,
    });
    const device = registerDevice(exportable).device;
    expect(() => retainAsoiafAnswerCredentialKeyReference({
      root: exportable.root,
      deviceId: device.deviceId,
      providerClass: "synthetic-fixture",
      providerKeyId: "provider-key:qualification:exportable",
      providerHandleDigest: exportableLeaf.key.handleDigest,
      publicKey: exportableLeaf.key.publicKey,
      custodyClass: "hardware-backed",
      privateKeyExportable: true,
      registeredAt: new Date(Date.parse(exportable.policy.createdAt) + 21 * 60_000).toISOString(),
      operatorId: "operator:qualification:exportable",
    })).toThrow(/requires a non-exportable private key/);

    expect(() => retainAsoiafAnswerCredentialKeyReference({
      root: exportable.root,
      deviceId: device.deviceId,
      providerClass: "windows-cng",
      providerKeyId: "provider-key:qualification:wrong-provider",
      providerHandleDigest: exportableLeaf.key.handleDigest,
      publicKey: exportableLeaf.key.publicKey,
      custodyClass: "operating-system-keychain",
      privateKeyExportable: false,
      registeredAt: new Date(Date.parse(exportable.policy.createdAt) + 22 * 60_000).toISOString(),
      operatorId: "operator:qualification:wrong-provider",
    })).toThrow(/does not permit provider class/);
  });

  it("installs and activates the exact governed leaf through independent device and credential signatures", () => {
    const f = fixture();
    const leaf = issueLeaf({
      f,
      label: "initial",
      key: keyMaterial("initial"),
      mode: "initial",
      baseOffsetMinutes: 30,
    });
    const device = registerDevice(f).device;
    const key = registerKey(f, device.deviceId, leaf, "initial").keyReference;
    const planResult = planAsoiafAnswerCredentialDeployment({
      root: f.root,
      mode: "initial",
      serviceId: "service:qualification:answer-reviewer",
      deviceId: device.deviceId,
      keyReferenceId: key.keyReferenceId,
      issuance: leaf.issuance,
      admissionLink: leaf.admissionLink,
      ...deploymentTimes(leaf, 10),
      operatorId: "operator:qualification:initial-plan",
    });
    const replayPlan = planAsoiafAnswerCredentialDeployment({
      root: f.root,
      mode: "initial",
      serviceId: "service:qualification:answer-reviewer",
      deviceId: device.deviceId,
      keyReferenceId: key.keyReferenceId,
      issuance: leaf.issuance,
      admissionLink: leaf.admissionLink,
      ...deploymentTimes(leaf, 10),
      operatorId: "operator:qualification:initial-plan",
    });
    expect(replayPlan.replayed).toBe(true);
    expect(replayPlan.plan).toEqual(planResult.plan);

    const activation = installAndActivate({
      f,
      plan: planResult.plan,
      leaf,
      suffix: "initial",
    });
    const status = readAsoiafAnswerCredentialDeploymentStatus(f.root);
    expect(status.installations).toHaveLength(1);
    expect(status.activations).toEqual([activation]);
    expect(status.state?.entries).toEqual([
      expect.objectContaining({
        serviceId: planResult.plan.serviceId,
        planId: planResult.plan.planId,
        activationId: activation.activationId,
        certificateFingerprint: leaf.issuance.certificate.certificateFingerprint,
        stateOrigin: "activation",
      }),
    ]);
    expect(rebuildAsoiafAnswerCredentialDeploymentState(f.root)).toEqual(status.state);
    expect(verifyAsoiafAnswerCredentialDeploymentEstate(f.root)).toEqual([]);
  });

  it("refuses wrong certificate bytes and invalid installation or activation signatures", () => {
    const wrongCertificateFixture = fixture();
    const correctLeaf = issueLeaf({
      f: wrongCertificateFixture,
      label: "correct",
      key: keyMaterial("correct"),
      mode: "initial",
      baseOffsetMinutes: 30,
    });
    const wrongLeaf = issueLeaf({
      f: wrongCertificateFixture,
      label: "wrong",
      key: keyMaterial("wrong"),
      mode: "initial",
      baseOffsetMinutes: 60,
    });
    const device = registerDevice(wrongCertificateFixture).device;
    const key = registerKey(
      wrongCertificateFixture,
      device.deviceId,
      correctLeaf,
      "correct",
    ).keyReference;
    const plan = planAsoiafAnswerCredentialDeployment({
      root: wrongCertificateFixture.root,
      mode: "initial",
      serviceId: "service:qualification:wrong-certificate",
      deviceId: device.deviceId,
      keyReferenceId: key.keyReferenceId,
      issuance: correctLeaf.issuance,
      admissionLink: correctLeaf.admissionLink,
      ...deploymentTimes(correctLeaf, 10),
      operatorId: "operator:qualification:wrong-certificate-plan",
    }).plan;
    const providerReceiptDigest = sha256("wrong-certificate-provider-receipt");
    const statement = buildAsoiafAnswerCredentialInstallationStatement({
      root: wrongCertificateFixture.root,
      planId: plan.planId,
      installedAt: plan.plannedInstallAt,
      providerReceiptDigest,
    });
    expect(() => admitAsoiafAnswerCredentialInstallation({
      root: wrongCertificateFixture.root,
      planId: plan.planId,
      certificate: fs.readFileSync(wrongLeaf.certificatePath),
      issuerCertificate: fs.readFileSync(wrongCertificateFixture.caCertificate),
      installedAt: plan.plannedInstallAt,
      providerReceiptDigest,
      deviceAgentSignatureAlgorithm: "ed25519",
      deviceAgentSignature: sign(
        "ed25519",
        serializeAsoiafAnswerCredentialInstallationStatement(statement),
        wrongCertificateFixture.agentPrivateKey,
      ),
      operatorId: "operator:qualification:wrong-certificate-install",
    })).toThrow(/differs from plan custody/);

    expect(() => admitAsoiafAnswerCredentialInstallation({
      root: wrongCertificateFixture.root,
      planId: plan.planId,
      certificate: fs.readFileSync(correctLeaf.certificatePath),
      issuerCertificate: fs.readFileSync(wrongCertificateFixture.caCertificate),
      installedAt: plan.plannedInstallAt,
      providerReceiptDigest,
      deviceAgentSignatureAlgorithm: "ed25519",
      deviceAgentSignature: Buffer.alloc(64, 1),
      operatorId: "operator:qualification:wrong-agent-install",
    })).toThrow(/device-agent signature is invalid/);

    const installation = admitAsoiafAnswerCredentialInstallation({
      root: wrongCertificateFixture.root,
      planId: plan.planId,
      certificate: fs.readFileSync(correctLeaf.certificatePath),
      issuerCertificate: fs.readFileSync(wrongCertificateFixture.caCertificate),
      installedAt: plan.plannedInstallAt,
      providerReceiptDigest,
      deviceAgentSignatureAlgorithm: "ed25519",
      deviceAgentSignature: sign(
        "ed25519",
        serializeAsoiafAnswerCredentialInstallationStatement(statement),
        wrongCertificateFixture.agentPrivateKey,
      ),
      operatorId: "operator:qualification:correct-install",
    }).installation;
    const activationStatement = buildAsoiafAnswerCredentialActivationStatement({
      root: wrongCertificateFixture.root,
      planId: plan.planId,
      installationId: installation.installationId,
      challengeDigest: sha256("wrong-credential-signature-challenge"),
      activatedAt: plan.plannedActivateAt,
    });
    expect(() => admitAsoiafAnswerCredentialActivation({
      root: wrongCertificateFixture.root,
      planId: plan.planId,
      installationId: installation.installationId,
      challengeDigest: activationStatement.challengeDigest,
      activatedAt: plan.plannedActivateAt,
      credentialSignatureAlgorithm: "rsa-sha256",
      credentialSignature: sign(
        "rsa-sha256",
        serializeAsoiafAnswerCredentialActivationStatement(activationStatement),
        wrongLeaf.key.privateKey,
      ),
      deviceAgentSignatureAlgorithm: "ed25519",
      deviceAgentSignature: sign(
        "ed25519",
        serializeAsoiafAnswerCredentialActivationStatement(activationStatement),
        wrongCertificateFixture.agentPrivateKey,
      ),
      operatorId: "operator:qualification:wrong-credential-activation",
    })).toThrow(/private-key possession signature is invalid/);
  });

  it("rotates to a successor with bounded overlap, then rolls back to the exact predecessor", () => {
    const f = fixture();
    const initialLeaf = issueLeaf({
      f,
      label: "rotation-v1",
      key: keyMaterial("rotation-v1"),
      mode: "initial",
      baseOffsetMinutes: 30,
    });
    const device = registerDevice(f).device;
    const initialKey = registerKey(f, device.deviceId, initialLeaf, "rotation-v1").keyReference;
    const initialPlan = planAsoiafAnswerCredentialDeployment({
      root: f.root,
      mode: "initial",
      serviceId: "service:qualification:rotation",
      deviceId: device.deviceId,
      keyReferenceId: initialKey.keyReferenceId,
      issuance: initialLeaf.issuance,
      admissionLink: initialLeaf.admissionLink,
      ...deploymentTimes(initialLeaf, 10),
      operatorId: "operator:qualification:rotation-v1-plan",
    }).plan;
    const initialActivation = installAndActivate({
      f,
      plan: initialPlan,
      leaf: initialLeaf,
      suffix: "rotation-v1",
    });

    const successorLeaf = issueLeaf({
      f,
      label: "rotation-v2",
      key: keyMaterial("rotation-v2"),
      mode: "renewal",
      predecessorCertificateFingerprint: initialPlan.certificateFingerprint,
      baseOffsetMinutes: 40,
    });
    const successorKey = registerKey(f, device.deviceId, successorLeaf, "rotation-v2").keyReference;
    const successorTimes = {
      createdAt: new Date(Date.parse(initialPlan.plannedActivateAt) + 2 * 60_000).toISOString(),
      plannedInstallAt: new Date(Date.parse(initialPlan.plannedActivateAt) + 3 * 60_000).toISOString(),
      plannedActivateAt: new Date(Date.parse(initialPlan.plannedActivateAt) + 5 * 60_000).toISOString(),
      rollbackUntil: new Date(Date.parse(initialPlan.plannedActivateAt) + 15 * 60_000).toISOString(),
      retirePredecessorAfter: new Date(Date.parse(initialPlan.plannedActivateAt) + 30 * 60_000).toISOString(),
    };
    const successorPlan = planAsoiafAnswerCredentialDeployment({
      root: f.root,
      mode: "successor",
      serviceId: initialPlan.serviceId,
      deviceId: device.deviceId,
      keyReferenceId: successorKey.keyReferenceId,
      issuance: successorLeaf.issuance,
      admissionLink: successorLeaf.admissionLink,
      predecessorPlanId: initialPlan.planId,
      predecessorActivationId: initialActivation.activationId,
      ...successorTimes,
      operatorId: "operator:qualification:rotation-v2-plan",
    }).plan;
    const successorActivation = installAndActivate({
      f,
      plan: successorPlan,
      leaf: successorLeaf,
      suffix: "rotation-v2",
    });
    expect(readAsoiafAnswerCredentialDeploymentStatus(f.root).state?.entries[0])
      .toEqual(expect.objectContaining({
        planId: successorPlan.planId,
        activationId: successorActivation.activationId,
        stateOrigin: "activation",
      }));

    const reason =
      "The successor credential failed its post-activation service health check, so the bounded rollback restores the exact predecessor activation.";
    const providerReceiptDigest = sha256("rotation-v2-rollback-provider-receipt");
    const rolledBackAt = new Date(
      Date.parse(successorActivation.statement.activatedAt) + 2 * 60_000,
    ).toISOString();
    const rollbackStatement = buildAsoiafAnswerCredentialRollbackStatement({
      root: f.root,
      planId: successorPlan.planId,
      activationId: successorActivation.activationId,
      predecessorActivationId: initialActivation.activationId,
      providerReceiptDigest,
      rolledBackAt,
      reason,
    });
    const first = retainAsoiafAnswerCredentialRollback({
      root: f.root,
      planId: successorPlan.planId,
      activationId: successorActivation.activationId,
      predecessorActivationId: initialActivation.activationId,
      providerReceiptDigest,
      rolledBackAt,
      reason,
      deviceAgentSignatureAlgorithm: "ed25519",
      deviceAgentSignature: sign(
        "ed25519",
        serializeAsoiafAnswerCredentialRollbackStatement(rollbackStatement),
        f.agentPrivateKey,
      ),
      operatorId: "operator:qualification:rotation-v2-rollback",
    });
    const replay = retainAsoiafAnswerCredentialRollback({
      root: f.root,
      planId: successorPlan.planId,
      activationId: successorActivation.activationId,
      predecessorActivationId: initialActivation.activationId,
      providerReceiptDigest,
      rolledBackAt,
      reason,
      deviceAgentSignatureAlgorithm: "ed25519",
      deviceAgentSignature: sign(
        "ed25519",
        serializeAsoiafAnswerCredentialRollbackStatement(rollbackStatement),
        f.agentPrivateKey,
      ),
      operatorId: "operator:qualification:rotation-v2-rollback",
    });
    expect(replay.replayed).toBe(true);
    expect(replay.rollback).toEqual(first.rollback);
    expect(replay.state.entries[0]).toEqual(expect.objectContaining({
      planId: initialPlan.planId,
      activationId: initialActivation.activationId,
      stateOrigin: "rollback",
    }));
    expect(verifyAsoiafAnswerCredentialDeploymentEstate(f.root)).toEqual([]);
  });

  it("refuses successor discontinuity and rollback after the deadline", () => {
    const f = fixture();
    const initialLeaf = issueLeaf({
      f,
      label: "bounded-v1",
      key: keyMaterial("bounded-v1"),
      mode: "initial",
      baseOffsetMinutes: 30,
    });
    const device = registerDevice(f).device;
    const initialKey = registerKey(f, device.deviceId, initialLeaf, "bounded-v1").keyReference;
    const initialPlan = planAsoiafAnswerCredentialDeployment({
      root: f.root,
      mode: "initial",
      serviceId: "service:qualification:bounded",
      deviceId: device.deviceId,
      keyReferenceId: initialKey.keyReferenceId,
      issuance: initialLeaf.issuance,
      admissionLink: initialLeaf.admissionLink,
      ...deploymentTimes(initialLeaf, 10),
      operatorId: "operator:qualification:bounded-v1-plan",
    }).plan;
    const initialActivation = installAndActivate({
      f,
      plan: initialPlan,
      leaf: initialLeaf,
      suffix: "bounded-v1",
    });
    const successorLeaf = issueLeaf({
      f,
      label: "bounded-v2",
      key: keyMaterial("bounded-v2"),
      mode: "renewal",
      predecessorCertificateFingerprint: initialPlan.certificateFingerprint,
      baseOffsetMinutes: 40,
    });
    const successorKey = registerKey(f, device.deviceId, successorLeaf, "bounded-v2").keyReference;
    expect(() => planAsoiafAnswerCredentialDeployment({
      root: f.root,
      mode: "successor",
      serviceId: "service:qualification:different",
      deviceId: device.deviceId,
      keyReferenceId: successorKey.keyReferenceId,
      issuance: successorLeaf.issuance,
      admissionLink: successorLeaf.admissionLink,
      predecessorPlanId: initialPlan.planId,
      predecessorActivationId: initialActivation.activationId,
      createdAt: new Date(Date.parse(initialPlan.plannedActivateAt) + 2 * 60_000).toISOString(),
      plannedInstallAt: new Date(Date.parse(initialPlan.plannedActivateAt) + 3 * 60_000).toISOString(),
      plannedActivateAt: new Date(Date.parse(initialPlan.plannedActivateAt) + 5 * 60_000).toISOString(),
      rollbackUntil: new Date(Date.parse(initialPlan.plannedActivateAt) + 15 * 60_000).toISOString(),
      retirePredecessorAfter: new Date(Date.parse(initialPlan.plannedActivateAt) + 30 * 60_000).toISOString(),
      operatorId: "operator:qualification:bounded-v2-wrong-service",
    })).toThrow(/differs from predecessor service custody/);

    const successorPlan = planAsoiafAnswerCredentialDeployment({
      root: f.root,
      mode: "successor",
      serviceId: initialPlan.serviceId,
      deviceId: device.deviceId,
      keyReferenceId: successorKey.keyReferenceId,
      issuance: successorLeaf.issuance,
      admissionLink: successorLeaf.admissionLink,
      predecessorPlanId: initialPlan.planId,
      predecessorActivationId: initialActivation.activationId,
      createdAt: new Date(Date.parse(initialPlan.plannedActivateAt) + 2 * 60_000).toISOString(),
      plannedInstallAt: new Date(Date.parse(initialPlan.plannedActivateAt) + 3 * 60_000).toISOString(),
      plannedActivateAt: new Date(Date.parse(initialPlan.plannedActivateAt) + 5 * 60_000).toISOString(),
      rollbackUntil: new Date(Date.parse(initialPlan.plannedActivateAt) + 15 * 60_000).toISOString(),
      retirePredecessorAfter: new Date(Date.parse(initialPlan.plannedActivateAt) + 30 * 60_000).toISOString(),
      operatorId: "operator:qualification:bounded-v2-plan",
    }).plan;
    const successorActivation = installAndActivate({
      f,
      plan: successorPlan,
      leaf: successorLeaf,
      suffix: "bounded-v2",
    });
    expect(() => buildAsoiafAnswerCredentialRollbackStatement({
      root: f.root,
      planId: successorPlan.planId,
      activationId: successorActivation.activationId,
      predecessorActivationId: initialActivation.activationId,
      providerReceiptDigest: sha256("late-rollback-provider-receipt"),
      rolledBackAt: new Date(Date.parse(successorPlan.rollbackUntil) + 1).toISOString(),
      reason:
        "This rollback is deliberately late and must be refused rather than silently restoring the predecessor credential.",
    })).toThrow(/outside the bounded rollback window/);
  });

  it("detects receipt tampering and forbidden secret-bearing files", () => {
    const f = fixture();
    const leaf = issueLeaf({
      f,
      label: "tamper",
      key: keyMaterial("tamper"),
      mode: "initial",
      baseOffsetMinutes: 30,
    });
    const device = registerDevice(f).device;
    const key = registerKey(f, device.deviceId, leaf, "tamper").keyReference;
    const plan = planAsoiafAnswerCredentialDeployment({
      root: f.root,
      mode: "initial",
      serviceId: "service:qualification:tamper",
      deviceId: device.deviceId,
      keyReferenceId: key.keyReferenceId,
      issuance: leaf.issuance,
      admissionLink: leaf.admissionLink,
      ...deploymentTimes(leaf, 10),
      operatorId: "operator:qualification:tamper-plan",
    }).plan;
    installAndActivate({ f, plan, leaf, suffix: "tamper" });

    const paths = asoiafAnswerCredentialDeploymentPaths(f.root);
    const planFile = path.join(
      paths.plans,
      `${plan.planFingerprint.slice("sha256:".length)}.json`,
    );
    fs.writeFileSync(
      planFile,
      `${JSON.stringify({ ...plan, serviceId: "service:tampered" }, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(paths.deploymentRoot, "provider-secret.pem"),
      "-----BEGIN PRIVATE KEY-----\nforbidden\n-----END PRIVATE KEY-----\n",
      "utf8",
    );
    expect(
      verifyAsoiafAnswerCredentialDeploymentEstate(f.root).map((entry) => entry.code),
    ).toEqual(expect.arrayContaining([
      "deployment-plan-fingerprint",
      "deployment-installation-invalid",
      "deployment-activation-invalid",
      "deployment-secret-path",
      "deployment-secret-content",
    ]));
  });
});
