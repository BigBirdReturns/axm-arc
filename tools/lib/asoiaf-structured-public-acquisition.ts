import fs from "node:fs";
import path from "node:path";
import {
  getAsoiafExternalSource,
} from "../../src/narrative/canon/asoiaf/external/index.js";
import {
  commitAsoiafStructuredPayload,
  type AsoiafStructuredAdapterReceipt,
  type AsoiafStructuredAdapterResult,
  type AsoiafStructuredRequestPlan,
} from "./asoiaf-structured-public-adapters.js";
import {
  collectorContentId,
  initializeCollectorEstate,
  readJson,
  recordAttempt,
  recordGap,
  sha256,
  writeJsonAtomic,
  type CollectorAttemptRecord,
  type CollectorGapRecord,
} from "./asoiaf-external-estate.js";

export const ASOIAF_STRUCTURED_ACQUISITION_RECEIPT_FORMAT =
  "axm-asoiaf-structured-acquisition-receipt/1" as const;
export const ASOIAF_STRUCTURED_ACQUISITION_STATE_FORMAT =
  "axm-asoiaf-structured-acquisition-state/1" as const;

export type AsoiafStructuredAcquisitionOutcome =
  | "observed"
  | "partial"
  | "refused"
  | "cache-hit"
  | "blocked-robots"
  | "blocked-credential"
  | "unavailable"
  | "rejected-oversize"
  | "invalid-response"
  | "error";

export interface AsoiafStructuredAcquisitionReceipt {
  format: typeof ASOIAF_STRUCTURED_ACQUISITION_RECEIPT_FORMAT;
  receiptId: string;
  planFingerprint: `sha256:${string}`;
  adapterId: AsoiafStructuredRequestPlan["adapterId"];
  sourceId: AsoiafStructuredRequestPlan["sourceId"];
  requestId: string;
  requestedUrl: string;
  finalUrl: string | null;
  retrievedAt: string;
  completedAt: string;
  requestCount: number;
  waitedMilliseconds: number;
  redirectCount: number;
  robotsUrl: string;
  robotsStatus: "allowed" | "denied" | "absent" | "unavailable";
  robotsDigest: `sha256:${string}` | null;
  httpStatus: number | null;
  responseMediaType: string | null;
  responseBytes: number;
  sourceResponseDigest: `sha256:${string}` | null;
  adapterReceiptFingerprint: `sha256:${string}` | null;
  committedRecordCount: number;
  observationIds: string[];
  candidateIds: string[];
  gapId: string | null;
  outcome: AsoiafStructuredAcquisitionOutcome;
  rawResponseRetained: false;
  graphEffect: "none";
  canonEffect: "none";
  receiptFingerprint: `sha256:${string}`;
}

export interface AsoiafStructuredAcquisitionStateEntry {
  requestId: string;
  planFingerprint: `sha256:${string}`;
  receiptUri: string;
  completedAt: string;
  outcome: "observed" | "partial";
}

export interface AsoiafStructuredAcquisitionState {
  format: typeof ASOIAF_STRUCTURED_ACQUISITION_STATE_FORMAT;
  entries: AsoiafStructuredAcquisitionStateEntry[];
  stateFingerprint: `sha256:${string}`;
}

export interface AsoiafStructuredAcquisitionRuntime {
  fetch(url: string, init: RequestInit): Promise<Response>;
  sleep(milliseconds: number): Promise<void>;
  nowMilliseconds(): number;
}

export interface ExecuteAsoiafStructuredAcquisitionOptions {
  root: string;
  plan: AsoiafStructuredRequestPlan;
  runtime?: AsoiafStructuredAcquisitionRuntime;
  retrievedAt?: string;
  refresh?: boolean;
  includeText?: boolean;
  maxTextCharacters?: number;
  maxRedirects?: number;
}

export interface AsoiafStructuredAcquisitionResult {
  receipt: AsoiafStructuredAcquisitionReceipt;
  cacheHit: boolean;
  adapterResult: AsoiafStructuredAdapterResult | null;
  attempt: CollectorAttemptRecord;
  gap: CollectorGapRecord | null;
}

interface FetchTrace {
  response: Response | null;
  finalUrl: string;
  requestCount: number;
  waitedMilliseconds: number;
  redirectCount: number;
  error: string | null;
}

interface BoundedJsonResponse {
  payload: unknown;
  bytes: number;
  mediaType: string;
  digest: `sha256:${string}`;
}

