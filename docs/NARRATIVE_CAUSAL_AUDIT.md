# Narrative Causal Audit

**Status:** additive qualification authority  
**Receipt:** `axm-narrative-causal-audit/1`  
**Runtime effect:** none; the audit is a pure query over committed narrative state

## 1. Decision

Local candidate validity is necessary but insufficient for a durable continuing-story system. A candidate can fit the series constitution, use a characteristic actor method, occupy a legal rail position, and pay persistent state while still remaining detachable from everything that follows. A replacement room can therefore produce individually acceptable scenes whose accumulation has no causal shape.

AXM Arc now treats causal continuity as an inspectable estate. The audit reads the committed beat, track, and obligation ledger and reports whether prior beats remain connected to later decisions, terminal consequences, or active story frontiers. It also reports unresolved debt, stalled rails, repeated mechanisms, and cast concentration.

The audit does not generate prose, select a candidate, or mutate a run. It provides a deterministic qualification receipt that can be applied to one save, a campaign corpus, a cold-room submission, or a seed orchard.

## 2. Research basis

Narrative-planning research defines an action as causally necessary when removing it would prevent a later action or an author or character goal. Birchmeier and Ware define the causal width of a sequence as the number of causally unnecessary actions and show that lower-width ranking and pruning can improve search performance on narrative-planning benchmarks.

Source: Gage Birchmeier and Stephen G. Ware, “Speeding Up Narrative Planning with Causal Width Search and Pruning,” AIIDE 2025.  
https://ojs.aaai.org/index.php/AIIDE/article/view/36823

The current AXM implementation deliberately calls its measure **structural causal width**. A beat is structurally used when a later beat cites it as a causal parent, a later beat closes an obligation it opened, it is a declared consequence or inheritance beat, or it remains the active frontier of an open track. This is stronger than counting references and weaker than proving semantic necessity from formal preconditions and effects.

## 3. Receipt

The audit emits:

- the exact narrative-state fingerprint;
- beat, track, and obligation counts;
- structural causal width and the exact loose beat IDs;
- a causal receipt for every beat;
- stalled open tracks;
- terminal tracks that still carry open obligations;
- overdue and high-pressure obligations;
- the longest consecutive run of one recipe;
- maximum actor concentration across committed beats;
- deterministic findings with severity, subject, detail, and related IDs;
- one pass or fail result, where only structural integrity errors fail the receipt.

The per-beat receipt records its parent and child beats, obligations opened and closed, terminal role, active-frontier role, and whether any of those structures currently make the beat part of the continuing causal estate.

## 4. Integrity errors

The current audit fails on conditions that indicate a corrupted or falsely closed narrative record:

- a causal parent does not exist;
- a beat cites a parent that is not prior in sequence;
- an obligation cites an absent opening or closing beat;
- a resolved or inherited track still retains open obligations.

Warnings identify quality and continuity risk without making universal aesthetic claims:

- an old beat has no structural use;
- an open track has not advanced within the configured interval;
- an obligation is overdue;
- one recipe appears too many times consecutively;
- one actor occupies too much of the committed beat estate.

High-pressure obligations are notices because pressure may be intentional. The receipt makes them visible so that a story room can choose whether to close, intensify, transfer, breach, or inherit them.

## 5. Why terminality belongs to the beat

The audit recognizes terminality only when the beat declares `consequence` or `inherit`. A track status cannot relabel an establishing or pressure beat as an ending. The commit authority already requires a terminal beat before resolving or inheriting a track; the audit preserves that law when inspecting imported, hand-assembled, or historically migrated state.

This prevents a replacement room from closing continuity debt administratively while leaving the causal work undone.

## 6. Production use

### Cold-room qualification

A new team receives the constitution, source plane, reference ledger, and qualification corpus. Its candidate material is compiled, sorted, committed into bounded scenario states, and then audited. A submission may pass every local identity test and still fail the corpus because it leaves detachable beats, terminal debt, repeated mechanisms, or one actor carrying the entire story.

### Seed orchard

A seed orchard runs many deterministic campaigns and aggregates receipts. The useful outputs are not transcript volume but distributions:

- width by campaign phase;
- age and pressure of unresolved obligations;
- track stall frequency;
- recipe runs and dead recipes;
- cast concentration;
- terminal debt;
- which identity anchors create durable continuations rather than one-off spectacle.

### Editorial review

The receipt allows an editor to ask a precise question about a beat. The question is no longer whether the scene feels important. It is which later choice, obligation, consequence, or inherited state currently depends upon it.

## 7. Current boundary

Structural causal width cannot prove that a child beat truly requires its declared parent. A weak author could cite a prior beat without using any of its semantic effects. The next authority train must therefore add machine-readable narrative preconditions and effects, then perform a counterfactual replay:

```text
remove candidate beat
  -> recompute downstream preconditions
  -> determine which later beat, obligation, goal, or terminal state becomes unreachable
```

That later measure can claim semantic causal necessity. The present receipt does not.

The audit also does not yet prove actor rationality, limited knowledge, conflict quality, novelty, or audience comprehension. Those are separate rails. Conflating them into one score would make failures difficult to diagnose and editorial preferences difficult to govern.

## 8. Acceptance

The causal audit train is accepted when:

1. a closed two-beat obligation chain has structural width zero;
2. an old detachable beat is reported as width;
3. the last beat of an open track remains a valid active frontier;
4. missing and non-prior causal references fail;
5. terminal tracks cannot retain open obligations;
6. overdue and high-pressure obligations remain separately visible;
7. recipe repetition and actor concentration are deterministic;
8. policy thresholds are non-negative integers and actor share is bounded to 1000 permille;
9. collection order does not affect the receipt;
10. the complete Arc test, product parity, and supply-chain gates remain green.

## 9. Control question

For every committed beat older than the grace window, which later decision, obligation, consequence, inherited state, or active frontier would become impossible or materially different if that beat had never occurred?
