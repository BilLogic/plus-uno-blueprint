---
title: "View / Design mode — one switch that decides what the canvas is for"
type: feat
status: partially-implemented
date: 2026-07-30
---

# View / Design mode

Plan only — no implementation until sign-off. Local doc.

Replaces the modifier-click slice picking shipped in `d5694c7`, which was
undiscoverable by construction: nothing in the UI says cmd-click exists.

## The idea (Bill, 2026-07-30)

One mode switch on the canvas. **View** is today's app — reading, navigating,
annotating. **Design** turns the same canvas into an authoring surface, and
*replaces* the annotation toolbar with creation tools rather than adding a
second toolbar beside it. The creation control offers a choice of what you are
making: a blueprint, or a slice.

The bottom toolbar is the right host: it is already the canvas's tool surface,
it already has a select/pan default, and swapping its contents is a smaller
idea than inventing a new chrome region.

## ⚠ The decision this forces (read before anything else)

"Create blueprint" is not symmetric with "create slice", and the asymmetry is
not cosmetic.

**Today's write invariant:** the map skill writes cells; the app writes only
slices, findings, and the three cell spec columns. The derived-layer migration
enforces it with column-level grants — `revoke update on public.cells`, then
`grant update (function, form, value_props, owner, perceived_owner)`.

**The problem with app-authored blueprint content:** scenario import is
*delete-and-reinsert inside one transaction* (`references/adapter-contract.md`
§3, `data-model.md` "Re-import semantics"). Cell UUIDs are UUIDv5 derived from
IR key paths. A phase, lane, step, or cell created in the app has **no IR key**
— so the next `generate_seed_sql.py` import of that scenario deletes it, with
no warning and no recovery trail. The slice tables survive re-import precisely
because they were designed to (soft references, `cell_keys` recovery column);
blueprint structure has no such protection because nothing was ever supposed
to write it but the pipeline.

So Design mode's blueprint half needs one of these decided first:

| # | Option | What it costs |
|---|---|---|
| **A** | **Design mode edits slices + cell specs only.** "Create blueprint" is not offered; the creation control offers slice types. | Smallest, ships now, keeps every invariant. The app stays read-only for the thing it is named after — which may be the actual complaint. |
| **B** | **App writes blueprint structure, and exports back to IR.** Design-mode edits write the DB *and* a reconcile step regenerates the IR from the DB before the next import. | Honest two-way sync. Needs a DB→IR exporter that does not exist, key-path synthesis for app-created entities, and sign-off re-hashing on every export. Largest by far. |
| **C** | **The app becomes the source of truth; IR import becomes a one-way bootstrap.** Import runs once to seed; after that the DB is canon and the pipeline is import-only-for-new-scenarios. | Simplest mental model, and matches how people expect an app to behave. Abandons the signed-off-IR discipline, the whole review/sign-off gate, and re-import idempotency. |

**Recommendation: A now, B as its own plan.** A is the whole of what the mode
switch needs to be worth building, and it is reversible. C throws away the
sign-off gate, which is the mechanism that keeps a blueprint from being
quietly wrong. If B is wanted, it deserves its own plan with the exporter
specified — not a bullet inside this one.

