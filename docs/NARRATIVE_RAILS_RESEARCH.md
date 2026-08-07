# Narrative Rails Research Ledger

**Purpose:** identify production and computational structures that preserve a continuing universe through team turnover without requiring every future story to be individually supervised by the original room.

## 1. Evidence ledger

The evidence tier is mixed. Computational mechanisms are drawn primarily from published research and official tool documentation. The television-production case is drawn from direct interviews and trade coverage rather than internal American Dad production documents. The venue for technical certification is the AXM repository's deterministic tests and full campaign simulations. The target is the claim that reusable rules, role binding, saliency, causal memory, and qualification can preserve a show's identity while allowing a largely new team to produce new material. The upside is a portable authoring system that reduces dependency on tacit institutional memory. The downside is overfitting a creative practice into rigid schemas. The principal failure mode is a system that reproduces recognizable surface traits while losing causal character behavior.

## 2. American Dad as a handoff case

American Dad began with concentrated creative control. In a 2005 Animation World Network interview, Mike Barker said that plot and series-direction decisions passed through Barker and Matt Weitzman, while the show already employed a staff of 17 writers. This separates constitutional authority from the larger production room.

Source: Dan Sarto, “American Dad Touchdown,” Animation World Network, 2005.  
https://www.awn.com/animationworld/american-dad-touchdown

The show later demonstrated a substantial personnel replacement. Matt Weitzman described the TBS transition as a near restart in which all but one writer had moved on and he and Brian Boyle built what he called “American Dad 2.0.” The relevant fact is not that continuity required no original authority. It is that a very small continuity core could induct a substantially new room.

Source: Luke Gralia, “‘American Dad’ Co-Creator Talks Importance of Perseverance After Show’s Two Cancelations,” Men’s Journal, 2026.  
https://www.mensjournal.com/entertainment/american-dad-co-creator-talks-importance-of-perseverance-after-shows-two-cancelations-exclusive

Weitzman described the resulting balance more explicitly in a 2016 interview: new writers brought new perspectives, while enough people remained from the beginning to preserve the kind of show the team intended to make. New writers adapted to that base, and the show remained recognizably the same. This is the institutional pattern AXM needs to encode.

Source: Daniel Kurland, “American Dad interview: Matt Weitzman & Dee Bradley Baker on episode 200,” Den of Geek, 2016.  
https://www.denofgeek.com/tv/american-dad-interview-matt-weitzman-dee-bradley-baker-on-episode-200/

The current room uses rotating functional pods. Weitzman described 15 to 17 writers grouped into pods whose assignments rotate among story breaking, episode rewriting, and joke rooms. The structure distributes production work without treating every writer as an independent end-to-end showrunner.

Source: Tom McLean, “The Epochal Success and Inexhaustible Creativity of American Dad!,” Animation World Network, 2022.  
https://www.awn.com/animationworld/epochal-success-and-inexhaustible-creativity-american-dad

The transfer principle is therefore:

```text
small continuity authority
  + explicit series method
  + rotating specialized production functions
  + repeated read, storyboard, and rewrite gates
  + permission for new writers to refresh the material
```

AXM should encode the series method, causal gates, and qualification memory while leaving invention and expression open to new contributors.

## 3. Reusable social mechanisms

Comme il Faut begins from the same authoring-cost problem. Individually authoring every possible social and story circumstance becomes intractable. Its proposed reduction is to author reusable and recombinable social norms and social interactions, then apply them to current character and social state.

Borrowed shape: situation recipes describe social mechanisms rather than named episodes.  
Rejected shape: a universal social ontology that supersedes cartridge-specific institutions or Story Physics.

Source: Joshua McCoy et al., “Comme il Faut: A System for Authoring Playable Social Models,” AIIDE 2011.  
https://ojs.aaai.org/index.php/AIIDE/article/view/12454

## 4. Role binding and event eligibility

Wildermyth events bind required, optional, and forbidden roles using actor aspects, relationships, thresholds, and score functions. A required role that cannot be matched removes the event from the eligible pool. Optional criteria can influence casting without becoming hard requirements.

Borrowed shape: deterministic role queries, required and forbidden tags, metric thresholds, score terms, and inspectable binding failure.  
Rejected shape: hidden random target choice as the default AXM authority.

Source: Worldwalker Games, “Targets and Scoring Guide,” Wildermyth Wiki.  
https://wildermyth.com/wiki/Targets_and_Scoring_Guide

