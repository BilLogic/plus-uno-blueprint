---
title: "One canvas: the tool decides the click, Edit decides the affordances"
type: refactor
status: draft — for alignment, not implementation
date: 2026-07-31
---

# One canvas: the tool decides the click, Edit decides the affordances

Plan only. Nothing here is built.

The whole plan follows from one sentence:

> **The tool decides what a click does. Edit decides what there is to click on.**

Everything below — how many modes there are, where creation lives, what a click
selects, what the bottom bar holds — is a consequence of that split. Where an
earlier draft got something wrong, the correction is marked, because the reason
it was wrong is the useful part.

The inline agent is specced separately in
[2026-07-31-003](./2026-07-31-003-feat-inline-agent-chat-plan.md) and is
deliberately absent from the bottom bar here.

---

## Research findings

Read from the code on `feat/derived-layer-slices`, not from memory.

### 1. Annotations are not saved anywhere

`CanvasAnnotationProvider.tsx:27` — `useState<CanvasAnnotation[]>([])`. No
persistence, no table, no localStorage. **Every mark is lost on reload.** A
defect on its own terms, independent of anything else here.

### 2. The mode comment and the toolbar disagree

`canvasModeContext.ts:6` says view is *"reading, navigating **and
annotating**"*. `CanvasAnnotationToolbar.tsx:268` drops every annotation tool
the moment Design mode turns on. Annotation is documented as belonging to one
mode, implemented as belonging to the other, and in Design mode belongs to
neither.

### 3. The selection grammar is Figma's, and Figma's is wrong here

`CanvasSelectionProvider.tsx:22` states the rule outright:

> *Grammar is Figma's… a plain click replaces, shift toggles, Escape clears.*

Correct when a selection is **the subject of the next verb** and verbs are
frequent — move it, resize it, delete it. Here the selection is **a set being
assembled** with exactly one verb at the end: make a slice. Replace-on-click
means the set can never be built by clicking, which is the reported symptom.

Every call site already threads `additive: event.shiftKey`
(`BlueprintCellButton.tsx:133`, `BlueprintLabelRail.tsx:178`,
`BlueprintColumnHandles.tsx:118`), so the fix is one default, not a rewrite.

### 4. The sidebar already has the slots the `+` needs

`SidebarNav.tsx:180` — `NavSection` takes a `trailing` prop; rows carry a
hover-revealed chevron slot (`CHEVRON_REVEAL_CLASS`). The hover-`+` pattern
drops in without new layout primitives, and the reveal mechanism already exists.

### 5. The bottom bar overflows today

Five labelled buttons plus the mode switch; at 800 px the switch clips off the
right edge. The growth is structural — every capability got its own slot.

---

## Decision 1 — two modes, not three. The tool already disambiguates

**Correction.** An earlier draft proposed a third mode, "Mark", arguing that a
pen active while editing makes a click ambiguous. That argument is wrong. **The
tool disambiguates.** Select means navigate; pen means draw; rectangle means
draw a rectangle. This is how Figma and Miro work, and choosing a marking tool
*is* the act of switching out of navigation. A mode that only restates which
tool is selected is a second copy of state that can disagree with the first.

So:

| | What it is | Writes |
|---|---|---|
| **View** (default) | read, navigate, and mark up. The tool says which. | nothing |
| **Edit** (toggle) | the same canvas, with authoring affordances revealed | the database |

Edit is a **toggle, not a segment of a mode picker**, because it is not a peer
of the tools — it is orthogonal to them. You can hold the pen with Edit on;
drawing still draws, and the insert handles are still there when you switch
back to Select.

What Edit turns on, and nothing else:

```
Edit OFF                          Edit ON
────────                          ───────
cells are inert                   cells are selectable
no handles                        insert handles between steps and lanes
sidebar rows are links            sidebar rows reveal + and ⋯ on hover
no selection toolbar              selection toolbar floats over picks
```

Annotation tools are present in both, because they were never the thing that
distinguished them. That also fixes finding 2 — today they vanish in Design
mode, which is why switching feels like a different app.

---

## Decision 2 — creation follows the hierarchy, not the toolbar

Combining every creation into one menu is right for some of these and
impossible for the rest, and the reason is worth stating.

```
Lifecycle
└── Phase ................................. sidebar row
    └── Blueprint ......................... sidebar row
        └── Path .......................... sidebar row
            ├── Lane ...................... grid row      ← has a position
            └── Step ...................... grid column   ← has a position
                └── Cell .................. grid square   ← has a position
Slice ..................................... references cells anywhere
```

