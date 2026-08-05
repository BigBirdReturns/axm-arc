import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import type https from "node:https";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildAsoiafAnswerDeskFixture,
} from "../../fixtures/asoiaf-answer-desk-fixture.js";
import {
  adoptAsoiafAnswerDeskWorkOrder,
  readAsoiafAnswerDeskStatus,
} from "../../../tools/lib/asoiaf-answer-desk-estate.js";
import {
  readAsoiafAnswerExchangeStatus,
} from "../../../tools/lib/asoiaf-answer-desk-exchange.js";
import {
  readAsoiafAnswerDeskWorkerStatus,
} from "../../../tools/lib/asoiaf-answer-desk-worker.js";
import {
  buildAsoiafAnswerSupervisorPolicy,
  prepareAsoiafAnswerSupervisorIntent,
  readAsoiafAnswerSupervisorStatus,
} from "../../../tools/lib/asoiaf-answer-desk-supervisor.js";
import {
  createAsoiafAnswerTransportServer,
  fingerprintAsoiafAnswerTransportCertificate,
  listenAsoiafAnswerTransportServer,
  type AsoiafAnswerTransportAdmitBody,
  type AsoiafAnswerTransportIssueBody,
} from "../../../tools/lib/asoiaf-answer-desk-transport.js";
import {
  admitAsoiafAnswerTransportCertificate,
  advertiseAsoiafAnswerTransportEndpoint,
  dispatchAsoiafAnswerTransport,
  probeAsoiafAnswerTransportEndpoint,
  readAsoiafAnswerTransportOperationsStatus,
  retainAsoiafAnswerTransportRendezvous,
  retireAsoiafAnswerTransportCertificate,
} from "../../../tools/lib/asoiaf-answer-desk-transport-operations.js";
import {
  asoiafAnswerRemoteSupervisorPaths,
  buildAsoiafAnswerRemoteSupervisorPolicy,
  planAsoiafAnswerDeskRemoteSupervisor,
  prepareAsoiafAnswerRemoteSupervisorIntent,
  readAsoiafAnswerRemoteSupervisorStatus,
  tickAsoiafAnswerDeskRemoteSupervisor,
  validateAsoiafAnswerRemoteSupervisorPolicy,
  verifyAsoiafAnswerRemoteSupervisorEstate,
  type AsoiafAnswerRemoteSupervisorCredentialMaterial,
  type AsoiafAnswerRemoteSupervisorPolicy,
  type AsoiafAnswerRemoteSupervisorTickInput,
} from "../../../tools/lib/asoiaf-answer-desk-remote-supervisor.js";
import {
  sha256,
} from "../../../tools/lib/asoiaf-external-estate.js";
import type {
  AsoiafAnswerWorkAction,
  AsoiafAnswerWorkItem,
  AsoiafAnswerWorkOrder,
} from "../../../tools/lib/asoiaf-answer-work-order.js";

interface CertificateSet {
  directory: string;
  caCertificate: string;
  caKey: string;
  serverCertificate: string;
  serverKey: string;
  reviewerCertificate: string;
  reviewerKey: string;
  assemblerCertificate: string;
  assemblerKey: string;
}

interface AdmissionTimes {
  admittedAt: string;
  activateAt: string;
  renewAfter: string;
  retireAfter: string;
}

interface RemoteFloor {
  root: string;
  fixture: ReturnType<typeof buildAsoiafAnswerDeskFixture>;
  certificates: CertificateSet;
  server: https.Server;
  serverId: string;
  endpointLeaseId: string;
  reviewerAdmissionId: string;
  reviewerCertificateFingerprint: `sha256:${string}`;
  reviewerRendezvousId: string;
  reviewerRendezvousFingerprint: `sha256:${string}`;
  assemblerAdmissionId: string;
  assemblerCertificateFingerprint: `sha256:${string}`;
  assemblerRendezvousId: string;
  assemblerRendezvousFingerprint: `sha256:${string}`;
  policy: AsoiafAnswerRemoteSupervisorPolicy;
  requestedAt: string;
}

const roots: string[] = [];
const servers: https.Server[] = [];

function estateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-answer-remote-supervisor-"));
  roots.push(root);
  return root;
}

function runOpenSsl(args: string[]): void {
  execFileSync("openssl", args, { stdio: ["ignore", "ignore", "pipe"] });
}

