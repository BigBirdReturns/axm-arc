import type { InfrastructureFacility } from "../engine/types.js";
import { t, type MessageId } from "../i18n/index.js";
import { MESSAGES } from "../i18n/messages.js";

// Facilities are an engine-level fixed set (the InfrastructureFacility union),
// not arc data. Display name/description live in the shared fac.<Key>.{name,desc}
// catalog ids (same ids BaseScreen renders); the per-level upgrade explanation is
// codex-specific and lives in fac.<Key>.upgrade.

export default function FacilityRef({
  facility,
}: {
  facility: InfrastructureFacility;
}): JSX.Element | null {
  const descId = `fac.${facility}.desc` as MessageId;
  if (!facility || MESSAGES.en[descId] === undefined) return null;

  return (
    <div className="codex-entry">
      <div className="codex-entry-name">{t(`fac.${facility}.name` as MessageId)}</div>
      <div className="codex-entry-desc">{t(descId)}</div>

      <div className="codex-meta-row">
        <strong>{t("codexRef.whenUpgrade")}</strong>
        <div>{t(`fac.${facility}.upgrade` as MessageId)}</div>
      </div>
    </div>
  );
}
