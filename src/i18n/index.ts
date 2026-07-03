// Public i18n surface: a module-level "current locale" translator (t) for use
// outside React, plus a useSyncExternalStore-backed hook for components. Ported
// verbatim in shape from axm-world's i18n/index.ts — no context provider is
// needed, the module-scope locale is the single source of truth and subscribers
// are notified directly on change.

import { useCallback, useSyncExternalStore } from "react";
import { isLocale, loadLocale, saveLocale, type Locale } from "./locale.js";
import { formatMessage, type MessageId, type MessageParams } from "./messages.js";

export type { Locale } from "./locale.js";
export { isLocale, detectDefaultLocale, loadLocale, saveLocale } from "./locale.js";
export type { MessageId, MessageParams } from "./messages.js";
export { MESSAGES, EN_ONLY_IDS, formatMessage } from "./messages.js";

let currentLocale: Locale = loadLocale();
const subscribers = new Set<() => void>();

function notify(): void {
  for (const fn of subscribers) fn();
}

export function t(id: MessageId, params?: MessageParams): string {
  return formatMessage(currentLocale, id, params);
}

export function setLocale(l: Locale): void {
  if (!isLocale(l)) return;
  currentLocale = l;
  saveLocale(l);
  notify();
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function getSnapshot(): Locale {
  return currentLocale;
}

export function useLocale(): [Locale, (l: Locale) => void] {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const set = useCallback((l: Locale) => setLocale(l), []);
  return [locale, set];
}
