import type { Arc } from "../engine/types.js";

export default function AttributeRef({ arc, id }: { arc: Arc; id: string }): JSX.Element | null {
  const attr = arc.attributes.find((a) => a.id === id);
  if (!attr) return null;

  // Roles that weight this attribute > 0, sorted desc by weight.
  const rolesUsing = arc.roles
    .map((r) => ({ role: r, weight: r.attributeWeights[id] ?? 0 }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  // Checks that reference this attribute, grouped by challenge name.
  const checkRows: Array<{ challengeName: string; checkName: string; weight: number }> = [];
  for (const ch of arc.challenges) {
    for (const mc of ch.mechanicChecks) {
      const w = mc.attributeWeights.find((aw) => aw.attributeId === id);
      if (w) {
        checkRows.push({ challengeName: ch.name, checkName: mc.name, weight: w.weight });
      }
    }
  }

  // Group by challenge.
  const grouped = new Map<string, Array<{ checkName: string; weight: number }>>();
  for (const row of checkRows) {
    const list = grouped.get(row.challengeName) ?? [];
    list.push({ checkName: row.checkName, weight: row.weight });
    grouped.set(row.challengeName, list);
  }

  return (
    <div className="codex-entry">
      <div className="codex-entry-name">{attr.name}</div>
      <div className="codex-entry-desc">{attr.description}</div>

      {rolesUsing.length > 0 && (
        <div className="codex-meta-row">
          <strong>Used in roles:</strong>
          <ul>
            {rolesUsing.map(({ role, weight }) => (
              <li key={role.id}>
                {role.name}: {Math.round(weight * 100)}%
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="codex-meta-row">
        <strong>Checked in:</strong>
        {grouped.size === 0 ? (
          <div>Not directly checked in any challenge.</div>
        ) : (
          <ul>
            {Array.from(grouped.entries()).map(([challengeName, checks]) => (
              <li key={challengeName}>
                {checks.map((c, i) => (
                  <div key={`${challengeName}-${c.checkName}-${i}`}>
                    {challengeName} — {c.checkName} (weight {c.weight})
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
