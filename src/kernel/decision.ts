import type {
  AuthorizingActor,
  DecisionLedger,
  DecisionOption,
  DecisionOutcome,
  DecisionReceipt,
  DecisionSelection,
  OrganizationalState,
  VarianceExplanation,
  WorkContract,
} from "./types.js";

export function validateWorkContract(contract: WorkContract): string[] {
  const errors: string[] = [];
  if (!contract.id.trim()) errors.push("id is required");
  if (!contract.title.trim()) errors.push("title is required");
  if (contract.requiredCapabilities.length === 0) errors.push("at least one capability is required");
  if (contract.requiredHours <= 0) errors.push("requiredHours must be positive");
  if (contract.budgetLimit < 0) errors.push("budgetLimit cannot be negative");
  if (contract.maximumRisk < 0 || contract.maximumRisk > 1) errors.push("maximumRisk must be between 0 and 1");
  if (contract.authorizedRoles.length === 0) errors.push("at least one authorizing role is required");
  if (contract.outcomeMeasures.length === 0) errors.push("at least one outcome measure is required");
  const seen = new Set<string>();
  for (const requirement of contract.requiredCapabilities) {
    if (seen.has(requirement.capabilityId)) errors.push(`duplicate capability ${requirement.capabilityId}`);
    seen.add(requirement.capabilityId);
    if (requirement.minimum <= 0) errors.push(`capability ${requirement.capabilityId} minimum must be positive`);
  }
  return errors;
}

function combinations<T>(items: T[], maxSize: number): T[][] {
  const result: T[][] = [];
  const visit = (start: number, selected: T[]) => {
    if (selected.length > 0) result.push([...selected]);
    if (selected.length === maxSize) return;
    for (let index = start; index < items.length; index++) {
      selected.push(items[index]!);
      visit(index + 1, selected);
      selected.pop();
    }
  };
  visit(0, []);
  return result;
}

export function inspectFeasibleOptions(
  contract: WorkContract,
  organization: OrganizationalState,
  maxTeamSize = 3,
): DecisionOption[] {
  const errors = validateWorkContract(contract);
  if (errors.length) throw new Error(`Invalid work contract: ${errors.join("; ")}`);

  return combinations(organization.resources, maxTeamSize).map((team) => {
    const totalCapacity = team.reduce((sum, resource) => sum + resource.availableHours, 0);
    const deliveryHours = Math.ceil(contract.requiredHours / team.length);
    const cost = team.reduce(
      (sum, resource) => sum + Math.min(resource.availableHours, deliveryHours) * resource.hourlyCost,
      0,
    );
    const blockers: string[] = [];
    if (totalCapacity < contract.requiredHours) blockers.push(`capacity short by ${contract.requiredHours - totalCapacity} hours`);
    let lowestCoverageRatio = Number.POSITIVE_INFINITY;
    for (const requirement of contract.requiredCapabilities) {
      const coverage = team.reduce((sum, resource) => sum + (resource.capabilities[requirement.capabilityId] ?? 0), 0);
      lowestCoverageRatio = Math.min(lowestCoverageRatio, coverage / requirement.minimum);
      if (coverage < requirement.minimum) blockers.push(`${requirement.capabilityId} short by ${requirement.minimum - coverage}`);
    }
    const utilization = contract.requiredHours / Math.max(totalCapacity, 1);
    const coverageRisk = lowestCoverageRatio >= 1 ? 1 / (1 + lowestCoverageRatio) : 1;
    const risk = Number(Math.min(1, coverageRisk * 0.65 + utilization * 0.35).toFixed(4));
    if (cost > contract.budgetLimit) blockers.push(`budget exceeded by ${cost - contract.budgetLimit}`);
    if (risk > contract.maximumRisk) blockers.push(`risk ${risk} exceeds ${contract.maximumRisk}`);
    const measures = Object.fromEntries(contract.outcomeMeasures.map((measure) => {
      if (measure === "cost") return [measure, cost];
      if (measure === "deliveryHours") return [measure, deliveryHours];
      if (measure === "risk") return [measure, risk];
      return [measure, 0];
    }));
    return {
      id: `option:${team.map((resource) => resource.id).sort().join("+")}`,
      resourceIds: team.map((resource) => resource.id).sort(),
      feasible: blockers.length === 0,
      blockers,
      expected: { cost, deliveryHours, risk, measures },
    };
  }).sort((a, b) =>
    Number(b.feasible) - Number(a.feasible) ||
    a.expected.risk - b.expected.risk ||
    a.expected.cost - b.expected.cost ||
    a.id.localeCompare(b.id),
  );
}

