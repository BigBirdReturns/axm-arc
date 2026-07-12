export interface CapabilityRequirement {
  capabilityId: string;
  minimum: number;
}

export interface WorkContract {
  id: string;
  title: string;
  requiredCapabilities: CapabilityRequirement[];
  requiredHours: number;
  budgetLimit: number;
  maximumRisk: number;
  authorizedRoles: string[];
  outcomeMeasures: string[];
}

export interface ResourceCandidate {
  id: string;
  name: string;
  capabilities: Record<string, number>;
  availableHours: number;
  hourlyCost: number;
}

export interface OrganizationalState {
  id: string;
  resources: ResourceCandidate[];
}

export interface ExpectedResult {
  cost: number;
  deliveryHours: number;
  risk: number;
  measures: Record<string, number>;
}

export interface DecisionOption {
  id: string;
  resourceIds: string[];
  feasible: boolean;
  blockers: string[];
  expected: ExpectedResult;
}

export interface AuthorizingActor {
  id: string;
  roles: string[];
}

export interface DecisionSelection {
  optionId: string;
  actorId: string;
  assumptions: string[];
  selectedAt: string;
}

export interface ObservedOutcome {
  kind: "observed";
  observedAt: string;
  evidenceRef: string;
  measures: Record<string, number>;
  varianceSignals: Array<{ measures: string[]; statement: string; evidenceRef: string }>;
}

export interface SimulatedOutcome {
  kind: "simulated";
  modelId: string;
  seed: number;
  measures: Record<string, number>;
}

export type DecisionOutcome = ObservedOutcome | SimulatedOutcome;

export interface VarianceExplanation {
  measure: string;
  expected: number | null;
  actual: number;
  delta: number | null;
  attribution: string[];
}

export interface DecisionReceipt {
  sequence: number;
  previousHash: string | null;
  contractId: string;
  organizationId: string;
  selection: DecisionSelection;
  expected: ExpectedResult;
  outcome: DecisionOutcome;
  variance: VarianceExplanation[];
  stateTransition: { consumedHoursByResource: Record<string, number> };
  hash: string;
}

export interface DecisionLedger {
  receipts: readonly DecisionReceipt[];
}
