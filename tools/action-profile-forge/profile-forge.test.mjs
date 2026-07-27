import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTION_PROFILE_FORMAT,
  ACTION_SPEC_FORMAT,
  parseStrictJson,
  canonicalJson,
  inspectProfile,
  updateConcept,
  setObjectiveEnemyKit,
  removeObjectiveOverride,
  validateProfile,
  buildForgeReceipt,
} from "./profile-forge.mjs";

const SPEC = {
  format: ACTION_SPEC_FORMAT,
  specDigest: "actspec1_" + "a".repeat(64),
  challengeId: "forge-test",
  objectives: [
    { id: "first", label: "First objective" },
    { id: "second", label: "Second objective" },
  ],
};

const PROFILE = {
  format: ACTION_PROFILE_FORMAT,
  arenaKit: "ring",
  playerKit: "staff",
  maxEnemies: 6,
  maxDurationSeconds: 90,
  aggression: 1,
  partialObjectiveCount: 1,
  objectiveEnemyKits: {},
  "creator.example/notes": { text: "preserve me", order: [3, 2, 1] },
};

test("strict parser rejects duplicate keys before profile semantics", () => {
  assert.throws(
    () => parseStrictJson('{"format":"axm-action-profile/1","format":"forged"}'),
    /Duplicate JSON object key "format"/,
  );
});

test("strict parser rejects trailing content, unpaired surrogates, and non-object roots", () => {
  assert.throws(() => parseStrictJson('{"format":"axm-action-profile/1"} true'), /Trailing content/);
  assert.throws(() => parseStrictJson('{"format":"axm-action-profile/1","x":"\\ud800"}'), /Unpaired high Unicode surrogate/);
  assert.throws(() => parseStrictJson('[]'), /root must be an object/);
});

test("Forge discovers deployed aliases and preserves unknown extensions", () => {
  const inspected = inspectProfile(PROFILE);
  assert.equal(inspected.fieldMap.arenaKit, "arenaKit");
  assert.equal(inspected.fieldMap.playerKit, "playerKit");
  assert.equal(inspected.fieldMap.enemyCap, "maxEnemies");
  assert.equal(inspected.fieldMap.durationSeconds, "maxDurationSeconds");
  assert.equal(inspected.fieldMap.objectiveOverrides, "objectiveEnemyKits");
  assert.deepEqual(inspected.unknownRootFields, ["creator.example/notes"]);
  const updated = updateConcept(PROFILE, "arenaKit", "lane");
  assert.equal(updated.arenaKit, "lane");
  assert.deepEqual(updated["creator.example/notes"], PROFILE["creator.example/notes"]);
  assert.equal(PROFILE.arenaKit, "ring");
});

test("Forge refuses to invent a concept absent from the exact template", () => {
  const profile = { format: ACTION_PROFILE_FORMAT, arenaKit: "ring" };
  assert.throws(() => updateConcept(profile, "playerKit", "blade"), /refuses to invent a field/);
});

test("nested deployed fields remain nested", () => {
  const profile = {
    format: ACTION_PROFILE_FORMAT,
    arena: { kit: "islands", preserved: true },
    player: { kit: "hammer", lineage: "creator-owned" },
    limits: { enemies: 4, durationSeconds: 120 },
    tuning: { aggressionScale: 0.8 },
    outcomes: { partialObjectiveCount: 2 },
    objectives: { enemyKits: {} },
  };
  const inspected = inspectProfile(profile);
  assert.equal(inspected.fieldMap.arenaKit, "arena.kit");
  assert.equal(inspected.fieldMap.playerKit, "player.kit");
  assert.equal(inspected.fieldMap.enemyCap, "limits.enemies");
  assert.equal(inspected.fieldMap.durationSeconds, "limits.durationSeconds");
  const updated = updateConcept(profile, "playerKit", "blade");
  assert.equal(updated.player.kit, "blade");
  assert.equal(updated.player.lineage, "creator-owned");
  assert.equal(updated.arena.preserved, true);
});

test("objective mappings bind only named action-spec objectives", () => {
  let profile = setObjectiveEnemyKit(PROFILE, "first", "duelist");
  assert.equal(profile.objectiveEnemyKits.first, "duelist");
  assert.equal(validateProfile(profile, SPEC).valid, true);
  profile = setObjectiveEnemyKit(profile, "missing", "breaker");
  const invalid = validateProfile(profile, SPEC);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /does not exist in the loaded action spec/);
  profile = removeObjectiveOverride(profile, "missing");
  assert.equal(validateProfile(profile, SPEC).valid, true);
});

test("object-shaped objective overrides preserve their extensions", () => {
  const profile = {
    ...PROFILE,
    objectiveEnemyKits: { first: { enemyKit: "swarm", countBias: 2, "creator.example/cue": "flood" } },
  };
  const updated = setObjectiveEnemyKit(profile, "first", "hexer");
  assert.deepEqual(updated.objectiveEnemyKits.first, {
    enemyKit: "hexer",
    countBias: 2,
    "creator.example/cue": "flood",
  });
});

test("profile validation enforces bounded kits and numbers without rejecting extensions", () => {
  assert.equal(validateProfile(PROFILE, SPEC).valid, true);
  const invalid = { ...PROFILE, playerKit: "unknown", maxEnemies: 99, aggression: Number.NaN };
  const result = validateProfile(invalid, SPEC);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /player kit is unknown/);
  assert.match(result.errors.join(" "), /enemy cap must be in/);
  assert.match(result.errors.join(" "), /aggression must be a finite number/);
});

test("canonical JSON is stable across object key insertion order", () => {
  const left = { format: ACTION_PROFILE_FORMAT, z: 1, a: { y: 2, x: 3 }, array: [{ b: 2, a: 1 }] };
  const right = { array: [{ a: 1, b: 2 }], a: { x: 3, y: 2 }, z: 1, format: ACTION_PROFILE_FORMAT };
  assert.equal(canonicalJson(left), canonicalJson(right));
});

test("Forge receipt binds exact source, output, spec, operations, and extensions", async () => {
  const output = updateConcept(PROFILE, "arenaKit", "islands");
  const receipt = await buildForgeReceipt({
    sourceProfile: PROFILE,
    outputProfile: output,
    actionSpec: SPEC,
    operations: [{ type: "set-concept", concept: "arenaKit", before: "ring", after: "islands" }],
  });
  assert.equal(receipt.format, "axm-action-profile-forge-receipt/1");
  assert.equal(receipt.status, "pass");
  assert.equal(receipt.changed, true);
  assert.match(receipt.sourceProfileSha256, /^[0-9a-f]{64}$/);
  assert.match(receipt.outputProfileSha256, /^[0-9a-f]{64}$/);
  assert.notEqual(receipt.sourceProfileSha256, receipt.outputProfileSha256);
  assert.equal(receipt.actionSpecDigest, SPEC.specDigest);
  assert.deepEqual(receipt.preservedUnknownRootFields, ["creator.example/notes"]);
  assert.equal(receipt.authority, "Arc compiler validation required before installation");
});
