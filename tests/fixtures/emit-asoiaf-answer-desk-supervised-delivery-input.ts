import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import type https from "node:https";
import path from "node:path";
import { buildAsoiafAnswerDeskFixture } from "./asoiaf-answer-desk-fixture.js";
import {
  adoptAsoiafAnswerDeskWorkOrder,
  readAsoiafAnswerDeskStatus,
  verifyAsoiafAnswerDeskEstate,
  type AsoiafAnswerDeskAdoptInput,
} from "../../tools/lib/asoiaf-answer-desk-estate.js";
import {
  readAsoiafAnswerExchangeStatus,
  verifyAsoiafAnswerExchangeEstate,
} from "../../tools/lib/asoiaf-answer-desk-exchange.js";
import {
  buildAsoiafAnswerSupervisorPolicy,
  prepareAsoiafAnswerSupervisorIntent,
  readAsoiafAnswerSupervisorStatus,
  tickAsoiafAnswerDeskSupervisor,
  verifyAsoiafAnswerSupervisorEstate,
  type AsoiafAnswerSupervisorPolicy,
  type AsoiafAnswerSupervisorPolicyInput,
  type AsoiafAnswerSupervisorTickInput,
} from "../../tools/lib/asoiaf-answer-desk-supervisor.js";
import {
  readAsoiafAnswerDeskWorkerStatus,
  verifyAsoiafAnswerDeskWorkerEstate,
} from "../../tools/lib/asoiaf-answer-desk-worker.js";
import {
  fingerprintAsoiafAnswerTransportCertificate,
  readAsoiafAnswerTransportStatus,
  verifyAsoiafAnswerTransportEstate,
} from "../../tools/lib/asoiaf-answer-desk-transport.js";
import {
  admitAsoiafAnswerTransportCertificate,
  advertiseAsoiafAnswerTransportEndpoint,
  probeAsoiafAnswerTransportEndpoint,
  readAsoiafAnswerTransportOperationsStatus,
  retainAsoiafAnswerTransportRendezvous,
  retireAsoiafAnswerTransportCertificate,
  verifyAsoiafAnswerTransportOperationsEstate,
  type AsoiafAnswerTransportCertificateAdmission,
} from "../../tools/lib/asoiaf-answer-desk-transport-operations.js";
import {
  createAsoiafAnswerSupervisedDeliveryServer,
  listenAsoiafAnswerSupervisedDeliveryServer,
  readAsoiafAnswerSupervisedDeliveryStatus,
  requestAsoiafAnswerSupervisedDelivery,
  verifyAsoiafAnswerSupervisedDeliveryEstate,
  type AsoiafAnswerSupervisedDeliveryClientResult,
  type AsoiafAnswerSupervisedReturnBody,
} from "../../tools/lib/asoiaf-answer-desk-supervised-delivery.js";
import type {
  AsoiafAnswerWorkAction,
  AsoiafAnswerWorkOrder,
} from "../../tools/lib/asoiaf-answer-work-order.js";

const QUALIFICATION_SHELL = `set -euo pipefail
node node_modules/vite-node/vite-node.mjs \\
  tests/fixtures/emit-asoiaf-answer-desk-supervised-delivery-input.ts \\
  --run-qualification \\
  "$RUNNER_TEMP/supervised-delivery-receipts" \\
  "$RUNNER_TEMP/answer-desk" \\
  | tee "$RUNNER_TEMP/supervised-delivery-lifecycle.log"
`;

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

interface QualificationInputs {
  fixture: ReturnType<typeof buildAsoiafAnswerDeskFixture>;
  policyInput: AsoiafAnswerSupervisorPolicyInput;
  policy: AsoiafAnswerSupervisorPolicy;
  adoptInput: AsoiafAnswerDeskAdoptInput;
  reviewPrepare: AsoiafAnswerSupervisorTickInput;
  reviewReturn: AsoiafAnswerSupervisedReturnBody;
  closePrepare: AsoiafAnswerSupervisorTickInput;
  closeReturn: AsoiafAnswerSupervisedReturnBody;
  renderTick: AsoiafAnswerSupervisorTickInput;
  expected: {
    openWorkOrderId: string;
    reconciledWorkOrderId: string;
    readyWorkOrderId: string;
    reviewItemId: string;
    closeItemId: string;
    renderItemId: string;
    renderedTextDigest: string;
    renderedTextCharacters: number;
  };
}

