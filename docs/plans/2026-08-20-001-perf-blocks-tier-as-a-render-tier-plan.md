---
title: Make the blocks tier a render tier, not a CSS tier
type: perf
status: rejected
date: 2026-08-20
---

# Make the blocks tier a render tier, not a CSS tier

> **REJECTED — 2026-08-20, before implementation.** The probe this plan asked
> for disproved its central assumption. Cutting 29% of the board's DOM buys
> 3 fps, and the compositor cost does not move. Kept in full because the
> measurements are worth more than the proposal was, and because the next
> person to have this idea should find the numbers before spending the day.
> See **Why this was rejected** at the end.

## The complaint

Zooming back out feels rougher than zooming in. Same distance, same duration,
same ease.

## What is actually measured

Board: **6,563 DOM nodes**, all of them present at every zoom level.

| move | frames | fps | Layerize | Paint ops | Style |
|---|---|---|---|---|---|
| OUT L2 → L3 | 45 | ~112 | 262 ms / 45 fr (**5.8 ms/fr**) | 64 | 45 ms |
| BACK L3 → L1 | 38–45 | 45–55 | 694–765 ms / 38–48 fr (**16–18 ms/fr**) | 1,467–2,415 | 118–143 ms |

`Layerize` is the compositor deciding how to divide content into layers and
paint chunks. It runs once per frame, and on the return it costs **three
times** what it costs going out — which is the whole 38–39 ms cadence.

Raster is not the problem (66 ms total). React is not the problem: L1 → L2
performs **53 DOM mutations** and is rough, while L2 → L3 performs **2,353**
and is smooth.

The variable that tracks the cost is how much of the board is inside the
viewport. Going out, the visible area shrinks toward one scenario. Coming
back, it grows until all 6,563 nodes are in frame, and every one of them is a
paint chunk the compositor must consider on every frame of the ease.

## Root cause

The `blocks` tier — what the board shows at overview zoom — is a **CSS hide**:

```css
[data-semantic-tier='blocks'] [data-blueprint-cell-anchor] > * {
  visibility: hidden;
}
```

Every node still exists, is styled, is laid out, and is counted by the
compositor. We pay the full price of content that is deliberately invisible
and unreadable at that scale.

Two costs follow from that, and both are measured:

1. **Per frame during a zoom-out**: 16–18 ms of Layerize over a subtree whose
   size is set by the DOM, not by what can be read.
2. **Once per crossing move**: 81 ms to enter the text tier, 54 ms to leave —
   a whole-board style recalculation. Currently hidden by parking it on a
   stationary frame, not removed.

## Proposal

Render the blocks tier instead of hiding it. Below the semantic threshold, a
cell renders **one plain div carrying its block background** — which is
exactly what is on screen today — rather than its full subtree.

Estimated ~400 nodes instead of 6,563: a **~16x** reduction in the transformed
subtree.

The tier decision already exists, is already computed once per move, and is
already stamped at the right moment (origin tier while travelling, destination
tier on the settling frame). This changes only what the decision *drives*.

The visual result at overview is intended to be identical. The grey blocks
carry real information — journey length, density per phase — and they stay.

### Why this addresses the measurement

- Fewer paint chunks in the transformed subtree is directly what `Layerize`
  costs, so the 16–18 ms/frame should fall toward the outward direction's 5.8.
- The 54–81 ms tier flip largely disappears: there is no whole-board restyle
  when the board is a few hundred nodes.
- The remount on arrival lands on the settling frame, where the camera is
  already stationary and where we have already established costs are free.

## What changes, drawn

### A single cell, today vs proposed

