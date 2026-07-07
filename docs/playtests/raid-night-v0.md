# Raid Night v0 — operator playtest protocol

A 15-minute self-playtest of the current Raid Night wipe→diagnosis→fix→re-pull
loop. One cartridge, one boss (The Hollow Choir), no persistence. This is the
gate the roadmap turns on — see "What this decides" at the bottom.

## What this measures

Two things, and only these:

1. **Pull pressure.** After a wipe, do you *want* to pull again — or do you
   reach a moment where you stop caring? Where and why you stop caring is the
   single most important thing to capture.
2. **Decision-surface honesty.** Before you apply a fix, you will **predict**
   whether it clears, helps, or doesn't matter. Then you compare your
   prediction to the "Last pull" banner on the next pull. If your predictions
   keep matching, the surface is legible and honest. If they keep missing, the
   surface is lying or unreadable — and that's the bug, not your play.

You are not testing whether you can win. You are testing whether the game tells
you the truth clearly enough that you keep choosing to engage.

## The one rule

**Read only what the UI shows you.** No code, no logs, no dev tools, no asking
me. If you can't answer a question from the screen, that *is* the finding —
write it in "Confusion point." The whole point is whether the surface stands on
its own.

## Setup (about 1 minute)

```bash
cd axm-arc
npm run dev
```

Open the URL it prints (if the page is blank, append `/axm-arc/game/` to it).
On the title screen, click **Raid Night**. Start a stopwatch for 15 minutes.

## The loop

Do this, out loud or on paper, once per pull:

1. **Start Raid Night.** Glance at the roster — don't optimize it. Just pull.
2. **Pull until the first wipe.** (Click *Pull the Boss*. It may take a couple.)
3. **Read the diagnosis** — top to bottom, no scrolling past anything: the cause
   chip, "Why we wiped," the bottleneck, the three fixes.
4. **Say what failed** — in your own words, before you trust the UI.
5. **Say the bottleneck** — who or what.
6. **Choose one fix** — read all three, pick one. Note *why* that one.
7. **Predict** — before applying: will it **clear**, **help** (move the number,
   not enough), or **not matter**? Commit to one word.
8. **Apply it.** Read the "Changed before next pull" receipt. Does it match what
   you thought you were doing?
9. **Re-pull.**
10. **Compare** your prediction to the **"Last pull"** banner. Match or miss?
11. **Repeat** from step 3 — until you clear, **or until you stop caring.** The
    moment you stop caring, stop, and write down exactly what you were looking
    at when the wanting-to-pull-again went away.

Fill one notes block (below) per pull. Copy the block as many times as you need.
Don't overthink it — one line per field is plenty.

---

## Notes template

Copy this block once per pull. Keep it fast.

```
── Pull # ___
Boss / result:            (e.g. The Hollow Choir / WIPE 0.6% · or CLEARED)
What I thought failed:
What the UI said failed:
Fix chosen:               (gear / train / rest / rally / swap / tradeoff — + which)
Why I chose it:
Prediction:               (CLEAR / HELP / NOT MATTER)  ← commit BEFORE applying
What the "Last pull" banner said:
Prediction matched?       (yes / no)
Did I want one more pull?  (yes / no / meh)
Confusion point:          (anything the screen didn't answer — blank is fine)
One-sentence verdict:      (this pull's feel)
```

---

## Session wrap-up (the acceptance answer)

After you stop — cleared, bored, or out of time — answer these three:

```
Did the loop make me want to keep pulling?     (yes / no / mixed)
Where did I stop caring, and what was on screen when it happened?
How often did my prediction match the "Last pull" banner?   (roughly __/__)
```

## What this decides

- **If yes — the loop makes you want to keep pulling:** the decision surface has
  earned it, and the next build is the **tier-2 persistence RFC** (the guild
  remembering wipes, veterans, grudges, and gear across nights — the Guild Hall
  and Expansion Archive layer).
- **If no — you stopped caring:** the next build is **not** persistence. It is
  fixing the decision surface at the exact spot you stopped caring. Your
  "where did I stop caring" note is the spec for that fix.
- **If your predictions kept missing** the "Last pull" banner: that's a
  correctness/honesty bug in the diagnosis, and it jumps the queue ahead of
  either branch — a surface that reads well but lies is worse than one that
  reads poorly.

Hand the filled notes back and the next move writes itself.
