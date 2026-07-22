/**
 * Rubber-stamp acknowledgement for a resolved, engine-applied docket.
 * Pure presentation: consumers provide the resolved state; this component does
 * not decide, persist, or manufacture a precedent.
 */
export function AttendedStamp({
  show,
  label = "ATTENDED",
  className = "",
}: {
  show: boolean;
  label?: string;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={`attended-stamp${show ? " show" : ""}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}
