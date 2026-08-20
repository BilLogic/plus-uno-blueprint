---
title: Grading the camera — directional easing and an orchestrated tier change
type: feat
status: shipped
date: 2026-08-20
---

# Grading the camera

> **SHIPPED, with one part cut.** The grading and the derived tier change
> landed. The staggered wipe this plan spends most of its length on was
> built, measured, and removed — see **What actually shipped** at the end,
> which is the part to read if you are here for the current behaviour.
>
> Decision record, with a playable before/after:
> https://claude.ai/code/artifact/b6eb68c9-dcd8-4d06-b511-2b0efb55cdd3

Playable version of the original proposal:
https://claude.ai/code/artifact/b28a1048-0708-4823-98ce-60bffde387bf

The transition is correct. What is left is a shape problem, in three parts.

## 1. One curve doing two opposite jobs

`easeCameraTransition` is a sine in-out — symmetric, so a push in and a pull
out are graded identically. They are not the same event. Going in you commit
to a target; coming out you release one.

Proposed, from one cubic family with a single control point moved, so the two
directions read as one system graded rather than as two animations:

| direction | curve | reads as |
|---|---|---|
| approach (zoom in) | `cubic-bezier(.42, 0, .2, 1)` | reluctant to leave, long landing |
| withdraw (zoom out) | `cubic-bezier(.18, 0, .2, 1)` | releases at once, settles wide |

The second control point is shared deliberately.

## 2. A step function inside a continuous move

Zoom is continuous, pan is continuous, and then the detail teleports. Moving
*when* that happens — which is what `TIER_DROP_AT` / `TIER_ARRIVE_AT` did —
cannot fix the *shape* of it.

A fade is the obvious answer and is not available: an opacity transition on
~1,000 cell-content elements at once was tried before this branch, measured as
a visible stutter, and reverted. The note is still in `blueprint.css`.

**Stagger instead of fade.** Each cell still flips instantly; the board reads
as a wave.

```css
[data-blueprint-cell-anchor] > * {
  transition: visibility 0s linear var(--tier-delay, 0ms);
}
```

`visibility` is not interpolated — the browser schedules each flip for a
different moment. No opacity, no per-frame paint, no thousand animations. Cost
is one declaration and one custom property set once per cell at mount.

### How the wipe rides each direction

The delay rises with a cell's distance from the focal column, so the wave has
a direction and that direction is the camera's:

| | camera | detail | reads as |
|---|---|---|---|
| zoom **out** | pulls back | drains OUTWARD from where you were, starting at the crossing | the detail trailing the camera out, rather than announcing the move before it starts |
| zoom **in** | closes on a target | resolves OUTWARD from where you are arriving, starting at the crossing | the board sharpening into place, rather than switching on after the camera stops |

Both waves begin at the legibility crossing rather than at a fixed fraction,
so the wipe and the tier decision are the same event rather than two schedules
that have to be kept in sync.

Measured in the playable version, cells emptied over a zoom-out — today
`0 -> 30` in a single step; proposed `0, 0, 0, 10, 20, 30`. Zooming in, today
`30 -> 0` in one step; proposed `30, 30, ... 20, 10, 0`.

## 3. Constants that encode nothing

`TIER_DROP_AT = 0.10` and `TIER_ARRIVE_AT = 0.88` were chosen by hand. Every
crossing move passes through the zoom where cell text stops being legible, and
that moment is different in every move:

| move | zoom | crossing, as % of zoom travel | today | derived |
|---|---|---|---|---|
| scenario → overview | 0.389 → 0.061 | 24% | 0.10 | **0.325** |
| phase → overview | 0.279 → 0.061 | 7% | 0.10 | **0.173** |
| overview → scenario | 0.061 → 0.389 | 76% | 0.88 | **0.675** |
| overview → phase | 0.061 → 0.279 | 93% | 0.88 | **0.827** |

Phase → overview crosses almost immediately; scenario → overview not until a
third of the way in. One constant cannot serve both, and 0.10 serves neither.

## The decision this needs

**Change at the crossing** (recommended) — the detail goes exactly when it
stops being readable and returns exactly when it becomes readable again.
Costs frames: the expensive tier stays on screen for the first third of a
zoom-out rather than the first tenth. Affordable on current measurements, but
it must be measured before it ships, not after.

**Keep it early and cheap** — leave the change near the start of a zoom-out
and fix only the grading and the wipe. Cheapest per frame; the wipe alone may
be enough. Costs honesty: cells empty while their text is still legible.

## Verification

Two of three are perceptual and judged by eye — that is why the proposal is a
playable page rather than prose.

Measurable, and must not regress: frames drawn per move, the gap to the
destination never widening at any sampled frame, and a move that crosses no
threshold staying at 420 ms with no tier write at all.


---

## What actually shipped

Written after the fact, because most of the document above describes a wipe
that is not in the product.

### Landed

- **Directional grading**, from one cubic family with one control point
  moved: `cubic-bezier(.42, 0, .2, 1)` committing, `cubic-bezier(.18, 0, .2, 1)`
  releasing. Almost all of the difference lives in the first quarter — a
  fifth of the way through, a withdrawal has covered 0.354 against an
  approach's 0.121 — and they settle identically.
- **The detail changes at the legibility crossing**, derived per move rather
  than at 0.10 and 0.88. Moves whose tier does not change end to end now
  write nothing at all, which on this board is most navigation.
- **Duration proportional to distance**, so every move travels at the same
  perceived rate.

### Cut

**The staggered wipe.** It worked, and side by side it looked better than the
plain switch. It went for what it cost at the edges: 528 transitions declared
across the board, a whole-board recalculation to write the per-column step,
~11 frames on a zoom-out, and ~40 ms added to the *worst single stall* — a
cost that concentrates on the worst frame is felt as a catch, where the same
cost spread across the average is not felt at all.

Three things it taught that outlived it, and are worth not rediscovering:

- A transition takes its delay from the after-change style, but a delay
  arriving in the **same recalculation** as the property it staggers does not
  take effect.
- `:not([attr])` in **descendant position scopes nothing** — it asks whether
  *some* ancestor lacks the attribute, and `<body>` always does. The
  one-directional sweep was designed, commented and measured twice before
  anyone checked the selector did what it said.
- **Free per frame is not free per restyle.** Nothing animated; the cost was
  in declaring the transitions at all.

### Corrected while shipping

The crossing table in this document converts a zoom crossing into a moment on
the clock, and that conversion runs through the ease — so it depends on which
ease. The figures were computed against the sine curve **this plan replaces**.
Recomputed against the shipped curves the moments are 0.153 / 0.080 / 0.493 /
0.681, not 0.325 / 0.173 / 0.675 / 0.827.

The shipped code does not use either set. It reads the crossing off the zoom
it is rendering, which the animation loop already has, so the two cannot
disagree and no table needs maintaining.

### The floor/ceiling rule is also gone

It existed only to give the sweep somewhere to live. With no sweep both
directions collapse to the same sentence, which is the whole rule now:

> Change the detail when the text stops being readable.
