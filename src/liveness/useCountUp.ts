import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion.js";

/** Ease-out cubic: fast start, gentle settle. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates a number toward `value`, counting up/down over `durationMs`
 * (default 400) with an ease-out cubic. Intermediate values are rounded
 * to integers (these are gold / reputation / token counts).
 *
 * On first mount the target value is returned immediately — no intro
 * animation from zero. Respects reduced-motion (snaps instantly).
 */
export function useCountUp(value: number, opts?: { durationMs?: number }): number {
  const durationMs = opts?.durationMs ?? 400;
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | null>(null);
  // Track the last value we rendered so animations start from it.
  const fromRef = useRef(value);
  const mountedRef = useRef(false);

  useEffect(() => {
    // First mount: snap to value, no animation.
    if (!mountedRef.current) {
      mountedRef.current = true;
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const to = value;

    if (from === to) {
      return;
    }

    if (reducedMotion || durationMs <= 0) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }

    const start =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const tick = (now: number): void => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const current = from + (to - from) * easeOutCubic(t);
      if (t >= 1) {
        fromRef.current = to;
        setDisplay(to);
        rafRef.current = null;
      } else {
        const rounded = Math.round(current);
        // Keep the baseline in sync with what's on screen so that if this
        // animation is interrupted, the next one continues from here.
        fromRef.current = rounded;
        setDisplay(rounded);
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [value, durationMs, reducedMotion]);

  return display;
}
