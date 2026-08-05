import fs from "node:fs";
import path from "node:path";
import {
  collectorContentId,
  sha256,
} from "./asoiaf-external-estate.js";
import {
  buildAsoiafAnswerDeskState,
  claimAsoiafAnswerWorkItem,
  settleAsoiafAnswerWorkItem,
  validateAsoiafAnswerDeskState,
  validateAsoiafAnswerWorkLease,
  validateAsoiafAnswerWorkSettlement,
  type AsoiafAnswerDeskState,
  type AsoiafAnswerWorkLease,
  type AsoiafAnswerWorkResultReference,
  type AsoiafAnswerWorkSettlement,
  type AsoiafAnswerWorkSettlementOutcome,
} from "./asoiaf-answer-work-lease.js";
import {
  validateAsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkOrder,
} from "./asoiaf-answer-work-order.js";

export const ASOIAF_ANSWER_DESK_ESTATE_FORMAT =
  "axm-asoiaf-answer-desk-estate/1" as const;
export const ASOIAF_ANSWER_DESK_WORK_ORDER_RECORD_FORMAT =
  "axm-asoiaf-answer-desk-work-order-record/1" as const;
export const ASOIAF_ANSWER_DESK_LOCK_FORMAT =
  "axm-asoiaf-answer-desk-lock/1" as const;

export interface AsoiafAnswerDeskEstatePaths {
  root: string;
  manifest: string;
  workOrders: string;
  workOrderLedger: string;
  leases: string;
  settlements: string;
  state: string;
  lockDirectory: string;
  lockRecord: string;
}