function itemId(
  workOrder: AsoiafAnswerWorkOrder,
  action: AsoiafAnswerWorkAction,
): string {
  const item = workOrder.items.find((entry) => entry.action === action);
  if (!item) throw new Error(`supervised delivery fixture work order lacks ${action}`);
  return item.itemId;
}

function at(base: number, offset: number): string {
  return new Date(base + offset).toISOString();
}

function buildInputs(estateRoot: string, base = Date.now()): QualificationInputs {
  const fixture = buildAsoiafAnswerDeskFixture();
  const policyInput: AsoiafAnswerSupervisorPolicyInput = {
    createdBy: "qualification:supervised-delivery-policy",
    createdAt: at(base, -120_000),
    automaticWorkerEnabled: true,
    automaticLeaseMilliseconds: 60_000,
    actorBindings: [
      {
        actorRole: "exact-locator-reviewer",
        actorId: "actor:qualification:supervised-delivery:reviewer",
        capacity: 1,
        leaseMilliseconds: 600_000,
        priority: 10,
      },
      {
        actorRole: "answer-assembler",
        actorId: "actor:qualification:supervised-delivery:assembler",
        capacity: 1,
        leaseMilliseconds: 600_000,
        priority: 20,
      },
    ],
  };
  const policy = buildAsoiafAnswerSupervisorPolicy(policyInput);
  const adoptInput: AsoiafAnswerDeskAdoptInput = {
    root: estateRoot,
    workOrder: fixture.openWorkOrder,
    adoptedAt: at(base, -119_000),
    operatorId: "qualification:supervised-delivery-adopt",
  };
  const reviewPrepare: AsoiafAnswerSupervisorTickInput = {
    root: estateRoot,
    requestKey: "qualification:supervised-delivery-review",
    policy,
    requestedAt: at(base, -100_000),
    automaticCompletedAt: null,
    operatorId: "qualification:supervised-delivery-supervisor",
  };
  const reviewReturn: AsoiafAnswerSupervisedReturnBody = {
    deliveryId: "__REVIEW_DELIVERY_ID__",
    rendezvousId: "__REVIEW_RENDEZVOUS_ID__",
    completedAt: at(base, -80_000),
    outcome: "satisfied",
    afterWorkOrder: fixture.reconciledWorkOrder,
    resultReferences: [
      {
        kind: "reviewed-answer-transaction",
        objectId: fixture.transaction.transactionId,
        fingerprint: fixture.transaction.transactionFingerprint,
        uri: null,
      },
    ],
    reason:
      "The certificate-bound reviewer returns the exact reviewed transaction for the assignment selected by the retained supervisor intent.",
  };
  const closePrepare: AsoiafAnswerSupervisorTickInput = {
    root: estateRoot,
    requestKey: "qualification:supervised-delivery-close",
    policy,
    requestedAt: at(base, -60_000),
    automaticCompletedAt: null,
    operatorId: "qualification:supervised-delivery-supervisor",
  };
  const closeReturn: AsoiafAnswerSupervisedReturnBody = {
    deliveryId: "__CLOSE_DELIVERY_ID__",
    rendezvousId: "__CLOSE_RENDEZVOUS_ID__",
    completedAt: at(base, -40_000),
    outcome: "satisfied",
    afterWorkOrder: fixture.readyWorkOrder,
    resultReferences: [
      {
        kind: "reviewed-answer-packet",
        objectId: fixture.answerPacket.answerPacketId,
        fingerprint: fixture.answerPacket.answerPacketFingerprint,
        uri: null,
      },
    ],
    reason:
      "The certificate-bound answer assembler returns the exact reviewed packet for the gap-closure assignment selected by the retained supervisor intent.",
  };
  const renderTick: AsoiafAnswerSupervisorTickInput = {
    root: estateRoot,
    requestKey: "qualification:supervised-delivery-render",
    policy,
    requestedAt: at(base, -20_000),
    automaticCompletedAt: at(base, -10_000),
    operatorId: "qualification:supervised-delivery-supervisor",
  };
  return {
    fixture,
    policyInput,
    policy,
    adoptInput,
    reviewPrepare,
    reviewReturn,
    closePrepare,
    closeReturn,
    renderTick,
    expected: {
      openWorkOrderId: fixture.openWorkOrder.workOrderId,
      reconciledWorkOrderId: fixture.reconciledWorkOrder.workOrderId,
      readyWorkOrderId: fixture.readyWorkOrder.workOrderId,
      reviewItemId: itemId(fixture.openWorkOrder, "review-exact-locator"),
      closeItemId: itemId(fixture.reconciledWorkOrder, "close-gap"),
      renderItemId: itemId(fixture.readyWorkOrder, "render-reviewed-answer"),
      renderedTextDigest: fixture.answerPacket.renderedTextDigest,
      renderedTextCharacters: fixture.answerPacket.renderedTextCharacters,
    },
  };
}

