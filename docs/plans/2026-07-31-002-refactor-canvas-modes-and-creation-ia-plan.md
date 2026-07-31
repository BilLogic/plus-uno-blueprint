---
title: "Canvas modes, creation IA, and the selection grammar"
type: refactor
status: draft — for alignment, not implementation
date: 2026-07-31
---

# Canvas modes, creation IA, and the selection grammar

Plan only. Nothing here is built.

Three things are tangled and have to be untangled in one pass, because each
one's answer changes the others: **what a mode is**, **where creation lives**,
and **what a click means**. The bottom bar is the fourth thing, and it turns
out to be a consequence of the other three rather than a design of its own.

The inline agent is specced separately in
[2026-07-31-003 inline agent](./2026-07-31-003-feat-inline-agent-chat-plan.md).
It is referenced here in one place — Decision 2 — because it is the third
creation surface, and Decision 2 is incomplete without saying so.

---

## Research findings

Read from the code on `feat/derived-layer-slices`, not from memory.

### 1. Annotations are not saved anywhere

`CanvasAnnotationProvider.tsx:27` — `useState<CanvasAnnotation[]>([])`. No
persistence, no table, no localStorage. **Every mark is lost on reload.**

This confirms the annotate/edit split is already real — one writes nothing, one
writes the database — and it is a defect on its own terms regardless of what
else is built on top of it.

### 2. The mode comment and the toolbar disagree

`canvasModeContext.ts:6` says view is *"reading, navigating **and
annotating**"*. `CanvasAnnotationToolbar.tsx:268` drops every annotation tool
the moment Design mode is on. Annotation is documented as belonging to one
mode, implemented as belonging to the other, and in Design mode belongs to
neither.

### 3. The selection grammar is Figma's, and Figma's is wrong here

`CanvasSelectionProvider.tsx:22` states the rule outright:

> *Grammar is Figma's… a plain click replaces, shift toggles, Escape clears.*

That is correct when a selection is **the subject of the next verb** and verbs
are frequent — move it, resize it, delete it. Here the selection is **a set
being assembled**, and there is exactly one verb at the end of it: make a
slice. Replace-on-click means the set can never be built by clicking, which is
the reported symptom.

Every call site already threads `additive: event.shiftKey`
(`BlueprintCellButton.tsx:133`, `BlueprintLabelRail.tsx:178`,
`BlueprintColumnHandles.tsx:118`), so the fix is one default, not a rewrite.

### 4. The sidebar already has the slot the `+` needs

`SidebarNav.tsx:180` — `NavSection` takes a `trailing` prop, and rows carry a
hover-revealed chevron slot. The Notion/Figma "page add" affordance drops in
without new layout primitives.

### 5. The bottom bar overflows today

Five labelled buttons plus the mode switch; at 800 px the switch is clipped off
the right edge. The growth is structural — every capability got its own slot.

---

## Decision 1 — three modes, because a click can mean three things

The mode switch answers exactly one question: **what does clicking do here?**

| Mode | A click… | Writes |
|---|---|---|
| **View** | navigates — focuses a blueprint, opens a cell | nothing |
| **Mark** | draws | nothing (today: not even to disk) |
| **Edit** | selects cells to author with | the database |

This is the framing from the request — *"annotation vs edit mode, one is just
annotate on top of the frame without changing any db stuff, the edit mode would
write into the db"* — with reading split back out of Mark, because navigating
and drawing cannot share a click either.

**Three modes is fewer concepts than two, not more.** Today "design" silently
means *both* "select cells" and "annotation is gone", and "view" means *both*
"navigate" and "draw" depending on a tool that may have been left selected
three minutes ago. Naming the third state removes the hidden one.

**Rejected: annotation as a tool family inside both modes.** Proposed in the
previous plan and wrong — a pen that is active in Edit mode makes clicking
ambiguous again, which is the disease rather than the cure.

---

## Decision 2 — creation follows the hierarchy, not the toolbar

The proposal to "combine all creation options into one menu" is right for some
of these and impossible for the rest, and the reason is worth stating.

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
complete instruction — "add a step *after which one*" is. A global create menu
would have to ask a follow-up question that the canvas answers by being pointed
at.

So creation splits three ways, by what the thing needs in order to exist:

| Needs | Surface | Creates |
|---|---|---|
| a parent | **sidebar `+`** | phase, blueprint, path, slice |
| a position | **canvas handle** | step, lane, cell |
| a sentence | **agent chat** → [003](./2026-07-31-003-feat-inline-agent-chat-plan.md) | any of them, described |

The third row is the one a menu cannot cover, and is why the agent is a
first-class part of this IA rather than an add-on.

### Sidebar `+` — the rule

**The `+` lives on the row that owns the thing it makes.** A section header
creates a sibling at that level; a row's own `+` creates a child inside it.
This is the answer to *"we have this notion of phases vs scenario within a
phase, how might our UI support this?"* — the phase's `+` is attached to the
phase, so it cannot be misread.

