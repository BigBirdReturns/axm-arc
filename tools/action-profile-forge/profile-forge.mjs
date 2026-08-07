const DEFAULT_LIMITS = Object.freeze({
  bytes: 1024 * 1024,
  depth: 16,
  values: 100000,
  containerItems: 4096,
  stringBytes: 16384,
  numberCharacters: 128,
});

export const ACTION_PROFILE_FORMAT = "axm-action-profile/1";
export const ACTION_SPEC_FORMAT = "axm-action-spec/1";
export const FORGE_RECEIPT_FORMAT = "axm-action-profile-forge-receipt/1";
export const ARENA_KITS = Object.freeze(["ring", "lane", "islands"]);
export const PLAYER_KITS = Object.freeze(["staff", "blade", "hammer"]);
export const ENEMY_KITS = Object.freeze(["skirmisher", "duelist", "swarm", "hexer", "breaker"]);

const CONCEPTS = Object.freeze({
  arenaKit: ["arenaKit"],
  playerKit: ["playerKit"],
  durationSeconds: ["durationSeconds"],
  arenaScale: ["arenaScale"],
  enemyScale: ["enemyScale"],
  objectiveOrder: ["objectiveOrder"],
  objectiveOverrides: ["objectiveKits"],
});

export class ForgeJsonError extends Error {
  constructor(message, offset = null) {
    super(offset === null ? message : `${message} at byte ${offset}.`);
    this.name = "ForgeJsonError";
    this.offset = offset;
  }
}

