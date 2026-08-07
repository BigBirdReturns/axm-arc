import {
  ACTION_PROFILE_FORMAT,
  ACTION_SPEC_FORMAT,
  ARENA_KITS,
  PLAYER_KITS,
  ENEMY_KITS,
  parseStrictJson,
  canonicalJson,
  inspectProfile,
  updateConcept,
  setObjectiveEnemyKit,
  removeObjectiveOverride,
  validateProfile,
  buildForgeReceipt,
} from "./profile-forge.mjs";

const state = {
  sourceProfile: null,
  profile: null,
  actionSpec: null,
  profileFileName: null,
  specFileName: null,
  operations: [],
};

const elements = Object.fromEntries([
  "profile-file", "spec-file", "status-dot", "status-title", "status-detail",
  "profile-format", "spec-digest", "challenge-id", "unknown-fields", "recognized-count",
  "arena-control", "arena-path", "player-control", "player-path", "duration-control",
  "duration-path", "arena-scale-control", "arena-scale-path", "enemy-scale-control",
  "enemy-scale-path", "objective-count", "objective-list",
  "source-editor", "validation-output", "reset-button", "format-button", "apply-source-button",
  "validate-button", "export-profile-button", "export-receipt-button",
].map((id) => [id, document.getElementById(id)]));

fillSelect(elements["arena-control"], ARENA_KITS);
fillSelect(elements["player-control"], PLAYER_KITS);

for (const [concept, id] of [
  ["arenaKit", "arena-control"],
  ["playerKit", "player-control"],
  ["durationSeconds", "duration-control"],
  ["arenaScale", "arena-scale-control"],
  ["enemyScale", "enemy-scale-control"],
]) {
  elements[id].addEventListener("change", () => applyGuidedChange(concept, elements[id]));
}

elements["profile-file"].addEventListener("change", async (event) => loadProfile(event.target.files?.[0]));
elements["spec-file"].addEventListener("change", async (event) => loadSpec(event.target.files?.[0]));
elements["reset-button"].addEventListener("click", resetProfile);
elements["format-button"].addEventListener("click", formatEditor);
elements["apply-source-button"].addEventListener("click", applySourceEditor);
elements["validate-button"].addEventListener("click", () => validateAndReport(true));
elements["export-profile-button"].addEventListener("click", exportProfile);
elements["export-receipt-button"].addEventListener("click", exportReceipt);

window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", async (event) => {
  event.preventDefault();
  for (const file of event.dataTransfer?.files ?? []) {
    const text = await file.text();
    try {
      const value = parseStrictJson(text);
      if (value.format === ACTION_PROFILE_FORMAT) await loadProfile(file, text);
      else if (value.format === ACTION_SPEC_FORMAT) await loadSpec(file, text);
      else setStatus("bad", "Unsupported JSON dropped", `${file.name} is ${String(value.format ?? "untyped")}.`);
    } catch (error) {
      setStatus("bad", "Dropped JSON refused", error.message);
    }
  }
});

render();

async function loadProfile(file, suppliedText = null) {
  if (!file) return;
  try {
    const text = suppliedText ?? await file.text();
    const value = parseStrictJson(text);
    const validation = validateProfile(value, state.actionSpec);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    state.sourceProfile = clone(value);
    state.profile = clone(value);
    state.profileFileName = file.name;
    state.operations = [{ type: "load-profile", file: file.name, at: new Date().toISOString() }];
    setStatus("good", "Exact profile loaded", `${file.name} · ${recognized(validation.inspection)} deployed fields recognized.`);
    render();
  } catch (error) {
    setStatus("bad", "Profile refused", error.message);
  }
}

