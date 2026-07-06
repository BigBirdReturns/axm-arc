import type { Arc, MechanicCheck } from "../engine/types.js";
import { t, type MessageId } from "../i18n/index.js";
import { MESSAGES } from "../i18n/messages.js";

function scopeText(scope: MechanicCheck["scope"]): string {
  const id = `scope.${scope}` as MessageId;
  return MESSAGES.en[id] !== undefined ? t(id) : scope;
}

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
        <strong>{t("codexRef.attrsThatMatter")}</strong>
        {weights.length === 0 ? (
          <div>{t("codexRef.noAttrsWeighted")}</div>
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
        <strong>{t("codexRef.howScored")}</strong>
        <div>{scopeText(check.scope)}</div>
      </div>

      <div className="codex-meta-row">
        <strong>{t("codexRef.target")}</strong> {check.difficultyThreshold}
      </div>
    </div>
  );
}
