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
  encounters: {
    "forge-test": {
      arenaKit: "ring",
      playerKit: "staff",
      durationSeconds: 90,
      arenaScale: 1,
      enemyScale: 1,
      objectiveOrder: ["first", "second"],
      objectiveKits: {},
      "creator.example/cue": { text: "preserve encounter extension" },
    },
  },
  "creator.example/notes": { text: "preserve root extension", order: [3, 2, 1] },
};

test("strict parser rejects duplicate keys before profile semantics", () => {
  assert.throws(() => parseStrictJson('{"format":"axm-action-profile/1","format":"forged"}'), /Duplicate JSON object key "format"/);
});
test("strict parser rejects trailing content, unpaired surrogates, and non-object roots", () => {
  assert.throws(() => parseStrictJson('{"format":"axm-action-profile/1"} true'), /Trailing content/);
  assert.throws(() => parseStrictJson('{"format":"axm-action-profile/1","x":"\\ud800"}'), /Unpaired high Unicode surrogate/);
  assert.throws(() => parseStrictJson('[]'), /root must be an object/);
});
test("Forge edits the exact deployed encounter path and preserves extensions", () => {
  const inspected = inspectProfile(PROFILE, SPEC.challengeId);
  assert.equal(inspected.fieldMap.arenaKit, "encounters.forge-test.arenaKit");
  assert.equal(inspected.fieldMap.playerKit, "encounters.forge-test.playerKit");
  assert.equal(inspected.fieldMap.durationSeconds, "encounters.forge-test.durationSeconds");
  assert.equal(inspected.fieldMap.arenaScale, "encounters.forge-test.arenaScale");
  assert.equal(inspected.fieldMap.enemyScale, "encounters.forge-test.enemyScale");
  assert.equal(inspected.fieldMap.objectiveOverrides, "encounters.forge-test.objectiveKits");
  assert.deepEqual(inspected.unknownRootFields, ["creator.example/notes"]);
  assert.deepEqual(inspected.unknownEncounterFields, ["creator.example/cue"]);
  const updated = updateConcept(PROFILE, "arenaKit", "lane", SPEC.challengeId);
  assert.equal(updated.encounters["forge-test"].arenaKit, "lane");
  assert.deepEqual(updated["creator.example/notes"], PROFILE["creator.example/notes"]);
  assert.deepEqual(updated.encounters["forge-test"]["creator.example/cue"], PROFILE.encounters["forge-test"]["creator.example/cue"]);
  assert.equal(PROFILE.encounters["forge-test"].arenaKit, "ring");
});
test("Forge refuses to invent an absent exact profile field", () => {
  const profile = { format: ACTION_PROFILE_FORMAT, encounters: { "forge-test": { arenaKit: "ring" } } };
  assert.throws(() => updateConcept(profile, "playerKit", "blade", "forge-test"), /refuses to invent a field/);
});
test("multiple encounters require an exact action-spec challenge", () => {
  const profile = { format: ACTION_PROFILE_FORMAT, encounters: { first: { arenaKit: "ring" }, second: { arenaKit: "lane" } } };
  assert.throws(() => inspectProfile(profile), /requires an action spec challengeId/);
  assert.equal(inspectProfile(profile, "second").values.arenaKit, "lane");
});
test("objective mappings bind only named action-spec objectives", () => {
  let profile = setObjectiveEnemyKit(PROFILE, "first", "duelist", SPEC.challengeId);
  assert.equal(profile.encounters["forge-test"].objectiveKits.first, "duelist");
  assert.equal(validateProfile(profile, SPEC).valid, true);
  profile = setObjectiveEnemyKit(profile, "missing", "breaker", SPEC.challengeId);
  const invalid = validateProfile(profile, SPEC);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /does not exist in the loaded action spec/);
  profile = removeObjectiveOverride(profile, "missing", SPEC.challengeId);
  assert.equal(validateProfile(profile, SPEC).valid, true);
});
test("profile validation enforces exact kits, scales, duration, and objective order", () => {
  assert.equal(validateProfile(PROFILE, SPEC).valid, true);
  const invalid = structuredClone(PROFILE);
  invalid.encounters["forge-test"].playerKit = "unknown";
  invalid.encounters["forge-test"].arenaScale = 9;
  invalid.encounters["forge-test"].objectiveOrder = ["first", "first"];
  const result = validateProfile(invalid, SPEC);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /player kit is unknown/);
  assert.match(result.errors.join(" "), /arena scale must be in/);
  assert.match(result.errors.join(" "), /duplicate ids/);
});
test("canonical JSON is stable across insertion order", () => {
  const left = { format: ACTION_PROFILE_FORMAT, encounters: { x: { playerKit: "staff", arenaKit: "ring" } } };
  const right = { encounters: { x: { arenaKit: "ring", playerKit: "staff" } }, format: ACTION_PROFILE_FORMAT };
  assert.equal(canonicalJson(left), canonicalJson(right));
});
test("Forge receipt binds exact source, output, spec, operations, and extensions", async () => {
  const output = updateConcept(PROFILE, "arenaKit", "islands", SPEC.challengeId);
  const receipt = await buildForgeReceipt({ sourceProfile: PROFILE, outputProfile: output, actionSpec: SPEC, operations: [{ type: "set-concept", concept: "arenaKit", before: "ring", after: "islands" }] });
  assert.equal(receipt.format, "axm-action-profile-forge-receipt/1");
  assert.equal(receipt.status, "pass");
  assert.equal(receipt.challengeId, SPEC.challengeId);
  assert.equal(receipt.changed, true);
  assert.match(receipt.sourceProfileSha256, /^[0-9a-f]{64}$/);
  assert.match(receipt.outputProfileSha256, /^[0-9a-f]{64}$/);
  assert.equal(receipt.actionSpecDigest, SPEC.specDigest);
  assert.deepEqual(receipt.preservedUnknownRootFields, ["creator.example/notes"]);
  assert.deepEqual(receipt.preservedUnknownEncounterFields, ["creator.example/cue"]);
  assert.equal(receipt.authority, "Arc compiler validation required before installation");
});
