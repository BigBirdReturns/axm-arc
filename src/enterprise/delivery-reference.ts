import {
  appendDecisionReceipt,
  applyReceiptTransition,
  authorizeSelection,
  inspectFeasibleOptions,
  reloadDecisionLedger,
  serializeDecisionLedger,
} from "../kernel/decision.js";
import type { AuthorizingActor, DecisionLedger, ObservedOutcome, OrganizationalState, WorkContract } from "../kernel/types.js";

export const DELIVERY_CONTRACT: WorkContract = {
  id: "payments-reconciliation-release",
  title: "Staff and authorize the payments reconciliation release",
  requiredCapabilities: [
    { capabilityId: "data-migration", minimum: 7 },
    { capabilityId: "site-reliability", minimum: 6 },
    { capabilityId: "financial-controls", minimum: 5 },
  ],
  requiredHours: 72,
  budgetLimit: 14_000,
  maximumRisk: 0.6,
  authorizedRoles: ["delivery-director", "risk-owner"],
  outcomeMeasures: ["cost", "deliveryHours", "risk", "reconciliationDefects"],
};

export const DELIVERY_ORGANIZATION: OrganizationalState = {
  id: "northstar-delivery",
  resources: [
    { id: "maya", name: "Maya Chen", capabilities: { "data-migration": 7, "financial-controls": 3 }, availableHours: 32, hourlyCost: 165 },
    { id: "theo", name: "Theo Grant", capabilities: { "site-reliability": 7, "data-migration": 2 }, availableHours: 32, hourlyCost: 175 },
    { id: "imani", name: "Imani Brooks", capabilities: { "financial-controls": 7, "data-migration": 2 }, availableHours: 28, hourlyCost: 155 },
    { id: "ravi", name: "Ravi Singh", capabilities: { "site-reliability": 5, "financial-controls": 2 }, availableHours: 24, hourlyCost: 145 },
  ],
};

export const NEXT_DELIVERY_CONTRACT: WorkContract = {
  id: "payments-release-control-review",
  title: "Staff the post-release control review",
  requiredCapabilities: [
    { capabilityId: "site-reliability", minimum: 3 },
    { capabilityId: "financial-controls", minimum: 3 },
  ],
  requiredHours: 16,
  budgetLimit: 4_000,
  maximumRisk: 0.75,
  authorizedRoles: ["delivery-director", "risk-owner"],
  outcomeMeasures: ["cost", "deliveryHours", "risk", "openControlFindings"],
};

export function runObservedDeliveryReference() {
  const options = inspectFeasibleOptions(DELIVERY_CONTRACT, DELIVERY_ORGANIZATION);
  const selected = options.find((option) => option.feasible);
  if (!selected) throw new Error("Reference contract has no feasible staffing composition");
  const actor: AuthorizingActor = { id: "director-lee", roles: ["delivery-director"] };
  const selection = authorizeSelection(
    DELIVERY_CONTRACT,
    selected,
    actor,
    ["Production freeze begins after the reconciliation window", "Control owner is available for sign-off"],
    "2026-07-12T18:00:00.000Z",
  );
  const outcome: ObservedOutcome = {
    kind: "observed",
    observedAt: "2026-07-18T20:00:00.000Z",
    evidenceRef: "genesis://evidence/payments-release-2026-07-18",
    measures: {
      cost: selected.expected.cost + 620,
      deliveryHours: selected.expected.deliveryHours + 4,
      risk: selected.expected.risk,
      reconciliationDefects: 2,
    },
    varianceSignals: [
      { measures: ["cost", "deliveryHours"], statement: "Four additional validation hours were recorded", evidenceRef: "timesheet://release/validation" },
      { measures: ["reconciliationDefects"], statement: "Two defects were confirmed by the control-owner report", evidenceRef: "control-report://payments/2026-07-18" },
    ],
  };
  const ledger = appendDecisionReceipt({
    ledger: { receipts: [] },
    contract: DELIVERY_CONTRACT,
    organization: DELIVERY_ORGANIZATION,
    option: selected,
    selection,
    outcome,
  });
  const serialized = serializeDecisionLedger(ledger);
  const reloaded = reloadDecisionLedger(serialized);
  const nextOrganization = applyReceiptTransition(DELIVERY_ORGANIZATION, reloaded.receipts[0]!);
  const nextFeasibleOptions = inspectFeasibleOptions(NEXT_DELIVERY_CONTRACT, nextOrganization).filter((option) => option.feasible);
  return { options, selected, selection, outcome, ledger: reloaded as DecisionLedger, serialized, nextOrganization, nextFeasibleOptions };
}
