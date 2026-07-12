import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateArc } from "../engine/schema.js";
import type { BoundaryCategory } from "./boundary-manifest.js";
import {
  CYCLE_STAGES,
  GAME_ONLY_SCHEMA_PREFIXES,
  MODULE_CLASSIFICATION,
  PUBLIC_SYMBOL_OVERRIDES,
} from "./boundary-manifest.js";

export interface BoundaryAudit {
  generatedFrom: string;
  completeness: { unclassifiedModules: string[]; unclassifiedCycleStages: string[] };
  publicSurface: { total: number; gameOnly: number; gameOnlyRatio: number; byCategory: Record<string, number>; symbols: Array<{ symbol: string; category: BoundaryCategory }> };
  schema: { mandatoryPaths: string[]; fields: Array<{ path: string; category: BoundaryCategory; enterprisePlaceholder: boolean }>; enterprisePlaceholderPaths: string[]; enterprisePlaceholderCount: number };
  cycle: { totalStages: number; mandatoryGameStages: number; mandatoryGameRatio: number; stages: typeof CYCLE_STAGES };
  dependencies: { totalEdges: number; edges: DependencyEdge[]; kernelViolations: DependencyEdge[] };
  modules: { total: number; loc: number; inventory: Array<{ module: string; category: BoundaryCategory; loc: number }>; byCategory: Record<string, { modules: number; loc: number; locRatio: number }> };
  headlessTarget: { modules: string[]; loc: number; forbiddenDependencies: string[]; forbiddenGlobals: string[] };
  minimumCoreFilesToEdit: number;
  headlessKernelViolations: string[];
  disposition: "keep" | "modularize-or-split";
}

interface DependencyEdge {
  from: string;
  fromCategory: BoundaryCategory;
  to: string;
  toCategory: BoundaryCategory;
  import: string;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ENGINE = path.join(ROOT, "src", "engine");

function engineFiles(dir = ENGINE, prefix = ""): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return engineFiles(path.join(dir, entry.name), relative);
    return entry.name.endsWith(".ts") ? [relative] : [];
  }).sort();
}

function lines(source: string): number {
  return source.split(/\r?\n/).length;
}

function exportedSymbols(module: string, source: string): string[] {
  const symbols = new Set<string>();
  const declaration = /export\s+(?:declare\s+)?(?:type|interface|class|function|const)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of source.matchAll(declaration)) symbols.add(match[1]!);
  const list = /export\s+type\s*\{([^}]+)\}/g;
  for (const match of source.matchAll(list)) {
    for (const raw of match[1]!.split(",")) symbols.add(raw.trim().split(/\s+as\s+/)[1] ?? raw.trim().split(/\s+as\s+/)[0]!);
  }
  return [...symbols].map((symbol) => `${module}#${symbol}`);
}

function normalizePath(parts: Array<string | number>): string {
  let out = "";
  for (const part of parts) {
    if (typeof part === "number") out += "[]";
    else out += out ? `.${part}` : part;
  }
  return out;
}

function concreteObjectPaths(value: unknown, parts: Array<string | number> = []): Array<Array<string | number>> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => concreteObjectPaths(item, [...parts, index]));
  }
  if (!value || typeof value !== "object") return [];
  const result: Array<Array<string | number>> = [];
  for (const [key, child] of Object.entries(value)) {
    const next = [...parts, key];
    result.push(next);
    result.push(...concreteObjectPaths(child, next));
  }
  return result;
}

function parentAt(root: unknown, parts: Array<string | number>): Record<string, unknown> | unknown[] | null {
  let cursor: unknown = root;
  for (const part of parts.slice(0, -1)) {
    if (!cursor || typeof cursor !== "object") return null;
    cursor = (cursor as Record<string | number, unknown>)[part];
  }
  return cursor && typeof cursor === "object" ? cursor as Record<string, unknown> | unknown[] : null;
}

function requiredSchemaPaths(fixture: unknown): string[] {
  const required = new Set<string>();
  for (const parts of concreteObjectPaths(fixture)) {
    const candidate = structuredClone(fixture);
    const parent = parentAt(candidate, parts);
    const leaf = parts.at(-1)!;
    if (!parent || typeof leaf === "number") continue;
    delete (parent as Record<string, unknown>)[leaf];
    try {
      validateArc(candidate);
    } catch {
      required.add(normalizePath(parts));
    }
  }
  return [...required].sort();
}

