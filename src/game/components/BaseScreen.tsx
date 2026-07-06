import type {
  Arc,
  Facility,
  InfrastructureFacility,
  Organization,
} from "../../engine/types.js";
import { t, type MessageId } from "../../i18n/index.js";

interface Props {
  arc: Arc;
  org: Organization;
  setOrg: (o: Organization) => void;
}

// Facility keys are an ENGINE enum (never translated); their display name,
// description, and rationale live in the catalog as fac.<Key>.{name,desc,why}.
const FACILITY_ORDER: InfrastructureFacility[] = [
  "Quarters",
  "Recreation",
  "Production",
  "Training",
  "Research",
  "Medical",
  "Storage",
];

function facilityText(key: InfrastructureFacility, kind: "name" | "desc" | "why"): string {
  return t(`fac.${key}.${kind}` as MessageId);
}

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
      ? t("base.recReasonStress", { n: highStressCount })
      : t("base.recReasonTraining");

  return (
    <div className="screen">
      <h2>
        {t("base.heading")} <span className="count">{t("base.facilitiesCount", { count: builtCount })}</span>
      </h2>

      <div className="guidance-callout">
        {t("base.guidance", { token: arc.tokenName.toLowerCase(), pct: Math.round(arc.infrastructureTokenBonus * 100), current: tokenBonusPct })}
      </div>

      <div className="recommendation-card">
        <div className="row between">
          <span className="audit-section" style={{ margin: 0 }}>
            {t("base.recommendedMove")}
          </span>
          <span className="badge pending">{facilityText(recommendedFacility, "name")}</span>
        </div>
        <div className="recommendation-body">
          {recommendedReason}{t("base.alsoRaises", { token: arc.tokenName.toLowerCase() })}
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
          <div className="stat-lbl">{t("base.rosterCap")}</div>
          <div className="stat-val">
            {(org.infrastructure["Quarters"]?.level ?? 1) * 5}
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-lbl">{t("base.upkeepCycle")}</div>
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
                {facilityText(key, "name")}
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
              {facilityText(key, "desc")}
            </div>
            <FacilityDetail fac={fac} />
            <div className="facility-effect">{facilityText(key, "why")}</div>
            <button
              className="secondary"
              style={{ width: "100%", marginTop: 8 }}
              disabled={!canAfford}
              onClick={() => upgrade(key)}
            >
              {t("base.upgradeTo", { level: fac.level + 1, cost, currency: arc.currencyName.toLowerCase() })}
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
        {t("base.unbuilt")}
      </div>
    );
  }
  return (
    <div className="agent-meta" style={{ marginTop: 4 }}>
      {t("base.assignedN", { n: fac.assignedAgents.length })}
    </div>
  );
}
