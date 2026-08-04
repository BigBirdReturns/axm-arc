import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ASOIAF_EXTERNAL_ATLAS_MANIFEST, ASOIAF_EXTERNAL_ATLAS_SOURCES, ASOIAF_EXTERNAL_HARVEST_WORK_ORDERS, ASOIAF_EXTERNAL_PROVENANCE_LINEAGE, asoiafExternalCandidateId, asoiafExternalCreditRequired, asoiafExternalObservationId, containsPrivateContact, getAsoiafExternalSource, isSha256Digest, } from "../../src/narrative/canon/asoiaf/external/index.js";
export const ASOIAF_EXTERNAL_COLLECTOR_ESTATE_FORMAT = "axm-asoiaf-external-collector-estate/1";
export const ASOIAF_EXTERNAL_COLLECTOR_STATE_FORMAT = "axm-asoiaf-external-collector-state/1";
export const ASOIAF_EXTERNAL_COLLECTOR_LEDGER_ROW_FORMAT = "axm-asoiaf-external-collector-ledger-row/1";
export const ASOIAF_EXTERNAL_COLLECTOR_OBSERVATION_FORMAT = "axm-asoiaf-external-collector-observation/1";
export const ASOIAF_EXTERNAL_COLLECTOR_CANDIDATE_FORMAT = "axm-asoiaf-external-collector-candidate/1";
export const ASOIAF_EXTERNAL_COLLECTOR_GAP_FORMAT = "axm-asoiaf-external-collector-gap/1";
export const ASOIAF_EXTERNAL_COLLECTOR_ATTEMPT_FORMAT = "axm-asoiaf-external-collector-attempt/1";
export const ASOIAF_EXTERNAL_COLLECTOR_RECEIPT_FORMAT = "axm-asoiaf-external-collector-receipt/1";
function stableValue(value) {
    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableValue(entry)).join(",")}]`;
    }
    if (value && typeof value === "object") {
        const record = value;
        return `{${Object.keys(record)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}
export function sha256(value) {
    const input = typeof value === "string" ? value : stableValue(value);
    return `sha256:${crypto.createHash("sha256").update(input).digest("hex")}`;
}
export function collectorContentId(prefix, value) {
    return `${prefix}:${sha256(value).slice("sha256:".length, "sha256:".length + 32)}`;
}
export function collectorEstatePaths(root) {
    const absolute = path.resolve(root);
    return {
        root: absolute,
        sourceLedger: path.join(absolute, ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.sourceLedgerPath),
        observations: path.join(absolute, ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.observationLedgerPath),
        candidates: path.join(absolute, ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.candidateLedgerPath),
        gaps: path.join(absolute, ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.gapLedgerPath),
        attempts: path.join(absolute, ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.attemptLedgerPath),
        state: path.join(absolute, ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.statePath),
        receipts: path.join(absolute, ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.receiptDirectory),
        cache: path.join(absolute, ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.cacheDirectory),
        cacheIndex: path.join(absolute, ASOIAF_EXTERNAL_PROVENANCE_LINEAGE.cacheDirectory, "index.json"),
        creditsMarkdown: path.join(absolute, "CREDITS.md"),
        creditsJson: path.join(absolute, "CREDITS.json"),
        creditsBib: path.join(absolute, "CREDITS.bib"),
    };
}
function ensureParent(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
export function writeJsonAtomic(filePath, value) {
    ensureParent(filePath);
    const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(temporary, filePath);
}
export function readJson(filePath, fallback) {
    if (!fs.existsSync(filePath))
        return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
export function readNdjson(filePath) {
    if (!fs.existsSync(filePath))
        return [];
    return fs
        .readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}
export function appendNdjson(filePath, value) {
    ensureParent(filePath);
    fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}
function sourceFingerprint(source) {
    const workOrder = ASOIAF_EXTERNAL_HARVEST_WORK_ORDERS.find((entry) => entry.sourceId === source.id);
    if (!workOrder)
        throw new Error(`missing work order for ${source.id}`);
    return workOrder.sourceFingerprint;
}
function ledgerRowForSource(source) {
    const workOrder = ASOIAF_EXTERNAL_HARVEST_WORK_ORDERS.find((entry) => entry.sourceId === source.id);
    if (!workOrder)
        throw new Error(`missing work order for ${source.id}`);
    return {
        format: ASOIAF_EXTERNAL_COLLECTOR_LEDGER_ROW_FORMAT,
        sourceId: source.id,
        sourceLabel: source.label,
        sourceFingerprint: sourceFingerprint(source),
        workOrderFingerprint: workOrder.workOrderFingerprint,
        sourcePlane: source.sourcePlane,
        authorityClass: source.authorityClass,
        continuityIds: [...source.continuityIds],
        rightsMode: source.rightsMode,
        harvestMode: source.harvestPolicy.mode,
        verificationStatus: source.verificationStatus,
        represented: true,
        status: "never-attempted",
        firstAttemptAt: null,
        lastAttemptAt: null,
        lastSuccessfulAt: null,
        nextEligibleAt: null,
        lastSourceRecordId: null,
        lastContentDigest: null,
        lastObservationId: null,
        observationCount: 0,
        candidateCount: 0,
        gapCount: 0,
        attemptCount: 0,
        creditRequired: asoiafExternalCreditRequired(source),
        creditRecordCount: 0,
        graphEffect: "none",
        canonEffect: "none",
    };
}
export function initializeCollectorEstate(root, now = new Date().toISOString()) {
    const paths = collectorEstatePaths(root);
    fs.mkdirSync(paths.root, { recursive: true });
    fs.mkdirSync(paths.receipts, { recursive: true });
    fs.mkdirSync(paths.cache, { recursive: true });
    const existingLedger = readJson(paths.sourceLedger, []);
    const existingById = new Map(existingLedger.map((row) => [row.sourceId, row]));
    const ledger = ASOIAF_EXTERNAL_ATLAS_SOURCES.map((source) => {
        const existing = existingById.get(source.id);
        const fresh = ledgerRowForSource(source);
        if (!existing)
            return fresh;
        return {
            ...fresh,
            ...existing,
            sourceLabel: fresh.sourceLabel,
            sourceFingerprint: fresh.sourceFingerprint,
            workOrderFingerprint: fresh.workOrderFingerprint,
            sourcePlane: fresh.sourcePlane,
            authorityClass: fresh.authorityClass,
            continuityIds: fresh.continuityIds,
            rightsMode: fresh.rightsMode,
            harvestMode: fresh.harvestMode,
            verificationStatus: fresh.verificationStatus,
            represented: true,
            creditRequired: fresh.creditRequired,
            graphEffect: "none",
            canonEffect: "none",
        };
    });
    writeJsonAtomic(paths.sourceLedger, ledger);
    const state = readJson(paths.state, null) ?? {
        format: ASOIAF_EXTERNAL_COLLECTOR_STATE_FORMAT,
        atlasFingerprint: ASOIAF_EXTERNAL_ATLAS_MANIFEST.atlasFingerprint,
        initializedAt: now,
        updatedAt: now,
        cursor: 0,
        collectorVersion: 1,
    };
    writeJsonAtomic(paths.state, {
        ...state,
        atlasFingerprint: ASOIAF_EXTERNAL_ATLAS_MANIFEST.atlasFingerprint,
        updatedAt: now,
    });
    const cacheIndex = readJson(paths.cacheIndex, null) ?? {
        format: "axm-asoiaf-external-cache-index/1",
        entries: [],
    };
    writeJsonAtomic(paths.cacheIndex, cacheIndex);
    for (const ledgerPath of [
        paths.observations,
        paths.candidates,
        paths.gaps,
        paths.attempts,
    ]) {
        ensureParent(ledgerPath);
        if (!fs.existsSync(ledgerPath))
            fs.writeFileSync(ledgerPath, "", "utf8");
    }
    return paths;
}
export function loadSourceLedger(root) {
    const paths = initializeCollectorEstate(root);
    return readJson(paths.sourceLedger, []);
}
export function saveSourceLedger(root, ledger) {
    const paths = collectorEstatePaths(root);
    writeJsonAtomic(paths.sourceLedger, [...ledger].sort((left, right) => left.sourceId.localeCompare(right.sourceId)));
}
export function updateSourceLedgerRow(root, sourceId, update) {
    const ledger = loadSourceLedger(root);
    const index = ledger.findIndex((row) => row.sourceId === sourceId);
    if (index < 0)
        throw new Error(`unknown source ledger row ${sourceId}`);
    const current = ledger[index];
    const next = update(current);
    ledger[index] = {
        ...next,
        sourceId: current.sourceId,
        graphEffect: "none",
        canonEffect: "none",
    };
    saveSourceLedger(root, ledger);
    return ledger[index];
}
export function currentCandidates(snapshots) {
    const map = new Map();
    for (const snapshot of snapshots)
        map.set(snapshot.candidateId, snapshot);
    return map;
}
function nextEligibleDate(source, completedAt) {
    const days = source.harvestPolicy.refreshDays;
    if (days === null)
        return null;
    return new Date(new Date(completedAt).getTime() + days * 86_400_000).toISOString();
}
export function commitObservation(input) {
    const paths = initializeCollectorEstate(input.root, input.retrievedAt);
    const source = getAsoiafExternalSource(input.sourceId);
    if (!source)
        throw new Error(`unknown source ${input.sourceId}`);
    if (!isSha256Digest(input.contentDigest)) {
        throw new Error("collector observation requires a lowercase SHA-256 digest");
    }
    if (input.retainedValue !== undefined
        && containsPrivateContact(input.retainedValue)) {
        throw new Error("collector observation retained private contact data");
    }
    if (input.excerpt
        && containsPrivateContact({ excerpt: input.excerpt })) {
        throw new Error("collector observation excerpt retained private contact data");
    }
    const candidateId = asoiafExternalCandidateId(input.sourceId, input.sourceRecordId);
    const observationId = asoiafExternalObservationId({
        sourceId: input.sourceId,
        sourceRecordId: input.sourceRecordId,
        contentDigest: input.contentDigest,
    });
    const receiptRelative = path.posix.join("receipts", `${observationId}.json`);
    const observation = {
        format: ASOIAF_EXTERNAL_COLLECTOR_OBSERVATION_FORMAT,
        observationId,
        candidateId,
        sourceId: input.sourceId,
        sourceRecordId: input.sourceRecordId,
        retrievedAt: input.retrievedAt,
        contentDigest: input.contentDigest,
        receiptUri: receiptRelative,
        retainedFields: orderedUnique(input.retainedFields),
        graphEffect: "none",
        canonEffect: "none",
        status: "observed",
        authorityClass: source.authorityClass,
        continuityIds: [...source.continuityIds],
        rightsMode: source.rightsMode,
        sourceUri: input.sourceUri ?? source.canonicalUri,
        recordType: input.recordType,
        title: input.title,
        summary: input.summary ?? "",
        mediaType: input.mediaType,
        publishedAt: input.publishedAt ?? null,
        updatedAt: input.updatedAt ?? null,
        responseBytes: input.responseBytes,
        retention: input.retention,
        excerpt: input.excerpt ?? null,
        cacheUri: input.cacheUri ?? null,
        credit: input.credit ?? null,
    };
    const existingObservations = readNdjson(paths.observations);
    if (!existingObservations.some((entry) => entry.observationId === observationId)) {
        appendNdjson(paths.observations, observation);
    }
    const candidateSnapshots = readNdjson(paths.candidates);
    const prior = currentCandidates(candidateSnapshots).get(candidateId);
    const observationIds = orderedUnique([
        ...(prior?.observationIds ?? []),
        observationId,
    ]);
    const candidate = {
        format: ASOIAF_EXTERNAL_COLLECTOR_CANDIDATE_FORMAT,
        candidateId,
        sourceId: input.sourceId,
        sourceRecordId: input.sourceRecordId,
        observationIds,
        firstSeen: prior?.firstSeen ?? input.retrievedAt,
        lastSeen: input.retrievedAt,
        graphEffect: "none",
        canonEffect: "none",
        promotionStatus: prior?.promotionStatus ?? "intake-only",
        label: input.title,
        authorityClass: source.authorityClass,
        continuityIds: [...source.continuityIds],
        latestContentDigest: input.contentDigest,
        latestObservationId: observationId,
    };
    appendNdjson(paths.candidates, candidate);
    const receiptCore = {
        format: ASOIAF_EXTERNAL_COLLECTOR_RECEIPT_FORMAT,
        sourceId: input.sourceId,
        sourceRecordId: input.sourceRecordId,
        createdAt: input.retrievedAt,
        outcome: "observed",
        observationId,
        candidateId,
        gapId: null,
        contentDigest: input.contentDigest,
        rightsMode: source.rightsMode,
        retention: input.retention,
        requestCount: input.requestCount ?? 0,
        cacheHit: input.cacheHit ?? false,
        graphEffect: "none",
        canonEffect: "none",
    };
    const receipt = {
        ...receiptCore,
        receiptId: collectorContentId("asoiaf-external-receipt", receiptCore),
        payloadFingerprint: sha256({ observation, candidate }),
    };
    writeJsonAtomic(path.join(paths.root, receiptRelative), receipt);
    updateSourceLedgerRow(input.root, input.sourceId, (row) => ({
        ...row,
        status: "observed",
        firstAttemptAt: row.firstAttemptAt ?? input.retrievedAt,
        lastAttemptAt: input.retrievedAt,
        lastSuccessfulAt: input.retrievedAt,
        nextEligibleAt: nextEligibleDate(source, input.retrievedAt),
        lastSourceRecordId: input.sourceRecordId,
        lastContentDigest: input.contentDigest,
        lastObservationId: observationId,
        observationCount: existingObservations.some((entry) => entry.observationId === observationId)
            ? row.observationCount
            : row.observationCount + 1,
        candidateCount: prior ? row.candidateCount : row.candidateCount + 1,
        attemptCount: row.attemptCount + 1,
        creditRecordCount: input.credit && asoiafExternalCreditRequired(source)
            ? row.creditRecordCount + 1
            : row.creditRecordCount,
    }));
    return { observation, candidate, receipt };
}
export function recordGap(input) {
    const paths = initializeCollectorEstate(input.root, input.attemptedAt);
    const source = getAsoiafExternalSource(input.sourceId);
    if (!source)
        throw new Error(`unknown source ${input.sourceId}`);
    const gapCore = {
        sourceId: input.sourceId,
        sourceRecordId: input.sourceRecordId ?? null,
        attemptedAt: input.attemptedAt,
        status: input.status,
        reason: input.reason,
        retryEligibleAt: input.retryEligibleAt ?? null,
        requestCount: input.requestCount ?? 0,
    };
    const gap = {
        format: ASOIAF_EXTERNAL_COLLECTOR_GAP_FORMAT,
        gapId: collectorContentId("asoiaf-external-gap", gapCore),
        ...gapCore,
        graphEffect: "none",
        canonEffect: "none",
    };
    appendNdjson(paths.gaps, gap);
    const receiptRelative = path.posix.join("receipts", `${gap.gapId}.json`);
    const receiptCore = {
        format: ASOIAF_EXTERNAL_COLLECTOR_RECEIPT_FORMAT,
        sourceId: input.sourceId,
        sourceRecordId: input.sourceRecordId ?? null,
        createdAt: input.attemptedAt,
        outcome: input.status,
        observationId: null,
        candidateId: null,
        gapId: gap.gapId,
        contentDigest: null,
        rightsMode: source.rightsMode,
        retention: "none",
        requestCount: input.requestCount ?? 0,
        cacheHit: input.cacheHit ?? false,
        graphEffect: "none",
        canonEffect: "none",
    };
    const receipt = {
        ...receiptCore,
        receiptId: collectorContentId("asoiaf-external-receipt", receiptCore),
        payloadFingerprint: sha256(gap),
    };
    writeJsonAtomic(path.join(paths.root, receiptRelative), receipt);
    const attempt = {
        format: ASOIAF_EXTERNAL_COLLECTOR_ATTEMPT_FORMAT,
        attemptId: collectorContentId("asoiaf-external-attempt", {
            sourceId: input.sourceId,
            sourceRecordId: input.sourceRecordId ?? null,
            attemptedAt: input.attemptedAt,
            gapId: gap.gapId,
        }),
        sourceId: input.sourceId,
        sourceRecordId: input.sourceRecordId ?? null,
        startedAt: input.attemptedAt,
        completedAt: input.attemptedAt,
        outcome: input.status,
        requestCount: input.requestCount ?? 0,
        cacheHit: input.cacheHit ?? false,
        receiptUri: receiptRelative,
        observationId: null,
        gapId: gap.gapId,
        graphEffect: "none",
        canonEffect: "none",
    };
    appendNdjson(paths.attempts, attempt);
    updateSourceLedgerRow(input.root, input.sourceId, (row) => ({
        ...row,
        status: input.status,
        firstAttemptAt: row.firstAttemptAt ?? input.attemptedAt,
        lastAttemptAt: input.attemptedAt,
        nextEligibleAt: input.retryEligibleAt ?? nextEligibleDate(source, input.attemptedAt),
        lastSourceRecordId: input.sourceRecordId ?? row.lastSourceRecordId,
        gapCount: row.gapCount + 1,
        attemptCount: row.attemptCount + 1,
    }));
    return { gap, attempt, receipt };
}
export function recordAttempt(input) {
    const paths = initializeCollectorEstate(input.root, input.completedAt);
    const attempt = {
        format: ASOIAF_EXTERNAL_COLLECTOR_ATTEMPT_FORMAT,
        attemptId: collectorContentId("asoiaf-external-attempt", input),
        ...input,
        graphEffect: "none",
        canonEffect: "none",
    };
    appendNdjson(paths.attempts, attempt);
    return attempt;
}
export function cacheKey(sourceId, sourceRecordId) {
    return collectorContentId("asoiaf-external-cache", {
        sourceId,
        sourceRecordId,
    });
}
export function readCacheIndex(root) {
    const paths = initializeCollectorEstate(root);
    return readJson(paths.cacheIndex, {
        format: "axm-asoiaf-external-cache-index/1",
        entries: [],
    });
}
export function upsertCacheIndex(root, entry) {
    const paths = initializeCollectorEstate(root, entry.storedAt);
    const index = readCacheIndex(root);
    const entries = index.entries.filter((existing) => existing.cacheKey !== entry.cacheKey);
    entries.push(entry);
    entries.sort((left, right) => left.cacheKey.localeCompare(right.cacheKey));
    writeJsonAtomic(paths.cacheIndex, {
        format: "axm-asoiaf-external-cache-index/1",
        entries,
    });
}
export function findCacheEntry(root, sourceId, sourceRecordId) {
    const key = cacheKey(sourceId, sourceRecordId);
    return readCacheIndex(root).entries.find((entry) => entry.cacheKey === key);
}
export function planCollectorWork(input) {
    const now = input.now ?? new Date().toISOString();
    const selected = input.sourceIds ? new Set(input.sourceIds) : null;
    const state = readJson(initializeCollectorEstate(input.root, now).state, {
        format: ASOIAF_EXTERNAL_COLLECTOR_STATE_FORMAT,
        atlasFingerprint: ASOIAF_EXTERNAL_ATLAS_MANIFEST.atlasFingerprint,
        initializedAt: now,
        updatedAt: now,
        cursor: 0,
        collectorVersion: 1,
    });
    const ledger = loadSourceLedger(input.root);
    const eligible = ledger.filter((row) => {
        if (selected && !selected.has(row.sourceId))
            return false;
        if (row.status === "retired")
            return false;
        if (input.refresh)
            return true;
        if (row.status === "never-attempted")
            return true;
        if (!row.nextEligibleAt)
            return false;
        return row.nextEligibleAt <= now;
    });
    eligible.sort((left, right) => {
        const leftNever = left.status === "never-attempted" ? 0 : 1;
        const rightNever = right.status === "never-attempted" ? 0 : 1;
        return (leftNever - rightNever
            || (left.lastAttemptAt ?? "").localeCompare(right.lastAttemptAt ?? "")
            || left.sourceId.localeCompare(right.sourceId));
    });
    if (!eligible.length)
        return [];
    const rotated = [
        ...eligible.slice(state.cursor % eligible.length),
        ...eligible.slice(0, state.cursor % eligible.length),
    ];
    return rotated.slice(0, input.limit ?? 20);
}
function creditRecords(root) {
    const paths = initializeCollectorEstate(root);
    const observations = readNdjson(paths.observations);
    const records = observations
        .filter((observation) => {
        const source = getAsoiafExternalSource(observation.sourceId);
        return Boolean(source && asoiafExternalCreditRequired(source));
    })
        .map((observation) => {
        const source = getAsoiafExternalSource(observation.sourceId);
        return {
            observationId: observation.observationId,
            sourceId: observation.sourceId,
            sourceLabel: source.label,
            title: observation.credit?.title ?? observation.title,
            author: observation.credit?.author ?? source.label,
            license: observation.credit?.license ?? source.rightsMode,
            sourceUri: observation.credit?.sourceUri ?? observation.sourceUri,
        };
    });
    const unique = new Map(records.map((record) => [record.observationId, record]));
    return [...unique.values()].sort((left, right) => left.observationId.localeCompare(right.observationId));
}
function bibKey(record) {
    return record.observationId.replace(/[^a-zA-Z0-9]+/g, "").slice(-24);
}
export function generateCollectorCredits(root) {
    const paths = initializeCollectorEstate(root);
    const records = creditRecords(root);
    const jsonValue = {
        format: "axm-asoiaf-external-credits/1",
        atlasFingerprint: ASOIAF_EXTERNAL_ATLAS_MANIFEST.atlasFingerprint,
        recordCount: records.length,
        records,
    };
    writeJsonAtomic(paths.creditsJson, jsonValue);
    const markdown = [
        "# ASOIAF external-source credits",
        "",
        "The complete provenance ledger is `SOURCE-LEDGER.json`. This file lists only retained observations whose license requires visible public attribution.",
        "",
        ...(records.length
            ? records.map((record) => `- **${record.title}** — ${record.author}, ${record.license}; [source](${record.sourceUri}); observation \`${record.observationId}\`.`)
            : ["_No retained observations currently require visible attribution._"]),
        "",
    ].join("\n");
    fs.writeFileSync(paths.creditsMarkdown, markdown, "utf8");
    const bib = records
        .map((record) => `@misc{${bibKey(record)},\n  author = {${record.author}},\n  title = {${record.title}},\n  howpublished = {${record.sourceUri}},\n  note = {${record.license}; ${record.observationId}}\n}`)
        .join("\n\n");
    fs.writeFileSync(paths.creditsBib, `${bib}${bib ? "\n" : ""}`, "utf8");
    const ledger = loadSourceLedger(root).map((row) => ({
        ...row,
        creditRecordCount: records.filter((record) => record.sourceId === row.sourceId).length,
    }));
    saveSourceLedger(root, ledger);
    return {
        markdownPath: paths.creditsMarkdown,
        jsonPath: paths.creditsJson,
        bibPath: paths.creditsBib,
        recordCount: records.length,
    };
}
function emptyStatusCounts() {
    return {
        "never-attempted": 0,
        observed: 0,
        "route-only": 0,
        unavailable: 0,
        "blocked-robots": 0,
        "blocked-rights": 0,
        "blocked-credential": 0,
        "rejected-private-contact": 0,
        "rejected-oversize": 0,
        error: 0,
        retired: 0,
    };
}
export function collectorStatus(root) {
    const paths = initializeCollectorEstate(root);
    const ledger = loadSourceLedger(root);
    const counts = emptyStatusCounts();
    for (const row of ledger)
        counts[row.status] += 1;
    const observations = readNdjson(paths.observations);
    const candidateSnapshots = readNdjson(paths.candidates);
    const state = readJson(paths.state, {
        format: ASOIAF_EXTERNAL_COLLECTOR_STATE_FORMAT,
        atlasFingerprint: ASOIAF_EXTERNAL_ATLAS_MANIFEST.atlasFingerprint,
        initializedAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        cursor: 0,
        collectorVersion: 1,
    });
    return {
        format: "axm-asoiaf-external-collector-status/1",
        atlasFingerprint: state.atlasFingerprint,
        sourceCount: ledger.length,
        countsByStatus: counts,
        observationCount: observations.length,
        currentCandidateCount: currentCandidates(candidateSnapshots).size,
        candidateSnapshotCount: candidateSnapshots.length,
        gapCount: readNdjson(paths.gaps).length,
        attemptCount: readNdjson(paths.attempts).length,
        creditRecordCount: creditRecords(root).length,
        nextCursor: state.cursor,
    };
}
export function advanceCollectorCursor(root, amount, now = new Date().toISOString()) {
    const paths = initializeCollectorEstate(root, now);
    const state = readJson(paths.state, {
        format: ASOIAF_EXTERNAL_COLLECTOR_STATE_FORMAT,
        atlasFingerprint: ASOIAF_EXTERNAL_ATLAS_MANIFEST.atlasFingerprint,
        initializedAt: now,
        updatedAt: now,
        cursor: 0,
        collectorVersion: 1,
    });
    const next = {
        ...state,
        updatedAt: now,
        cursor: (state.cursor + Math.max(0, amount)) % ASOIAF_EXTERNAL_ATLAS_SOURCES.length,
    };
    writeJsonAtomic(paths.state, next);
    return next;
}
export function verifyCollectorEstate(root) {
    const paths = initializeCollectorEstate(root);
    const findings = [];
    const ledger = loadSourceLedger(root);
    if (ledger.length !== ASOIAF_EXTERNAL_ATLAS_SOURCES.length) {
        findings.push(`source ledger has ${ledger.length} rows; expected ${ASOIAF_EXTERNAL_ATLAS_SOURCES.length}`);
    }
    if (new Set(ledger.map((row) => row.sourceId)).size !== ledger.length) {
        findings.push("source ledger contains duplicate source IDs");
    }
    for (const row of ledger) {
        const source = getAsoiafExternalSource(row.sourceId);
        if (!source) {
            findings.push(`source ledger references unknown source ${row.sourceId}`);
            continue;
        }
        const workOrder = ASOIAF_EXTERNAL_HARVEST_WORK_ORDERS.find((entry) => entry.sourceId === row.sourceId);
        if (!workOrder || workOrder.workOrderFingerprint !== row.workOrderFingerprint) {
            findings.push(`source ledger work-order drift for ${row.sourceId}`);
        }
        if (row.graphEffect !== "none" || row.canonEffect !== "none") {
            findings.push(`source ledger authority leak for ${row.sourceId}`);
        }
    }
    const observations = readNdjson(paths.observations);
    for (const observation of observations) {
        if (!isSha256Digest(observation.contentDigest)) {
            findings.push(`observation ${observation.observationId} has malformed digest`);
        }
        if (observation.graphEffect !== "none" || observation.canonEffect !== "none") {
            findings.push(`observation ${observation.observationId} acquired authority`);
        }
        if (observation.excerpt
            && containsPrivateContact({ excerpt: observation.excerpt })) {
            findings.push(`observation ${observation.observationId} retained private contact data`);
        }
        if (observation.cacheUri?.includes("..")) {
            findings.push(`observation ${observation.observationId} has unsafe cache path`);
        }
        const receiptPath = path.join(paths.root, observation.receiptUri);
        if (!fs.existsSync(receiptPath)) {
            findings.push(`observation ${observation.observationId} lacks receipt`);
        }
    }
    const candidates = readNdjson(paths.candidates);
    for (const candidate of candidates) {
        if (candidate.graphEffect !== "none" || candidate.canonEffect !== "none") {
            findings.push(`candidate ${candidate.candidateId} acquired authority`);
        }
        if (candidate.promotionStatus !== "intake-only") {
            findings.push(`collector promoted candidate ${candidate.candidateId}`);
        }
    }
    const state = readJson(paths.state, null);
    if (state?.atlasFingerprint !== ASOIAF_EXTERNAL_ATLAS_MANIFEST.atlasFingerprint) {
        findings.push("collector state atlas fingerprint drift");
    }
    return findings.sort();
}
function orderedUnique(values) {
    return [...new Set(values)].sort();
}
