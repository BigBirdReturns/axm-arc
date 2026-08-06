#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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
  type AsoiafAnswerTransportAdmissionLink,
  type AsoiafAnswerTransportApprovalDecision,
  type AsoiafAnswerTransportApprovalRole,
  type AsoiafAnswerTransportEnrollmentMode,
  type AsoiafAnswerTransportEnrollmentRequestInput,
  type AsoiafAnswerTransportIssuerPolicy,
  type AsoiafAnswerTransportKeyCustodyClass,
  type AsoiafAnswerTransportProofAlgorithm,
  type AsoiafAnswerTransportRuntimeAdmissionReference,
} from "./lib/asoiaf-answer-desk-transport-enrollment.js";
import type {
  AsoiafAnswerTransportCertificateUsage,
} from "./lib/asoiaf-answer-desk-transport-operations.js";
import type {
  AsoiafAnswerExchangeActorRole,
} from "./lib/asoiaf-answer-desk-exchange.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

interface PolicyFileInput {
  root: string;
  issuerId: string;
  issuerCertificatePath: string;
  allowedUsages: AsoiafAnswerTransportCertificateUsage[];
  allowedActorRoles: AsoiafAnswerExchangeActorRole[];
  allowedPrincipalPrefixes: string[];
  allowedKeyCustodyClasses: AsoiafAnswerTransportKeyCustodyClass[];
  allowExportablePrivateKeys: boolean;
  maxLeafLifetimeMilliseconds: number;
  maxRequestLifetimeMilliseconds: number;
  maxOrderLifetimeMilliseconds: number;
  minimumRenewalOverlapMilliseconds: number;
  approvalThreshold: number;
  emergencyApprovalThreshold: number;
  requiredApprovalRoles: AsoiafAnswerTransportApprovalRole[];
  emergencyRequiredApprovalRoles: AsoiafAnswerTransportApprovalRole[];
  approvers: Array<{
    approverId: string;
    role: AsoiafAnswerTransportApprovalRole;
    publicKeyPath: string;
  }>;
  createdAt: string;
  operatorId: string;
}

interface ProofFileInput {
  root: string;
  policyId: string;
  principalId: string;
  usage: AsoiafAnswerTransportCertificateUsage;
  actorRole?: AsoiafAnswerExchangeActorRole | null;
  mode: AsoiafAnswerTransportEnrollmentMode;
  publicKeyPath: string;
  requestedSubject: string;
  requestedSubjectAltNames?: string[];
  requestedValidFrom: string;
  requestedValidUntil: string;
  activateAt: string;
  renewAfter: string;
  retireAfter: string;
  predecessorCertificateFingerprint?: string | null;
  custody: AsoiafAnswerTransportEnrollmentRequestInput["custody"];
  nonce: string;
  createdAt: string;
  expiresAt: string;
  requesterId: string;
}

interface RequestFileInput extends ProofFileInput {
  proofAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  proofSignaturePath?: string;
  proofSignatureBase64?: string;
}

interface ApprovalStatementFileInput {
  root: string;
  requestId: string;
  approverId: string;
  decision: AsoiafAnswerTransportApprovalDecision;
  decidedAt: string;
  reason: string;
}

interface ApprovalFileInput extends ApprovalStatementFileInput {
  signatureAlgorithm: AsoiafAnswerTransportProofAlgorithm;
  signaturePath?: string;
  signatureBase64?: string;
}

interface OrderFileInput {
  root: string;
  requestId: string;
  orderedAt: string;
  expiresAt: string;
  operatorId: string;
}

interface IssuanceFileInput {
  root: string;
  orderId: string;
  certificatePath: string;
  issuerCertificatePath: string;
  issuedAt: string;
  recordedAt: string;
  operatorId: string;
}

interface AdmissionLinkFileInput {
  root: string;
  issuanceId: string;
  admission: AsoiafAnswerTransportRuntimeAdmissionReference;
  linkedAt: string;
  operatorId: string;
}