The rest of this plan assumes **A**, and marks the seams where B would attach.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| **D1** | **Two modes, `view` and `design`.** Mode is per-surface (base canvas and each slice tab keep their own), not global. | Editing a slice while reading the base blueprint is a normal thing to want. A global mode would fight it. |
| **D2** | **The bottom toolbar swaps contents; it never grows a second row.** View keeps select/draw/shapes/text/note/clear. Design shows select, create-slice, spec-edit, and (option B) create-blueprint. | The user's framing, and it keeps one tool surface with one active-tool concept. |
| **D3** | **The switch sits at the right end of the same toolbar**, as a two-segment control, after a divider. | It is a mode, not a tool: keeping it out of the tool run stops it reading as "one more brush", while staying attached to the surface whose behavior it changes. Tools stay left-aligned so their positions do not shift when the set swaps. |
| **D3b** | **No "spec" in user-facing copy.** `function` / `form` / `value_props` are database columns; the UI says **Function**, **Form** and **Value** as section headings, and the tool that opens them is **Edit cell**. | "Spec" is internal jargon that never appears anywhere else in the product. Code and DB comments may keep "spec columns" — the interface may not. |
| **D4** | **Design mode is hidden entirely without write access.** Not disabled — hidden, like every other mutation affordance in this app. | A visitor toggling into a mode where nothing works is worse than not knowing it exists. |
| **D5** | **Annotations persist across the switch but are not editable in Design mode.** Existing ink stays visible, greyed; the draw tools are simply absent. | Annotations are often *why* you entered design mode ("fix the thing I circled"). Deleting or hiding them would be hostile. |
| **D6** | **Mode does not enter the URL.** It is a working state, not a destination. | A shared link should open in View — the reader's mode — regardless of what the sender was doing. |
| **D7** | **Slice edit mode folds into Design mode.** The `Edit` button in the slice header disappears; opening a slice tab in Design mode *is* editing it. | Today there are two overlapping "now clicks mean something else" states. One is enough. |
| **D8** | **Escape leaves Design mode**, after the same unsaved-changes prompt as Cancel. | The mode is the biggest state change on the canvas; it needs the cheapest exit. |

## Prototypes

**The toolbar, both modes:**

```
VIEW (today, plus the switch)
┌────────────────────────────────────────────────────────────┐
│ ↖  ✏️ │ ▢  ◯ │ T  🗒 │ 🗑 │ [ View │ Design ]              │
└────────────────────────────────────────────────────────────┘
  select draw  shapes  text  clear        mode

DESIGN
┌────────────────────────────────────────────────────────────┐
│ ↖ │ ◇ New slice ▾ │ ✎ Edit cell │ ⌫ │ [ View │ Design ]    │
└────────────────────────────────────────────────────────────┘
  select  creation menu    edit      undo        mode
          └─ ◇ Slice from selection
             ▢ Blueprint…          (only under option B / C)
```

Select stays in the same first slot in both modes, so the one tool that
means "do nothing special" never moves.

**Design mode, nothing selected** — the canvas explains itself instead of
waiting for a modifier key nobody knows about:

```
┌────────────────────────────────────────────────┐
│  ▢ ▢ ▢ ▢ ▢   ← cells show a pick affordance    │
│  ▢ ▢ ▢ ▢ ▢     on hover (outline, not fill)    │
│                                                 │
│        Click cells to build a slice.            │
│        ─────────────────────────────            │
└────────────────────────────────────────────────┘
```

## Selection model (Design mode)

Borrowed from Figma, because it is the selection grammar most people already
have in their hands. The grid gives us two things Figma does not have —
lane rows and step columns — and those become first-class selection handles.

| Gesture | Result |
|---|---|
| Click a cell | Select **only** that cell (replaces the selection) |
| Shift-click a cell | **Toggle** that cell in or out of the selection |
| Drag on empty canvas | **Marquee**: selects every cell the rectangle touches (intersect, not contain — a partly-covered cell counts) |
| Shift-drag | Additive marquee — adds to the selection instead of replacing it |
| Click a lane label | Select that whole lane, within the scenario it labels |
| Click a step header | Select that whole column |
| Shift-click a lane label / step header | Add that lane or column to the selection |
| Click empty canvas · Escape | Clear the selection |
| Cmd/Ctrl-A | Select every cell in the focused scenario |

Marquee-drag replaces panning on empty canvas **in Design mode only**. Pan
moves to space-drag and the usual trackpad gestures, which is again what
Figma does — and the middle-drag/scroll paths are untouched, so nobody loses
the way they already pan.

**Hover telegraphs the target.** Hovering a lane label tints the whole row and
the label; hovering a step header tints the column. You see what a click will
take before you take it — the thing that makes row/column selection safe.

**Selection order.** Slices are ordered, selections are not, so the two need a
defined bridge:

