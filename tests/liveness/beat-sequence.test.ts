import { describe, expect, it } from "vitest";
import {
  createBeatSequenceRunner,
  finalBeatFrame,
  planBeatSequence,
  type BeatSequenceScheduler,
} from "../../src/liveness/beatSequence.js";

function manualScheduler(): BeatSequenceScheduler & { runAll(): void } {
  const scheduled = new Map<number, () => void>();
  let nextHandle = 0;

  return {
    set: (_delayMs, callback) => {
      const handle = nextHandle++;
      scheduled.set(handle, callback);
      return handle;
    },
    clear: (handle) => scheduled.delete(handle as number),
    runAll: () => {
      [...scheduled.entries()]
        .sort(([left], [right]) => left - right)
        .forEach(([handle, callback]) => {
          scheduled.delete(handle);
          callback();
        });
    },
  };
}

const beats = [
  { id: "commit", durationMs: 120, liveMessage: "Choice committed." },
  { id: "impact", durationMs: 240, liveMessage: "Resources changed." },
  { id: "settled", durationMs: 0, liveMessage: "Outcome settled." },
] as const;

describe("planBeatSequence", () => {
  it("compiles semantic beats into deterministic transition offsets", () => {
    const plan = planBeatSequence(beats);

    expect(plan.finalAtMs).toBe(360);
    expect(plan.beats.map((beat) => [beat.id, beat.startsAtMs])).toEqual([
      ["commit", 0],
      ["impact", 120],
      ["settled", 360],
    ]);
  });

  it("rejects duplicate ids and invalid durations", () => {
    expect(() =>
      planBeatSequence([
        { id: "same", durationMs: 1 },
        { id: "same", durationMs: 1 },
      ]),
    ).toThrow("Beat ids must be unique");
    expect(() => planBeatSequence([{ id: "bad", durationMs: -1 }])).toThrow(
      "finite non-negative",
    );
  });

  it("collapses directly to the final accessible frame", () => {
    expect(finalBeatFrame(planBeatSequence(beats))).toEqual({
      status: "complete",
      activeBeatId: "settled",
      completedBeatIds: ["commit", "impact"],
      liveMessage: "Outcome settled.",
      isFinal: true,
    });
  });
});

describe("createBeatSequenceRunner", () => {
  it("emits the initial beat and every scheduled transition", () => {
    const scheduler = manualScheduler();
    const frames: string[] = [];
    createBeatSequenceRunner(
      planBeatSequence(beats),
      (frame) => frames.push(frame.activeBeatId ?? "idle"),
      scheduler,
    );

    scheduler.runAll();
    expect(frames).toEqual(["commit", "impact", "settled"]);
  });

  it("cancels all pending transitions without emitting stale frames", () => {
    const scheduler = manualScheduler();
    const frames: string[] = [];
    const runner = createBeatSequenceRunner(
      planBeatSequence(beats),
      (frame) => frames.push(frame.activeBeatId ?? "idle"),
      scheduler,
    );

    runner.cancel();
    scheduler.runAll();
    expect(frames).toEqual(["commit"]);
  });

  it("skip cancels pending transitions and emits the final state once", () => {
    const scheduler = manualScheduler();
    const frames: string[] = [];
    const runner = createBeatSequenceRunner(
      planBeatSequence(beats),
      (frame) => frames.push(frame.activeBeatId ?? "idle"),
      scheduler,
    );

    runner.skip();
    runner.skip();
    scheduler.runAll();
    expect(frames).toEqual(["commit", "settled"]);
  });

  it("does not re-announce a sequence that already reached its final beat", () => {
    const scheduler = manualScheduler();
    const frames: string[] = [];
    const runner = createBeatSequenceRunner(
      planBeatSequence([{ id: "settled", durationMs: 0 }] as const),
      (frame) => frames.push(frame.liveMessage || frame.activeBeatId || "idle"),
      scheduler,
    );

    runner.skip();
    expect(frames).toEqual(["settled"]);
  });
});