interface RobotsEvaluation {
  status: "allowed" | "denied" | "absent" | "unavailable";
  digest: `sha256:${string}` | null;
  crawlDelayMilliseconds: number;
  requestCount: number;
  waitedMilliseconds: number;
  error: string | null;
}

interface RobotsRule {
  kind: "allow" | "disallow";
  path: string;
}

interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelayMilliseconds: number;
}

const ALLOWED_ENDPOINTS: Record<
  AsoiafStructuredRequestPlan["adapterId"],
  { host: string; path: RegExp }
> = {
  "wikidata-sparql": {
    host: "query.wikidata.org",
    path: /^\/sparql$/,
  },
  "openlibrary-catalog": {
    host: "openlibrary.org",
    path: /^(?:\/search\.json|\/(?:works|books)\/[^/]+\.json)$/,
  },
  "crossref-works": {
    host: "api.crossref.org",
    path: /^\/works(?:\/[^/]+)?$/,
  },
  "awoiaf-mediawiki": {
    host: "awoiaf.westeros.org",
    path: /^\/api\.php$/,
  },
};

const ROBOTS_AGENT_TOKEN = "BigBirdReturns-ASOIAF-External-Collector";

class DefaultStructuredAcquisitionRuntime
implements AsoiafStructuredAcquisitionRuntime {
  fetch(url: string, init: RequestInit): Promise<Response> {
    return globalThis.fetch(url, init);
  }

  sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  nowMilliseconds(): number {
    return Date.now();
  }
}

class HostPacer {
  private readonly lastStartedByOrigin = new Map<string, number>();

  constructor(private readonly runtime: AsoiafStructuredAcquisitionRuntime) {}

  async wait(url: string, delayMilliseconds: number): Promise<number> {
    const origin = new URL(url).origin;
    const now = this.runtime.nowMilliseconds();
    const previous = this.lastStartedByOrigin.get(origin);
    const remaining = previous === undefined
      ? 0
      : Math.max(0, delayMilliseconds - (now - previous));
    if (remaining > 0) await this.runtime.sleep(remaining);
    this.lastStartedByOrigin.set(origin, this.runtime.nowMilliseconds());
    return remaining;
  }
}

function statePath(root: string): string {
  return path.join(path.resolve(root), "structured-acquisition-state.json");
}

function receiptDirectory(root: string): string {
  return path.join(path.resolve(root), "structured-acquisition-receipts");
}

function relativeEstateUri(root: string, target: string): string {
  return path.relative(path.resolve(root), path.resolve(target)).split(path.sep).join("/");
}

function safeEstatePath(root: string, relativeUri: string): string | null {
  if (!relativeUri.trim() || path.isAbsolute(relativeUri)) return null;
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, relativeUri);
  if (target !== absoluteRoot && !target.startsWith(`${absoluteRoot}${path.sep}`)) {
    return null;
  }
  return target;
}

function emptyState(): AsoiafStructuredAcquisitionState {
  const core = {
    format: ASOIAF_STRUCTURED_ACQUISITION_STATE_FORMAT,
    entries: [] as AsoiafStructuredAcquisitionStateEntry[],
  };
  return { ...core, stateFingerprint: sha256(core) };
}

function stateCore(
  state: AsoiafStructuredAcquisitionState,
): Omit<AsoiafStructuredAcquisitionState, "stateFingerprint"> {
  const { stateFingerprint: _fingerprint, ...core } = state;
  return core;
}

function readState(root: string): AsoiafStructuredAcquisitionState {
  const state = readJson<AsoiafStructuredAcquisitionState>(statePath(root), emptyState());
  if (
    state.format !== ASOIAF_STRUCTURED_ACQUISITION_STATE_FORMAT
    || state.stateFingerprint !== sha256(stateCore(state))
  ) {
    throw new Error("structured acquisition state failed fingerprint custody");
  }
  return state;
}

function writeState(
  root: string,
  entries: readonly AsoiafStructuredAcquisitionStateEntry[],
): AsoiafStructuredAcquisitionState {
  const ordered = [...entries].sort(
    (left, right) =>
      left.requestId.localeCompare(right.requestId)
      || left.planFingerprint.localeCompare(right.planFingerprint),
  );
  const core = {
    format: ASOIAF_STRUCTURED_ACQUISITION_STATE_FORMAT,
    entries: ordered,
  };
  const state = { ...core, stateFingerprint: sha256(core) };
  writeJsonAtomic(statePath(root), state);
  return state;
}

