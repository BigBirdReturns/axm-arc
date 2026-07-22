import { describe, expect, it } from "vitest";
import {
  loadSensoryPreferences,
  playArcPresentationCue,
  saveSensoryPreferences,
} from "../../src/game/lib/sensory-prefs.js";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("Arc local-first sensory preferences", () => {
  it("round-trips sound and motion outside run state", () => {
    const storage = new MemoryStorage();
    expect(loadSensoryPreferences(storage)).toEqual({ sound: true, reducedMotion: false });
    expect(saveSensoryPreferences({ sound: false, reducedMotion: true }, storage)).toBe(true);
    expect(loadSensoryPreferences(storage)).toEqual({ sound: false, reducedMotion: true });
  });

  it("degrades safely when storage or audio is unavailable", () => {
    const denied = {
      getItem() { throw new Error("denied"); },
      setItem() { throw new Error("denied"); },
    } as unknown as Storage;
    expect(loadSensoryPreferences(denied)).toEqual({ sound: true, reducedMotion: false });
    expect(saveSensoryPreferences({ sound: true, reducedMotion: false }, denied)).toBe(false);
    expect(() => playArcPresentationCue("enter", "first-charter")).not.toThrow();
  });
});
