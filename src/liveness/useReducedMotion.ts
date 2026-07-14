import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Reads both accessibility signals used by Arc presentation:
 * the operating-system preference and the in-app class on <html>.
 */
export function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") return false;

  const mediaReduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches;
  const classReduced =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("reduce-motion");

  return mediaReduced || classReduced;
}

/**
 * Subscribes to both sources so changing either preference while Arc is open
 * immediately collapses active motion to its final state.
 */
export function subscribeToReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia(REDUCED_MOTION_QUERY)
      : null;

  media?.addEventListener?.("change", onChange);

  const observer =
    typeof document !== "undefined" && typeof MutationObserver !== "undefined"
      ? new MutationObserver((records) => {
          if (records.some((record) => record.attributeName === "class")) {
            onChange();
          }
        })
      : null;

  observer?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => {
    media?.removeEventListener?.("change", onChange);
    observer?.disconnect();
  };
}

/** Reactive form of Arc's OS + in-app reduced-motion contract. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}