**Things with a sidebar row can be created from the sidebar. Things with a
position cannot be created from a menu**, because "add a step" is not a
complete instruction — "add a step *after which one*" is. A menu would have to
ask a follow-up question that the canvas answers by being pointed at.

Creation therefore splits by what a thing needs in order to exist:

| Needs | Surface | Creates |
|---|---|---|
| a parent | **sidebar, hover `+`** | phase, blueprint, path |
| a position | **canvas handle** | step, lane, cell |
| a selection | **selection toolbar** | slice |
| a sentence | [agent](./2026-07-31-003-feat-inline-agent-chat-plan.md) | any of them, described |

### Sidebar — everything reveals on hover

**The `+` lives on the row that owns the thing it makes.** A section header
creates a sibling at that level; a row's own `+` creates a child inside it.
That is what disambiguates phases from blueprints-within-a-phase: the `+` is
attached to the phase, so it cannot be read as anything else.

**Every affordance is hover-revealed, headers included** — a sidebar with a
permanent `+` on every row is a column of plus signs, and reading is far more
common than creating. The chevron already behaves this way
(`CHEVRON_REVEAL_CLASS`); `+` and `⋯` join it.

```
resting                             hovering "Application"
┌────────────────────────────┐      ┌────────────────────────────┐
│ ⌄ PHASES                   │      │ ⌄ PHASES                   │
│                            │      │                            │
│   Application              │      │   Application          [+] │ ← new blueprint
│     Discovery              │      │     Discovery              │    in Application
│     Interview & Offer      │      │     Interview & Offer      │
│   Onboarding               │      │   Onboarding               │
│ ▸ Pre-session              │      │ ▸ Pre-session              │
└────────────────────────────┘      └────────────────────────────┘

hovering the PHASES header          a selected blueprint
┌────────────────────────────┐      ┌────────────────────────────┐
│ ⌄ PHASES               [+] │      │ ⌄ PATHS                [+] │ ← new path
│                            │      │   ✓ Happy Path         [⋯] │ ← rename /
│   Application              │      │     Recovery Path      [⋯] │   duplicate /
└────────────────────────────┘      └────────────────────────────┘   delete
```

Keyboard and touch have no hover. The revealed controls stay in the tab order
and become visible on focus, exactly as the chevron does today; on coarse
pointers they are always shown.

`[⋯]` on a path row rather than `[+]`: a path's children are grid objects, so
its menu is *Rename / Duplicate / Delete* — and Delete finally moves off the
bottom bar onto the object it destroys.

**New phase is offered.** Confirmed. Consequences carried rather than assumed:

- A phase is a **column of the whole canvas**, so creating one changes the
  camera's world. The new phase is scrolled to, not silently appended
  off-screen.
- `order_position` appends last; `loops_to_phase_id` starts null. Both editable
  afterwards from the row menu.
- **There is no `create_phase` RPC.** The only new backend surface this plan
  needs; everything else calls functions that already exist and are
  smoke-tested.

### Canvas handles — the affordance rules

Borrowed from Miro's frame-adjacency `+` and Figma's row/column inserts,
because both have already solved putting an affordance in a gap without making
the gap noisy.

```
        ┌─────────┐   ┌─────────┐   ┌─────────┐
   ⊕    │ Step 1  │ ⊕ │ Step 2  │ ⊕ │ Step 3  │  ⊕
        └─────────┘   └─────────┘   └─────────┘

  hovering the gap between Step 1 and Step 2:

        ┌─────────┐ ╷ ┌─────────┐
        │ Step 1  │ ⊕ │ Step 2  │      ╷ = insertion line, full grid height
        └─────────┘ ╵ └─────────┘      ⊕ = rides at the cursor's height
        ░░░░░░░░░░░░░░░░░░░░░░░░░      ░ = ghost column previewing the result
```

Six rules, each earning its place:

1. **Hidden until hover.** A 400-cell grid with permanent handles is unreadable.
2. **Hit zone wider than the mark.** The line is 1 px; the target is ~16 px,
   centred on the gap. Figma's insert targets do this, and it is the difference
   between a usable affordance and a fiddly one.
3. **The `+` tracks the cursor** along the insertion line rather than sitting at
   a fixed end, so it is never a long mouse journey from where you already are.
4. **Preview before commit.** The ghost column shows the width the new step
   takes and the columns shifting right — the shift is the surprising part, so
   it is shown before it happens rather than discovered after.
5. **Hide below a zoom threshold.** Under roughly 40 % the handles are
   sub-pixel and would only produce misfires. Figma hides UI the same way.