- Individual clicks **append in click order** — picking a journey by hand
  keeps the order you walked it.
- Bulk gestures (marquee, lane, column, select-all) append in **grid reading
  order**: columns left to right, and within a column, lanes top to bottom.
- The frame strip is the final authority — anything can be reordered there
  after the fact.

Order is shown as the ① ② ③ badges on picked cells, so it is never a hidden
property of the selection.

## Reordering the selection

The creation control is a **menu that opens into the order list** — not a
right-hand panel. A second right panel would fight the cell detail panel for
the same edge, and would cover the cells you are still picking. Anchoring it
to the control you just clicked keeps the canvas clear and the affordance
next to its cause.

The whole screen, so the anchoring is visible — the list opens **upward out of
the button that counts the selection**, and closes when you click away:

```
┌─ canvas ─────────────────────────────────────────────────────────┐
│                                                                   │
│    ①▓    ▢     ③▓    ▢          ▓ = picked, badge = order        │
│    ▢     ②▓    ▢     ▢          hovering a list row lifts its    │
│                                  cell here, and vice versa        │
│                                                                   │
│              ┌─ Order ──────────────────┬──────────┐              │
│              │                    [⟲ reading order]│              │
│              │  ⠿  ① Enter breakout room        ✕ │              │
│              │       Regular Tutor · Enter Breakout│              │
│              │  ⠿  ② Zoom/Pencil                ✕ │              │
│              │       Front Stage Tech · Enter Break│              │
│              │  ⠿  ③ Greet student              ✕ │              │
│              │       Regular Tutor · Greet Student │              │
│              ├─────────────────────────────────────┤              │
│              │  Frames   ● one per cell            │              │
│              │           ○ group by step           │              │
│              │           ○ single frame            │              │
│              │                   [ Create slice ]  │              │
│              └──────────────┬──────────────────────┘              │
│                             │  ← anchored to the button below     │
│         ┌───────────────────┴───────────────────────────┐         │
│         │ ↖ │ ◇ New slice (3) ▾ │ ✎ Edit cell │ ⌫ │V│D││         │
│         └───────────────────────────────────────────────┘         │
└───────────────────────────────────────────────────────────────────┘
```

`⠿` is the drag handle. The row's second line is the cell's lane and step, so
rows are identifiable without reading ids.

Rules that make it usable rather than fiddly:

- **Drag by the handle**, one row at a time. The list is vertical and short;
  cells beyond ~10 scroll inside the popover rather than growing it past the
  canvas.
- **Keyboard equivalent**: `Alt+↑ / Alt+↓` moves the focused row. Dragging is
  the discoverable path, not the only one.
- **Hover is bidirectional.** Hovering a row lifts that cell on the canvas;
  hovering a cell lifts its row. The list stays connected to the thing it
  describes — which is the whole reason to reorder here rather than in a
  detached dialog.
- **`⟲ reading order`** resets to grid order in one click, for when a
  hand-picked order stopped making sense.
- **`✕` removes** a cell from the selection, and the canvas badge disappears
  with it.
- **Frames choice at creation** replaces the current always-one-cell-per-frame
  default: "group by step" is what a journey usually wants, and getting it
  right at creation saves a merge pass in the editor.

The same `OrderableCellList` component is reused inside the frame strip for
reordering cells within a frame, so the two surfaces share one drag
behaviour rather than inventing a second.

**Design mode, cells picked** — the creation control fills in, no floating bar:

```
┌──────────────────────────────────────────────────────┐
│ [View|Design] │ ↖ │ ◇ New slice (3) ▾ │ ✎ │ ⌫        │
└──────────────────────────────────────────────────────┘
      picked cells carry ① ② ③ in click order
```

**Slice tab in Design mode** — the frame strip from `d5694c7`, kept, with the
fixes below:

```
┌──── canvas: click adds to / removes from the lit frame ────┐
└─────────────────────────────────────────────────────────────┘
┌── frames ───────────────────────────────────────────────────┐
│ ┌ 1 · Arrive ─────────┐ ┌ 2 · Connect ────────┐ ┌ + ┐       │
│ │ ① Enter breakout    │ │ ③ Greet student     │ └───┘       │
│ │    Regular Tutor  ✕ │ │    Regular Tutor  ✕ │             │
│ │ ② Zoom/Pencil     ✕ │ │ ④ Ask to share    ✕ │             │
│ │    Front Stage Tech │ │    Regular Tutor    │             │
│ │ [narrative…]        │ │ [narrative…]        │             │
│ │ Split  Merge→    🗑 │ │ Split  Merge→    🗑 │             │
│ └─────────────────────┘ └─────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## The full authoring surface (Bill, 2026-07-30)

Everything a blueprint carries has to be authorable — cell details,
dependencies, evidence, resources, storyboards. Here is each one, where it
would be edited, and what actually stands in the way today.

| What | Where it is edited | Storage | State today |
|---|---|---|---|
| Cell label | Inline on the grid | `cells.content` | **No grant.** IR-owned |
| Cell description | Panel → Overview | `cells.description` | **No grant.** IR-owned |
| Function / Form / Value | Panel → Overview | `cells.function / form / value_props` | Granted, UI shipped |
| Owner / perceived owner | Panel → Overview | `cells.owner / perceived_owner` | Granted, **no UI** |
| Dependencies (arrows) | Drag cell → cell, or panel → Dependencies | `cell_triggers` (`kind='trigger'`) | **No grant, no UI** |
| Needs (non-arrow) | Panel → Dependencies | `cell_triggers` (`kind='needs'`, `label`, `note`) | **No grant, no UI** |
| Evidence | Panel → Evidence | `evidence` | Granted, UI shipped |
| Resources | Panel → Resources | `cells.links` | **No grant, no UI** — recorded as agent-only |
| Storyboard image | Frame strip → frame | `slice_items.illustration` + `slice-illustrations` bucket | Bucket exists, **no upload UI** |
| Lane owner / KPIs / tools | Lane label → popover | `layers.owner_team / kpis / tools` | Granted, **no UI** |
| Phase impact / requirements | Phase header | `phases.business_impact / operational_requirements` | Granted, **no UI** |

Three groups, and they are not equally hard:

1. **Already granted, just missing UI** — owner pair, lane metadata, phase
   metadata. Pure frontend; no schema work; safe under option A.
2. **Derived-layer writes** — evidence, storyboard upload. Grants exist or are
   a small addition; these tables were built to be app-written.
3. **IR-owned content** — cell label, description, links, triggers. These need
   new column grants *and* they collide with the write invariant.

### ⚠ What survives a re-import

This is the part that decides the whole plan, and it already affects shipped
code.

Scenario import is delete-and-reinsert. When `generate_seed_sql.py` re-imports
a scenario, every `cells` row for it is deleted and recreated from the IR.
Which means:

| Written in the app | Survives re-import? |
|---|---|
| Slices, frames | **Yes** — soft references, no FK, `cell_keys` recovery column |
| Findings, evidence | **Yes** — same design |
| **Function / Form / Value** | **No** — they live on `cells`, which is deleted and recreated |
| Owner / perceived owner | **No** — same |
| Cell label, description, links, triggers | **No** — same |

So the cell editing I shipped this morning is **already exposed**: author
Function and Form in the app, re-import the scenario, and they are gone. Plan
002 anticipated this with a "reconcile step" (diff DB spec columns into the IR
before re-export) — it was never built.

That reframes option A. A is not "the safe option that keeps the invariant" —
A is "the app may write only the derived layer, and cell-level authoring is
either reconciled or accepted as disposable". Anything on `cells` needs the
reconcile step regardless of whether we add one more field or ten.

**What this means for the ask.** Full blueprint authoring — labels,
dependencies, resources — is **option B**. It cannot be done under A without
the edits being silently destroyed on the next import. The honest sequence is:

1. **Reconcile step first** (DB → IR for the columns the app already writes).
   Small, well-defined, and it closes a live hole rather than opening a new
   one.
2. **Then** widen the write surface field by field, each one added to the
   reconciler as it lands.
3. Structural creation (new scenarios, lanes, steps) last — it is the only
   part that needs key-path synthesis for entities the pipeline never made.

## Backend work (the missing half)

Two repos, two different mechanisms, because they have different sources of
truth. This is the piece the earlier draft left blank.

### uno-blueprint — there is no IR

uno's blueprint was never generated from an IR: it came from hand-written
`supabase/seed.sql` with literal UUIDs. So "reconcile back into the IR" has
nothing to reconcile into. The destructive event here is not an IR import —
it is **re-running the seed**, which deletes and recreates the same rows.

What uno needs is therefore an **export/restore pair**, not a reconciler:

```
scripts/authored_fields.mjs export   → docs/authored-fields.json
scripts/authored_fields.mjs restore  ← after any seed reset
```

Keyed by **natural keys, not UUIDs**: `path name / lane name / step name` for
cells, `path / lane` for lanes, `phase name` for phases. UUIDs are exactly
what a reset changes; names are what survives it.

Fields carried (everything the app may write that lives on an IR-owned table):

| Table | Columns |
|---|---|
| `cells` | `function`, `form`, `value_props`, `owner`, `perceived_owner` |
| `layers` | `owner_team`, `kpis`, `tools` |
| `phases` | `business_impact`, `operational_requirements` |

Run `export` before any destructive DB work; `restore` after. The JSON is
committed, so authored content has a home in git rather than living only in
one database.

### agentic-service-blueprinting — a real reconciler

The template does have an IR, so the same problem takes the plan-002 shape:
before re-import, diff the DB's authored columns against the IR and write them
back into the IR file, so the next `generate_seed_sql.py` carries them forward
instead of erasing them.

```
scripts/reconcile_authored.py --ir blueprint/<file>.json --locale en
  → reports every field the DB has and the IR lacks
  → --write applies them into the IR
  → refuses when the scenario's sign-off hash no longer matches