async function loadSpec(file, suppliedText = null) {
  if (!file) return;
  try {
    const text = suppliedText ?? await file.text();
    const value = parseStrictJson(text);
    if (value.format !== ACTION_SPEC_FORMAT) throw new Error(`Action spec must use ${ACTION_SPEC_FORMAT}.`);
    if (typeof value.specDigest !== "string" || !/^actspec1_[0-9a-f]{64}$/.test(value.specDigest)) throw new Error("Action spec digest is malformed.");
    if (!Array.isArray(value.objectives)) throw new Error("Action spec objectives are absent.");
    state.actionSpec = value;
    state.specFileName = file.name;
    state.operations.push({ type: "bind-action-spec", file: file.name, actionSpecDigest: value.specDigest, at: new Date().toISOString() });
    const validation = state.profile ? validateProfile(state.profile, state.actionSpec) : null;
    if (validation && !validation.valid) throw new Error(validation.errors.join(" "));
    setStatus("good", "Action spec bound", `${file.name} · ${value.specDigest}`);
    render();
  } catch (error) {
    state.actionSpec = null;
    state.specFileName = null;
    setStatus("bad", "Action spec refused", error.message);
    render();
  }
}

function resetProfile() {
  if (!state.sourceProfile) return;
  state.profile = clone(state.sourceProfile);
  state.operations.push({ type: "reset-to-template", at: new Date().toISOString() });
  setStatus("good", "Template restored", "All exact source fields and extensions match the loaded template.");
  render();
}

function applyGuidedChange(concept, control) {
  if (!state.profile || control.disabled) return;
  try {
    const inspection = inspectProfile(state.profile, state.actionSpec?.challengeId ?? null);
    const before = clone(inspection.values[concept]);
    let value;
    if (concept === "arenaKit" || concept === "playerKit") value = replaceKit(before, control.value);
    else value = Number(control.value);
    state.profile = updateConcept(state.profile, concept, value, state.actionSpec?.challengeId ?? null);
    state.operations.push({ type: "set-concept", concept, field: inspection.fieldMap[concept], before, after: clone(value), at: new Date().toISOString() });
    render();
    validateAndReport(false);
  } catch (error) {
    setStatus("bad", "Guided change refused", error.message);
  }
}

function formatEditor() {
  if (!state.profile) return;
  try {
    const value = parseStrictJson(elements["source-editor"].value);
    elements["source-editor"].value = pretty(value);
    setValidation("good", "Source parses under duplicate-key and resource limits. It has not been applied yet.");
  } catch (error) {
    setValidation("bad", error.message);
  }
}

function applySourceEditor() {
  if (!state.profile) return;
  try {
    const value = parseStrictJson(elements["source-editor"].value);
    const validation = validateProfile(value, state.actionSpec);
    if (!validation.valid) throw new Error(validation.errors.join("\n"));
    const before = canonicalJson(state.profile);
    state.profile = value;
    state.operations.push({
      type: "apply-exact-source",
      changed: before !== canonicalJson(value),
      outputProfileSha256Pending: true,
      at: new Date().toISOString(),
    });
    setStatus("good", "Exact source applied", `${recognized(validation.inspection)} deployed fields recognized; ${validation.inspection.unknownRootFields.length + validation.inspection.unknownEncounterFields.length} extensions preserved.`);
    render();
    validateAndReport(false);
  } catch (error) {
    setValidation("bad", error.message);
    setStatus("bad", "Exact source refused", error.message.split("\n")[0]);
  }
}

