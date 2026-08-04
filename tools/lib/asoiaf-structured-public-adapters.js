import fs from "node:fs";
import path from "node:path";
import { containsPrivateContact, getAsoiafExternalSource, } from "../../src/narrative/canon/asoiaf/external/index.js";
import { ASOIAF_EXTERNAL_COLLECTOR_USER_AGENT, } from "./asoiaf-external-collector.js";
import { cacheKey, collectorContentId, collectorEstatePaths, commitObservation, generateCollectorCredits, initializeCollectorEstate, recordAttempt, recordGap, sha256, upsertCacheIndex, writeJsonAtomic, } from "./asoiaf-external-estate.js";
export const ASOIAF_STRUCTURED_ADAPTER_RECORD_FORMAT = "axm-asoiaf-structured-adapter-record/1";
export const ASOIAF_STRUCTURED_ADAPTER_RECEIPT_FORMAT = "axm-asoiaf-structured-adapter-receipt/1";
export const ASOIAF_STRUCTURED_REQUEST_PLAN_FORMAT = "axm-asoiaf-structured-request-plan/1";
const SOURCE_BY_ADAPTER = {
    "wikidata-sparql": new Set(["structured-wikidata"]),
    "openlibrary-catalog": new Set(["structured-openlibrary-api"]),
    "crossref-works": new Set(["structured-crossref-api"]),
    "awoiaf-mediawiki": new Set([
        "structured-awoiaf-api",
        "structured-awoiaf-category-api",
        "structured-awoiaf-search-api",
    ]),
};
const STRUCTURED_RIGHTS = new Set([
    "cc0",
    "cc-by",
    "cc-by-sa",
    "public-domain",
]);
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function asString(value) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    return trimmed || null;
}
function asFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function stringArray(value) {
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    return [...new Set(values.map(asString).filter((entry) => entry !== null))]
        .sort((left, right) => left.localeCompare(right));
}
function scalarRecord(value) {
    const record = asRecord(value);
    if (!record)
        return {};
    const output = {};
    for (const key of Object.keys(record).sort()) {
        const entry = record[key];
        if (entry === null
            || typeof entry === "string"
            || typeof entry === "number"
            || typeof entry === "boolean") {
            output[key] = entry;
        }
    }
    return output;
}
function cleanValue(value) {
    if (Array.isArray(value)) {
        return value
            .map(cleanValue)
            .filter((entry) => entry !== undefined);
    }
    const record = asRecord(value);
    if (record) {
        const output = {};
        for (const key of Object.keys(record).sort()) {
            const cleaned = cleanValue(record[key]);
            if (cleaned !== undefined)
                output[key] = cleaned;
        }
        return output;
    }
    if (value === null
        || typeof value === "string"
        || typeof value === "number"
        || typeof value === "boolean") {
        return value;
    }
    return undefined;
}
function safeText(value, maximum) {
    const text = asString(value);
    if (!text)
        return null;
    return text
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maximum);
}
function recordCore(input) {
    const core = {
        format: ASOIAF_STRUCTURED_ADAPTER_RECORD_FORMAT,
        ...input,
        fields: cleanValue(input.fields),
        graphEffect: "none",
        canonEffect: "none",
    };
    const normalizedDigest = sha256(core);
    return {
        ...core,
        recordId: collectorContentId("asoiaf-structured-record", {
            sourceId: input.sourceId,
            sourceRecordId: input.sourceRecordId,
            normalizedDigest,
        }),
        normalizedDigest,
    };
}
function bindingValue(value) {
    const record = asRecord(value);
    const content = asString(record?.value);
    if (!record || !content)
        return null;
    const output = {
        type: asString(record.type) ?? "literal",
        value: content,
    };
    const datatype = asString(record.datatype);
    const language = asString(record["xml:lang"] ?? record.lang);
    if (datatype)
        output.datatype = datatype;
    if (language)
        output.language = language;
    return output;
}
function normalizeWikidata(payload, context) {
    const root = asRecord(payload);
    const results = asRecord(root?.results);
    const bindings = Array.isArray(results?.bindings) ? results.bindings : [];
    const records = [];
    const rejected = [];
    bindings.forEach((raw, index) => {
        const binding = asRecord(raw);
        if (!binding) {
            rejected.push({ index, code: "wikidata-binding-shape", detail: "binding is not an object" });
            return;
        }
        const fields = {};
        for (const key of Object.keys(binding).sort()) {
            if (/email|phone|address|contact/i.test(key))
                continue;
            const normalized = bindingValue(binding[key]);
            if (normalized)
                fields[key] = normalized;
        }
        if (Object.keys(fields).length === 0 || containsPrivateContact(fields)) {
            rejected.push({ index, code: "wikidata-binding-private-or-empty", detail: "binding was empty or contained private contact data" });
            return;
        }
        const entityUri = Object.values(fields)
            .map((entry) => asString(asRecord(entry)?.value))
            .find((value) => value?.match(/^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/)) ?? null;
        const qid = entityUri?.split("/").at(-1) ?? null;
        const label = Object.entries(fields)
            .filter(([key]) => /label$/i.test(key))
            .map(([, entry]) => asString(asRecord(entry)?.value))
            .find((value) => Boolean(value)) ?? qid ?? `Wikidata binding ${index + 1}`;
        const bindingDigest = sha256(fields).slice("sha256:".length, "sha256:".length + 16);
        records.push(recordCore({
            adapterId: context.adapterId,
            sourceId: context.sourceId,
            sourceRecordId: `wikidata:${qid ?? "binding"}:${bindingDigest}`,
            recordType: "wikidata-sparql-binding",
            title: label,
            summary: qid
                ? `CC0 Wikidata SPARQL binding for ${qid}.`
                : "CC0 Wikidata SPARQL binding without a single entity identity.",
            canonicalUri: entityUri ?? context.sourceUri,
            publishedAt: null,
            updatedAt: null,
            sourceResponseDigest: context.sourceResponseDigest,
            fields: {
                requestId: context.requestId,
                variables: Object.keys(fields).sort(),
                binding: fields,
            },
            attribution: null,
        }));
    });
    return { inputRecordCount: bindings.length, records, rejected };
}
function openLibraryRows(payload) {
    const record = asRecord(payload);
    if (!record)
        return [];
    if (Array.isArray(record.docs))
        return record.docs;
    if (Array.isArray(record.entries))
        return record.entries;
    if (Array.isArray(record.works))
        return record.works;
    return [record];
}
function openLibraryKey(record) {
    return (asString(record.key)
        ?? stringArray(record.edition_key)[0]
        ?? stringArray(record.isbn)[0]
        ?? stringArray(record.isbn_13)[0]
        ?? stringArray(record.isbn_10)[0]
        ?? null);
}
function normalizeOpenLibrary(payload, context) {
    const rows = openLibraryRows(payload);
    const records = [];
    const rejected = [];
    rows.forEach((raw, index) => {
        const row = asRecord(raw);
        const key = row ? openLibraryKey(row) : null;
        const title = asString(row?.title);
        if (!row || !key || !title) {
            rejected.push({ index, code: "openlibrary-identity", detail: "record lacks a stable key or title" });
            return;
        }
        const normalizedKey = key.startsWith("/") ? key : `/books/${key}`;
        const fields = {
            key: normalizedKey,
            title,
            subtitle: asString(row.subtitle),
            authors: stringArray(row.author_name ?? row.authors),
            authorKeys: stringArray(row.author_key),
            firstPublishYear: asFiniteNumber(row.first_publish_year),
            publishDates: stringArray(row.publish_date),
            publishers: stringArray(row.publisher ?? row.publishers),
            languages: stringArray(row.language ?? row.languages),
            subjects: stringArray(row.subject ?? row.subjects).slice(0, 200),
            isbn10: stringArray(row.isbn_10),
            isbn13: stringArray(row.isbn_13),
            isbn: stringArray(row.isbn),
            oclc: stringArray(row.oclc),
            lccn: stringArray(row.lccn),
            editionKeys: stringArray(row.edition_key),
            workKeys: stringArray(row.work_key),
            numberOfPages: asFiniteNumber(row.number_of_pages ?? row.number_of_pages_median),
            revision: asFiniteNumber(row.revision),
            lastModified: asString(asRecord(row.last_modified)?.value ?? row.last_modified),
        };
        if (containsPrivateContact(fields)) {
            rejected.push({ index, code: "openlibrary-private-contact", detail: "record contained private contact data" });
            return;
        }
        const canonicalUri = normalizedKey.startsWith("/")
            ? `https://openlibrary.org${normalizedKey}`
            : context.sourceUri;
        records.push(recordCore({
            adapterId: context.adapterId,
            sourceId: context.sourceId,
            sourceRecordId: `openlibrary:${normalizedKey}`,
            recordType: "openlibrary-bibliographic-record",
            title,
            summary: `Open Library bibliographic metadata for ${title}.`,
            canonicalUri,
            publishedAt: stringArray(row.publish_date)[0] ?? null,
            updatedAt: fields.lastModified,
            sourceResponseDigest: context.sourceResponseDigest,
            fields,
            attribution: null,
        }));
    });
    return { inputRecordCount: rows.length, records, rejected };
}
function crossrefRows(payload) {
    const root = asRecord(payload);
    const message = asRecord(root?.message) ?? root;
    if (!message)
        return [];
    if (Array.isArray(message.items))
        return message.items;
    return [message];
}
function crossrefDate(value) {
    const record = asRecord(value);
    const parts = Array.isArray(record?.["date-parts"])
        ? record?.["date-parts"]
        : [];
    const first = Array.isArray(parts[0]) ? parts[0] : [];
    const values = first
        .map((entry) => typeof entry === "number" ? entry : Number.NaN)
        .filter(Number.isFinite);
    if (values.length === 0)
        return null;
    const year = String(values[0]).padStart(4, "0");
    const month = String(values[1] ?? 1).padStart(2, "0");
    const day = String(values[2] ?? 1).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function crossrefAuthors(value) {
    if (!Array.isArray(value))
        return [];
    return value.flatMap((raw) => {
        const record = asRecord(raw);
        if (!record)
            return [];
        const author = {};
        for (const key of ["given", "family", "name", "ORCID", "sequence"]) {
            const entry = asString(record[key]);
            if (entry)
                author[key] = entry;
        }
        return Object.keys(author).length > 0 ? [author] : [];
    });
}
function normalizeCrossref(payload, context) {
    const rows = crossrefRows(payload);
    const records = [];
    const rejected = [];
    rows.forEach((raw, index) => {
        const row = asRecord(raw);
        const doi = asString(row?.DOI)?.toLowerCase() ?? null;
        const title = stringArray(row?.title)[0] ?? null;
        if (!row || !doi || !title) {
            rejected.push({ index, code: "crossref-identity", detail: "record lacks DOI or title" });
            return;
        }
        const fields = {
            DOI: doi,
            type: asString(row.type),
            title: stringArray(row.title),
            subtitle: stringArray(row.subtitle),
            authors: crossrefAuthors(row.author),
            editors: crossrefAuthors(row.editor),
            containerTitles: stringArray(row["container-title"]),
            shortContainerTitles: stringArray(row["short-container-title"]),
            publisher: asString(row.publisher),
            published: crossrefDate(row.published ?? row["published-print"] ?? row["published-online"]),
            issued: crossrefDate(row.issued),
            created: asString(asRecord(row.created)?.["date-time"]),
            indexed: asString(asRecord(row.indexed)?.["date-time"]),
            ISBN: stringArray(row.ISBN),
            ISSN: stringArray(row.ISSN),
            URL: asString(row.URL),
            language: asString(row.language),
            subject: stringArray(row.subject),
            referenceCount: asFiniteNumber(row["reference-count"]),
            citedByCount: asFiniteNumber(row["is-referenced-by-count"]),
            relations: cleanValue(row.relation),
            licenses: Array.isArray(row.license)
                ? row.license.map((entry) => ({
                    URL: asString(asRecord(entry)?.URL),
                    start: asString(asRecord(entry)?.start),
                    delayInDays: asFiniteNumber(asRecord(entry)?.["delay-in-days"]),
                    contentVersion: asString(asRecord(entry)?.["content-version"]),
                }))
                : [],
            abstractRetained: false,
            affiliationsRetained: false,
        };
        if (containsPrivateContact(fields)) {
            rejected.push({ index, code: "crossref-private-contact", detail: "record contained private contact data" });
            return;
        }
        records.push(recordCore({
            adapterId: context.adapterId,
            sourceId: context.sourceId,
            sourceRecordId: `crossref:doi:${doi}`,
            recordType: "crossref-work-metadata",
            title,
            summary: `Crossref bibliographic metadata for DOI ${doi}; abstracts and affiliations were excluded.`,
            canonicalUri: `https://doi.org/${doi}`,
            publishedAt: fields.published,
            updatedAt: fields.indexed ?? fields.created,
            sourceResponseDigest: context.sourceResponseDigest,
            fields,
            attribution: null,
        }));
    });
    return { inputRecordCount: rows.length, records, rejected };
}
function mediaWikiPages(payload) {
    const root = asRecord(payload);
    const query = asRecord(root?.query);
    const pages = query?.pages;
    if (Array.isArray(pages))
        return pages;
    const record = asRecord(pages);
    return record ? Object.values(record) : [];
}
function mediaWikiRevisionText(revisions, maximum) {
    if (!Array.isArray(revisions))
        return null;
    for (const raw of revisions) {
        const revision = asRecord(raw);
        const slots = asRecord(revision?.slots);
        const main = asRecord(slots?.main);
        const value = (main?.content
            ?? main?.["*"]
            ?? revision?.content
            ?? revision?.["*"]);
        const text = safeText(value, maximum);
        if (text)
            return text;
    }
    return null;
}
function mediaWikiTitles(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((entry) => asString(asRecord(entry)?.title))
        .filter((entry) => entry !== null)
        .filter((entry) => !entry.startsWith("File:"))
        .sort((left, right) => left.localeCompare(right));
}
function normalizeAwoiaf(payload, context) {
    const pages = mediaWikiPages(payload);
    const records = [];
    const rejected = [];
    pages.forEach((raw, index) => {
        const page = asRecord(raw);
        const pageId = asFiniteNumber(page?.pageid);
        const title = asString(page?.title);
        if (!page || pageId === null || !title || page.missing !== undefined) {
            rejected.push({ index, code: "awoiaf-page-identity", detail: "page is missing a stable pageid or title" });
            return;
        }
        const lastRevision = asFiniteNumber(page.lastrevid)
            ?? asFiniteNumber(asRecord(Array.isArray(page.revisions) ? page.revisions[0] : null)?.revid)
            ?? 0;
        const canonicalUri = (asString(page.canonicalurl)
            ?? asString(page.fullurl)
            ?? `https://awoiaf.westeros.org/index.php?title=${encodeURIComponent(title.replace(/ /g, "_"))}`);
        const text = context.includeText
            ? mediaWikiRevisionText(page.revisions, context.maxTextCharacters)
                ?? safeText(page.extract, context.maxTextCharacters)
            : null;
        const fields = {
            pageId,
            namespace: asFiniteNumber(page.ns),
            title,
            touched: asString(page.touched),
            lastRevision,
            length: asFiniteNumber(page.length),
            pageProperties: scalarRecord(page.pageprops),
            categories: mediaWikiTitles(page.categories),
            links: mediaWikiTitles(page.links).slice(0, 1_000),
            revisionMetadata: Array.isArray(page.revisions)
                ? page.revisions.map((entry) => {
                    const revision = asRecord(entry);
                    return {
                        revisionId: asFiniteNumber(revision?.revid),
                        parentId: asFiniteNumber(revision?.parentid),
                        timestamp: asString(revision?.timestamp),
                    };
                })
                : [],
            text,
            textRetained: Boolean(text),
            mediaFilesRetained: false,
            attributionUrl: lastRevision > 0
                ? `${canonicalUri}${canonicalUri.includes("?") ? "&" : "?"}oldid=${lastRevision}`
                : canonicalUri,
        };
        if (containsPrivateContact(fields)) {
            rejected.push({ index, code: "awoiaf-private-contact", detail: "page metadata or text contained private contact data" });
            return;
        }
        const attributionUrl = fields.attributionUrl;
        records.push(recordCore({
            adapterId: context.adapterId,
            sourceId: context.sourceId,
            sourceRecordId: `awoiaf:page:${pageId}:revision:${lastRevision}`,
            recordType: "awoiaf-mediawiki-page",
            title,
            summary: text
                ? `CC BY-SA A Wiki of Ice and Fire page metadata with a bounded text field for ${title}.`
                : `CC BY-SA A Wiki of Ice and Fire page metadata for ${title}; page text was not retained.`,
            canonicalUri: attributionUrl,
            publishedAt: null,
            updatedAt: asString(page.touched)
                ?? asString(asRecord(Array.isArray(page.revisions) ? page.revisions[0] : null)?.timestamp),
            sourceResponseDigest: context.sourceResponseDigest,
            fields,
            attribution: {
                title,
                author: "A Wiki of Ice and Fire contributors",
                license: "CC-BY-SA",
                sourceUri: attributionUrl,
            },
        }));
    });
    return { inputRecordCount: pages.length, records, rejected };
}
function normalizePayload(payload, context) {
    switch (context.adapterId) {
        case "wikidata-sparql":
            return normalizeWikidata(payload, context);
        case "openlibrary-catalog":
            return normalizeOpenLibrary(payload, context);
        case "crossref-works":
            return normalizeCrossref(payload, context);
        case "awoiaf-mediawiki":
            return normalizeAwoiaf(payload, context);
    }
}
function normalizedRecordPath(root, record) {
    const digest = record.normalizedDigest.slice("sha256:".length);
    return path.join(collectorEstatePaths(root).cache, "structured-normalized", record.sourceId, `${digest}.json`);
}
function relativeCacheUri(root, target) {
    return path.relative(path.resolve(root), path.resolve(target)).split(path.sep).join("/");
}
function writeNormalizedRecord(root, record) {
    const target = normalizedRecordPath(root, record);
    if (!fs.existsSync(target))
        writeJsonAtomic(target, record);
    return relativeCacheUri(root, target);
}
function adapterReceiptPath(root, requestId) {
    const id = collectorContentId("asoiaf-structured-adapter-receipt", requestId);
    return path.join(path.resolve(root), "structured-adapter-receipts", `${id}.json`);
}
function adapterForSource(adapterId, sourceId) {
    if (!SOURCE_BY_ADAPTER[adapterId].has(sourceId)) {
        throw new Error(`${sourceId} is not registered for adapter ${adapterId}`);
    }
    const source = getAsoiafExternalSource(sourceId);
    if (!source)
        throw new Error(`unknown atlas source ${sourceId}`);
    if (!STRUCTURED_RIGHTS.has(source.rightsMode)) {
        throw new Error(`${sourceId} lacks an explicit structured-retention rights mode`);
    }
    if (source.harvestPolicy.mode !== "structured-cache-with-attribution") {
        throw new Error(`${sourceId} does not authorize structured cache retention`);
    }
}
export function buildAsoiafStructuredRequestPlan(input) {
    const limit = Math.min(500, Math.max(1, input.recordLimit ?? 50));
    let sourceId;
    let url;
    const headers = {
        "User-Agent": ASOIAF_EXTERNAL_COLLECTOR_USER_AGENT,
        Accept: "application/json",
    };
    switch (input.adapterId) {
        case "wikidata-sparql": {
            sourceId = "structured-wikidata";
            const query = input.query.trim();
            if (!/^SELECT\b/i.test(query)) {
                throw new Error("Wikidata request plans require a SELECT query");
            }
            if (!/\bLIMIT\s+\d+\b/i.test(query)) {
                throw new Error("Wikidata request plans require an explicit LIMIT");
            }
            url = new URL("https://query.wikidata.org/sparql");
            url.searchParams.set("query", query);
            url.searchParams.set("format", "json");
            headers.Accept = "application/sparql-results+json";
            break;
        }
        case "openlibrary-catalog": {
            sourceId = "structured-openlibrary-api";
            if (input.key) {
                const key = input.key.startsWith("/") ? input.key : `/works/${input.key}`;
                url = new URL(`https://openlibrary.org${key}.json`);
            }
            else if (input.search) {
                url = new URL("https://openlibrary.org/search.json");
                url.searchParams.set("q", input.search);
                url.searchParams.set("limit", String(Math.min(limit, 100)));
            }
            else {
                throw new Error("Open Library request plans require key or search");
            }
            break;
        }
        case "crossref-works": {
            sourceId = "structured-crossref-api";
            if (input.doi) {
                url = new URL(`https://api.crossref.org/works/${encodeURIComponent(input.doi)}`);
            }
            else if (input.query) {
                url = new URL("https://api.crossref.org/works");
                url.searchParams.set("query", input.query);
                url.searchParams.set("rows", String(Math.min(limit, 100)));
            }
            else {
                throw new Error("Crossref request plans require doi or query");
            }
            url.searchParams.set("mailto", "bigbirdreturns@proton.me");
            break;
        }
        case "awoiaf-mediawiki": {
            sourceId = "structured-awoiaf-api";
            if ((!input.titles || input.titles.length === 0) && (!input.pageIds || input.pageIds.length === 0)) {
                throw new Error("A Wiki of Ice and Fire request plans require titles or pageIds");
            }
            url = new URL("https://awoiaf.westeros.org/api.php");
            url.searchParams.set("action", "query");
            url.searchParams.set("format", "json");
            url.searchParams.set("formatversion", "2");
            url.searchParams.set("prop", "info|categories|links|revisions");
            url.searchParams.set("inprop", "url");
            url.searchParams.set("cllimit", String(Math.min(limit, 500)));
            url.searchParams.set("pllimit", String(Math.min(limit, 500)));
            url.searchParams.set("rvlimit", "1");
            url.searchParams.set("rvprop", input.includeText ? "ids|timestamp|content" : "ids|timestamp");
            if (input.includeText)
                url.searchParams.set("rvslots", "main");
            if (input.titles?.length)
                url.searchParams.set("titles", input.titles.slice(0, 50).join("|"));
            if (input.pageIds?.length)
                url.searchParams.set("pageids", input.pageIds.slice(0, 50).join("|"));
            break;
        }
    }
    adapterForSource(input.adapterId, sourceId);
    const core = {
        format: ASOIAF_STRUCTURED_REQUEST_PLAN_FORMAT,
        adapterId: input.adapterId,
        sourceId,
        requestId: input.requestId,
        method: "GET",
        url: url.toString(),
        headers,
        responseMediaType: "application/json",
        recordLimit: limit,
        graphEffect: "none",
        canonEffect: "none",
    };
    return { ...core, planFingerprint: sha256(core) };
}
export function normalizeAsoiafStructuredPayload(input) {
    adapterForSource(input.adapterId, input.sourceId);
    const sourceResponseDigest = input.sourceResponseDigest ?? sha256(input.payload);
    if (!/^sha256:[a-f0-9]{64}$/.test(sourceResponseDigest)) {
        throw new Error("structured adapter requires a lowercase SHA-256 response digest");
    }
    const context = {
        adapterId: input.adapterId,
        sourceId: input.sourceId,
        requestId: input.requestId,
        sourceUri: input.sourceUri,
        sourceResponseDigest,
        includeText: input.includeText ?? false,
        maxTextCharacters: Math.min(50_000, Math.max(0, input.maxTextCharacters ?? 20_000)),
    };
    const result = normalizePayload(input.payload, context);
    const limit = Math.min(500, Math.max(1, input.recordLimit ?? 100));
    if (result.records.length > limit) {
        return {
            inputRecordCount: result.inputRecordCount,
            records: result.records.slice(0, limit),
            rejected: [
                ...result.rejected,
                ...result.records.slice(limit).map((_record, index) => ({
                    index: limit + index,
                    code: "record-limit",
                    detail: `record exceeded adapter limit ${limit}`,
                })),
            ],
        };
    }
    return result;
}
export function commitAsoiafStructuredPayload(options) {
    adapterForSource(options.adapterId, options.sourceId);
    const source = getAsoiafExternalSource(options.sourceId);
    const retrievedAt = options.retrievedAt ?? new Date().toISOString();
    initializeCollectorEstate(options.root, retrievedAt);
    const serializedInput = JSON.stringify(options.payload);
    const sourceResponseBytes = options.sourceResponseBytes
        ?? Buffer.byteLength(serializedInput, "utf8");
    const sourceResponseDigest = options.sourceResponseDigest
        ?? sha256(options.payload);
    if (!Number.isSafeInteger(sourceResponseBytes)
        || sourceResponseBytes < 0) {
        throw new Error("structured adapter response byte count is invalid");
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(sourceResponseDigest)) {
        throw new Error("structured adapter requires a lowercase SHA-256 response digest");
    }
    if (sourceResponseBytes > source.harvestPolicy.maxResponseBytes) {
        const terminal = recordGap({
            root: options.root,
            sourceId: options.sourceId,
            sourceRecordId: options.requestId,
            attemptedAt: retrievedAt,
            status: "rejected-oversize",
            reason: `structured response contained ${sourceResponseBytes} bytes; maximum is ${source.harvestPolicy.maxResponseBytes}`,
            requestCount: 0,
        });
        const core = {
            format: ASOIAF_STRUCTURED_ADAPTER_RECEIPT_FORMAT,
            adapterId: options.adapterId,
            sourceId: options.sourceId,
            requestId: options.requestId,
            sourceUri: options.sourceUri,
            retrievedAt,
            sourceResponseDigest,
            sourceResponseBytes,
            inputRecordCount: 0,
            committedRecordCount: 0,
            observationIds: [],
            candidateIds: [],
            normalizedRecordIds: [],
            rejected: [{ index: 0, code: "response-oversize", detail: terminal.gap.reason }],
            outcome: "refused",
            graphEffect: "none",
            canonEffect: "none",
        };
        const receipt = { ...core, receiptFingerprint: sha256(core) };
        writeJsonAtomic(adapterReceiptPath(options.root, options.requestId), receipt);
        return { receipt, records: [], observations: [], attempts: [terminal.attempt], gap: terminal.gap };
    }
    const normalized = normalizeAsoiafStructuredPayload(options);
    const records = [];
    const observations = [];
    const attempts = [];
    for (const record of normalized.records) {
        const cacheUri = writeNormalizedRecord(options.root, record);
        const retainedValue = record;
        if (containsPrivateContact(retainedValue)) {
            normalized.rejected.push({
                index: records.length,
                code: "private-contact-after-normalization",
                detail: `${record.sourceRecordId} retained private contact data`,
            });
            continue;
        }
        const committed = commitObservation({
            root: options.root,
            sourceId: options.sourceId,
            sourceRecordId: record.sourceRecordId,
            retrievedAt,
            contentDigest: record.normalizedDigest,
            recordType: record.recordType,
            title: record.title,
            summary: record.summary,
            mediaType: "application/json",
            responseBytes: Buffer.byteLength(JSON.stringify(record), "utf8"),
            retainedFields: [
                "adapterId",
                "sourceId",
                "sourceRecordId",
                "sourceResponseDigest",
                "normalizedDigest",
                "canonicalUri",
                "publishedAt",
                "updatedAt",
                "fields",
                "attribution",
                "cacheUri",
            ],
            retention: "licensed-structured-body",
            cacheUri,
            sourceUri: record.canonicalUri,
            publishedAt: record.publishedAt,
            updatedAt: record.updatedAt,
            credit: record.attribution,
            retainedValue,
            requestCount: 0,
            cacheHit: false,
        });
        const attempt = recordAttempt({
            root: options.root,
            sourceId: options.sourceId,
            sourceRecordId: record.sourceRecordId,
            startedAt: retrievedAt,
            completedAt: retrievedAt,
            outcome: "observed",
            requestCount: 0,
            cacheHit: false,
            receiptUri: committed.observation.receiptUri,
            observationId: committed.observation.observationId,
            gapId: null,
        });
        upsertCacheIndex(options.root, {
            cacheKey: cacheKey(options.sourceId, record.sourceRecordId),
            sourceId: options.sourceId,
            sourceRecordId: record.sourceRecordId,
            contentDigest: record.normalizedDigest,
            observationId: committed.observation.observationId,
            cacheUri,
            storedAt: retrievedAt,
        });
        records.push(record);
        observations.push(committed.observation);
        attempts.push(attempt);
    }
    generateCollectorCredits(options.root);
    const outcome = records.length === 0
        ? "refused"
        : normalized.rejected.length > 0
            ? "partial"
            : "observed";
    const core = {
        format: ASOIAF_STRUCTURED_ADAPTER_RECEIPT_FORMAT,
        adapterId: options.adapterId,
        sourceId: options.sourceId,
        requestId: options.requestId,
        sourceUri: options.sourceUri,
        retrievedAt,
        sourceResponseDigest,
        sourceResponseBytes,
        inputRecordCount: normalized.inputRecordCount,
        committedRecordCount: records.length,
        observationIds: observations.map((entry) => entry.observationId).sort(),
        candidateIds: observations.map((entry) => entry.candidateId).sort(),
        normalizedRecordIds: records.map((entry) => entry.recordId).sort(),
        rejected: [...normalized.rejected].sort((left, right) => left.index - right.index || left.code.localeCompare(right.code)),
        outcome,
        graphEffect: "none",
        canonEffect: "none",
    };
    const receipt = {
        ...core,
        receiptFingerprint: sha256(core),
    };
    writeJsonAtomic(adapterReceiptPath(options.root, options.requestId), receipt);
    return { receipt, records, observations, attempts, gap: null };
}
