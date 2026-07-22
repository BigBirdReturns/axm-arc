// Cartridge-owned role portraits for the Arc text player. The spatial runtime
// and the hub intentionally use the same 16x16 source discipline: bundled
// cartridges get authored visual identity; imported/unknown Arcs keep an honest
// initials fallback.
//
// Source: World cartridge appearance packs and their governed white-label asset
// bibles — redrawn derivatives, copied here as local-first source data.
// Grid: 16x16
// Encoding: .=transparent o=outline s=skin d=shadow h=headgear/hair e=eye
//   m=mouth c=clothing t=trim w=highlight.

import type { HTMLAttributes, ReactNode } from "react";
import { agentInitials } from "../lib/ui-helpers.js";

interface PortraitSpec {
  grid: string[];
  palette: Record<string, string>;
}

const FC_VANGUARD: PortraitSpec = {
  grid: [
    "....oooooooo....", "...ohhhhhhhho...", "..ohhhhhhhhhho..", "..ohhwthhtwhho..",
    "..ohhsssssssho..", ".ohhsssssssssho.", ".ohhsseossessho.", ".ohhsssssssssho.",
    ".ohhssdsssdssho.", "..ohsssmmmsssho.", "..ohhsssssssho..", "...ohhsssssho...",
    "...octtttttco...", "..occcwccwccco..", ".occcccccccccco.", ".occcccccccccco.",
  ],
  palette: { o: "#1d1b18", s: "#d8ae87", d: "#45372c", h: "#68747b", e: "#211b17", m: "#945b4e", c: "#4f5e63", t: "#2d8177", w: "#efe6d2" },
};
const FC_SKIRMISHER: PortraitSpec = {
  grid: [
    ".....oooooo.....", "....ohhhhhho....", "...ohhhhhhhho...", "..ohhhwttwhhho..",
    "..ohssssssssho..", ".ohssssssssssho.", ".ohsseossseosho.", ".ohssssssssssho.",
    ".ohssdsssssdssho", "..ohsssmmmsssso.", "..ohhssssssshho.", "...ohhsssshhho..",
    "...otttttttto...", "..octtwccwttco..", ".occcccccccccco.", ".occcccccccccco.",
  ],
  palette: { o: "#1d1b18", s: "#d2a680", d: "#45372c", h: "#43583f", e: "#202019", m: "#955b4d", c: "#50664a", t: "#b68645", w: "#f0e7d4" },
};
const FC_MENDER: PortraitSpec = {
  grid: [
    ".....oooooo.....", "....ohhhhhho....", "...ohhhhhhhho...", "...otttttttto...",
    "..ohssssssssho..", ".ohssssssssssho.", ".ohsseosseossho.", ".ohssssssssssho.",
    ".ohssdsssssdssho", "..ohsssmmmsssso.", "..ohhssssssshho.", "...ohhsssshhho..",
    "...occcccccco...", "..occcttttccco..", ".occcccccccccco.", ".occcccccccccco.",
  ],
  palette: { o: "#1d1b18", s: "#dfb58e", d: "#45372c", h: "#775640", e: "#241c18", m: "#9d6252", c: "#687b72", t: "#c29d52", w: "#f5eddf" },
};

