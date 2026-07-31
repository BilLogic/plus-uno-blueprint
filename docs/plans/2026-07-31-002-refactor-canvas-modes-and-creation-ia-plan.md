---
title: "One canvas: the tool decides the click, Edit decides the affordances"
type: refactor
status: implemented
date: 2026-07-31
---

# One canvas: the tool decides the click, Edit decides the affordances

**Shipped.** All seven phases are built; this stands as the record of why the
shape is what it is. The one open question (Line and Arrow) was additive and is
still open.

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

**Second correction.** A later draft made Edit a single on/off *toggle* and let
annotation tools live in both modes. Both were wrong, and for one reason: these
are two modes, each owning a tool run. A pen active while cells are selectable
is a click with two meanings, which is the exact thing the switch exists to
prevent — and a single button can only answer "which mode am I in" by naming
the other one. So: two segments, and annotation belongs to View alone.

```
View                              Edit
────                              ────
Select / pan · Draw ⌄ ·           Select · Hand · Make slice
Shapes ⌄ · Content ⌄ · Clear
                                  cells are selectable
cells are inert                   insert handles between steps and lanes
                                  empty squares offer a +
                                  sidebar rows reveal + and ⋯ on hover
```

**Edit carries a Hand tool and View does not.** In View a drag on empty canvas
already pans, because there is nothing else it could mean. In Edit the same
drag is a marquee — so without Hand the camera was reachable only by cmd-wheel
or an undiscoverable space-drag, and clicking a scenario picks instead of
fitting to it. A slice may gather cells from blueprints nowhere near each
other (see S3), so crossing the canvas is ordinary work.

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
| a selection | **the Edit tool run** | slice |
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
click B            →  [A B]    → panel closes, Make slice lights up
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

### Edit mode — the full prototype

Every state the bar has. All of it is reachable today except the change group,
which is specced below and not yet built.

```
Edit, nothing picked, nothing changed
┌───────────────────────────────────────────────────────────────────────┐
│  ▷  ✋  │  ◆ Make slice           │            │   👁 View   ✎ Edit   │
└───────────────────────────────────────────────────────────────────────┘
    ▲  ▲       ▲ enabled, not greyed — see "Make slice with nothing picked"
    │  └─ Hand: drag to pan
    └─ Select: click gathers, drag marquees

Edit, three cells picked
┌───────────────────────────────────────────────────────────────────────┐
│  ▷  ✋  │  ◆ Make slice ③   ✕     │            │   👁 View   ✎ Edit   │
└───────────────────────────────────────────────────────────────────────┘
                          ▲     ▲ clear the selection (Esc is invisible)
                          └─ count, so the bar is never counted by eye

Edit, three unsaved changes
┌───────────────────────────────────────────────────────────────────────┐
│  ▷  ✋  │  ◆ Make slice  │  ⚑ 3 changes ⌄   ✓ Save changes  │  👁  ✎  │
└───────────────────────────────────────────────────────────────────────┘
                              ▲                 ▲
                              │                 └─ filled primary. The most
                              │                    prominent thing in the bar
                              │                    while anything is unsaved.
                              └─ opens the sheet below
```

**No undo and no redo buttons.** The list replaces them, and is better than
them: undo is *positional* — it reverses whatever happened last — while a list
is *addressable*. Having added a step, a lane and a cell, wanting the lane back
should not mean undoing two things you meant to keep. Every row in the sheet
carries its own revert, so the common case is one click on the thing you regret
rather than a walk backwards through things you do not.

#### The sheet

A dropdown sheet anchored under the counter, **not a modal**. The canvas stays
live behind it, because half of what the list names is on screen and pointing
at it is the fastest way to know which "Added a cell" is which.