function value(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function required(name: string): string {
  const result = value(name);
  if (!result) throw new Error(`--${name} is required`);
  return result;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")) as T;
}

function readBytes(filePath: string): Buffer {
  return fs.readFileSync(path.resolve(filePath));
}

function signature(input: {
  path?: string;
  base64?: string;
  label: string;
}): Buffer {
  if (input.path && input.base64) {
    throw new Error(`${input.label} must use a path or base64, not both`);
  }
  if (input.path) return readBytes(input.path);
  if (input.base64 && /^[A-Za-z0-9+/]+={0,2}$/.test(input.base64)) {
    return Buffer.from(input.base64, "base64");
  }
  throw new Error(`${input.label} path or canonical base64 is required`);
}

function writeJson(output: unknown, target?: string): void {
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (!target) {
    process.stdout.write(serialized);
    return;
  }
  const resolved = path.resolve(target);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, serialized, "utf8");
  process.stdout.write(`${JSON.stringify({ ok: true, output: resolved }, null, 2)}\n`);
}

function policy(root: string, policyId: string): AsoiafAnswerTransportIssuerPolicy {
  const matches = readAsoiafAnswerTransportEnrollmentStatus(root).policies
    .filter((entry) => entry.policyId === policyId);
  if (matches.length !== 1) throw new Error(`issuer policy ${policyId} is absent or duplicated`);
  return matches[0]!;
}

function request(root: string, requestId: string) {
  const matches = readAsoiafAnswerTransportEnrollmentStatus(root).requests
    .filter((entry) => entry.requestId === requestId);
  if (matches.length !== 1) throw new Error(`enrollment request ${requestId} is absent or duplicated`);
  return matches[0]!;
}

function proofInput(input: ProofFileInput) {
  const root = path.resolve(input.root);
  return {
    policy: policy(root, input.policyId),
    principalId: input.principalId,
    usage: input.usage,
    actorRole: input.actorRole,
    mode: input.mode,
    publicKey: readBytes(input.publicKeyPath),
    requestedSubject: input.requestedSubject,
    requestedSubjectAltNames: input.requestedSubjectAltNames,
    requestedValidFrom: input.requestedValidFrom,
    requestedValidUntil: input.requestedValidUntil,
    activateAt: input.activateAt,
    renewAfter: input.renewAfter,
    retireAfter: input.retireAfter,
    predecessorCertificateFingerprint: input.predecessorCertificateFingerprint,
    custody: input.custody,
    nonce: input.nonce,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    requesterId: input.requesterId,
  };
}

function signingEnvelope(statement: unknown, bytes: Buffer): unknown {
  return {
    statement,
    signingBytesBase64: bytes.toString("base64"),
    signingBytesSha256:
      `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`,
    privateKeyRetained: false,
    authority: "none",
    graphEffect: "none",
    canonEffect: "none",
    answerEffect: "none",
  };
}

function usage(): void {
  process.stdout.write("ASOIAF answer transport enrollment and issuer governance\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  policy              Retain one issuer policy and approver registry\n");
  process.stdout.write("  proof               Emit canonical proof-of-possession signing bytes\n");
  process.stdout.write("  request             Verify proof of possession and retain an enrollment request\n");
  process.stdout.write("  approval-statement  Emit canonical approver signing bytes\n");
  process.stdout.write("  approve             Verify and retain one signed approval or rejection\n");
  process.stdout.write("  order               Compile one quorum-authorized leaf issuance order\n");
  process.stdout.write("  record              Verify and retain one externally issued certificate receipt\n");
  process.stdout.write("  link                Bind an issuance receipt to one runtime admission reference\n");
  process.stdout.write("  status              Read all enrollment and issuer-governance custody\n");
  process.stdout.write("  verify              Reconstruct policy, proof, quorum, issuance, and link custody\n");
  process.stdout.write("  paths               Print the enrollment storage contract\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>  Command input\n");
  process.stdout.write("  --root <path>   Holder-controlled answer-desk estate root\n");
  process.stdout.write("  --out <path>    Optional JSON output path\n");
}