function render() {
  const loaded = !!state.profile;
  for (const id of ["source-editor", "reset-button", "format-button", "apply-source-button", "validate-button", "export-profile-button", "export-receipt-button"]) elements[id].disabled = !loaded;
  if (!loaded) {
    elements["profile-format"].textContent = "None";
    elements["spec-digest"].textContent = state.actionSpec?.specDigest ?? "Not bound";
    elements["challenge-id"].textContent = state.actionSpec?.challengeId ?? "Not bound";
    elements["unknown-fields"].textContent = "None measured";
    elements["recognized-count"].textContent = "0 fields recognized";
    elements["source-editor"].value = "";
    disableGuided();
    renderObjectives(null);
    return;
  }
  const validation = validateProfile(state.profile, state.actionSpec);
  const inspection = validation.inspection;
  elements["profile-format"].textContent = state.profile.format;
  elements["spec-digest"].textContent = state.actionSpec?.specDigest ?? "Not bound";
  elements["challenge-id"].textContent = state.actionSpec?.challengeId ?? "Not bound";
  const unknown = [...inspection.unknownRootFields.map((field) => `root:${field}`), ...inspection.unknownEncounterFields.map((field) => `encounter:${field}`)];
  elements["unknown-fields"].textContent = unknown.length ? unknown.join(", ") : "None";
  elements["recognized-count"].textContent = `${recognized(inspection)} fields recognized`;
  elements["source-editor"].value = pretty(state.profile);
  configureSelect("arena", "arenaKit", inspection, ARENA_KITS);
  configureSelect("player", "playerKit", inspection, PLAYER_KITS);
  configureNumber("duration", "durationSeconds", inspection);
  configureNumber("arena-scale", "arenaScale", inspection);
  configureNumber("enemy-scale", "enemyScale", inspection);
  renderObjectives(inspection);
  if (validation.valid) setValidation("good", validationSummary(validation));
  else setValidation("bad", validation.errors.join("\n"));
}

function configureSelect(prefix, concept, inspection, allowed) {
  const control = elements[`${prefix}-control`];
  const path = inspection.fieldMap[concept];
  control.disabled = path === null;
  elements[`${prefix}-path`].textContent = path ?? "Template field absent";
  if (path !== null) {
    const value = kitValue(inspection.values[concept]);
    if (!allowed.includes(value)) appendOption(control, value);
    control.value = value ?? "";
  }
}

function configureNumber(prefix, concept, inspection) {
  const control = elements[`${prefix}-control`];
  const path = inspection.fieldMap[concept];
  control.disabled = path === null;
  elements[`${prefix}-path`].textContent = path ?? "Template field absent";
  control.value = path === null || inspection.values[concept] === null ? "" : String(inspection.values[concept]);
}

function disableGuided() {
  for (const prefix of ["arena", "player", "duration", "arena-scale", "enemy-scale"]) {
    elements[`${prefix}-control`].disabled = true;
    elements[`${prefix}-path`].textContent = "Template field absent";
  }
}

function renderObjectives(inspection) {
  const list = elements["objective-list"];
  const objectives = state.actionSpec?.objectives ?? [];
  elements["objective-count"].textContent = state.actionSpec ? `${objectives.length} objectives` : "No action spec";
  list.replaceChildren();
  const overridePath = inspection?.fieldMap.objectiveOverrides ?? null;
  if (!state.actionSpec || !state.profile) {
    list.className = "objective-list empty";
    list.textContent = "Load an action spec and a profile template.";
    return;
  }
  if (overridePath === null) {
    list.className = "objective-list empty";
    list.textContent = "The exact profile template has no objective-override field. Arc must add that authoring concept before this Forge may expose it.";
    return;
  }
  list.className = "objective-list";
  const overrides = inspection.values.objectiveOverrides ?? {};
  for (const objective of objectives) {
    const row = document.createElement("div");
    row.className = "objective-row";
    const identity = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = objective.label ?? objective.name ?? objective.id;
    const code = document.createElement("code");
    code.textContent = objective.id;
    identity.append(title, code);
    const select = document.createElement("select");
    appendOption(select, "", "Use Arc default");
    for (const kit of ENEMY_KITS) appendOption(select, kit, kit);
    const existing = overrides[objective.id];
    select.value = typeof existing === "string" ? existing : existing?.enemyKit ?? "";
    select.addEventListener("change", () => {
      try {
        const before = clone(inspectProfile(state.profile, state.actionSpec?.challengeId ?? null).values.objectiveOverrides?.[objective.id] ?? null);
        state.profile = select.value
          ? setObjectiveEnemyKit(state.profile, objective.id, select.value, state.actionSpec?.challengeId ?? null)
          : removeObjectiveOverride(state.profile, objective.id, state.actionSpec?.challengeId ?? null);
        state.operations.push({ type: select.value ? "set-objective-enemy-kit" : "remove-objective-override", field: overridePath, objectiveId: objective.id, before, after: select.value || null, at: new Date().toISOString() });
        render();
        validateAndReport(false);
      } catch (error) {
        setStatus("bad", "Objective mapping refused", error.message);
      }
    });
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear";
    clear.disabled = !select.value;
    clear.addEventListener("click", () => {
      select.value = "";
      select.dispatchEvent(new Event("change"));
    });
    row.append(identity, select, clear);
    list.append(row);
  }
}

