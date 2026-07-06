// Display-time mappings for values that stay English INTERNALLY (engine enums,
// headline fragments that downstream code string-matches). Known values render
// localized; unknown values fall back to their raw form so a new engine value
// or a second arc's vocabulary never breaks — it just shows verbatim, which is
// the same honest fallback the message catalog uses.

import { t } from "./index.js";
import type { MessageId } from "./messages.js";
import { MESSAGES } from "./messages.js";

/** Localize a drama trigger type ("reward_dispute" → "reward dispute" / "獎勵爭議").
 *  Unknown types fall back to the raw snake_case-to-spaces form. */
export function triggerTypeLabel(type: string): string {
  const id = `trigger.${type}` as MessageId;
  if (MESSAGES.en[id] !== undefined) return t(id);
  return type.replace(/_/g, " ");
}

/** Localize an engine effect/relationship vocabulary word ("morale", "Hostile").
 *  Unknown words fall back to raw (a second arc's vocabulary always wins). */
export function vocabLabel(word: string): string {
  const id = `vocab.${word}` as MessageId;
  if (MESSAGES.en[id] !== undefined) return t(id);
  return word.replace(/_/g, " ");
}

/** Localize a generateHeadline result for display. The RAW headline values stay
 *  English because buildDeck/pickKicker string-match them; this maps the known
 *  value set at render time and falls back to raw for anything unrecognized. */
export function headlineDisplay(h: { qualifier: string; primary: string }): {
  qualifier: string;
  primary: string;
} {
  const qualifier = h.qualifier === "NEARLY" ? t("headline.nearly") : h.qualifier;
  let primary = h.primary;
  if (primary === "WIPED THE GROUP.") primary = t("headline.wipedGroup");
  else if (primary === "FAILED.") primary = t("headline.failed");
  else if (primary === "FELL APART.") primary = t("headline.fellApart");
  else if (primary === "PARTIAL CLEAR.") primary = t("headline.partialClear");
  else if (primary === "CLEARED. BARELY.") primary = t("headline.clearedBarely");
  else if (primary === "CLEAN.") primary = t("headline.clean");
  else if (primary === "CLEAR.") primary = t("headline.clear");
  else {
    const carried = /^(.+) CARRIED IT\.$/.exec(primary);
    if (carried) primary = t("headline.carried", { name: carried[1]! });
  }
  return { qualifier, primary };
}
