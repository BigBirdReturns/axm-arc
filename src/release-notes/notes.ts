// Release notes — the compiled-in source the in-game "What's new" overlay reads.
//
// DUPLICATION NOTE: the entries below intentionally mirror CHANGELOG.md at the
// repo root. CHANGELOG.md is the human/repo-facing source of truth; this module
// is what ships inside the app bundle. Keep the two consistent when editing —
// this is the one acceptable duplication in the codebase. This module is
// arc-agnostic and carries no game-specific imports, so it is reusable by the
// future enterprise build.

export interface ReleaseNote {
  /** Display label for the release, e.g. "Unreleased" or a date. */
  version: string;
  /** ISO-ish date or branch marker shown beside the version. */
  date: string;
  /** One-line characterization of the release. */
  summary: string;
  added?: string[];
  changed?: string[];
  fixed?: string[];
}

// Newest first.
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "Unreleased",
    date: "codex branch",
    summary: "Manual, count-up animations, and title-screen links.",
    added: [
      'In-game Manual ("?" button, also on the title screen): every attribute, role, trait, and facility documented from arc data, plus a "How challenges resolve" section explaining check math.',
      "Count-up animation on gold, reputation, and tokens (honors reduced-motion).",
      "Title-screen links to the Manual and the Designer Prototype.",
    ],
    changed: [
      'Tutorial replay moved into the Manual overlay (removes the duplicate "?").',
    ],
  },
  {
    version: "2026-05-31",
    date: "2026-05-31",
    summary: "Assignment decision support (PR #13).",
    added: [
      "Recommended roster + readiness summary on the Assign screen.",
      "Projections now name the driving attribute and how each check scopes.",
      "Base screen recommends which facility to upgrade, with a reason.",
    ],
  },
  {
    version: "2026-05-29",
    date: "2026-05-29",
    summary: "Economy + legibility (PR #9, #10).",
    fixed: [
      "Challenges now pay gold (30–180 by difficulty); upkeep is now actually charged.",
      "Re-clearing a beaten challenge pays a reduced share (no more infinite farm).",
      "Downed agents return to duty after downtime, with or without a Medical facility.",
      "Reputation-to-next-tier shows the real threshold (was wrong 10×).",
    ],
    added: [
      "Field reports show the cycle payout. AUTO-FILL lowest-stress roster button.",
      'Drama resolution shows "AUTHORITY LOGGED / EXECUTING" feedback.',
    ],
    changed: [
      'Roles/tiers show display names ("Skirmisher", "Veteran") instead of raw ids.',
    ],
  },
  {
    version: "2026-05-28",
    date: "2026-05-28",
    summary: "Sprint 2.",
    added: [
      'Cycle transition interstitial, intent outcome recap, cycle readiness checklist, reports "so what" summary layer.',
    ],
    changed: [
      "Mobile density pass (~20% less above-the-fold noise at 480px).",
    ],
  },
  {
    version: "2026-05-25",
    date: "2026-05-25",
    summary: "First playable build.",
    added: [
      "The First Charter tutorial arc. AXM House Style UI. Title screen.",
      "Deterministic 11-step cycle engine. Save/load. GitHub Pages deploy.",
    ],
  },
];

// Vite injects __BUILD_SHA__ via the `define` block in vite.config.ts. A
// matching `declare const __BUILD_SHA__: string;` already exists in
// src/game/App.tsx; re-declaring here keeps this module self-contained.
declare const __BUILD_SHA__: string;
export const CURRENT_BUILD: string =
  typeof __BUILD_SHA__ === "string" ? __BUILD_SHA__ : "dev";
