import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getReducedMotionSnapshot,
  subscribeToReducedMotion,
} from "../../src/liveness/useReducedMotion.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("reduced-motion store", () => {
  it("combines the OS preference and in-app html class", () => {
    let mediaReduced = false;
    let classReduced = false;
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: mediaReduced }),
    });
    vi.stubGlobal("document", {
      documentElement: {
        classList: { contains: () => classReduced },
      },
    });

    expect(getReducedMotionSnapshot()).toBe(false);
    mediaReduced = true;
    expect(getReducedMotionSnapshot()).toBe(true);
    mediaReduced = false;
    classReduced = true;
    expect(getReducedMotionSnapshot()).toBe(true);
  });

  it("reacts to both signals and disconnects both subscriptions", () => {
    let mediaListener: (() => void) | undefined;
    let mutationListener: MutationCallback | undefined;
    const removeMediaListener = vi.fn();
    const disconnect = vi.fn();
    const observe = vi.fn();
    const onChange = vi.fn();

    vi.stubGlobal("window", {
      matchMedia: () => ({
        matches: false,
        addEventListener: (_event: string, listener: () => void) => {
          mediaListener = listener;
        },
        removeEventListener: removeMediaListener,
      }),
    });
    vi.stubGlobal("document", {
      documentElement: {
        classList: { contains: () => false },
      },
    });
    vi.stubGlobal(
      "MutationObserver",
      class {
        constructor(listener: MutationCallback) {
          mutationListener = listener;
        }

        observe = observe;
        disconnect = disconnect;
      },
    );

    const unsubscribe = subscribeToReducedMotion(onChange);
    mediaListener?.();
    mutationListener?.(
      [{ attributeName: "class" }] as MutationRecord[],
      {} as MutationObserver,
    );
    mutationListener?.(
      [{ attributeName: "data-theme" }] as MutationRecord[],
      {} as MutationObserver,
    );

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(observe).toHaveBeenCalledWith(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    unsubscribe();
    expect(removeMediaListener).toHaveBeenCalledWith("change", onChange);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