```

The sign-off refusal matters: authored fields changing the IR content means
the IR must be re-signed, and silently mutating a signed artifact is the one
thing the review gate exists to prevent.

### Grants still needed (option B, later phases)

Nothing in group 1 needs a migration — `owner`, `perceived_owner`, lane and
phase metadata are already granted and simply have no UI. The grants that do
not exist yet, in the order the phases want them:

```sql
-- Resources (panel → Resources), currently agent-only
grant update (links) on public.cells to authenticated;

-- Dependencies: arrows and needs
grant insert, update, delete on public.cell_triggers to authenticated;

-- Cell label and description — LAST, and only with the reconciler in place:
-- these are the blueprint's own content, not annotations on it.
grant update (content, description) on public.cells to authenticated;
```

Each one lands **with** its reconciler entry, never before it.

## What "create blueprint" would actually be

Only reachable under option B or C. Sketched here so the choice is made
against something concrete rather than a menu entry.

"Create a blueprint" means **create a scenario** — the unit people navigate,
which owns its steps and paths and renders as one artboard.

**Step 1 — the dialog.** A blueprint cannot start empty; a grid with no lanes
and no steps has nothing to click.

```
┌─ New blueprint ──────────────────────────────┐
│ Name    [ Fill-in request                  ] │
│ Phase   [ Pre-session               ▾ ]      │
│                                              │
│ Lanes   ○ Copy from…  [ Warm-Up        ▾ ]   │
│         ● Standard set (Customer, Frontstage │
│           Actions, Frontstage Tech, …)       │
│         ○ Start empty                        │
│                                              │
│ Steps   [ 5 ] columns to start               │
│                        [Cancel] [Create]     │
└──────────────────────────────────────────────┘
```

Copy-from is the default worth having: lane vocabulary drifting between
scenarios is the single most common blueprint defect, and copying an existing
lane set is the cheapest possible fix.

**Step 2 — the empty grid, edited in place.**

```
        ┌ Step 1 ⊕┐┌ Step 2 ⊕┐┌ Step 3 ⊕┐   ⊕ add step
        │ [name…] ││ [name…] ││ [name…] │