export interface AsoiafAnswerDeskEstateManifest {
  format: typeof ASOIAF_ANSWER_DESK_ESTATE_FORMAT;
  estateId: string;
  initializedAt: string;
  updatedAt: string;
  dossierId: string;
  questionId: string;
  latestWorkOrderId: string;
  latestWorkOrderFingerprint: `sha256:${string}`;
  workOrderCount: number;
  leaseCount: number;
  settlementCount: number;
  staleLockRecoveryCount: number;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  manifestFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerDeskWorkOrderRecord {
  format: typeof ASOIAF_ANSWER_DESK_WORK_ORDER_RECORD_FORMAT;
  workOrderId: string;
  workOrderFingerprint: `sha256:${string}`;
  dossierId: string;
  questionId: string;
  createdAt: string;
  adoptedAt: string;
  workOrderUri: string;
  authority: "none";
  graphEffect: "none";
  canonEffect: "none";
  answerEffect: "none";
  recordFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerDeskLock {
  format: typeof ASOIAF_ANSWER_DESK_LOCK_FORMAT;
  lockId: string;
  ownerId: string;
  acquiredAt: string;
  expiresAt: string;
  lockMilliseconds: number;
  lockFingerprint: `sha256:${string}`;
}

export interface AsoiafAnswerDeskAdoptInput {
  root: string;
  workOrder: AsoiafAnswerWorkOrder;
  adoptedAt: string;
  operatorId: string;
  lockMilliseconds?: number;
}

export interface AsoiafAnswerDeskAdoptResult {
  manifest: AsoiafAnswerDeskEstateManifest;
  record: AsoiafAnswerDeskWorkOrderRecord;
  state: AsoiafAnswerDeskState;
  replayed: boolean;
  staleLocksRecovered: number;
}

export interface AsoiafAnswerDeskClaimInput {
  root: string;
  itemId: string;
  workerId: string;
  claimedAt: string;
  leaseMilliseconds: number;
  operatorId?: string;
  lockMilliseconds?: number;
}

export interface AsoiafAnswerDeskClaimResult {
  manifest: AsoiafAnswerDeskEstateManifest;
  lease: AsoiafAnswerWorkLease;
  state: AsoiafAnswerDeskState;
  replayed: boolean;
  staleLocksRecovered: number;
}

export interface AsoiafAnswerDeskSettleInput {
  root: string;
  leaseId: string;
  completedAt: string;
  outcome: AsoiafAnswerWorkSettlementOutcome;
  afterWorkOrder?: AsoiafAnswerWorkOrder | null;
  resultReferences?: AsoiafAnswerWorkResultReference[];
  reason: string;
  operatorId?: string;
  lockMilliseconds?: number;
}

export interface AsoiafAnswerDeskSettleResult {
  manifest: AsoiafAnswerDeskEstateManifest;
  settlement: AsoiafAnswerWorkSettlement;
  state: AsoiafAnswerDeskState;
  adoptedWorkOrder: AsoiafAnswerDeskWorkOrderRecord | null;
  replayed: boolean;
  staleLocksRecovered: number;
}

export interface AsoiafAnswerDeskEstateFinding {
  code: string;
  severity: "error" | "warning" | "notice";
  subjectId: string;
  detail: string;
}

interface LockResult {
  lock: AsoiafAnswerDeskLock;
  staleLocksRecovered: number;
}

const DEFAULT_LOCK_MILLISECONDS = 30_000;
const MAX_LOCK_MILLISECONDS = 300_000;

function finding(
  code: string,
  severity: AsoiafAnswerDeskEstateFinding["severity"],
  subjectId: string,
  detail: string,
): AsoiafAnswerDeskEstateFinding {
  return { code, severity, subjectId, detail };
}

function sortedFindings(
  findings: readonly AsoiafAnswerDeskEstateFinding[],
): AsoiafAnswerDeskEstateFinding[] {
  const rank = { error: 0, warning: 1, notice: 2 } as const;
  return [...findings].sort(
    (left, right) =>
      rank[left.severity] - rank[right.severity]
      || left.code.localeCompare(right.code)
      || left.subjectId.localeCompare(right.subjectId)
      || left.detail.localeCompare(right.detail),
  );
}

function validTime(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function manifestCore(
  manifest: AsoiafAnswerDeskEstateManifest,
): Omit<AsoiafAnswerDeskEstateManifest, "manifestFingerprint"> {
  const { manifestFingerprint: _fingerprint, ...core } = manifest;
  return core;
}

function workOrderRecordCore(
  record: AsoiafAnswerDeskWorkOrderRecord,
): Omit<AsoiafAnswerDeskWorkOrderRecord, "recordFingerprint"> {
  const { recordFingerprint: _fingerprint, ...core } = record;
  return core;
}

function lockCore(
  lock: AsoiafAnswerDeskLock,
): Omit<AsoiafAnswerDeskLock, "lockId" | "lockFingerprint"> {
  const {
    lockId: _lockId,
    lockFingerprint: _lockFingerprint,
    ...core
  } = lock;
  return core;
}

export function asoiafAnswerDeskEstatePaths(
  root: string,
): AsoiafAnswerDeskEstatePaths {
  const absolute = path.resolve(root);
  const lockDirectory = path.join(absolute, ".transaction-lock");
  return {
    root: absolute,
    manifest: path.join(absolute, "ANSWER-DESK.json"),
    workOrders: path.join(absolute, "work-orders"),
    workOrderLedger: path.join(absolute, "work-orders.ndjson"),
    leases: path.join(absolute, "leases.ndjson"),
    settlements: path.join(absolute, "settlements.ndjson"),
    state: path.join(absolute, "DESK-STATE.json"),
    lockDirectory,
    lockRecord: path.join(lockDirectory, "lock.json"),
  };
}

function ensureParent(target: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
}

function writeJsonAtomic(target: string, value: unknown): void {
  ensureParent(target);
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, target);
}

function readJson<T>(target: string): T {
  return JSON.parse(fs.readFileSync(target, "utf8")) as T;
}

function readJsonOrNull<T>(target: string): T | null {
  if (!fs.existsSync(target)) return null;
  return readJson<T>(target);
}

function readNdjson<T>(target: string): T[] {
  if (!fs.existsSync(target)) return [];
  return fs
    .readFileSync(target, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function appendNdjson(target: string, value: unknown): void {
  ensureParent(target);
  fs.appendFileSync(target, `${JSON.stringify(value)}\n`, "utf8");
}

function relativeUri(root: string, target: string): string {
  return path.relative(path.resolve(root), path.resolve(target)).split(path.sep).join("/");
}

function resolveEstateUri(root: string, uri: string): string | null {
  if (
    !uri.trim()
    || path.isAbsolute(uri)
    || uri.includes("\\")
    || /^[a-z][a-z0-9+.-]*:/i.test(uri)
  ) {
    return null;
  }
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, uri);
  if (target !== absoluteRoot && !target.startsWith(`${absoluteRoot}${path.sep}`)) {
    return null;
  }
  return target;
}

function workOrderFileName(workOrder: AsoiafAnswerWorkOrder): string {
  return `${workOrder.workOrderFingerprint.slice("sha256:".length)}.json`;
}

function workOrderPath(
  paths: AsoiafAnswerDeskEstatePaths,
  workOrder: AsoiafAnswerWorkOrder,
): string {
  return path.join(paths.workOrders, workOrderFileName(workOrder));
}

function validateWorkOrder(workOrder: AsoiafAnswerWorkOrder): void {
  const errors = validateAsoiafAnswerWorkOrder(workOrder)
    .filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `invalid answer work order: ${errors
        .map((entry) => `${entry.code}:${entry.subjectId}`)
        .join(", ")}`,
    );
  }
}

function buildWorkOrderRecord(
  root: string,
  workOrder: AsoiafAnswerWorkOrder,
  adoptedAt: string,
): AsoiafAnswerDeskWorkOrderRecord {
  const paths = asoiafAnswerDeskEstatePaths(root);
  const core = {
    format: ASOIAF_ANSWER_DESK_WORK_ORDER_RECORD_FORMAT,
    workOrderId: workOrder.workOrderId,
    workOrderFingerprint: workOrder.workOrderFingerprint,
    dossierId: workOrder.dossierId,
    questionId: workOrder.questionId,
    createdAt: workOrder.createdAt,
    adoptedAt,
    workOrderUri: relativeUri(root, workOrderPath(paths, workOrder)),
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  return { ...core, recordFingerprint: sha256(core) };
}

function validateWorkOrderRecord(
  root: string,
  record: AsoiafAnswerDeskWorkOrderRecord,
): AsoiafAnswerDeskEstateFinding[] {
  const findings: AsoiafAnswerDeskEstateFinding[] = [];
  if (record.format !== ASOIAF_ANSWER_DESK_WORK_ORDER_RECORD_FORMAT) {
    findings.push(finding("work-order-record-format", "error", record.workOrderId, "desk work-order record format is invalid"));
  }
  if (!validTime(record.createdAt) || !validTime(record.adoptedAt)) {
    findings.push(finding("work-order-record-time", "error", record.workOrderId, "desk work-order record requires valid creation and adoption times"));
  }
  const target = resolveEstateUri(root, record.workOrderUri);
  if (!target) {
    findings.push(finding("work-order-record-uri", "error", record.workOrderId, "desk work-order URI escapes the estate"));
  } else if (!fs.existsSync(target)) {
    findings.push(finding("work-order-record-file", "error", record.workOrderId, "desk work-order file is absent"));
  }
  if (
    record.authority !== "none"
    || record.graphEffect !== "none"
    || record.canonEffect !== "none"
    || record.answerEffect !== "none"
  ) {
    findings.push(finding("work-order-record-authority", "error", record.workOrderId, "desk work-order record acquired execution or authority"));
  }
  if (record.recordFingerprint !== sha256(workOrderRecordCore(record))) {
    findings.push(finding("work-order-record-fingerprint", "error", record.workOrderId, "desk work-order record fingerprint is stale"));
  }
  return findings;
}

function buildManifest(input: {
  prior: AsoiafAnswerDeskEstateManifest | null;
  initializedAt: string;
  updatedAt: string;
  dossierId: string;
  questionId: string;
  latestWorkOrder: AsoiafAnswerWorkOrder;
  workOrderCount: number;
  leaseCount: number;
  settlementCount: number;
  staleLocksRecovered: number;
}): AsoiafAnswerDeskEstateManifest {
  const core = {
    format: ASOIAF_ANSWER_DESK_ESTATE_FORMAT,
    estateId: input.prior?.estateId ?? collectorContentId(
      "asoiaf-answer-desk-estate",
      { dossierId: input.dossierId, questionId: input.questionId },
    ),
    initializedAt: input.prior?.initializedAt ?? input.initializedAt,
    updatedAt: input.updatedAt,
    dossierId: input.dossierId,
    questionId: input.questionId,
    latestWorkOrderId: input.latestWorkOrder.workOrderId,
    latestWorkOrderFingerprint: input.latestWorkOrder.workOrderFingerprint,
    workOrderCount: input.workOrderCount,
    leaseCount: input.leaseCount,
    settlementCount: input.settlementCount,
    staleLockRecoveryCount:
      (input.prior?.staleLockRecoveryCount ?? 0) + input.staleLocksRecovered,
    authority: "none" as const,
    graphEffect: "none" as const,
    canonEffect: "none" as const,
    answerEffect: "none" as const,
  };
  return { ...core, manifestFingerprint: sha256(core) };
}

function buildLock(
  ownerId: string,
  acquiredAt: string,
  lockMilliseconds: number,
): AsoiafAnswerDeskLock {
  const expiresAt = new Date(Date.parse(acquiredAt) + lockMilliseconds).toISOString();
  const core = {
    format: ASOIAF_ANSWER_DESK_LOCK_FORMAT,
    ownerId,
    acquiredAt,
    expiresAt,
    lockMilliseconds,
  };
  const lockFingerprint = sha256(core);
  return {
    ...core,
    lockId: collectorContentId("asoiaf-answer-desk-lock", {
      ownerId,
      acquiredAt,
      lockFingerprint,
    }),
    lockFingerprint,
  };
}

function validLock(lock: AsoiafAnswerDeskLock): boolean {
  if (
    lock.format !== ASOIAF_ANSWER_DESK_LOCK_FORMAT
    || !lock.ownerId.trim()
    || !validTime(lock.acquiredAt)
    || !validTime(lock.expiresAt)
    || !Number.isSafeInteger(lock.lockMilliseconds)
    || lock.lockMilliseconds < 1_000
    || lock.lockMilliseconds > MAX_LOCK_MILLISECONDS
    || Date.parse(lock.expiresAt) - Date.parse(lock.acquiredAt) !== lock.lockMilliseconds
  ) {
    return false;
  }
  const expectedFingerprint = sha256(lockCore(lock));
  return (
    lock.lockFingerprint === expectedFingerprint
    && lock.lockId === collectorContentId("asoiaf-answer-desk-lock", {
      ownerId: lock.ownerId,
      acquiredAt: lock.acquiredAt,
      lockFingerprint: expectedFingerprint,
    })
  );
}

function acquireLock(
  paths: AsoiafAnswerDeskEstatePaths,
  ownerId: string,
  acquiredAt: string,
  lockMilliseconds: number,
): LockResult {
  if (!ownerId.trim()) throw new Error("desk transaction operator identity is required");
  if (!validTime(acquiredAt)) throw new Error("desk transaction time is invalid");
  if (
    !Number.isSafeInteger(lockMilliseconds)
    || lockMilliseconds < 1_000
    || lockMilliseconds > MAX_LOCK_MILLISECONDS
  ) {
    throw new Error("desk transaction lock must remain between one second and five minutes");
  }
  fs.mkdirSync(paths.root, { recursive: true });
  let staleLocksRecovered = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      fs.mkdirSync(paths.lockDirectory);
      const lock = buildLock(ownerId, acquiredAt, lockMilliseconds);
      writeJsonAtomic(paths.lockRecord, lock);
      return { lock, staleLocksRecovered };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      const existing = readJsonOrNull<AsoiafAnswerDeskLock>(paths.lockRecord);
      if (
        existing
        && validLock(existing)
        && Date.parse(existing.expiresAt) > Date.parse(acquiredAt)
      ) {
        throw new Error(
          `answer desk estate is locked by ${existing.ownerId} until ${existing.expiresAt}`,
        );
      }
      const staleTarget = `${paths.lockDirectory}.stale-${process.pid}-${attempt}-${Date.now()}`;
      try {
        fs.renameSync(paths.lockDirectory, staleTarget);
        fs.rmSync(staleTarget, { recursive: true, force: true });
        staleLocksRecovered += 1;
      } catch (recoveryError) {
        const recoveryCode = (recoveryError as NodeJS.ErrnoException).code;
        if (recoveryCode !== "ENOENT") throw recoveryError;
      }
    }
  }
  throw new Error("unable to acquire answer desk estate transaction lock");
}

