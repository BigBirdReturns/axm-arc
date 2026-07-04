// Locale toggle. Ported from axm-world's LocaleSwitcher (shell/regions.tsx): a
// two-option button group bound to the module-level locale store. Styled to sit
// alongside the header's codex-trigger buttons rather than world's pixel chrome.

import { t, useLocale, type Locale } from "./index.js";

export function LocaleSwitcher(): JSX.Element {
  const [locale, setLocale] = useLocale();
  const options: Array<{ id: Locale; labelId: "locale.enLabel" | "locale.zhHantLabel" }> = [
    { id: "en", labelId: "locale.enLabel" },
    { id: "zh-Hant", labelId: "locale.zhHantLabel" },
  ];
  return (
    <div data-testid="locale-switcher" role="group" aria-label="Language" style={{ display: "flex", gap: 2 }}>
      {options.map((opt) => {
        const on = opt.id === locale;
        return (
          <button
            key={opt.id}
            className="codex-trigger"
            onClick={() => setLocale(opt.id)}
            data-testid={`locale-option-${opt.id}`}
            aria-pressed={on}
            style={{
              minWidth: 34,
              fontWeight: on ? 800 : 500,
              opacity: on ? 1 : 0.6,
            }}
          >
            {t(opt.labelId)}
          </button>
        );
      })}
    </div>
  );
}
