---
title: "Design mode: one toolbar, one vocabulary"
type: refactor
status: draft — for review, not implementation
date: 2026-07-31
---

# Design mode: one toolbar, one vocabulary

Review document. Nothing here is built yet. Four findings and a proposal for
each; the ASCII is the thing to check.

## Finding 1 — the same thing has three names

Counted across `src/components/editor/*` and `deletionSafety.ts`: **scenario**
59, **path** 47, **version** 27, **lane** 24, **column** 10.

`version` and `column` are mine. They were introduced in the authoring work to
avoid overloading words that already meant something, and the cure was worse
than the disease — the app now names one row two ways depending on which
surface you are looking at.

| Table | Sidebar shows | Button says | Confirm dialog says | Net |
|---|---|---|---|---|
| `service_scenarios` | "Discovery" under a phase | "New blueprint" | "blueprint" | 2 names |
| `paths` | "PATHS" | "New version" | "version" | **3 names** (+ `path_type`) |
| `steps` | — | — | "column" | 2 names |
| `layers` | — | — | "lane" | 2 names |
| `slice_items` | — | "Add frame" | — | 1 — fine |

**Proposal: one word per concept, and where a word already existed, keep it.**

| Concept | Word | Killed |
|---|---|---|
| A journey with a grid | **Blueprint** | scenario (user-facing) |
| One way that journey can go | **Path** | version |
| A moment in time, the grid's x-axis | **Step** | column |
| A band of the service, the y-axis | **Lane** | layer (user-facing) |
| A picture in a slice | **Frame** | — |
| An arrow between two cells | **Link** | dependency, trigger |

`path` wins over `version` because it was already the sidebar heading, the
table name, and the shape of `path_type` (happy / alternative / sad). "Happy
Path" reads; "Happy Version" does not.

`step` wins over `column` because a column is what you see, not what it is. The
step is the moment; the column is how it's drawn.

Two kinds of link stay distinct in the editor — **triggers** draws an arrow,
**needs** does not — but both are *links*, and "dependency" disappears.

## Finding 2 — "Actor (optional)" is asked for and never shown

`slices.actor` is written by the create dialog and the edit session, stored,
and **read by nothing**. It appears in no header, no presentation slide, no
sidebar row. Grepped: the only reads are the two writes echoing it back.

So the field asks for something, calls it optional, and then discards it. That
is why it doesn't make sense — it doesn't.

**Proposal: remove the field.** For a `journey` slice the actor is already the
lane the cells sit in, which is on screen; asking again invites it to disagree
with the grid. If an actor label is wanted later it should be *derived* from
the lanes the frames touch, not typed.

Keep the column for now (dropping it is a separate migration and nothing is
lost by leaving it null).

## Finding 3 — Design mode takes away the only easy zoom-in

Zoom today has exactly two gestures:

- `cmd`/`ctrl` + wheel — pinch zoom (`useZoomPanViewport.ts:416`)
- clicking a blueprint in View mode — the camera fits to it

Design mode gives the click to the cell picker (`CanvasSelectionProvider.tsx`
returns `plainClick: true`), so the second one is gone. There is no zoom
button, no double-click-to-fit, no `⌘+`/`⌘-`. On a mouse without a pinch
gesture, Design mode cannot be zoomed at all.

**Proposal: zoom becomes a toolbar slot**, present in both modes — the readout
doubles as the control, which is the Figma pattern and fixes the gap without
adding a mode-specific rule.

## Finding 4 — the Design toolbar is a row of sentences

Today, in Design mode:

```
( ▷ Select )( ◇ New slice ③ )( ✎ Edit cell )( ▦ New blueprint )( ⧉ New version )( 🗑 Delete version )  [ view | design ]
```

Six labelled buttons, four of which are nouns-with-verbs, one of which is
destructive and sits one pixel from "New". It grows every time a capability is
added, because every capability got its own slot.

Two of them should not be toolbar items at all:

- **Edit cell** — a cell already opens on click. A button that does what
  clicking does is a second way to do one thing.
- **Delete version** — destructive actions belong on the object, not in a
  global bar. It moves to the path's own row.

The rest collapse into families.

---

## Proposed toolbar

Same bar in both modes. The mode toggle swaps which families appear; nothing
else moves, so the pointer and zoom never shift under the cursor.

### View mode

```
┌────────────────────────────────────────────────────────────────────┐
│  ▷ ⌄  │  ✎ ⌄   ▢ ⌄   T ⌄  │  100% ⌄  │        ◉▷  ◌✎             │
└────────────────────────────────────────────────────────────────────┘
   ▲       ▲     ▲     ▲        ▲                 ▲
   │       │     │     │        │                 └─ mode, icon-only
   │       │     │     └─ text & sticky           └─ zoom
   │       │     └─ shapes
   │       └─ draw
   └─ pointer
```

### Design mode

```
┌────────────────────────────────────────────────────────────────────┐
│  ▷ ⌄  │  ▦ ⌄   ◇ ⌄  │  ✎ ⌄   ▢ ⌄   T ⌄  │  100% ⌄  │   ◌▷  ◉✎    │
└────────────────────────────────────────────────────────────────────┘
   ▲       ▲     ▲        ▲                    ▲          ▲
   │       │     │        └─ annotation, same as View     └─ mode
   │       │     └─ slice
   │       └─ build
   └─ pointer
```