6. **Reorder lives on the header, not the gap.** Dragging a step's header
   reorders; the gap is exclusively for insertion. One gesture per target.

Lanes get the same treatment rotated, on the label rail:

```
  ┌──────┐ ┌───────────────────────┐
  │  ⊕   │ │                       │
  ├──────┤ ├───────────────────────┤
  │Visual│ │  ▢    ▢    ▢          │
  ├══════┤ ├═══════════════════════┤   ← hovering: insertion line + ghost row
  │  ⊕   │ │░░░░░░░░░░░░░░░░░░░░░░░│
  ├──────┤ ├───────────────────────┤
  │Tutor │ │  ▢    ▢    ▢          │
  └──────┘ └───────────────────────┘
```

An empty grid square in Edit mode is its own affordance: a faint `+` on hover,
and clicking calls `upsert_cell` and puts the caret in it. No menu, no dialog —
the position is the argument, and pointing supplied it.

`BlueprintColumnHandles.tsx` and `BlueprintLabelRail.tsx` already exist and
already know their positions, so this is an addition to components already in
the right place.

---

## Decision 3 — clicking cells should gather them

*(Rewritten — the previous version described the change without showing it.)*

**The problem, concretely.** You want a slice of four cells. Today:

```
click A   →  [A]           ✓
click B   →  [B]           ✗  A is gone
click C   →  [C]           ✗  B is gone
```

Each click throws away the last. The only way to build the set is to hold shift
for every cell after the first — which nothing tells you, and which is not what
"pick some cells" feels like.

**The change.** In Edit mode a click *toggles membership* instead of replacing
the selection:

```
click A   →  [A]
click B   →  [A B]
click C   →  [A B C]
click B   →  [A C]          clicking again removes it
Escape    →  []
```

Checkbox grammar, not object grammar — right here, because the selection is a
set being gathered, not an object about to be moved.

**"Then how do I just edit one cell?"** You still click it. Selecting exactly
one cell opens the detail panel; selecting a second closes it and the selection
toolbar takes over.

```
click A            →  [A]      → detail panel opens on A
click B            →  [A B]    → panel closes, selection toolbar appears
click B again      →  [A]      → panel reopens on A
```

Single-cell editing therefore behaves exactly as it does now, and the *Edit
cell* button disappears — it was a button that did what clicking already did.

**Shift-click extends a range** in grid reading order, the way a file list
does: click the first cell, shift-click the last, everything between joins.
This replaces shift's current job (toggling), which the plain click has taken
over.

**What this costs, stated plainly.** There is no longer a single gesture
meaning "forget everything and select only this". It becomes Escape-then-click,
or a click on empty canvas then the cell — two gestures where there was one.
Acceptable because gathering is the frequent action and narrowing is the rare
one, but a real trade, not a free win.

| Gesture | Today | Proposed |
|---|---|---|
| click a cell | replaces the selection | **toggles it in/out** |
| shift-click | toggles | **extends a range** |
| drag empty canvas | marquee, replaces | unchanged |
| click empty canvas | clears | unchanged |
| Escape | clears | unchanged |
| exactly one picked | nothing | **detail panel opens** |

---

## Decision 4 — the bottom bar holds tools; the canvas holds everything else

The direct answer to *"are you suggesting that editing at other levels is now
all built into the UI, so the bottom nav doesn't need it?"* — **yes, exactly
that.** Structural editing moves to where the structure is drawn. What is left
in the bar is what has no home on the canvas: the tools, and the Edit toggle.

The bar is now **the same in both modes**. Nothing appears or disappears when
Edit turns on, so switching never moves a control under the cursor.

```
┌──────────────────────────────────────────────────────────┐
│  ▷   ✎ ⌄   ▢ ⌄   T ⌄   🗑        │        ▦ Edit         │
└──────────────────────────────────────────────────────────┘
   select  draw  shapes  text  clear          toggle
```

The chat bar is **not here** — deferred with the rest of
[003](./2026-07-31-003-feat-inline-agent-chat-plan.md); nothing in this plan
depends on it. Zoom is dropped as unhelpful. Shortcuts are deferred.

### Edit toggle — on and off

Not a two-segment switch, because there is nothing to switch *between*: there
is a capability that is on or off.

```
     off                      on
┌──────────────┐      ┌──────────────┐
│   ▦ Edit     │      │ ▐ ▦ Edit ▌   │   filled pill, not a grey shade
└──────────────┘      └──────────────┘
```

