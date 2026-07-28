export const ONE_AM_PLAYER_CONTRACT_FORMAT = "axm-one-am-player-contract/1" as const;

export type OneAmInteractionKind =
  | "inspect"
  | "repair"
  | "operate"
  | "protect"
  | "negotiate"
  | "navigate"
  | "combat"
  | "choose";

export type OneAmRouteDeltaKind =
  | "knowledge"
  | "available-interaction"
  | "npc-behavior"
  | "route"
  | "world-state";

export interface OneAmObjectiveBinding {
  id: string;
  playerVerb: string;
  storyPurpose: string;
  interactionKinds: OneAmInteractionKind[];
  mechanic: string;
  observableStateChange: string;
  npcMethodCollision: string;
  criticalRevealIds?: string[];
}

export interface OneAmChoiceRoute {
  id: string;
  prompt: string;
  routeDeltas: Array<{
    kind: OneAmRouteDeltaKind;
    description: string;
  }>;
}

export interface OneAmCriticalReveal {
  id: string;
  fact: string;
  timing: "during-objective" | "during-interaction" | "result-only";
  objectiveId?: string;
  observableThrough: string;
}

export interface OneAmPlayerContract {
  format: typeof ONE_AM_PLAYER_CONTRACT_FORMAT;
  id: string;
  title: string;
  coldOpen: {
    playerIdentity: string;
    immediateGoal: string;
    stakes: string;
    firstActionPromptSeconds: number;
    firstMeaningfulSuccessSeconds: number;
  };
  objectives: OneAmObjectiveBinding[];
  choices: OneAmChoiceRoute[];
  reveals: OneAmCriticalReveal[];
  consequence: {
    visibleWorldChanges: string[];
    relationshipChanges: string[];
    playableSuccessorId: string;
    nextGoal: string;
  };
  recovery: {
    retrySeconds: number;
    preservesCompletedObjectives: boolean;
    repeatsExposition: boolean;
    firstFailureIsRecoverable: boolean;
  };
  comprehension: {
    whoAmI: string;
    whatAmIDoing: string;
    whyDoesItMatter: string;
    whatChanged: string;
    whatCanIDoNext: string;
  };
}