┌───────┼─────────┼┼─────────┼┼─────────┤
│Customer│  ▢      ││  ▢      ││  ▢      │ ← click a cell to type
├───────┼─────────┼┼─────────┼┼─────────┤
│Frontst.│  ▢      ││  ▢      ││  ▢      │
├───────┼─────────┼┼─────────┼┼─────────┤
│   ⊕ add lane                            │
└─────────────────────────────────────────┘
```

- Click an empty intersection → inline text field → a cell exists.
- Column and row headers rename inline; drag them to reorder.
- `⊕` at the end of the header rails adds a step or a lane.
- Deleting a lane or step warns with the count of cells it takes with it.
- Trigger arrows: drag from one cell's edge to another. **Phase 2 of that
  work at the earliest** — arrows have their own geometry engine, and this
  plan should not pretend otherwise.

**Why this is a much bigger build than slices.** Slices write two tables and
never touch cell identity. This writes six (`service_scenarios`, `paths`,
`steps`, `path_steps`, `layers`, `cells`), has to satisfy the
`cells_validate_path_match` trigger on every insert, has to synthesize IR key
paths for entities the pipeline never created — and, under option B, has to
export all of it back into IR before the next import erases it. It is a
second product, not a mode.

## What this fixes from the shipped version

Each of these is a defect in `d5694c7`, not a nice-to-have:

1. **Cell chips show content + lane**, not the last six characters of a UUID.
   The editor currently labels cells `040103`.
2. **Title, subtitle, actor and type become editable** after creation. Today
   `SliceEditSession` passes the existing title straight back through, so a
   typo is permanent short of deleting the slice.
3. **Discoverability** — the mode switch replaces the unteachable modifier
   click, and the empty state says what to do.
4. **Cell reordering within a frame** (drag inside the card), not only
   between frames.
5. **Type is inferred from the selection** — all cells in one lane → `lane`;
   one column → `step`; one cell → `cell`; otherwise `custom`, with the
   inference shown as a pre-selected chip the user can override.
6. **Undo** for the destructive frame operations (delete, merge, split),
   one level, in-session only.

## Technical approach

**State.** A `CanvasModeContext` sibling to the existing canvas contexts,
provided per surface (base view, each slice tab):

```ts
type CanvasMode = 'view' | 'design'
// design-mode substate: what a click does right now
type DesignIntent = { kind: 'idle' } | { kind: 'pick'; cells: string[] }
```

`CellPickContext` from `d5694c7` stays as the click-routing seam and loses
its `plainClick` flag — in Design mode a plain click always picks, in View
mode there is no picker at all. `SliceDraftProvider` collapses into the
design-mode toolbar; the floating bar is deleted.

**The toolbar** splits into `CanvasViewToolbar` (today's contents, extracted)
and `CanvasDesignToolbar`, with `CanvasAnnotationToolbar` becoming the shell
that renders the mode switch plus whichever is active. `CanvasAnnotationTool`
gains no design tools — the two tool unions stay separate, so a design tool
can never leak into the annotation reducer.

**Permissions.** The switch renders only when `canWrite`. With the deployed
app read-only (no sign-in, `to authenticated` policies), that means the switch
appears only on a dev server holding the local authoring key — which is also
what the amber `authoring` badge already announces.

**Seam for option B.** `CanvasDesignToolbar`'s creation control is a menu, not
a button, so "Blueprint…" attaches as a second entry without re-cutting the
component. Nothing else in this plan assumes slices are the only output.

## Implementation status (2026-07-30)

| Phase | State |
|---|---|
| 1 — mode switch, view parity | **Done** (`7a4078a`) |
| 2 — selection model | **Done except column headers** — click, shift-click, lane labels, marquee, Cmd-A, Escape shipped (`0593674`, `a73c8bc`, `003ee9c`) |
| 3 — slice creation in Design mode | **Done**, with the screen composer (`d706743`) |
| 4 — slice editing folded in | **Done** (`7635b59`) — the mode provider moved to the surface level to make it possible |
| 5 — Edit cell tool | **Done** (`b298940`) |

**Column headers need a surface that does not exist yet.** The grid renders no
step-name header row — steps are only column positions for cells — so there is
nothing to click the way a lane label is clicked.

Attempted and reverted: a Design-mode-only handle rail added to
`ServiceBlueprintGrid`, aligned by reusing `LAYER_COLUMN_WIDTH` /
`STEP_COLUMN_WIDTH`. It never rendered, because **every scenario in this
workspace is `side-by-side` and draws through `IntegratedBlueprintGrid`**,
which lays out on CSS subgrid — a header row there is a new grid row, not a
flex row, and is not a paste of the same component. Rather than ship a code
path this dataset cannot exercise, it was removed.

The real work is: a handle rail for the subgrid layout, verified against an
integrated scenario. It belongs with plan 004's grid editing, which specs the
same row with rename and `⊕` affordances — building it twice would be waste.

## Phases

**Phase 1 — mode switch, view parity.** `CanvasModeContext`, the switch, the
toolbar split. Design mode ships with select-only. Acceptance: View is
byte-identical in behavior to today; switching modes moves no camera and
loses no annotation.

**Phase 2 — the selection model.** Click, shift-click, marquee, shift-marquee,
lane and column handles with hover telegraphing, Escape and click-to-clear,
Cmd-A. Pan moves to space-drag in Design mode. Acceptance: every row of the
selection table behaves as written, and View-mode panning is untouched.

**Phase 3 — slice creation in Design mode.** The creation menu, inferred type,
the create dialog. Delete the modifier-click path and the floating bar.
Acceptance: a slice can be made without touching a modifier key; cmd-click no
longer does anything special anywhere.

**Phase 4 — slice editing folded in.** `Edit` button removed; a slice tab in
Design mode is editable. Frame strip fixes 1, 2, 4, 6 above. Acceptance: title
and subtitle editable; chips readable; undo covers delete/merge/split.

**Phase 5 — Edit cell.** The `✎ Edit cell` tool opens the panel straight to an
editable Function / Form / Value. Acceptance: editing is reachable without
hunting for a hover-revealed button, and no screen says "spec".

## Scope boundaries

- Blueprint structural editing is **out** under option A. If B or C is chosen
  it is a separate plan, gated on a DB→IR exporter (B) or on retiring the
  sign-off gate (C).
- Trigger-arrow drawing is out in every option — arrows have their own
  geometry engine and deserve their own plan.
- No collaborative presence. The concurrency guard already handles the
  two-writers case by refusing the second save.
- Annotations stay a View-mode feature; no design-mode ink.
- No copy/paste of cells or slices, v1.

## Acceptance criteria

- [ ] Design mode is unreachable without write access, and invisible rather than disabled.
- [ ] Every interaction available in View today behaves identically after the split.
- [ ] Every row of the selection table verified by hand, including shift-marquee and shift-click-to-remove.
- [ ] Hovering a lane label or step header previews exactly what clicking it selects.
- [ ] A slice can be created and fully edited — including its title — without a modifier key or a hidden affordance.
- [ ] Cell chips name the cell; no raw UUID fragments anywhere in the editor.
- [ ] The word "spec" appears in no user-facing string.
- [ ] Switching modes never moves the camera and never drops annotations.
- [ ] `tsc -b`, `vite build` green; lint ≤ baseline (71).

## Open questions for Bill

1. **Option A, B, or C.** Full blueprint authoring is B — see "What survives a
   re-import". A cannot deliver it without edits being destroyed on the next
   import. My recommendation is now: **build the reconcile step first**
   (it closes a hole that already exists in shipped code), then widen the
   write surface field by field.
2. Should Design mode be **remembered per slice** (reopening a slice you were
   editing returns to Design), or always open in View?
3. Marquee-drag takes over empty-canvas drag in Design mode, moving pan to
   space-drag. Fine, or should marquee need a modifier so drag always pans?