```
TODAY — one cell, at every zoom level, all the time

  <div data-blueprint-cell-anchor>          <- box that sets the geometry
    <div class="cell-frame">                 |
      <span class="cell-title">…</span>      |  ~15 nodes,
      <p class="cell-body">…</p>             |  styled, laid out,
      <ul class="cell-tags"> <li>…           |  counted by the compositor
      <svg class="cell-icon">…               |
    </div>                                  _|

  at TEXT tier    cells render, and you read them          <- correct
  at BLOCKS tier  `visibility: hidden` on the children     <- paid for, invisible
                  the anchor's grey background is all
                  that is on screen


PROPOSED — the tier decides what is BUILT, not what is painted

  at TEXT tier    <div data-blueprint-cell-anchor>
                    …full subtree, exactly as today…
                  </div>

  at BLOCKS tier  <div data-blueprint-cell-anchor />       <- 1 node
                    ^ same box, same grey background,
                      identical on screen
```

### The zoom-out, frame by frame

```
  click "Uno Blueprint" from a scenario
     |
     v
  [ tier decision ]  min(from, to) = blocks, and it CHANGES
     |               so it is stamped now, one frame before the clock
     v
  ────────────────────────────────────────────────────────────────
   frame 0    cells collapse to their shells      ~6,563 -> ~400 nodes
              camera has not moved yet                (invisible: the
                                                       screen is identical)
  ────────────────────────────────────────────────────────────────
   frames     camera eases out over ~800 ms
   1..N       compositor is laying out ~400 boxes, not ~6,563
              TARGET: Layerize 16-18 ms/frame  ->  under 8
  ────────────────────────────────────────────────────────────────
   settle     camera stationary. Destination tier stamped.
   frame      L1 IS the blocks tier, so nothing more to do —
              the board is already what it should be.
  ────────────────────────────────────────────────────────────────
```

### The zoom-in, for contrast

```
   frame 0    already blocks (that is where we are). Nothing collapses.
              camera starts on the very next frame, no cost.
     |
   frames     easing in over ~800 ms, still ~400 nodes.
   1..N       Cheap the whole way.
     |
   settle     camera stationary. Tier flips to text.
   frame      ~400 -> ~6,563 nodes: React builds the cell subtrees, and
              the existing staged reveal brings them in.
              This is where the cost lands, and the camera is still.
```

The shape to notice: **the expensive tier only ever exists while the camera
is stationary.** That is already true of the tier flip on this branch; this
change makes it true of the node count as well.

### What a reader sees

```
  zoom out    cells empty ──> board recedes ──> arrives, already blocks
              (before motion)                    nothing pops in

  zoom in     board approaches ──> arrives ──> cell contents resolve
              (still blocks)                    (staged, ~200 ms)
```

Which is the reveal order already agreed and shipped: detail disappears
before the retreat, and resolves after the approach.

## Work

1. **Geometry parity harness first.** Before changing any rendering, assert
   that a blocks-tier cell occupies a box identical to its text-tier
   counterpart. This is the load-bearing constraint: the camera fit measures
   real geometry, and the row-height alignment machinery
   (`useAlignedPhaseRowPanelHeight`) measures panel heights. If the shell's box
   differs by a pixel, both drift.
2. **Cell component takes a tier prop.** Read from context, not from a DOM
   attribute, so React can decide rather than CSS.
3. **Delete the `visibility: hidden` rule** and the `::after` skeleton-bar
   pseudo-elements for headers — the latter generate and destroy layout boxes
   on every flip, which is layout-tree construction rather than a style change.
4. **Fix `focusCells` (see risks).**
5. **Re-measure** the same four moves, same script.

## Risks

- **`focusCells` would silently miss.** It resolves targets with
  `content.querySelector('[data-blueprint-cell="…"]')`. An unrendered cell is a
  miss, so fly-to from the difference ledger or an agent command would fail
  while zoomed out — returning `{kind:'miss'}` rather than flying. Fix: the
  fly-to must force the text tier and wait a frame before resolving targets.
  This is the risk most likely to be missed, because the failure is a silent
  no-op on a path nobody exercises by hand.
- **Geometry drift.** Covered by step 1, but it is the reason this is half a
  day rather than an hour.