function upsertStateEntry(
  root: string,
  entry: AsoiafStructuredAcquisitionStateEntry,
): void {
  const state = readState(root);
  const entries = state.entries.filter(
    (current) => current.requestId !== entry.requestId,
  );
  entries.push(entry);
  writeState(root, entries);
}

function planCore(
  plan: AsoiafStructuredRequestPlan,
): Omit<AsoiafStructuredRequestPlan, "planFingerprint"> {
  const { planFingerprint: _fingerprint, ...core } = plan;
  return core;
}

export function validateAsoiafStructuredRequestPlan(
  plan: AsoiafStructuredRequestPlan,
): string[] {
  const errors: string[] = [];
  if (plan.planFingerprint !== sha256(planCore(plan))) {
    errors.push("request plan fingerprint mismatch");
  }
  if (plan.method !== "GET") errors.push("structured acquisition requires GET");
  if (plan.graphEffect !== "none" || plan.canonEffect !== "none") {
    errors.push("request plan acquired graph or canon effect");
  }
  if (!Number.isSafeInteger(plan.recordLimit) || plan.recordLimit < 1 || plan.recordLimit > 500) {
    errors.push("request plan record limit is outside 1 through 500");
  }
  const source = getAsoiafExternalSource(plan.sourceId);
  if (!source) {
    errors.push(`unknown atlas source ${plan.sourceId}`);
  } else if (source.harvestPolicy.mode !== "structured-cache-with-attribution") {
    errors.push(`${plan.sourceId} does not authorize structured acquisition`);
  }
  try {
    const url = new URL(plan.url);
    const allowed = ALLOWED_ENDPOINTS[plan.adapterId];
    if (url.protocol !== "https:") errors.push("request plan is not HTTPS");
    if (url.hostname !== allowed.host || !allowed.path.test(url.pathname)) {
      errors.push(`request plan escaped the registered ${plan.adapterId} endpoint`);
    }
    if (url.username || url.password || url.hash) {
      errors.push("request plan contains credentials or a fragment");
    }
  } catch {
    errors.push("request plan URL is invalid");
  }
  if (!/^application\/(?:json|sparql-results\+json)$/i.test(plan.responseMediaType)) {
    errors.push("request plan declares an unsupported response media type");
  }
  return [...new Set(errors)].sort();
}

function retryAfterMilliseconds(value: string | null, now: number): number | null {
  if (!value) return null;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(300_000, Math.ceil(seconds * 1_000));
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.min(300_000, Math.max(0, date - now));
}

