---
title: 'feat: a comparison view for paths — three candidate designs'
type: feat
status: ideation
date: 2026-08-02
---

# A comparison view for paths

## The problem

Side-by-side is the only way to look at two paths today, and it answers the
wrong question. It shows *both paths in full*, which is right for reading
either one — but the reason anyone selects two paths at once is to learn
**what is shared and what diverges**, and side-by-side makes the reader do
that diff by eye, scanning left and right across a very wide canvas, holding
one column in memory while reading the other.

The objective for a comparison view, in one line:

> Make the shared spine consolidate into one thing, so the differences are
> the only things left to read.

## The entry point

A two-state toggle on the top nav (the bar that holds the scenario title),
visible only while **two or more paths are selected** — with one path there
is nothing to compare and the control would be a question with no answer.

```
┌──────────────────────────────────────────────────────────────┐
│  ⓘ Fill-in Request              [ ⿲ Side by side | ⧉ Compare ] │
└──────────────────────────────────────────────────────────────┘
```

Square segments, brand-filled when active — the same vocabulary as the
View/Edit switch in the bottom bar. Side-by-side stays the default; Compare
is the analytical lens you step into.

---

## Idea 1 — The merged spine (“diff view”)

**One grid.** Steps that exist in both paths appear once. Where the paths
agree on a cell, one cell is drawn. Where they disagree, the cell splits
into a stack — one band per path, color-keyed to the path.

```
            Step 1        Step 2        Step 3        Step 4
          ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌──────────┐
Tutor     │  shared  │  │  shared  │  │ ██ Happy:   │  │  shared  │
          │   cell   │  │   cell   │  │  waits...   │  │   cell   │
          └──────────┘  └──────────┘  │ ░░ Call-off:│  └──────────┘
                                      │  escalates  │
                                      └─────────────┘
Front     ┌──────────┐                ┌─────────────┐
Stage     │  shared  │      (only     │ ░░ Call-off │   ← exists in one
          └──────────┘     in one:    │    only     │      path only:
                           gap gets   └─────────────┘      hatched border
                           hatching)
```

- **Shared** cells render normal, slightly desaturated — the spine is
  context, not the subject.
- **Divergent** cells split into color-keyed bands inside one cell outline.
- **Only-in-one** cells get a hatched/dashed outline in the owning path's
  color; the other path shows a hatched gap.

*Strengths:* the differences literally pop — everything readable at one
glance; consolidation is the default state, which matches the stated goal.
*Costs:* needs cell-level "sameness" — see **The matching problem** below;
lanes must union across paths; a 3+-path merge gets visually loud.

---

## Idea 2 — Anchor + ghost (“onion skin”)

One path is the **anchor**, rendered in full. The other path is drawn *on
top of it*, faded, offset a few pixels — like onion-skinning in animation.
A legend chip swaps which path is the anchor.

```
   Anchor: ● Happy Path     Ghost: ○ Call-off      [swap ⇄]

   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Greet    │   │ Assign   │   │ Wait for │
   │ students │   │ groups   │   │ students │◁─ ghost cell peeks out
   └──────────┘   └──────────┘   └─╌╌╌╌╌╌╌┐ │   behind the anchor
                                   ╎Escalate╎─┘   where they differ
                                   └╌╌╌╌╌╌╌╌┘
```

- Where the two agree, the ghost hides exactly behind the anchor — nothing
  extra to read.
- Where they differ, the ghost sticks out: a misaligned edge *is* the diff
  marker.

*Strengths:* zero new layout machinery — both grids already render; it is
one absolutely-positioned layer and an opacity. Reads instantly for 2 paths.
*Costs:* strictly 2 paths; small divergences can hide behind big cells;
"peeking" needs the grids to share column positions, which is the matching
problem again in geometric form.

---

## Idea 3 — Same grids, synchronized + annotated (“highlight pass”)

Keep side-by-side exactly as it is, and make the comparison a *paint layer*
over it: cells that match across paths dim to 40%; cells unique to a path
get a colored ring; divergent-but-matched cells get a "≠" badge that, on
hover, draws a connector line to its counterpart in the other column.
Scrolling and zooming lock the columns together.

```
  Happy Path                      Call-off Request
  ┌──────────┐  ┌──────────┐      ┌──────────┐  ┌───────────┐
  │  dimmed  │  │  dimmed  │      │  dimmed  │  │◎ unique   │
  └──────────┘  └──────────┘      └──────────┘  └───────────┘
  ┌──────────┐                    ┌──────────┐
  │ ≠ waits  │◄────────────────── │ ≠ escalates│   hover: the pair
  └──────────┘     connector      └───────────┘   lights up + lines
```

*Strengths:* cheapest to build by far (a classifier + CSS states on the
existing grids); degrades gracefully to 3+ paths; nothing about the layout
can break because the layout does not change.
*Costs:* consolidation is only visual (shared cells still occupy space
twice), so very-similar paths still read wide; the connector lines need the
camera work to be right or they become spaghetti.

---

## The matching problem (all three ideas stand on this)

Every idea needs the same primitive: *“this cell in path A and that cell in
path B are the same thing.”* Nothing in the schema says so today. Options,
in the order worth trying:

1. **Position + lane match** — same step index, same lane name ⇒ same slot;
   then same trimmed cell text ⇒ *identical*, different text ⇒ *divergent*.
   Zero schema change, works now, and `duplicate_path` copies make it exact.
2. **`cell_key` prefix match** — keys already encode
   `lifecycle/scenario/version/layer/step`; two cells whose keys differ only
   in the `version` segment are the same slot by construction.
3. **Explicit `counterpart_cell_id`** — a real edge, authored or backfilled.
   Only worth it if 1–2 prove too fuzzy in practice.

Start with 1, backed by 2 where keys exist. A `compareCells(pathA, pathB)`
pure function returning `{ shared, divergent, onlyA, onlyB }` is testable in
isolation and is the same input all three designs consume — building it
first defers none of the UI decisions and unblocks all of them.

## Recommendation

**Build 3 first, grow toward 1.** The highlight pass ships in days, proves
the classifier on real data, and its dim/ring/badge vocabulary carries
straight into the merged spine if the wide-canvas problem still hurts
afterwards. Idea 2 is the cheapest *demo* but a dead end at 3 paths, and the
anchor/ghost metaphor teaches users a mental model the merged spine would
then have to un-teach.

Sequence: `compareCells` classifier (+ tests) → toggle on the top nav →
highlight pass over side-by-side → evaluate → merged spine only if needed.