- **Find-in-page and text selection** stop reaching board content at overview
  zoom. Arguably an improvement; still a behaviour change worth stating.
- **Remount cost on arrival** when zooming in. Navigation already performs
  ~2,130 mutations, so this is relocated work rather than new work — but it now
  also happens on a zoom-in that stays within one board.

## Already ruled out — do not re-try

Each of these was tested against the real board and produced no improvement.
Recorded so the next person does not spend the day I spent.

- **`will-change: transform`** on the transformed root, applied for the
  duration of the ease. Tested on the return trip, where it should have helped
  most: **worse** — 37–38 frames at 43–45 fps against 44–47 at 51–56.
- **`:has()` selector cost.** All 9 board rules removed at source, build
  verified, flip re-measured: 79.7 / 62.5 ms against a baseline of 80.7 / 61.8.
  No effect. The 2–4x estimate came from a synthetic page at 300 rules; we have
  ~40, and 9 that reach the board.
- **`content-visibility: hidden` on cell anchors.** Worse: first gap 109–122 ms
  against 67 ms.
- **Waiting for the destination to mount before starting the ease.** No effect.
- **Scaling duration with distance to fix the jump.** No effect on the jump —
  though it was worth landing on its own merits, and did.

## Verification

Same measurement script, same four moves. Success is the return trip
approaching the outward trip:

| metric | now | target |
|---|---|---|
| BACK L3 → L1 frames | 38–45 | 65+ |
| BACK Layerize per frame | 16–18 ms | under 8 ms |
| tier flip cost | 54–81 ms | under 15 ms |
| OUT L1 → L3 frames | 69–77 | no regression |
| L2 → L3 (crosses nothing) | 43–48 frames, 6% step | unchanged |

Overview must be pixel-identical. Compare screenshots before and after.


---

## Why this was rejected

The plan's arithmetic was wrong, and the probe caught it in twenty minutes.

### Geometry parity — the one risk that turned out to be free

Removing every cell's content from layout moved **nothing**: 528 cells, board
14,854 x 12,403 px, zero cells changed size, board delta 0x0. The grid tracks
are fully deterministic and cell content never drives the box. The constraint
this plan called load-bearing does not exist.

### The node arithmetic — wrong by an order of magnitude

I estimated a cell subtree at ~15 nodes, and ~400 nodes for the whole board at
blocks tier. Measured: cell content is **~2 nodes per cell**. Removing all of
it takes the board from 6,563 to 5,471 — a 17% cut, not 16x.

The board's nodes are the board:

| what | nodes |
|---|---|
| plain layout divs (grid scaffolding) | 3,653 |
| cell buttons | 531 |
| arrow SVG (`path` / `g` / `marker` / `defs`) | ~834 |
| column + row headers | 462 |
| cell content | ~1,092 |

There is no fat subtree to cut.

### The payoff — measured three ways, all null

| | nodes | fps | median frame | Layerize per frame |
|---|---|---|---|---|
| baseline | 6,563 | 47–48 | 13.1 ms | 15.9 ms |
| cell content hidden (`display:none`) | 6,563 | 51–53 | 10.4 ms | 14.6 ms |
| cell content removed from the DOM | 5,471 | 50 | 10.9 ms | 14.7 ms |
| arrows removed | 5,726 | 50 | 10.9 ms | 14.4 ms |
| arrows **and** cell content removed | 4,634 | 50 | 11.2 ms | 14.5 ms |

Cutting 29% of the DOM buys 3 fps. The second cut adds nothing over the first.
`Layerize` — the dominant per-frame cost, the whole reason for the plan —
plateaus at ~14.5 ms whatever is removed.

### What that implies

Compositor cost here is not proportional to node count. The remaining
candidate is **layer area**: at overview the board is a 14,854 x 12,403 surface
scaled down to fit, and tiling cost scales with the area being composited, not
with how many elements are inside it. That would explain every direction-
dependent number in this document — going out, the composited area grows;
going in, it shrinks — while leaving node count irrelevant, which is what was
measured.