```
                              ⚑ 3 changes ⌄
      ┌──────────────────────────────────────────────────────┐
      │  3 unsaved changes                        Since 14:02│
      ├──────────────────────────────────────────────────────┤
      │                                                      │
      │  ▦ Warm-Up · Happy Path                              │
      │     ▤  Added step “Greet”  after step 2         ↺  ⌖ │
      │     ▢  Added a cell on Front Stage Tech         ↺  ⌖ │
      │                                                      │
      │  ▦ Standard Scheduling · Happy Path                  │
      │     ▭  Added lane “Escalation”                 ↺  ⌖ │
      │                                                      │
      ├──────────────────────────────────────────────────────┤
      │  ⤺ Discard all 3            │      ✓ Save changes    │
      └──────────────────────────────────────────────────────┘
                                              ▲ same action as the bar button
```

Four things the layout is doing:

- **Grouped by scenario and path.** A session can span blueprints (S3), so a
  flat list would put two "Added a cell" rows next to each other with no way to
  tell them apart — the same defect as the arrow picker that offered three
  identical rows.
- **`↺` reverts one row.** This is what replaces undo.
- **`⌖` flies the camera to it.** The cheapest possible answer to "which one is
  that?", and the reason the sheet must not be modal.
- **Named by what was done, not by table.** "Added step *Greet* after step 2",
  never `INSERT path_steps`.

Empty state, when nothing has changed, is not an empty sheet — the counter and
the Save button are simply absent. A permanent Save on a canvas with nothing to
save is a control that lies at rest.

#### Is the counter hard to build?

**The counter and the sheet are cheap. Reverting is not.** They are worth
separating, because the first is a day and the second is the real feature.

Every structural write already funnels through one place — `authoringRpc.ts`,
sixteen functions behind a single `call()`. A session log is an append in that
wrapper:

```ts
// what call() already sees, and everything the list needs
{ fn: 'add_step', args: { path_id, name, at_position }, at: Date.now() }
```

So: **counter, grouping, camera-fly, Save-clears-the-list — all cheap**, and
none of them can be wrong, because the log is a record of calls that were
actually made.

`↺` and `Discard all` are the expensive half, because each needs an inverse:

| Operation | Inverse | Cost |
|---|---|---|
| `create_phase` / `create_scenario` / `create_path` | matching delete | free |
| `add_step` | `remove_step` | free |
| `add_lane` | `remove_lane` | free |
| `upsert_cell` on an empty square | `delete_cell` | free |
| `set_cell_dependency` | `clear_cell_dependency` | free |
| `reorder_*` / `set_path_steps` | re-apply prior order | cheap — capture before |
| `upsert_cell` on an existing cell | re-upsert prior content | ⚠ capture before the call |
| any `delete_*` / `remove_*` | replay `deleted_structure.payload` | ⚠ restore path does not exist |
| storyboard upload | — | ⚠ no inverse; storage is overwritten |

**Recommended split:** ship the log, the counter, the grouped sheet, the camera
fly and Save first — all of it useful on its own, since knowing what you have
changed is most of the value. Add `↺` per row as the inverses land, greying the
rows that cannot be reverted yet rather than pretending they can. `Discard all`
turns on when every row in the session is revertible.

That last rule is the same one deletion already follows: no affordance ships
before the thing that makes it safe. A Discard that silently skips the
storyboard it cannot undo is worse than no Discard.

#### What "Save changes" means

It does not write. Everything is already written — clicking an empty square
calls `upsert_cell` and the row exists. Save **ends the session and clears the
list**: an acknowledgement that the changes are wanted.

That is worth being blunt about in the UI rather than papering over, because a
button labelled Save that does not save is the same class of mistake as the
`grant execute … to authenticated` that read like a gate and was not one. The
sheet says so in one line:

```
      ┌──────────────────────────────────────────────────────┐
      │  3 unsaved changes                        Since 14:02│
      │  Already saved to the database — this list is how you│
      │  can still take them back.                           │
      └──────────────────────────────────────────────────────┘
```

The alternative — buffering every edit and committing on Save — is a much
larger build: the grid renders from the database, so each buffered edit needs
an optimistic overlay the renderer does not have, and a partial commit across a
cross-blueprint session leaves half of it applied. If a true draft session is
wanted it deserves its own plan rather than three buttons on a canvas that
writes as it goes.

#### Edit with a slice open — a state the bar has never had

Everything above assumes a blueprint underneath. Open a slice and the same bar
has a different job: there is nothing to *make*, because the slice already
exists, and the work is arranging what is in it.