try {
  switch (command) {
    case "policy": {
      const input = readJson<PolicyFileInput>(required("input"));
      writeJson(retainAsoiafAnswerTransportIssuerPolicy({
        ...input,
        root: path.resolve(input.root),
        issuerCertificate: readBytes(input.issuerCertificatePath),
        approvers: input.approvers.map((entry) => ({
          approverId: entry.approverId,
          role: entry.role,
          publicKey: readBytes(entry.publicKeyPath),
        })),
      }), value("out"));
      break;
    }
    case "proof": {
      const input = readJson<ProofFileInput>(required("input"));
      const statement = buildAsoiafAnswerTransportProofStatement(proofInput(input));
      writeJson(
        signingEnvelope(statement, serializeAsoiafAnswerTransportProofStatement(statement)),
        value("out"),
      );
      break;
    }
    case "request": {
      const input = readJson<RequestFileInput>(required("input"));
      writeJson(submitAsoiafAnswerTransportEnrollmentRequest({
        ...proofInput(input),
        root: path.resolve(input.root),
        policyId: input.policyId,
        proofAlgorithm: input.proofAlgorithm,
        proofSignature: signature({
          path: input.proofSignaturePath,
          base64: input.proofSignatureBase64,
          label: "proof signature",
        }),
      }), value("out"));
      break;
    }
    case "approval-statement": {
      const input = readJson<ApprovalStatementFileInput>(required("input"));
      const root = path.resolve(input.root);
      const enrollmentRequest = request(root, input.requestId);
      const issuerPolicy = policy(root, enrollmentRequest.proofStatement.policyId);
      const statement = buildAsoiafAnswerTransportApprovalStatement({
        policy: issuerPolicy,
        request: enrollmentRequest,
        approverId: input.approverId,
        decision: input.decision,
        decidedAt: input.decidedAt,
        reason: input.reason,
      });
      writeJson(
        signingEnvelope(
          statement,
          serializeAsoiafAnswerTransportApprovalStatement(statement),
        ),
        value("out"),
      );
      break;
    }
    case "approve": {
      const input = readJson<ApprovalFileInput>(required("input"));
      writeJson(retainAsoiafAnswerTransportEnrollmentApproval({
        root: path.resolve(input.root),
        requestId: input.requestId,
        approverId: input.approverId,
        decision: input.decision,
        decidedAt: input.decidedAt,
        reason: input.reason,
        signatureAlgorithm: input.signatureAlgorithm,
        signature: signature({
          path: input.signaturePath,
          base64: input.signatureBase64,
          label: "approval signature",
        }),
      }), value("out"));
      break;
    }
    case "order": {
      const input = readJson<OrderFileInput>(required("input"));
      writeJson(compileAsoiafAnswerTransportIssuanceOrder({
        ...input,
        root: path.resolve(input.root),
      }), value("out"));
      break;
    }
    case "record": {
      const input = readJson<IssuanceFileInput>(required("input"));
      writeJson(recordAsoiafAnswerTransportIssuedCertificate({
        root: path.resolve(input.root),
        orderId: input.orderId,
        certificate: readBytes(input.certificatePath),
        issuerCertificate: readBytes(input.issuerCertificatePath),
        issuedAt: input.issuedAt,
        recordedAt: input.recordedAt,
        operatorId: input.operatorId,
      }), value("out"));
      break;
    }
    case "link": {
      const input = readJson<AdmissionLinkFileInput>(required("input"));
      const result: {
        link: AsoiafAnswerTransportAdmissionLink;
        linkUri: string;
        replayed: boolean;
      } = linkAsoiafAnswerTransportRuntimeAdmission({
        ...input,
        root: path.resolve(input.root),
      });
      writeJson(result, value("out"));
      break;
    }
    case "status": {
      const root = path.resolve(required("root"));
      const status = readAsoiafAnswerTransportEnrollmentStatus(root);
      writeJson({
        ok: true,
        root,
        ...status,
        counts: {
          policies: status.policies.length,
          requests: status.requests.length,
          approvals: status.approvals.length,
          orders: status.orders.length,
          issuances: status.issuances.length,
          admissionLinks: status.admissionLinks.length,
        },
      }, value("out"));
      break;
    }
    case "verify": {
      const root = path.resolve(required("root"));
      const findings = verifyAsoiafAnswerTransportEnrollmentEstate(root);
      const errors = findings.filter((entry) => entry.severity === "error");
      writeJson({
        ok: errors.length === 0,
        root,
        findings,
        counts: {
          errors: errors.length,
          warnings: findings.filter((entry) => entry.severity === "warning").length,
          notices: findings.filter((entry) => entry.severity === "notice").length,
        },
      }, value("out"));
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "paths": {
      writeJson(
        asoiafAnswerTransportEnrollmentPaths(path.resolve(required("root"))),
        value("out"),
      );
      break;
    }
    case "help":
    case "--help":
    case "-h":
      usage();
      break;
    default:
      throw new Error(`unknown command ${command}`);
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