## 5. Saliency as a pure query

Yarn Spinner separates eligibility and ranking from selection mutation. A saliency strategy receives condition pass and failure counts, condition complexity, and a unique content key. Its best and least-recently-viewed strategies combine specificity with repetition control. Its custom query method is explicitly read-only, while a separate callback records that content was actually selected.

Borrowed shape: hard eligibility first, visible specificity, freshness and repetition terms, pure query, separate commit.  
Rejected shape: default random tie-breaking. AXM uses canonical ordering after deterministic score terms.

Source: Yarn Spinner, “Saliency,” official documentation, version 3.1.  
https://yarnspinner.dev/docs/yarn/03-advanced/03-saliency/

## 6. Incremental story sifting

Winnow treats a simulation chronicle as material from which story patterns can be recognized. Its key advance is prospective and incremental sifting, so a system can detect potentially storyful sequences while they are still developing rather than only after a complete history exists.

Borrowed shape: typed facts, partial causal patterns, open obligations, and continuing opportunities that become more salient as the sequence develops.  
Rejected shape: retrospective extraction as the only story authority.

Source: Max Kreminski, Melanie Dickinson, and Michael Mateas, “Winnow: A Domain-Specific Language for Incremental Story Sifting,” AIIDE 2021.  
https://ojs.aaai.org/index.php/AIIDE/article/view/18903

Shepherd extends this direction with an incremental story-sifting drama manager that can inspect an in-progress simulation and surface narrative content or future follow-up opportunities. This supports AXM's distinction between facts produced by the engine and narrative opportunities selected by a separate authority.

Source: “Shepherd: An Incremental Story Sifting-Based Drama Manager,” AIIDE 2024.  
https://ojs.aaai.org/index.php/AIIDE/article/view/31887

## 7. Causal necessity and thread closure

Narrative-planning research on causal necessity treats actions that are required by later story outcomes as more valuable than detachable events. Loose Ends treats unresolved plot threads as an explicit management problem and assists authors in bringing multiple threads to satisfying conclusions.

Borrowed shape: causal-parent receipts, obligations as persistent open state, closure value in saliency, and terminal rail gates.  
Rejected shape: requiring the creator to author a complete global plan before the simulation runs.

Sources:

- “Causal Necessity as a Narrative Planning Step Cost Function,” AIIDE.  
  https://ojs.aaai.org/index.php/AIIDE/article/view/18888
- “Loose Ends: A Mixed-Initiative Creative Interface for Playful Storytelling,” AIIDE.  
  https://ojs.aaai.org/index.php/AIIDE/article/view/31783

## 8. Compiled source and immediate preview

Ink separates authored source from a runtime designed to slot into a game. Inky continuously compiles and previews the work, reports issues, and links errors back to exact source locations.

Borrowed shape: creator-owned source, compiled runtime projection, exact errors, and immediate stateful preview.  
Rejected shape: using dialogue-script execution as AXM's authoritative state machine.

Sources:

- Inkle, `ink`, official repository.  
  https://github.com/inkle/ink
- Inkle, `inky`, official repository.  
  https://github.com/inkle/inky

## 9. Character continuity through method

Empirical narrative research indicates that audiences infer personality from the means characters choose to pursue goals. This supports actor policies centered on characteristic methods rather than static adjective lists.

Borrowed shape: baseline, conditional, forbidden, and evidence-justified actor moves.  
Rejected shape: treating a personality label as sufficient proof that any dialogue written in the right voice is in character.

Source: “An Empirical Evaluation of Character Representation in Narratives: Modeling Personality Traits through Action Choice,” AIIDE.  
https://ojs.aaai.org/index.php/AIIDE/article/view/12917

## 10. Resulting AXM synthesis

No one external system supplies the complete solution. The durable composite is:

```text
American Dad production handoff
  -> small continuity core plus rotating specialist pods

Comme il Faut
  -> reusable social mechanisms

Wildermyth
  -> deterministic role casting and eligibility

Yarn Spinner
  -> saliency, specificity, freshness, pure query, separate selection update

Winnow and Shepherd
  -> incremental recognition of developing story opportunities

causal planning and Loose Ends
  -> parentage and obligation closure

Ink and Inky
  -> source/runtime separation and immediate authoring feedback

AXM
  -> content-addressed source, deterministic execution, exact receipts,
     custody, portable run memory, source-plane authority, and no inference
     requirement at play time
```