```
Edit, editing the slice “Tutor warm-up journey”
┌────────────────────────────────────────────────────────────────────────┐
│  ▷  ✋  │  ◆ 8 frames ⌄   ▷ Present  │  ⚑ 2 ⌄  ✓ Save  │  👁 View ✎ Edit│
└────────────────────────────────────────────────────────────────────────┘
              ▲                ▲
              │                └─ play it, without leaving Edit
              └─ the slice sheet
```

`Make slice` is replaced, not disabled — a different noun is on the canvas, so
a different verb belongs in the slot.

#### Frames live on the cells, and only order lives in the sheet

The split is the same one the whole plan runs on: **what has a location goes on
the canvas, what has none goes in a sheet.** A frame *membership* has a
location — the cell. A frame *order* does not; a frame is not a place.

So membership is edited on the grid:

```
   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ ①        │  │ ①        │  │ ②        │  │ ·        │
   │ Greet    │  │ Ask to   │  │ Mark     │  │ Move to  │
   │ student  │  │ share    │  │ present  │  │ next     │
   └──────────┘  └──────────┘  └──────────┘  └──────────┘
        └─── frame 1 ───┘       └frame 2┘     ▲ in the slice,
                                              no frame yet
```

- **click a badge** → cycles the cell to the next frame, then to “new frame”
- **shift-click two cells** → puts them in the same frame
- **drag a cell onto another** → joins that cell’s frame
- **hover a badge** → every cell not in that frame dims, so the grouping is
  read off the blueprint rather than inferred from a strip

That last one is what the current docked editor cannot do at all, and it is the
whole reason to move: today grouping is inferred from chips labelled `0110ab`,
the last six characters of a UUID.

#### The slice sheet

Dropdown, anchored under `◆ 8 frames`, **not a modal** — same reason as the
change sheet: the cells it names are behind it, and `⌖` points at them.

```
                          ◆ 8 frames ⌄
   ┌───────────────────────────────────────────────────────────┐
   │  Tutor warm-up journey                            journey │
   │  What the regular tutor does and touches while warming up. │
   ├───────────────────────────────────────────────────────────┤
   │                                                           │
   │  ⠿  1   Greet the student                          ⌖  ⋯   │
   │         2 cells · Regular Tutor, Front Stage Tech         │
   │                                                           │
   │  ⠿  2   Ask them to share their screen              ⌖  ⋯   │
   │         2 cells · Regular Tutor, Zoom/Pencil              │
   │                                                           │
   │  ⠿  3   ⟨no caption⟩                                ⌖  ⋯   │
   │         1 cell · Regular Tutor                            │
   │         ⚠ a frame with no caption presents blank          │
   │                                                           │
   │  … 5 more                                                 │
   ├───────────────────────────────────────────────────────────┤
   │  ⊕ Add empty frame          │        1 cell not in a frame │
   └───────────────────────────────────────────────────────────┘
```

What each part is doing:

- **`⠿` drags to reorder.** The only genuinely sheet-shaped action here —
  frame order is a sequence with no representation on the grid.
- **The caption is the row.** Click it and type; it is the thing presented, so
  it should be the most prominent text, not a field inside a card.
- **“2 cells · Regular Tutor, Front Stage Tech”** — lanes, not ids. A frame is
  recognised by *what it contains*, and lane names are how a reader already
  thinks about the grid.
- **`⌖`** flies the camera to the frame’s cells and dims the rest — the same
  gesture as hovering a badge, available from the list.
- **`⋯`** carries split, merge-with-next, and remove — the three that were
  buttons on every card in the old strip, now one menu on the row that needs
  them.
- **The unassigned count** is the footer, permanently, because it is the one
  error the editor used to allow silently: a cell in the slice that no frame
  shows, which presents as a cell that simply never appears.
- **The caption warning** is inline on the offending row, not a validation
  summary somewhere else.

#### What replaces the docked strip

`SliceFrameEditor` stops being the editor. What is left of it is a **scrubber**
— the thing you need while *watching* a slice rather than building one:

```
┌────────────────────────────────────────────────────────────────────┐
│  ◀   ①  ②  ③  ④  ⑤  ⑥  ⑦  ⑧   ▶     “Ask them to share…”         │
└────────────────────────────────────────────────────────────────────┘
        ▲ current                       ▲ the caption of the frame you are on
```

Order is visible, position is visible, and the caption is the one piece of text
that matters at playback. Everything that was drag-a-chip moves to the cells or
the sheet.

#### Why not keep the strip and just fix the labels

Worth stating, because it is the cheaper option and it is still wrong. Swapping
`0110ab` for “Greet the student” makes the strip readable but leaves the
gesture backwards: you would still arrange a slice by dragging text between
cards while the blueprint those cells live on is a foot away on the same
screen, greyed out and unused. The labels were a symptom. The strip being a
*second* representation of the grid is the defect.

#### Make slice with nothing picked

**Not disabled.** A greyed button with a tooltip teaches nothing to the person
who never hovers it, and "pick cells first" is advice you can only read once
you have already guessed that cells are pickable.

Enabled, and clicking it *arms* the picking:

```
before                             after clicking with nothing picked
┌────────────────────┐             ┌──────────────────────────────────────┐
│  ◆ Make slice      │             │  ◆ Click cells to add them   0   ✕   │
└────────────────────┘             └──────────────────────────────────────┘
                                      ▲ the button becomes the instruction
   canvas: cells sit still            canvas: every pickable cell shows a
                                      1px dashed outline for ~2s, then
                                      settles — enough to say "these"
```

- The button relabels to the gesture, and counts up as cells are picked.
- At one pick it returns to **Make slice ①** and stays armed.
- `✕` or Escape disarms.
- The brief outline pass is the part that matters: it answers "what is
  pickable" by showing it, which no tooltip can.

This costs one state and one animation, and it turns the bar's dead control
into the only place the picking gesture is ever taught.

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
| New slice ③ | still in the bar, but filled and primary |
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

**Phase 3 — the slice action.** Tried as a floating bar anchored to the picks,
Figma-style, and **reverted**: picks can span lanes and steps across a canvas
thousands of pixels wide, so a bar on their bounding box lands somewhere
unpredictable and often off-screen — verified at y=-3530. A fixed home beats
proximity when the thing being described has no compact location. *Make slice*
is the filled primary of the Edit run instead.

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

---

## User stories — what the design has to survive

Acceptance criteria below check that parts work. These check that the *shape*
works: each one is a job someone actually does, written so it can be walked
through against the real app. Where the current build fails one, it says so.

### S1 — "Make a slice of what the tutor touches during warm-up"

Pick cells one at a time across a lane, then turn them into a slice.

1. Open Warm-Up, switch to **Edit**
2. Click eight cells on the Regular Tutor lane, one after another
3. The count on **Make slice** reads 8; each cell wears its pick order
4. Click **Make slice**, name it, save

*Passes.* This is the story the selection-grammar fix was for — before it,
step 2 ended with one cell picked.

### S2 — "Actually I want the lane, not eight clicks"

3'. Click the **Regular Tutor** lane label instead → the whole lane is added,
    unioned with anything already picked
3''. Shift-click the lane label → the lane comes back out

*Passes.* `add` rather than `toggle` is why a half-picked lane ends up wholly
picked rather than half-inverted.

### S3 — "This slice spans two blueprints"

A journey that starts in Pre-session scheduling and ends in In-session warm-up.

1. In **Edit**, pick three cells in Standard Scheduling
2. **Pan across the canvas** to Warm-Up — the picks survive
3. Pick four more there; the count reads 7
4. **Make slice**

*Passes as of the Hand tool.* Step 2 was impossible before it: every drag was a
marquee, so the only way across was cmd-wheel or an undiscoverable space-drag.
The selection surviving is not luck — `ZoomPanViewport`'s `resetKey` is a hook
argument, not a React key, so navigating does not remount the picker.

**Still weak:** with picks on two blueprints, nothing on screen says so. The
count says 7 and the other four are off-screen. See "Open" below.

