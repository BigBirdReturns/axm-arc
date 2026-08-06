import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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
} from "../../tools/lib/asoiaf-answer-desk-transport-enrollment.js";
import {
  collectorContentId,
  sha256,
} from "../../tools/lib/asoiaf-external-estate.js";

const OUTPUT_DIRECTORY = process.argv[2];
const ESTATE_ROOT = process.argv[3];
if (!OUTPUT_DIRECTORY || !ESTATE_ROOT) {
  throw new Error("output directory and estate root arguments are required");
}

function runOpenSsl(args: string[]): void {
  execFileSync("openssl", args, { stdio: ["ignore", "ignore", "pipe"] });
}

function writeJson(directory: string, name: string, value: unknown): string {
  const target = path.join(directory, name);
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return target;
}

const outputDirectory = path.resolve(OUTPUT_DIRECTORY);
const estateRoot = path.resolve(ESTATE_ROOT);
const secrets = path.join(outputDirectory, "ephemeral-secrets");
const projectionRoot = path.join(outputDirectory, ".projection-estate");
fs.mkdirSync(secrets, { recursive: true });

const caCertificate = path.join(secrets, "issuer-ca.crt");
const caKey = path.join(secrets, "issuer-ca.key");
runOpenSsl([
  "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "3",
  "-subj", "/CN=ASOIAF transport enrollment qualification CA",
  "-addext", "basicConstraints=critical,CA:TRUE",
  "-addext", "keyUsage=critical,keyCertSign,cRLSign",
  "-keyout", caKey,
  "-out", caCertificate,
]);

const requester = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const requesterPrivateKey = path.join(secrets, "requester-private.key");
const requesterPublicKey = path.join(secrets, "requester-public.pem");
fs.writeFileSync(
  requesterPrivateKey,
  requester.privateKey.export({ format: "pem", type: "pkcs8" }),
);
fs.writeFileSync(
  requesterPublicKey,
  requester.publicKey.export({ format: "pem", type: "spki" }),
);

const approverDefinitions = [
  ["approver:qualification:issuer", "issuer-operator"],
  ["approver:qualification:owner", "actor-owner"],
  ["approver:qualification:security", "security-officer"],
] as const;
const approvers = approverDefinitions.map(([approverId, role]) => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const slug = approverId.split(":").at(-1)!;
  const privateKeyPath = path.join(secrets, `${slug}-private.key`);
  const publicKeyPath = path.join(secrets, `${slug}-public.pem`);
  fs.writeFileSync(
    privateKeyPath,
    pair.privateKey.export({ format: "pem", type: "pkcs8" }),
  );
  fs.writeFileSync(
    publicKeyPath,
    pair.publicKey.export({ format: "pem", type: "spki" }),
  );
  return {
    approverId,
    role,
    privateKey: pair.privateKey,
    privateKeyPath,
    publicKey: pair.publicKey,
    publicKeyPath,
  };
});

const ca = new crypto.X509Certificate(fs.readFileSync(caCertificate));
const createdAt = new Date(ca.validFromDate.getTime() + 1_000).toISOString();
const base = Date.parse(createdAt) + 60_000;
const times = {
  createdAt: new Date(base).toISOString(),
  expiresAt: new Date(base + 2 * 60 * 60 * 1000).toISOString(),
  requestedValidFrom: ca.validFromDate.toISOString(),
  requestedValidUntil: new Date(ca.validFromDate.getTime() + 48 * 60 * 60 * 1000).toISOString(),
  activateAt: new Date(base + 5 * 60 * 1000).toISOString(),
  renewAfter: new Date(base + 12 * 60 * 60 * 1000).toISOString(),
  retireAfter: new Date(base + 20 * 60 * 60 * 1000).toISOString(),
};

const policyInput = {
  root: estateRoot,
  issuerId: "issuer:qualification:answer-transport-enrollment",
  issuerCertificatePath: caCertificate,
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
  approvers: approvers.map((entry) => ({
    approverId: entry.approverId,
    role: entry.role,
    publicKeyPath: entry.publicKeyPath,
  })),
  createdAt,
  operatorId: "operator:qualification:enrollment-policy",
} as const;