function schemaCategory(field: string): BoundaryCategory {
  if (GAME_ONLY_SCHEMA_PREFIXES.some((prefix) => field === prefix || field.startsWith(`${prefix}.`) || field.startsWith(`${prefix}[]`))) {
    return "game_only_policy";
  }
  if (field.startsWith("challenges[].mechanicChecks") || field.startsWith("attributes") || field.startsWith("roles")) {
    return "decision_kernel";
  }
  return "cartridge_data";
}

function resolveEngineImport(from: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  let resolved = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier)).replace(/\.js$/, ".ts");
  if (!resolved.endsWith(".ts")) resolved += ".ts";
  if (MODULE_CLASSIFICATION[resolved]) return resolved;
  const index = resolved.replace(/\.ts$/, "/index.ts");
  return MODULE_CLASSIFICATION[index] ? index : null;
}

export function generateBoundaryAudit(): BoundaryAudit {
  const files = engineFiles();
  const unclassifiedModules = files.filter((file) => !MODULE_CLASSIFICATION[file]);
  const classifiedButMissing = Object.keys(MODULE_CLASSIFICATION).filter((file) => !files.includes(file));
  unclassifiedModules.push(...classifiedButMissing.map((file) => `missing:${file}`));

  const moduleStats: Record<string, { modules: number; loc: number; locRatio: number }> = {};
  const exports: Array<{ symbol: string; category: BoundaryCategory }> = [];
  const edges: DependencyEdge[] = [];
  const moduleInventory: Array<{ module: string; category: BoundaryCategory; loc: number }> = [];
  const headlessKernelViolations: string[] = [];
  let totalLoc = 0;

  for (const file of files) {
    const source = fs.readFileSync(path.join(ENGINE, file), "utf8");
    const category = MODULE_CLASSIFICATION[file];
    if (!category) continue;
    const loc = lines(source);
    totalLoc += loc;
    const stats = moduleStats[category] ?? { modules: 0, loc: 0, locRatio: 0 };
    stats.modules += 1;
    stats.loc += loc;
    moduleStats[category] = stats;
    moduleInventory.push({ module: file, category, loc });

    for (const qualified of exportedSymbols(file, source)) {
      const symbol = qualified.split("#")[1]!;
      exports.push({ symbol: qualified, category: PUBLIC_SYMBOL_OVERRIDES[symbol] ?? category });
    }

    const imports = /(?:import|export)\s+(?:type\s+)?(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g;
    for (const match of source.matchAll(imports)) {
      const specifier = match[1]!;
      const target = resolveEngineImport(file, specifier);
      if (target) {
        edges.push({ from: file, fromCategory: category, to: target, toCategory: MODULE_CLASSIFICATION[target]!, import: specifier });
      } else if (!specifier.startsWith(".")) {
        edges.push({ from: file, fromCategory: category, to: `external:${specifier}`, toCategory: "external_verification_integration", import: specifier });
      }
      if (category === "decision_kernel" && /^(react|react-dom)$|localStorage|document|window/.test(specifier)) {
        headlessKernelViolations.push(`${file} -> ${specifier}`);
      }
    }
    if (category === "decision_kernel" && /\b(localStorage|document|window)\b/.test(source)) {
      headlessKernelViolations.push(`${file} uses browser global`);
    }
  }
  for (const stats of Object.values(moduleStats)) stats.locRatio = stats.loc / totalLoc;

  const cycleSource = fs.readFileSync(path.join(ENGINE, "cycle.ts"), "utf8");
  const discoveredStages = [...cycleSource.matchAll(/^\s*\/\/\s*─+\s*STEP\s+([^:]+):\s*([^\r\n─]+)/gm)]
    .map((match) => `${match[1]!.trim()}:${match[2]!.trim()}`);
  const manifestStages = new Set(CYCLE_STAGES.map((stage) => `${stage.step}:${stage.title}`));
  const unclassifiedCycleStages = discoveredStages.filter((stage) => !manifestStages.has(stage));
  for (const stage of manifestStages) if (!discoveredStages.includes(stage)) unclassifiedCycleStages.push(`missing:${stage}`);

  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "cartridges", "first-lockout.arc.json"), "utf8")) as unknown;
  const mandatoryPaths = requiredSchemaPaths(fixture);
  const schemaFields = mandatoryPaths.map((field) => {
    const category = schemaCategory(field);
    return { path: field, category, enterprisePlaceholder: category === "game_only_policy" };
  });
  const enterprisePlaceholderPaths = schemaFields.filter((field) => field.enterprisePlaceholder).map((field) => field.path);
  const bySurfaceCategory: Record<string, number> = {};
  for (const item of exports) bySurfaceCategory[item.category] = (bySurfaceCategory[item.category] ?? 0) + 1;
  const gameOnly = bySurfaceCategory.game_only_policy ?? 0;
  const mandatoryGameStages = CYCLE_STAGES.filter((stage) => stage.category === "game_only_policy" && !stage.removable).length;
  const kernelViolations = edges.filter((edge) =>
    edge.fromCategory === "decision_kernel" &&
    !["decision_kernel", "external_verification_integration"].includes(edge.toCategory),
  );
  const filesToEdit = new Set([
    ...files.filter((file) => MODULE_CLASSIFICATION[file] === "game_only_policy"),
    ...kernelViolations.map((edge) => edge.from),
  ]);

  const keepDisqualified = enterprisePlaceholderPaths.length > 0 || mandatoryGameStages > 0 || kernelViolations.length > 0;
  const kernelDir = path.join(ROOT, "src", "kernel");
  const kernelFiles = fs.readdirSync(kernelDir).filter((file) => file.endsWith(".ts")).sort();
  let kernelLoc = 0;
  const forbiddenDependencies: string[] = [];
  const forbiddenGlobals: string[] = [];
  for (const file of kernelFiles) {
    const source = fs.readFileSync(path.join(kernelDir, file), "utf8");
    kernelLoc += lines(source);
    for (const match of source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g)) {
      const specifier = match[1]!;
      if (/react|game|engine|enterprise|audit/.test(specifier)) forbiddenDependencies.push(`${file} -> ${specifier}`);
    }
    if (/\b(localStorage|document|window)\b/.test(source)) forbiddenGlobals.push(file);
  }
  return {
    generatedFrom: "src/engine + cartridges/first-lockout.arc.json",
    completeness: { unclassifiedModules, unclassifiedCycleStages },
    publicSurface: { total: exports.length, gameOnly, gameOnlyRatio: exports.length ? gameOnly / exports.length : 0, byCategory: bySurfaceCategory, symbols: exports.sort((a, b) => a.symbol.localeCompare(b.symbol)) },
    schema: { mandatoryPaths, fields: schemaFields, enterprisePlaceholderPaths, enterprisePlaceholderCount: enterprisePlaceholderPaths.length },
    cycle: { totalStages: CYCLE_STAGES.length, mandatoryGameStages, mandatoryGameRatio: mandatoryGameStages / CYCLE_STAGES.length, stages: CYCLE_STAGES },
    dependencies: { totalEdges: edges.length, edges, kernelViolations },
    modules: { total: files.length, loc: totalLoc, inventory: moduleInventory, byCategory: moduleStats },
    headlessTarget: { modules: kernelFiles, loc: kernelLoc, forbiddenDependencies, forbiddenGlobals },
    minimumCoreFilesToEdit: filesToEdit.size,
    headlessKernelViolations,
    disposition: keepDisqualified ? "modularize-or-split" : "keep",
  };
}

