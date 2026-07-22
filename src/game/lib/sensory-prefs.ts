// Local-first sensory preferences for the Arc player and authoring tools.
// Sound and decorative motion are presentation only: they never enter Arc
// identity, run state, deterministic inputs, custody files, or telemetry.

import { useSyncExternalStore } from "react";

const KEY = "axm-arc:sensory:v1";
const EVENT = "axm-arc:sensory-change";

export interface SensoryPreferences {
  sound: boolean;
  reducedMotion: boolean;
}

const DEFAULTS: SensoryPreferences = Object.freeze({ sound: true, reducedMotion: false });
let cachedRaw: string | null | undefined;
let cachedValue: SensoryPreferences = DEFAULTS;

function ambientStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function parsePreferences(raw: string | null): SensoryPreferences {
  if (!raw) return DEFAULTS;
  try {
    const value = JSON.parse(raw) as Partial<SensoryPreferences>;
    return Object.freeze({
      sound: value.sound !== false,
      reducedMotion: value.reducedMotion === true,
    });
  } catch {
    return DEFAULTS;
  }
}

export function loadSensoryPreferences(storage: Storage | null = ambientStorage()): SensoryPreferences {
  if (!storage) return DEFAULTS;
  try {
    const raw = storage.getItem(KEY);
    const ambient = ambientStorage();
    if (storage === ambient && raw === cachedRaw) return cachedValue;
    const value = parsePreferences(raw);
    if (storage === ambient) {
      cachedRaw = raw;
      cachedValue = value;
    }
    return value;
  } catch {
    return DEFAULTS;
  }
}

export function saveSensoryPreferences(
  next: SensoryPreferences,
  storage: Storage | null = ambientStorage(),
): boolean {
  if (!storage) return false;
  try {
    const normalized = Object.freeze({
      sound: next.sound === true,
      reducedMotion: next.reducedMotion === true,
    });
    const raw = JSON.stringify(normalized);
    storage.setItem(KEY, raw);
    if (storage === ambientStorage()) {
      cachedRaw = raw;
      cachedValue = normalized;
    }
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT));
    return true;
  } catch {
    return false;
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cachedRaw = undefined;
    callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, callback);
  };
}

export function useSensoryPreferences(): [SensoryPreferences, (next: SensoryPreferences) => void] {
  const value = useSyncExternalStore(subscribe, loadSensoryPreferences, () => DEFAULTS);
  return [value, (next) => { saveSensoryPreferences(next); }];
}

export type ArcPresentationCue =
  | "enter"
  | "decision"
  | "cycle-success"
  | "cycle-partial"
  | "cycle-failure"
  | "record"
  | "compile";

const ARC_ROOT: Record<string, number> = {
  "first-charter": 220,
  karazhan: 146.83,
  "kind-gods-of-ilyon": 196,
};

const CUE: Record<ArcPresentationCue, { intervals: number[]; duration: number; wave: OscillatorType }> = {
  enter: { intervals: [1, 1.5, 2], duration: 0.42, wave: "triangle" },
  decision: { intervals: [1, 1.25], duration: 0.24, wave: "sine" },
  "cycle-success": { intervals: [1, 1.5, 2], duration: 0.5, wave: "triangle" },
  "cycle-partial": { intervals: [1, 1.2, 1.5], duration: 0.44, wave: "sine" },
  "cycle-failure": { intervals: [1, 0.82], duration: 0.46, wave: "sawtooth" },
  record: { intervals: [1, 2], duration: 0.3, wave: "square" },
  compile: { intervals: [1, 1.333, 2], duration: 0.36, wave: "triangle" },
};

/** Procedural cue: no network request, media asset, or hidden telemetry. */
export function playArcPresentationCue(cue: ArcPresentationCue, arcId: string): void {
  const preferences = loadSensoryPreferences();
  if (!preferences.sound || typeof window === "undefined") return;
  try {
    const AudioContextCtor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const spec = CUE[cue];
    const root = ARC_ROOT[arcId] ?? 174.61;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + spec.duration);
    gain.connect(context.destination);
    spec.intervals.forEach((interval, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = spec.wave;
      oscillator.frequency.setValueAtTime(root * interval, context.currentTime);
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.07);
      oscillator.stop(context.currentTime + spec.duration);
    });
    window.setTimeout(() => void context.close(), Math.ceil((spec.duration + 0.12) * 1000));
  } catch {
    // Sensory expression never blocks the deterministic loop.
  }
}

export function applySensoryPreferenceToRoot(preferences: SensoryPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.motion = preferences.reducedMotion ? "reduced" : "full";
  root.dataset.sound = preferences.sound ? "on" : "off";
  root.classList.toggle("reduce-motion", preferences.reducedMotion);
}
