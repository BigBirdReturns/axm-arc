import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion.js";

export interface BeatDefinition<Id extends string = string> {
  /** Stable semantic id; presentation code should branch on this, not time. */
  id: Id;
  /** How long this beat remains active before the next beat begins. */
  durationMs: number;
  /** Complete sentence suitable for a polite aria-live region. */
  liveMessage?: string;
}

export interface PlannedBeat<Id extends string = string>
  extends BeatDefinition<Id> {
  index: number;
  startsAtMs: number;
  endsAtMs: number;
  isFinal: boolean;
}

export interface BeatSequencePlan<Id extends string = string> {
  beats: readonly PlannedBeat<Id>[];
  /** Time at which the final beat becomes active. */
  finalAtMs: number;
}

export type BeatSequenceStatus = "idle" | "running" | "complete";

export interface BeatSequenceFrame<Id extends string = string> {
  status: BeatSequenceStatus;
  activeBeatId: Id | null;
  completedBeatIds: readonly Id[];
  liveMessage: string;
  isFinal: boolean;
}

/**
 * Compiles authored beats into deterministic offsets. The final beat's
 * duration is intentionally not part of finalAtMs: reaching it is completion,
 * and the final visual state remains mounted for its owner to dismiss.
 */
export function planBeatSequence<Id extends string>(
  definitions: readonly BeatDefinition<Id>[],
): BeatSequencePlan<Id> {
  if (definitions.length === 0) {
    return { beats: [], finalAtMs: 0 };
  }

  const seen = new Set<string>();
  let cursor = 0;
  const beats = definitions.map((definition, index) => {
    if (seen.has(definition.id)) {
      throw new Error(`Beat ids must be unique: ${definition.id}`);
    }
    seen.add(definition.id);

    if (!Number.isFinite(definition.durationMs) || definition.durationMs < 0) {
      throw new Error(
        `Beat duration must be a finite non-negative number: ${definition.id}`,
      );
    }

    const startsAtMs = cursor;
    const isFinal = index === definitions.length - 1;
    const endsAtMs = startsAtMs + definition.durationMs;
    if (!isFinal) cursor = endsAtMs;

    return {
      ...definition,
      index,
      startsAtMs,
      endsAtMs,
      isFinal,
    };
  });

  return { beats, finalAtMs: cursor };
}

export function frameForBeat<Id extends string>(
  plan: BeatSequencePlan<Id>,
  index: number,
): BeatSequenceFrame<Id> {
  const beat = plan.beats[index];
  if (!beat) {
    return {
      status: "idle",
      activeBeatId: null,
      completedBeatIds: [],
      liveMessage: "",
      isFinal: false,
    };
  }

  return {
    status: beat.isFinal ? "complete" : "running",
    activeBeatId: beat.id,
    completedBeatIds: plan.beats.slice(0, index).map((item) => item.id),
    liveMessage: beat.liveMessage ?? "",
    isFinal: beat.isFinal,
  };
}

export function finalBeatFrame<Id extends string>(
  plan: BeatSequencePlan<Id>,
): BeatSequenceFrame<Id> {
  return frameForBeat(plan, plan.beats.length - 1);
}

export interface BeatSequenceScheduler {
  set(delayMs: number, callback: () => void): unknown;
  clear(handle: unknown): void;
}

const browserScheduler: BeatSequenceScheduler = {
  set: (delayMs, callback) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface BeatSequenceRunner {
  cancel(): void;
  skip(): void;
}

/**
 * Runs a plan through an injectable scheduler. Cancellation is idempotent;
 * skip cancels every pending transition before emitting the final frame.
 */
export function createBeatSequenceRunner<Id extends string>(
  plan: BeatSequencePlan<Id>,
  onFrame: (frame: BeatSequenceFrame<Id>) => void,
  scheduler: BeatSequenceScheduler = browserScheduler,
): BeatSequenceRunner {
  const handles: unknown[] = [];
  let stopped = plan.beats.length === 0;

  const cancel = (): void => {
    if (stopped) return;
    stopped = true;
    handles.splice(0).forEach((handle) => scheduler.clear(handle));
  };

  if (plan.beats.length > 0) {
    const firstFrame = frameForBeat(plan, 0);
    onFrame(firstFrame);
    if (firstFrame.isFinal) stopped = true;
    plan.beats.slice(1).forEach((beat) => {
      handles.push(
        scheduler.set(beat.startsAtMs, () => {
          if (stopped) return;
          const frame = frameForBeat(plan, beat.index);
          onFrame(frame);
          if (frame.isFinal) stopped = true;
        }),
      );
    });
  }

  return {
    cancel,
    skip: () => {
      if (stopped) return;
      stopped = true;
      handles.splice(0).forEach((handle) => scheduler.clear(handle));
      onFrame(finalBeatFrame(plan));
    },
  };
}

const IDLE_FRAME: BeatSequenceFrame<string> = {
  status: "idle",
  activeBeatId: null,
  completedBeatIds: [],
  liveMessage: "",
  isFinal: false,
};

export interface UseBeatSequenceOptions {
  active?: boolean;
  /** Increment/change to intentionally replay the same beat definitions. */
  sequenceKey?: string | number;
  /** Primarily for deterministic hosts/tests; defaults to the reactive hook. */
  reducedMotion?: boolean;
}

export interface UseBeatSequenceResult<Id extends string>
  extends BeatSequenceFrame<Id> {
  /** Immediately cancels pending motion and exposes the final truthful state. */
  skip(): void;
}

/**
 * React adapter for the pure runner. Definitions should be memoized by callers.
 * Unmount, deactivation, definition changes, and reduced-motion changes all
 * cancel pending callbacks before a replacement sequence can begin.
 */
export function useBeatSequence<Id extends string>(
  definitions: readonly BeatDefinition<Id>[],
  options: UseBeatSequenceOptions = {},
): UseBeatSequenceResult<Id> {
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = options.reducedMotion ?? systemReducedMotion;
  const active = options.active ?? true;
  const plan = useMemo(() => planBeatSequence(definitions), [definitions]);
  const [frame, setFrame] = useState<BeatSequenceFrame<Id>>(
    IDLE_FRAME as BeatSequenceFrame<Id>,
  );
  const runnerRef = useRef<BeatSequenceRunner | null>(null);

  useEffect(() => {
    runnerRef.current?.cancel();
    runnerRef.current = null;

    if (!active || plan.beats.length === 0) {
      setFrame(IDLE_FRAME as BeatSequenceFrame<Id>);
      return;
    }

    if (reducedMotion) {
      setFrame(finalBeatFrame(plan));
      return;
    }

    const runner = createBeatSequenceRunner(plan, setFrame);
    runnerRef.current = runner;
    return () => runner.cancel();
  }, [active, options.sequenceKey, plan, reducedMotion]);

  const skip = useCallback(() => {
    if (!active || plan.beats.length === 0) return;
    if (runnerRef.current) {
      runnerRef.current.skip();
      runnerRef.current = null;
    } else {
      setFrame(finalBeatFrame(plan));
    }
  }, [active, plan]);

  return { ...frame, skip };
}