const KZ_PORTRAIT = [
  "....oooooooo....", "...ohhhhhhhho...", "..ohhhhhhhhhho..", "..ohhwthhtwhho..",
  "..ohhsssssssho..", ".ohhsssssssssho.", ".ohhsseossessho.", ".ohhsssssssssho.",
  ".ohhssdsssdssho.", "..ohsssmmmsssho.", "..ohhsssssssho..", "...ohhsssssho...",
  "...octtttttco...", "..occcwccwccco..", ".occcccccccccco.", ".occcccccccccco.",
];
const KZ_HOOD = [
  ".....oooooo.....", "...oohhhhhhoo...", "..ohhhhhhhhhho..", ".ohhhtthhhhtthho",
  ".ohhssssssssshho", ".ohsssssssssssho", ".ohsseosssseosho", ".ohsssssssssssho",
  ".ohssdsssssdssho", "..ohsssmmmsssso.", "..ohhssssssshho.", "...ohhsssshhho..",
  "...octtttttco...", "..octcwccwctco..", ".occcccccccccco.", ".occcccccccccco.",
];
const kzPalette = (h: string, c: string, t: string, w = "#efe7f5"): Record<string, string> => ({
  o: "#1a1420", s: "#d9cbb8", d: "#2a2438", h, e: "#241c2c", m: "#8a5a4c", c, t, w,
});
const KZ_TANK: PortraitSpec = { grid: KZ_PORTRAIT, palette: kzPalette("#4b465e", "#514c68", "#d19a3d") };
const KZ_HEALER: PortraitSpec = { grid: KZ_HOOD, palette: kzPalette("#e7d9c5", "#6b5b83", "#9a7fd0") };
const KZ_MELEE: PortraitSpec = { grid: KZ_HOOD, palette: kzPalette("#302942", "#49385f", "#c65d69") };
const KZ_RANGED: PortraitSpec = { grid: KZ_PORTRAIT, palette: kzPalette("#283d55", "#3f607b", "#68a4ca") };
const KZ_SUPPORT: PortraitSpec = { grid: KZ_HOOD, palette: kzPalette("#433151", "#4c4b68", "#6f8f3f") };

const ILYON_AUDITOR: PortraitSpec = {
  grid: [
    "....oooooooo....", "...ohhhhhhhho...", "..ohhhhhhhhhho..", "..ohhwwhhhhthho.",
    "..ohhssssssshto.", ".ohhsssssssssho.", ".ohhsseossstsho.", ".ohhssssssstsho.",
    ".ohhssdssssssho.", "..ohsssmmmsssho.", "..ohhsssssssho..", "...ohhsssssho...",
    "...octtttttco...", "..occcwccwccco..", ".occcccccccccco.", ".occcccccccccco.",
  ],
  palette: { o: "#071016", s: "#d7ad88", d: "#031019", h: "#18394a", e: "#221c18", m: "#995d51", c: "#174956", t: "#c9a45d", w: "#e7e1cf" },
};
const ILYON_INTERLOCUTOR: PortraitSpec = {
  grid: [
    ".....oooooo.....", "...oohhhhhhoo...", "..ohhhhhhhhhho..", ".ohhhtthhhhtthho",
    ".ohhssssssssshho", ".ohsssssssssssho", ".ohsseosssseosho", ".ohsssssssssssho",
    ".ohssdsssssdssho", "..ohsssmmmsssso.", "..ohhssssssshho.", "...ohhsssshhho..",
    "...octtttttco...", "..octcwccwctco..", ".occcccccccccco.", ".occcccccccccco.",
  ],
  palette: { o: "#071016", s: "#d8b08c", d: "#031019", h: "#2d6c70", e: "#1b2628", m: "#9e6253", c: "#2f7372", t: "#d68165", w: "#e7e1cf" },
};
const ILYON_WITNESS: PortraitSpec = {
  grid: [
    "....oooooooo....", "...ohhhhhhhho...", "..ohhhhhhhhhho..", "..ohhhtttthhho..",
    "..ohhsssssssho..", ".ohhsssssssssho.", ".ohhsseossessho.", ".ohhsssssssssho.",
    ".ohhssdsssdssho.", "..ohsssmmmsssho.", "..ohhsssssssho..", "...ohhsssssho...",
    "...occcccccco...", "..occcttttccco..", ".occcccccccccco.", ".occcccccccccco.",
  ],
  palette: { o: "#071016", s: "#d2aa88", d: "#031019", h: "#1d344e", e: "#191d25", m: "#955b52", c: "#27455d", t: "#d6bd82", w: "#e7e1cf" },
};
const ILYON_PROTECTOR: PortraitSpec = {
  grid: [
    ".....oooooo.....", "....ohhhhhho....", "...ohhhhhhhho...", "...ohhwthhwho...",
    "...ohssssssho...", "..ohssssssssho..", "..ohseosssseos..", "..ohssssssssho..",
    "..ohssdssssdsso.", "...ohssmmmssho..", "...ohssssssho...", "....ohssssho....",
    "...octtttttco...", "..occcwccwccco..", ".occcccccccccco.", ".occcccccccccco.",
  ],
  palette: { o: "#071016", s: "#d9ae89", d: "#031019", h: "#2e6d63", e: "#1d2824", m: "#9d5f51", c: "#3b7e74", t: "#d68165", w: "#eff0df" },
};
const ILYON_EXCEPTION: PortraitSpec = {
  grid: [
    "...oo......oo...", "..ohho....ohho..", ".ohhwhoooohwhho.", ".ohhhhhhhhhhhho.",
    "..ohssssssssho..", ".ohssssssssssho.", ".ohssewsssswesho", ".ohssssssssssho.",
    ".ohssdsssssdssho", "..ohsssmmmsssso.", "..ohhssssssshho.", "...ohhsssshhho..",
    "...octtttttco...", "..octcwccwctco..", ".occcccccccccco.", "..occcccccccco..",
  ],
  palette: { o: "#071016", s: "#d8efe8", d: "#031019", h: "#48b7b0", e: "#0d6d78", m: "#9f625c", c: "#78b9b2", t: "#d68165", w: "#fff3cf" },
};