function releaseLock(
  paths: AsoiafAnswerDeskEstatePaths,
  lockId: string,
): void {
  const current = readJsonOrNull<AsoiafAnswerDeskLock>(paths.lockRecord);
  if (current && current.lockId !== lockId) {
    throw new Error("answer desk transaction lock changed ownership before release");
  }
  fs.rmSync(paths.lockDirectory, { recursive: true, force: true });
}

function withLock<T>(input: {
  root: string;
  operatorId: string;
  at: string;
  lockMilliseconds?: number;
  run: (context: LockResult) => T;
}): T {
  const paths = asoiafAnswerDeskEstatePaths(input.root);
  const context = acquireLock(
    paths,
    input.operatorId,
    input.at,
    input.lockMilliseconds ?? DEFAULT_LOCK_MILLISECONDS,
  );
  try {
    return input.run(context);
  } finally {
    releaseLock(paths, context.lock.lockId);
  }
}

function readManifest(
  paths: AsoiafAnswerDeskEstatePaths,
): AsoiafAnswerDeskEstateManifest {
  if (!fs.existsSync(paths.manifest)) {
    throw new Error("answer desk estate is not initialized");
  }
  return readJson<AsoiafAnswerDeskEstateManifest>(paths.manifest);
}

function readWorkOrderRecords(
  paths: AsoiafAnswerDeskEstatePaths,
): AsoiafAnswerDeskWorkOrderRecord[] {
  return readNdjson<AsoiafAnswerDeskWorkOrderRecord>(paths.workOrderLedger);
}