function createCa(directory: string): { certificate: string; key: string } {
  const certificate = path.join(directory, "ca.crt");
  const key = path.join(directory, "ca.key");
  runOpenSsl([
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "2",
    "-subj", "/CN=ASOIAF remote supervisor test CA",
    "-addext", "basicConstraints=critical,CA:TRUE",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    "-keyout", key,
    "-out", certificate,
  ]);
  return { certificate, key };
}

function createLeaf(input: {
  directory: string;
  prefix: string;
  commonName: string;
  usage: "clientAuth" | "serverAuth";
  caCertificate: string;
  caKey: string;
  serial: number;
}): { certificate: string; key: string } {
  const certificate = path.join(input.directory, `${input.prefix}.crt`);
  const key = path.join(input.directory, `${input.prefix}.key`);
  const csr = path.join(input.directory, `${input.prefix}.csr`);
  const extension = path.join(input.directory, `${input.prefix}.ext`);
  runOpenSsl([
    "req", "-new", "-newkey", "rsa:2048", "-nodes", "-sha256",
    "-subj", `/CN=${input.commonName}`,
    "-keyout", key,
    "-out", csr,
  ]);
  const lines = [
    "basicConstraints=critical,CA:FALSE",
    "keyUsage=critical,digitalSignature,keyEncipherment",
    `extendedKeyUsage=${input.usage}`,
  ];
  if (input.usage === "serverAuth") {
    lines.push("subjectAltName=DNS:localhost,IP:127.0.0.1");
  }
  fs.writeFileSync(extension, `${lines.join("\n")}\n`, "utf8");
  runOpenSsl([
    "x509", "-req", "-sha256", "-days", "2",
    "-in", csr,
    "-CA", input.caCertificate,
    "-CAkey", input.caKey,
    "-set_serial", String(input.serial),
    "-extfile", extension,
    "-out", certificate,
  ]);
  return { certificate, key };
}

function certificates(root: string): CertificateSet {
  const directory = path.join(root, "ephemeral-certificates");
  fs.mkdirSync(directory, { recursive: true });
  const ca = createCa(directory);
  const server = createLeaf({
    directory,
    prefix: "server",
    commonName: "localhost",
    usage: "serverAuth",
    caCertificate: ca.certificate,
    caKey: ca.key,
    serial: 101,
  });
  const reviewer = createLeaf({
    directory,
    prefix: "reviewer",
    commonName: "remote exact locator reviewer",
    usage: "clientAuth",
    caCertificate: ca.certificate,
    caKey: ca.key,
    serial: 201,
  });
  const assembler = createLeaf({
    directory,
    prefix: "assembler",
    commonName: "remote answer assembler",
    usage: "clientAuth",
    caCertificate: ca.certificate,
    caKey: ca.key,
    serial: 202,
  });
  return {
    directory,
    caCertificate: ca.certificate,
    caKey: ca.key,
    serverCertificate: server.certificate,
    serverKey: server.key,
    reviewerCertificate: reviewer.certificate,
    reviewerKey: reviewer.key,
    assemblerCertificate: assembler.certificate,
    assemblerKey: assembler.key,
  };
}

