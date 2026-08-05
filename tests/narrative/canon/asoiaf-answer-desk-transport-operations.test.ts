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
  ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
  createAsoiafAnswerTransportServer,
  fingerprintAsoiafAnswerTransportCertificate,
  listenAsoiafAnswerTransportServer,
  processAsoiafAnswerTransportRequest,
  readAsoiafAnswerTransportStatus,
} from "../../../tools/lib/asoiaf-answer-desk-transport.js";
import {
  admitAsoiafAnswerTransportCertificate,
  advertiseAsoiafAnswerTransportEndpoint,
  asoiafAnswerTransportOperationsPaths,
  buildAsoiafAnswerTransportRendezvous,
  dispatchAsoiafAnswerTransport,
  probeAsoiafAnswerTransportEndpoint,
  readAsoiafAnswerTransportOperationsStatus,
  retainAsoiafAnswerTransportRendezvous,
  retireAsoiafAnswerTransportCertificate,
  verifyAsoiafAnswerTransportOperationsEstate,
} from "../../../tools/lib/asoiaf-answer-desk-transport-operations.js";
import type {
  AsoiafAnswerTransportIssueBody,
} from "../../../tools/lib/asoiaf-answer-desk-transport.js";
import type {
  AsoiafAnswerWorkAction,
  AsoiafAnswerWorkItem,
  AsoiafAnswerWorkOrder,
} from "../../../tools/lib/asoiaf-answer-work-order.js";

interface CertificateSet {
  directory: string;
  caCertificate: string;
  caKey: string;
  alternateCaCertificate: string;
  alternateCaKey: string;
  serverCertificate: string;
  serverKey: string;
  alternateServerCertificate: string;
  alternateServerKey: string;
  reviewerCertificate: string;
  reviewerKey: string;
  reviewerSuccessorCertificate: string;
  reviewerSuccessorKey: string;
  assemblerCertificate: string;
  assemblerKey: string;
}

interface AdmissionTimes {
  admittedAt: string;
  activateAt: string;
  renewAfter: string;
  retireAfter: string;
}

const roots: string[] = [];
const servers: https.Server[] = [];

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

function estateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-answer-transport-operations-"));
  roots.push(root);
  return root;
}

function runOpenSsl(args: string[]): void {
  execFileSync("openssl", args, { stdio: ["ignore", "ignore", "pipe"] });
}