export function authorizeSelection(
  contract: WorkContract,
  option: DecisionOption,
  actor: AuthorizingActor,
  assumptions: string[],
  selectedAt: string,
): DecisionSelection {
  if (!option.feasible) throw new Error(`Cannot select infeasible option: ${option.blockers.join("; ")}`);
  if (!actor.roles.some((role) => contract.authorizedRoles.includes(role))) {
    throw new Error(`Actor ${actor.id} lacks an authorized role`);
  }
  return { optionId: option.id, actorId: actor.id, assumptions: [...assumptions], selectedAt };
}

export function explainVariance(expected: Record<string, number>, outcome: DecisionOutcome): VarianceExplanation[] {
  return Object.entries(outcome.measures).sort(([a], [b]) => a.localeCompare(b)).map(([measure, actual]) => {
    const expectedValue = expected[measure] ?? null;
    const evidence = outcome.kind === "observed"
      ? outcome.varianceSignals
        .filter((signal) => signal.measures.includes(measure))
        .map((signal) => `${signal.statement} [${signal.evidenceRef}]`)
      : [`Simulation ${outcome.modelId} seed ${outcome.seed}`];
    return {
      measure,
      expected: expectedValue,
      actual,
      delta: expectedValue === null ? null : actual - expectedValue,
      attribution: evidence.length > 0 ? evidence : ["Attribution unavailable; variance recorded without an invented cause."],
    };
  });
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  let state = 0x811c9dc5;
  for (const char of canonical(value)) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 0x01000193);
  }
  return `fnv1a32:${(state >>> 0).toString(16).padStart(8, "0")}`;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function appendDecisionReceipt(input: {
  ledger: DecisionLedger;
  contract: WorkContract;
  organization: OrganizationalState;
  option: DecisionOption;
  selection: DecisionSelection;
  outcome: DecisionOutcome;
}): DecisionLedger {
  if (input.selection.optionId !== input.option.id) throw new Error("Selection and option do not match");
  if (input.outcome.kind === "observed" && !input.outcome.evidenceRef.trim()) throw new Error("Observed outcomes require evidenceRef");
  if (input.outcome.kind === "observed" && input.outcome.varianceSignals.some((signal) => !signal.evidenceRef.trim())) {
    throw new Error("Observed variance signals require evidenceRef");
  }
  const previous = input.ledger.receipts.at(-1);
  const consumedHours = input.option.resourceIds.map((id) => [id, input.option.expected.deliveryHours] as const);
  const unsigned = {
    sequence: input.ledger.receipts.length + 1,
    previousHash: previous?.hash ?? null,
    contractId: input.contract.id,
    organizationId: input.organization.id,
    selection: input.selection,
    expected: input.option.expected,
    outcome: input.outcome,
    variance: explainVariance(input.option.expected.measures, input.outcome),
    stateTransition: { consumedHoursByResource: Object.fromEntries(consumedHours) },
  };
  const receipt: DecisionReceipt = deepFreeze({ ...structuredClone(unsigned), hash: hash(unsigned) });
  return deepFreeze({ receipts: [...input.ledger.receipts, receipt] });
}

export function serializeDecisionLedger(ledger: DecisionLedger): string {
  return canonical(ledger);
}

export function reloadDecisionLedger(serialized: string): DecisionLedger {
  const parsed = JSON.parse(serialized) as DecisionLedger;
  let previousHash: string | null = null;
  for (const receipt of parsed.receipts) {
    const { hash: claimed, ...unsigned } = receipt;
    if (receipt.previousHash !== previousHash || hash(unsigned) !== claimed) throw new Error("Decision receipt chain verification failed");
    previousHash = claimed;
  }
  return deepFreeze(parsed);
}

export function applyReceiptTransition(organization: OrganizationalState, receipt: DecisionReceipt): OrganizationalState {
  return {
    ...organization,
    resources: organization.resources.map((resource) => ({
      ...resource,
      availableHours: Math.max(0, resource.availableHours - (receipt.stateTransition.consumedHoursByResource[resource.id] ?? 0)),
    })),
  };
}
