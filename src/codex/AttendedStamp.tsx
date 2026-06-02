/**
 * <AttendedStamp> — rubber-stamp affordance lifted from
 * docs/digest-prototype/situation-room.css (`stampIn` keyframe).
 *
 * Pure presentation. Position absolute, anchored against the nearest
 * positioned ancestor (the docket card in the prototype). Consumers
 * mount it with `show` true after a blocking decision is resolved.
 *
 * Drama-resolution wire-up is a future ticket; this component is
 * available + reachable for review per the harvest brief.
 */
export function AttendedStamp({
  show,
  label = "ATTENDED",
}: {
  show: boolean;
  label?: string;
}): JSX.Element {
  return (
    <div className={`attended-stamp${show ? " show" : ""}`} aria-hidden>
      {label}
    </div>
  );
}