The control question is whether a new team can create material the old team never imagined while every accepted beat still demonstrates the universe's characteristic pressures, actor methods, causal inheritance, and persistent cost.

## 11. Causal width and detachable material

Birchmeier and Ware define causal width as the number of actions in a sequence that are not necessary for a later action or author or character goal. Their results support using lower causal width as a ranking and pruning signal in narrative planning.

Borrowed shape: audit committed beats for downstream causal use, distinguish active frontier from detached residue, and qualify long-run campaigns rather than only local scenes.  
Rejected claim: the first AXM implementation is a semantic necessity proof. It measures explicit structural dependency until preconditions and effects support counterfactual replay.

Source: Gage Birchmeier and Stephen G. Ware, “Speeding Up Narrative Planning with Causal Width Search and Pruning,” AIIDE 2025.  
https://ojs.aaai.org/index.php/AIIDE/article/view/36823

## 12. Intention, risk, and rational alternatives

Glaive requires actions to be motivated and goal-oriented toward individual character goals. Later Pareto-based narrative planning observes that merely contributing to a goal is insufficient when the same action sacrifices a more important goal or incurs unnecessary risk. It proposes selecting character policies from a Pareto front of strong and safe alternatives.

Borrowed shape: every acting character must have an inspectable intention claim, and candidate alternatives should be compared on goal progress and risk rather than accepted because they bear a characteristic voice tag.  
Rejected shape: perfectly optimal characters. AXM needs believable bounded choices, including justified mistakes, sacrifices, and intention revision.

Sources:

- Stephen Ware and R. Michael Young, “Glaive: A State-Space Narrative Planner Supporting Intentionality and Conflict,” AIIDE 2014.  
  https://ojs.aaai.org/index.php/AIIDE/article/view/12712
- Molly Siler, Mira Fisher, and Stephen G. Ware, “Pareto-Based Narrative Planning: Making NPCs More Rational,” AIIDE 2025.  
  https://ojs.aaai.org/index.php/AIIDE/article/view/36837

## 13. Knowledge, belief, and failed action

HeadSpace and related belief-compilation work show that actors can pursue intentions using limited or incorrect beliefs, fail because their model of the world is wrong, learn, and communicate. Fog of War pruning further limits available actions to people, places, and things the protagonist has discovered.

Borrowed shape: actor moves must cite facts within that actor's knowledge or belief estate; discovery and communication become explicit state transitions; failed actions can remain causally valid when the attempt was justified by the actor's beliefs.  
Rejected shape: an omniscient story room silently lending author knowledge to every character.

Sources:

- Rushit Sanghrajka, R. Michael Young, and Brandon Thorne, “HeadSpace: Incorporating Action Failure and Character Beliefs into Narrative Planning,” AIIDE 2022.  
  https://ojs.aaai.org/index.php/AIIDE/article/view/21961
- Matthew Christensen, Jennifer M. Nelson, and Rogelio E. Cardona-Rivera, “Using Domain Compilation to Add Belief to Narrative Planners,” AIIDE 2020.  
  https://ojs.aaai.org/index.php/AIIDE/article/view/7405
- Lasantha Senanayake and Stephen G. Ware, “Speeding Up Narrative Planning Using Fog of War Pruning,” AIIDE 2025.  
  https://ojs.aaai.org/index.php/AIIDE/article/view/36816

## 14. Generative models as proposal engines

PANGeA separates generative flexibility from validation and memory, reporting large accuracy improvements in its evaluated scenarios when model outputs pass through its validation system. There and Back Again similarly separates fluent language generation from formal, controllable story domains and plans.

Borrowed shape: language models may propose recipes, actor bindings, expression, or formal domains, but accepted material must compile into typed AXM authority and pass deterministic qualification.  
Rejected shape: treating model fluency or self-evaluation as the canonical execution boundary.

Sources:

- Steph Buongiorno et al., “PANGeA: Procedural Artificial Narrative Using Generative AI for Turn-Based, Role-Playing Video Games,” AIIDE 2024.  
  https://ojs.aaai.org/index.php/AIIDE/article/view/31876
- Jack Kelly et al., “There and Back Again: Extracting Formal Domains for Controllable Neurosymbolic Story Authoring,” AIIDE 2023.  
  https://ojs.aaai.org/index.php/AIIDE/article/view/27502
