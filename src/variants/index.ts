// Build-time deploy variant. The variant flips entry-point *language*
// (title screen kicker, primary CTAs) without changing engine behavior. Same
// runtime, same UI shell, same arcs — different positioning for who shows up
// to use it. Don't put capability behind the variant; if a feature should
// exist for one audience but not another, that's an arc-data decision, not a
// variant decision.

declare const __VARIANT__: string;

export type Variant = "game-first" | "enterprise-first" | "research-first";

const VARIANTS: readonly Variant[] = [
  "game-first",
  "enterprise-first",
  "research-first",
];

function resolveVariant(): Variant {
  const raw = typeof __VARIANT__ !== "undefined" ? __VARIANT__ : "game-first";
  return (VARIANTS as readonly string[]).includes(raw)
    ? (raw as Variant)
    : "game-first";
}

export const VARIANT: Variant = resolveVariant();

export interface VariantLabels {
  kicker: string;
  ctaPlay: string;
  ctaLibrary: string;
}

export const VARIANT_LABELS: Record<Variant, VariantLabels> = {
  "game-first": {
    kicker: "Begin your tenure",
    ctaPlay: "New Game",
    ctaLibrary: "Arc Library",
  },
  "enterprise-first": {
    kicker: "Model your organization",
    ctaPlay: "Load Model",
    ctaLibrary: "Model Library",
  },
  "research-first": {
    kicker: "Run a scenario",
    ctaPlay: "Start Scenario",
    ctaLibrary: "Scenario Library",
  },
};
