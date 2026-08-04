---
date: 2026-08-04
topic: compare-view-v3
focus: third attempt at path comparison — merged spine and highlight pass both rejected
---

# Ideation: Compare view, third direction

## Codebase Context

Two shipped attempts failed the same way for opposite reasons:

- **Merged spine** (idea 1 from the 2026-08-02 ideation) — changed the
  layout too much: collapsing shared cells destroyed the row rhythm that
  makes a blueprint scannable. "Don't make any freaking sense."
- **Highlight pass** (idea 3) — changed the layout too little: dim/ring/
  badge paint over side-by-side still leaves the reader eye-scanning two
  3000px grids. Badges say THAT something differs, never WHAT or WHY.
  "Still ain't useful."

The shared post-mortem: **painting cells is not answering the question.**
A comparer asks countable, nameable things — where do paths fork and
rejoin, what does the edge case add, which lanes are affected, did copy
drift between duplicated paths. Those are answered by *enumerating*,
*compressing*, and *narrating*, not by coloring.

Standing machinery all ideas build on: `comparePathCells` (per-cell
shared/only/divergent verdicts on name-aligned step columns and
lane-aligned rows), per-path accent colors, the slices system (captioned
camera-driven frame walkthroughs), camera control, the right-side drawer,
and the planned in-app agent (BYO-key, read tools, revertible writes).

## Ranked Ideas

### 1. The Difference Ledger
**Description:** Compare opens a right-panel *list*, not a repainted
canvas. Every classifier verdict becomes a row, grouped by step (or lane),
stating the difference in words: "Step 4 · Front Stage — only in Crisis
Path", "Step 7 · PLUS App — divergent: owner and summary differ", with the
differing text quoted inline. Clicking a row flies the camera to the
cells; rows are filterable by lane/path/verdict and checkable as
reviewed. The canvas underneath stays a completely normal side-by-side.
**Rationale:** Enumeration is the direct fix for both failures — the
count, location, and nature of every difference is *stated*. Reading a
12-row list takes seconds and cannot miss anything; it also quotes the
divergent text side by side, so counterparts being 3000px apart stops
mattering. Doubles as a review workflow (check off differences as
reconciled).
**Downsides:** The list can get long on genuinely divergent paths;
needs sensible grouping and a per-field diff (content + summary + owner +
value) to be more than a badge-list in table form.
**Confidence:** 85%
**Complexity:** Low–Medium
**Status:** Unexplored