function pem(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

function certificateTimes(certificatePath: string): AdmissionTimes {
  const certificate = new crypto.X509Certificate(pem(certificatePath));
  const validFrom = certificate.validFromDate.getTime();
  return {
    admittedAt: new Date(validFrom).toISOString(),
    activateAt: new Date(validFrom).toISOString(),
    renewAfter: new Date(validFrom + 6 * 60 * 60 * 1000).toISOString(),
    retireAfter: new Date(validFrom + 12 * 60 * 60 * 1000).toISOString(),
  };
}

function item(
  workOrder: AsoiafAnswerWorkOrder,
  action: AsoiafAnswerWorkAction,
): AsoiafAnswerWorkItem {
  const result = workOrder.items.find((entry) => entry.action === action);
  if (!result) throw new Error(`remote supervisor fixture lacks ${action}`);
  return result;
}

async function closeServer(server: https.Server): Promise<void> {
  const closed = server.listening
    ? new Promise<void>((resolve) => server.close(() => resolve()))
    : Promise.resolve();
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await closed;
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
}

function supervisorPolicy(createdAt: string) {
  return buildAsoiafAnswerSupervisorPolicy({
    createdBy: "operator:remote-supervisor-policy",
    createdAt,
    automaticWorkerEnabled: true,
    automaticLeaseMilliseconds: 60_000,
    actorBindings: [
      {
        actorRole: "exact-locator-reviewer",
        actorId: "actor:remote-supervisor:reviewer",
        capacity: 1,
        leaseMilliseconds: 600_000,
        priority: 10,
      },
      {
        actorRole: "answer-assembler",
        actorId: "actor:remote-supervisor:assembler",
        capacity: 1,
        leaseMilliseconds: 600_000,
        priority: 20,
      },
    ],
  });
}

async function remoteFloor(): Promise<RemoteFloor> {
  const root = estateRoot();
  const fixture = buildAsoiafAnswerDeskFixture();
  const certs = certificates(root);
  const now = Date.now();
  adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder: fixture.openWorkOrder,
    adoptedAt: new Date(now - 30_000).toISOString(),
    operatorId: "operator:remote-supervisor-adopt",
  });
  const serverAdmission = admitAsoiafAnswerTransportCertificate({
    root,
    usage: "server-auth",
    principalId: "server:remote-supervisor:test",
    certificate: pem(certs.serverCertificate),
    issuerCertificate: pem(certs.caCertificate),
    ...certificateTimes(certs.serverCertificate),
    rotationReason:
      "The operator admits one bounded server certificate for pinned remote supervisor qualification and no task authority.",
    operatorId: "operator:remote-supervisor-server-admission",
  }).admission;
  const reviewerAdmission = admitAsoiafAnswerTransportCertificate({
    root,
    usage: "client-auth",
    principalId: "actor:remote-supervisor:reviewer",
    actorRole: "exact-locator-reviewer",
    certificate: pem(certs.reviewerCertificate),
    issuerCertificate: pem(certs.caCertificate),
    ...certificateTimes(certs.reviewerCertificate),
    rotationReason:
      "The operator admits the exact remote reviewer certificate for one bounded scheduling and dispatch qualification.",
    operatorId: "operator:remote-supervisor-reviewer-admission",
  }).admission;
  const assemblerAdmission = admitAsoiafAnswerTransportCertificate({
    root,
    usage: "client-auth",
    principalId: "actor:remote-supervisor:assembler",
    actorRole: "answer-assembler",
    certificate: pem(certs.assemblerCertificate),
    issuerCertificate: pem(certs.caCertificate),
    ...certificateTimes(certs.assemblerCertificate),
    rotationReason:
      "The operator admits the exact remote assembler certificate for one bounded scheduling and dispatch qualification.",
    operatorId: "operator:remote-supervisor-assembler-admission",
  }).admission;
  const server = createAsoiafAnswerTransportServer({
    root,
    certificate: pem(certs.serverCertificate),
    privateKey: pem(certs.serverKey),
    clientCertificateAuthority: pem(certs.caCertificate),
    host: "127.0.0.1",
    port: 0,
    operatorId: "operator:remote-supervisor-server",
  });
  servers.push(server);
  const listening = await listenAsoiafAnswerTransportServer(server, "127.0.0.1", 0);
  const baseUrl = `https://127.0.0.1:${listening.port}/`;
  const endpoint = advertiseAsoiafAnswerTransportEndpoint({
    root,
    serverId: serverAdmission.principalId,
    baseUrl,
    networkScope: "loopback",
    priority: 10,
    serverCertificateFingerprint: serverAdmission.certificateFingerprint,
    acceptedClientCaCertificateFingerprint: fingerprintAsoiafAnswerTransportCertificate(
      pem(certs.caCertificate),
    ),
    advertisedAt: serverAdmission.admittedAt,
    availableFrom: serverAdmission.activateAt,
    expiresAt: new Date(Date.parse(serverAdmission.activateAt) + 10 * 60 * 60 * 1000).toISOString(),
    operatorId: "operator:remote-supervisor-endpoint",
  }).endpoint;
  const reviewerProbe = await probeAsoiafAnswerTransportEndpoint({
    root,
    endpointLeaseId: endpoint.endpointLeaseId,
    clientCertificate: pem(certs.reviewerCertificate),
    clientPrivateKey: pem(certs.reviewerKey),
    serverCertificateAuthority: pem(certs.caCertificate),
    observedAt: new Date().toISOString(),
  });
  const assemblerProbe = await probeAsoiafAnswerTransportEndpoint({
    root,
    endpointLeaseId: endpoint.endpointLeaseId,
    clientCertificate: pem(certs.assemblerCertificate),
    clientPrivateKey: pem(certs.assemblerKey),
    serverCertificateAuthority: pem(certs.caCertificate),
    observedAt: new Date().toISOString(),
  });
  const generatedAt = new Date(Math.max(
    Date.parse(reviewerProbe.observation.completedAt),
    Date.parse(assemblerProbe.observation.completedAt),
    Date.now() - 2_000,
  )).toISOString();
  const reviewerRendezvous = retainAsoiafAnswerTransportRendezvous({
    root,
    serverId: serverAdmission.principalId,
    clientCertificateFingerprint: reviewerAdmission.certificateFingerprint,
    generatedAt,
    maxObservationAgeMilliseconds: 60_000,
    operatorId: "operator:remote-supervisor-reviewer-rendezvous",
  }).rendezvous;
  const assemblerRendezvous = retainAsoiafAnswerTransportRendezvous({
    root,
    serverId: serverAdmission.principalId,
    clientCertificateFingerprint: assemblerAdmission.certificateFingerprint,
    generatedAt,
    maxObservationAgeMilliseconds: 60_000,
    operatorId: "operator:remote-supervisor-assembler-rendezvous",
  }).rendezvous;
  const basePolicy = supervisorPolicy(new Date(now - 20_000).toISOString());
  const reviewerBinding = basePolicy.actorBindings.find(
    (entry) => entry.actorId === reviewerAdmission.principalId,
  )!;
  const assemblerBinding = basePolicy.actorBindings.find(
    (entry) => entry.actorId === assemblerAdmission.principalId,
  )!;
  const policy = buildAsoiafAnswerRemoteSupervisorPolicy({
    root,
    createdBy: "operator:remote-supervisor-composed-policy",
    createdAt: new Date(now - 10_000).toISOString(),
    supervisorPolicy: basePolicy,
    remoteBindings: [
      {
        supervisorBindingId: reviewerBinding.bindingId,
        certificateAdmissionId: reviewerAdmission.admissionId,
        rendezvousId: reviewerRendezvous.rendezvousId,
      },
      {
        supervisorBindingId: assemblerBinding.bindingId,
        certificateAdmissionId: assemblerAdmission.admissionId,
        rendezvousId: assemblerRendezvous.rendezvousId,
      },
    ],
  });
  const requestedAt = new Date(Math.max(Date.now() - 1, Date.parse(generatedAt) + 1)).toISOString();
  return {
    root,
    fixture,
    certificates: certs,
    server,
    serverId: serverAdmission.principalId,
    endpointLeaseId: endpoint.endpointLeaseId,
    reviewerAdmissionId: reviewerAdmission.admissionId,
    reviewerCertificateFingerprint: reviewerAdmission.certificateFingerprint,
    reviewerRendezvousId: reviewerRendezvous.rendezvousId,
    reviewerRendezvousFingerprint: reviewerRendezvous.rendezvousFingerprint,
    assemblerAdmissionId: assemblerAdmission.admissionId,
    assemblerCertificateFingerprint: assemblerAdmission.certificateFingerprint,
    assemblerRendezvousId: assemblerRendezvous.rendezvousId,
    assemblerRendezvousFingerprint: assemblerRendezvous.rendezvousFingerprint,
    policy,
    requestedAt,
  };
}