```
┌──────────────────────────────┐
│ Blueprints │ Slices          │
├──────────────────────────────┤
│ ⌄ PHASES                 [+] │ ← new phase
│                              │
│   Application            [+] │ ← new blueprint IN Application
│     Discovery                │      (hover-revealed, like the chevron)
│     Interview & Offer        │
│   Onboarding             [+] │
│ ▸ Pre-session            [+] │
│                              │
│ ⌄ PATHS                  [+] │ ← new path in the selected blueprint
│   ✓ Happy Path           [⋯] │      (section hidden until one is selected —
│     Recovery Path        [⋯] │       progressive disclosure, already built)
│                              │
├──────────────────────────────┤
│ ⚙ Settings                   │
└──────────────────────────────┘
```

`[⋯]` on a path row, not `[+]`: a path's children are grid objects, so the row
menu is *Duplicate / Rename / Delete*, and Delete finally moves off the bottom
bar onto the object it destroys.

**New phase is offered.** Phases are seeded and read as fixed (Application →
Post-session), which raised the question of whether they should be creatable at
all — answered yes. Consequences to handle rather than assume away:

- A phase is a **column of the whole canvas**, so creating one changes the
  camera's world. The new phase should be scrolled to, not silently appended
  off-screen.
- `phases` has `order_position` and an optional `loop_to_id`. A new phase goes
  last and loops to nothing; both are editable afterwards from the row menu.
- There is no `create_phase` RPC yet. This is the one part of Decision 2 that
  needs new backend surface — everything else calls functions that already
  exist and are smoke-tested.

### Canvas handles — positional creation

`BlueprintColumnHandles.tsx` and `BlueprintLabelRail.tsx` already exist and
already know their position. They gain an insert affordance:

```
        ┌─────┐   ┌─────┐   ┌─────┐
   ⊕ ───│ 1   │ ⊕ │ 2   │ ⊕ │ 3   │ ⊕     ← between columns: insert step here
        └─────┘   └─────┘   └─────┘
  ┌───┐ ┌───────────────────────────┐
  │ ⊕ │ │                           │      ← between lanes: insert lane here
  ├───┤ ├───────────────────────────┤
  │Vis│ │  ▢    ▢    ▢               │
  ├───┤ ├───────────────────────────┤
  │ ⊕ │ │                           │
```

An empty grid square in Edit mode is its own affordance: clicking it calls
`upsert_cell` and puts the caret in it. No menu, no dialog — the position is
the argument, and it was supplied by pointing.

---

## Decision 3 — click toggles in Edit mode

| Gesture | Today | Proposed |
|---|---|---|
| click a cell | **replaces** the selection | **toggles** it in/out |
| shift-click | toggles | extends a range in reading order |
| drag on empty canvas | marquee, replaces | unchanged |
| Escape | clears | unchanged |
| exactly one cell picked | nothing | **the detail panel opens** |

The last row is the one that pays for the change. It removes the *Edit cell*
button — a button that did what clicking already did — and resolves the
conflict between "click to select" and "click to edit" without inventing a
double-click: pick one cell and you are editing it; pick a second and you are
building a set.

Cost, stated honestly: with toggle semantics there is no gesture meaning
"forget everything and select only this". Escape-then-click is two gestures for
what was one. Judged acceptable because the frequent action here is
accumulating, and the rare one keeps a way to be expressed.

---

## Decision 4 — the bottom bar, after all of the above

Creation left for the sidebar and the canvas. Zoom is dropped (*"not useful"*).
Shortcuts are deferred. What remains is small enough to stop overflowing.

```
View
┌───────────────────────────────────────────────────────────┐
│  ▷ Select        │   ◉👁  ◌✎  ◌▦   │   💬 Ask anything…    │
└───────────────────────────────────────────────────────────┘

Mark
┌───────────────────────────────────────────────────────────┐
│  ▷  ✎⌄  ▢⌄  T⌄  🗑  │   ◌👁  ◉✎  ◌▦   │   💬 Ask anything… │
└───────────────────────────────────────────────────────────┘

Edit
┌───────────────────────────────────────────────────────────┐
│  ▷  ◇ Slice ⌄ ③  │   ◌👁  ◌✎  ◉▦   │   💬 Ask anything…   │
└───────────────────────────────────────────────────────────┘
```

Mode pill: icon-only, the active half filled rather than shaded, tooltips carry
the words. 👁 View · ✎ Mark · ▦ Edit.

The chat bar is drawn here because it occupies the slot in all three modes;
its behaviour is [003](./2026-07-31-003-feat-inline-agent-chat-plan.md). Until
that ships the slot is simply absent — nothing in this plan depends on it.

### The dropdowns that remain