function workOrdersById(
  root: string,
  records: readonly AsoiafAnswerDeskWorkOrderRecord[],
): Map<string, AsoiafAnswerWorkOrder> {
  const result = new Map<string, AsoiafAnswerWorkOrder>();
  for (const record of records) {
    const target = resolveEstateUri(root, record.workOrderUri);
    if (!target || !fs.existsSync(target)) continue;
    result.set(record.workOrderId, readJson<AsoiafAnswerWorkOrder>(target));
  }
  return result;
}

function currentWorkOrder(
  paths: AsoiafAnswerDeskEstatePaths,
  manifest: AsoiafAnswerDeskEstateManifest,
  records: readonly AsoiafAnswerDeskWorkOrderRecord[],
): AsoiafAnswerWorkOrder {
  const record = records.find((entry) => entry.workOrderId === manifest.latestWorkOrderId);
  if (!record) throw new Error("answer desk manifest latest work order is absent from the ledger");
  const target = resolveEstateUri(paths.root, record.workOrderUri);
  if (!target || !fs.existsSync(target)) {
    throw new Error("answer desk manifest latest work-order file is absent");
  }
  const workOrder = readJson<AsoiafAnswerWorkOrder>(target);
  validateWorkOrder(workOrder);
  if (workOrder.workOrderFingerprint !== manifest.latestWorkOrderFingerprint) {
    throw new Error("answer desk latest work-order fingerprint differs from the manifest");
  }
  return workOrder;
}

function writeWorkOrder(
  paths: AsoiafAnswerDeskEstatePaths,
  workOrder: AsoiafAnswerWorkOrder,
): void {
  const target = workOrderPath(paths, workOrder);
  if (fs.existsSync(target)) {
    const existing = readJson<AsoiafAnswerWorkOrder>(target);
    if (JSON.stringify(existing) !== JSON.stringify(workOrder)) {
      throw new Error(`answer desk work-order file collision at ${target}`);
    }
    return;
  }
  writeJsonAtomic(target, workOrder);
}

function adoptWorkOrderUnderLock(input: {
  paths: AsoiafAnswerDeskEstatePaths;
  workOrder: AsoiafAnswerWorkOrder;
  adoptedAt: string;
  records: AsoiafAnswerDeskWorkOrderRecord[];
  priorManifest: AsoiafAnswerDeskEstateManifest | null;
  requireAdvance: boolean;
}): { record: AsoiafAnswerDeskWorkOrderRecord; replayed: boolean } {
  validateWorkOrder(input.workOrder);
  if (!validTime(input.adoptedAt)) throw new Error("work-order adoption time is invalid");
  if (
    input.priorManifest
    && (
      input.workOrder.dossierId !== input.priorManifest.dossierId
      || input.workOrder.questionId !== input.priorManifest.questionId
    )
  ) {
    throw new Error("answer desk estate cannot mix dossiers or questions");
  }
  const existing = input.records.find(
    (record) => record.workOrderId === input.workOrder.workOrderId,
  );
  if (existing) {
    if (existing.workOrderFingerprint !== input.workOrder.workOrderFingerprint) {
      throw new Error("answer desk work-order identity has conflicting fingerprint");
    }
    writeWorkOrder(input.paths, input.workOrder);
    return { record: existing, replayed: true };
  }
  if (input.priorManifest && input.requireAdvance) {
    const latest = currentWorkOrder(
      input.paths,
      input.priorManifest,
      input.records,
    );
    if (Date.parse(input.workOrder.createdAt) <= Date.parse(latest.createdAt)) {
      throw new Error("new answer desk work order must advance the latest creation time");
    }
  }
  writeWorkOrder(input.paths, input.workOrder);
  const record = buildWorkOrderRecord(
    input.paths.root,
    input.workOrder,
    input.adoptedAt,
  );
  appendNdjson(input.paths.workOrderLedger, record);
  input.records.push(record);
  return { record, replayed: false };
}

