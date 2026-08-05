# Aperture timed-media extension

`axm-canonical-story-timed-media/1` is an additive Arc authority that binds reviewed canonical positions, facts, causal edges, and reveals to one exact `axm-canonical-story/1` identity and SHA-256. It does not alter the fixed story path or introduce choices.

The extension authority is deliberately closed. Narrative meaning belongs to Arc. Provider clocks, viewer state, and playback control are fixed to `none`. Aperture may combine an Arc-verified timed package with provider observations and a personal ledger, but those observations cannot flow back into Arc law.

Every position uses canonical microseconds and must be positive, ordered, and non-overlapping. Its episode, chapter, and optional panel references must exist in the canonical story. Every fact, causal edge, and reveal cites reviewed source receipts. Causal endpoints and reveal positions must exist, and a fact cannot cause itself.

A consumer calls `parseCanonicalStoryTimedMedia(value, story, expectedStoryDigest)` or `readCanonicalStoryTimedMediaExtension(arc, story, expectedStoryDigest)`. A changed story digest, unreviewed source, foreign panel, unknown fact, overlap, provider-time field, viewer-state field, or playback authority is refused rather than repaired.

This module does not verify provider editions, map provider time, infer viewer knowledge, select a segment, or issue a seek. Those functions remain in AXM Aperture.
