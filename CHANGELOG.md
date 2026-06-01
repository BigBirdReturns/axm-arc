# Changelog

All notable player-facing changes to the AXM Arc game. Engine/internal
changes are noted only when they change what the player experiences.

## [Unreleased] — codex branch
### Added
- In-game **Manual** ("?" button, also on the title screen): every attribute,
  role, trait, and facility documented from arc data, plus a "How challenges
  resolve" section explaining check math.
- **Count-up animation** on gold, reputation, and tokens (honors reduced-motion).
- Title-screen links to the Manual and the Designer Prototype.
### Changed
- Tutorial replay moved into the Manual overlay (removes the duplicate "?").

## [2026-05-31] — assignment decision support (PR #13)
### Added
- **Recommended roster** + readiness summary on the Assign screen.
- Projections now name the driving attribute and how each check scopes.
- Base screen recommends which facility to upgrade, with a reason.

## [2026-05-29] — economy + legibility (PR #9, #10)
### Fixed
- Challenges now pay gold (30–180 by difficulty); upkeep is now actually charged.
- Re-clearing a beaten challenge pays a reduced share (no more infinite farm).
- Downed agents return to duty after downtime, with or without a Medical facility.
- Reputation-to-next-tier shows the real threshold (was wrong 10×).
### Added
- Field reports show the cycle payout. AUTO-FILL lowest-stress roster button.
- Drama resolution shows "AUTHORITY LOGGED / EXECUTING" feedback.
### Changed
- Roles/tiers show display names ("Skirmisher", "Veteran") instead of raw ids.

## [2026-05-28] — Sprint 2
### Added
- Cycle transition interstitial, intent outcome recap, cycle readiness checklist,
  reports "so what" summary layer.
### Changed
- Mobile density pass (~20% less above-the-fold noise at 480px).

## [2026-05-25] — first playable build
### Added
- The First Charter tutorial arc. AXM House Style UI. Title screen.
- Deterministic 11-step cycle engine. Save/load. GitHub Pages deploy.