function rebuildState(input: {
  paths: AsoiafAnswerDeskEstatePaths;
  workOrder: AsoiafAnswerWorkOrder;
  at: string;
  leases: AsoiafAnswerWorkLease[];
  settlements: AsoiafAnswerWorkSettlement[];
}): AsoiafAnswerDeskState {
  const state = buildAsoiafAnswerDeskState({
    workOrder: input.workOrder,
    leases: input.leases,
    settlements: input.settlements,
    asOf: input.at,
  });
  writeJsonAtomic(input.paths.state, state);
  return state;
}

function writeManifestAndState(input: {
  paths: AsoiafAnswerDeskEstatePaths;
  priorManifest: AsoiafAnswerDeskEstateManifest | null;
  initializedAt: string;
  updatedAt: string;
  latestWorkOrder: AsoiafAnswerWorkOrder;
  records: AsoiafAnswerDeskWorkOrderRecord[];
  leases: AsoiafAnswerWorkLease[];
  settlements: AsoiafAnswerWorkSettlement[];
  staleLocksRecovered: number;
}): { manifest: AsoiafAnswerDeskEstateManifest; state: AsoiafAnswerDeskState } {
  const state = rebuildState({
    paths: input.paths,
    workOrder: input.latestWorkOrder,
    at: input.updatedAt,
    leases: input.leases,
    settlements: input.settlements,
  });
  const manifest = buildManifest({
    prior: input.priorManifest,
    initializedAt: input.initializedAt,
    updatedAt: input.updatedAt,
    dossierId: input.latestWorkOrder.dossierId,
    questionId: input.latestWorkOrder.questionId,
    latestWorkOrder: input.latestWorkOrder,
    workOrderCount: input.records.length,
    leaseCount: input.leases.length,
    settlementCount: input.settlements.length,
    staleLocksRecovered: input.staleLocksRecovered,
  });
  writeJsonAtomic(input.paths.manifest, manifest);
  return { manifest, state };
}

export function adoptAsoiafAnswerDeskWorkOrder(
  input: AsoiafAnswerDeskAdoptInput,
): AsoiafAnswerDeskAdoptResult {
  return withLock({
    root: input.root,
    operatorId: input.operatorId,
    at: input.adoptedAt,
    lockMilliseconds: input.lockMilliseconds,
    run: (lockContext) => {
      const paths = asoiafAnswerDeskEstatePaths(input.root);
      fs.mkdirSync(paths.workOrders, { recursive: true });
      const priorManifest = readJsonOrNull<AsoiafAnswerDeskEstateManifest>(
        paths.manifest,
      );
      const records = readWorkOrderRecords(paths);
      const leases = readNdjson<AsoiafAnswerWorkLease>(paths.leases);
      const settlements = readNdjson<AsoiafAnswerWorkSettlement>(
        paths.settlements,
      );
      const adoption = adoptWorkOrderUnderLock({
        paths,
        workOrder: input.workOrder,
        adoptedAt: input.adoptedAt,
        records,
        priorManifest,
        requireAdvance: priorManifest !== null,
      });
      const latestWorkOrder = adoption.replayed && priorManifest
        && priorManifest.latestWorkOrderId !== input.workOrder.workOrderId
        ? currentWorkOrder(paths, priorManifest, records)
        : input.workOrder;
      const result = writeManifestAndState({
        paths,
        priorManifest,
        initializedAt: input.adoptedAt,
        updatedAt: input.adoptedAt,
        latestWorkOrder,
        records,
        leases,
        settlements,
        staleLocksRecovered: lockContext.staleLocksRecovered,
      });
      return {
        ...result,
        record: adoption.record,
        replayed: adoption.replayed,
        staleLocksRecovered: lockContext.staleLocksRecovered,
      };
    },
  });
}

export function claimAsoiafAnswerDeskWork(
  input: AsoiafAnswerDeskClaimInput,
): AsoiafAnswerDeskClaimResult {
  return withLock({
    root: input.root,
    operatorId: input.operatorId ?? input.workerId,
    at: input.claimedAt,
    lockMilliseconds: input.lockMilliseconds,
    run: (lockContext) => {
      const paths = asoiafAnswerDeskEstatePaths(input.root);
      const priorManifest = readManifest(paths);
      const records = readWorkOrderRecords(paths);
      const workOrder = currentWorkOrder(paths, priorManifest, records);
      const leases = readNdjson<AsoiafAnswerWorkLease>(paths.leases);
      const settlements = readNdjson<AsoiafAnswerWorkSettlement>(
        paths.settlements,
      );
      const existing = leases.find(
        (lease) =>
          lease.workOrderId === workOrder.workOrderId
          && lease.itemId === input.itemId
          && lease.workerId === input.workerId
          && lease.claimedAt === input.claimedAt
          && lease.leaseMilliseconds === input.leaseMilliseconds,
      );
      let lease: AsoiafAnswerWorkLease;
      let replayed = false;
      if (existing) {
        const errors = validateAsoiafAnswerWorkLease(existing, workOrder)
          .filter((entry) => entry.severity === "error");
        if (errors.length > 0) {
          throw new Error(`stored answer work lease ${existing.leaseId} is invalid`);
        }
        lease = existing;
        replayed = true;
      } else {
        const currentLeases = leases.filter(
          (entry) => entry.workOrderId === workOrder.workOrderId,
        );
        const currentLeaseIds = new Set(
          currentLeases.map((entry) => entry.leaseId),
        );
        const currentSettlements = settlements.filter((entry) =>
          currentLeaseIds.has(entry.leaseId),
        );
        lease = claimAsoiafAnswerWorkItem({
          workOrder,
          itemId: input.itemId,
          workerId: input.workerId,
          claimedAt: input.claimedAt,
          leaseMilliseconds: input.leaseMilliseconds,
          existingLeases: currentLeases,
          settlements: currentSettlements,
        });
        appendNdjson(paths.leases, lease);
        leases.push(lease);
      }
      const result = writeManifestAndState({
        paths,
        priorManifest,
        initializedAt: priorManifest.initializedAt,
        updatedAt: input.claimedAt,
        latestWorkOrder: workOrder,
        records,
        leases,
        settlements,
        staleLocksRecovered: lockContext.staleLocksRecovered,
      });
      return {
        ...result,
        lease,
        replayed,
        staleLocksRecovered: lockContext.staleLocksRecovered,
      };
    },
  });
}