async function fetchWithPolicy(input: {
  runtime: AsoiafStructuredAcquisitionRuntime;
  pacer: HostPacer;
  url: string;
  headers: Record<string, string>;
  hostDelayMilliseconds: number;
  retryCount: number;
  maxRedirects: number;
}): Promise<FetchTrace> {
  let currentUrl = input.url;
  let requestCount = 0;
  let waitedMilliseconds = 0;
  let redirectCount = 0;
  let transientAttempt = 0;

  while (true) {
    waitedMilliseconds += await input.pacer.wait(
      currentUrl,
      input.hostDelayMilliseconds,
    );
    requestCount += 1;
    let response: Response;
    try {
      response = await input.runtime.fetch(currentUrl, {
        method: "GET",
        headers: input.headers,
        redirect: "manual",
      });
    } catch (error) {
      if (transientAttempt >= input.retryCount) {
        return {
          response: null,
          finalUrl: currentUrl,
          requestCount,
          waitedMilliseconds,
          redirectCount,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      const delay = Math.min(30_000, 1_000 * 2 ** transientAttempt);
      await input.runtime.sleep(delay);
      waitedMilliseconds += delay;
      transientAttempt += 1;
      continue;
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        return {
          response,
          finalUrl: currentUrl,
          requestCount,
          waitedMilliseconds,
          redirectCount,
          error: "redirect response omitted Location",
        };
      }
      if (redirectCount >= input.maxRedirects) {
        return {
          response,
          finalUrl: currentUrl,
          requestCount,
          waitedMilliseconds,
          redirectCount,
          error: "redirect ceiling exceeded",
        };
      }
      const redirected = new URL(location, currentUrl);
      const current = new URL(currentUrl);
      if (redirected.protocol !== "https:" || redirected.origin !== current.origin) {
        return {
          response,
          finalUrl: redirected.toString(),
          requestCount,
          waitedMilliseconds,
          redirectCount,
          error: "cross-origin or non-HTTPS redirect refused",
        };
      }
      currentUrl = redirected.toString();
      redirectCount += 1;
      transientAttempt = 0;
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      if (transientAttempt >= input.retryCount) {
        return {
          response,
          finalUrl: currentUrl,
          requestCount,
          waitedMilliseconds,
          redirectCount,
          error: null,
        };
      }
      const retryAfter = retryAfterMilliseconds(
        response.headers.get("retry-after"),
        input.runtime.nowMilliseconds(),
      );
      const delay = retryAfter
        ?? Math.min(30_000, 1_000 * 2 ** transientAttempt);
      await input.runtime.sleep(delay);
      waitedMilliseconds += delay;
      transientAttempt += 1;
      continue;
    }

    return {
      response,
      finalUrl: currentUrl,
      requestCount,
      waitedMilliseconds,
      redirectCount,
      error: null,
    };
  }
}

function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let agents: string[] = [];
  let rules: RobotsRule[] = [];
  let crawlDelayMilliseconds = 0;

  const flush = () => {
    if (agents.length > 0) {
      groups.push({
        agents: [...agents],
        rules: [...rules],
        crawlDelayMilliseconds,
      });
    }
    agents = [];
    rules = [];
    crawlDelayMilliseconds = 0;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (rules.length > 0 || crawlDelayMilliseconds > 0) flush();
      agents.push(value.toLowerCase());
    } else if (key === "allow" || key === "disallow") {
      if (agents.length > 0) {
        rules.push({ kind: key, path: value });
      }
    } else if (key === "crawl-delay" && agents.length > 0) {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) {
        crawlDelayMilliseconds = Math.min(300_000, Math.ceil(seconds * 1_000));
      }
    }
  }
  flush();
  return groups;
}

function robotsAllowed(input: {
  groups: readonly RobotsGroup[];
  url: string;
  agentToken: string;
}): { allowed: boolean; crawlDelayMilliseconds: number } {
  const normalizedAgent = input.agentToken.toLowerCase();
  const matching = input.groups.flatMap((group) => {
    const specificity = Math.max(
      ...group.agents.map((agent) =>
        agent === "*"
          ? 0
          : normalizedAgent.includes(agent)
            ? agent.length
            : -1,
      ),
    );
    return specificity >= 0 ? [{ group, specificity }] : [];
  });
  if (matching.length === 0) return { allowed: true, crawlDelayMilliseconds: 0 };
  const maximum = Math.max(...matching.map((entry) => entry.specificity));
  const selected = matching
    .filter((entry) => entry.specificity === maximum)
    .map((entry) => entry.group);
  const target = `${new URL(input.url).pathname}${new URL(input.url).search}`;
  const matchingRules = selected
    .flatMap((group) => group.rules)
    .filter((rule) => rule.path && target.startsWith(rule.path))
    .sort(
      (left, right) =>
        right.path.length - left.path.length
        || (left.kind === "allow" ? -1 : 1),
    );
  return {
    allowed: matchingRules[0]?.kind !== "disallow",
    crawlDelayMilliseconds: Math.max(
      0,
      ...selected.map((group) => group.crawlDelayMilliseconds),
    ),
  };
}

