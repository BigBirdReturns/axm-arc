// TrustLabel — small provenance chip for arcs. Lives in src/codex/ because
// codex is this repo's home for generic, arc-agnostic renderers reused across
// surfaces (library list, codex overlay header, title masthead). Coloring is
// state-driven via existing CSS tokens (.trust-chip[data-trust=...] in
// styles.css); no new color tokens are introduced here.

import type { TrustLabel as TrustLabelValue } from "../engine/types.js";

const LABEL_COPY: Record<TrustLabelValue, string> = {
  "bundled": "Bundled",
  "imported-unsigned": "Imported · Unsigned",
  "verified": "Verified",
  "quarantined": "Quarantined",
};

export default function TrustLabel({ trust }: { trust: TrustLabelValue }): JSX.Element {
  return (
    <span className="trust-chip" data-trust={trust} title={`Trust: ${trust}`}>
      {LABEL_COPY[trust]}
    </span>
  );
}
