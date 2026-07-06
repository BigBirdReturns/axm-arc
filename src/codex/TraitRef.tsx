import type { Trait, TraitEffect } from "../engine/types.js";
import { t } from "../i18n/index.js";

// Translate a single trait effect into a plain-language sentence. Mirrors the
// effect union in engine/types.ts — keep in sync if new effect kinds are added.
// Sentences come from the traitfx.* catalog ids; attributeId values are arc
// data and flow verbatim as params.
function describeEffect(effect: TraitEffect): string {
  switch (effect.kind) {
    case "infraEfficiencyMultiplier":
      return t("traitfx.infraEfficiencyMultiplier", { multiplier: effect.multiplier });
    case "moralePenaltyMultiplierOnRewardDisappointment":
      return t("traitfx.moralePenaltyMultiplierOnRewardDisappointment", { multiplier: effect.multiplier });
    case "mentorshipTierGapBonus":
      return t("traitfx.mentorshipTierGapBonus", { gap: effect.reducedGapRequired });
    case "relationshipFormationMultiplier":
      return t("traitfx.relationshipFormationMultiplier", { multiplier: effect.multiplier });
    case "hostileStressImmunity":
      return t("traitfx.hostileStressImmunity");
    case "recklessAfflictionChanceBonus":
      return t("traitfx.recklessAfflictionChanceBonus", { pct: Math.round(effect.bonus * 100) });
    case "attributeBonusWhenMoraleHigh":
      return t("traitfx.attributeBonusWhenMoraleHigh", { bonus: effect.bonus, attr: effect.attributeId, threshold: effect.threshold });
    case "stressAccumulationMultiplier":
      return t("traitfx.stressAccumulationMultiplier", { multiplier: effect.multiplier });
    case "moraleGainMultiplier":
      return t("traitfx.moraleGainMultiplier", { multiplier: effect.multiplier });
    case "attributeCheckBonus":
      return t("traitfx.attributeCheckBonus", { bonus: effect.bonus, attr: effect.attributeId });
    case "stressOnPartialSuccess":
      return t("traitfx.stressOnPartialSuccess", { amount: effect.amount });
    case "relationshipAffinityMultiplier":
      return t("traitfx.relationshipAffinityMultiplier", { multiplier: effect.multiplier });
    case "moraleSensitivityToTeamLoss":
      return t("traitfx.moraleSensitivityToTeamLoss", { multiplier: effect.multiplier });
    case "ambitionSignal":
      return t("traitfx.ambitionSignal");
    default:
      return "";
  }
}

export default function TraitRef({ trait }: { trait: Trait }): JSX.Element | null {
  if (!trait) return null;

  const effects = (trait.effects ?? []).map(describeEffect).filter((s) => s.length > 0);

  return (
    <div className="codex-entry">
      <div className="codex-entry-name">{trait.name}</div>
      <div className="codex-entry-desc">{trait.description}</div>

      {effects.length > 0 && (
        <div className="codex-meta-row">
          <strong>{t("codexRef.mechEffect")}</strong>
          <ul>
            {effects.map((line, i) => (
              <li key={`${trait.id}-fx-${i}`}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