const policy = retainAsoiafAnswerTransportIssuerPolicy({
  root: projectionRoot,
  issuerId: policyInput.issuerId,
  issuerCertificate: fs.readFileSync(caCertificate),
  allowedUsages: [...policyInput.allowedUsages],
  allowedActorRoles: [...policyInput.allowedActorRoles],
  allowedPrincipalPrefixes: [...policyInput.allowedPrincipalPrefixes],
  allowedKeyCustodyClasses: [...policyInput.allowedKeyCustodyClasses],
  allowExportablePrivateKeys: policyInput.allowExportablePrivateKeys,
  maxLeafLifetimeMilliseconds: policyInput.maxLeafLifetimeMilliseconds,
  maxRequestLifetimeMilliseconds: policyInput.maxRequestLifetimeMilliseconds,
  maxOrderLifetimeMilliseconds: policyInput.maxOrderLifetimeMilliseconds,
  minimumRenewalOverlapMilliseconds: policyInput.minimumRenewalOverlapMilliseconds,
  approvalThreshold: policyInput.approvalThreshold,
  emergencyApprovalThreshold: policyInput.emergencyApprovalThreshold,
  requiredApprovalRoles: [...policyInput.requiredApprovalRoles],
  emergencyRequiredApprovalRoles: [...policyInput.emergencyRequiredApprovalRoles],
  approvers: approvers.map((entry) => ({
    approverId: entry.approverId,
    role: entry.role,
    publicKey: entry.publicKey,
  })),
  createdAt: policyInput.createdAt,
  operatorId: policyInput.operatorId,
}).policy;

const proofInput = {
  root: estateRoot,
  policyId: policy.policyId,
  principalId: "actor:qualification:exact-locator-reviewer",
  usage: "client-auth",
  actorRole: "exact-locator-reviewer",
  mode: "initial",
  publicKeyPath: requesterPublicKey,
  requestedSubject: "CN=transport-enrollment-reviewer",
  requestedSubjectAltNames: [] as string[],
  ...times,
  predecessorCertificateFingerprint: null,
  custody: {
    custodyClass: "hardware-backed",
    providerId: "provider:qualification:software-hsm",
    keyReferenceDigest: sha256("qualification-enrollment-key-handle"),
    attestationDigest: sha256("qualification-enrollment-key-attestation"),
    attestationUri: "attestations/qualification-enrollment-key.json",
    privateKeyExportable: false,
  },
  nonce: "qualification-enrollment-proof-nonce-00000001",
  requesterId: "requester:qualification:exact-locator-reviewer",
} as const;

const proofStatement = buildAsoiafAnswerTransportProofStatement({
  policy,
  principalId: proofInput.principalId,
  usage: proofInput.usage,
  actorRole: proofInput.actorRole,
  mode: proofInput.mode,
  publicKey: requester.publicKey,
  requestedSubject: proofInput.requestedSubject,
  requestedSubjectAltNames: proofInput.requestedSubjectAltNames,
  requestedValidFrom: proofInput.requestedValidFrom,
  requestedValidUntil: proofInput.requestedValidUntil,
  activateAt: proofInput.activateAt,
  renewAfter: proofInput.renewAfter,
  retireAfter: proofInput.retireAfter,
  predecessorCertificateFingerprint: proofInput.predecessorCertificateFingerprint,
  custody: proofInput.custody,
  nonce: proofInput.nonce,
  createdAt: proofInput.createdAt,
  expiresAt: proofInput.expiresAt,
  requesterId: proofInput.requesterId,
});
const proofSignature = crypto.sign(
  "sha256",
  serializeAsoiafAnswerTransportProofStatement(proofStatement),
  requester.privateKey,
);
const proofSignaturePath = path.join(secrets, "proof-signature.bin");
fs.writeFileSync(proofSignaturePath, proofSignature);
const requestInput = {
  ...proofInput,
  proofAlgorithm: "rsa-sha256",
  proofSignaturePath,
};
const request = submitAsoiafAnswerTransportEnrollmentRequest({
  root: projectionRoot,
  policyId: policy.policyId,
  principalId: proofInput.principalId,
  usage: proofInput.usage,
  actorRole: proofInput.actorRole,
  mode: proofInput.mode,
  publicKey: requester.publicKey,
  proofAlgorithm: "rsa-sha256",
  proofSignature,
  requestedSubject: proofInput.requestedSubject,
  requestedSubjectAltNames: proofInput.requestedSubjectAltNames,
  requestedValidFrom: proofInput.requestedValidFrom,
  requestedValidUntil: proofInput.requestedValidUntil,
  activateAt: proofInput.activateAt,
  renewAfter: proofInput.renewAfter,
  retireAfter: proofInput.retireAfter,
  predecessorCertificateFingerprint: null,
  custody: proofInput.custody,
  nonce: proofInput.nonce,
  createdAt: proofInput.createdAt,
  expiresAt: proofInput.expiresAt,
  requesterId: proofInput.requesterId,
}).request;

