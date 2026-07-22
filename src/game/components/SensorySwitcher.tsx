import { useEffect } from "react";
import { t } from "../../i18n/index.js";
import {
  applySensoryPreferenceToRoot,
  useSensoryPreferences,
} from "../lib/sensory-prefs.js";

export function SensorySwitcher(): JSX.Element {
  const [preferences, setPreferences] = useSensoryPreferences();
  useEffect(() => applySensoryPreferenceToRoot(preferences), [preferences]);
  return (
    <div className="sensory-switcher" data-testid="sensory-switcher" role="group" aria-label={t("sensory.group")}>
      <button
        type="button"
        className="codex-trigger sensory-switcher__button"
        aria-pressed={preferences.sound}
        aria-label={preferences.sound ? t("sensory.soundOn") : t("sensory.soundOff")}
        title={preferences.sound ? t("sensory.soundOn") : t("sensory.soundOff")}
        onClick={() => setPreferences({ ...preferences, sound: !preferences.sound })}
      >
        <span aria-hidden="true">{preferences.sound ? "♪" : "×"}</span>
        <span className="sensory-switcher__label">{preferences.sound ? t("sensory.soundOn") : t("sensory.soundOff")}</span>
      </button>
      <button
        type="button"
        className="codex-trigger sensory-switcher__button"
        aria-pressed={preferences.reducedMotion}
        aria-label={preferences.reducedMotion ? t("sensory.motionReduced") : t("sensory.motionSystem")}
        title={preferences.reducedMotion ? t("sensory.motionReduced") : t("sensory.motionSystem")}
        onClick={() => setPreferences({ ...preferences, reducedMotion: !preferences.reducedMotion })}
      >
        <span aria-hidden="true">{preferences.reducedMotion ? "—" : "↝"}</span>
        <span className="sensory-switcher__label">{preferences.reducedMotion ? t("sensory.motionReduced") : t("sensory.motionSystem")}</span>
      </button>
    </div>
  );
}