async function evaluateRobots(input: {
  runtime: AsoiafStructuredAcquisitionRuntime;
  pacer: HostPacer;
  targetUrl: string;
  headers: Record<string, string>;
  hostDelayMilliseconds: number;
  retryCount: number;
  maxRedirects: number;
}): Promise<RobotsEvaluation> {
  const target = new URL(input.targetUrl);
  const robotsUrl = `${target.origin}/robots.txt`;
  const trace = await fetchWithPolicy({
    runtime: input.runtime,
    pacer: input.pacer,
    url: robotsUrl,
    headers: {
      "User-Agent": input.headers["User-Agent"] ?? ROBOTS_AGENT_TOKEN,
      Accept: "text/plain",
    },
    hostDelayMilliseconds: input.hostDelayMilliseconds,
    retryCount: input.retryCount,
    maxRedirects: input.maxRedirects,
  });
  if (!trace.response) {
    return {
      status: "unavailable",
      digest: null,
      crawlDelayMilliseconds: 0,
      requestCount: trace.requestCount,
      waitedMilliseconds: trace.waitedMilliseconds,
      error: trace.error ?? "robots request failed",
    };
  }
  if (trace.response.status === 404 || trace.response.status === 410) {
    return {
      status: "absent",
      digest: null,
      crawlDelayMilliseconds: 0,
      requestCount: trace.requestCount,
      waitedMilliseconds: trace.waitedMilliseconds,
      error: null,
    };
  }
  if (!trace.response.ok) {
    return {
      status: "unavailable",
      digest: null,
      crawlDelayMilliseconds: 0,
      requestCount: trace.requestCount,
      waitedMilliseconds: trace.waitedMilliseconds,
      error: `robots returned HTTP ${trace.response.status}`,
    };
  }
  const text = await trace.response.text();
  const digest = sha256(Buffer.from(text, "utf8"));
  const evaluated = robotsAllowed({
    groups: parseRobots(text),
    url: input.targetUrl,
    agentToken: ROBOTS_AGENT_TOKEN,
  });
  return {
    status: evaluated.allowed ? "allowed" : "denied",
    digest,
    crawlDelayMilliseconds: evaluated.crawlDelayMilliseconds,
    requestCount: trace.requestCount,
    waitedMilliseconds: trace.waitedMilliseconds,
    error: null,
  };
}

function responseMediaType(response: Response): string {
  return (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]!
    .trim()
    .toLowerCase();
}

async function boundedJson(
  response: Response,
  maximumBytes: number,
): Promise<BoundedJsonResponse> {
  const mediaType = responseMediaType(response);
  if (!/^application\/(?:json|sparql-results\+json|[^;]+\+json)$/.test(mediaType)) {
    throw new Error(`response media type ${mediaType || "missing"} is not JSON`);
  }
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) {
    throw new RangeError(`response Content-Length ${declared} exceeds ${maximumBytes}`);
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel();
        throw new RangeError(`response body exceeds ${maximumBytes} bytes`);
      }
      chunks.push(next.value);
    }
  }
  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const text = buffer.toString("utf8");
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new SyntaxError("response body is not valid JSON");
  }
  return {
    payload,
    bytes,
    mediaType,
    digest: sha256(buffer),
  };
}

function receiptCore(
  receipt: AsoiafStructuredAcquisitionReceipt,
): Omit<AsoiafStructuredAcquisitionReceipt, "receiptFingerprint"> {
  const { receiptFingerprint: _fingerprint, ...core } = receipt;
  return core;
}

function writeReceipt(
  root: string,
  core: Omit<AsoiafStructuredAcquisitionReceipt, "receiptFingerprint" | "receiptId">,
): { receipt: AsoiafStructuredAcquisitionReceipt; receiptUri: string } {
  const receiptFingerprint = sha256(core);
  const receiptId = collectorContentId("asoiaf-structured-acquisition-receipt", {
    requestId: core.requestId,
    planFingerprint: core.planFingerprint,
    receiptFingerprint,
  });
  const receipt: AsoiafStructuredAcquisitionReceipt = {
    ...core,
    receiptId,
    receiptFingerprint,
  };
  const target = path.join(receiptDirectory(root), `${receiptId}.json`);
  if (!fs.existsSync(target)) writeJsonAtomic(target, receipt);
  return { receipt, receiptUri: relativeEstateUri(root, target) };
}

