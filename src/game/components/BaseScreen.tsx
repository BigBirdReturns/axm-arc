import type { Arc, Facility, InfrastructureFacility, Organization } from "../../engine/types.js";

interface Props {
  arc: Arc;
  org: Organization;
  setOrg: (o: Organization) => void;
}

const FACILITY_ORDER: InfrastructureFacility[] = [
  "Quarters",
  "Production",
  "Recreation",
  "Research",
  "Training",
  "Storage",
  "Medical",
];

const FACILITY_DESC: Record<InfrastructureFacility, string> = {
  Quarters: "Roster capacity (5 per level).",
  Production: "Crafts gear from assigned agents' Base Efficiency.",
  Recreation: "Rest stress recovery. Improves recruitment pool.",
  Research: "Unlocks challenge intel and arc lore.",
  Training: "Accelerates assigned agents' stat growth.",
  Storage: "Resource capacity.",
  Medical: "Reduces downed-agent recovery time.",
};

function upgradeCost(level: number): number {
  return (level + 1) * 50;
}

export function BaseScreen({ arc, org, setOrg }: Props): JSX.Element {
  const upgrade = (key: InfrastructureFacility) => {
    const fac = org.infrastructure[key];
    const cost = upgradeCost(fac.level);
    if (org.resources.currency < cost) return;
    const next: Organization = {
      ...org,
      resources: { ...org.resources, currency: org.resources.currency - cost },
      infrastructure: {
        ...org.infrastructure,
        [key]: { ...fac, level: fac.level + 1 },
      },
    };
    setOrg(next);
  };

  return (
    <div className="screen">
      <h2>Base</h2>
      <div className="card row between">
        <strong>{arc.currencyName}: {org.resources.currency}</strong>
        <span className="dim">{arc.materialName}: {org.resources.materials}</span>
      </div>
      <div className="card row between" style={{ marginBottom: 16 }}>
        <strong>{arc.reputationName}: {org.reputation}</strong>
      </div>
      {FACILITY_ORDER.map((key) => {
        const fac = org.infrastructure[key];
        if (!fac) return null;
        return <FacilityCard key={key} name={key} fac={fac} cost={upgradeCost(fac.level)} currency={org.resources.currency} onUpgrade={() => upgrade(key)} />;
      })}
    </div>
  );
}

function FacilityCard({
  name,
  fac,
  cost,
  currency,
  onUpgrade,
}: {
  name: string;
  fac: Facility;
  cost: number;
  currency: number;
  onUpgrade: () => void;
}): JSX.Element {
  return (
    <div className="card">
      <div className="row between">
        <strong>{name}</strong>
        <span className="badge" style={{ background: "var(--accent-dim)" }}>Lv {fac.level}</span>
      </div>
      <div className="dim" style={{ marginTop: 4 }}>{FACILITY_DESC[name as InfrastructureFacility]}</div>
      <div className="tiny" style={{ marginTop: 4 }}>
        Staffed: {fac.assignedAgents.length}
      </div>
      <button
        className="secondary"
        style={{ marginTop: 8, width: "100%" }}
        disabled={currency < cost}
        onClick={onUpgrade}
      >
        Upgrade to Lv {fac.level + 1} ({cost} gold)
      </button>
    </div>
  );
}
