import type { Agent } from "../../engine/types.js";

// Designer roster draft — parallel to the org save, NOT nested inside it
// (same pattern as axm-arc:intent:v1). Never blocks boot on a corrupt draft.
// Spec lives in DESIGNER_PORT.md §State.

const KEY = "axm-arc:roster-draft:v1";

export type DesignerSection = "roster" | "items" | "challenges" | "arc";

export interface RosterDraft {
  version: 1;
  arcId: string;
  agents: Agent[];
  selectedId: string | null;
  section: DesignerSection;
}

export function emptyDraft(arcId: string): RosterDraft {
  return { version: 1, arcId, agents: [], selectedId: null, section: "roster" };
}

export function loadRosterDraft(arcId: string): RosterDraft {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDraft(arcId);
    const parsed = JSON.parse(raw) as Partial<RosterDraft>;
    if (parsed.version !== 1) return emptyDraft(arcId);
    // Bound the draft to the currently-active arc. Switching arcs resets the
    // draft rather than carrying agents whose role/tier/attribute ids may not
    // map. The user can re-open the previous arc to recover their draft.
    if (parsed.arcId !== arcId) return emptyDraft(arcId);
    return {
      version: 1,
      arcId,
      agents: Array.isArray(parsed.agents) ? parsed.agents as Agent[] : [],
      selectedId: typeof parsed.selectedId === "string" ? parsed.selectedId : null,
      section: parsed.section ?? "roster",
    };
  } catch {
    return emptyDraft(arcId);
  }
}

export function saveRosterDraft(draft: RosterDraft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Quota / unavailable — silently degrade. Surfacing this is SCALE.md 0.4
    // territory and shared with the org save story; not in scope for Step 2.
  }
}

export function clearRosterDraft(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
