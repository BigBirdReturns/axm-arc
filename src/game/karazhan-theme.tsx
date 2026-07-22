// The Waking Tower presentation theme (legacy cartridge id `karazhan`).
//
// Everything here is gated on the arc id "karazhan"; nothing in this module
// restyles a shared class globally. Callers key off arc.meta.id === KARAZHAN_ARC_ID
// (or set data-arc="karazhan" on a container) so The First Charter and any
// imported/unknown arc keep their default look.
//
// The violet-night palette: violet #574A7A, observatory blue #4F7D9E,
// ember gold #D19A3D, moss green #6F8F3F, cold stone #746F7C,
// parchment #E9DDC4, and board ink #1A1420.

import type { JSX } from "react";

export const KARAZHAN_ARC_ID = "karazhan";

// Violet-night accent used for the library card + designer header rule.
export const KARAZHAN_ACCENT = "#574A7A";
// Ember gold — the couple of lit windows in the cursed tower.
export const KARAZHAN_EMBER = "#D19A3D";

export function isKarazhan(arcId: string): boolean {
  return arcId === KARAZHAN_ARC_ID;
}

// The cursed tower — a dark violet crenellated tower silhouette with a couple
// of lit windows. Small, self-contained inline SVG. The tower body uses
// currentColor so a parent can tint it (violet night); the windows are an
// explicit ember-gold glow.
//
// Source: the governed Waking Tower white-label reference — redrawn derivative.
export function KarazhanEmblem({ size = 20 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="The Waking Tower"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Crenellated tower silhouette (currentColor = violet night). */}
      <path
        fill="currentColor"
        d="M7 22 L7 5 L9 5 L9 7 L11 7 L11 4 L13 4 L13 7 L15 7 L15 5 L17 5 L17 22 Z"
      />
      {/* A couple of lit windows. */}
      <rect x="9.6" y="10" width="1.7" height="2.6" fill={KARAZHAN_EMBER} />
      <rect x="12.7" y="14" width="1.7" height="2.6" fill={KARAZHAN_EMBER} />
    </svg>
  );
}
