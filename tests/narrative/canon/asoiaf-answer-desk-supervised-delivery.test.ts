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
} from "../../../tools/lib/asoiaf-answer-desk-estate.js";
import {
  buildAsoiafAnswerSupervisorPolicy,
  prepareAsoiafAnswerSupervisorIntent,
  type AsoiafAnswerSupervisorTickInput,
} from "../../../tools/lib/asoiaf-answer-desk-supervisor.js";
import {
  fingerprintAsoiafAnswerTransportCertificate,
  readAsoiafAnswerTransportStatus,
} from "../../../tools/lib/asoiaf-answer-desk-transport.js";
import {
  admitAsoiafAnswerTransportCertificate,
  advertiseAsoiafAnswerTransportEndpoint,
  probeAsoiafAnswerTransportEndpoint,
  readAsoiafAnswerTransportOperationsStatus,
  retainAsoiafAnswerTransportRendezvous,
  retireAsoiafAnswerTransportCertificate,
  type AsoiafAnswerTransportCertificateAdmission,
} from "../../../tools/lib/asoiaf-answer-desk-transport-operations.js";
import {
  ASOIAF_ANSWER_SUPERVISED_PULL_ROUTE,
  ASOIAF_ANSWER_SUPERVISED_RETURN_ROUTE,
  AsoiafAnswerSupervisedDeliveryRequestError,
  asoiafAnswerSupervisedDeliveryPaths,
  createAsoiafAnswerSupervisedDeliveryServer,
  listenAsoiafAnswerSupervisedDeliveryServer,
  processAsoiafAnswerSupervisedDeliveryRequest,
  readAsoiafAnswerSupervisedDeliveryStatus,
  requestAsoiafAnswerSupervisedDelivery,
  verifyAsoiafAnswerSupervisedDeliveryEstate,
  type AsoiafAnswerSupervisedAssignmentDelivery,
  type AsoiafAnswerSupervisedReturnBody,
} from "../../../tools/lib/asoiaf-answer-desk-supervised-delivery.js";
import type {
  AsoiafAnswerWorkAction,
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

interface Environment {
  root: string;
  fixture: ReturnType<typeof buildAsoiafAnswerDeskFixture>;
  certs: CertificateSet;
  server: https.Server;
  port: number;
  baseUrl: string;
  policy: ReturnType<typeof buildAsoiafAnswerSupervisorPolicy>;
  reviewPrepare: AsoiafAnswerSupervisorTickInput;
  reviewIntentId: string;
  reviewRendezvousId: string;
  assemblerRendezvousId: string;
  reviewerAdmission: AsoiafAnswerTransportCertificateAdmission;
  serverAdmission: AsoiafAnswerTransportCertificateAdmission;
}

const roots: string[] = [];
const servers: https.Server[] = [];

function at(base: number, offset: number): string {
  return new Date(base + offset).toISOString();
}

function itemId(workOrder: AsoiafAnswerWorkOrder, action: AsoiafAnswerWorkAction): string {
  const item = workOrder.items.find((entry) => entry.action === action);
  if (!item) throw new Error(`work order lacks ${action}`);
  return item.itemId;
}

function estateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-supervised-delivery-test-"));
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
    "-subj", "/CN=ASOIAF supervised delivery test CA",
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

function createCertificates(directory: string): CertificateSet {
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
    commonName: "exact locator reviewer",
    usage: "clientAuth",
    caCertificate: ca.certificate,
    caKey: ca.key,
    serial: 201,
  });
  const assembler = createLeaf({
    directory,
    prefix: "assembler",
    commonName: "answer assembler",
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

function certificateTimes(certificatePath: string) {
  const certificate = new crypto.X509Certificate(pem(certificatePath));
  const base = certificate.validFromDate.getTime();
  return {
    admittedAt: new Date(base).toISOString(),
    activateAt: new Date(base).toISOString(),
    renewAfter: new Date(base + 6 * 60 * 60 * 1000).toISOString(),
    retireAfter: new Date(base + 20 * 60 * 60 * 1000).toISOString(),
  };
}

async function closeServer(server: https.Server): Promise<void> {
  const closed = server.listening
    ? new Promise<void>((resolve) => server.close(() => resolve()))
    : Promise.resolve();
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await closed;
}

async function buildEnvironment(): Promise<Environment> {
  const root = estateRoot();
  const base = Date.now();
  const fixture = buildAsoiafAnswerDeskFixture();
  const policy = buildAsoiafAnswerSupervisorPolicy({
    createdBy: "test:supervised-delivery-policy",
    createdAt: at(base, -120_000),
    automaticWorkerEnabled: true,
    automaticLeaseMilliseconds: 60_000,
    actorBindings: [
      {
        actorRole: "exact-locator-reviewer",
        actorId: "actor:test:supervised-delivery:reviewer",
        capacity: 1,
        leaseMilliseconds: 600_000,
        priority: 10,
      },
      {
        actorRole: "answer-assembler",
        actorId: "actor:test:supervised-delivery:assembler",
        capacity: 1,
        leaseMilliseconds: 600_000,
        priority: 20,
      },
    ],
  });
  adoptAsoiafAnswerDeskWorkOrder({
    root,
    workOrder: fixture.openWorkOrder,
    adoptedAt: at(base, -119_000),
    operatorId: "test:supervised-delivery-adopt",
  });
  const reviewPrepare: AsoiafAnswerSupervisorTickInput = {
    root,
    requestKey: "test-supervised-review-intent",
    policy,
    requestedAt: at(base, -100_000),
    automaticCompletedAt: null,
    operatorId: "test:supervised-delivery-supervisor",
  };
  const reviewPrepared = prepareAsoiafAnswerSupervisorIntent(reviewPrepare);
  const certDirectory = path.join(root, "ephemeral-certificates");
  const certs = createCertificates(certDirectory);
  const serverAdmission = admitAsoiafAnswerTransportCertificate({
    root,
    usage: "server-auth",
    principalId: "server:test:answer-supervised-delivery",
    certificate: pem(certs.serverCertificate),
    issuerCertificate: pem(certs.caCertificate),
    ...certificateTimes(certs.serverCertificate),
    rotationReason:
      "The test operator admits one bounded server certificate for supervised delivery and no task authority.",
    operatorId: "test:supervised-delivery-admit-server",
  }).admission;
  const reviewerAdmission = admitAsoiafAnswerTransportCertificate({
    root,
    usage: "client-auth",
    principalId: "actor:test:supervised-delivery:reviewer",
    actorRole: "exact-locator-reviewer",
    certificate: pem(certs.reviewerCertificate),
    issuerCertificate: pem(certs.caCertificate),
    ...certificateTimes(certs.reviewerCertificate),
    rotationReason:
      "The test operator admits the reviewer certificate for one exact prepared supervisor assignment.",
    operatorId: "test:supervised-delivery-admit-reviewer",
  }).admission;
  const assemblerAdmission = admitAsoiafAnswerTransportCertificate({
    root,
    usage: "client-auth",
    principalId: "actor:test:supervised-delivery:assembler",
    actorRole: "answer-assembler",
    certificate: pem(certs.assemblerCertificate),
    issuerCertificate: pem(certs.caCertificate),
    ...certificateTimes(certs.assemblerCertificate),
    rotationReason:
      "The test operator admits the answer assembler certificate for one distinct prepared assignment.",
    operatorId: "test:supervised-delivery-admit-assembler",
  }).admission;
  const server = createAsoiafAnswerSupervisedDeliveryServer({
    root,
    certificate: pem(certs.serverCertificate),
    privateKey: pem(certs.serverKey),
    clientCertificateAuthority: pem(certs.caCertificate),
    operatorId: "test:supervised-delivery-server",
  });
  servers.push(server);
  const listening = await listenAsoiafAnswerSupervisedDeliveryServer(
    server,
    "127.0.0.1",
    0,
  );
  const baseUrl = `https://127.0.0.1:${listening.port}/`;
  const endpoint = advertiseAsoiafAnswerTransportEndpoint({
    root,
    serverId: serverAdmission.principalId,
    baseUrl,
    networkScope: "loopback",
    priority: 10,
    serverCertificateFingerprint: serverAdmission.certificateFingerprint,
    acceptedClientCaCertificateFingerprint:
      fingerprintAsoiafAnswerTransportCertificate(pem(certs.caCertificate)),
    advertisedAt: serverAdmission.admittedAt,
    availableFrom: serverAdmission.activateAt,
    expiresAt: new Date(
      Date.parse(serverAdmission.activateAt) + 8 * 60 * 60 * 1000,
    ).toISOString(),
    operatorId: "test:supervised-delivery-advertise",
  });
  const observedAt = new Date(Math.max(
    Date.now(),
    Date.parse(serverAdmission.activateAt),
    Date.parse(reviewerAdmission.activateAt),
    Date.parse(assemblerAdmission.activateAt),
  )).toISOString();
  const reviewerObservation = await probeAsoiafAnswerTransportEndpoint({
    root,
    endpointLeaseId: endpoint.endpoint.endpointLeaseId,
    clientCertificate: pem(certs.reviewerCertificate),
    clientPrivateKey: pem(certs.reviewerKey),
    serverCertificateAuthority: pem(certs.caCertificate),
    observedAt,
    timeoutMilliseconds: 10_000,
  });
  const assemblerObservation = await probeAsoiafAnswerTransportEndpoint({
    root,
    endpointLeaseId: endpoint.endpoint.endpointLeaseId,
    clientCertificate: pem(certs.assemblerCertificate),
    clientPrivateKey: pem(certs.assemblerKey),
    serverCertificateAuthority: pem(certs.caCertificate),
    observedAt: new Date().toISOString(),
    timeoutMilliseconds: 10_000,
  });
  const reviewerRendezvous = retainAsoiafAnswerTransportRendezvous({
    root,
    serverId: serverAdmission.principalId,
    clientCertificateFingerprint: reviewerAdmission.certificateFingerprint,
    generatedAt: reviewerObservation.observation.completedAt,
    maxObservationAgeMilliseconds: 300_000,
    operatorId: "test:supervised-delivery-resolve-reviewer",
  }).rendezvous;
  const assemblerRendezvous = retainAsoiafAnswerTransportRendezvous({
    root,
    serverId: serverAdmission.principalId,
    clientCertificateFingerprint: assemblerAdmission.certificateFingerprint,
    generatedAt: assemblerObservation.observation.completedAt,
    maxObservationAgeMilliseconds: 300_000,
    operatorId: "test:supervised-delivery-resolve-assembler",
  }).rendezvous;
  return {
    root,
    fixture,
    certs,
    server,
    port: listening.port,
    baseUrl,
    policy,
    reviewPrepare,
    reviewIntentId: reviewPrepared.intent.intentId,
    reviewRendezvousId: reviewerRendezvous.rendezvousId,
    assemblerRendezvousId: assemblerRendezvous.rendezvousId,
    reviewerAdmission,
    serverAdmission,
  };
}

function reviewerClient(environment: Environment, input: {
  operation: "pull-assignment" | "return-result";
  key: string;
  body: unknown;
}) {
  return requestAsoiafAnswerSupervisedDelivery({
    baseUrl: environment.baseUrl,
    operation: input.operation,
    idempotencyKey: input.key,
    body: input.body,
    certificate: pem(environment.certs.reviewerCertificate),
    privateKey: pem(environment.certs.reviewerKey),
    certificateAuthority: pem(environment.certs.caCertificate),
  });
}

function assemblerClient(environment: Environment, input: {
  operation: "pull-assignment" | "return-result";
  key: string;
  body: unknown;
}) {
  return requestAsoiafAnswerSupervisedDelivery({
    baseUrl: environment.baseUrl,
    operation: input.operation,
    idempotencyKey: input.key,
    body: input.body,
    certificate: pem(environment.certs.assemblerCertificate),
    privateKey: pem(environment.certs.assemblerKey),
    certificateAuthority: pem(environment.certs.caCertificate),
  });
}

function reviewReturnBody(
  environment: Environment,
  delivery: AsoiafAnswerSupervisedAssignmentDelivery,
): AsoiafAnswerSupervisedReturnBody {
  return {
    deliveryId: delivery.deliveryId,
    rendezvousId: environment.reviewRendezvousId,
    completedAt: new Date(
      Date.parse(environment.reviewPrepare.requestedAt) + 500,
    ).toISOString(),
    outcome: "satisfied",
    afterWorkOrder: environment.fixture.reconciledWorkOrder,
    resultReferences: [
      {
        kind: "reviewed-answer-transaction",
        objectId: environment.fixture.transaction.transactionId,
        fingerprint: environment.fixture.transaction.transactionFingerprint,
        uri: null,
      },
    ],
    reason:
      "The certificate-bound reviewer returns the exact reviewed transaction for the retained supervised assignment.",
  };
}

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) await closeServer(server);
  }
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ASOIAF supervised answer-desk delivery", () => {
  it("exposes four portable append-only custody collections", () => {
    const root = path.resolve("holder-estate");
    expect(asoiafAnswerSupervisedDeliveryPaths(root)).toEqual({
      root,
      deliveryRoot: path.join(root, "answer-supervised-delivery"),
      requests: path.join(root, "answer-supervised-delivery", "requests"),
      responses: path.join(root, "answer-supervised-delivery", "responses"),
      deliveries: path.join(root, "answer-supervised-delivery", "deliveries"),
      returns: path.join(root, "answer-supervised-delivery", "returns"),
    });
  });

  it("refuses actor and work selectors before request custody", () => {
    const root = estateRoot();
    expect(() => processAsoiafAnswerSupervisedDeliveryRequest({
      root,
      certificateFingerprint: `sha256:${"1".repeat(64)}`,
      route: ASOIAF_ANSWER_SUPERVISED_PULL_ROUTE,
      idempotencyKey: "test-forbidden-selector-0001",
      body: {
        intentId: "asoiaf-answer-supervisor-intent:test",
        rendezvousId: "asoiaf-answer-transport-rendezvous:test",
        actorId: "actor:forbidden",
      },
    })).toThrow(AsoiafAnswerSupervisedDeliveryRequestError);
    expect(readAsoiafAnswerSupervisedDeliveryStatus(root).requests).toEqual([]);
  });

  it("refuses malformed typed returns before authentication or mutation", () => {
    const root = estateRoot();
    expect(() => processAsoiafAnswerSupervisedDeliveryRequest({
      root,
      certificateFingerprint: `sha256:${"2".repeat(64)}`,
      route: ASOIAF_ANSWER_SUPERVISED_RETURN_ROUTE,
      idempotencyKey: "test-malformed-return-0001",
      body: {
        deliveryId: "asoiaf-answer-supervised-delivery:test",
        rendezvousId: "asoiaf-answer-transport-rendezvous:test",
        completedAt: new Date().toISOString(),
        outcome: "satisfied",
        afterWorkOrder: null,
        reason: "This body deliberately omits the exact typed result reference array.",
      },
    })).toThrow(/missing, unknown, or forbidden fields/);
    expect(readAsoiafAnswerSupervisedDeliveryStatus(root).requests).toEqual([]);
  });

  it("requires a bounded visible idempotency key", () => {
    expect(() => processAsoiafAnswerSupervisedDeliveryRequest({
      root: estateRoot(),
      certificateFingerprint: `sha256:${"3".repeat(64)}`,
      route: ASOIAF_ANSWER_SUPERVISED_PULL_ROUTE,
      idempotencyKey: "short",
      body: {
        intentId: "asoiaf-answer-supervisor-intent:test",
        rendezvousId: "asoiaf-answer-transport-rendezvous:test",
      },
    })).toThrow(/16 through 256/);
  });

  it("refuses unsupported methods and routes before actor custody", () => {
    const root = estateRoot();
    expect(() => processAsoiafAnswerSupervisedDeliveryRequest({
      root,
      certificateFingerprint: `sha256:${"4".repeat(64)}`,
      method: "GET",
      route: ASOIAF_ANSWER_SUPERVISED_PULL_ROUTE,
      idempotencyKey: "test-method-refusal-0001",
      body: {},
    })).toThrow(/only POST/);
    expect(() => processAsoiafAnswerSupervisedDeliveryRequest({
      root,
      certificateFingerprint: `sha256:${"4".repeat(64)}`,
      method: "POST",
      route: "/v1/supervisor/arbitrary",
      idempotencyKey: "test-route-refusal-0001",
      body: {},
    })).toThrow(/not supported/);
  });

  it("pulls and exactly replays only the assignment selected by the prepared intent", async () => {
    const environment = await buildEnvironment();
    const body = {
      intentId: environment.reviewIntentId,
      rendezvousId: environment.reviewRendezvousId,
    };
    const first = await reviewerClient(environment, {
      operation: "pull-assignment",
      key: "test-review-pull-replay-0001",
      body,
    });
    const replay = await reviewerClient(environment, {
      operation: "pull-assignment",
      key: "test-review-pull-replay-0001",
      body,
    });
    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.envelope.response).toEqual(first.envelope.response);
    expect(first.envelope.response?.payload?.kind).toBe("assignment-delivery");
    const payload = first.envelope.response?.payload;
    if (!payload || payload.kind !== "assignment-delivery") throw new Error("delivery missing");
    expect(payload.assignment.itemId).toBe(
      itemId(environment.fixture.openWorkOrder, "review-exact-locator"),
    );
    expect(payload.delivery.actorId).toBe("actor:test:supervised-delivery:reviewer");
    expect(payload.delivery.sourceTextIncluded).toBe(false);
    expect(readAsoiafAnswerTransportStatus(environment.root).requests).toHaveLength(1);
  });

  it("retains a wrong-actor refusal and rejects cross-actor idempotency reuse", async () => {
    const environment = await buildEnvironment();
    const wrong = await assemblerClient(environment, {
      operation: "pull-assignment",
      key: "test-wrong-actor-pull-0001",
      body: {
        intentId: environment.reviewIntentId,
        rendezvousId: environment.assemblerRendezvousId,
      },
    });
    expect(wrong.statusCode).toBe(409);
    expect(wrong.envelope.error?.code).toBe("intent-actor-mismatch");
    const conflict = await reviewerClient(environment, {
      operation: "pull-assignment",
      key: "test-wrong-actor-pull-0001",
      body: {
        intentId: environment.reviewIntentId,
        rendezvousId: environment.reviewRendezvousId,
      },
    });
    expect(conflict.statusCode).toBe(400);
    expect(conflict.envelope.error?.code).toBe("idempotency-key-conflict");
    const status = readAsoiafAnswerSupervisedDeliveryStatus(environment.root);
    expect(status.requests).toHaveLength(1);
    expect(status.responses).toHaveLength(1);
    expect(status.deliveries).toHaveLength(0);
  });

  it("binds result return to the exact delivery owner and permanent settlement", async () => {
    const environment = await buildEnvironment();
    const pulled = await reviewerClient(environment, {
      operation: "pull-assignment",
      key: "test-result-owner-pull-0001",
      body: {
        intentId: environment.reviewIntentId,
        rendezvousId: environment.reviewRendezvousId,
      },
    });
    const payload = pulled.envelope.response?.payload;
    if (!payload || payload.kind !== "assignment-delivery") throw new Error("delivery missing");
    const returnBody = reviewReturnBody(environment, payload.delivery);
    const wrong = await assemblerClient(environment, {
      operation: "return-result",
      key: "test-result-wrong-owner-0001",
      body: { ...returnBody, rendezvousId: environment.assemblerRendezvousId },
    });
    expect(wrong.statusCode).toBe(409);
    expect(wrong.envelope.error?.code).toBe("delivery-owner-mismatch");
    const returned = await reviewerClient(environment, {
      operation: "return-result",
      key: "test-result-owner-return-0001",
      body: returnBody,
    });
    const replay = await reviewerClient(environment, {
      operation: "return-result",
      key: "test-result-owner-return-0001",
      body: returnBody,
    });
    expect(returned.statusCode).toBe(200);
    expect(replay.envelope.response).toEqual(returned.envelope.response);
    expect(returned.envelope.response?.payload?.kind).toBe("result-return");
    const status = readAsoiafAnswerSupervisedDeliveryStatus(environment.root);
    expect(status.returns).toHaveLength(1);
    expect(readAsoiafAnswerTransportStatus(environment.root).requests).toHaveLength(2);
    expect(verifyAsoiafAnswerSupervisedDeliveryEstate(environment.root).filter(
      (entry) => entry.severity === "error",
    )).toEqual([]);
  });

  it("replays after process restart, refuses a retired certificate, and detects custody tampering", async () => {
    const environment = await buildEnvironment();
    const body = {
      intentId: environment.reviewIntentId,
      rendezvousId: environment.reviewRendezvousId,
    };
    const pulled = await reviewerClient(environment, {
      operation: "pull-assignment",
      key: "test-restart-pull-0001",
      body,
    });
    expect(pulled.statusCode).toBe(200);
    await closeServer(environment.server);
    servers.splice(servers.indexOf(environment.server), 1);
    const restarted = createAsoiafAnswerSupervisedDeliveryServer({
      root: environment.root,
      certificate: pem(environment.certs.serverCertificate),
      privateKey: pem(environment.certs.serverKey),
      clientCertificateAuthority: pem(environment.certs.caCertificate),
    });
    servers.push(restarted);
    await listenAsoiafAnswerSupervisedDeliveryServer(
      restarted,
      "127.0.0.1",
      environment.port,
    );
    environment.server = restarted;
    const replay = await reviewerClient(environment, {
      operation: "pull-assignment",
      key: "test-restart-pull-0001",
      body,
    });
    expect(replay.envelope.response).toEqual(pulled.envelope.response);
    retireAsoiafAnswerTransportCertificate({
      root: environment.root,
      certificateFingerprint: environment.reviewerAdmission.certificateFingerprint,
      retiredAt: new Date().toISOString(),
      kind: "emergency",
      reason:
        "The test operator withdraws the reviewer certificate after its retained assignment has been delivered.",
      operatorId: "test:supervised-delivery-retire-reviewer",
    });
    const retired = await reviewerClient(environment, {
      operation: "pull-assignment",
      key: "test-retired-pull-0001",
      body,
    });
    expect(retired.statusCode).toBe(403);
    expect(retired.envelope.error?.code).toBe("actor-certificate-revoked");

    const delivery = readAsoiafAnswerSupervisedDeliveryStatus(environment.root).deliveries[0];
    if (!delivery) throw new Error("delivery missing");
    const deliveryFile = path.join(
      asoiafAnswerSupervisedDeliveryPaths(environment.root).deliveries,
      `${delivery.deliveryFingerprint.slice("sha256:".length)}.json`,
    );
    const changed = JSON.parse(fs.readFileSync(deliveryFile, "utf8")) as AsoiafAnswerSupervisedAssignmentDelivery;
    changed.actorId = "actor:tampered";
    fs.writeFileSync(deliveryFile, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    expect(verifyAsoiafAnswerSupervisedDeliveryEstate(environment.root).map(
      (entry) => entry.code,
    )).toEqual(expect.arrayContaining([
      "supervised-delivery-custody",
      "supervised-delivery-fingerprint",
    ]));
    expect(readAsoiafAnswerTransportOperationsStatus(environment.root).retirements).toHaveLength(1);
  });
});
