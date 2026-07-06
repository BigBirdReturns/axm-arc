import { useEffect, useRef } from "react";

/**
 * Native <dialog> as a modal. The element shows modally on mount (top layer,
 * focus trap, Escape-to-cancel all come from the platform — the things the
 * old hand-rolled backdrops couldn't provide). Escape fires "cancel"; we
 * preventDefault and delegate to onClose so the OWNER unmounts the dialog
 * (React state stays the single source of truth for open/closed).
 *
 * Background scroll-locking is NOT included: <dialog> does not lock the
 * page behind it, so components that locked body scroll before keep doing so.
 */
export function useModalDialog(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d.addEventListener("cancel", onCancel);
    return () => {
      d.removeEventListener("cancel", onCancel);
      if (d.open) d.close();
    };
  }, [onClose]);
  return ref;
}