function validateAndReport(announce) {
  if (!state.profile) return false;
  const result = validateProfile(state.profile, state.actionSpec);
  if (result.valid) {
    setValidation("good", validationSummary(result));
    if (announce) setStatus("good", "Profile passes Forge validation", "Arc compilation remains required before installation or play.");
  } else {
    setValidation("bad", result.errors.join("\n"));
    if (announce) setStatus("bad", "Profile validation failed", result.errors[0]);
  }
  return result.valid;
}

function exportProfile() {
  if (!state.profile || !validateAndReport(true)) return;
  download(`${fileStem()}-action-profile.json`, pretty(state.profile), "application/json");
  state.operations.push({ type: "export-profile", at: new Date().toISOString() });
}

async function exportReceipt() {
  if (!state.profile || !state.sourceProfile || !validateAndReport(true)) return;
  try {
    const receipt = await buildForgeReceipt({ sourceProfile: state.sourceProfile, outputProfile: state.profile, actionSpec: state.actionSpec, operations: state.operations });
    download(`${fileStem()}-forge-receipt.json`, pretty(receipt), "application/json");
    setStatus("good", "Forge receipt exported", `${receipt.outputProfileSha256} · Arc compilation still required.`);
  } catch (error) {
    setStatus("bad", "Receipt export failed", error.message);
  }
}

function validationSummary(validation) {
  const spec = state.actionSpec ? `Bound to ${state.actionSpec.specDigest}.` : "No action spec is bound.";
  const extensions = validation.inspection.unknownRootFields.length
    ? `Preserving root extensions: ${validation.inspection.unknownRootFields.join(", ")}.`
    : "No unknown root extensions detected.";
  return `PASS · ${recognized(validation.inspection)} deployed fields recognized. ${spec} ${extensions}\nArc compilation and bounded simulation remain the next acceptance gate.`;
}

function setStatus(kind, title, detail) {
  elements["status-dot"].className = `status-dot ${kind === "good" ? "good" : kind === "bad" ? "bad" : ""}`;
  elements["status-title"].textContent = title;
  elements["status-detail"].textContent = detail;
}

function setValidation(kind, text) {
  elements["validation-output"].className = `validation ${kind}`;
  elements["validation-output"].textContent = text;
}

function fillSelect(select, values) {
  select.replaceChildren();
  for (const value of values) appendOption(select, value, value);
}

function appendOption(select, value, label = value) {
  if ([...select.options].some((option) => option.value === String(value))) return;
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function replaceKit(current, kit) {
  if (current && typeof current === "object" && !Array.isArray(current)) return { ...current, kit };
  return kit;
}

function kitValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value.kit ?? value.id ?? null : value;
}

function recognized(inspection) {
  return Object.values(inspection.fieldMap).filter(Boolean).length;
}

function pretty(value) {
  return JSON.stringify(JSON.parse(canonicalJson(value)), null, 2) + "\n";
}

function fileStem() {
  const challenge = state.actionSpec?.challengeId ?? state.profileFileName?.replace(/\.json$/i, "") ?? "action-profile";
  return String(challenge).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "action-profile";
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
