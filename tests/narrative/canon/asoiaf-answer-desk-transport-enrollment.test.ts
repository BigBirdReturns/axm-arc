import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  asoiafAnswerTransportEnrollmentPaths,
  buildAsoiafAnswerTransportApprovalStatement,
  buildAsoiafAnswerTransportProofStatement,
  compileAsoiafAnswerTransportIssuanceOrder,
  linkAsoiafAnswerTransportRuntimeAdmission,
  readAsoiafAnswerTransportEnrollmentStatus,
  recordAsoiafAnswerTransportIssuedCertificate,
  retainAsoiafAnswerTransportEnrollmentApproval,
  retainAsoiafAnswerTransportIssuerPolicy,
  serializeAsoiafAnswerTransportApprovalStatement,
  serializeAsoiafAnswerTransportProofStatement,
  submitAsoiafAnswerTransportEnrollmentRequest,
  verifyAsoiafAnswerTransportEnrollmentEstate,
  type AsoiafAnswerTransportEnrollmentRequest,
  type AsoiafAnswerTransportEnrollmentRequestInput,
  type AsoiafAnswerTransportIssuerPolicy,
  type AsoiafAnswerTransportIssuerPolicyInput,
} from "../../../tools/lib/asoiaf-answer-desk-transport-enrollment.js";
import {
  collectorContentId,
  sha256,
} from "../../../tools/lib/asoiaf-external-estate.js";

interface Fixture {
  root: string;
  certDirectory: string;
  caCertificate: string;
  caKey: string;
  alternateCaCertificate: string;
  alternateCaKey: string;
  requesterPrivateKey: crypto.KeyObject;
  requesterPublicKey: crypto.KeyObject;
  approvers: Record<string, {
    role: "issuer-operator" | "actor-owner" | "security-officer";
    privateKey: crypto.KeyObject;
    publicKey: crypto.KeyObject;
  }>;
}

const roots: string[] = [];

function runOpenSsl(args: string[]): void {
  execFileSync("openssl", args, { stdio: ["ignore", "ignore", "pipe"] });
}

function createCa(directory: string, prefix: string, commonName: string) {
  const certificate = path.join(directory, `${prefix}.crt`);
  const key = path.join(directory, `${prefix}.key`);
  runOpenSsl([
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "3",
    "-subj", `/CN=${commonName}`,
    "-addext", "basicConstraints=critical,CA:TRUE",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    "-keyout", key,
    "-out", certificate,
  ]);
  return { certificate, key };
}

function fixture(): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-answer-enrollment-"));
  roots.push(root);
  const certDirectory = path.join(root, "ephemeral-certificates");
  fs.mkdirSync(certDirectory, { recursive: true });
  const ca = createCa(certDirectory, "issuer-ca", "ASOIAF enrollment qualification CA");
  const alternate = createCa(certDirectory, "alternate-ca", "ASOIAF alternate enrollment CA");
  const requester = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const approvers: Fixture["approvers"] = {};
  for (const [id, role] of [
    ["approver:issuer", "issuer-operator"],
    ["approver:owner", "actor-owner"],
    ["approver:security", "security-officer"],
  ] as const) {
    const pair = crypto.generateKeyPairSync("ed25519");
    approvers[id] = { role, ...pair };
  }
  return {
    root,
    certDirectory,
    caCertificate: ca.certificate,
    caKey: ca.key,
    alternateCaCertificate: alternate.certificate,
    alternateCaKey: alternate.key,
    requesterPrivateKey: requester.privateKey,
    requesterPublicKey: requester.publicKey,
    approvers,
  };
}

function policyInput(f: Fixture): AsoiafAnswerTransportIssuerPolicyInput {
  const ca = new crypto.X509Certificate(fs.readFileSync(f.caCertificate));
  return {
    root: f.root,
    issuerId: "issuer:qualification:answer-transport",
    issuerCertificate: fs.readFileSync(f.caCertificate),
    allowedUsages: ["client-auth", "server-auth"],
    allowedActorRoles: ["exact-locator-reviewer", "answer-assembler"],
    allowedPrincipalPrefixes: ["actor:qualification:", "server:qualification:"],
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
    approvers: Object.entries(f.approvers).map(([approverId, entry]) => ({
      approverId,
      role: entry.role,
      publicKey: entry.publicKey,
    })),
    createdAt: new Date(ca.validFromDate.getTime() + 1_000).toISOString(),
    operatorId: "operator:qualification:issuer-policy",
  };
}