Absent, never disabled, for sessions that cannot write — the rule the current
switch already follows.

### Selection toolbar — Miro/Figma's contextual pattern

The thing that stops the bottom bar growing forever: **actions on a selection
float next to the selection**, not in a global bar. This is Figma's selection
toolbar and Miro's shape toolbar, and it is why neither has a bottom bar that
grows with every feature.

```
                    ┌─────────────────────────────┐
                    │  ◇ Make slice   ✎   🗑      │   ← floats above the picks
                    └─────────────────────────────┘
        ┌────────┐  ┌────────┐  ┌────────┐
        │  ▣ 1   │  │  ▣ 2   │  │  ▣ 3   │            ← three cells picked
        └────────┘  └────────┘  └────────┘
```

- Appears at **two or more** picks. At exactly one the detail panel is the
  surface instead (Decision 3).
- Anchored above the selection's bounding box, flipping below when there is no
  room — the standard rule.
- `◇ Make slice` is the old *New slice* button, now beside the cells it will
  use, with the count implicit in what is highlighted rather than printed on a
  badge that changes the bar's width.

### The dropdowns

```
✎ Draw                  ▢ Shapes                T Content
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ ✓ ✎  Pen         │    │ ✓ ▭  Rectangle   │    │ ✓ T  Text        │
│   ⌫  Eraser      │    │   ◯  Ellipse     │    │   ▪  Sticky note │
└──────────────────┘    │   ／  Line       │    └──────────────────┘
                        │   ↗  Arrow       │
                        └──────────────────┘
```

Clicking the icon activates the family's current tool; the chevron opens the
list; the chosen row becomes the face icon. Figma's behaviour, and the reason a
family costs one slot rather than four.

Line and Arrow are proposed additions — the mark-up layer can draw boxes but
cannot point at anything, which is the most common review gesture. Easy to drop.

---

## What leaves the bottom bar

| Gone | Where it went |
|---|---|
| New blueprint | sidebar, phase row `+` |
| New path | sidebar, PATHS header `+` |
| Delete path | sidebar, path row `⋯` |
| Edit cell | clicking one cell (already worked) |
| New slice ③ | selection toolbar, floating over the picks |
| the mode switch's second segment | a single Edit toggle |

Five labelled buttons plus a switch → **four tool families plus one toggle**,
identical in both modes.

---

## Implementation phases

Each is shippable alone; none depends on a later one.

**Phase 1 — selection grammar.** Toggle by default in Edit mode, shift extends
a range, panel opens at exactly one, *Edit cell* removed.
`CanvasSelectionProvider.tsx`, `CanvasDesignTools.tsx`. *Fixes the reported bug
and adds no new surface.*

**Phase 2 — one bar, tools in both modes.** Annotation tools stop vanishing in
Edit; the mode switch becomes a single toggle.
`CanvasAnnotationToolbar.tsx`, `canvasModeContext.ts`.

**Phase 3 — selection toolbar.** Floating contextual bar at ≥2 picks, carrying
*Make slice*. Removes *New slice* from the bottom bar.

**Phase 4 — `create_phase` RPC.** The one new backend function, in the same
`security definer` style as the other sixteen.

**Phase 5 — sidebar creation.** Hover-revealed `+` on the PHASES header, phase
rows and the PATHS header; `⋯` on path rows. Removes three more buttons from
the bar.

**Phase 6 — canvas handles.** Insert affordances between steps and lanes, empty
squares clickable, following the six affordance rules. Uses `add_step`,
`add_lane`, `upsert_cell` — all live.

**Phase 7 — annotation capture.** Not persistence: marks stay ephemeral, and
gain an explicit way out instead. See Decision 5.

---

## Decision 5 — annotations stay a scratch layer, with a way out

Marks vanish on reload today, and the obvious fix — a table — turns out to be
the wrong one. Persisting every stroke makes markup a *record*, which changes
what it is: people stop scribbling freely once a scribble is permanent and
shared, and the layer's whole value is that it costs nothing.

So the layer stays ephemeral, and gains one explicit action:

```
┌───────────────────────────────────────────────┐
│  ▷   ✎ ⌄   ▢ ⌄   T ⌄   🗑   ⇪        │  ▦ Edit │
└───────────────────────────────────────────────┘
                              ▲
                              └─ appears only while marks exist

┌──────────────────────────────┐
│  ⇪  Save as image            │
│  💬  Send to the agent       │   → 003, disabled until it exists
└──────────────────────────────┘
```

Two consequences worth naming:

- **No migration, no RLS, no new table.** Phase 7 shrinks to a menu and an
  export.
