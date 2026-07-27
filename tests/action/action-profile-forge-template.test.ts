import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { FIRST_CHARTER } from "../../src/arcs/first-charter.js";
import { cartridgeDigest } from "../../src/engine/cartridge-digest.js";
import { compileActionEncounter } from "../../src/engine/action/compile.js";
import { parseActionProfile } from "../../src/engine/action/profile.js";
import { ACTION_EXTENSION_KEY, ACTION_PROFILE_FORMAT, type ActionEnemyKit, type ActionProfile } from "../../src/engine/action/types.js";

const fallbackRoot = mkdtempSync(join(tmpdir(), "axm-action-profile-template-"));
const profileOutput = resolve(process.env.AXM_ACTION_PROFILE_TEMPLATE_OUT ?? join(fallbackRoot, "first-charter.action-profile.json"));
const specOutput = resolve(process.env.AXM_ACTION_PROFILE_TEMPLATE_SPEC_OUT ?? join(fallbackRoot, "first-charter.action-spec.json"));
const receiptOutput = resolve(process.env.AXM_ACTION_PROFILE_TEMPLATE_RECEIPT_OUT ?? join(fallbackRoot, "first-charter.template-receipt.json"));
const authority = process.env.ARC_ACTION_AUTHORITY_SHA ?? "6eef311836ee7cb3a43a94ce51f448a2699c3b04";

describe("Action Profile Forge exact template", () => {
  it("publishes one exact compiler-proven First Charter profile and action spec", () => {
    const challenge = FIRST_CHARTER.challenges.find((candidate) => candidate.mechanicChecks.length > 0) ?? FIRST_CHARTER.challenges[0];
    expect(challenge).toBeTruthy();
    const objectiveIds = challenge!.mechanicChecks.map((check) => check.id);
    const kits: ActionEnemyKit[] = ["skirmisher", "duelist", "swarm", "hexer", "breaker"];
    const profile: ActionProfile = parseActionProfile({
      format: ACTION_PROFILE_FORMAT,
      encounters: {
        [challenge!.id]: {
          arenaKit: "ring",
          playerKit: "staff",
          durationSeconds: 90,
          arenaScale: 1,
          enemyScale: 1,
          objectiveOrder: objectiveIds,
          objectiveKits: Object.fromEntries(objectiveIds.map((id, index) => [id, kits[index % kits.length]])),
        },
      },
    });
    const arc = structuredClone(FIRST_CHARTER);
    arc.extensions = { ...(arc.extensions ?? {}), [ACTION_EXTENSION_KEY]: JSON.parse(JSON.stringify(profile)) };
    const spec = compileActionEncounter(arc, challenge!);
    const digest = cartridgeDigest(arc);
    expect(spec.format).toBe("axm-action-spec/1");
    expect(spec.arcDigest).toBe(digest);
    expect(spec.challengeId).toBe(challenge!.id);
    expect(spec.specDigest).toMatch(/^actspec1_[0-9a-f]{64}$/);
    expect(spec.tickRate).toBe(30);
    expect(spec.objectives.map((objective) => objective.id)).toEqual(objectiveIds);
    mkdirSync(dirname(profileOutput), { recursive: true });
    mkdirSync(dirname(specOutput), { recursive: true });
    mkdirSync(dirname(receiptOutput), { recursive: true });
    writeFileSync(profileOutput, JSON.stringify(profile, null, 2) + "\n");
    writeFileSync(specOutput, JSON.stringify(spec, null, 2) + "\n");
    writeFileSync(receiptOutput, JSON.stringify({
      format: "axm-action-profile-template-receipt/1",
      status: "pass",
      arcActionAuthorityCommit: authority,
      arcExport: "FIRST_CHARTER",
      arcDigest: digest,
      arcDigestSource: "cartridgeDigest",
      challengeId: challenge!.id,
      challengeName: challenge!.name,
      profileFormat: profile.format,
      profileSource: "parseActionProfile exact deployed contract",
      validator: "parseActionProfile",
      compiler: "compileActionEncounter",
      actionSpecDigest: spec.specDigest,
      tickRate: spec.tickRate,
      authority: "exact Arc compiler acceptance",
    }, null, 2) + "\n");
  });
});