const approvalInputs: Array<{
  statementName: string;
  inputName: string;
  statementInput: unknown;
  approvalInput: unknown;
  approvalId: string;
}> = [];
for (const [index, approver] of approvers.slice(0, 2).entries()) {
  const reason =
    `The ${approver.role} verified proof of possession, actor scope, key custody, requested profile, and bounded certificate schedule.`;
  const decidedAt = new Date(base + (index + 1) * 60_000).toISOString();
  const statementInput = {
    root: estateRoot,
    requestId: request.requestId,
    approverId: approver.approverId,
    decision: "approve",
    decidedAt,
    reason,
  } as const;
  const statement = buildAsoiafAnswerTransportApprovalStatement({
    policy,
    request,
    approverId: approver.approverId,
    decision: "approve",
    decidedAt,
    reason,
  });
  const signature = crypto.sign(
    null,
    serializeAsoiafAnswerTransportApprovalStatement(statement),
    approver.privateKey,
  );
  const signaturePath = path.join(secrets, `${approver.role}-approval-signature.bin`);
  fs.writeFileSync(signaturePath, signature);
  const approvalInput = {
    ...statementInput,
    signatureAlgorithm: "ed25519",
    signaturePath,
  } as const;
  const approval = retainAsoiafAnswerTransportEnrollmentApproval({
    root: projectionRoot,
    requestId: request.requestId,
    approverId: approver.approverId,
    decision: "approve",
    decidedAt,
    reason,
    signatureAlgorithm: "ed25519",
    signature,
  }).approval;
  approvalInputs.push({
    statementName: `approval-statement-${index + 1}-input.json`,
    inputName: `approval-${index + 1}-input.json`,
    statementInput,
    approvalInput,
    approvalId: approval.approvalId,
  });
}

const orderedAt = new Date(base + 10 * 60_000).toISOString();
const orderInput = {
  root: estateRoot,
  requestId: request.requestId,
  orderedAt,
  expiresAt: new Date(Date.parse(orderedAt) + 30 * 60_000).toISOString(),
  operatorId: "operator:qualification:enrollment-order",
};
const order = compileAsoiafAnswerTransportIssuanceOrder({
  ...orderInput,
  root: projectionRoot,
}).order;

const requesterKeyPem = requester.privateKey.export({
  format: "pem",
  type: "pkcs8",
});
const csr = path.join(secrets, "issued-leaf.csr");
const extension = path.join(secrets, "issued-leaf.ext");
const certificate = path.join(secrets, "issued-leaf.crt");
fs.writeFileSync(requesterPrivateKey, requesterKeyPem);
runOpenSsl([
  "req", "-new", "-sha256",
  "-key", requesterPrivateKey,
  "-subj", "/CN=transport-enrollment-reviewer",
  "-out", csr,
]);
fs.writeFileSync(
  extension,
  [
    "basicConstraints=critical,CA:FALSE",
    "keyUsage=critical,digitalSignature,keyEncipherment",
    "extendedKeyUsage=clientAuth",
  ].join("\n") + "\n",
  "utf8",
);
runOpenSsl([
  "x509", "-req", "-sha256", "-days", "1",
  "-in", csr,
  "-CA", caCertificate,
  "-CAkey", caKey,
  "-set_serial", "1001",
  "-extfile", extension,
  "-out", certificate,
]);