function settlementMatchesInput(
  settlement: AsoiafAnswerWorkSettlement,
  input: AsoiafAnswerDeskSettleInput,
): boolean {
  return (
    settlement.outcome === input.outcome
    && settlement.completedAt === input.completedAt
    && settlement.reason === input.reason
    && settlement.afterWorkOrderId === (input.afterWorkOrder?.workOrderId ?? null)
    && JSON.stringify(settlement.resultReferences)
      === JSON.stringify(
        [...(input.resultReferences ?? [])].sort(
          (left, right) =>
            left.kind.localeCompare(right.kind)
            || left.objectId.localeCompare(right.objectId)
            || left.fingerprint.localeCompare(right.fingerprint)
            || (left.uri ?? "").localeCompare(right.uri ?? ""),
        ),
      )
  );
}

export function settleAsoiafAnswerDeskWork(
  input: AsoiafAnswerDeskSettleInput,
): AsoiafAnswerDeskSettleResult {
  return withLock({
    root: input.root,
    operatorId: input.operatorId ?? `settle:${input.leaseId}`,
    at: input.completedAt,
    lockMilliseconds: input.lockMilliseconds,
    run: (lockContext) => {
      const paths = asoiafAnswerDeskEstatePaths(input.root);
      const priorManifest = readManifest(paths);
      const records = readWorkOrderRecords(paths);
      const orders = workOrdersById(paths.root, records);
      const leases = readNdjson<AsoiafAnswerWorkLease>(paths.leases);
      const settlements = readNdjson<AsoiafAnswerWorkSettlement>(
        paths.settlements,
      );
      const lease = leases.find((entry) => entry.leaseId === input.leaseId);
      if (!lease) throw new Error(`answer work lease ${input.leaseId} is absent`);
      const beforeWorkOrder = orders.get(lease.workOrderId);
      if (!beforeWorkOrder) {
        throw new Error(`before work order ${lease.workOrderId} is absent`);
      }
      const existing = settlements.find((entry) => entry.leaseId === lease.leaseId);
      if (existing) {
        if (!settlementMatchesInput(existing, input)) {
          throw new Error(`answer work lease ${lease.leaseId} already has a different settlement`);
        }
        const latest = currentWorkOrder(paths, priorManifest, records);
        const state = readJson<AsoiafAnswerDeskState>(paths.state);
        return {
          manifest: priorManifest,
          settlement: existing,
          state,
          adoptedWorkOrder: input.afterWorkOrder
            ? records.find((record) => record.workOrderId === input.afterWorkOrder?.workOrderId) ?? null
            : null,
          replayed: true,
          staleLocksRecovered: lockContext.staleLocksRecovered,
        };
      }

      const current = currentWorkOrder(paths, priorManifest, records);
      let afterWorkOrder = input.afterWorkOrder ?? null;
      let adoption: { record: AsoiafAnswerDeskWorkOrderRecord; replayed: boolean } | null = null;
      if (afterWorkOrder) {
        validateWorkOrder(afterWorkOrder);
        if (
          afterWorkOrder.dossierId !== priorManifest.dossierId
          || afterWorkOrder.questionId !== priorManifest.questionId
        ) {
          throw new Error("settlement after work order crosses the desk dossier or question");
        }
        if (
          current.workOrderId !== beforeWorkOrder.workOrderId
          && current.workOrderId !== afterWorkOrder.workOrderId
        ) {
          throw new Error("settlement before and after heads are both stale relative to the desk");
        }
        adoption = adoptWorkOrderUnderLock({
          paths,
          workOrder: afterWorkOrder,
          adoptedAt: input.completedAt,
          records,
          priorManifest,
          requireAdvance: current.workOrderId === beforeWorkOrder.workOrderId,
        });
      } else if (
        current.workOrderId !== beforeWorkOrder.workOrderId
        && input.outcome !== "stale"
      ) {
        throw new Error("lease work-order head changed before a non-stale settlement");
      }
      if (input.outcome === "stale" && !afterWorkOrder) {
        afterWorkOrder = current;
      }

      const settlement = settleAsoiafAnswerWorkItem({
        lease,
        beforeWorkOrder,
        completedAt: input.completedAt,
        outcome: input.outcome,
        afterWorkOrder,
        resultReferences: input.resultReferences,
        reason: input.reason,
        priorSettlements: settlements,
      });
      appendNdjson(paths.settlements, settlement);
      settlements.push(settlement);

      const latestWorkOrder = afterWorkOrder && (
        input.outcome === "satisfied"
        || input.outcome === "preserved-as-limitation"
        || input.outcome === "stale"
      )
        ? afterWorkOrder
        : current;
      const result = writeManifestAndState({
        paths,
        priorManifest,
        initializedAt: priorManifest.initializedAt,
        updatedAt: input.completedAt,
        latestWorkOrder,
        records,
        leases,
        settlements,
        staleLocksRecovered: lockContext.staleLocksRecovered,
      });
      return {
        ...result,
        settlement,
        adoptedWorkOrder: adoption?.record ?? null,
        replayed: false,
        staleLocksRecovered: lockContext.staleLocksRecovered,
      };
    },
  });
}