function createCa(directory: string, prefix: string, commonName: string): { certificate: string; key: string } {
  const certificate = path.join(directory, `${prefix}.crt`);
  const key = path.join(directory, `${prefix}.key`);
  runOpenSsl([
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "2",
    "-subj", `/CN=${commonName}`,
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
  const ca = createCa(directory, "ca", "ASOIAF transport operations test CA");
  const alternateCa = createCa(directory, "alternate-ca", "ASOIAF alternate test CA");
  const server = createLeaf({
    directory,
    prefix: "server",
    commonName: "localhost",
    usage: "serverAuth",
    caCertificate: ca.certificate,
    caKey: ca.key,
    serial: 101,
  });
  const alternateServer = createLeaf({
    directory,
    prefix: "alternate-server",
    commonName: "localhost",
    usage: "serverAuth",
    caCertificate: ca.certificate,
    caKey: ca.key,
    serial: 102,
  });
  const reviewer = createLeaf({
    directory,
    prefix: "reviewer",
    commonName: "exact locator reviewer",
    usage: "clientAuth",
    caCertificate: ca.certificate,
    caKey: ca.key,
    serial: 201,
  });
  const reviewerSuccessor = createLeaf({
    directory,
    prefix: "reviewer-successor",
    commonName: "exact locator reviewer successor",
    usage: "clientAuth",
    caCertificate: ca.certificate,
    caKey: ca.key,
    serial: 202,
  });
  const assembler = createLeaf({
    directory,
    prefix: "assembler",
    commonName: "answer assembler",
    usage: "clientAuth",
    caCertificate: ca.certificate,
    caKey: ca.key,
    serial: 203,
  });
  return {
    directory,
    caCertificate: ca.certificate,
    caKey: ca.key,
    alternateCaCertificate: alternateCa.certificate,
    alternateCaKey: alternateCa.key,
    serverCertificate: server.certificate,
    serverKey: server.key,
    alternateServerCertificate: alternateServer.certificate,
    alternateServerKey: alternateServer.key,
    reviewerCertificate: reviewer.certificate,
    reviewerKey: reviewer.key,
    reviewerSuccessorCertificate: reviewerSuccessor.certificate,
    reviewerSuccessorKey: reviewerSuccessor.key,
    assemblerCertificate: assembler.certificate,
    assemblerKey: assembler.key,
  };
}

function pem(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

function certificateTimes(
  certificatePath: string,
  activateOffsetMilliseconds = 0,
  renewOffsetMilliseconds = 6 * 60 * 60 * 1000,
  retireOffsetMilliseconds = 12 * 60 * 60 * 1000,
): AdmissionTimes {
  const certificate = new crypto.X509Certificate(pem(certificatePath));
  const base = certificate.validFromDate.getTime();
  return {
    admittedAt: new Date(base).toISOString(),
    activateAt: new Date(base + activateOffsetMilliseconds).toISOString(),
    renewAfter: new Date(base + renewOffsetMilliseconds).toISOString(),
    retireAfter: new Date(base + retireOffsetMilliseconds).toISOString(),
  };
}

function item(
  workOrder: AsoiafAnswerWorkOrder,
  action: AsoiafAnswerWorkAction,
): AsoiafAnswerWorkItem {
  const result = workOrder.items.find((entry) => entry.action === action);
  if (!result) throw new Error(`fixture work order lacks ${action}`);
  return result;
}

function adoptOpen(root: string) {
  const fixture = buildAsoiafAnswerDeskFixture();
  adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder: fixture.openWorkOrder,
    adoptedAt: new Date().toISOString(),
    operatorId: "operator:transport-operations-open",
  });
  return fixture;
}

function admitClient(input: {
  root: string;
  certificateSet: CertificateSet;
  certificate: string;
  principalId?: string;
  actorRole?: "exact-locator-reviewer" | "answer-assembler";
  times?: AdmissionTimes;
  predecessor?: string | null;
}) {
  return admitAsoiafAnswerTransportCertificate({
    root: input.root,
    usage: "client-auth",
    principalId: input.principalId ?? "actor:transport-operations:reviewer",
    actorRole: input.actorRole ?? "exact-locator-reviewer",
    certificate: pem(input.certificate),
    issuerCertificate: pem(input.certificateSet.caCertificate),
    ...(input.times ?? certificateTimes(input.certificate)),
    predecessorCertificateFingerprint: input.predecessor ?? null,
    rotationReason:
      "The operator admits this bounded client certificate for authenticated answer transport qualification and explicit rotation custody.",
    operatorId: "operator:transport-operations-certificate",
  });
}

function admitServer(root: string, certificateSet: CertificateSet, certificate = certificateSet.serverCertificate) {
  return admitAsoiafAnswerTransportCertificate({
    root,
    usage: "server-auth",
    principalId: "server:transport-operations:test",
    certificate: pem(certificate),
    issuerCertificate: pem(certificateSet.caCertificate),
    ...certificateTimes(certificate),
    rotationReason:
      "The operator admits this bounded server certificate for one pinned answer transport endpoint and no task authority.",
    operatorId: "operator:transport-operations-server-certificate",
  });
}

async function startServer(input: {
  root: string;
  certificateSet: CertificateSet;
  certificate?: string;
  key?: string;
}): Promise<{ server: https.Server; baseUrl: string }> {
  const server = createAsoiafAnswerTransportServer({
    root: input.root,
    certificate: pem(input.certificate ?? input.certificateSet.serverCertificate),
    privateKey: pem(input.key ?? input.certificateSet.serverKey),
    clientCertificateAuthority: pem(input.certificateSet.caCertificate),
    host: "127.0.0.1",
    port: 0,
    operatorId: "operator:transport-operations-server",
  });
  servers.push(server);
  const listening = await listenAsoiafAnswerTransportServer(server, "127.0.0.1", 0);
  return { server, baseUrl: `https://127.0.0.1:${listening.port}/` };
}

function advertise(input: {
  root: string;
  certificateSet: CertificateSet;
  serverAdmission: ReturnType<typeof admitServer>["admission"];
  baseUrl: string;
  priority?: number;
  networkScope?: "loopback" | "overlay";
}) {
  const availableFrom = input.serverAdmission.activateAt;
  return advertiseAsoiafAnswerTransportEndpoint({
    root: input.root,
    serverId: input.serverAdmission.principalId,
    baseUrl: input.baseUrl,
    networkScope: input.networkScope ?? "loopback",
    priority: input.priority ?? 10,
    serverCertificateFingerprint: input.serverAdmission.certificateFingerprint,
    acceptedClientCaCertificateFingerprint: fingerprintAsoiafAnswerTransportCertificate(
      pem(input.certificateSet.caCertificate),
    ),
    advertisedAt: input.serverAdmission.admittedAt,
    availableFrom,
    expiresAt: new Date(Date.parse(availableFrom) + 10 * 60 * 60 * 1000).toISOString(),
    operatorId: "operator:transport-operations-endpoint",
  });
}

function reviewIssueBody(
  workOrder: AsoiafAnswerWorkOrder,
): AsoiafAnswerTransportIssueBody {
  const now = Date.now();
  return {
    itemId: item(workOrder, "review-exact-locator").itemId,
    claimedAt: new Date(now).toISOString(),
    issuedAt: new Date(now + 1).toISOString(),
    leaseMilliseconds: 600_000,
  };
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await closeServer(server);
  }
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF answer transport certificate and rendezvous operations", () => {
  it("admits exact CA-verified client and server certificate lifecycles without retaining secrets", () => {
    const root = estateRoot();
    const certs = certificates(root);
    const client = admitClient({ root, certificateSet: certs, certificate: certs.reviewerCertificate });
    const clientReplay = admitClient({ root, certificateSet: certs, certificate: certs.reviewerCertificate });
    const server = admitServer(root, certs);

    expect(client.admission).toEqual(
      expect.objectContaining({
        usage: "client-auth",
        principalId: "actor:transport-operations:reviewer",
        actorRole: "exact-locator-reviewer",
        transportRegistrationId: client.transportRegistration?.registrationId,
        certificateRetained: false,
        privateKeyRetained: false,
        certificatePathRetained: false,
        privateKeyPathRetained: false,
        authority: "none",
      }),
    );
    expect(clientReplay.admission).toEqual(client.admission);
    expect(clientReplay.admissionReplayed).toBe(true);
    expect(clientReplay.transportRegistrationReplayed).toBe(true);
    expect(server.admission).toEqual(
      expect.objectContaining({
        usage: "server-auth",
        actorRole: null,
        transportRegistrationId: null,
      }),
    );
    expect(readAsoiafAnswerTransportStatus(root).registrations).toHaveLength(1);
    expect(readAsoiafAnswerTransportOperationsStatus(root).certificates).toHaveLength(2);
    expect(
      fs.readdirSync(asoiafAnswerTransportOperationsPaths(root).certificates),
    ).toEqual(expect.arrayContaining([
      `${client.admission.certificateFingerprint.slice("sha256:".length)}.json`,
      `${server.admission.certificateFingerprint.slice("sha256:".length)}.json`,
    ]));
  });

  it("requires one exact overlapping successor before scheduled client retirement", () => {
    const root = estateRoot();
    const certs = certificates(root);
    const initialTimes = certificateTimes(certs.reviewerCertificate, 0, 4 * 60 * 60 * 1000, 12 * 60 * 60 * 1000);
    const initial = admitClient({
      root,
      certificateSet: certs,
      certificate: certs.reviewerCertificate,
      times: initialTimes,
    });

    expect(() =>
      admitClient({
        root,
        certificateSet: certs,
        certificate: certs.reviewerSuccessorCertificate,
        times: certificateTimes(certs.reviewerSuccessorCertificate, 10 * 60 * 60 * 1000, 20 * 60 * 60 * 1000, 30 * 60 * 60 * 1000),
      }),
    ).toThrow(/must name its exact predecessor/);

    const successor = admitClient({
      root,
      certificateSet: certs,
      certificate: certs.reviewerSuccessorCertificate,
      times: certificateTimes(certs.reviewerSuccessorCertificate, 10 * 60 * 60 * 1000, 20 * 60 * 60 * 1000, 30 * 60 * 60 * 1000),
      predecessor: initial.admission.certificateFingerprint,
    });
    const retired = retireAsoiafAnswerTransportCertificate({
      root,
      certificateFingerprint: initial.admission.certificateFingerprint,
      retiredAt: initial.admission.retireAfter,
      kind: "scheduled",
      reason:
        "The admitted successor has completed the required overlap and now carries authenticated reviewer transport custody.",
      operatorId: "operator:transport-operations-retire",
    });
    const replay = retireAsoiafAnswerTransportCertificate({
      root,
      certificateFingerprint: initial.admission.certificateFingerprint,
      retiredAt: initial.admission.retireAfter,
      kind: "scheduled",
      reason:
        "The admitted successor has completed the required overlap and now carries authenticated reviewer transport custody.",
      operatorId: "operator:transport-operations-retire",
    });

    expect(retired.retirement.successorAdmissionId).toBe(successor.admission.admissionId);
    expect(retired.transportRevocation?.certificateFingerprint).toBe(initial.admission.certificateFingerprint);
    expect(replay.retirement).toEqual(retired.retirement);
    expect(replay.retirementReplayed).toBe(true);
    expect(replay.transportRevocationReplayed).toBe(true);
    expect(readAsoiafAnswerTransportOperationsStatus(root).retirements).toHaveLength(1);
  });

  it("refuses wrong issuers, wrong extended key usage, weak schedules, and crossed predecessor roles", () => {
    const root = estateRoot();
    const certs = certificates(root);
    const times = certificateTimes(certs.reviewerCertificate);
    expect(() =>
      admitAsoiafAnswerTransportCertificate({
        root,
        usage: "client-auth",
        principalId: "actor:transport-operations:reviewer",
        actorRole: "exact-locator-reviewer",
        certificate: pem(certs.reviewerCertificate),
        issuerCertificate: pem(certs.alternateCaCertificate),
        ...times,
        rotationReason:
          "The deliberately wrong issuer must be refused before it can create certificate or actor custody.",
        operatorId: "operator:transport-operations-invalid",
      }),
    ).toThrow(/not issued and signed/);
    expect(() =>
      admitAsoiafAnswerTransportCertificate({
        root,
        usage: "client-auth",
        principalId: "actor:transport-operations:reviewer",
        actorRole: "exact-locator-reviewer",
        certificate: pem(certs.serverCertificate),
        issuerCertificate: pem(certs.caCertificate),
        ...certificateTimes(certs.serverCertificate),
        rotationReason:
          "The server-only extended key usage must never authorize a remote answer-work actor certificate.",
        operatorId: "operator:transport-operations-invalid",
      }),
    ).toThrow(/lacks required extended key usage/);
    expect(() =>
      admitAsoiafAnswerTransportCertificate({
        root,
        usage: "server-auth",
        principalId: "server:transport-operations:test",
        certificate: pem(certs.serverCertificate),
        issuerCertificate: pem(certs.caCertificate),
        admittedAt: times.admittedAt,
        activateAt: times.activateAt,
        renewAfter: times.retireAfter,
        retireAfter: times.renewAfter,
        rotationReason:
          "The inverted renewal and retirement schedule must be refused before endpoint advertisement.",
        operatorId: "operator:transport-operations-invalid",
      }),
    ).toThrow(/retirement must follow renewal/);

    const reviewer = admitClient({ root, certificateSet: certs, certificate: certs.reviewerCertificate });
    expect(() =>
      admitClient({
        root,
        certificateSet: certs,
        certificate: certs.assemblerCertificate,
        principalId: "actor:transport-operations:assembler",
        actorRole: "answer-assembler",
        times: certificateTimes(certs.assemblerCertificate, 10 * 60 * 60 * 1000, 20 * 60 * 60 * 1000, 30 * 60 * 60 * 1000),
        predecessor: reviewer.admission.certificateFingerprint,
      }),
    ).toThrow(/different usage, principal, or role/);
  });

  it("retains bounded HTTPS endpoint leases and refuses unsafe or certificate-exceeding advertisements", () => {
    const root = estateRoot();
    const certs = certificates(root);
    const server = admitServer(root, certs);
    const first = advertise({
      root,
      certificateSet: certs,
      serverAdmission: server.admission,
      baseUrl: "https://127.0.0.1:9443/",
    });
    const replay = advertise({
      root,
      certificateSet: certs,
      serverAdmission: server.admission,
      baseUrl: "https://127.0.0.1:9443/",
    });
    expect(replay.endpoint).toEqual(first.endpoint);
    expect(replay.replayed).toBe(true);
    expect(first.endpoint).toEqual(
      expect.objectContaining({
        serverId: "server:transport-operations:test",
        networkScope: "loopback",
        priority: 10,
        certificateRetained: false,
        privateKeyRetained: false,
        authority: "none",
      }),
    );
    expect(() =>
      advertiseAsoiafAnswerTransportEndpoint({
        root,
        serverId: server.admission.principalId,
        baseUrl: "http://127.0.0.1:9443/unsafe",
        networkScope: "loopback",
        priority: 10,
        serverCertificateFingerprint: server.admission.certificateFingerprint,
        acceptedClientCaCertificateFingerprint: fingerprintAsoiafAnswerTransportCertificate(pem(certs.caCertificate)),
        advertisedAt: server.admission.admittedAt,
        availableFrom: server.admission.activateAt,
        expiresAt: server.admission.retireAfter,
        operatorId: "operator:transport-operations-invalid-endpoint",
      }),
    ).toThrow(/must use HTTPS/);
    expect(() =>
      advertiseAsoiafAnswerTransportEndpoint({
        root,
        serverId: server.admission.principalId,
        baseUrl: "https://127.0.0.1:9443/",
        networkScope: "loopback",
        priority: 10,
        serverCertificateFingerprint: server.admission.certificateFingerprint,
        acceptedClientCaCertificateFingerprint: fingerprintAsoiafAnswerTransportCertificate(pem(certs.caCertificate)),
        advertisedAt: server.admission.admittedAt,
        availableFrom: server.admission.activateAt,
        expiresAt: new Date(Date.parse(server.admission.retireAfter) + 1).toISOString(),
        operatorId: "operator:transport-operations-invalid-endpoint",
      }),
    ).toThrow(/outside the admitted server certificate interval/);
  });

  it("records real pinned mutual-TLS availability, certificate mismatch, and unreachable outcomes without retaining keys", async () => {
    const root = estateRoot();
    const certs = certificates(root);
    const client = admitClient({ root, certificateSet: certs, certificate: certs.reviewerCertificate });
    const serverAdmission = admitServer(root, certs);
    const live = await startServer({ root, certificateSet: certs });
    const endpoint = advertise({
      root,
      certificateSet: certs,
      serverAdmission: serverAdmission.admission,
      baseUrl: live.baseUrl,
    });
    const available = await probeAsoiafAnswerTransportEndpoint({
      root,
      endpointLeaseId: endpoint.endpoint.endpointLeaseId,
      clientCertificate: pem(certs.reviewerCertificate),
      clientPrivateKey: pem(certs.reviewerKey),
      serverCertificateAuthority: pem(certs.caCertificate),
      observedAt: new Date().toISOString(),
      timeoutMilliseconds: 5_000,
    });
    expect(available.observation).toEqual(
      expect.objectContaining({
        outcome: "available",
        clientCertificateFingerprint: client.admission.certificateFingerprint,
        expectedServerCertificateFingerprint: serverAdmission.admission.certificateFingerprint,
        observedServerCertificateFingerprint: serverAdmission.admission.certificateFingerprint,
        certificateRetained: false,
        privateKeyRetained: false,
      }),
    );

    const mismatchRoot = estateRoot();
    const mismatchCerts = certificates(mismatchRoot);
    admitClient({ root: mismatchRoot, certificateSet: mismatchCerts, certificate: mismatchCerts.reviewerCertificate });
    const expectedServer = admitServer(mismatchRoot, mismatchCerts);
    const mismatchLive = await startServer({
      root: mismatchRoot,
      certificateSet: mismatchCerts,
      certificate: mismatchCerts.alternateServerCertificate,
      key: mismatchCerts.alternateServerKey,
    });
    const mismatchEndpoint = advertise({
      root: mismatchRoot,
      certificateSet: mismatchCerts,
      serverAdmission: expectedServer.admission,
      baseUrl: mismatchLive.baseUrl,
    });
    const mismatch = await probeAsoiafAnswerTransportEndpoint({
      root: mismatchRoot,
      endpointLeaseId: mismatchEndpoint.endpoint.endpointLeaseId,
      clientCertificate: pem(mismatchCerts.reviewerCertificate),
      clientPrivateKey: pem(mismatchCerts.reviewerKey),
      serverCertificateAuthority: pem(mismatchCerts.caCertificate),
      observedAt: new Date().toISOString(),
      timeoutMilliseconds: 5_000,
    });
    expect(mismatch.observation.outcome).toBe("server-certificate-mismatch");
    expect(mismatch.observation.observedServerCertificateFingerprint).not.toBe(
      mismatch.observation.expectedServerCertificateFingerprint,
    );

    const unreachable = advertise({
      root,
      certificateSet: certs,
      serverAdmission: serverAdmission.admission,
      baseUrl: "https://127.0.0.1:1/",
      priority: 20,
    });
    const unreachableObservation = await probeAsoiafAnswerTransportEndpoint({
      root,
      endpointLeaseId: unreachable.endpoint.endpointLeaseId,
      clientCertificate: pem(certs.reviewerCertificate),
      clientPrivateKey: pem(certs.reviewerKey),
      serverCertificateAuthority: pem(certs.caCertificate),
      observedAt: new Date().toISOString(),
      timeoutMilliseconds: 500,
    });
    expect(unreachableObservation.observation.outcome).toBe("unreachable");

    await expect(
      probeAsoiafAnswerTransportEndpoint({
        root,
        endpointLeaseId: endpoint.endpoint.endpointLeaseId,
        clientCertificate: pem(certs.reviewerCertificate),
        clientPrivateKey: pem(certs.assemblerKey),
        serverCertificateAuthority: pem(certs.caCertificate),
        observedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/private key does not match/);
    expect(
      fs.readdirSync(asoiafAnswerTransportOperationsPaths(root).availability),
    ).toHaveLength(2);
  }, 30_000);

  it("builds deterministic client-specific rendezvous from fresh successful observations without automatic failover", async () => {
    const root = estateRoot();
    const certs = certificates(root);
    const client = admitClient({ root, certificateSet: certs, certificate: certs.reviewerCertificate });
    const serverAdmission = admitServer(root, certs);
    const live = await startServer({ root, certificateSet: certs });
    const availableEndpoint = advertise({
      root,
      certificateSet: certs,
      serverAdmission: serverAdmission.admission,
      baseUrl: live.baseUrl,
      priority: 50,
    });
    const unavailableEndpoint = advertise({
      root,
      certificateSet: certs,
      serverAdmission: serverAdmission.admission,
      baseUrl: "https://127.0.0.1:1/",
      priority: 1,
    });
    await probeAsoiafAnswerTransportEndpoint({
      root,
      endpointLeaseId: availableEndpoint.endpoint.endpointLeaseId,
      clientCertificate: pem(certs.reviewerCertificate),
      clientPrivateKey: pem(certs.reviewerKey),
      serverCertificateAuthority: pem(certs.caCertificate),
      observedAt: new Date().toISOString(),
      timeoutMilliseconds: 5_000,
    });
    await probeAsoiafAnswerTransportEndpoint({
      root,
      endpointLeaseId: unavailableEndpoint.endpoint.endpointLeaseId,
      clientCertificate: pem(certs.reviewerCertificate),
      clientPrivateKey: pem(certs.reviewerKey),
      serverCertificateAuthority: pem(certs.caCertificate),
      observedAt: new Date().toISOString(),
      timeoutMilliseconds: 500,
    });
    const generatedAt = new Date().toISOString();
    const first = retainAsoiafAnswerTransportRendezvous({
      root,
      serverId: serverAdmission.admission.principalId,
      clientCertificateFingerprint: client.admission.certificateFingerprint,
      generatedAt,
      maxObservationAgeMilliseconds: 60_000,
      operatorId: "operator:transport-operations-rendezvous",
    });
    const replay = retainAsoiafAnswerTransportRendezvous({
      root,
      serverId: serverAdmission.admission.principalId,
      clientCertificateFingerprint: client.admission.certificateFingerprint,
      generatedAt,
      maxObservationAgeMilliseconds: 60_000,
      operatorId: "operator:transport-operations-rendezvous",
    });
    expect(first.rendezvous.selectedEndpointLeaseId).toBe(availableEndpoint.endpoint.endpointLeaseId);
    expect(first.rendezvous.automaticFailover).toBe(false);
    expect(first.rendezvous.entries.find((entry) => entry.endpointLeaseId === unavailableEndpoint.endpoint.endpointLeaseId)).toEqual(
      expect.objectContaining({ eligible: false, exclusionReason: "availability-unreachable" }),
    );
    expect(replay.rendezvous).toEqual(first.rendezvous);
    expect(replay.replayed).toBe(true);

    const stale = buildAsoiafAnswerTransportRendezvous({
      root,
      serverId: serverAdmission.admission.principalId,
      clientCertificateFingerprint: client.admission.certificateFingerprint,
      generatedAt: new Date(Date.parse(generatedAt) + 120_000).toISOString(),
      maxObservationAgeMilliseconds: 60_000,
      operatorId: "operator:transport-operations-rendezvous",
    });
    expect(stale.selectedEndpointLeaseId).toBeNull();
    expect(stale.entries.every((entry) => !entry.eligible)).toBe(true);
  }, 30_000);

  it("dispatches through the pinned rendezvous and replays locally without another network transaction", async () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const certs = certificates(root);
    const client = admitClient({ root, certificateSet: certs, certificate: certs.reviewerCertificate });
    const serverAdmission = admitServer(root, certs);
    const live = await startServer({ root, certificateSet: certs });
    const endpoint = advertise({
      root,
      certificateSet: certs,
      serverAdmission: serverAdmission.admission,
      baseUrl: live.baseUrl,
    });
    await probeAsoiafAnswerTransportEndpoint({
      root,
      endpointLeaseId: endpoint.endpoint.endpointLeaseId,
      clientCertificate: pem(certs.reviewerCertificate),
      clientPrivateKey: pem(certs.reviewerKey),
      serverCertificateAuthority: pem(certs.caCertificate),
      observedAt: new Date().toISOString(),
    });
    const rendezvous = retainAsoiafAnswerTransportRendezvous({
      root,
      serverId: serverAdmission.admission.principalId,
      clientCertificateFingerprint: client.admission.certificateFingerprint,
      generatedAt: new Date().toISOString(),
      maxObservationAgeMilliseconds: 60_000,
      operatorId: "operator:transport-operations-rendezvous",
    }).rendezvous;
    const body = reviewIssueBody(fixture.openWorkOrder);
    const dispatchedAt = new Date().toISOString();
    const first = await dispatchAsoiafAnswerTransport({
      root,
      rendezvous,
      operation: "issue-assignment",
      body,
      idempotencyKey: "transport-operations-dispatch-review-0001",
      clientCertificate: pem(certs.reviewerCertificate),
      clientPrivateKey: pem(certs.reviewerKey),
      serverCertificateAuthority: pem(certs.caCertificate),
      dispatchedAt,
    });
    await closeServer(live.server);
    const replay = await dispatchAsoiafAnswerTransport({
      root,
      rendezvous,
      operation: "issue-assignment",
      body,
      idempotencyKey: "transport-operations-dispatch-review-0001",
      clientCertificate: pem(certs.reviewerCertificate),
      clientPrivateKey: pem(certs.reviewerKey),
      serverCertificateAuthority: pem(certs.caCertificate),
      dispatchedAt,
    });

    expect(first.receipt).toEqual(
      expect.objectContaining({
        operation: "issue-assignment",
        endpointLeaseId: endpoint.endpoint.endpointLeaseId,
        clientCertificateFingerprint: client.admission.certificateFingerprint,
        statusCode: 200,
        certificateRetained: false,
        privateKeyRetained: false,
        authority: "none",
      }),
    );
    expect(first.networkAttempted).toBe(true);
    expect(replay.receipt).toEqual(first.receipt);
    expect(replay.replayed).toBe(true);
    expect(replay.networkAttempted).toBe(false);
    expect(readAsoiafAnswerTransportStatus(root).requests).toHaveLength(1);
    expect(readAsoiafAnswerTransportOperationsStatus(root).dispatches).toHaveLength(1);
    expect(readAsoiafAnswerDeskStatus(root).leases).toHaveLength(1);
    expect(readAsoiafAnswerExchangeStatus(root).assignments).toHaveLength(1);
    await expect(
      dispatchAsoiafAnswerTransport({
        root,
        rendezvous,
        operation: "issue-assignment",
        body: { ...body, leaseMilliseconds: 300_000 },
        idempotencyKey: "transport-operations-dispatch-review-0001",
        clientCertificate: pem(certs.reviewerCertificate),
        clientPrivateKey: pem(certs.reviewerKey),
        serverCertificateAuthority: pem(certs.caCertificate),
        dispatchedAt,
      }),
    ).rejects.toThrow(/already bound to a different actor, rendezvous, operation, or body/);
  }, 30_000);

  it("moves authenticated actor custody to the admitted successor and refuses the retired certificate", () => {
    const root = estateRoot();
    const fixture = adoptOpen(root);
    const certs = certificates(root);
    const initialTimes = certificateTimes(certs.reviewerCertificate, 0, 4 * 60 * 60 * 1000, 12 * 60 * 60 * 1000);
    const initial = admitClient({
      root,
      certificateSet: certs,
      certificate: certs.reviewerCertificate,
      times: initialTimes,
    });
    const successor = admitClient({
      root,
      certificateSet: certs,
      certificate: certs.reviewerSuccessorCertificate,
      times: certificateTimes(certs.reviewerSuccessorCertificate, 10 * 60 * 60 * 1000, 20 * 60 * 60 * 1000, 30 * 60 * 60 * 1000),
      predecessor: initial.admission.certificateFingerprint,
    });
    retireAsoiafAnswerTransportCertificate({
      root,
      certificateFingerprint: initial.admission.certificateFingerprint,
      retiredAt: initial.admission.retireAfter,
      kind: "scheduled",
      reason:
        "The admitted successor is active after the bounded overlap, so the predecessor must no longer authenticate transport requests.",
      operatorId: "operator:transport-operations-retire",
    });
    const body = reviewIssueBody(fixture.openWorkOrder);
    expect(() =>
      processAsoiafAnswerTransportRequest({
        root,
        certificateFingerprint: initial.admission.certificateFingerprint,
        route: ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
        idempotencyKey: "transport-operations-retired-reviewer-0001",
        body,
        receivedAt: new Date(Date.parse(initial.admission.retireAfter) + 1_000).toISOString(),
      }),
    ).toThrow(/revoked/);
    const successorReceivedAt = new Date(
      Date.parse(initial.admission.retireAfter) + 1_000,
    ).toISOString();
    const accepted = processAsoiafAnswerTransportRequest({
      root,
      certificateFingerprint: successor.admission.certificateFingerprint,
      route: ASOIAF_ANSWER_TRANSPORT_ISSUE_ROUTE,
      idempotencyKey: "transport-operations-successor-reviewer-0001",
      body,
      receivedAt: successorReceivedAt,
      completedAt: new Date(Date.parse(successorReceivedAt) + 1).toISOString(),
    });
    expect(accepted.response.outcome).toBe("succeeded");
    expect(accepted.request.actorRegistrationId).toBe(successor.transportRegistration?.registrationId);
  });

  it("reconstructs complete custody and detects changed bytes or secret-bearing operations files", async () => {
    const root = estateRoot();
    adoptOpen(root);
    const certs = certificates(root);
    const client = admitClient({ root, certificateSet: certs, certificate: certs.reviewerCertificate });
    const serverAdmission = admitServer(root, certs);
    const live = await startServer({ root, certificateSet: certs });
    const endpoint = advertise({
      root,
      certificateSet: certs,
      serverAdmission: serverAdmission.admission,
      baseUrl: live.baseUrl,
    });
    await probeAsoiafAnswerTransportEndpoint({
      root,
      endpointLeaseId: endpoint.endpoint.endpointLeaseId,
      clientCertificate: pem(certs.reviewerCertificate),
      clientPrivateKey: pem(certs.reviewerKey),
      serverCertificateAuthority: pem(certs.caCertificate),
      observedAt: new Date().toISOString(),
    });
    retainAsoiafAnswerTransportRendezvous({
      root,
      serverId: serverAdmission.admission.principalId,
      clientCertificateFingerprint: client.admission.certificateFingerprint,
      generatedAt: new Date().toISOString(),
      maxObservationAgeMilliseconds: 60_000,
      operatorId: "operator:transport-operations-rendezvous",
    });
    expect(
      verifyAsoiafAnswerTransportOperationsEstate(root).filter((entry) => entry.severity === "error"),
    ).toEqual([]);

    const admissionPath = path.join(
      asoiafAnswerTransportOperationsPaths(root).certificates,
      `${client.admission.certificateFingerprint.slice("sha256:".length)}.json`,
    );
    const changed = JSON.parse(fs.readFileSync(admissionPath, "utf8")) as Record<string, unknown>;
    changed.principalId = "actor:transport-operations:changed";
    fs.writeFileSync(admissionPath, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    expect(
      verifyAsoiafAnswerTransportOperationsEstate(root).some(
        (entry) => entry.severity === "error" && entry.code.includes("certificate"),
      ),
    ).toBe(true);

    fs.writeFileSync(
      path.join(asoiafAnswerTransportOperationsPaths(root).operationsRoot, "forbidden.pem"),
      "-----BEGIN PRIVATE KEY-----\nforbidden\n-----END PRIVATE KEY-----\n",
      "utf8",
    );
    expect(
      verifyAsoiafAnswerTransportOperationsEstate(root).some(
        (entry) => entry.code === "operations-secret-file" || entry.code === "operations-secret-payload",
      ),
    ).toBe(true);
  }, 30_000);
});