const issuedAt = new Date(Date.parse(order.orderedAt) + 60_000).toISOString();
const recordedAt = new Date(Date.parse(issuedAt) + 1_000).toISOString();
const recordInput = {
  root: estateRoot,
  orderId: order.orderId,
  certificatePath: certificate,
  issuerCertificatePath: caCertificate,
  issuedAt,
  recordedAt,
  operatorId: "operator:qualification:record-issued-leaf",
};
const issuance = recordAsoiafAnswerTransportIssuedCertificate({
  root: projectionRoot,
  orderId: order.orderId,
  certificate: fs.readFileSync(certificate),
  issuerCertificate: fs.readFileSync(caCertificate),
  issuedAt,
  recordedAt,
  operatorId: recordInput.operatorId,
}).issuance;

const admissionCore = {
  certificateFingerprint: issuance.certificate.certificateFingerprint,
  publicKeyFingerprint: issuance.certificate.publicKeyFingerprint,
  issuerCertificateFingerprint: issuance.certificate.issuerCertificateFingerprint,
  usage: issuance.admissionInstruction.usage,
  principalId: issuance.admissionInstruction.principalId,
  actorRole: issuance.admissionInstruction.actorRole,
  predecessorCertificateFingerprint:
    issuance.admissionInstruction.predecessorCertificateFingerprint,
  admittedAt: issuance.admissionInstruction.admittedAt,
};
const admissionFingerprint = sha256(admissionCore);
const admission = {
  admissionId: collectorContentId("asoiaf-answer-transport-runtime-admission-fixture", {
    certificateFingerprint: admissionCore.certificateFingerprint,
    admissionFingerprint,
  }),
  admissionFingerprint,
  ...admissionCore,
};
const linkInput = {
  root: estateRoot,
  issuanceId: issuance.issuanceId,
  admission,
  linkedAt: new Date(Date.parse(recordedAt) + 1_000).toISOString(),
  operatorId: "operator:qualification:link-runtime-admission",
};
const link = linkAsoiafAnswerTransportRuntimeAdmission({
  ...linkInput,
  root: projectionRoot,
}).link;

fs.mkdirSync(outputDirectory, { recursive: true });
writeJson(outputDirectory, "policy-input.json", policyInput);
writeJson(outputDirectory, "proof-input.json", proofInput);
writeJson(outputDirectory, "request-input.json", requestInput);
for (const entry of approvalInputs) {
  writeJson(outputDirectory, entry.statementName, entry.statementInput);
  writeJson(outputDirectory, entry.inputName, entry.approvalInput);
}
writeJson(outputDirectory, "order-input.json", orderInput);
writeJson(outputDirectory, "record-input.json", recordInput);
writeJson(outputDirectory, "link-input.json", linkInput);
writeJson(outputDirectory, "expected.json", {
  estateRoot,
  policyId: policy.policyId,
  policyFingerprint: policy.policyFingerprint,
  requestId: request.requestId,
  requestFingerprint: request.requestFingerprint,
  proofSigningBytesSha256:
    `sha256:${crypto.createHash("sha256")
      .update(serializeAsoiafAnswerTransportProofStatement(proofStatement))
      .digest("hex")}`,
  approvalIds: approvalInputs.map((entry) => entry.approvalId),
  orderId: order.orderId,
  orderFingerprint: order.orderFingerprint,
  issuanceId: issuance.issuanceId,
  issuanceFingerprint: issuance.issuanceFingerprint,
  certificateFingerprint: issuance.certificate.certificateFingerprint,
  admissionLinkId: link.linkId,
  admissionLinkFingerprint: link.linkFingerprint,
  counts: {
    policies: 1,
    requests: 1,
    approvals: 2,
    orders: 1,
    issuances: 1,
    admissionLinks: 1,
  },
});
fs.rmSync(projectionRoot, { recursive: true, force: true });

process.stdout.write(`${JSON.stringify({
  ok: true,
  outputDirectory,
  estateRoot,
  policyId: policy.policyId,
  requestId: request.requestId,
  orderId: order.orderId,
  issuanceId: issuance.issuanceId,
  admissionLinkId: link.linkId,
  ephemeralSecretsDirectory: secrets,
}, null, 2)}\n`);
