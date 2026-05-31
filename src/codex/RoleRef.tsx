import type { Arc } from "../engine/types.js";

export default function RoleRef({ arc, id }: { arc: Arc; id: string }): JSX.Element | null {
  const role = arc.roles.find((r) => r.id === id);
  if (!role) return null;

  const attrName = (attrId: string): string =>
    arc.attributes.find((a) => a.id === attrId)?.name ?? attrId;

  const sorted = Object.entries(role.attributeWeights)
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a);

  const lead = sorted[0];

  return (
    <div className="codex-entry">
      <div className="codex-entry-name">{role.name}</div>
      {lead && (
        <div className="codex-meta-row">
          <strong>Lead attribute:</strong> {attrName(lead[0])}
        </div>
      )}
      <div className="codex-meta-row">
        <strong>Weight breakdown:</strong>
        <ul>
          {sorted.map(([attrId, weight]) => (
            <li key={attrId}>
              {attrName(attrId)}: {Math.round(weight * 100)}%
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