Five families, never more. Annotation is shared rather than hidden in Design
mode — the current toolbar drops it entirely when designing, which is why
switching modes feels like a different app.

---

## What is under each chevron

Chevron opens on click; the icon itself activates the family's current tool
(Figma behaviour). The ticked row is the active one and becomes the face icon.

### ▷ Pointer

```
┌──────────────────────────────┐
│ ✓  ▷  Select            V    │
│    ✋ Hand (pan)         H    │
│    ⛶  Marquee           M    │   design only
└──────────────────────────────┘
```

`Hand` is new and is the other half of the zoom fix: a way to pan that does not
depend on a trackpad. Marquee is listed explicitly because in Design mode a
plain drag already marquees — naming it makes that discoverable instead of
accidental.

### ▦ Build — design only

```
┌──────────────────────────────────────┐
│    ▦  Blueprint…            ⇧B       │
│    ⧉  Path…                 ⇧P       │
│  ─────────────────────────────────   │
│    ▤  Step            → after last   │
│    ▭  Lane            → bottom       │
└──────────────────────────────────────┘
```

Ellipsis = opens a dialog. No ellipsis = acts immediately, appending. Step and
Lane need no dialog: a blank one at the end is always a valid grid, and it is
named in place afterwards. That is one click instead of a modal, and it is why
they sit below the divider.

**`Blueprint…`** is today's "New blueprint" dialog, unchanged.
**`Path…`** is today's "New version" dialog, retitled.

Both are disabled, with a reason in the tooltip, when nothing is selected to
create them against — `Path…` needs a blueprint, `Step`/`Lane` need a path.

### ◇ Slice — design only

```
┌──────────────────────────────────────┐
│    ◇  New slice from selection  ⇧S   │
│       └ 3 cells picked               │
│  ─────────────────────────────────   │
│    ▷  Present this slice        ⇧⏎   │
└──────────────────────────────────────┘
```

The count moves off the button face and into the row, so the toolbar stops
changing width as cells are picked. With nothing picked the first row is
disabled and reads "Pick cells on the canvas first".

### ✎ Draw · ▢ Shapes · T Content — both modes

```
✎ Draw                    ▢ Shapes              T Content
┌────────────────────┐    ┌──────────────────┐  ┌────────────────────┐
│ ✓ ✎  Pen      P    │    │ ✓ ▭  Rectangle R │  │ ✓ T  Text      T   │
│   ⌫  Eraser   E    │    │   ◯  Ellipse   O │  │   ▪  Sticky    S   │
│ ──────────────────ptr   │   ／  Line     L │  │ ─────────────────  │
│   🗑 Clear all     │    │   ↗  Arrow    ⇧L │  │   🗑 Clear all     │
└────────────────────┘    └──────────────────┘  └────────────────────┘
```

Line and Arrow are added because the annotation layer has shapes but no way to
point at anything, which is the most common markup in a review.

`Clear all` is duplicated into Draw and Content rather than kept as its own
seventh slot — it is one action, reachable from where the mess was made.

### 100% Zoom — both modes

```
┌──────────────────────────────────────┐
│    +  Zoom in                 ⌘+     │
│    −  Zoom out                ⌘−     │
│  ─────────────────────────────────   │
│    ⛶  Zoom to fit             ⇧1     │
│    ⊡  Zoom to selection       ⇧2     │
│  ─────────────────────────────────   │
│       50%                            │
│  ✓    100%                           │
│       200%                           │
└──────────────────────────────────────┘
```

The face shows the live percentage, so the bar answers "how far in am I"
without being opened. This is the whole of Finding 3's fix.

### Mode toggle

Icon-only, and the active half carries a filled pill rather than a shade of
grey — the current two-word switch is legible but not salient, and at the far
end of a bar it is the one control that must read at a glance.

```
   inactive              active
┌───────────────┐    ┌───────────────┐
│  ◌▷    ◌✎     │    │  ◌▷   ▐◉✎▌    │
└───────────────┘    └───────────────┘
    view  design          design on
```

- `▷` (eye/pointer) = **View**
- `✎` (pencil/grid) = **Design**

Tooltip carries the word, so the icons never have to be guessed at twice.

---

## What this removes

| Gone | Where it went |
|---|---|
| "Edit cell" button | clicking a cell (already worked) |
| "Delete version" button | the path's own row, with the confirm it already has |
| "New slice ③" width changes | count moved into the dropdown row |
| Annotation tools vanishing in Design | shared family, both modes |
| the word "version" | **path** |
| the word "column" | **step** |
| "Actor (optional)" | removed; derive from lanes if ever needed |

Six Design-mode buttons → **five families**, of which three are shared with
View mode, so switching modes changes two slots instead of the whole bar.

---

## Open questions for you

1. **Blueprint vs scenario.** I propose *blueprint* user-facing because the
   button already says "New blueprint" and the product is called Uno Blueprint.
   But the sidebar's aria labels all say "scenario". Which one wins?
2. **Step / Lane appending without a dialog** — is a blank trailing step the
   right default, or should it ask for a name first?
3. **Hand tool** — worth a slot, or is space-drag plus the zoom menu enough?
4. **Line / Arrow** in annotation — wanted, or scope creep?
