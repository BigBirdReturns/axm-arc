// TrustLabel — small provenance chip for arcs. Lives in src/codex/ because
// codex is this repo's home for generic, arc-agnostic renderers reused across
// surfaces (library list, codex overlay header, title masthead). Coloring is
// state-driven via existing CSS tokens (.trust-chip[data-trust=...] in
// styles.css); no new color tokens are introduced here.
//
// Chip copy comes from the i18n catalog (trust.*); the data-trust value and
// the title attribute keep the RAW trust value for tests/debugging.

import type { TrustLabel as TrustLabelValue } from "../engine/types.js";
import { t, type MessageId } from "../i18n/index.js";

const LABEL_ID: Record<TrustLabelValue, MessageId> = {
  "bundled": "trust.bundled",
  "imported-unsigned": "trust.importedUnsigned",
  "verified": "trust.verified",
  "quarantined": "trust.quarantined",
};

export default function TrustLabel({ trust }: { trust: TrustLabelValue }): JSX.Element {
  return (
    <span className="trust-chip" data-trust={trust} title={`Trust: ${trust}`}>
      {t(LABEL_ID[trust])}
    </span>
  );
}