```
✎ Draw                  ▢ Shapes                T Content
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ ✓ ✎  Pen         │    │ ✓ ▭  Rectangle   │    │ ✓ T  Text        │
│   ⌫  Eraser      │    │   ◯  Ellipse     │    │   ▪  Sticky note │
└──────────────────┘    │   ／  Line       │    └──────────────────┘
                        │   ↗  Arrow       │
                        └──────────────────┘

◇ Slice  (Edit mode only)
┌────────────────────────────────────────┐
│   ◇  New slice from selection          │
│      └ 3 cells picked                  │
│  ────────────────────────────────────  │
│   ▷  Present this slice                │
└────────────────────────────────────────┘
```

Line and Arrow are proposed additions — the mark-up layer can draw boxes but
cannot point at anything, which is the most common review gesture. Flagged as
scope, easy to drop.

---

## Implementation phases

Ordered so each is shippable alone and none depends on a later one.

**Phase 1 — selection grammar.** Default `pick` to toggle in Edit mode;
shift-click extends a range; auto-open the panel at exactly one. Removes the
*Edit cell* button. *Fixes the reported bug; adds no new surface.*
`CanvasSelectionProvider.tsx`, `CanvasDesignTools.tsx`.

**Phase 2 — three modes.** Add `mark` to `CanvasMode`, move annotation tools
under it, make the pill icon-only. `canvasModeContext.ts`,
`CanvasAnnotationToolbar.tsx`.

**Phase 3 — `create_phase` RPC.** The one piece of new backend surface, in the
same `security definer` style as the other sixteen, with `order_position`
appended and `origin='app'`.

**Phase 4 — sidebar creation.** `+` on PHASES / phase rows / PATHS, `⋯` on path
rows carrying Delete. Removes *New blueprint*, *New path*, *Delete path* from
the bottom bar. `SidebarNav.tsx` already has `trailing`.

**Phase 5 — canvas creation.** Insert handles between columns and lanes;
click-an-empty-square to create a cell. Uses `add_step` / `add_lane` /
`upsert_cell`, all live and smoke-tested.

**Phase 6 — bottom bar reduction.** What is left after 1–5: pointer, slice,
mode pill.

**Phase 7 — annotation persistence.** Marks survive a reload. Independently
worth doing; also the prerequisite for
[003](./2026-07-31-003-feat-inline-agent-chat-plan.md)'s screen-reading mode.

---

## Acceptance criteria

- [ ] Clicking cells one after another in Edit mode accumulates a selection
- [ ] Selecting exactly one cell opens the detail panel; selecting a second closes it
- [ ] The bottom bar fits at 800 px in all three modes, with no clipped control
- [ ] Annotation tools are reachable in exactly one mode
- [ ] A new blueprint is created from the phase it belongs to, with no phase picker
- [ ] A new phase can be created, is scrolled to, and lands last
- [ ] A step can be inserted between two existing steps without a dialog
- [ ] Deleting a path is initiated from the path's own row
- [ ] Annotations survive a page reload

---

## Risks

**Toggle-select surprises people who expect Figma.** Mitigation: Edit mode is
explicitly not an object-manipulation mode, and the auto-opening panel gives
immediate feedback that a click did something.

**Three modes reads as more complexity, not less.** Mitigation is the framing —
one question, three answers — and the fact that each mode's toolbar shrinks. If
it does not feel simpler once built, merge Mark back into View and accept the
ambiguous click.

**A new phase changes the whole canvas layout.** Mitigation: create, then fit
the camera to it, so the consequence is visible rather than discovered later by
scrolling.

---

## Open questions

1. **"Blueprint" or "scenario"** user-facing? Carried over from
   [001](./2026-07-31-001-design-mode-nav-and-vocabulary-plan.md); the sidebar
   copy in Decision 2 depends on it.
2. **"Mark" or "Annotate"** for the middle mode?
3. **Line and Arrow** in the shapes menu — wanted, or scope?
4. **Cell creation by clicking an empty square** — right, or too easy to do by
   accident on a 400-cell grid?

*Resolved:* new phase **is** offered to users.

---

## Sources

- `src/contexts/CanvasAnnotationProvider.tsx:27` — annotations are unsaved state
- `src/contexts/canvasModeContext.ts:6` — the mode comment that disagrees with the toolbar
- `src/components/editor/CanvasSelectionProvider.tsx:22` — the Figma grammar note
- `src/components/blueprint/BlueprintCellButton.tsx:133` — `additive: event.shiftKey`
- `src/components/editor/SidebarNav.tsx:180` — `NavSection` `trailing` slot
- `src/components/editor/PathsSidebarSection.tsx:137` — existing progressive disclosure
- [2026-07-31-001 design mode nav and vocabulary](./2026-07-31-001-design-mode-nav-and-vocabulary-plan.md) — superseded in part; its vocabulary table stands, its toolbar is replaced by Decision 4
- [2026-07-31-003 inline agent](./2026-07-31-003-feat-inline-agent-chat-plan.md) — the third creation surface
- [2026-07-30-004 blueprint authoring](./2026-07-30-004-feat-blueprint-authoring-in-design-mode-plan.md) — the 16 RPCs every write here goes through