function policy(f: Fixture): AsoiafAnswerTransportIssuerPolicy {
  return retainAsoiafAnswerTransportIssuerPolicy(policyInput(f)).policy;
}

function requestTimes(policyValue: AsoiafAnswerTransportIssuerPolicy) {
  const base = Date.parse(policyValue.createdAt) + 60_000;
  return {
    createdAt: new Date(base).toISOString(),
    expiresAt: new Date(base + 2 * 60 * 60 * 1000).toISOString(),
    requestedValidFrom: new Date(base - 5 * 60 * 1000).toISOString(),
    requestedValidUntil: new Date(base + 26 * 60 * 60 * 1000).toISOString(),
    activateAt: new Date(base + 5 * 60 * 1000).toISOString(),
    renewAfter: new Date(base + 12 * 60 * 60 * 1000).toISOString(),
    retireAfter: new Date(base + 20 * 60 * 60 * 1000).toISOString(),
  };
}

function requestInput(
  f: Fixture,
  policyValue: AsoiafAnswerTransportIssuerPolicy,
  overrides: Partial<AsoiafAnswerTransportEnrollmentRequestInput> = {},
): AsoiafAnswerTransportEnrollmentRequestInput {
  const times = requestTimes(policyValue);
  const common = {
    policy: policyValue,
    principalId: "actor:qualification:exact-locator-reviewer",
    usage: "client-auth" as const,
    actorRole: "exact-locator-reviewer" as const,
    mode: "initial" as const,
    publicKey: f.requesterPublicKey,
    requestedSubject: "CN=transport-enrollment-reviewer",
    requestedSubjectAltNames: [] as string[],
    ...times,
    predecessorCertificateFingerprint: null,
    custody: {
      custodyClass: "hardware-backed" as const,
      providerId: "provider:qualification:software-hsm",
      keyReferenceDigest: sha256("qualification-key-handle"),
      attestationDigest: sha256("qualification-key-attestation"),
      attestationUri: "attestations/qualification-key.json",
      privateKeyExportable: false,
    },
    nonce: "qualification-enrollment-nonce-00000001",
    requesterId: "requester:qualification:exact-locator-reviewer",
  };
  const statement = buildAsoiafAnswerTransportProofStatement(common);
  const proofSignature = crypto.sign(
    "sha256",
    serializeAsoiafAnswerTransportProofStatement(statement),
    f.requesterPrivateKey,
  );
  return {
    root: f.root,
    policyId: policyValue.policyId,
    principalId: common.principalId,
    usage: common.usage,
    actorRole: common.actorRole,
    mode: common.mode,
    publicKey: common.publicKey,
    proofAlgorithm: "rsa-sha256",
    proofSignature,
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
    ...overrides,
  };
}

function submitRequest(
  f: Fixture,
  policyValue: AsoiafAnswerTransportIssuerPolicy,
  overrides: Partial<AsoiafAnswerTransportEnrollmentRequestInput> = {},
): AsoiafAnswerTransportEnrollmentRequest {
  return submitAsoiafAnswerTransportEnrollmentRequest(
    requestInput(f, policyValue, overrides),
  ).request;
}

