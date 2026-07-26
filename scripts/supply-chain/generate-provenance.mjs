#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

function fail(message) {
  console.error(message);
  process.exit(1);
}
const args = process.argv.slice(2);
function values(name) {
  const out = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) fail(`Missing value for ${name}.`);
    out.push(value);
    index += 1;
  }
  return out;
}
function option(name, fallback = null) {
  return values(name)[0] ?? fallback;
}

const subjectPaths = values("--subject").map((path) => resolve(path));
if (subjectPaths.length === 0) fail("At least one --subject file is required.");
for (const path of subjectPaths) {
  if (!statSync(path).isFile()) fail(`Subject is not a file: ${path}`);
}
const outputPath = resolve(option("--output") ?? "provenance.intoto.json");
const evidenceRoot = dirname(outputPath);
const repository = option("--repository") ?? process.env.GITHUB_REPOSITORY ?? "BigBirdReturns/axm-arc";
const commit = option("--commit") ?? process.env.GITHUB_SHA ?? "unknown";
const ref = option("--ref") ?? process.env.GITHUB_REF ?? "unknown";
const workflow = option("--workflow") ?? process.env.GITHUB_WORKFLOW_REF ?? "local";
const invocation = option("--invocation") ?? process.env.GITHUB_RUN_ID ?? "local";
const builder = option("--builder") ?? "https://github.com/actions/runner";
const sourceDateEpoch = option("--source-date-epoch") ?? process.env.SOURCE_DATE_EPOCH ?? "0";
const nodeVersion = option("--node") ?? process.version;
const npmVersion = option("--npm") ?? "unknown";
const resolvedDependencies = values("--dependency");

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function dependencyRecord(raw) {
  const split = raw.indexOf("=");
  if (split < 1) fail(`Dependency must be name=digest-or-uri: ${raw}`);
  const name = raw.slice(0, split);
  const value = raw.slice(split + 1);
  return /^[0-9a-f]{64}$/.test(value)
    ? { uri: name, digest: { sha256: value } }
    : { uri: `${name}=${value}` };
}

const statement = {
  _type: "https://in-toto.io/Statement/v1",
  subject: subjectPaths
    .map((path) => ({
      name: relative(evidenceRoot, path).replace(/\\/g, "/"),
      digest: { sha256: sha256(path) },
    }))
    .sort((a, b) => compareStrings(a.name, b.name)),
  predicateType: "https://slsa.dev/provenance/v1",
  predicate: {
    buildDefinition: {
      buildType: "https://axm.tools/build-types/axm-arc-static/v1",
      externalParameters: {
        repository,
        commit,
        ref,
        sourceDateEpoch,
      },
      internalParameters: {
        nodeVersion,
        npmVersion,
        workflow,
      },
      resolvedDependencies: resolvedDependencies.map(dependencyRecord).sort((a, b) => compareStrings(a.uri, b.uri)),
    },
    runDetails: {
      builder: { id: builder },
      metadata: { invocationId: invocation },
      byproducts: [],
    },
  },
};

const output = `${JSON.stringify(statement, null, 2)}\n`;
writeFileSync(outputPath, output);
console.log(JSON.stringify({
  format: "axm-arc-release-provenance-generation/1",
  output: relative(process.cwd(), outputPath),
  subjects: statement.subject,
  predicateType: statement.predicateType,
}, null, 2));
