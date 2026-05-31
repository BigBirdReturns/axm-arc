import type { Trait, TraitEffect } from "../engine/types.js";

// Translate a single trait effect into a plain-language sentence. Mirrors the
// effect union in engine/types.ts — keep in sync if new effect kinds are added.
function describeEffect(effect: TraitEffect): string {
  switch (effect.kind) {
    case "infraEfficiencyMultiplier":
      return `Infrastructure output is multiplied by ${effect.multiplier}.`;
    case "moralePenaltyMultiplierOnRewardDisappointment":
      return `Morale penalty from reward disappointment is multiplied by ${effect.multiplier}.`;
    case "mentorshipTierGapBonus":
      return `Can form Mentorship across a tier gap of only ${effect.reducedGapRequired}.`;
    case "relationshipFormationMultiplier":
      return `Relationship formation rate is multiplied by ${effect.multiplier}.`;
    case "hostileStressImmunity":
      return "Immune to stress from Hostile relationships.";
    case "recklessAfflictionChanceBonus":
      return `Reckless affliction chance increased by ${Math.round(effect.bonus * 100)}%.`;
    case "attributeBonusWhenMoraleHigh":
      return `+${effect.bonus} to ${effect.attributeId} when morale is above ${effect.threshold}.`;
    case "stressAccumulationMultiplier":
      return `Stress accumulation is multiplied by ${effect.multiplier}.`;
    case "moraleGainMultiplier":
      return `Morale gain is multiplied by ${effect.multiplier}.`;
    case "attributeCheckBonus":
      return `+${effect.bonus} to ${effect.attributeId} checks.`;
    case "stressOnPartialSuccess":
      return `Gains ${effect.amount} stress on any partial success.`;
    case "relationshipAffinityMultiplier":
      return `Relationship affinity gains are multiplied by ${effect.multiplier}.`;
    case "moraleSensitivityToTeamLoss":
      return `Morale sensitivity to team losses is multiplied by ${effect.multiplier}.`;
    case "ambitionSignal":
      return "Signals that hidden Ambition is likely high.";
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
          <strong>Mechanical effect:</strong>
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
