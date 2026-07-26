#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
function option(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) fail(`Missing value for ${name}.`);
  return value;
}
function flag(name) {
  return args.includes(name);
}

const lockPath = resolve(option("--lock") ?? "package-lock.json");
const packagePath = resolve(option("--package") ?? "package.json");
const outputPath = resolve(option("--output") ?? "cyclonedx.sbom.json");
const sourceCommit = option("--commit", process.env.GITHUB_SHA ?? "unknown");
const check = flag("--check");

const lockBytes = readFileSync(lockPath);
const packageBytes = readFileSync(packagePath);
const lock = JSON.parse(lockBytes.toString("utf8"));
const pkg = JSON.parse(packageBytes.toString("utf8"));
if (!lock || typeof lock !== "object" || !lock.packages || typeof lock.packages !== "object") {
  fail(`${lockPath} is not a package-lock file with a packages table.`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function packageNameFromPath(path, entry) {
  if (typeof entry.name === "string" && entry.name) return entry.name;
  const marker = "node_modules/";
  const index = path.lastIndexOf(marker);
  if (index < 0) return path || pkg.name;
  return path.slice(index + marker.length).replace(/\\/g, "/");
}
function npmPurl(name, version) {
  const encoded = name.startsWith("@")
    ? `%40${name.slice(1).split("/").map(encodeURIComponent).join("/")}`
    : encodeURIComponent(name);
  return `pkg:npm/${encoded}@${encodeURIComponent(version)}`;
}
function bomRef(path, name, version) {
  return `urn:axm:npm:${sha256(Buffer.from(`${path}\u0000${name}\u0000${version}`))}`;
}
function integrityHash(integrity) {
  if (typeof integrity !== "string") return [];
  const match = /^(sha(?:256|384|512))-([A-Za-z0-9+/=]+)$/.exec(integrity);
  if (!match) return [];
  try {
    return [{ alg: match[1].toUpperCase().replace("SHA", "SHA-"), content: Buffer.from(match[2], "base64").toString("hex") }];
  } catch {
    return [];
  }
}

const entries = Object.entries(lock.packages)
  .filter(([path, entry]) => path !== "" && entry && typeof entry === "object" && typeof entry.version === "string")
  .map(([path, entry]) => {
    const name = packageNameFromPath(path, entry);
    const version = entry.version;
    return {
      path: path.replace(/\\/g, "/"),
      entry,
      name,
      version,
      ref: bomRef(path, name, version),
      purl: npmPurl(name, version),
    };
  })
  .sort((a, b) => compareStrings(a.path, b.path));

const byPath = new Map(entries.map((entry) => [entry.path, entry]));
function resolveDependencyPath(parentPath, name) {
  const normalized = parentPath.replace(/\\/g, "/");
  let cursor = normalized;
  while (true) {
    const nested = cursor ? `${cursor}/node_modules/${name}` : `node_modules/${name}`;
    if (byPath.has(nested)) return nested;
    const marker = cursor.lastIndexOf("/node_modules/");
    if (marker < 0) break;
    cursor = cursor.slice(0, marker);
  }
  const root = `node_modules/${name}`;
  return byPath.has(root) ? root : null;
}

const rootRef = `urn:axm:application:${sha256(Buffer.from(`${pkg.name}@${pkg.version}\u0000${sourceCommit}`))}`;
const components = entries.map(({ entry, name, version, ref, purl, path }) => {
  const component = {
    type: "library",
    "bom-ref": ref,
    name,
    version,
    purl,
    scope: entry.dev ? "optional" : "required",
    properties: [
      { name: "axm:npm-lock-path", value: path },
      { name: "axm:npm-dev", value: String(Boolean(entry.dev)) },
      { name: "axm:npm-optional", value: String(Boolean(entry.optional)) },
    ],
  };
  const hashes = integrityHash(entry.integrity);
  if (hashes.length) component.hashes = hashes;
  if (typeof entry.license === "string" && entry.license.trim()) {
    component.licenses = [{ license: { id: entry.license.trim() } }];
  }
  return component;
});

const rootDependencies = {
  ...(lock.packages[""]?.dependencies ?? {}),
  ...(lock.packages[""]?.devDependencies ?? {}),
  ...(lock.packages[""]?.optionalDependencies ?? {}),
};
const dependencies = [
  {
    ref: rootRef,
    dependsOn: Object.keys(rootDependencies)
      .map((name) => resolveDependencyPath("", name))
      .filter(Boolean)
      .map((path) => byPath.get(path).ref)
      .sort(compareStrings),
  },
  ...entries.map(({ path, entry, ref }) => {
    const declared = {
      ...(entry.dependencies ?? {}),
      ...(entry.optionalDependencies ?? {}),
      ...(entry.peerDependencies ?? {}),
    };
    return {
      ref,
      dependsOn: Object.keys(declared)
        .map((name) => resolveDependencyPath(path, name))
        .filter(Boolean)
        .map((resolvedPath) => byPath.get(resolvedPath).ref)
        .sort(compareStrings),
    };
  }),
].sort((a, b) => compareStrings(a.ref, b.ref));

const document = {
  bomFormat: "CycloneDX",
  specVersion: "1.7",
  version: 1,
  metadata: {
    component: {
      type: "application",
      "bom-ref": rootRef,
      name: pkg.name,
      version: pkg.version,
      properties: [
        { name: "axm:source-commit", value: sourceCommit },
        { name: "axm:package-lock-sha256", value: sha256(lockBytes) },
        { name: "axm:package-json-sha256", value: sha256(packageBytes) },
      ],
    },
    tools: {
      components: [{ type: "application", name: "axm-cyclonedx-generator", version: "1" }],
    },
  },
  components,
  dependencies,
};

const output = `${JSON.stringify(document, null, 2)}\n`;
if (check) {
  const current = readFileSync(outputPath, "utf8");
  if (current !== output) fail(`${relative(process.cwd(), outputPath)} is stale.`);
  console.log(`${relative(process.cwd(), outputPath)} is current.`);
} else {
  writeFileSync(outputPath, output);
  console.log(JSON.stringify({
    format: "axm-cyclonedx-generation-receipt/1",
    output: relative(process.cwd(), outputPath),
    components: components.length,
    dependencies: dependencies.length,
    sha256: sha256(Buffer.from(output)),
  }, null, 2));
}