### S4 — "Add a step in the middle of a journey"

1. **Edit**, hover the gap between step 2 and step 3
2. A full-height line and a `+` appear; the ghost shows the columns shifting
3. Click → a blank step lands at position 3, named in place

*Passes.*

### S5 — "This lane is missing a cell at step 4"

1. **Edit**, hover the empty square
2. A faint `+` appears; click → an empty cell exists and can be typed into

*Passes.*

### S6 — "Add a scenario to Onboarding"

1. Hover **Onboarding** in the sidebar → its own `+` appears
2. Click → the dialog opens with the phase already fixed, not asked

*Passes.* The `+` being attached to the row is what makes it unambiguous.

### S7 — "Delete a path I created by mistake"

1. Hover the path row in **Paths** → `⋯`
2. **Delete path** → the confirm names the cells, arrows and slices that die,
   and asks for the name typed exactly

*Passes.* Deliberately not in the tool run, where it sat next to Make slice.

### S8 — "Mark up a blueprint during a review call, then hand it over"

1. **View**, pick Pen from the Draw family, circle two cells, add a sticky
2. A capture button appears — the only sign the marks are not saved
3. Save → structure, not a screenshot: each mark with the cells it overlaps

*Passes.* The capture affordance existing *is* the notice that reloading loses
them.

### S9 — "Reorganise which frames a slice's cells belong to"

1. Open a slice, **Edit**
2. Move the third cell into frame 2

**Fails today.** The frame editor is a docked strip of cards holding chips
labelled `0110ab` — the last six characters of a UUID. You reorganise by
reading identifiers instead of by looking at the blueprint. This is the same
category of defect as the arrow picker that showed three identical rows, and it
is the one story in this list the current design does not support. Specced in
"Frames live on the cells" and "The slice sheet" above.

### S10 — "Read the blueprint without touching anything"

1. **View**, Select tool, click a scenario → the camera fits to it
2. Click a cell → the detail panel opens, nothing is selected, nothing is written

*Passes* — and is the story that keeps annotation tools out of Edit. A pen
active while cells are selectable makes step 2 mean two things.

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

**A selection spanning blueprints is invisible.** With picks on two scenarios
the count says 7 and four of them are off-screen. Unmitigated — see Open.

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

## Open

### 1. A selection spanning blueprints is invisible (from S3)

Picks survive panning between scenarios, but nothing says four of the seven are
somewhere else. Cheapest honest fix: the count becomes `7 · 2 blueprints`, and
hovering it dims everything not picked. A stronger one is a mini-map, which is
a bigger build than the problem currently justifies.

### 2. Slice frames are edited by reading UUIDs (from S9)

Specced above — membership moves onto the cells as frame badges, order and
captions move into the slice sheet, and the docked strip shrinks to a scrubber.
Not built.

### 3. What else belongs in Edit's run

The test is the one that emptied it: **the bar gets what has no location.**
Applied to the obvious candidates —

| Candidate | Verdict |
|---|---|
| Undo / redo | **No.** Superseded by the change list, which is addressable where undo is only positional — reverting the lane you regret should not mean undoing two things you meant to keep. |
| Change counter + sheet | **Yes**, and cheap: every write already funnels through one `call()` in `authoringRpc.ts`. |
| Revert one change | **Yes**, per row, as each operation's inverse lands. |
| Discard all | **Yes**, but only once every row in the session is revertible. |
| Save changes | **Yes**, and prominent — but it ends the session rather than writing, and the sheet says so. |
| Rename step / lane | No — edit in place on the header or rail. |
| Reorder steps | No — drag the header. |
| Duplicate path | No — the path's `⋯` row menu. |
| Add dependency | No — it is a cell-pair relationship; the detail panel already owns it. |
| Frame grouping | No — see 2; it belongs on the cells. |
| Zoom | No — dropped as unhelpful. |

So Edit's run is **Select · Hand · Make slice** today, and **Select · Hand ·
Make slice · ⚑ changes · Save changes** once the session log lands. That is the
whole list; everything else has somewhere better to be.

### 4. Line and Arrow in shapes

Additive; nothing waits on it.

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