function reviewerCredentials(floor: RemoteFloor): AsoiafAnswerRemoteSupervisorCredentialMaterial {
  return {
    certificateAdmissionId: floor.reviewerAdmissionId,
    clientCertificate: pem(floor.certificates.reviewerCertificate),
    clientPrivateKey: pem(floor.certificates.reviewerKey),
    serverCertificateAuthority: pem(floor.certificates.caCertificate),
  };
}

function assemblerCredentials(floor: RemoteFloor): AsoiafAnswerRemoteSupervisorCredentialMaterial {
  return {
    certificateAdmissionId: floor.assemblerAdmissionId,
    clientCertificate: pem(floor.certificates.assemblerCertificate),
    clientPrivateKey: pem(floor.certificates.assemblerKey),
    serverCertificateAuthority: pem(floor.certificates.caCertificate),
  };
}

function tickInput(input: {
  floor: RemoteFloor;
  requestKey: string;
  requestedAt?: string;
  automaticCompletedAt?: string | null;
  credentials?: AsoiafAnswerRemoteSupervisorCredentialMaterial | null;
}): AsoiafAnswerRemoteSupervisorTickInput {
  return {
    root: input.floor.root,
    requestKey: input.requestKey,
    policy: input.floor.policy,
    requestedAt: input.requestedAt ?? input.floor.requestedAt,
    automaticCompletedAt: input.automaticCompletedAt ?? null,
    operatorId: "operator:remote-supervisor-tick",
    credentials: input.credentials ?? null,
  };
}

