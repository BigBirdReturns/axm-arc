// Per-player locale preference. Ported from axm-world's i18n/locale.ts and kept
// deliberately in step with it: a single localStorage key (namespaced to arc, the
// same idiom as storage.ts/THEME_KEY), try/catch guards for headless environments,
// and a pure-function fallback (detecting a sensible default from the browser) when
// nothing has been saved yet.

export type Locale = "en" | "zh-Hant";

const KEY = "axm-arc:locale:v1";

export function isLocale(v: string | null | undefined): v is Locale {
  return v === "en" || v === "zh-Hant";
}

/** Best-effort default locale from the browser's language preference. */
export function detectDefaultLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language;
  if (!lang) return "en";
  if (/^zh-(Hant|TW|HK|MO)/i.test(lang)) return "zh-Hant";
  return "en";
}

export function loadLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* no localStorage (headless) — fall through to detection */
  }
  return detectDefaultLocale();
}

export function saveLocale(id: Locale): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