export function renderBoundaryAudit(audit: BoundaryAudit): string {
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
  return `# Enterprise boundary audit (generated)\n\n` +
    `This report is generated by \`npm run audit:boundary\`; edit the manifest or source, not this file.\n\n` +
    `- Disposition gate: **${audit.disposition}**\n` +
    `- Public surface classified game-only: **${audit.publicSurface.gameOnly}/${audit.publicSurface.total} (${pct(audit.publicSurface.gameOnlyRatio)})**\n` +
    `- Mandatory game-only schema placeholders: **${audit.schema.enterprisePlaceholderCount}**\n` +
    `- Mandatory game-policy cycle stages: **${audit.cycle.mandatoryGameStages}/${audit.cycle.totalStages} (${pct(audit.cycle.mandatoryGameRatio)})**\n` +
    `- Proposed-kernel dependency violations: **${audit.dependencies.kernelViolations.length}**\n` +
    `- Minimum existing engine files requiring edits: **${audit.minimumCoreFilesToEdit}**\n` +
    `- Engine source: **${audit.modules.loc} LOC across ${audit.modules.total} modules**\n\n` +
    `- Headless target: **${audit.headlessTarget.loc} LOC across ${audit.headlessTarget.modules.length} modules; ${audit.headlessTarget.forbiddenDependencies.length + audit.headlessTarget.forbiddenGlobals.length} forbidden edges/globals**\n\n` +
    `## Kernel dependency violations\n\n` +
    (audit.dependencies.kernelViolations.map((edge) => `- \`${edge.from}\` → \`${edge.to}\``).join("\n") || "- None") +
    `\n\n## Mandatory game-shaped placeholder paths\n\n` +
    audit.schema.enterprisePlaceholderPaths.map((field) => `- \`${field}\``).join("\n") + "\n";
}