export function parseStrictJson(source, limits = DEFAULT_LIMITS) {
  if (typeof source !== "string") throw new ForgeJsonError("JSON source must be a string");
  const bytes = new TextEncoder().encode(source).length;
  if (bytes > limits.bytes) throw new ForgeJsonError(`JSON source exceeds ${limits.bytes} bytes`);
  let index = 0;
  let values = 0;

  function fail(message) {
    throw new ForgeJsonError(message, index);
  }

  function value(depth) {
    values += 1;
    if (values > limits.values) fail(`JSON source exceeds ${limits.values} values`);
    if (depth > limits.depth) fail(`JSON source exceeds depth ${limits.depth}`);
    whitespace();
    const character = source[index];
    if (character === "{") return object(depth + 1);
    if (character === "[") return array(depth + 1);
    if (character === '"') return string();
    if (character === "t" && source.slice(index, index + 4) === "true") { index += 4; return true; }
    if (character === "f" && source.slice(index, index + 5) === "false") { index += 5; return false; }
    if (character === "n" && source.slice(index, index + 4) === "null") { index += 4; return null; }
    if (character === "-" || (character >= "0" && character <= "9")) return number();
    fail("Unexpected JSON token");
  }

  function object(depth) {
    index += 1;
    whitespace();
    const result = {};
    const keys = new Set();
    let members = 0;
    if (source[index] === "}") { index += 1; return result; }
    while (index < source.length) {
      if (source[index] !== '"') fail("JSON object key must be a string");
      const key = string();
      if (keys.has(key)) fail(`Duplicate JSON object key ${JSON.stringify(key)}`);
      keys.add(key);
      members += 1;
      if (members > limits.containerItems) fail(`JSON object exceeds ${limits.containerItems} members`);
      whitespace();
      if (source[index] !== ":") fail("JSON object key must be followed by a colon");
      index += 1;
      result[key] = value(depth);
      whitespace();
      if (source[index] === "}") { index += 1; return result; }
      if (source[index] !== ",") fail("JSON object members must be separated by commas");
      index += 1;
      whitespace();
    }
    fail("Unterminated JSON object");
  }

  function array(depth) {
    index += 1;
    whitespace();
    const result = [];
    if (source[index] === "]") { index += 1; return result; }
    while (index < source.length) {
      if (result.length >= limits.containerItems) fail(`JSON array exceeds ${limits.containerItems} items`);
      result.push(value(depth));
      whitespace();
      if (source[index] === "]") { index += 1; return result; }
      if (source[index] !== ",") fail("JSON array items must be separated by commas");
      index += 1;
      whitespace();
    }
    fail("Unterminated JSON array");
  }

  function string() {
    const start = index;
    index += 1;
    let result = "";
    while (index < source.length) {
      const character = source[index++];
      if (character === '"') {
        if (new TextEncoder().encode(result).length > limits.stringBytes) fail(`JSON string exceeds ${limits.stringBytes} bytes`);
        return result;
      }
      if (character === "\\") {
        if (index >= source.length) fail("Unterminated JSON escape");
        const escaped = source[index++];
        if (escaped === '"' || escaped === "\\" || escaped === "/") result += escaped;
        else if (escaped === "b") result += "\b";
        else if (escaped === "f") result += "\f";
        else if (escaped === "n") result += "\n";
        else if (escaped === "r") result += "\r";
        else if (escaped === "t") result += "\t";
        else if (escaped === "u") {
          const hex = source.slice(index, index + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("Malformed JSON Unicode escape");
          index += 4;
          const first = Number.parseInt(hex, 16);
          if (first >= 0xd800 && first <= 0xdbff) {
            if (source.slice(index, index + 2) !== "\\u") fail("Unpaired high Unicode surrogate");
            index += 2;
            const lowHex = source.slice(index, index + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(lowHex)) fail("Malformed low Unicode surrogate");
            index += 4;
            const low = Number.parseInt(lowHex, 16);
            if (low < 0xdc00 || low > 0xdfff) fail("Unpaired high Unicode surrogate");
            result += String.fromCodePoint(0x10000 + ((first - 0xd800) << 10) + (low - 0xdc00));
          } else if (first >= 0xdc00 && first <= 0xdfff) fail("Unpaired low Unicode surrogate");
          else result += String.fromCharCode(first);
        } else fail("Unsupported JSON escape");
      } else {
        if (character.charCodeAt(0) < 0x20) fail("Unescaped JSON control character");
        result += character;
      }
    }
    index = start;
    fail("Unterminated JSON string");
  }

  function number() {
    const start = index;
    if (source[index] === "-") index += 1;
    if (source[index] === "0") index += 1;
    else {
      if (source[index] < "1" || source[index] > "9") fail("Malformed JSON number");
      while (source[index] >= "0" && source[index] <= "9") index += 1;
    }
    if (source[index] === ".") {
      index += 1;
      if (source[index] < "0" || source[index] > "9") fail("Malformed JSON fraction");
      while (source[index] >= "0" && source[index] <= "9") index += 1;
    }
    if (source[index] === "e" || source[index] === "E") {
      index += 1;
      if (source[index] === "+" || source[index] === "-") index += 1;
      if (source[index] < "0" || source[index] > "9") fail("Malformed JSON exponent");
      while (source[index] >= "0" && source[index] <= "9") index += 1;
    }
    const token = source.slice(start, index);
    if (token.length > limits.numberCharacters) fail(`JSON number exceeds ${limits.numberCharacters} characters`);
    const result = Number(token);
    if (!Number.isFinite(result)) fail("JSON number must be finite");
    return result;
  }

  function whitespace() {
    while (source[index] === " " || source[index] === "\n" || source[index] === "\r" || source[index] === "\t") index += 1;
  }

  const result = value(0);
  whitespace();
  if (index !== source.length) fail("Trailing content after JSON value");
  if (!isPlainObject(result)) throw new ForgeJsonError("JSON root must be an object");
  return result;
}

export function canonicalJson(value) {
  validateJsonValue(value);
  return JSON.stringify(sortValue(value));
}

export async function sha256Hex(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function resolveProfileScope(profile, challengeId = null) {
  validateProfileRoot(profile);
  const encounterIds = Object.keys(profile.encounters).sort();
  const selected = challengeId ?? (encounterIds.length === 1 ? encounterIds[0] : null);
  if (selected === null) throw new Error("A profile with multiple encounters requires an action spec challengeId.");
  const root = profile.encounters[selected];
  if (!isPlainObject(root)) throw new Error(`Action profile encounter ${selected} is absent or not an object.`);
  return { challengeId: selected, root, prefix: `encounters.${selected}.` };
}

export function inspectProfile(profile, challengeId = null) {
  const scope = resolveProfileScope(profile, challengeId);
  const fieldMap = {};
  const values = {};
  const relativePaths = {};
  for (const [concept, aliases] of Object.entries(CONCEPTS)) {
    const relative = aliases.find((candidate) => hasPath(scope.root, candidate)) ?? null;
    relativePaths[concept] = relative;
    fieldMap[concept] = relative === null ? null : scope.prefix + relative;
    values[concept] = relative === null ? null : clone(getPath(scope.root, relative));
  }
  const recognizedEncounterRoots = new Set(Object.values(relativePaths).filter(Boolean).map((path) => path.split(".")[0]));
  return {
    format: profile.format,
    challengeId: scope.challengeId,
    fieldMap,
    values,
    unknownRootFields: Object.keys(profile).filter((key) => key !== "format" && key !== "encounters").sort(),
    unknownEncounterFields: Object.keys(scope.root).filter((key) => !recognizedEncounterRoots.has(key)).sort(),
  };
}

export function updateConcept(profile, concept, value, challengeId = null) {
  validateProfileRoot(profile);
  if (!(concept in CONCEPTS)) throw new Error(`Unknown Forge concept ${concept}.`);
  const inspected = inspectProfile(profile, challengeId);
  const path = inspected.fieldMap[concept];
  if (path === null) throw new Error(`The exact profile template does not expose ${concept}; the Forge refuses to invent a field.`);
  const next = clone(profile);
  setPath(next, path, clone(value));
  return next;
}

export function setObjectiveEnemyKit(profile, objectiveId, enemyKit, challengeId = null) {
  if (!ENEMY_KITS.includes(enemyKit)) throw new Error(`Unknown enemy kit ${enemyKit}.`);
  const inspected = inspectProfile(profile, challengeId);
  const path = inspected.fieldMap.objectiveOverrides;
  if (path === null) throw new Error("The exact profile template does not expose objective-specific enemy mapping.");
  const current = getPath(profile, path);
  if (!isPlainObject(current)) throw new Error(`Objective override field ${path} is not an object.`);
  const next = clone(profile);
  const overrides = clone(getPath(next, path));
  overrides[objectiveId] = enemyKit;
  setPath(next, path, overrides);
  return next;
}

export function removeObjectiveOverride(profile, objectiveId, challengeId = null) {
  const inspected = inspectProfile(profile, challengeId);
  const path = inspected.fieldMap.objectiveOverrides;
  if (path === null) return clone(profile);
  const next = clone(profile);
  const overrides = clone(getPath(next, path));
  if (isPlainObject(overrides)) delete overrides[objectiveId];
  setPath(next, path, overrides);
  return next;
}

export function validateProfile(profile, actionSpec = null) {
  const errors = [];
  let inspection;
  try {
    validateProfileRoot(profile);
    inspection = inspectProfile(profile, actionSpec?.challengeId ?? null);
  } catch (error) {
    errors.push(error.message);
    return { valid: false, errors, inspection: null };
  }
  checkKit(inspection.values.arenaKit, ARENA_KITS, "arena kit", errors);
  checkKit(inspection.values.playerKit, PLAYER_KITS, "player kit", errors);
  checkNumber(inspection.values.durationSeconds, 20, 600, "duration seconds", errors, true);
  checkNumber(inspection.values.arenaScale, 0.5, 2, "arena scale", errors, false);
  checkNumber(inspection.values.enemyScale, 0.5, 2, "enemy scale", errors, false);

  const order = inspection.values.objectiveOrder;
  if (order !== null && (!Array.isArray(order) || order.length === 0 || order.some((id) => typeof id !== "string" || id.length === 0))) {
    errors.push("Profile objective order must be a non-empty array of ids.");
  } else if (Array.isArray(order) && new Set(order).size !== order.length) {
    errors.push("Profile objective order contains duplicate ids.");
  }

  if (actionSpec !== null) {
    if (!isPlainObject(actionSpec) || actionSpec.format !== ACTION_SPEC_FORMAT) errors.push(`Action spec must use ${ACTION_SPEC_FORMAT}.`);
    else {
      if (inspection.challengeId !== actionSpec.challengeId) errors.push(`Profile encounter ${inspection.challengeId} does not match action spec challenge ${String(actionSpec.challengeId)}.`);
      const objectiveIds = (actionSpec.objectives ?? []).map((objective) => objective?.id).filter((id) => typeof id === "string");
      const objectives = new Set(objectiveIds);
      if (Array.isArray(order) && (order.length !== objectiveIds.length || order.some((id) => !objectives.has(id)))) {
        errors.push("Profile objective order must name every action-spec objective exactly once.");
      }
      const overrides = inspection.values.objectiveOverrides;
      if (overrides !== null && !isPlainObject(overrides)) errors.push("Objective overrides must be an object.");
      else if (isPlainObject(overrides)) {
        for (const [objectiveId, kit] of Object.entries(overrides)) {
          if (!objectives.has(objectiveId)) errors.push(`Objective override ${objectiveId} does not exist in the loaded action spec.`);
          if (!ENEMY_KITS.includes(kit)) errors.push(`Objective override ${objectiveId} uses unknown enemy kit ${String(kit)}.`);
        }
      }
      if (typeof actionSpec.specDigest !== "string" || !/^actspec1_[0-9a-f]{64}$/.test(actionSpec.specDigest)) errors.push("Action spec digest is malformed.");
    }
  }
  return { valid: errors.length === 0, errors, inspection };
}

export async function buildForgeReceipt({ sourceProfile, outputProfile, actionSpec = null, operations = [] }) {
  const validation = validateProfile(outputProfile, actionSpec);
  if (!validation.valid) throw new Error(`Profile cannot be receipted: ${validation.errors.join(" ")}`);
  const sourceCanonical = canonicalJson(sourceProfile);
  const outputCanonical = canonicalJson(outputProfile);
  return {
    format: FORGE_RECEIPT_FORMAT,
    generatedAt: new Date().toISOString(),
    status: "pass",
    profileFormat: outputProfile.format,
    challengeId: validation.inspection.challengeId,
    sourceProfileSha256: await sha256Hex(sourceCanonical),
    outputProfileSha256: await sha256Hex(outputCanonical),
    changed: sourceCanonical !== outputCanonical,
    actionSpecDigest: actionSpec?.specDigest ?? null,
    actionSpecFormat: actionSpec?.format ?? null,
    operations: clone(operations),
    fieldMap: validation.inspection.fieldMap,
    preservedUnknownRootFields: validation.inspection.unknownRootFields,
    preservedUnknownEncounterFields: validation.inspection.unknownEncounterFields,
    authority: "Arc compiler validation required before installation",
  };
}

function validateProfileRoot(profile) {
  if (!isPlainObject(profile)) throw new Error("Action profile must be a plain JSON object.");
  if (profile.format !== ACTION_PROFILE_FORMAT) throw new Error(`Action profile must use ${ACTION_PROFILE_FORMAT}.`);
  if (!isPlainObject(profile.encounters) || Object.keys(profile.encounters).length === 0) throw new Error("Action profile encounters must be a non-empty object.");
  validateJsonValue(profile);
}

function validateJsonValue(value, depth = 0) {
  if (depth > DEFAULT_LIMITS.depth) throw new Error(`JSON value exceeds depth ${DEFAULT_LIMITS.depth}.`);
  if (value === null || typeof value === "boolean" || typeof value === "string") return;
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("JSON number must be finite."); return; }
  if (Array.isArray(value)) { if (value.length > DEFAULT_LIMITS.containerItems) throw new Error("JSON array is too large."); value.forEach((entry) => validateJsonValue(entry, depth + 1)); return; }
  if (isPlainObject(value)) { const keys = Object.keys(value); if (keys.length > DEFAULT_LIMITS.containerItems) throw new Error("JSON object is too large."); keys.forEach((key) => validateJsonValue(value[key], depth + 1)); return; }
  throw new Error(`Unsupported JSON value ${Object.prototype.toString.call(value)}.`);
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isPlainObject(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = sortValue(value[key]);
  return result;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function hasPath(value, path) {
  const parts = path.split(".");
  let current = value;
  for (const part of parts) {
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, part)) return false;
    current = current[part];
  }
  return true;
}

function getPath(value, path) {
  return path.split(".").reduce((current, part) => current[part], value);
}

function setPath(value, path, next) {
  const parts = path.split(".");
  let current = value;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!isPlainObject(current[part])) throw new Error(`Profile path ${path} is no longer an object at ${part}.`);
    current = current[part];
  }
  current[parts[parts.length - 1]] = next;
}

function checkKit(value, allowed, label, errors) {
  if (value === null) return;
  const kit = isPlainObject(value) ? value.kit ?? value.id : value;
  if (!allowed.includes(kit)) errors.push(`Profile ${label} is unknown: ${String(kit)}.`);
}

function checkNumber(value, minimum, maximum, label, errors, integer) {
  if (value === null) return;
  if (typeof value !== "number" || !Number.isFinite(value)) { errors.push(`Profile ${label} must be a finite number.`); return; }
  if (integer && !Number.isInteger(value)) errors.push(`Profile ${label} must be an integer.`);
  if (value < minimum || value > maximum) errors.push(`Profile ${label} must be in [${minimum}, ${maximum}].`);
}
