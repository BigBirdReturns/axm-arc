import { useEffect, useRef, useState } from "react";

/**
 * Liveness primitive: a resource bar that pulses (via the .pulse class
 * from styles.css — the `barPulse` keyframe lifted from digest-prototype)
 * when its value crosses a threshold. Reduced-motion is honored by the
 * keyframe-side guard, not here.
 *
 * Crossing semantics: pulse fires when the value steps from "safe" to
 * "tripped" between renders. We treat the inverse direction (going safe)
 * as silent — the alert is the news.
 *
 * Drop-in replacement for the existing markup:
 *   <div className="bar stress"><div className="fill" style={{...}} /></div>
 */
export function ThresholdBar({
  value,
  max,
  kind,
  threshold,
  direction,
}: {
  value: number;
  /** Maximum value used for the fill width percentage. */
  max: number;
  /** CSS modifier added after `bar ` — e.g. "stress", "morale". */
  kind: string;
  /** Threshold to cross. */
  threshold: number;
  /**
   * "above" → tripped when value >= threshold (stress climbing into danger).
   * "below" → tripped when value <= threshold (morale falling into low).
   */
  direction: "above" | "below";
}): JSX.Element {
  const prev = useRef(value);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const wasTripped = direction === "above" ? prev.current >= threshold : prev.current <= threshold;
    const isTripped = direction === "above" ? value >= threshold : value <= threshold;
    if (isTripped && !wasTripped) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 800);
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value, threshold, direction]);

  const fillPct = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className={`bar ${kind}${pulse ? " pulse" : ""}`}>
      <div className="fill" style={{ width: `${fillPct}%` }} />
    </div>
  );
}