function approve(
  f: Fixture,
  policyValue: AsoiafAnswerTransportIssuerPolicy,
  request: AsoiafAnswerTransportEnrollmentRequest,
  approverId: keyof Fixture["approvers"],
  decision: "approve" | "reject" = "approve",
  minute = 1,
) {
  const approver = f.approvers[approverId]!;
  const reason = decision === "approve"
    ? `The ${approver.role} verified the key proof, actor scope, custody attestation, requested profile, and bounded issuance schedule.`
    : `The ${approver.role} rejects the enrollment because the submitted custody cannot satisfy the governing certificate policy.`;
  const statement = buildAsoiafAnswerTransportApprovalStatement({
    policy: policyValue,
    request,
    approverId,
    decision,
    decidedAt: new Date(
      Date.parse(request.proofStatement.createdAt) + minute * 60_000,
    ).toISOString(),
    reason,
  });
  const signature = crypto.sign(
    null,
    serializeAsoiafAnswerTransportApprovalStatement(statement),
    approver.privateKey,
  );
  return retainAsoiafAnswerTransportEnrollmentApproval({
    root: f.root,
    requestId: request.requestId,
    approverId,
    decision,
    decidedAt: statement.decidedAt,
    reason,
    signatureAlgorithm: "ed25519",
    signature,
  });
}

function compileOrder(
  f: Fixture,
  request: AsoiafAnswerTransportEnrollmentRequest,
) {
  const orderedAt = new Date(
    Date.parse(request.proofStatement.createdAt) + 10 * 60_000,
  ).toISOString();
  return compileAsoiafAnswerTransportIssuanceOrder({
    root: f.root,
    requestId: request.requestId,
    orderedAt,
    expiresAt: new Date(Date.parse(orderedAt) + 30 * 60_000).toISOString(),
    operatorId: "operator:qualification:issuance-order",
  });
}

