import type { Agent } from "../../engine/types.js";
import { agentInitials } from "../lib/ui-helpers.js";

export type PortraitSize = "small" | "medium";
export type PortraitState =
  | "normal"
  | "warn"
  | "danger"
  | "afflicted"
  | "accent";

interface PortraitGlyph {
  glyph: string;
  kind: "glyph-threshold" | "glyph-afflicted" | "glyph-resolve";
}

interface PortraitProps {
  agent: Pick<Agent, "name" | "stress" | "morale" | "afflictionState">;
  size?: PortraitSize;
  state?: PortraitState;
  showGlyph?: boolean;
}

export function portraitStateForAgent(
  agent: Pick<Agent, "stress" | "afflictionState">,
): PortraitState {
  if (agent.afflictionState.kind !== "none") return "afflicted";
  if (agent.stress >= 8) return "danger";
  if (agent.stress >= 6) return "warn";
  return "normal";
}

function portraitGlyphForAgent(
  agent: Pick<Agent, "stress" | "morale" | "afflictionState">,
): PortraitGlyph | null {
  if (agent.afflictionState.kind !== "none")
    return { glyph: "×", kind: "glyph-afflicted" };
  if (agent.stress >= 8) return { glyph: "!", kind: "glyph-threshold" };
  if (agent.morale > 80) return { glyph: "↑", kind: "glyph-resolve" };
  return null;
}

export function Portrait({
  agent,
  size = "medium",
  state,
  showGlyph = false,
}: PortraitProps): JSX.Element {
  const resolvedState = state ?? portraitStateForAgent(agent);
  const classes = [
    "portrait",
    size === "small" ? "small" : null,
    resolvedState !== "normal" ? `portrait-${resolvedState}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const glyphInfo = showGlyph ? portraitGlyphForAgent(agent) : null;

  return (
    <div className={classes} aria-label={`${agent.name} portrait`}>
      {agentInitials(agent.name)}
      {glyphInfo && (
        <span className={`corner-glyph ${glyphInfo.kind}`}>
          {glyphInfo.glyph}
        </span>
      )}
    </div>
  );
}