function terminalResult(input: {
  root: string;
  plan: AsoiafStructuredRequestPlan;
  retrievedAt: string;
  completedAt: string;
  requestCount: number;
  waitedMilliseconds: number;
  redirectCount: number;
  robots: RobotsEvaluation;
  finalUrl: string | null;
  httpStatus: number | null;
  mediaType: string | null;
  responseBytes: number;
  responseDigest: `sha256:${string}` | null;
  outcome: Exclude<AsoiafStructuredAcquisitionOutcome, "observed" | "partial" | "cache-hit">;
  gapStatus: CollectorGapRecord["status"];
  reason: string;
}): AsoiafStructuredAcquisitionResult {
  const terminal = recordGap({
    root: input.root,
    sourceId: input.plan.sourceId,
    sourceRecordId: input.plan.requestId,
    attemptedAt: input.completedAt,
    status: input.gapStatus,
    reason: input.reason,
    requestCount: input.requestCount,
  });
  const written = writeReceipt(input.root, {
    format: ASOIAF_STRUCTURED_ACQUISITION_RECEIPT_FORMAT,
    planFingerprint: input.plan.planFingerprint,
    adapterId: input.plan.adapterId,
    sourceId: input.plan.sourceId,
    requestId: input.plan.requestId,
    requestedUrl: input.plan.url,
    finalUrl: input.finalUrl,
    retrievedAt: input.retrievedAt,
    completedAt: input.completedAt,
    requestCount: input.requestCount,
    waitedMilliseconds: input.waitedMilliseconds,
    redirectCount: input.redirectCount,
    robotsUrl: `${new URL(input.plan.url).origin}/robots.txt`,
    robotsStatus: input.robots.status,
    robotsDigest: input.robots.digest,
    httpStatus: input.httpStatus,
    responseMediaType: input.mediaType,
    responseBytes: input.responseBytes,
    sourceResponseDigest: input.responseDigest,
    adapterReceiptFingerprint: null,
    committedRecordCount: 0,
    observationIds: [],
    candidateIds: [],
    gapId: terminal.gap.gapId,
    outcome: input.outcome,
    rawResponseRetained: false,
    graphEffect: "none",
    canonEffect: "none",
  });
  const attempt = recordAttempt({
    root: input.root,
    sourceId: input.plan.sourceId,
    sourceRecordId: input.plan.requestId,
    startedAt: input.retrievedAt,
    completedAt: input.completedAt,
    outcome: terminal.attempt.outcome,
    requestCount: input.requestCount,
    cacheHit: false,
    receiptUri: written.receiptUri,
    observationId: null,
    gapId: terminal.gap.gapId,
  });
  return {
    receipt: written.receipt,
    cacheHit: false,
    adapterResult: null,
    attempt,
    gap: terminal.gap,
  };
}

function successfulStateEntry(
  root: string,
  receipt: AsoiafStructuredAcquisitionReceipt,
  receiptUri: string,
): void {
  if (receipt.outcome !== "observed" && receipt.outcome !== "partial") return;
  upsertStateEntry(root, {
    requestId: receipt.requestId,
    planFingerprint: receipt.planFingerprint,
    receiptUri,
    completedAt: receipt.completedAt,
    outcome: receipt.outcome,
  });
}