function dispatchKey(intent: ReturnType<typeof prepareAsoiafAnswerRemoteSupervisorIntent>["intent"]): string {
  return `remote-supervisor-${sha256({
    estateId: intent.estateId,
    requestKey: intent.requestKey,
    policyFingerprint: intent.policyFingerprint,
    beforeProjectionFingerprint: intent.beforeProjectionFingerprint,
  }).slice("sha256:".length)}`;
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await closeServer(server);
  }
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF remote answer-desk supervisor", () => {
  it("builds a deterministic certificate-bound policy without retaining credential material", async () => {
    const floor = await remoteFloor();
    const policy = buildAsoiafAnswerRemoteSupervisorPolicy({
      root: floor.root,
      createdBy: floor.policy.createdBy,
      createdAt: floor.policy.createdAt,
      supervisorPolicy: floor.policy.supervisorPolicy,
      remoteBindings: floor.policy.remoteBindings.map((entry) => ({
        supervisorBindingId: entry.supervisorBindingId,
        certificateAdmissionId: entry.certificateAdmissionId,
        rendezvousId: entry.rendezvousId,
      })),
    });

    expect(policy).toEqual(floor.policy);
    expect(validateAsoiafAnswerRemoteSupervisorPolicy(policy)).toEqual([]);
    expect(policy).toEqual(expect.objectContaining({
      selectionPolicy: "supervisor-decision-then-exact-pinned-rendezvous",
      credentialPolicy: "operator-supplied-ephemeral-material",
      dispatchPolicy: "remote-first-then-supervisor-replay",
      automaticFailover: false,
      networkDiscovery: "none",
      certificateIssuanceAuthority: "none",
      certificateRetained: false,
      privateKeyRetained: false,
      certificatePathRetained: false,
      privateKeyPathRetained: false,
      authority: "none",
      graphEffect: "none",
      canonEffect: "none",
      answerEffect: "none",
    }));
  });

  it("withholds external work when the supervisor has no exact remote rendezvous binding", async () => {
    const floor = await remoteFloor();
    const noRemotePolicy = buildAsoiafAnswerRemoteSupervisorPolicy({
      root: floor.root,
      createdBy: "operator:no-remote-binding",
      createdAt: floor.policy.createdAt,
      supervisorPolicy: floor.policy.supervisorPolicy,
      remoteBindings: [],
    });
    const projection = planAsoiafAnswerDeskRemoteSupervisor({
      root: floor.root,
      policy: noRemotePolicy,
      projectedAt: floor.requestedAt,
    });
    expect(projection.supervisorProjection.decision.kind).toBe("issue-external");
    expect(projection.decision.kind).toBe("wait-rendezvous");

    const result = await tickAsoiafAnswerDeskRemoteSupervisor({
      ...tickInput({ floor, requestKey: "request:wait-rendezvous" }),
      policy: noRemotePolicy,
    });
    expect(result.run.outcome).toBe("waiting-rendezvous");
    expect(result.baseSupervisorIntent).toBeNull();
    expect(result.baseSupervisorRun).toBeNull();
    expect(result.dispatch).toBeNull();
    expect(readAsoiafAnswerDeskStatus(floor.root).leases).toEqual([]);
    expect(readAsoiafAnswerSupervisorStatus(floor.root).intents).toEqual([]);
    expect(verifyAsoiafAnswerRemoteSupervisorEstate(floor.root)).toEqual([]);
  });

  it("retains a remote write-ahead intent without creating a supervisor intent, lease, or dispatch", async () => {
    const floor = await remoteFloor();
    const prepared = prepareAsoiafAnswerRemoteSupervisorIntent(tickInput({
      floor,
      requestKey: "request:prepare-remote-review",
      credentials: reviewerCredentials(floor),
    }));

    expect(prepared.intent.decision.kind).toBe("dispatch-external");
    expect(prepared.replayed).toBe(false);
    expect(readAsoiafAnswerDeskStatus(floor.root).leases).toEqual([]);
    expect(readAsoiafAnswerSupervisorStatus(floor.root).intents).toEqual([]);
    expect(readAsoiafAnswerTransportOperationsStatus(floor.root).dispatches).toEqual([]);
    expect(readAsoiafAnswerRemoteSupervisorStatus(floor.root).pendingIntentIds).toEqual([
      prepared.intent.intentId,
    ]);
    expect(
      verifyAsoiafAnswerRemoteSupervisorEstate(floor.root).map((entry) => entry.code),
    ).toContain("remote-intent-pending");
  });

  it("dispatches through the pinned rendezvous and forces the qualified supervisor to replay the exact assignment", async () => {
    const floor = await remoteFloor();
    const input = tickInput({
      floor,
      requestKey: "request:dispatch-remote-review",
      credentials: reviewerCredentials(floor),
    });
    const first = await tickAsoiafAnswerDeskRemoteSupervisor(input);
    const second = await tickAsoiafAnswerDeskRemoteSupervisor({
      ...input,
      credentials: null,
    });

    expect(first.run.outcome).toBe("external-dispatched");
    expect(first.networkAttempted).toBe(true);
    expect(first.dispatchReplayed).toBe(false);
    expect(first.baseSupervisorRun?.decisionKind).toBe("issue-external");
    expect(first.baseSupervisorRun?.operationReplayed).toBe(true);
    expect(first.run.assignmentId).toBe(first.dispatch?.envelope.response?.payload &&
      "assignment" in first.dispatch.envelope.response.payload
      ? first.dispatch.envelope.response.payload.assignment.assignmentId
      : null);
    expect(second.runReplayed).toBe(true);
    expect(second.run).toEqual(first.run);
    expect(second.networkAttempted).toBe(false);
    expect(readAsoiafAnswerDeskStatus(floor.root).leases).toHaveLength(1);
    expect(readAsoiafAnswerExchangeStatus(floor.root).assignments).toHaveLength(1);
    expect(readAsoiafAnswerSupervisorStatus(floor.root).runs).toHaveLength(1);
    expect(readAsoiafAnswerTransportOperationsStatus(floor.root).dispatches).toHaveLength(1);
    expect(readAsoiafAnswerRemoteSupervisorStatus(floor.root).runs).toHaveLength(1);
    expect(
      verifyAsoiafAnswerRemoteSupervisorEstate(floor.root).filter(
        (entry) => entry.severity === "error",
      ),
    ).toEqual([]);
  });

  it("recovers after the network dispatch was retained but before either supervisor run receipt existed", async () => {
    const floor = await remoteFloor();
    const input = tickInput({
      floor,
      requestKey: "request:recover-remote-review",
      credentials: reviewerCredentials(floor),
    });
    const prepared = prepareAsoiafAnswerRemoteSupervisorIntent(input);
    prepareAsoiafAnswerSupervisorIntent({
      root: floor.root,
      requestKey: prepared.intent.baseSupervisorRequestKey,
      policy: floor.policy.supervisorPolicy,
      requestedAt: prepared.intent.requestedAt,
      automaticCompletedAt: null,
      operatorId: `${prepared.intent.operatorId}:base-supervisor`,
    });
    const body: AsoiafAnswerTransportIssueBody = {
      itemId: prepared.intent.decision.itemId,
      claimedAt: prepared.intent.requestedAt,
      issuedAt: prepared.intent.requestedAt,
      leaseMilliseconds: prepared.intent.decision.leaseMilliseconds!,
    };
    const rendezvous = readAsoiafAnswerTransportOperationsStatus(floor.root).rendezvous.find(
      (entry) => entry.rendezvousId === floor.reviewerRendezvousId,
    )!;
    const dispatched = await dispatchAsoiafAnswerTransport({
      root: floor.root,
      rendezvous,
      operation: "issue-assignment",
      body,
      idempotencyKey: dispatchKey(prepared.intent),
      clientCertificate: pem(floor.certificates.reviewerCertificate),
      clientPrivateKey: pem(floor.certificates.reviewerKey),
      serverCertificateAuthority: pem(floor.certificates.caCertificate),
      dispatchedAt: prepared.intent.requestedAt,
    });
    expect(dispatched.networkAttempted).toBe(true);
    await closeServer(floor.server);
    servers.splice(servers.indexOf(floor.server), 1);

    const recovered = await tickAsoiafAnswerDeskRemoteSupervisor({
      ...input,
      credentials: null,
    });
    expect(recovered.dispatchReplayed).toBe(true);
    expect(recovered.networkAttempted).toBe(false);
    expect(recovered.baseSupervisorRun?.operationReplayed).toBe(true);
    expect(recovered.runReplayed).toBe(false);
    expect(readAsoiafAnswerDeskStatus(floor.root).leases).toHaveLength(1);
    expect(readAsoiafAnswerExchangeStatus(floor.root).assignments).toHaveLength(1);
    expect(readAsoiafAnswerSupervisorStatus(floor.root).runs).toHaveLength(1);
    expect(readAsoiafAnswerRemoteSupervisorStatus(floor.root).runs).toHaveLength(1);
    expect(
      verifyAsoiafAnswerRemoteSupervisorEstate(floor.root).filter(
        (entry) => entry.severity === "error",
      ),
    ).toEqual([]);
  });

  it("withholds a stale or retired client rendezvous without manufacturing local exchange work", async () => {
    const floor = await remoteFloor();
    const staleAt = new Date(Date.parse(floor.requestedAt) + 120_000).toISOString();
    const stale = planAsoiafAnswerDeskRemoteSupervisor({
      root: floor.root,
      policy: floor.policy,
      projectedAt: staleAt,
    });
    expect(stale.decision.kind).toBe("wait-rendezvous");
    expect(stale.decision.reason).toMatch(/stale/);

    retireAsoiafAnswerTransportCertificate({
      root: floor.root,
      certificateFingerprint: floor.reviewerCertificateFingerprint,
      retiredAt: floor.requestedAt,
      kind: "emergency",
      reason:
        "The operator immediately retires this test reviewer certificate to prove remote scheduling cannot route around effective revocation.",
      operatorId: "operator:remote-supervisor-emergency-retire",
    });
    const retired = planAsoiafAnswerDeskRemoteSupervisor({
      root: floor.root,
      policy: floor.policy,
      projectedAt: new Date(Date.parse(floor.requestedAt) + 1).toISOString(),
    });
    expect(retired.decision.kind).toBe("wait-rendezvous");
    expect(retired.decision.reason).toMatch(/retirement/);
    expect(readAsoiafAnswerDeskStatus(floor.root).leases).toEqual([]);
  });

  it("rotates remote review and gap closure before delegating automatic rendering locally", async () => {
    const floor = await remoteFloor();
    const review = await tickAsoiafAnswerDeskRemoteSupervisor(tickInput({
      floor,
      requestKey: "request:rotation-remote-review",
      requestedAt: floor.requestedAt,
      credentials: reviewerCredentials(floor),
    }));
    const reviewAssignment = review.dispatch!.envelope.response!.payload as { assignment: { assignmentId: string } };
    const reviewerRendezvous = readAsoiafAnswerTransportOperationsStatus(floor.root).rendezvous.find(
      (entry) => entry.rendezvousId === floor.reviewerRendezvousId,
    )!;
    const reviewBody: AsoiafAnswerTransportAdmitBody = {
      assignmentId: reviewAssignment.assignment.assignmentId,
      completedAt: new Date().toISOString(),
      outcome: "satisfied",
      afterWorkOrder: floor.fixture.reconciledWorkOrder,
      resultReferences: [
        {
          kind: "reviewed-answer-transaction",
          objectId: floor.fixture.transaction.transactionId,
          fingerprint: floor.fixture.transaction.transactionFingerprint,
          uri: null,
        },
      ],
      reason:
        "The remote reviewer returns the exact reviewed transaction that advances the qualified desk through the permanent transport validators.",
    };
    await dispatchAsoiafAnswerTransport({
      root: floor.root,
      rendezvous: reviewerRendezvous,
      operation: "admit-result",
      body: reviewBody,
      idempotencyKey: `remote-review-result-${sha256(reviewBody).slice("sha256:".length)}`,
      clientCertificate: pem(floor.certificates.reviewerCertificate),
      clientPrivateKey: pem(floor.certificates.reviewerKey),
      serverCertificateAuthority: pem(floor.certificates.caCertificate),
      dispatchedAt: new Date().toISOString(),
    });

    const closeAt = new Date().toISOString();
    const close = await tickAsoiafAnswerDeskRemoteSupervisor(tickInput({
      floor,
      requestKey: "request:rotation-remote-close",
      requestedAt: closeAt,
      credentials: assemblerCredentials(floor),
    }));
    expect(close.run.assignmentId).not.toBeNull();
    const closeAssignment = close.dispatch!.envelope.response!.payload as { assignment: { assignmentId: string } };
    const assemblerRendezvous = readAsoiafAnswerTransportOperationsStatus(floor.root).rendezvous.find(
      (entry) => entry.rendezvousId === floor.assemblerRendezvousId,
    )!;
    const closeBody: AsoiafAnswerTransportAdmitBody = {
      assignmentId: closeAssignment.assignment.assignmentId,
      completedAt: new Date().toISOString(),
      outcome: "satisfied",
      afterWorkOrder: floor.fixture.readyWorkOrder,
      resultReferences: [
        {
          kind: "reviewed-answer-packet",
          objectId: floor.fixture.answerPacket.answerPacketId,
          fingerprint: floor.fixture.answerPacket.answerPacketFingerprint,
          uri: null,
        },
      ],
      reason:
        "The remote answer assembler returns the exact reviewed packet that closes the bounded gap through permanent validators.",
    };
    await dispatchAsoiafAnswerTransport({
      root: floor.root,
      rendezvous: assemblerRendezvous,
      operation: "admit-result",
      body: closeBody,
      idempotencyKey: `remote-close-result-${sha256(closeBody).slice("sha256:".length)}`,
      clientCertificate: pem(floor.certificates.assemblerCertificate),
      clientPrivateKey: pem(floor.certificates.assemblerKey),
      serverCertificateAuthority: pem(floor.certificates.caCertificate),
      dispatchedAt: new Date().toISOString(),
    });

    const renderAt = new Date().toISOString();
    const render = await tickAsoiafAnswerDeskRemoteSupervisor(tickInput({
      floor,
      requestKey: "request:rotation-local-render",
      requestedAt: renderAt,
      automaticCompletedAt: new Date(Date.parse(renderAt) + 1_000).toISOString(),
      credentials: null,
    }));
    expect(render.run.outcome).toBe("automatic-rendered");
    expect(render.dispatch).toBeNull();
    expect(render.baseSupervisorRun?.decisionKind).toBe("run-automatic");

    const desk = readAsoiafAnswerDeskStatus(floor.root);
    const exchange = readAsoiafAnswerExchangeStatus(floor.root);
    const worker = readAsoiafAnswerDeskWorkerStatus(floor.root);
    const remote = readAsoiafAnswerRemoteSupervisorStatus(floor.root);
    expect(desk.workOrders).toHaveLength(3);
    expect(desk.leases).toHaveLength(3);
    expect(desk.settlements).toHaveLength(3);
    expect(desk.state.availableItemIds).toEqual([]);
    expect(desk.state.nextAvailableItemId).toBeNull();
    expect(exchange.assignments).toHaveLength(2);
    expect(exchange.results).toHaveLength(2);
    expect(worker.invocations).toHaveLength(1);
    expect(worker.results).toHaveLength(1);
    expect(remote.intents).toHaveLength(3);
    expect(remote.runs).toHaveLength(3);
    expect(remote.pendingIntentIds).toEqual([]);
    expect(verifyAsoiafAnswerRemoteSupervisorEstate(floor.root)).toEqual([]);
  });

  it("refuses request retargeting and detects changed or secret-bearing remote custody", async () => {
    const floor = await remoteFloor();
    const input = tickInput({
      floor,
      requestKey: "request:immutable-remote-key",
      credentials: reviewerCredentials(floor),
    });
    const first = await tickAsoiafAnswerDeskRemoteSupervisor(input);
    await expect(tickAsoiafAnswerDeskRemoteSupervisor({
      ...input,
      requestedAt: new Date(Date.parse(input.requestedAt) + 1).toISOString(),
    })).rejects.toThrow(/already has a different intent/);

    const runPath = path.join(
      asoiafAnswerRemoteSupervisorPaths(floor.root).runs,
      `${first.run.runFingerprint.slice("sha256:".length)}.json`,
    );
    fs.writeFileSync(
      runPath,
      `${JSON.stringify({
        ...first.run,
        networkAttempted: false,
      }, null, 2)}\n`,
      "utf8",
    );
    const secretPath = path.join(
      asoiafAnswerRemoteSupervisorPaths(floor.root).remoteSupervisorRoot,
      "leaked-private-key.pem",
    );
    fs.writeFileSync(secretPath, "-----BEGIN PRIVATE KEY-----\nforbidden\n", "utf8");
    expect(
      verifyAsoiafAnswerRemoteSupervisorEstate(floor.root).map((entry) => entry.code),
    ).toEqual(expect.arrayContaining([
      "remote-run-fingerprint",
      "remote-secret-filename",
      "remote-secret-material",
    ]));
  });
});