export function readAsoiafAnswerDeskStatus(
  root: string,
): {
  manifest: AsoiafAnswerDeskEstateManifest;
  state: AsoiafAnswerDeskState;
  workOrders: AsoiafAnswerDeskWorkOrderRecord[];
  leases: AsoiafAnswerWorkLease[];
  settlements: AsoiafAnswerWorkSettlement[];
} {
  const paths = asoiafAnswerDeskEstatePaths(root);
  return {
    manifest: readManifest(paths),
    state: readJson<AsoiafAnswerDeskState>(paths.state),
    workOrders: readWorkOrderRecords(paths),
    leases: readNdjson<AsoiafAnswerWorkLease>(paths.leases),
    settlements: readNdjson<AsoiafAnswerWorkSettlement>(paths.settlements),
  };
}

export function refreshAsoiafAnswerDeskState(
  root: string,
  at: string,
  operatorId = "answer-desk:refresh",
): AsoiafAnswerDeskState {
  return withLock({
    root,
    operatorId,
    at,
    run: (lockContext) => {
      const paths = asoiafAnswerDeskEstatePaths(root);
      const priorManifest = readManifest(paths);
      const records = readWorkOrderRecords(paths);
      const workOrder = currentWorkOrder(paths, priorManifest, records);
      const leases = readNdjson<AsoiafAnswerWorkLease>(paths.leases);
      const settlements = readNdjson<AsoiafAnswerWorkSettlement>(paths.settlements);
      const result = writeManifestAndState({
        paths,
        priorManifest,
        initializedAt: priorManifest.initializedAt,
        updatedAt: at,
        latestWorkOrder: workOrder,
        records,
        leases,
        settlements,
        staleLocksRecovered: lockContext.staleLocksRecovered,
      });
      return result.state;
    },
  });
}

