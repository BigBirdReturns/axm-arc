import type { Arc, MechanicCheck } from "../engine/types.js";

const SCOPE_TEXT: Record<MechanicCheck["scope"], string> = {
  per_agent: "Each assigned agent is checked individually.",
  team_aggregate: "The whole team's combined score is checked.",
  role_specific: "Only agents in the required role are checked.",
};

export default function MechanicCheckRef({
  arc,
  check,
}: {
  arc: Arc;
  check: MechanicCheck;
}): JSX.Element | null {
  if (!check) return null;

  const attrName = (attrId: string): string =>
    arc.attributes.find((a) => a.id === attrId)?.name ?? attrId;

  // Attribute weights sorted desc — the direct answer to "what does X have to
  // do with this check".
  const weights = [...(check.attributeWeights ?? [])].sort((a, b) => b.weight - a.weight);

  return (
    <div className="codex-entry">
      <div className="codex-entry-name">{check.name}</div>
      <div className="codex-entry-desc">{check.description}</div>

      <div className="codex-meta-row">
        <strong>Attributes that matter:</strong>
        {weights.length === 0 ? (
          <div>No attributes weighted for this check.</div>
        ) : (
          <ul>
            {weights.map((w) => (
              <li key={`${check.id}-${w.attributeId}`}>
                {attrName(w.attributeId)}: {Math.round(w.weight * 100)}%
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="codex-meta-row">
        <strong>How it's scored:</strong>
        <div>{SCOPE_TEXT[check.scope] ?? check.scope}</div>
      </div>

      <div className="codex-meta-row">
        <strong>Target:</strong> {check.difficultyThreshold}
      </div>
    </div>
  );
}