const SPECS: Record<string, Record<string, PortraitSpec>> = {
  "first-charter": { vanguard: FC_VANGUARD, skirmisher: FC_SKIRMISHER, mender: FC_MENDER },
  karazhan: { tank: KZ_TANK, healer: KZ_HEALER, melee: KZ_MELEE, ranged: KZ_RANGED, support: KZ_SUPPORT },
  "kind-gods-of-ilyon": { auditor: ILYON_AUDITOR, interlocutor: ILYON_INTERLOCUTOR, witness: ILYON_WITNESS, protector: ILYON_PROTECTOR, exception: ILYON_EXCEPTION },
};

export function cartridgeRolePortraitSpec(arcId: string, roleId: string | null): PortraitSpec | null {
  if (!roleId) return null;
  return SPECS[arcId]?.[roleId.toLowerCase()] ?? null;
}

function PortraitGlyph({ spec }: { spec: PortraitSpec }): JSX.Element {
  const cells: JSX.Element[] = [];
  for (let y = 0; y < spec.grid.length; y += 1) {
    const row = spec.grid[y] ?? "";
    for (let x = 0; x < row.length; x += 1) {
      const token = row[x]!;
      if (token === ".") continue;
      cells.push(<rect key={`${y}-${x}`} x={x} y={y} width={1} height={1} fill={spec.palette[token] ?? "#1b1b1b"} />);
    }
  }
  return <svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden="true" style={{ display: "block", shapeRendering: "crispEdges" }}>{cells}</svg>;
}

interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  arcId: string;
  roleId: string | null;
  name: string;
  size?: number;
  children?: ReactNode;
}

export function CartridgePortrait({ arcId, roleId, name, size, className = "", children, style, ...props }: Props): JSX.Element {
  const spec = cartridgeRolePortraitSpec(arcId, roleId);
  return (
    <span
      className={`portrait cartridge-role-portrait ${spec ? "cartridge-role-portrait--authored" : "cartridge-role-portrait--fallback"} ${className}`.trim()}
      data-testid="cartridge-role-portrait"
      data-arc={arcId}
      data-role={roleId ?? "flex"}
      role="img"
      aria-label={`${name}${roleId ? `, ${roleId}` : ""}`}
      style={{ ...(size ? { width: size, height: size } : {}), ...style }}
      {...props}
    >
      {spec ? <PortraitGlyph spec={spec} /> : agentInitials(name)}
      {children}
    </span>
  );
}