export function verifyAsoiafAnswerDeskEstate(
  root: string,
): AsoiafAnswerDeskEstateFinding[] {
  const findings: AsoiafAnswerDeskEstateFinding[] = [];
  const paths = asoiafAnswerDeskEstatePaths(root);
  if (!fs.existsSync(paths.manifest)) {
    return [finding("manifest-missing", "error", paths.manifest, "answer desk manifest is absent")];
  }
  let manifest: AsoiafAnswerDeskEstateManifest;
  let records: AsoiafAnswerDeskWorkOrderRecord[];
  let leases: AsoiafAnswerWorkLease[];
  let settlements: AsoiafAnswerWorkSettlement[];
  let state: AsoiafAnswerDeskState;
  try {
    manifest = readJson<AsoiafAnswerDeskEstateManifest>(paths.manifest);
    records = readWorkOrderRecords(paths);
    leases = readNdjson<AsoiafAnswerWorkLease>(paths.leases);
    settlements = readNdjson<AsoiafAnswerWorkSettlement>(paths.settlements);
    state = readJson<AsoiafAnswerDeskState>(paths.state);
  } catch (error) {
    return [
      finding(
        "estate-json",
        "error",
        paths.root,
        error instanceof Error ? error.message : String(error),
      ),
    ];
  }
  if (manifest.format !== ASOIAF_ANSWER_DESK_ESTATE_FORMAT) {
    findings.push(finding("manifest-format", "error", manifest.estateId, "answer desk manifest format is invalid"));
  }
  if (manifest.manifestFingerprint !== sha256(manifestCore(manifest))) {
    findings.push(finding("manifest-fingerprint", "error", manifest.estateId, "answer desk manifest fingerprint is stale"));
  }
  if (
    manifest.authority !== "none"
    || manifest.graphEffect !== "none"
    || manifest.canonEffect !== "none"
    || manifest.answerEffect !== "none"
  ) {
    findings.push(finding("manifest-authority", "error", manifest.estateId, "answer desk manifest acquired execution or authority"));
  }
  if (
    manifest.workOrderCount !== records.length
    || manifest.leaseCount !== leases.length
    || manifest.settlementCount !== settlements.length
  ) {
    findings.push(finding("manifest-counts", "error", manifest.estateId, "answer desk manifest counts differ from append-only ledgers"));
  }
  const recordIds = new Set<string>();
  const orders = new Map<string, AsoiafAnswerWorkOrder>();
  let previousCreatedAt: string | null = null;
  for (const record of records) {
    findings.push(...validateWorkOrderRecord(root, record));
    if (recordIds.has(record.workOrderId)) {
      findings.push(finding("work-order-record-duplicate", "error", record.workOrderId, "desk work-order record identity is duplicated"));
    }
    recordIds.add(record.workOrderId);
    if (record.dossierId !== manifest.dossierId || record.questionId !== manifest.questionId) {
      findings.push(finding("work-order-record-scope", "error", record.workOrderId, "desk work-order record crosses the manifest dossier or question"));
    }
    if (previousCreatedAt && Date.parse(record.createdAt) <= Date.parse(previousCreatedAt)) {
      findings.push(finding("work-order-record-order", "error", record.workOrderId, "desk work-order creation times do not strictly advance"));
    }
    previousCreatedAt = record.createdAt;
    const target = resolveEstateUri(root, record.workOrderUri);
    if (!target || !fs.existsSync(target)) continue;
    try {
      const workOrder = readJson<AsoiafAnswerWorkOrder>(target);
      const errors = validateAsoiafAnswerWorkOrder(workOrder)
        .filter((entry) => entry.severity === "error");
      for (const error of errors) {
        findings.push(finding(`work-order:${error.code}`, "error", error.subjectId, error.detail));
      }
      if (
        workOrder.workOrderId !== record.workOrderId
        || workOrder.workOrderFingerprint !== record.workOrderFingerprint
        || workOrder.dossierId !== record.dossierId
        || workOrder.questionId !== record.questionId
        || workOrder.createdAt !== record.createdAt
      ) {
        findings.push(finding("work-order-record-parity", "error", record.workOrderId, "stored work order differs from its append-only record"));
      }
      orders.set(workOrder.workOrderId, workOrder);
    } catch (error) {
      findings.push(finding("work-order-json", "error", record.workOrderId, error instanceof Error ? error.message : String(error)));
    }
  }
  const latest = orders.get(manifest.latestWorkOrderId);
  if (
    !latest
    || latest.workOrderFingerprint !== manifest.latestWorkOrderFingerprint
    || records.at(-1)?.workOrderId !== manifest.latestWorkOrderId
  ) {
    findings.push(finding("manifest-latest-work-order", "error", manifest.estateId, "answer desk manifest does not identify the last valid work-order record"));
  }
  const leaseIds = new Set<string>();
  for (const lease of leases) {
    if (leaseIds.has(lease.leaseId)) {
      findings.push(finding("lease-duplicate", "error", lease.leaseId, "answer desk lease identity is duplicated"));
    }
    leaseIds.add(lease.leaseId);
    const workOrder = orders.get(lease.workOrderId);
    if (!workOrder) {
      findings.push(finding("lease-work-order-missing", "error", lease.leaseId, "answer desk lease references an absent work order"));
      continue;
    }
    for (const error of validateAsoiafAnswerWorkLease(lease, workOrder)
      .filter((entry) => entry.severity === "error")) {
      findings.push(finding(`lease:${error.code}`, "error", error.subjectId, error.detail));
    }
  }
  const settlementsByLease = new Map<string, AsoiafAnswerWorkSettlement>();
  for (const settlement of settlements) {
    if (settlementsByLease.has(settlement.leaseId)) {
      findings.push(finding("settlement-duplicate-lease", "error", settlement.leaseId, "answer desk lease has multiple settlements"));
    }
    settlementsByLease.set(settlement.leaseId, settlement);
    const lease = leases.find((entry) => entry.leaseId === settlement.leaseId);
    if (!lease) {
      findings.push(finding("settlement-lease-missing", "error", settlement.settlementId, "answer desk settlement references an absent lease"));
      continue;
    }
    const beforeWorkOrder = orders.get(settlement.beforeWorkOrderId);
    const afterWorkOrder = settlement.afterWorkOrderId
      ? orders.get(settlement.afterWorkOrderId) ?? null
      : null;
    if (!beforeWorkOrder) {
      findings.push(finding("settlement-before-work-order-missing", "error", settlement.settlementId, "answer desk settlement before work order is absent"));
      continue;
    }
    if (settlement.afterWorkOrderId && !afterWorkOrder) {
      findings.push(finding("settlement-after-work-order-missing", "error", settlement.settlementId, "answer desk settlement after work order is absent"));
      continue;
    }
    for (const error of validateAsoiafAnswerWorkSettlement(settlement, {
      lease,
      beforeWorkOrder,
      afterWorkOrder,
    }).filter((entry) => entry.severity === "error")) {
      findings.push(finding(`settlement:${error.code}`, "error", error.subjectId, error.detail));
    }
  }
  if (latest) {
    for (const error of validateAsoiafAnswerDeskState(state, {
      workOrder: latest,
      leases,
      settlements,
      asOf: state.asOf,
    }).filter((entry) => entry.severity === "error")) {
      findings.push(finding(`state:${error.code}`, "error", error.subjectId, error.detail));
    }
    if (manifest.updatedAt !== state.asOf) {
      findings.push(finding("manifest-state-time", "error", manifest.estateId, "answer desk manifest and state times differ"));
    }
  }
  if (fs.existsSync(paths.lockDirectory)) {
    const lock = readJsonOrNull<AsoiafAnswerDeskLock>(paths.lockRecord);
    if (!lock || !validLock(lock)) {
      findings.push(finding("transaction-lock-invalid", "error", paths.lockDirectory, "answer desk transaction lock is malformed"));
    } else {
      findings.push(finding("transaction-lock-present", "warning", lock.lockId, `answer desk estate is currently locked by ${lock.ownerId} until ${lock.expiresAt}`));
    }
  }
  return sortedFindings(findings);
}