function writeJson(directory: string, name: string, value: unknown): void {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function emitInputs(outputDirectory: string, estateRoot: string): void {
  const input = buildInputs(estateRoot);
  for (const [name, value] of [
    ["policy-input.json", input.policyInput],
    ["policy.json", input.policy],
    ["adopt-input.json", input.adoptInput],
    ["review-prepare-input.json", input.reviewPrepare],
    ["review-return-template.json", input.reviewReturn],
    ["close-prepare-input.json", input.closePrepare],
    ["close-return-template.json", input.closeReturn],
    ["render-tick-input.json", input.renderTick],
    ["expected.json", input.expected],
  ] as const) {
    writeJson(outputDirectory, name, value);
  }
  process.stdout.write(`${JSON.stringify({
    ok: true,
    outputDirectory,
    estateRoot,
    policyId: input.policy.policyId,
    reviewItemId: input.expected.reviewItemId,
    closeItemId: input.expected.closeItemId,
    renderItemId: input.expected.renderItemId,
  }, null, 2)}\n`);
}

function runOpenSsl(args: string[]): void {
  execFileSync("openssl", args, { stdio: ["ignore", "ignore", "pipe"] });
}

function createCa(directory: string): { certificate: string; key: string } {
  const certificate = path.join(directory, "ca.crt");
  const key = path.join(directory, "ca.key");
  runOpenSsl([
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "2",
    "-subj", "/CN=ASOIAF supervised delivery qualification CA",
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

function admitCertificates(root: string, certs: CertificateSet) {
  const server = admitAsoiafAnswerTransportCertificate({
    root,
    usage: "server-auth",
    principalId: "server:qualification:answer-supervised-delivery",
    certificate: pem(certs.serverCertificate),
    issuerCertificate: pem(certs.caCertificate),
    ...certificateTimes(certs.serverCertificate),
    rotationReason:
      "The operator admits one bounded server certificate for the supervisor-intent delivery endpoint and no task authority.",
    operatorId: "qualification:supervised-delivery-admit-server",
  });
  const reviewer = admitAsoiafAnswerTransportCertificate({
    root,
    usage: "client-auth",
    principalId: "actor:qualification:supervised-delivery:reviewer",
    actorRole: "exact-locator-reviewer",
    certificate: pem(certs.reviewerCertificate),
    issuerCertificate: pem(certs.caCertificate),
    ...certificateTimes(certs.reviewerCertificate),
    rotationReason:
      "The operator admits the reviewer certificate for one exact supervisor-selected assignment and no task authority.",
    operatorId: "qualification:supervised-delivery-admit-reviewer",
  });
  const assembler = admitAsoiafAnswerTransportCertificate({
    root,
    usage: "client-auth",
    principalId: "actor:qualification:supervised-delivery:assembler",
    actorRole: "answer-assembler",
    certificate: pem(certs.assemblerCertificate),
    issuerCertificate: pem(certs.caCertificate),
    ...certificateTimes(certs.assemblerCertificate),
    rotationReason:
      "The operator admits the assembler certificate for the separate supervisor-selected gap-closure assignment.",
    operatorId: "qualification:supervised-delivery-admit-assembler",
  });
  return { server, reviewer, assembler };
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

async function startServer(
  root: string,
  certs: CertificateSet,
  port = 0,
): Promise<{ server: https.Server; baseUrl: string; port: number }> {
  const server = createAsoiafAnswerSupervisedDeliveryServer({
    root,
    certificate: pem(certs.serverCertificate),
    privateKey: pem(certs.serverKey),
    clientCertificateAuthority: pem(certs.caCertificate),
    operatorId: "qualification:supervised-delivery-server",
  });
  const listening = await listenAsoiafAnswerSupervisedDeliveryServer(
    server,
    "127.0.0.1",
    port,
  );
  return {
    server,
    port: listening.port,
    baseUrl: `https://127.0.0.1:${listening.port}/`,
  };
}

async function createEndpointAndRendezvous(input: {
  root: string;
  certs: CertificateSet;
  baseUrl: string;
  serverAdmission: AsoiafAnswerTransportCertificateAdmission;
  reviewerAdmission: AsoiafAnswerTransportCertificateAdmission;
  assemblerAdmission: AsoiafAnswerTransportCertificateAdmission;
}) {
  const endpoint = advertiseAsoiafAnswerTransportEndpoint({
    root: input.root,
    serverId: input.serverAdmission.principalId,
    baseUrl: input.baseUrl,
    networkScope: "loopback",
    priority: 10,
    serverCertificateFingerprint: input.serverAdmission.certificateFingerprint,
    acceptedClientCaCertificateFingerprint:
      fingerprintAsoiafAnswerTransportCertificate(pem(input.certs.caCertificate)),
    advertisedAt: input.serverAdmission.admittedAt,
    availableFrom: input.serverAdmission.activateAt,
    expiresAt: new Date(
      Date.parse(input.serverAdmission.activateAt) + 8 * 60 * 60 * 1000,
    ).toISOString(),
    operatorId: "qualification:supervised-delivery-advertise",
  });
  const observedAt = new Date(
    Math.max(
      Date.now(),
      Date.parse(input.serverAdmission.activateAt),
      Date.parse(input.reviewerAdmission.activateAt),
      Date.parse(input.assemblerAdmission.activateAt),
    ),
  ).toISOString();
  const reviewerObservation = await probeAsoiafAnswerTransportEndpoint({
    root: input.root,
    endpointLeaseId: endpoint.endpoint.endpointLeaseId,
    clientCertificate: pem(input.certs.reviewerCertificate),
    clientPrivateKey: pem(input.certs.reviewerKey),
    serverCertificateAuthority: pem(input.certs.caCertificate),
    observedAt,
    timeoutMilliseconds: 10_000,
  });
  const assemblerObservation = await probeAsoiafAnswerTransportEndpoint({
    root: input.root,
    endpointLeaseId: endpoint.endpoint.endpointLeaseId,
    clientCertificate: pem(input.certs.assemblerCertificate),
    clientPrivateKey: pem(input.certs.assemblerKey),
    serverCertificateAuthority: pem(input.certs.caCertificate),
    observedAt: new Date(Date.now()).toISOString(),
    timeoutMilliseconds: 10_000,
  });
  const reviewer = retainAsoiafAnswerTransportRendezvous({
    root: input.root,
    serverId: input.serverAdmission.principalId,
    clientCertificateFingerprint: input.reviewerAdmission.certificateFingerprint,
    generatedAt: reviewerObservation.observation.completedAt,
    maxObservationAgeMilliseconds: 300_000,
    operatorId: "qualification:supervised-delivery-resolve-reviewer",
  });
  const assembler = retainAsoiafAnswerTransportRendezvous({
    root: input.root,
    serverId: input.serverAdmission.principalId,
    clientCertificateFingerprint: input.assemblerAdmission.certificateFingerprint,
    generatedAt: assemblerObservation.observation.completedAt,
    maxObservationAgeMilliseconds: 300_000,
    operatorId: "qualification:supervised-delivery-resolve-assembler",
  });
  return { endpoint, reviewerObservation, assemblerObservation, reviewer, assembler };
}

function clientInput(input: {
  operation: "pull-assignment" | "return-result";
  baseUrl: string;
  idempotencyKey: string;
  body: Parameters<typeof requestAsoiafAnswerSupervisedDelivery>[0]["body"];
  certificate: string;
  key: string;
  ca: string;
}) {
  return {
    operation: input.operation,
    baseUrl: input.baseUrl,
    idempotencyKey: input.idempotencyKey,
    body: input.body,
    certificate: pem(input.certificate),
    privateKey: pem(input.key),
    certificateAuthority: pem(input.ca),
    timeoutMilliseconds: 15_000,
  } as const;
}

function assertSucceeded(
  result: AsoiafAnswerSupervisedDeliveryClientResult,
): asserts result is AsoiafAnswerSupervisedDeliveryClientResult & {
  envelope: AsoiafAnswerSupervisedDeliveryClientResult["envelope"] & {
    response: NonNullable<AsoiafAnswerSupervisedDeliveryClientResult["envelope"]["response"]>;
  };
} {
  assert.equal(result.statusCode, 200);
  assert.equal(result.envelope.ok, true);
  assert.ok(result.envelope.response);
}

async function runQualification(
  outputDirectory: string,
  estateRoot: string,
): Promise<void> {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.rmSync(estateRoot, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.mkdirSync(estateRoot, { recursive: true });
  const certificateDirectory = path.join(
    path.dirname(estateRoot),
    "supervised-delivery-ephemeral-certificates",
  );
  fs.rmSync(certificateDirectory, { recursive: true, force: true });
  const inputs = buildInputs(estateRoot);
  const certs = createCertificates(certificateDirectory);
  let live: { server: https.Server; baseUrl: string; port: number } | null = null;
  const receipt = (name: string, value: unknown) => writeJson(outputDirectory, name, value);
  try {
    const adopted = adoptAsoiafAnswerDeskWorkOrder(inputs.adoptInput);
    const reviewPrepared = prepareAsoiafAnswerSupervisorIntent(inputs.reviewPrepare);
    const admissions = admitCertificates(estateRoot, certs);
    live = await startServer(estateRoot, certs);
    const route = await createEndpointAndRendezvous({
      root: estateRoot,
      certs,
      baseUrl: live.baseUrl,
      serverAdmission: admissions.server.admission,
      reviewerAdmission: admissions.reviewer.admission,
      assemblerAdmission: admissions.assembler.admission,
    });

    const wrongActor = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "pull-assignment",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-wrong-actor-0001",
      body: {
        intentId: reviewPrepared.intent.intentId,
        rendezvousId: route.assembler.rendezvous.rendezvousId,
      },
      certificate: certs.assemblerCertificate,
      key: certs.assemblerKey,
      ca: certs.caCertificate,
    }));
    assert.equal(wrongActor.statusCode, 409);
    assert.equal(wrongActor.envelope.error?.code, "intent-actor-mismatch");

    const reviewPullBody = {
      intentId: reviewPrepared.intent.intentId,
      rendezvousId: route.reviewer.rendezvous.rendezvousId,
    };
    const reviewPull = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "pull-assignment",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-review-pull-0001",
      body: reviewPullBody,
      certificate: certs.reviewerCertificate,
      key: certs.reviewerKey,
      ca: certs.caCertificate,
    }));
    const reviewPullReplay = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "pull-assignment",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-review-pull-0001",
      body: reviewPullBody,
      certificate: certs.reviewerCertificate,
      key: certs.reviewerKey,
      ca: certs.caCertificate,
    }));
    assertSucceeded(reviewPull);
    assertSucceeded(reviewPullReplay);
    assert.deepEqual(reviewPullReplay.envelope.response, reviewPull.envelope.response);
    const reviewPayload = reviewPull.envelope.response.payload;
    assert.equal(reviewPayload?.kind, "assignment-delivery");
    if (!reviewPayload || reviewPayload.kind !== "assignment-delivery") {
      throw new Error("review assignment delivery is missing");
    }

    const idempotencyConflict = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "pull-assignment",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-review-pull-0001",
      body: {
        intentId: reviewPrepared.intent.intentId,
        rendezvousId: route.assembler.rendezvous.rendezvousId,
      },
      certificate: certs.assemblerCertificate,
      key: certs.assemblerKey,
      ca: certs.caCertificate,
    }));
    assert.equal(idempotencyConflict.statusCode, 400);
    assert.equal(idempotencyConflict.envelope.error?.code, "idempotency-key-conflict");

    const reviewReturnBody: AsoiafAnswerSupervisedReturnBody = {
      ...inputs.reviewReturn,
      deliveryId: reviewPayload.delivery.deliveryId,
      rendezvousId: route.reviewer.rendezvous.rendezvousId,
    };
    const reviewReturn = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "return-result",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-review-return-0001",
      body: reviewReturnBody,
      certificate: certs.reviewerCertificate,
      key: certs.reviewerKey,
      ca: certs.caCertificate,
    }));
    const reviewReturnReplay = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "return-result",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-review-return-0001",
      body: reviewReturnBody,
      certificate: certs.reviewerCertificate,
      key: certs.reviewerKey,
      ca: certs.caCertificate,
    }));
    assertSucceeded(reviewReturn);
    assertSucceeded(reviewReturnReplay);
    assert.deepEqual(reviewReturnReplay.envelope.response, reviewReturn.envelope.response);

    const closePrepared = prepareAsoiafAnswerSupervisorIntent(inputs.closePrepare);
    const closePullBody = {
      intentId: closePrepared.intent.intentId,
      rendezvousId: route.assembler.rendezvous.rendezvousId,
    };
    const closePull = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "pull-assignment",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-close-pull-0001",
      body: closePullBody,
      certificate: certs.assemblerCertificate,
      key: certs.assemblerKey,
      ca: certs.caCertificate,
    }));
    const closePullReplay = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "pull-assignment",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-close-pull-0001",
      body: closePullBody,
      certificate: certs.assemblerCertificate,
      key: certs.assemblerKey,
      ca: certs.caCertificate,
    }));
    assertSucceeded(closePull);
    assertSucceeded(closePullReplay);
    assert.deepEqual(closePullReplay.envelope.response, closePull.envelope.response);
    const closePayload = closePull.envelope.response.payload;
    assert.equal(closePayload?.kind, "assignment-delivery");
    if (!closePayload || closePayload.kind !== "assignment-delivery") {
      throw new Error("close-gap assignment delivery is missing");
    }

    const closeReturnBody: AsoiafAnswerSupervisedReturnBody = {
      ...inputs.closeReturn,
      deliveryId: closePayload.delivery.deliveryId,
      rendezvousId: route.assembler.rendezvous.rendezvousId,
    };
    const closeReturn = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "return-result",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-close-return-0001",
      body: closeReturnBody,
      certificate: certs.assemblerCertificate,
      key: certs.assemblerKey,
      ca: certs.caCertificate,
    }));
    const closeReturnReplay = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "return-result",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-close-return-0001",
      body: closeReturnBody,
      certificate: certs.assemblerCertificate,
      key: certs.assemblerKey,
      ca: certs.caCertificate,
    }));
    assertSucceeded(closeReturn);
    assertSucceeded(closeReturnReplay);
    assert.deepEqual(closeReturnReplay.envelope.response, closeReturn.envelope.response);

    await closeServer(live.server);
    live = await startServer(estateRoot, certs, live.port);
    const reviewPullRestartReplay = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "pull-assignment",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-review-pull-0001",
      body: reviewPullBody,
      certificate: certs.reviewerCertificate,
      key: certs.reviewerKey,
      ca: certs.caCertificate,
    }));
    const closeReturnRestartReplay = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "return-result",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-close-return-0001",
      body: closeReturnBody,
      certificate: certs.assemblerCertificate,
      key: certs.assemblerKey,
      ca: certs.caCertificate,
    }));
    assertSucceeded(reviewPullRestartReplay);
    assertSucceeded(closeReturnRestartReplay);
    assert.deepEqual(reviewPullRestartReplay.envelope.response, reviewPull.envelope.response);
    assert.deepEqual(closeReturnRestartReplay.envelope.response, closeReturn.envelope.response);

    const reviewerRetirement = retireAsoiafAnswerTransportCertificate({
      root: estateRoot,
      certificateFingerprint: admissions.reviewer.admission.certificateFingerprint,
      retiredAt: new Date(
        Math.max(
          Date.now(),
          Date.parse(admissions.reviewer.admission.activateAt),
        ),
      ).toISOString(),
      kind: "emergency",
      reason:
        "The qualification operator withdraws the reviewer certificate after its exact supervised assignment and result are permanently retained.",
      operatorId: "qualification:supervised-delivery-retire-reviewer",
    });
    const retiredReviewer = await requestAsoiafAnswerSupervisedDelivery(clientInput({
      operation: "pull-assignment",
      baseUrl: live.baseUrl,
      idempotencyKey: "qualification-supervised-retired-reviewer-0001",
      body: reviewPullBody,
      certificate: certs.reviewerCertificate,
      key: certs.reviewerKey,
      ca: certs.caCertificate,
    }));
    assert.equal(retiredReviewer.statusCode, 403);
    assert.equal(retiredReviewer.envelope.error?.code, "actor-certificate-revoked");
    await closeServer(live.server);
    live = null;

    const render = tickAsoiafAnswerDeskSupervisor(inputs.renderTick);
    const renderReplay = tickAsoiafAnswerDeskSupervisor(inputs.renderTick);
    assert.equal(render.run.outcome, "automatic-rendered");
    assert.deepEqual(renderReplay.run, render.run);

    const deliveryStatus = readAsoiafAnswerSupervisedDeliveryStatus(estateRoot);
    const deliveryFindings = verifyAsoiafAnswerSupervisedDeliveryEstate(estateRoot);
    const supervisorStatus = readAsoiafAnswerSupervisorStatus(estateRoot, inputs.policy);
    const supervisorFindings = verifyAsoiafAnswerSupervisorEstate(estateRoot);
    const operationsStatus = readAsoiafAnswerTransportOperationsStatus(estateRoot);
    const operationsFindings = verifyAsoiafAnswerTransportOperationsEstate(estateRoot);
    const transportStatus = readAsoiafAnswerTransportStatus(estateRoot);
    const transportFindings = verifyAsoiafAnswerTransportEstate(estateRoot);
    const exchangeStatus = readAsoiafAnswerExchangeStatus(estateRoot);
    const exchangeFindings = verifyAsoiafAnswerExchangeEstate(estateRoot);
    const workerStatus = readAsoiafAnswerDeskWorkerStatus(estateRoot);
    const workerFindings = verifyAsoiafAnswerDeskWorkerEstate(estateRoot);
    const deskStatus = readAsoiafAnswerDeskStatus(estateRoot);
    const deskFindings = verifyAsoiafAnswerDeskEstate(estateRoot);

    assert.deepEqual(deliveryFindings, []);
    assert.equal(supervisorFindings.filter((entry) => entry.severity === "error").length, 0);
    assert.equal(operationsFindings.filter((entry) => entry.severity === "error").length, 0);
    assert.equal(transportFindings.filter((entry) => entry.severity === "error").length, 0);
    assert.equal(exchangeFindings.filter((entry) => entry.severity === "error").length, 0);
    assert.equal(workerFindings.filter((entry) => entry.severity === "error").length, 0);
    assert.equal(deskFindings.filter((entry) => entry.severity === "error").length, 0);
    assert.equal(deliveryStatus.requests.length, 5);
    assert.equal(deliveryStatus.responses.length, 5);
    assert.equal(deliveryStatus.deliveries.length, 2);
    assert.equal(deliveryStatus.returns.length, 2);
    assert.equal(supervisorStatus.intents.length, 3);
    assert.equal(supervisorStatus.runs.length, 3);
    assert.equal(supervisorStatus.pendingIntentIds.length, 0);
    assert.equal(operationsStatus.certificates.length, 3);
    assert.equal(operationsStatus.retirements.length, 1);
    assert.equal(operationsStatus.endpoints.length, 1);
    assert.equal(operationsStatus.availability.length, 2);
    assert.equal(operationsStatus.rendezvous.length, 2);
    assert.equal(transportStatus.requests.length, 4);
    assert.equal(transportStatus.responses.length, 4);
    assert.equal(exchangeStatus.assignments.length, 2);
    assert.equal(exchangeStatus.results.length, 2);
    assert.equal(workerStatus.invocations.length, 1);
    assert.equal(workerStatus.results.length, 1);
    assert.equal(deskStatus.workOrders.length, 3);
    assert.equal(deskStatus.leases.length, 3);
    assert.equal(deskStatus.settlements.length, 3);
    assert.equal(deskStatus.state.nextAvailableItemId, null);
    assert.deepEqual(deskStatus.state.availableItemIds, []);
    assert.equal(reviewPayload.assignment.itemId, inputs.expected.reviewItemId);
    assert.equal(closePayload.assignment.itemId, inputs.expected.closeItemId);
    assert.equal(reviewPayload.delivery.sourceTextIncluded, false);
    assert.equal(reviewPayload.delivery.privateTextIncluded, false);
    assert.equal(reviewPayload.delivery.authority, "none");

    for (const [name, value] of [
      ["inputs.json", {
        policy: inputs.policy,
        adoptInput: inputs.adoptInput,
        reviewPrepare: inputs.reviewPrepare,
        reviewReturnBody,
        closePrepare: inputs.closePrepare,
        closeReturnBody,
        renderTick: inputs.renderTick,
        expected: inputs.expected,
      }],
      ["adopt-result.json", adopted],
      ["review-prepare-result.json", reviewPrepared],
      ["server-admission.json", admissions.server],
      ["reviewer-admission.json", admissions.reviewer],
      ["assembler-admission.json", admissions.assembler],
      ["endpoint-advertisement.json", route.endpoint],
      ["reviewer-probe.json", route.reviewerObservation],
      ["assembler-probe.json", route.assemblerObservation],
      ["reviewer-rendezvous.json", route.reviewer],
      ["assembler-rendezvous.json", route.assembler],
      ["wrong-actor-pull.json", wrongActor],
      ["review-pull-first.json", reviewPull],
      ["review-pull-replay.json", reviewPullReplay],
      ["idempotency-conflict.json", idempotencyConflict],
      ["review-return-first.json", reviewReturn],
      ["review-return-replay.json", reviewReturnReplay],
      ["close-prepare-result.json", closePrepared],
      ["close-pull-first.json", closePull],
      ["close-pull-replay.json", closePullReplay],
      ["close-return-first.json", closeReturn],
      ["close-return-replay.json", closeReturnReplay],
      ["review-pull-restart-replay.json", reviewPullRestartReplay],
      ["close-return-restart-replay.json", closeReturnRestartReplay],
      ["reviewer-retirement.json", reviewerRetirement],
      ["retired-reviewer-pull.json", retiredReviewer],
      ["render-tick-first.json", render],
      ["render-tick-replay.json", renderReplay],
      ["delivery-status.json", deliveryStatus],
      ["delivery-verification.json", deliveryFindings],
      ["supervisor-status.json", supervisorStatus],
      ["supervisor-verification.json", supervisorFindings],
      ["operations-status.json", operationsStatus],
      ["operations-verification.json", operationsFindings],
      ["transport-status.json", transportStatus],
      ["transport-verification.json", transportFindings],
      ["exchange-status.json", exchangeStatus],
      ["exchange-verification.json", exchangeFindings],
      ["worker-status.json", workerStatus],
      ["worker-verification.json", workerFindings],
      ["desk-status.json", deskStatus],
      ["desk-verification.json", deskFindings],
    ] as const) {
      receipt(name, value);
    }

    const summary = {
      format: "axm-asoiaf-answer-supervised-delivery-qualification-summary/1",
      policyId: inputs.policy.policyId,
      reviewIntentId: reviewPrepared.intent.intentId,
      closeIntentId: closePrepared.intent.intentId,
      reviewDeliveryId: reviewPayload.delivery.deliveryId,
      closeDeliveryId: closePayload.delivery.deliveryId,
      certificateAdmissions: operationsStatus.certificates.length,
      certificateRetirements: operationsStatus.retirements.length,
      endpointLeases: operationsStatus.endpoints.length,
      availabilityObservations: operationsStatus.availability.length,
      rendezvous: operationsStatus.rendezvous.length,
      deliveryRequests: deliveryStatus.requests.length,
      deliveryResponses: deliveryStatus.responses.length,
      successfulDeliveryResponses: deliveryStatus.responses.filter(
        (entry) => entry.outcome === "succeeded",
      ).length,
      refusedDeliveryResponses: deliveryStatus.responses.filter(
        (entry) => entry.outcome === "refused",
      ).length,
      assignmentDeliveries: deliveryStatus.deliveries.length,
      resultReturns: deliveryStatus.returns.length,
      supervisorIntents: supervisorStatus.intents.length,
      supervisorRuns: supervisorStatus.runs.length,
      lowerTransportRequests: transportStatus.requests.length,
      lowerTransportResponses: transportStatus.responses.length,
      externalAssignments: exchangeStatus.assignments.length,
      externalResults: exchangeStatus.results.length,
      automaticInvocations: workerStatus.invocations.length,
      automaticResults: workerStatus.results.length,
      workOrders: deskStatus.workOrders.length,
      leases: deskStatus.leases.length,
      settlements: deskStatus.settlements.length,
      processRestartReplays: 2,
      retiredCertificateRefused: true,
      idempotencyConflictRefused: true,
      wrongActorRefused: true,
      sourceTextIncluded: false,
      privateTextIncluded: false,
      certificateRetained: false,
      privateKeyRetained: false,
      authority: "none",
      graphEffect: "none",
      canonEffect: "none",
      answerEffect: "none",
    };
    receipt("qualification-summary.json", summary);
    process.stdout.write(`${JSON.stringify({ ok: true, outputDirectory, estateRoot, summary }, null, 2)}\n`);
  } finally {
    if (live) await closeServer(live.server);
    fs.rmSync(certificateDirectory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "--emit-qualification-shell") {
    const target = process.argv[3];
    if (!target) throw new Error("qualification shell target is required");
    const resolved = path.resolve(target);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, QUALIFICATION_SHELL, { mode: 0o755 });
    process.stdout.write(`${JSON.stringify({ ok: true, target: resolved }, null, 2)}\n`);
    return;
  }
  if (command === "--run-qualification") {
    const outputDirectory = process.argv[3];
    const estateRoot = process.argv[4];
    if (!outputDirectory || !estateRoot) {
      throw new Error("qualification output directory and estate root are required");
    }
    await runQualification(path.resolve(outputDirectory), path.resolve(estateRoot));
    return;
  }
  const outputDirectory = process.argv[2];
  const estateRoot = process.argv[3];
  if (!outputDirectory || !estateRoot) {
    throw new Error("output directory and estate root arguments are required");
  }
  emitInputs(path.resolve(outputDirectory), path.resolve(estateRoot));
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