function issueLeaf(
  f: Fixture,
  prefix: string,
  privateKey: crypto.KeyObject = f.requesterPrivateKey,
  caCertificate = f.caCertificate,
  caKey = f.caKey,
) {
  const keyPath = path.join(f.certDirectory, `${prefix}.key`);
  const csrPath = path.join(f.certDirectory, `${prefix}.csr`);
  const extPath = path.join(f.certDirectory, `${prefix}.ext`);
  const certificatePath = path.join(f.certDirectory, `${prefix}.crt`);
  fs.writeFileSync(
    keyPath,
    privateKey.export({ format: "pem", type: "pkcs8" }),
  );
  runOpenSsl([
    "req", "-new", "-sha256",
    "-key", keyPath,
    "-subj", "/CN=transport-enrollment-reviewer",
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
    "-CA", caCertificate,
    "-CAkey", caKey,
    "-set_serial", String(1000 + Math.floor(Math.random() * 100000)),
    "-extfile", extPath,
    "-out", certificatePath,
  ]);
  return certificatePath;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF answer transport enrollment and issuer governance", () => {
  it("retains a deterministic issuer policy with signed approver keys and no issuer or private-key bytes", () => {
    const f = fixture();
    const first = policy(f);
    const second = policy(f);

    expect(second).toEqual(first);
    expect(first).toEqual(expect.objectContaining({
      approvalThreshold: 2,
      emergencyApprovalThreshold: 3,
      requiredApprovalRoles: ["actor-owner", "issuer-operator"],
      issuerCertificateRetained: false,
      privateKeyRetained: false,
      privateKeyPathRetained: false,
      issuanceAuthority: "policy-only",
      authority: "none",
      graphEffect: "none",
      canonEffect: "none",
      answerEffect: "none",
    }));
    expect(first.approvers).toHaveLength(3);
    expect(first.approvers.every((entry) => entry.publicKeySpkiBase64.length > 40)).toBe(true);
    expect(readAsoiafAnswerTransportEnrollmentStatus(f.root).policies).toEqual([first]);
    expect(verifyAsoiafAnswerTransportEnrollmentEstate(f.root)).toEqual([]);
  });

  it("refuses actor-role values and leaf lifetimes that the runtime transport plane cannot admit", () => {
    const f = fixture();
    expect(() => retainAsoiafAnswerTransportIssuerPolicy({
      ...policyInput(f),
      allowedActorRoles: ["scheduler-impersonator" as never],
    })).toThrow(/answer exchange actor role scheduler-impersonator is invalid/);
    expect(() => retainAsoiafAnswerTransportIssuerPolicy({
      ...policyInput(f),
      maxLeafLifetimeMilliseconds: 399 * 24 * 60 * 60 * 1000,
    })).toThrow(/maximum leaf lifetime must be an integer/);

    const issuerPolicy = policy(f);
    const times = requestTimes(issuerPolicy);
    expect(() => buildAsoiafAnswerTransportProofStatement({
      policy: issuerPolicy,
      principalId: "actor:qualification:invalid-role",
      usage: "client-auth",
      actorRole: "scheduler-impersonator" as never,
      mode: "initial",
      publicKey: f.requesterPublicKey,
      requestedSubject: "CN=transport-enrollment-invalid-role",
      requestedSubjectAltNames: [],
      ...times,
      predecessorCertificateFingerprint: null,
      custody: {
        custodyClass: "hardware-backed",
        providerId: "provider:qualification:software-hsm",
        keyReferenceDigest: sha256("qualification-invalid-role-key-handle"),
        attestationDigest: sha256("qualification-invalid-role-key-attestation"),
        attestationUri: "attestations/qualification-invalid-role-key.json",
        privateKeyExportable: false,
      },
      nonce: "qualification-invalid-role-nonce-000001",
      requesterId: "requester:qualification:invalid-role",
    })).toThrow(/answer exchange actor role scheduler-impersonator is invalid/);
  });

  it("verifies proof of possession and exact request replay while refusing changed proof bytes", () => {
    const f = fixture();
    const issuerPolicy = policy(f);
    const input = requestInput(f, issuerPolicy);
    const first = submitAsoiafAnswerTransportEnrollmentRequest(input);
    const replay = submitAsoiafAnswerTransportEnrollmentRequest(input);

    expect(replay.request).toEqual(first.request);
    expect(replay.replayed).toBe(true);
    expect(first.request).toEqual(expect.objectContaining({
      proofVerified: true,
      publicKeyRetained: true,
      privateKeyRetained: false,
      privateKeyPathRetained: false,
      requestAuthority: "none",
    }));
    expect(first.request.proofStatement.custody).toEqual(expect.objectContaining({
      custodyClass: "hardware-backed",
      privateKeyExportable: false,
      privateKeyRetained: false,
      rawKeyReferenceRetained: false,
    }));

    const changed = Buffer.from(input.proofSignature as Buffer);
    changed[0] = changed[0]! ^ 0xff;
    expect(() => submitAsoiafAnswerTransportEnrollmentRequest({
      ...input,
      proofSignature: changed,
    })).toThrow(/proof-of-possession signature is invalid/);
    expect(verifyAsoiafAnswerTransportEnrollmentEstate(f.root)).toEqual([]);
  });

  it("requires the exact approval quorum and roles, and any retained rejection blocks issuance", () => {
    const insufficientFixture = fixture();
    const insufficientPolicy = policy(insufficientFixture);
    const insufficientRequest = submitRequest(insufficientFixture, insufficientPolicy);
    approve(
      insufficientFixture,
      insufficientPolicy,
      insufficientRequest,
      "approver:issuer",
    );
    expect(() => compileOrder(insufficientFixture, insufficientRequest))
      .toThrow(/requires 2 distinct approvals/);

    const rejectedFixture = fixture();
    const rejectedPolicy = policy(rejectedFixture);
    const rejectedRequest = submitRequest(rejectedFixture, rejectedPolicy);
    approve(rejectedFixture, rejectedPolicy, rejectedRequest, "approver:issuer");
    approve(rejectedFixture, rejectedPolicy, rejectedRequest, "approver:owner", "reject", 2);
    expect(() => compileOrder(rejectedFixture, rejectedRequest))
      .toThrow(/retained rejection/);

    const acceptedFixture = fixture();
    const acceptedPolicy = policy(acceptedFixture);
    const acceptedRequest = submitRequest(acceptedFixture, acceptedPolicy);
    approve(acceptedFixture, acceptedPolicy, acceptedRequest, "approver:issuer");
    approve(acceptedFixture, acceptedPolicy, acceptedRequest, "approver:owner", "approve", 2);
    const order = compileOrder(acceptedFixture, acceptedRequest);
    expect(order.order).toEqual(expect.objectContaining({
      approvalRoles: ["actor-owner", "issuer-operator"],
      issuanceAuthority: "authorize-one-leaf",
      certificateRetained: false,
      privateKeyRetained: false,
    }));
    expect(verifyAsoiafAnswerTransportEnrollmentEstate(acceptedFixture.root)).toEqual([]);
  });

  it("requires the higher emergency-recovery quorum including a security officer", () => {
    const f = fixture();
    const issuerPolicy = policy(f);
    const predecessor = sha256("emergency-predecessor-certificate");
    const base = requestInput(f, issuerPolicy);
    const statement = buildAsoiafAnswerTransportProofStatement({
      policy: issuerPolicy,
      principalId: base.principalId,
      usage: base.usage,
      actorRole: base.actorRole,
      mode: "emergency-recovery",
      publicKey: f.requesterPublicKey,
      requestedSubject: base.requestedSubject,
      requestedSubjectAltNames: base.requestedSubjectAltNames,
      requestedValidFrom: base.requestedValidFrom,
      requestedValidUntil: base.requestedValidUntil,
      activateAt: base.activateAt,
      renewAfter: base.renewAfter,
      retireAfter: base.retireAfter,
      predecessorCertificateFingerprint: predecessor,
      custody: base.custody,
      nonce: "qualification-emergency-recovery-nonce-0001",
      createdAt: base.createdAt,
      expiresAt: base.expiresAt,
      requesterId: base.requesterId,
    });
    const proofSignature = crypto.sign(
      "sha256",
      serializeAsoiafAnswerTransportProofStatement(statement),
      f.requesterPrivateKey,
    );
    const request = submitAsoiafAnswerTransportEnrollmentRequest({
      ...base,
      mode: "emergency-recovery",
      predecessorCertificateFingerprint: predecessor,
      nonce: "qualification-emergency-recovery-nonce-0001",
      proofSignature,
    }).request;
    approve(f, issuerPolicy, request, "approver:issuer");
    approve(f, issuerPolicy, request, "approver:owner", "approve", 2);
    expect(() => compileOrder(f, request)).toThrow(/requires 3 distinct approvals/);
    approve(f, issuerPolicy, request, "approver:security", "approve", 3);
    expect(compileOrder(f, request).order.approvalRoles).toEqual([
      "actor-owner",
      "issuer-operator",
      "security-officer",
    ]);
  });

  it("records one externally issued certificate only when issuer, key, subject, usage, and schedule match the order", () => {
    const f = fixture();
    const issuerPolicy = policy(f);
    const request = submitRequest(f, issuerPolicy);
    approve(f, issuerPolicy, request, "approver:issuer");
    approve(f, issuerPolicy, request, "approver:owner", "approve", 2);
    const order = compileOrder(f, request).order;
    const certificatePath = issueLeaf(f, "reviewer-issued");
    const issuedAt = new Date(Date.parse(order.orderedAt) + 60_000).toISOString();
    const recordedAt = new Date(Date.parse(issuedAt) + 1_000).toISOString();
    const first = recordAsoiafAnswerTransportIssuedCertificate({
      root: f.root,
      orderId: order.orderId,
      certificate: fs.readFileSync(certificatePath),
      issuerCertificate: fs.readFileSync(f.caCertificate),
      issuedAt,
      recordedAt,
      operatorId: "operator:qualification:record-issued-leaf",
    });
    const replay = recordAsoiafAnswerTransportIssuedCertificate({
      root: f.root,
      orderId: order.orderId,
      certificate: fs.readFileSync(certificatePath),
      issuerCertificate: fs.readFileSync(f.caCertificate),
      issuedAt,
      recordedAt,
      operatorId: "operator:qualification:record-issued-leaf",
    });

    expect(replay.issuance).toEqual(first.issuance);
    expect(replay.replayed).toBe(true);
    expect(first.issuance).toEqual(expect.objectContaining({
      certificateRetained: false,
      privateKeyRetained: false,
      certificatePathRetained: false,
      privateKeyPathRetained: false,
      issuanceAuthority: "verified-issued-leaf",
      authority: "none",
    }));
    expect(first.issuance.admissionInstruction).toEqual(expect.objectContaining({
      principalId: request.proofStatement.principalId,
      actorRole: request.proofStatement.actorRole,
      certificateFingerprint: first.issuance.certificate.certificateFingerprint,
      issuerCertificateFingerprint: issuerPolicy.issuerCertificateFingerprint,
      publicKeyFingerprint: request.proofStatement.publicKeyFingerprint,
      keyCustodyClass: "hardware-backed",
      privateKeyExportable: false,
    }));
    expect(verifyAsoiafAnswerTransportEnrollmentEstate(f.root)).toEqual([]);
  });

  it("refuses a certificate issued by the wrong authority or for the wrong enrollment key", () => {
    const wrongIssuerFixture = fixture();
    const wrongIssuerPolicy = policy(wrongIssuerFixture);
    const wrongIssuerRequest = submitRequest(wrongIssuerFixture, wrongIssuerPolicy);
    approve(wrongIssuerFixture, wrongIssuerPolicy, wrongIssuerRequest, "approver:issuer");
    approve(wrongIssuerFixture, wrongIssuerPolicy, wrongIssuerRequest, "approver:owner", "approve", 2);
    const wrongIssuerOrder = compileOrder(wrongIssuerFixture, wrongIssuerRequest).order;
    const wrongIssuerLeaf = issueLeaf(
      wrongIssuerFixture,
      "wrong-issuer-leaf",
      wrongIssuerFixture.requesterPrivateKey,
      wrongIssuerFixture.alternateCaCertificate,
      wrongIssuerFixture.alternateCaKey,
    );
    expect(() => recordAsoiafAnswerTransportIssuedCertificate({
      root: wrongIssuerFixture.root,
      orderId: wrongIssuerOrder.orderId,
      certificate: fs.readFileSync(wrongIssuerLeaf),
      issuerCertificate: fs.readFileSync(wrongIssuerFixture.alternateCaCertificate),
      issuedAt: new Date(Date.parse(wrongIssuerOrder.orderedAt) + 1_000).toISOString(),
      recordedAt: new Date(Date.parse(wrongIssuerOrder.orderedAt) + 2_000).toISOString(),
      operatorId: "operator:qualification:wrong-issuer",
    })).toThrow(/authority differs from the issuance order/);

    const wrongKeyFixture = fixture();
    const wrongKeyPolicy = policy(wrongKeyFixture);
    const wrongKeyRequest = submitRequest(wrongKeyFixture, wrongKeyPolicy);
    approve(wrongKeyFixture, wrongKeyPolicy, wrongKeyRequest, "approver:issuer");
    approve(wrongKeyFixture, wrongKeyPolicy, wrongKeyRequest, "approver:owner", "approve", 2);
    const wrongKeyOrder = compileOrder(wrongKeyFixture, wrongKeyRequest).order;
    const otherKey = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    const wrongKeyLeaf = issueLeaf(wrongKeyFixture, "wrong-key-leaf", otherKey);
    expect(() => recordAsoiafAnswerTransportIssuedCertificate({
      root: wrongKeyFixture.root,
      orderId: wrongKeyOrder.orderId,
      certificate: fs.readFileSync(wrongKeyLeaf),
      issuerCertificate: fs.readFileSync(wrongKeyFixture.caCertificate),
      issuedAt: new Date(Date.parse(wrongKeyOrder.orderedAt) + 1_000).toISOString(),
      recordedAt: new Date(Date.parse(wrongKeyOrder.orderedAt) + 2_000).toISOString(),
      operatorId: "operator:qualification:wrong-key",
    })).toThrow(/public key differs from the enrollment request/);
  });

  it("links the verified issuance to one exact runtime admission reference and refuses mismatch", () => {
    const f = fixture();
    const issuerPolicy = policy(f);
    const request = submitRequest(f, issuerPolicy);
    approve(f, issuerPolicy, request, "approver:issuer");
    approve(f, issuerPolicy, request, "approver:owner", "approve", 2);
    const order = compileOrder(f, request).order;
    const certificatePath = issueLeaf(f, "linked-leaf");
    const issuedAt = new Date(Date.parse(order.orderedAt) + 1_000).toISOString();
    const issuance = recordAsoiafAnswerTransportIssuedCertificate({
      root: f.root,
      orderId: order.orderId,
      certificate: fs.readFileSync(certificatePath),
      issuerCertificate: fs.readFileSync(f.caCertificate),
      issuedAt,
      recordedAt: new Date(Date.parse(issuedAt) + 1_000).toISOString(),
      operatorId: "operator:qualification:linked-issuance",
    }).issuance;
    const admission = {
      admissionId: "asoiaf-answer-transport-certificate:runtime-admission",
      admissionFingerprint: sha256("runtime-admission-fingerprint"),
      certificateFingerprint: issuance.certificate.certificateFingerprint,
      publicKeyFingerprint: issuance.certificate.publicKeyFingerprint,
      issuerCertificateFingerprint: issuance.certificate.issuerCertificateFingerprint,
      usage: issuance.admissionInstruction.usage,
      principalId: issuance.admissionInstruction.principalId,
      actorRole: issuance.admissionInstruction.actorRole,
      predecessorCertificateFingerprint:
        issuance.admissionInstruction.predecessorCertificateFingerprint,
      admittedAt: issuance.admissionInstruction.admittedAt,
    } as const;
    const first = linkAsoiafAnswerTransportRuntimeAdmission({
      root: f.root,
      issuanceId: issuance.issuanceId,
      admission,
      linkedAt: new Date(Date.parse(issuance.recordedAt) + 1_000).toISOString(),
      operatorId: "operator:qualification:link-runtime-admission",
    });
    const replay = linkAsoiafAnswerTransportRuntimeAdmission({
      root: f.root,
      issuanceId: issuance.issuanceId,
      admission,
      linkedAt: new Date(Date.parse(issuance.recordedAt) + 1_000).toISOString(),
      operatorId: "operator:qualification:link-runtime-admission",
    });
    expect(replay.link).toEqual(first.link);
    expect(replay.replayed).toBe(true);
    expect(first.link.admissionAuthority).toBe("runtime-admission-reference-only");
    expect(() => linkAsoiafAnswerTransportRuntimeAdmission({
      root: f.root,
      issuanceId: issuance.issuanceId,
      admission: {
        ...admission,
        principalId: "actor:qualification:different",
      },
      linkedAt: new Date(Date.parse(issuance.recordedAt) + 2_000).toISOString(),
      operatorId: "operator:qualification:link-runtime-admission",
    })).toThrow(/differs from the verified issuance receipt/);
    expect(verifyAsoiafAnswerTransportEnrollmentEstate(f.root)).toEqual([]);
  });



  it("reconstructs approval quorum and one-order cardinality beyond self-consistent fingerprints", () => {
    const f = fixture();
    const issuerPolicy = policy(f);
    const request = submitRequest(f, issuerPolicy);
    approve(f, issuerPolicy, request, "approver:issuer");
    approve(f, issuerPolicy, request, "approver:owner", "approve", 2);
    const order = compileOrder(f, request).order;
    const paths = asoiafAnswerTransportEnrollmentPaths(f.root);
    const {
      orderId: _orderId,
      orderFingerprint: _orderFingerprint,
      ...orderCore
    } = order;
    const forgedCore = {
      ...orderCore,
      approvalIds: [order.approvalIds[0]!],
    };
    const forgedFingerprint = sha256(forgedCore);
    const forged = {
      ...forgedCore,
      orderId: collectorContentId("asoiaf-answer-transport-issuance-order", {
        requestId: order.requestId,
        issuerCertificateFingerprint: order.issuerCertificateFingerprint,
        orderFingerprint: forgedFingerprint,
      }),
      orderFingerprint: forgedFingerprint,
    };
    fs.writeFileSync(
      path.join(paths.orders, `${forgedFingerprint.slice(7)}.json`),
      `${JSON.stringify(forged, null, 2)}\n`,
      "utf8",
    );

    expect(
      verifyAsoiafAnswerTransportEnrollmentEstate(f.root).map(
        (entry) => entry.code,
      ),
    ).toEqual(expect.arrayContaining([
      "enrollment-order-request-duplicate",
      "enrollment-order-quorum",
    ]));
  });

  it("reconstructs issued-certificate metadata after an attacker recomputes receipt identity", () => {
    const f = fixture();
    const issuerPolicy = policy(f);
    const request = submitRequest(f, issuerPolicy);
    approve(f, issuerPolicy, request, "approver:issuer");
    approve(f, issuerPolicy, request, "approver:owner", "approve", 2);
    const order = compileOrder(f, request).order;
    const certificatePath = issueLeaf(f, "metadata-forgery-leaf");
    const issuedAt = new Date(Date.parse(order.orderedAt) + 60_000).toISOString();
    const recordedAt = new Date(Date.parse(issuedAt) + 1_000).toISOString();
    const issuance = recordAsoiafAnswerTransportIssuedCertificate({
      root: f.root,
      orderId: order.orderId,
      certificate: fs.readFileSync(certificatePath),
      issuerCertificate: fs.readFileSync(f.caCertificate),
      issuedAt,
      recordedAt,
      operatorId: "operator:qualification:metadata-forgery",
    }).issuance;
    const paths = asoiafAnswerTransportEnrollmentPaths(f.root);
    fs.rmSync(path.join(
      paths.issuances,
      `${issuance.issuanceFingerprint.slice(7)}.json`,
    ));
    const {
      issuanceId: _issuanceId,
      issuanceFingerprint: _issuanceFingerprint,
      ...issuanceCore
    } = issuance;
    const forgedCore = {
      ...issuanceCore,
      certificate: {
        ...issuance.certificate,
        subject: "CN=forged-unreviewed-principal",
      },
    };
    const forgedFingerprint = sha256(forgedCore);
    const forged = {
      ...forgedCore,
      issuanceId: collectorContentId("asoiaf-answer-transport-issuance", {
        orderId: order.orderId,
        certificateFingerprint: issuance.certificate.certificateFingerprint,
        issuanceFingerprint: forgedFingerprint,
      }),
      issuanceFingerprint: forgedFingerprint,
    };
    fs.writeFileSync(
      path.join(paths.issuances, `${forgedFingerprint.slice(7)}.json`),
      `${JSON.stringify(forged, null, 2)}\n`,
      "utf8",
    );

    expect(
      verifyAsoiafAnswerTransportEnrollmentEstate(f.root).map(
        (entry) => entry.code,
      ),
    ).toContain("enrollment-issuance-metadata");
  });
  it("detects changed retained bytes and private-key or CSR material in the enrollment estate", () => {
    const f = fixture();
    const issuerPolicy = policy(f);
    const request = submitRequest(f, issuerPolicy);
    const requestPath = path.join(
      asoiafAnswerTransportEnrollmentPaths(f.root).requests,
      `${request.requestFingerprint.slice("sha256:".length)}.json`,
    );
    const changed = JSON.parse(fs.readFileSync(requestPath, "utf8"));
    changed.proofStatement.principalId = "actor:qualification:tampered";
    fs.writeFileSync(requestPath, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    expect(
      verifyAsoiafAnswerTransportEnrollmentEstate(f.root).map((entry) => entry.code),
    ).toEqual(expect.arrayContaining([
      "enrollment-request-fingerprint",
      "enrollment-request-proof",
    ]));

    fs.writeFileSync(
      path.join(asoiafAnswerTransportEnrollmentPaths(f.root).enrollmentRoot, "forbidden.key"),
      "-----BEGIN PRIVATE KEY-----\nforbidden\n-----END PRIVATE KEY-----\n",
      "utf8",
    );
    expect(
      verifyAsoiafAnswerTransportEnrollmentEstate(f.root).map((entry) => entry.code),
    ).toContain("enrollment-secret-file");
  });
});
