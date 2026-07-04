// Typed message catalog. Ported in shape from axm-world's i18n/messages.ts.
// Message values are either plain strings or small formatting functions that take
// a params bag — this lets pluralized English strings and their zh-Hant
// counterparts live side by side under one id without any runtime template-string
// parsing.
//
// GRAMMAR RULE (same as world): only arc-app-authored CHROME strings belong here.
// Loaded-arc data (arc.meta.name/domain/description, resource names like
// tokenName/currencyName/reputationName, challenge/role/attribute/item names,
// outcome narratives, drama text, agent names) and variant-branded labels
// (VARIANT_LABELS) must keep flowing verbatim — they are the cartridge's own
// vocabulary and are never catalogued or translated here, so a second arc's
// vocabulary always wins.

import type { Locale } from "./locale.js";

export type MessageParams = Record<string, string | number>;

type MessageValue = string | ((params: MessageParams) => string);

export type MessageId =
  // ── locale switcher ────────────────────────────────────────────────────
  | "locale.enLabel"
  | "locale.zhHantLabel"
  // ── shared vocabulary ──────────────────────────────────────────────────
  | "common.save"
  | "common.edit"
  | "common.reset"
  | "common.manual"
  | "common.designer"
  // ── primary navigation (tab labels) ────────────────────────────────────
  | "nav.roster"
  | "nav.assign"
  | "nav.drama"
  | "nav.base"
  | "nav.reports"
  // ── app header chrome ──────────────────────────────────────────────────
  | "header.situationRoom"
  | "header.rosterCount"
  | "header.lightMode"
  | "header.darkMode"
  | "header.switchToLight"
  | "header.switchToDark"
  | "header.openManual"
  // ── stat strip ─────────────────────────────────────────────────────────
  | "stats.drama"
  | "stats.queued"
  // ── intent block ───────────────────────────────────────────────────────
  | "intent.label"
  | "intent.empty"
  // ── advance-cycle footer ───────────────────────────────────────────────
  | "advance.cycle"
  | "advance.blocked"
  | "advance.blockedShort"
  // ── title screen ───────────────────────────────────────────────────────
  | "title.continue"
  | "title.agentsCount"
  | "title.reputation"
  | "title.guaranteeDeterministicLabel"
  | "title.guaranteeDeterministicBody"
  | "title.guaranteeOfflineLabel"
  | "title.guaranteeOfflineBody"
  | "title.guaranteePortableLabel"
  | "title.guaranteePortableBody"
  | "title.colophon"
  | "title.designerPrototype"
  | "title.releaseNotes";

/**
 * Ids intentionally left out of the zh-Hant catalog. Documented, not accidental —
 * the locale guard test (tests/i18n/locale.test.ts) checks every en id is either
 * present in zh-Hant OR listed here.
 *
 * "title.designerPrototype" is the seeded demo id that exercises the
 * zh-Hant → en fallback path honestly; keep it missing on purpose.
 */
export const EN_ONLY_IDS: MessageId[] = [
  "title.designerPrototype",
];

function num(params: MessageParams, key: string): number {
  return Number(params[key] ?? 0);
}

function str(params: MessageParams, key: string): string {
  return String(params[key] ?? "");
}