### 2. Fold the Agreement (code-diff collapse)
**Description:** Keep per-path grids side by side, but elide every run of
step columns where all selected paths agree, replacing it with a slim
pleat: "▸ 4 identical steps" (click to expand). Only divergent columns
render at full width, pulled adjacent. A 16-step scenario with 3
divergence sites becomes a screen-wide view, no panning.
**Rationale:** Attacks the real enemy — canvas width. Code review solved
this decades ago: nobody reads full files, they read hunks. Unlike the
merged spine, each path keeps its own grid, lanes, and rhythm; only
column widths change, so the failure mode of alien layout is avoided.
**Downsides:** Arrows crossing a folded region need a treatment (route
through the pleat or suppress); partial-column divergence (one lane
differs, five don't) still renders the full column.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 3. Divergence Map strip
**Description:** A thin braid/barcode strip pinned above the compare
area: one track per path, tracks visually merged where columns are
shared, split where they diverge, fork/rejoin points named. Click a
segment to fly the camera; arrow keys jump divergence to divergence. ~60px
tall, works for 2–6 paths.
**Rationale:** "Where do they fork and rejoin?" is the #1 topological
question and neither attempt answered it *as a shape*. Also serves as the
navigation scrubber the 3000px canvas has always needed in compare.
**Downsides:** An overview instrument, not an explanation — needs idea 1
or 2 underneath it to say what the differences are.
**Confidence:** 70%
**Complexity:** Medium–Low
**Status:** Unexplored

### 4. The Diff Tour (auto-generated slice)
**Description:** Compare generates a slice automatically: frame 1
overview ("paths agree on 12 of 16 steps"), then one frame per divergence
with the camera tight on that region and a templated caption ("Crisis
path adds a human callback; owner shifts to Support"), ending on the
rejoin. Next/next/next — presentable to stakeholders as-is.
**Rationale:** Converts comparison from a static-rendering problem (failed
twice) into a temporal narration problem, which the slices system was
literally built to solve. Guaranteed completeness: the stepper enumerates
every divergence, so nothing can be missed.
**Downsides:** Templated captions will read mechanical until the agent
can write them; a generated slice must not pollute the human slice list
(needs an ephemeral or clearly-labeled origin).
**Confidence:** 65%
**Complexity:** Medium
**Status:** Unexplored

### 5. Agent Divergence Brief
**Description:** Once agent mode ships, the agent reads the compared
paths (classifier output as ground truth, cell specs via read tools) and
writes a one-page brief in the drawer: prose that explains *significance*
— "identical through step 5; on payment failure the Crisis path adds a
human callback and the PLUS App lane goes silent for two steps." Every
claim is a citation chip that flies the camera to the evidence.
**Rationale:** "What actually differs and why does it matter" is a prose
question; both failures answered it with geometry. Text-heavy cells are
exactly what LLMs summarize well. The classifier constrains the agent to
real differences — no hallucinated diffs.
**Downsides:** Gated on agent mode + a configured key; needs the
citation-chip UX; cost per brief.
**Confidence:** 70% (conditional on agent mode)
**Complexity:** Medium
**Status:** Unexplored

### 6. Copy-Drift Auditor
**Description:** A compare sub-mode for the duplicate-then-edit reality:
classify each divergent pair as *intentional divergence* vs *suspected
drift* (near-identical text with small edits; stale owner in one variant).
Drift items queue into a review list with word-level diffs and one-click
"sync across paths" / "mark intentional", writes through the revertible
ledger.
**Rationale:** Paths here are born by duplicating Happy Path, so drift is
a systematic disease that silently corrupts the blueprint's truth — and
cleaning it makes every other compare view sharper because remaining
divergence is real. The only compare job with a *done state*.
**Downsides:** Similarity thresholds need tuning; "sync across paths" is
a multi-write action that needs careful ledger grouping.
**Confidence:** 60%
**Complexity:** Medium–High
**Status:** Unexplored

### 7. Counterpart Peek
**Description:** Hovering (or holding a modifier over) any cell in
compare summons its counterparts from the other paths as ghost cards
beside the cursor, path-colored, changed fields highlighted word-by-word.
Release to dismiss; pin to open the pair in the drawer.
**Rationale:** The atomic act of comparison is reading two versions of
one cell together; today that means panning across thousands of pixels
holding text in memory. Brings the counterpart to the eye at the moment
of curiosity, with zero layout change. Composes with any of the above.
**Downsides:** Hover-only affordance is invisible until discovered;
touch needs an alternative.
**Confidence:** 70%
**Complexity:** Low
**Status:** Unexplored

## Recommendation

**Ship 1 + 2 together as Compare v3**: the Difference Ledger is the
answer surface, the folded canvas is the evidence surface — enumeration
plus compression, the two things paint never gave. Add 7 (Counterpart
Peek) as a cheap ergonomic layer. 3 and 4 are natural follow-ons sharing
the same fork/rejoin computation; 5 rides the agent-mode work already
planned; 6 is its own workflow, best after the agent exists (the agent
can *do* the drift audit).

Retire the highlight pass when v3 lands — two compare modes that both
underperform is worse than one that works.

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Onion-skin / light-table flip (flip paths in one grid) | 2026-08-02 ideation already rejected the onion metaphor; flip variant still teaches a model that breaks when step alignment is imperfect, and serves quick checks, not review |
| 2 | Lane impact matrix (lane × path heat grid) | Duplicates the ledger's group-by-lane + counts — weaker sibling of idea 1 |
| 3 | Lane pivot (stack one lane across paths) | Good instinct, but it is the ledger's lane filter + camera work; standalone view not warranted yet |
| 4 | Reference path + ghost delta badges | Badges on the anchor re-introduce paint-that-doesn't-explain; folding covers the compression need without new annotation vocabulary |
| 5 | Base-path delta strips (anchor grid + thin delta strips) | New layout machinery shaped like the merged spine — the failure we just retired |
| 6 | Interrogation-only mode (question bar, no view) | Too extreme as the sole surface; folded into idea 5 as the brief's Q&A extension |
| 7 | Sparkline "lane pulse" barcode | Merged into idea 3 (divergence map strip) — same instrument, different rendering |

## Session Log
- 2026-08-04: Initial ideation — 24 candidates from 3 framed generators (job-to-be-done / inversion / leverage), deduped to 9 clusters, 7 survived. Recommendation: ledger + fold as Compare v3.
