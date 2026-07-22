// Cartridge-owned presentation identity for the Arc player. This is the hub-side
// twin of World's white-label theme seam: bundled references may carry a material
// identity, while unknown/imported Arcs keep the neutral house style.

import type { JSX } from "react";

export type CartridgeThemeScope = "first-charter" | "karazhan" | "ilyon";

export function cartridgeThemeScope(arcId: string): CartridgeThemeScope | null {
  if (arcId === "first-charter") return "first-charter";
  if (arcId === "karazhan") return "karazhan";
  if (arcId === "kind-gods-of-ilyon") return "ilyon";
  return null;
}

function FirstCharterSeal(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="10" r="2.4" fill="currentColor" />
      <path d="M9 12.5v7M9 16c-2 0-3.5 1-4.6 2.5M9 16c2 0 3.5 1 4.6 2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 8l5-3M11.5 10l6 0M10.8 12l5 3" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="17" cy="4.5" r="1" fill="currentColor" /><circle cx="19" cy="10" r="1" fill="currentColor" /><circle cx="17" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function IlyonAstrolabe(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="12" cy="11" rx="8.8" ry="3.2" fill="none" stroke="currentColor" strokeWidth="1.1" transform="rotate(-18 12 11)" />
      <path d="M12 3.5v15M5.5 14c2.2-1.2 3.7-1 5.2.4 1.6 1.5 3.5 1.8 7.8-.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="11" r="1.6" fill="currentColor" />
      <path d="M8 21h8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function WakingTower(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 22V5h2v2h2V4h2v3h2V5h2v17Z" fill="currentColor" />
      <rect x="9.5" y="10" width="2" height="3" className="cartridge-emblem__light" />
      <rect x="13" y="15" width="2" height="3" className="cartridge-emblem__light" />
    </svg>
  );
}

export function CartridgeEmblem({ arcId, size = 42 }: { arcId: string; size?: number }): JSX.Element | null {
  const scope = cartridgeThemeScope(arcId);
  if (!scope) return null;
  const label = scope === "first-charter"
    ? "The First Charter"
    : scope === "karazhan"
      ? "The Waking Tower"
      : "The Kind Gods of Ilyon";
  return (
    <span className={`cartridge-emblem cartridge-emblem--${scope}`} data-testid={`arc-emblem-${scope}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      {scope === "first-charter" ? <FirstCharterSeal /> : scope === "karazhan" ? <WakingTower /> : <IlyonAstrolabe />}
    </span>
  );
}
