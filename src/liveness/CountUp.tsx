import { useCountUp } from "./useCountUp.js";

/**
 * Renders a number that counts up/down to `value` over `durationMs`
 * (ease-out cubic, default 400ms) instead of snapping. Respects the
 * reduce-motion accessibility contract. Arc-agnostic liveness primitive.
 */
export default function CountUp({
  value,
  durationMs,
  className,
}: {
  value: number;
  durationMs?: number;
  className?: string;
}): JSX.Element {
  const display = useCountUp(value, { durationMs });
  return <span className={className}>{display}</span>;
}