export const MESSAGES: Record<Locale, Partial<Record<MessageId, MessageValue>>> = {
  en: {
    "locale.enLabel": "EN",
    "locale.zhHantLabel": "中文",

    "common.save": "Save",
    "common.edit": "Edit",
    "common.reset": "Reset",
    "common.manual": "Manual",
    "common.designer": "Designer",

    "nav.roster": "Roster",
    "nav.assign": "Assign",
    "nav.drama": "Drama",
    "nav.base": "Base",
    "nav.reports": "Reports",

    "header.situationRoom": (params) => `Situation Room · Cycle ${str(params, "cycle")}`,
    "header.rosterCount": (params) => `Roster · ${str(params, "count")}`,
    "header.lightMode": "Light mode",
    "header.darkMode": "Dark mode",
    "header.switchToLight": "Switch to light mode",
    "header.switchToDark": "Switch to dark mode",
    "header.openManual": "Open manual",

    "stats.drama": "Drama",
    "stats.queued": "queued",

    "intent.label": "Intent · This Cycle",
    "intent.empty": "No intent set. Tap Edit to add one.",

    "advance.cycle": "Advance Cycle →",
    "advance.blocked": "Advance blocked",
    "advance.blockedShort": "Blocked",

    "title.continue": (params) => `Continue · Cycle ${str(params, "cycle")}`,
    "title.agentsCount": (params) => {
      const count = num(params, "count");
      return `${count} agent${count === 1 ? "" : "s"}`;
    },
    "title.reputation": (params) => `Reputation ${str(params, "value")}`,
    "title.guaranteeDeterministicLabel": "Deterministic",
    "title.guaranteeDeterministicBody": "Same seed, same run",
    "title.guaranteeOfflineLabel": "Offline",
    "title.guaranteeOfflineBody": "No API, no cloud",
    "title.guaranteePortableLabel": "Portable",
    "title.guaranteePortableBody": "JSON arc format",
    "title.colophon": (params) => `AXM Arc · v${str(params, "version")} · Engine ${str(params, "engine")}`,
    "title.designerPrototype": "Designer Prototype",
    "title.releaseNotes": "Release notes",
  },
  "zh-Hant": {
    "locale.enLabel": "EN",
    "locale.zhHantLabel": "中文",

    "common.save": "儲存",
    "common.edit": "編輯",
    "common.reset": "重設",
    "common.manual": "手冊",
    "common.designer": "設計器",

    "nav.roster": "名冊",
    "nav.assign": "指派",
    "nav.drama": "劇情",
    "nav.base": "基地",
    "nav.reports": "報告",

    "header.situationRoom": (params) => `戰情室 · 週期 ${str(params, "cycle")}`,
    "header.rosterCount": (params) => `名冊 · ${str(params, "count")}`,
    "header.lightMode": "淺色模式",
    "header.darkMode": "深色模式",
    "header.switchToLight": "切換至淺色模式",
    "header.switchToDark": "切換至深色模式",
    "header.openManual": "開啟手冊",

    "stats.drama": "劇情",
    "stats.queued": "待處理",

    "intent.label": "意圖 · 本週期",
    "intent.empty": "尚未設定意圖。點擊「編輯」新增。",

    "advance.cycle": "推進週期 →",
    "advance.blocked": "推進受阻",
    "advance.blockedShort": "受阻",

    "title.continue": (params) => `繼續 · 週期 ${str(params, "cycle")}`,
    "title.agentsCount": (params) => `${num(params, "count")} 名人員`,
    "title.reputation": (params) => `聲望 ${str(params, "value")}`,
    "title.guaranteeDeterministicLabel": "確定性",
    "title.guaranteeDeterministicBody": "相同種子，相同執行",
    "title.guaranteeOfflineLabel": "離線",
    "title.guaranteeOfflineBody": "無 API，無雲端",
    "title.guaranteePortableLabel": "可攜",
    "title.guaranteePortableBody": "JSON 弧格式",
    "title.colophon": (params) => `AXM 弧 · v${str(params, "version")} · 引擎 ${str(params, "engine")}`,
    // Intentionally left untranslated (see EN_ONLY_IDS) to exercise the
    // zh-Hant → en fallback path honestly.
    // "title.designerPrototype": "設計器原型",
    "title.releaseNotes": "發行說明",
  },
};

export function formatMessage(locale: Locale, id: MessageId, params?: MessageParams): string {
  const value = MESSAGES[locale]?.[id] ?? MESSAGES.en[id];
  if (value === undefined) return id;
  if (typeof value === "function") return value(params ?? {});
  return value;
}
