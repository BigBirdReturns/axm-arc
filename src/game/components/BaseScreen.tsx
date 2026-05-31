import type {
  Arc,
  Facility,
  InfrastructureFacility,
  Organization,
} from "../../engine/types.js";

interface Props {
  arc: Arc;
  org: Organization;
  setOrg: (o: Organization) => void;
}

const FACILITY_ORDER: InfrastructureFacility[] = [
  "Quarters",
  "Recreation",
  "Production",
  "Training",
  "Research",
  "Medical",
  "Storage",
];

const FACILITY_DESC: Record<InfrastructureFacility, string> = {
  Quarters: "Roster capacity (5 per level).",
  Production:
    "Crafts gear. Output scales with assigned agents' base efficiency.",
  Recreation: "Stress recovery. Improves recruitment pool quality.",
  Research: "Unlocks challenge intel and arc lore.",
  Training: "Accelerates stat growth for assigned agents.",
  Storage: "Resource capacity between cycles.",
  Medical: "Reduces downed-agent recovery time.",
};

const FACILITY_WHY: Record<InfrastructureFacility, string> = {
  Quarters:
    "Raises roster cap, so you can carry more specialists without cutting veterans.",
  Production:
    "Turns assigned agents into materials each cycle; materials feed future crafting/content loops.",
  Recreation:
    "Assigned agents recover 2 stress and get a morale floor of level × 10.",
  Research:
    "Assigned agents generate intel events; this is where hidden context/lore should surface.",
  Training:
    "Assigned agents gain random attributes over time — the direct answer to failed stat checks.",
  Storage:
    "Intended to protect larger resource stockpiles as the economy expands.",
  Medical:
    "Shortens downed-agent recovery using facility level plus assigned staff resilience.",
};

function upgradeCost(level: number): number {
  return (level + 1) * 50;
}

export function BaseScreen({ arc, org, setOrg }: Props): JSX.Element {
  const upgrade = (key: InfrastructureFacility) => {
    const fac = org.infrastructure[key];
    const cost = upgradeCost(fac.level);
    if (org.resources.currency < cost) return;
    setOrg({
      ...org,
      resources: { ...org.resources, currency: org.resources.currency - cost },
      infrastructure: {
        ...org.infrastructure,
        [key]: { ...fac, level: fac.level + 1 },
      },
    });
  };

  const builtCount = Object.values(org.infrastructure).filter(
    (f) => f.level > 0,
  ).length;
  const totalFacilityLevel = Object.values(org.infrastructure).reduce(
    (sum, f) => sum + f.level,
    0,
  );
  const tokenBonusPct = Math.min(
    50,
    Math.round(totalFacilityLevel * arc.infrastructureTokenBonus * 100),
  );
  const highStressCount = Object.values(org.agents).filter(
    (a) => a.stress >= 7,
  ).length;
  const recommendedFacility: InfrastructureFacility =
    highStressCount > 0 ? "Recreation" : "Training";
  const recommendedReason =
    highStressCount > 0
      ? `${highStressCount} agent${highStressCount === 1 ? " is" : "s are"} near stress trouble. Recreation buys safer repeat runs.`
      : "Training is the cleanest answer when assignment readouts say the roster is not ready.";

  return (
    <div className="screen">
      <h2>
        Base <span className="count">{builtCount} Facilities</span>
      </h2>

      <div className="guidance-callout">
        Gold upgrades facilities. Every facility level increases next-cycle{" "}
        {arc.tokenName.toLowerCase()} regeneration by{" "}
        {Math.round(arc.infrastructureTokenBonus * 100)}% (currently +
        {tokenBonusPct}%, capped at +50%). Training is the long-term lever for
        failed stat checks; Recreation is the short-term stress valve.
      </div>

      <div className="recommendation-card">
        <div className="row between">
          <span className="audit-section" style={{ margin: 0 }}>
            Recommended base move
          </span>
          <span className="badge pending">{recommendedFacility}</span>
        </div>
        <div className="recommendation-body">
          {recommendedReason} Base levels also raise next-cycle{" "}
          {arc.tokenName.toLowerCase()} income, so upgrades turn into more
          contract attempts.
        </div>
      </div>

      <div className="stat-strip" style={{ marginBottom: 16 }}>
        <div className="stat-cell">
          <div className="stat-lbl">{arc.currencyName}</div>
          <div className="stat-val">
            {org.resources.currency.toLocaleString()}
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-lbl">{arc.materialName}</div>
          <div className="stat-val">{org.resources.materials}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-lbl">Roster cap</div>
          <div className="stat-val">
            {(org.infrastructure["Quarters"]?.level ?? 1) * 5}
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-lbl">Upkeep/cycle</div>
          <div className="stat-val accent">
            {Object.values(org.agents).reduce((s, a) => s + a.upkeep, 0)}
          </div>
        </div>
      </div>

      {FACILITY_ORDER.map((key) => {
        const fac = org.infrastructure[key];
        if (!fac) return null;
        const cost = upgradeCost(fac.level);
        const canAfford = org.resources.currency >= cost;

        return (
          <div key={key} className="card">
            <div className="row between">
              <span className="agent-name" style={{ fontSize: 14 }}>
                {key}
              </span>
              <span className={`badge${fac.level > 0 ? " pass" : ""}`}>
                L{fac.level}
              </span>
            </div>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 13,
                color: "var(--muted)",
                marginTop: 4,
              }}
            >
              {FACILITY_DESC[key]}
            </div>
            <FacilityDetail fac={fac} />
            <div className="facility-effect">{FACILITY_WHY[key]}</div>
            <button
              className="secondary"
              style={{ width: "100%", marginTop: 8 }}
              disabled={!canAfford}
              onClick={() => upgrade(key)}
            >
              Upgrade to L{fac.level + 1} ({cost}{" "}
              {arc.currencyName.toLowerCase()})
            </button>
          </div>
        );
      })}
    </div>
  );
}

function FacilityDetail({ fac }: { fac: Facility }): JSX.Element {
  if (fac.level === 0) {
    return (
      <div className="agent-meta" style={{ marginTop: 4 }}>
        Unbuilt
      </div>
    );
  }
  return (
    <div className="agent-meta" style={{ marginTop: 4 }}>
      {fac.assignedAgents.length > 0
        ? `${fac.assignedAgents.length} assigned`
        : "0 assigned"}
    </div>
  );
}