export async function executeAsoiafStructuredAcquisition(
  options: ExecuteAsoiafStructuredAcquisitionOptions,
): Promise<AsoiafStructuredAcquisitionResult> {
  const errors = validateAsoiafStructuredRequestPlan(options.plan);
  if (errors.length > 0) {
    throw new Error(`invalid structured request plan: ${errors.join("; ")}`);
  }
  const runtime = options.runtime ?? new DefaultStructuredAcquisitionRuntime();
  const retrievedAt = options.retrievedAt
    ?? new Date(runtime.nowMilliseconds()).toISOString();
  initializeCollectorEstate(options.root, retrievedAt);

  if (!options.refresh) {
    const state = readState(options.root);
    const completed = state.entries.find(
      (entry) =>
        entry.requestId === options.plan.requestId
        && entry.planFingerprint === options.plan.planFingerprint,
    );
    if (completed) {
      const target = safeEstatePath(options.root, completed.receiptUri);
      if (!target || !fs.existsSync(target)) {
        throw new Error("structured acquisition state references a missing receipt");
      }
      const prior = readJson<AsoiafStructuredAcquisitionReceipt>(target, null as never);
      if (
        prior.receiptFingerprint !== sha256(receiptCore(prior))
        || prior.planFingerprint !== options.plan.planFingerprint
      ) {
        throw new Error("structured acquisition replay receipt failed custody");
      }
      const attempt = recordAttempt({
        root: options.root,
        sourceId: options.plan.sourceId,
        sourceRecordId: options.plan.requestId,
        startedAt: retrievedAt,
        completedAt: retrievedAt,
        outcome: "cache-hit",
        requestCount: 0,
        cacheHit: true,
        receiptUri: completed.receiptUri,
        observationId: prior.observationIds[0] ?? null,
        gapId: null,
      });
      return {
        receipt: { ...prior, outcome: "cache-hit" },
        cacheHit: true,
        adapterResult: null,
        attempt,
        gap: null,
      };
    }
  }

  const source = getAsoiafExternalSource(options.plan.sourceId)!;
  const pacer = new HostPacer(runtime);
  const robots = await evaluateRobots({
    runtime,
    pacer,
    targetUrl: options.plan.url,
    headers: options.plan.headers,
    hostDelayMilliseconds: source.harvestPolicy.hostDelayMs,
    retryCount: source.harvestPolicy.retryCount,
    maxRedirects: options.maxRedirects ?? 3,
  });
  if (robots.status === "denied") {
    return terminalResult({
      root: options.root,
      plan: options.plan,
      retrievedAt,
      completedAt: new Date(runtime.nowMilliseconds()).toISOString(),
      requestCount: robots.requestCount,
      waitedMilliseconds: robots.waitedMilliseconds,
      redirectCount: 0,
      robots,
      finalUrl: null,
      httpStatus: null,
      mediaType: null,
      responseBytes: 0,
      responseDigest: null,
      outcome: "blocked-robots",
      gapStatus: "blocked-robots",
      reason: "robots policy denied the structured endpoint",
    });
  }
  if (robots.status === "unavailable") {
    return terminalResult({
      root: options.root,
      plan: options.plan,
      retrievedAt,
      completedAt: new Date(runtime.nowMilliseconds()).toISOString(),
      requestCount: robots.requestCount,
      waitedMilliseconds: robots.waitedMilliseconds,
      redirectCount: 0,
      robots,
      finalUrl: null,
      httpStatus: null,
      mediaType: null,
      responseBytes: 0,
      responseDigest: null,
      outcome: "error",
      gapStatus: "error",
      reason: robots.error ?? "robots policy could not be established",
    });
  }

  const effectiveDelay = Math.max(
    source.harvestPolicy.hostDelayMs,
    robots.crawlDelayMilliseconds,
  );
  const trace = await fetchWithPolicy({
    runtime,
    pacer,
    url: options.plan.url,
    headers: options.plan.headers,
    hostDelayMilliseconds: effectiveDelay,
    retryCount: source.harvestPolicy.retryCount,
    maxRedirects: options.maxRedirects ?? 3,
  });
  const requestCount = robots.requestCount + trace.requestCount;
  const waitedMilliseconds = robots.waitedMilliseconds + trace.waitedMilliseconds;
  const completedAt = new Date(runtime.nowMilliseconds()).toISOString();
  if (!trace.response || trace.error) {
    return terminalResult({
      root: options.root,
      plan: options.plan,
      retrievedAt,
      completedAt,
      requestCount,
      waitedMilliseconds,
      redirectCount: trace.redirectCount,
      robots,
      finalUrl: trace.finalUrl,
      httpStatus: trace.response?.status ?? null,
      mediaType: trace.response ? responseMediaType(trace.response) : null,
      responseBytes: 0,
      responseDigest: null,
      outcome: "error",
      gapStatus: "error",
      reason: trace.error ?? "structured endpoint request failed",
    });
  }
  if (trace.response.status === 401 || trace.response.status === 403) {
    return terminalResult({
      root: options.root,
      plan: options.plan,
      retrievedAt,
      completedAt,
      requestCount,
      waitedMilliseconds,
      redirectCount: trace.redirectCount,
      robots,
      finalUrl: trace.finalUrl,
      httpStatus: trace.response.status,
      mediaType: responseMediaType(trace.response),
      responseBytes: 0,
      responseDigest: null,
      outcome: "blocked-credential",
      gapStatus: "blocked-credential",
      reason: `structured endpoint returned HTTP ${trace.response.status}`,
    });
  }
  if (trace.response.status === 404 || trace.response.status === 410) {
    return terminalResult({
      root: options.root,
      plan: options.plan,
      retrievedAt,
      completedAt,
      requestCount,
      waitedMilliseconds,
      redirectCount: trace.redirectCount,
      robots,
      finalUrl: trace.finalUrl,
      httpStatus: trace.response.status,
      mediaType: responseMediaType(trace.response),
      responseBytes: 0,
      responseDigest: null,
      outcome: "unavailable",
      gapStatus: "unavailable",
      reason: `structured endpoint returned HTTP ${trace.response.status}`,
    });
  }
  if (!trace.response.ok) {
    return terminalResult({
      root: options.root,
      plan: options.plan,
      retrievedAt,
      completedAt,
      requestCount,
      waitedMilliseconds,
      redirectCount: trace.redirectCount,
      robots,
      finalUrl: trace.finalUrl,
      httpStatus: trace.response.status,
      mediaType: responseMediaType(trace.response),
      responseBytes: 0,
      responseDigest: null,
      outcome: "error",
      gapStatus: "error",
      reason: `structured endpoint returned HTTP ${trace.response.status}`,
    });
  }

  let bounded: BoundedJsonResponse;
  try {
    bounded = await boundedJson(
      trace.response,
      source.harvestPolicy.maxResponseBytes,
    );
  } catch (error) {
    const oversize = error instanceof RangeError;
    return terminalResult({
      root: options.root,
      plan: options.plan,
      retrievedAt,
      completedAt,
      requestCount,
      waitedMilliseconds,
      redirectCount: trace.redirectCount,
      robots,
      finalUrl: trace.finalUrl,
      httpStatus: trace.response.status,
      mediaType: responseMediaType(trace.response),
      responseBytes: 0,
      responseDigest: null,
      outcome: oversize ? "rejected-oversize" : "invalid-response",
      gapStatus: oversize ? "rejected-oversize" : "error",
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  const adapterResult = commitAsoiafStructuredPayload({
    root: options.root,
    adapterId: options.plan.adapterId,
    sourceId: options.plan.sourceId,
    requestId: options.plan.requestId,
    sourceUri: trace.finalUrl,
    payload: bounded.payload,
    retrievedAt: completedAt,
    includeText: options.includeText,
    maxTextCharacters: options.maxTextCharacters,
    recordLimit: options.plan.recordLimit,
  });
  const outcome: AsoiafStructuredAcquisitionReceipt["outcome"] =
    adapterResult.receipt.outcome;
  const written = writeReceipt(options.root, {
    format: ASOIAF_STRUCTURED_ACQUISITION_RECEIPT_FORMAT,
    planFingerprint: options.plan.planFingerprint,
    adapterId: options.plan.adapterId,
    sourceId: options.plan.sourceId,
    requestId: options.plan.requestId,
    requestedUrl: options.plan.url,
    finalUrl: trace.finalUrl,
    retrievedAt,
    completedAt,
    requestCount,
    waitedMilliseconds,
    redirectCount: trace.redirectCount,
    robotsUrl: `${new URL(options.plan.url).origin}/robots.txt`,
    robotsStatus: robots.status,
    robotsDigest: robots.digest,
    httpStatus: trace.response.status,
    responseMediaType: bounded.mediaType,
    responseBytes: bounded.bytes,
    sourceResponseDigest: bounded.digest,
    adapterReceiptFingerprint: adapterResult.receipt.receiptFingerprint,
    committedRecordCount: adapterResult.receipt.committedRecordCount,
    observationIds: [...adapterResult.receipt.observationIds].sort(),
    candidateIds: [...adapterResult.receipt.candidateIds].sort(),
    gapId: adapterResult.gap?.gapId ?? null,
    outcome,
    rawResponseRetained: false,
    graphEffect: "none",
    canonEffect: "none",
  });
  const attempt = recordAttempt({
    root: options.root,
    sourceId: options.plan.sourceId,
    sourceRecordId: options.plan.requestId,
    startedAt: retrievedAt,
    completedAt,
    outcome: outcome === "observed" || outcome === "partial"
      ? "observed"
      : "error",
    requestCount,
    cacheHit: false,
    receiptUri: written.receiptUri,
    observationId: adapterResult.receipt.observationIds[0] ?? null,
    gapId: adapterResult.gap?.gapId ?? null,
  });
  successfulStateEntry(options.root, written.receipt, written.receiptUri);
  return {
    receipt: written.receipt,
    cacheHit: false,
    adapterResult,
    attempt,
    gap: adapterResult.gap,
  };
}

export async function runAsoiafStructuredAcquisitionBatch(input: {
  root: string;
  plans: readonly AsoiafStructuredRequestPlan[];
  runtime?: AsoiafStructuredAcquisitionRuntime;
  retrievedAt?: string;
  refresh?: boolean;
  includeText?: boolean;
  maxTextCharacters?: number;
}): Promise<AsoiafStructuredAcquisitionResult[]> {
  const results: AsoiafStructuredAcquisitionResult[] = [];
  for (const plan of input.plans) {
    results.push(
      await executeAsoiafStructuredAcquisition({
        root: input.root,
        plan,
        runtime: input.runtime,
        retrievedAt: input.retrievedAt,
        refresh: input.refresh,
        includeText: input.includeText,
        maxTextCharacters: input.maxTextCharacters,
      }),
    );
  }
  return results;
}