That hypothesis is untested. Testing it means varying board dimensions, not
DOM size, and the fix it would imply is a different kind of change entirely
(compositing the overview as one flat surface rather than scaling the live
board). Neither belongs in this plan.

### Where that leaves the complaint

The return trip runs at 47–50 fps against the outward trip's 84–93. That is
visibly less silky, and it is not something a day of DOM surgery fixes.
Everything cheap has now been tried and measured:

`will-change`, `:has()` cost, `content-visibility: hidden`, deferring the
fit, scaling duration, removing cell content, removing arrows, removing both.

Eight approaches, eight nulls. The transition work that *did* land — one tier
flip instead of three, paid on a stationary frame, a straight path, honest
pacing, and duration proportional to distance — is where the wins actually
came from.

---

## Postscript, 2026-08-20: what the cost actually is, and the one thing that moved it

Three more nulls followed, and then a win. Recorded here because this is the
document the next person will find.

### The decomposition that should have come first

| measurement | result |
|---|---|
| attribute write alone, deferred | 0 ms |
| style recalculation only | 70 ms |
| style + forced layout | 65 ms |
| bare layout, nothing dirty | 0 ms |
| **the same flip with every tier rule neutralised** | **66.5 ms** |

The tier change is **pure style recalculation** — layout is free on this
board. And with the rules doing nothing at all it still costs 66 of its 71
ms, so the rules contribute about 5 ms and everything else is invalidating
and re-matching roughly 700 elements.

That single number explains all eight nulls above, and the three below: every
one of them was optimising the 5 ms.

### Three further nulls — do not re-try

- **Dropping the header skeleton `::after` pseudo-elements.** Step 3 of the
  plan above, never tried in isolation because the plan was rejected whole.
  68.3 → 64.2 ms. Worth ~4 ms of 68.
- **Re-expressing the entire tier as inherited custom properties**, so the
  attribute never changes and no selector re-matches: 73.6 ms against 73.3.
  The trigger mechanism is not what costs. (A partial conversion measured
  41 ms and looked like a win — it was only doing a quarter of the work.)
- **Anything else rule-shaped.** The rules are 7% of the bill.

### What did work

Cost scales with how many elements are in style scope. Taking half the board
out of scope took the flip from 61.9 ms to 39.1.

`content-visibility: auto` on `[data-phase-id]` does that on the browser's
terms, and the camera crosses the legibility threshold at roughly zoom 0.25 —
where about a third of the board is on screen, so most of it is skippable at
exactly the moment the bill lands.

Measured on the real board, interleaved in one session, medians of five
alternating navigations per direction:

| | worst stall, on | worst stall, off | frames on | frames off |
|---|---|---|---|---|
| zoom in | **52 ms** | 82 ms | 161 | 157 |
| zoom out | **44 ms** | 95 ms | 148 | 136 |

Note this is **`auto`, not `hidden`** — `hidden` is the one ruled out above,
and it is genuinely worse because it skips unconditionally and then pays to
un-skip. And it is applied to the six phase containers, not to the five
hundred cells.

The risk is silent, because the camera fits by measuring: a skipped phase
reporting the wrong size would corrupt every fit after it. Verified before
landing — board, all six phases and 120 cells drift by 0 px, and a full
navigation tour produces fit zooms identical to four decimal places with it
on and off. `auto` in `contain-intrinsic-size` is what makes that hold.

### Where the complaint stands now

Two wins, neither of them from this plan's proposal. Moves that do not cross
the threshold now perform no tier write at all — most navigation — and the
moves that do cross cost about half the stall they used to.

Past that, ~65 ms to restyle 700 elements is the floor, eleven approaches
deep. The remaining lever is having fewer elements, and the probe above
measured that at 3 fps for a 29% DOM cut. Stop here.