export interface OneAmPlayerValidation {
  ok: boolean;
  errors: string[];
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueNonEmpty(values: readonly string[]): boolean {
  return values.every(nonEmpty) && new Set(values).size === values.length;
}

export function validateOneAmPlayerContract(contract: OneAmPlayerContract): OneAmPlayerValidation {
  const errors: string[] = [];

  if (contract.format !== ONE_AM_PLAYER_CONTRACT_FORMAT) {
    errors.push(`Unsupported 1 AM player contract format: ${String(contract.format)}`);
  }
  if (!nonEmpty(contract.id)) errors.push("The experience requires a stable id.");
  if (!nonEmpty(contract.title)) errors.push("The experience requires a player-facing title.");

  const cold = contract.coldOpen;
  if (!nonEmpty(cold.playerIdentity)) errors.push("The cold open does not tell the player who they are.");
  if (!nonEmpty(cold.immediateGoal)) errors.push("The cold open does not state an immediate goal.");
  if (!nonEmpty(cold.stakes)) errors.push("The cold open does not establish why the goal matters.");
  if (!Number.isFinite(cold.firstActionPromptSeconds) || cold.firstActionPromptSeconds < 0 || cold.firstActionPromptSeconds > 30) {
    errors.push("The first actionable prompt must appear within 30 seconds.");
  }
  if (!Number.isFinite(cold.firstMeaningfulSuccessSeconds) || cold.firstMeaningfulSuccessSeconds <= 0 || cold.firstMeaningfulSuccessSeconds > 90) {
    errors.push("The first meaningful success must be reachable within 90 seconds.");
  }

  if (contract.objectives.length === 0) errors.push("The experience has no authored objectives.");
  if (!uniqueNonEmpty(contract.objectives.map((objective) => objective.id))) {
    errors.push("Objective ids must be non-empty and unique.");
  }
  const objectiveIds = new Set(contract.objectives.map((objective) => objective.id));
  for (const objective of contract.objectives) {
    const label = `Objective ${objective.id || "<missing>"}`;
    if (!nonEmpty(objective.playerVerb)) errors.push(`${label} has no concrete player verb.`);
    if (!nonEmpty(objective.storyPurpose)) errors.push(`${label} has no story purpose.`);
    if (!nonEmpty(objective.mechanic)) errors.push(`${label} has no mechanic binding.`);
    if (!nonEmpty(objective.observableStateChange)) errors.push(`${label} produces no observable state change.`);
    if (!nonEmpty(objective.npcMethodCollision)) errors.push(`${label} stages no character-method collision.`);
    if (objective.interactionKinds.length === 0) errors.push(`${label} has no interaction kind.`);
    if (objective.interactionKinds.every((kind) => kind === "combat")) {
      errors.push(`${label} reduces its authored verb to combat only; add the mechanism the player is actually operating, repairing, protecting, or negotiating.`);
    }
  }

  if (!uniqueNonEmpty(contract.choices.map((choice) => choice.id))) {
    errors.push("Choice ids must be non-empty and unique.");
  }
  for (const choice of contract.choices) {
    if (!nonEmpty(choice.prompt)) errors.push(`Choice ${choice.id || "<missing>"} has no player-facing prompt.`);
    if (choice.routeDeltas.length === 0) {
      errors.push(`Choice ${choice.id || "<missing>"} changes only remembered copy; it must alter knowledge, interactions, NPC behavior, route, or world state before the result screen.`);
    }
    for (const delta of choice.routeDeltas) {
      if (!nonEmpty(delta.description)) errors.push(`Choice ${choice.id || "<missing>"} contains an empty route delta.`);
    }
  }

  if (!uniqueNonEmpty(contract.reveals.map((reveal) => reveal.id))) {
    errors.push("Reveal ids must be non-empty and unique.");
  }
  const criticalRevealIds = new Set<string>();
  for (const objective of contract.objectives) {
    for (const revealId of objective.criticalRevealIds ?? []) criticalRevealIds.add(revealId);
  }
  for (const reveal of contract.reveals) {
    if (!nonEmpty(reveal.fact)) errors.push(`Reveal ${reveal.id || "<missing>"} has no fact.`);
    if (!nonEmpty(reveal.observableThrough)) errors.push(`Reveal ${reveal.id || "<missing>"} is not observable through play.`);
    if (reveal.timing === "result-only") errors.push(`Critical reveal ${reveal.id || "<missing>"} is deferred until after play.`);
    if (reveal.objectiveId && !objectiveIds.has(reveal.objectiveId)) {
      errors.push(`Reveal ${reveal.id || "<missing>"} names unknown objective ${reveal.objectiveId}.`);
    }
  }
  for (const revealId of criticalRevealIds) {
    if (!contract.reveals.some((reveal) => reveal.id === revealId)) {
      errors.push(`Objective references unknown critical reveal ${revealId}.`);
    }
  }

  const consequence = contract.consequence;
  if (consequence.visibleWorldChanges.length === 0 || !consequence.visibleWorldChanges.every(nonEmpty)) {
    errors.push("Success produces no visible world change.");
  }
  if (consequence.relationshipChanges.length === 0 || !consequence.relationshipChanges.every(nonEmpty)) {
    errors.push("Success produces no visible relationship change.");
  }
  if (!nonEmpty(consequence.playableSuccessorId)) errors.push("The experience does not unlock a playable successor scene.");
  if (!nonEmpty(consequence.nextGoal)) errors.push("The player is not given a concrete next goal.");

  const recovery = contract.recovery;
  if (!Number.isFinite(recovery.retrySeconds) || recovery.retrySeconds < 0 || recovery.retrySeconds > 5) {
    errors.push("Retry must return the tired player to control within five seconds.");
  }
  if (!recovery.preservesCompletedObjectives) errors.push("Retry discards completed authored progress.");
  if (recovery.repeatsExposition) errors.push("Retry repeats exposition instead of returning to the current problem.");
  if (!recovery.firstFailureIsRecoverable) errors.push("The first failure is treated as an ending before the player has learned the experience.");

  const comprehension = contract.comprehension;
  if (!nonEmpty(comprehension.whoAmI)) errors.push("The contract cannot answer: Who am I?");
  if (!nonEmpty(comprehension.whatAmIDoing)) errors.push("The contract cannot answer: What am I doing?");
  if (!nonEmpty(comprehension.whyDoesItMatter)) errors.push("The contract cannot answer: Why does it matter?");
  if (!nonEmpty(comprehension.whatChanged)) errors.push("The contract cannot answer: What changed?");
  if (!nonEmpty(comprehension.whatCanIDoNext)) errors.push("The contract cannot answer: What can I do next?");

  return { ok: errors.length === 0, errors };
}

export function assertOneAmPlayerContract(contract: OneAmPlayerContract): void {
  const validation = validateOneAmPlayerContract(contract);
  if (!validation.ok) throw new Error(`1 AM player contract failed:\n- ${validation.errors.join("\n- ")}`);
}
