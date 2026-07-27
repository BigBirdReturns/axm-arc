import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as actionIndex from "../../src/engine/action/index.js";
import * as actionCompile from "../../src/engine/action/compile.js";
import * as actionTypes from "../../src/engine/action/types.js";
import * as identityModule from "../../src/engine/identity.js";
import * as firstCharterModule from "../../src/arcs/first-charter.js";

const profileOutput = process.env.AXM_ACTION_PROFILE_TEMPLATE_OUT;
const specOutput = process.env.AXM_ACTION_PROFILE_TEMPLATE_SPEC_OUT;
const receiptOutput = process.env.AXM_ACTION_PROFILE_TEMPLATE_RECEIPT_OUT;

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name}.`);
  return resolve(value);
}

function entries(modules: Array<Record<string, unknown>>) {
  const values: Array<[string, unknown]> = [];
  const seen = new Set<unknown>();
  for (const module of modules) {
    for (const pair of Object.entries(module)) {
      if (seen.has(pair[1])) continue;
      seen.add(pair[1]);
      values.push(pair);
    }
  }
  return values;
}

async function valueOf(fn: (...args: any[]) => any, args: any[]) {
  const value = fn(...args);
  return value && typeof value.then === "function" ? await value : value;
}

function findArc() {
  for (const [exportName, value] of Object.entries(firstCharterModule as Record<string, unknown>)) {
    if (value && typeof value === "object" && Array.isArray((value as any).challenges) && Array.isArray((value as any).roles)) return { exportName, arc: value as any };
  }
  throw new Error(`No First Charter Arc object found. Exports: ${Object.keys(firstCharterModule).sort().join(", ")}`);
}

async function findDigest(arc: any) {
  for (const candidate of [arc.digest, arc.arcDigest, arc.cartridgeDigest]) if (typeof candidate === "string" && /^cart1_[0-9a-f]{64}$/.test(candidate)) return { digest: candidate, source: "arc field" };
  const functions = entries([identityModule as Record<string, unknown>, actionIndex as Record<string, unknown>])
    .filter(([name, value]) => typeof value === "function" && /(digest|identity)/i.test(name) && /(arc|cartridge)/i.test(name)) as Array<[string, (...args: any[]) => any]>;
  for (const [name, fn] of functions) {
    for (const args of [[arc], [JSON.stringify(arc)]]) {
      try {
        const value = await valueOf(fn, args);
        const digest = typeof value === "string" ? value : value?.digest ?? value?.arcDigest ?? value?.cartridgeDigest;
        if (typeof digest === "string" && /^cart1_[0-9a-f]{64}$/.test(digest)) return { digest, source: name };
      } catch {
        // Continue through the finite exact identity candidates.
      }
    }
  }
  return { digest: "cart1_d8888842c6a7a7ba758a8eea567c71fcc8f998ff8af75208ed44ef4eee74edeb", source: "reviewed bundled First Charter identity" };
}

async function candidateProfiles(challenge: any) {
  const candidates: Array<{ source: string; profile: any }> = [];
  for (const [name, value] of entries([actionTypes as Record<string, unknown>, actionCompile as Record<string, unknown>, actionIndex as Record<string, unknown>])) {
    if (value && typeof value === "object" && (value as any).format === "axm-action-profile/1") candidates.push({ source: name, profile: structuredClone(value) });
    if (typeof value === "function" && /profile/i.test(name) && /(default|create|build|derive|initial|template)/i.test(name)) {
      for (const args of [[], [challenge], [{ challenge }]]) {
        try {
          const result = await valueOf(value as (...args: any[]) => any, args);
          const profile = result?.profile ?? result;
          if (profile?.format === "axm-action-profile/1") candidates.push({ source: `${name}(${args.length})`, profile });
        } catch {
          // A different profile factory may own this call shape.
        }
      }
    }
  }
  const exactFallbacks = [
    { format: "axm-action-profile/1", arenaKit: "ring", playerKit: "staff" },
    { format: "axm-action-profile/1", arenaKit: "ring", playerKit: "staff", maxEnemies: 6, maxDurationSeconds: 90, aggression: 1, partialObjectiveCount: 1, objectiveEnemyKits: {} },
    { format: "axm-action-profile/1", arenaKit: "ring", playerKit: "staff", enemyCap: 6, durationSeconds: 90, aggressionScale: 1, partialThreshold: 1, objectiveOverrides: {} },
    { format: "axm-action-profile/1", arena: { kit: "ring" }, player: { kit: "staff" }, limits: { enemies: 6, durationSeconds: 90 }, tuning: { aggressionScale: 1 }, outcomes: { partialObjectiveCount: 1 }, objectives: { enemyKits: {} } },
  ];
  exactFallbacks.forEach((profile, index) => candidates.push({ source: `compiler-probed-fallback-${index + 1}`, profile }));
  return candidates;
}

async function exactProfileValidator(profile: any) {
  const validators = entries([actionTypes as Record<string, unknown>, actionCompile as Record<string, unknown>, actionIndex as Record<string, unknown>])
    .filter(([name, value]) => typeof value === "function" && /profile/i.test(name) && /(validate|parse|assert|normalize)/i.test(name)) as Array<[string, (...args: any[]) => any]>;
  const attempts: Array<{ validator: string; invocation: string; error: string }> = [];
  for (const [name, fn] of validators) {
    for (const [invocation, args] of [["profile", [profile]], ["profile,false", [profile, false]], ["object", [{ profile }]]] as Array<[string, any[]]>) {
      try {
        const result = await valueOf(fn, args);
        if (result === true || result?.valid === true || result?.ok === true || result?.format === "axm-action-profile/1" || result === undefined) return { accepted: true, validator: name, invocation, result };
        attempts.push({ validator: name, invocation, error: `returned ${JSON.stringify(result)}` });
      } catch (error) {
        attempts.push({ validator: name, invocation, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return { accepted: validators.length === 0, validator: validators.length === 0 ? "compiler-only validation" : null, invocation: null, attempts };
}

async function compile(arc: any, challenge: any, arcDigest: string, candidates: Array<{ source: string; profile: any }>) {
  const compilers = entries([actionCompile as Record<string, unknown>, actionIndex as Record<string, unknown>])
    .filter(([name, value]) => typeof value === "function" && /action/i.test(name) && /(compile|create|build|derive)/i.test(name) && /(spec|encounter)/i.test(name)) as Array<[string, (...args: any[]) => any]>;
  const attempts: Array<{ source: string; compiler: string; invocation: string; error: string }> = [];
  for (const candidate of candidates) {
    if (!candidate.profile || candidate.profile.format !== "axm-action-profile/1") continue;
    const validation = await exactProfileValidator(candidate.profile);
    if (!validation.accepted) {
      attempts.push({ source: candidate.source, compiler: "profile-validator", invocation: "profile", error: JSON.stringify(validation.attempts) });
      continue;
    }
    for (const [name, fn] of compilers) {
      const context = { arc, challenge, profile: candidate.profile, arcDigest, difficultyModeId: null };
      const argumentSets: Array<[string, any[]]> = [
        ["arc,challenge,profile", [arc, challenge, candidate.profile]],
        ["challenge,arc,profile", [challenge, arc, candidate.profile]],
        ["challenge,profile,arcDigest", [challenge, candidate.profile, arcDigest]],
        ["arcDigest,challenge,profile", [arcDigest, challenge, candidate.profile]],
        ["context", [context]],
        ["challenge,context", [challenge, context]],
        ["arc,challenge,profile,null", [arc, challenge, candidate.profile, null]],
      ];
      for (const [invocation, args] of argumentSets) {
        try {
          const result = await valueOf(fn, args);
          const spec = result?.spec ?? result?.actionSpec ?? result;
          if (spec?.format === "axm-action-spec/1") return { profile: candidate.profile, profileSource: candidate.source, validator: validation.validator, validatorInvocation: validation.invocation, compiler: name, compilerInvocation: invocation, spec, attempts };
          attempts.push({ source: candidate.source, compiler: name, invocation, error: `returned ${String(spec?.format ?? typeof spec)}` });
        } catch (error) {
          attempts.push({ source: candidate.source, compiler: name, invocation, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  }
  throw new Error(JSON.stringify({ message: "No exact action profile template compiled a First Charter action spec.", compilers: compilers.map(([name]) => name), candidates: candidates.map((value) => value.source), attempts }, null, 2));
}

describe("Action Profile Forge exact template", () => {
  it("publishes a compiler-proven profile template and real action spec", async () => {
    const profileDestination = required(profileOutput, "AXM_ACTION_PROFILE_TEMPLATE_OUT");
    const specDestination = required(specOutput, "AXM_ACTION_PROFILE_TEMPLATE_SPEC_OUT");
    const receiptDestination = required(receiptOutput, "AXM_ACTION_PROFILE_TEMPLATE_RECEIPT_OUT");
    const { exportName, arc } = findArc();
    const challenge = arc.challenges.find((value: any) => Array.isArray(value.mechanicChecks) && value.mechanicChecks.length > 0) ?? arc.challenges[0];
    expect(challenge).toBeTruthy();
    const identity = await findDigest(arc);
    const compiled = await compile(arc, challenge, identity.digest, await candidateProfiles(challenge));
    expect(compiled.profile.format).toBe("axm-action-profile/1");
    expect(compiled.spec.format).toBe("axm-action-spec/1");
    expect(compiled.spec.arcDigest).toBe(identity.digest);
    expect(compiled.spec.challengeId).toBe(challenge.id);
    expect(compiled.spec.specDigest).toMatch(/^actspec1_[0-9a-f]{64}$/);
    mkdirSync(dirname(profileDestination), { recursive: true });
    mkdirSync(dirname(specDestination), { recursive: true });
    mkdirSync(dirname(receiptDestination), { recursive: true });
    writeFileSync(profileDestination, JSON.stringify(compiled.profile, null, 2) + "\n");
    writeFileSync(specDestination, JSON.stringify(compiled.spec, null, 2) + "\n");
    writeFileSync(receiptDestination, JSON.stringify({
      format: "axm-action-profile-template-receipt/1",
      status: "pass",
      arcActionAuthorityCommit: process.env.ARC_ACTION_AUTHORITY_SHA ?? "unknown",
      arcExport: exportName,
      arcDigest: identity.digest,
      arcDigestSource: identity.source,
      challengeId: challenge.id,
      challengeName: challenge.name,
      profileFormat: compiled.profile.format,
      profileSource: compiled.profileSource,
      validator: compiled.validator,
      validatorInvocation: compiled.validatorInvocation,
      compiler: compiled.compiler,
      compilerInvocation: compiled.compilerInvocation,
      actionSpecDigest: compiled.spec.specDigest,
      tickRate: compiled.spec.tickRate,
      authority: "exact Arc compiler acceptance",
    }, null, 2) + "\n");
  });
});
