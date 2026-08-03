# RFC: Canon Reconciliation Floor

## Classification

The Canon Reconciliation Floor is the review authority between a non-authoritative
model-recall estate and the exact-source Canon Constraint Bible. It does not make
model memory more trustworthy, extract copyrighted prose into Git, or permit a
high-confidence recalled item to become canon. It converts source review into a
deterministic transaction whose inputs, evidence, mappings, refusals, and
promotions can be reproduced.

The portable formats are:

```text
axm-canon-reconciliation-work-order/1
axm-canon-evidence-bundle/1
axm-canon-review-decision-set/1
axm-canon-reconciliation-receipt/1
```

## Actors and mechanism

The recall estate supplies provisional candidates and reconciliation keys. An
exact source transaction supplies a cryptographically identified source, bounded
locators, and normalized evidence records. A reviewer supplies explicit
decisions. The compiler supplies the receipt.

The actors have deliberately different powers:

- the language model may propose a candidate and routing hint;
- an extractor may produce a machine-extracted evidence record;
- a human reviewer may mark an evidence record reviewed;
- a review decision may map recall candidates to reviewed evidence;
- the reconciliation compiler may admit or refuse the mapping;
- only a later promotion transaction may convert reviewed evidence into the
  authoritative canon bible.

No actor may substitute for another. A model confidence score is not a source
digest. A source digest is not a locator. A locator is not a reviewed
proposition. A reviewed proposition is not automatically a complete historical
branch.

## Work-order law

`buildCanonReconciliationWorkOrder` freezes a review surface around one or more
source hints. Direct candidates name the requested source family. Context
candidates are admitted only through shared reconciliation keys, with a bounded
context depth. The work order records direct and contextual candidate IDs,
connected reconciliation clusters, domain counts, review lanes, deterministic
priority, and one exact fingerprint.

The first ASOIAF floor precomputes work orders for all five published main
novels:

```text
AGOT
ACOK
ASOS
AFFC
ADWD
```

Each work order therefore tells the source-ingestion pass what the existing
recall estate expects to encounter, what adjacent claims may be affected, and
which low-confidence or cross-domain clusters require explicit adjudication.

Priority is scheduling metadata rather than truth weight. Foundational entity,
lineage, chronology, and actor-knowledge records rise because later records
depend upon them. Disputed and high-leverage clusters rise because a single
source decision may split, merge, or invalidate many recalled records.

## Evidence law

An evidence bundle contains exact sources, locators, and normalized records.

Every source must carry:

- universe and continuity identity;
- title and edition or version;
- custody class;
- one or more source-hint routes;
- a lowercase SHA-256 digest;
- exact file size.

Every evidence record must cite at least one locator belonging to its own
source. Locators may use byte, page, chapter, line, timestamp, or structured
record coordinates. A record may remain `machine-extracted`, but it cannot be
promoted until it is `reviewed` and names the reviewer.

The evidence record, rather than the recalled candidate, supplies the normalized
object eligible for later promotion. Reconciliation keys connect the two
without allowing recall text to become evidence.

## Decision law

A review decision is one of six actions:

- `confirm`: one recalled candidate maps to one reviewed source record;
- `correct`: one recalled candidate is replaced by one reviewed source record;
- `split`: one recalled candidate is decomposed into multiple reviewed records;
- `merge`: multiple candidates in one reconciliation cluster map to one
  reviewed record;
- `reject`: source evidence disposes of one or more candidates without
  promotion;
- `defer`: the current source slice cannot decide the candidate.

Confirm, correct, split, merge, and reject require exact evidence. Defer carries
no evidence and claims no resolution. A candidate may receive only one decision
inside a transaction. Promoted records must be part of the cited evidence set,
must be human reviewed, and must share a reconciliation key with the candidate
or candidates they replace. Merge cannot cross reconciliation clusters.

The decision set is bound to the exact work-order fingerprint and exact
evidence-bundle fingerprint. Editing either input invalidates the transaction.

## Transaction and rollback

`compileCanonReconciliation` validates the complete transaction before
publishing any resolution. A malformed source digest, missing locator, unknown
record, unreviewed promotion, duplicate decision, cross-cluster merge,
reconciliation-key mismatch, or stale fingerprint causes whole-transaction
refusal.

On refusal:

```text
resolutions          []
promotedRecordIds    []
pendingCandidateIds  all work-order candidates
passed               false
```

This prevents a valid decision from slipping through beside an invalid one.
A passed transaction may still be incomplete. Pending and deferred candidates
remain explicit, and the receipt separates review coverage from actual
resolution.

## ASOIAF first source transaction

The first exact source should be the user's edition of *A Game of Thrones*.
Before any chapter parsing, the source file receives:

```text
source id
edition and format
file size
sha256 digest
custody location
locator scheme
```

Extraction then produces chapter, viewpoint, entity, relation, movement,
knowledge, material, and magical-observation records. Those records enter as
`machine-extracted`. Review converts accepted records to `reviewed`, after which
the AGOT work order can be adjudicated.

The expected outcomes are not limited to confirmation. The source pass should
find recalled aliases that need merging, broad claims that need splitting,
continuity blends that need correction, unsupported theories that need
rejection, and unresolved questions that remain deferred.

## Qualification

The synthetic fixture proves:

- deterministic work-order construction under packet and source-hint reordering;
- bounded cross-source context expansion;
- five precomputed ASOIAF main-novel work orders;
- exact source digest and locator enforcement;
- evidence-only promotion;
- source-backed split and merge;
- cross-cluster merge refusal;
- duplicate-decision rollback;
- explicit deferral without false closure;
- order-independent reconciliation receipts;
- input immutability.

The permanent workflow runs strict TypeScript, the focused reconciliation suite,
the complete Arc regression suite, and the production build. It retains an
exact qualification artifact containing the candidate SHA, logs, and authority
boundary.

## Evidence boundary

The evidence tier is mechanism qualification using synthetic evidence plus a
non-authoritative ASOIAF recall estate. The venue is the stacked reconciliation
draft. The target is the review transaction, not the truth of any recalled
ASOIAF claim. The upside is that source ingestion becomes a bounded adjudication
process with reversible mappings. The downside is that a broad recall estate can
create review load and misleading source expectations. The failure mode is any
path that promotes recall content, extractor output, or a source-hint label
without exact source identity, bounded locator custody, human review, and a
passing reconciliation receipt.

The control question is whether every authoritative record can show which exact
source bytes supported it, which recalled candidates it confirmed, corrected,
split, merged, or rejected, who reviewed it, and which unresolved questions
remain outside the claim.