- **"Send to the agent" becomes the capture path**, which is what
  [003](./2026-07-31-003-feat-inline-agent-chat-plan.md)'s screen-reading mode
  needs — and it no longer waits on persistence, because the marks are in
  memory at exactly the moment they are sent. That removes the dependency 003
  listed as a prerequisite.

Reloading still loses unsaved marks. That is now a property of the design
rather than a defect, and the affordance says so by existing.

---

## Acceptance criteria

- [ ] Clicking cells one after another in Edit mode accumulates a selection
- [ ] Selecting exactly one cell opens the detail panel; a second closes it
- [ ] Shift-click extends a range in grid reading order
- [ ] The bottom bar is identical in both modes and fits at 800 px
- [ ] Annotation tools are available whether or not Edit is on
- [ ] A new blueprint is created from the phase it belongs to, with no phase picker
- [ ] Sidebar `+` and `⋯` are hidden until hover, and reachable by keyboard
- [ ] A new phase can be created, is scrolled to, and lands last
- [ ] A step can be inserted between two steps, with a preview, without a dialog
- [ ] Insert handles disappear below the zoom threshold
- [ ] Deleting a path is initiated from the path's own row
- [ ] Annotations survive a page reload

---

## Risks

**Toggle-select surprises people who expect Figma.** Mitigation: Edit is
explicitly not an object-manipulation mode, and the panel opening at exactly one
cell gives immediate feedback that the click did something.

**Hover-only affordances are invisible on touch.** Mitigation: coarse pointers
show them permanently; keyboard focus reveals them.

**A floating selection toolbar can cover the cells it describes.** Mitigation:
flip below when there is no room above, and never cover the selection itself.

**A new phase changes the whole canvas layout.** Mitigation: create, then fit
the camera to it, so the consequence is visible rather than found later by
scrolling.

---

## Resolved

- **View and Mark are one mode** — the tool disambiguates.
- **New phase is offered.** `create_phase` shipped.
- **The chat bar is out** of this plan.
- **"Scenario", not "blueprint".** A journey with a grid is a *scenario*, which
  is what the table, the aria-labels and most of the codebase already call it.
  "Blueprint" goes back to meaning the whole artefact — the thing the product is
  named after — rather than one journey inside it. So the button becomes **New
  scenario**, and [001](./2026-07-31-001-design-mode-nav-and-vocabulary-plan.md)'s
  vocabulary table is amended: `service_scenarios` → **scenario**, and the two
  names that were genuinely mine to fix (`version` → **path**, `column` →
  **step**) stand.
- **The selection toolbar carries Make slice only.** Deleting cells stays on
  rows and handles, for the same reason Delete path moved onto its sidebar row:
  a destructive button one pixel from a constructive one is what we are moving
  away from.
- **An empty square reveals a `+` on hover before it is clickable.** Creation
  stays one click, but a stray click while panning or picking never writes a
  row — which matters at ~400 squares, most of them empty.
- **Annotations stay ephemeral.** No table, no migration; the scratch layer
  remains a scratch layer. What it gains instead is an explicit way *out* —
  save the marks, or send them to the agent — so capture is a decision rather
  than a background side effect. See Decision 5.

## Open questions

1. **Line and Arrow** in shapes — wanted, or scope? (Additive; nothing waits on
   it.)

---

## Sources

- `src/contexts/CanvasAnnotationProvider.tsx:27` — annotations are unsaved state
- `src/contexts/canvasModeContext.ts:6` — the mode comment that disagrees with the toolbar
- `src/components/editor/CanvasSelectionProvider.tsx:22` — the Figma grammar note
- `src/components/blueprint/BlueprintCellButton.tsx:133` — `additive: event.shiftKey`
- `src/components/editor/SidebarNav.tsx:180` — `NavSection` `trailing`, `CHEVRON_REVEAL_CLASS`
- `src/components/blueprint/BlueprintColumnHandles.tsx` — where step handles go
- `src/components/blueprint/BlueprintLabelRail.tsx` — where lane handles go
- [2026-07-31-001 nav and vocabulary](./2026-07-31-001-design-mode-nav-and-vocabulary-plan.md) — vocabulary table stands; its toolbar is superseded
- [2026-07-31-003 inline agent](./2026-07-31-003-feat-inline-agent-chat-plan.md) — deferred; the fourth creation surface
- [2026-07-30-004 blueprint authoring](./2026-07-30-004-feat-blueprint-authoring-in-design-mode-plan.md) — the 16 RPCs every write goes through
