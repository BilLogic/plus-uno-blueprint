---
title: "Blueprint authoring in Design mode — create scenarios, edit the grid, fill in everything a cell carries"
type: feat
status: active
date: 2026-07-30
origin: docs/plans/2026-07-30-003-feat-view-design-mode-authoring-plan.md
---

# Blueprint authoring in Design mode

Plan only — no implementation until sign-off. Local doc, not pushed.

Companion to [2026-07-30-003 View / Design mode](./2026-07-30-003-feat-view-design-mode-authoring-plan.md),
which specced the mode switch, the selection model and slice authoring. That
plan deferred blueprint creation behind an A/B/C choice. **This plan is option
B**: the app writes blueprint structure, and the structure survives.

## Overview

Today the app can read a blueprint and write three things onto it: slices,
evidence, and the Function / Form / Value columns. Everything else — the
scenarios, lanes, steps, cells, arrows, links — arrives only through
`supabase/seed.sql` or (in the template) the IR pipeline. This plan makes the
canvas an editor: create a scenario, fill its grid, connect its cells, and
attach everything a cell carries.

Two findings from reading the live schema reshape how it has to be built. They
are in "Research findings" below, but in short:

1. **`path_steps` has a non-deferrable `UNIQUE (path_id, column_position)`.**
   Inserting or reordering a column cannot be done with PostgREST row writes
   without a window where the grid is corrupt. Structural edits need
   **database functions**, not table grants.
2. **No INSERT or DELETE policy exists on any structural table.** Every write
   path this plan needs is new surface — which is an opportunity to expose
   *operations* rather than *tables*.

## Problem statement

Three distinct gaps, each with a different cost:

**Creating a blueprint.** There is no path at all. A new scenario means editing
`seed.sql` and re-running it, which destroys every app-authored field on the
whole database (the reason `scripts/authored_fields.mjs` exists).

**Filling in a cell.** A cell carries eleven authorable things. Four are
editable in the app today (Function, Form, Value, evidence). The rest — label,
description, owner pair, dependencies, needs, resources, lane metadata, phase
metadata — are either ungranted or have no UI, despite several being granted
months ago and simply never wired up.

**Keeping it.** `authored_fields.mjs` restores *columns onto rows that still
exist*. A scenario created in the app has no row after a seed reset — there is
nothing to restore onto. Structure needs a different mechanism than
annotations do, and today it has none.

## Research findings

Read from the live database (`osybxeojvsqcwxkgnalm`), not from memory.

### The insert trigger is strict, and it dictates ordering

```plpgsql
-- cells_validate_path_match(), verbatim behaviour
if layer_path is null           then raise 'cells: layer_id does not exist';
if layer_path <> new.path_id    then raise 'cells.path_id must match layers.path_id';
if not step_on_path             then raise 'cells.step_id must be linked to cells.path_id in path_steps';
```

Creating one cell therefore requires, in order: a `layers` row on the target
path → a `steps` row on the scenario → a `path_steps` row linking that step to
that path → then the cell. Any other order aborts the statement.

### `path_steps` cannot be reordered row by row

| Constraint | Deferrable? |
|---|---|
| `path_steps_path_column_unique UNIQUE (path_id, column_position)` | **No** |
| `slice_items_position_unique UNIQUE (slice_id, position)` | Yes — `DEFERRABLE INITIALLY DEFERRED` |

`slice_items` was built deferrable precisely so the frame editor could reorder
in one batch. `path_steps` was not. Inserting a column at position 2 of 6 means
shifting four rows, and over PostgREST that is four separate statements, each
of which collides with the constraint until the whole sequence completes.

Two ways out, and only one is honest:

- **Make the constraint deferrable** (a migration) and batch the writes. Still
  multiple round trips; a dropped connection mid-sequence leaves a scrambled
  grid with no rollback.
- **Do it in a database function.** One statement from the client, one
  transaction on the server, atomic by construction.

### There are no write policies to extend

Every structural table carries exactly one policy: `SELECT ... USING (true)`.
`cells` and `layers` additionally carry a column-scoped `UPDATE ... TO
authenticated`. There is **no INSERT and no DELETE anywhere** — so nothing is
being loosened here, everything is being added.

### Storage is ready but narrow

`slice-illustrations`: public read, 5 MB limit, **`allowed_mime_types =
['image/png']`**. Human uploads will be JPEGs and WebPs; the bucket has to be
widened or uploads will fail with a mime rejection that reads like a bug.

## Proposed solution

### Decision 1 — structural edits go through database functions, not grants

Expose **operations**, not tables. Instead of granting INSERT/DELETE on six
tables and hoping the client composes them correctly, add `security definer`
functions that each perform one valid, complete edit:

```
create_scenario(phase_id, name, lane_source_path_id|null, lane_set jsonb, step_count)
add_step(path_id, name, after_position)          -- shifts columns atomically
remove_step(step_id)
reorder_steps(path_id, step_ids uuid[])          -- whole new order in one call
add_lane(scenario_id, name, layer_role, after_row)   -- writes to EVERY path
remove_lane(scenario_id, lane_name)
reorder_lanes(scenario_id, lane_names text[])
upsert_cell(path_id, layer_id, step_id, content) -- trigger-safe ordering inside
delete_cell(cell_id)
set_cell_dependency(source_cell_id, target_cell_id, kind, label, note)
clear_cell_dependency(dependency_id)
```

Why this is the right shape here, beyond the constraint problem:

- The trigger's ordering requirement lives **once**, in the function, instead
  of being re-derived by every caller.
- The client cannot express an invalid operation. There is no "insert a cell
  without a path_steps row" call to make.
- Grants become `grant execute on function … to authenticated` — a much
  smaller surface than write access to the blueprint's tables.
- The same functions are what a future template port and the map skill would
  call, so the rules do not fork.

**Lanes are per path.** `layers` rows belong to a path, so a scenario with
three paths has three copies of each lane. `add_lane` writes to every path in
the scenario — a lane that exists on only one path renders as a hole in the
integrated view. This is exactly the kind of rule that must live in the
function, not the component.

### Decision 2 — provenance on structural rows

Add to `service_scenarios`, `paths`, `steps`, `layers`, `cells`:

```sql
alter table public.<t> add column origin text not null default 'import'
  constraint <t>_origin_check check (origin in ('import','app'));
```

Without it, nothing can tell an app-created scenario from an imported one, and
therefore nothing can protect it. Slices already carry exactly this field for
the same reason.

### Decision 3 — `authored_fields.mjs` grows a structure mode

Today it exports *columns keyed by natural keys*. It gains a second payload:
whole rows for everything with `origin='app'`, in dependency order, so restore
can **recreate** them rather than update them.

```
docs/authored-fields.json
├── fields   { cells:[…], layers:[…], phases:[…] }   ← today: update in place
└── structure                                        ← new: recreate
    ├── scenarios [{phase, name, view_type, order, paths:[…]}]
    ├── steps     [{scenario, name, paths:[{path, column_position}]}]
    ├── lanes     [{scenario, path, name, layer_role, row_position}]
    ├── cells     [{path, layer, step, content, description, links, …}]
    └── deps      [{source:{path,layer,step}, target:{…}, kind, label, note}]
```

Restore replays it through the same RPCs the UI uses — so the restore path is
never a second, divergent implementation of "create a blueprint".

**Ordering hazard:** dependencies reference cells by natural key, so they
restore last. A dependency whose endpoint is missing is reported, never
silently dropped.

## ASCII prototypes

### 1. New blueprint (creation menu → Blueprint…)

```
┌─ New blueprint ────────────────────────────────────┐
│                                                     │
│  Name     [ Fill-in request                      ]  │
│  Phase    [ Pre-session                        ▾ ]  │
│  View     ( ) single   (•) integrated   ( ) compare │
│                                                     │
│  Lanes    (•) Copy from  [ Warm-Up             ▾ ]  │
│               ✓ Visual        ✓ Regular Tutor       │
│               ✓ Lead Tutor    ✓ Front Stage Tech    │
│               ✓ Partner Action: Teacher             │
│               (uncheck to leave one out)            │
│           ( ) Standard set                          │
│           ( ) Start empty                           │
│                                                     │
│  Steps    [ 5 ] columns, named later                │
│                                                     │
│                          [ Cancel ]  [ Create ]     │
└─────────────────────────────────────────────────────┘
```

Copy-from is the default and pre-selects every lane of the source. Lane
vocabulary drifting between scenarios is the most common blueprint defect;
copying is the cheapest possible fix for it.

### 2. The empty grid, immediately after Create

```
                 ┌────────┬────────┬────────┬────────┬────────┐
                 │ Step 1 │ Step 2 │ Step 3 │ Step 4 │ Step 5 │  ⊕
                 │ ✎ name │ ✎ name │        │        │        │
┌────────────────┼────────┼────────┼────────┼────────┼────────┤
│ Visual         │   +    │   +    │   +    │   +    │   +    │
├────────────────┼────────┼────────┼────────┼────────┼────────┤
│ Regular Tutor  │   +    │   +    │   +    │   +    │   +    │
├────────────────┼────────┼────────┼────────┼────────┼────────┤
│ Lead Tutor     │   +    │   +    │   +    │   +    │   +    │
├────────────────┼────────┼────────┼────────┼────────┼────────┤
│ Front Stage    │   +    │   +    │   +    │   +    │   +    │
├────────────────┴────────┴────────┴────────┴────────┴────────┤
│ ⊕ add lane                                                   │
└──────────────────────────────────────────────────────────────┘

  `+` appears on hover only — at rest the grid is empty space, not
  a field of plus signs.
```

### 3. Creating a cell

```
click a `+`                    type                     commit
┌────────┐                ┌────────────┐            ┌────────────┐
│   +    │      →         │▌           │    →       │ Enter      │
│        │                │            │  ⏎ or blur │ breakout   │
└────────┘                └────────────┘  Esc=cancel │ room.      │
                          autofocus                  └────────────┘
```

⏎ commits and moves to the cell below (column-wise authoring is how people
actually fill a lane); ⇧⏎ commits and moves right; Esc abandons an empty cell
without creating a row.

### 4. Lane header — hover and menu

```
hover                              click ⋯
┌────────────────────┐            ┌──────────────────────────┐
│ ⠿ Regular Tutor  ⋯ │            │ ✎ Rename                 │
└────────────────────┘            │ ⇅ Move up / Move down    │
  ⠿ = drag to reorder             │ ◑ Role: Customer actions▸│
  whole row tints on hover        │ ⓘ Owner, KPIs, tools…    │
                                  │ ─────────────────────────│
                                  │ 🗑 Delete lane (12 cells) │
                                  └──────────────────────────┘
```

Delete always names the cell count it takes with it. `Owner, KPIs, tools…`
opens the lane metadata popover (fields that are **already granted** and have
simply never had UI).

### 5. Step header — same grammar, plus insert

```
┌──────────────────────┐          ┌──────────────────────────┐
│  ⠿  Greet Student  ⋯ │          │ ✎ Rename                 │
│                    ⊕ │          │ ⊕ Insert column before   │
└──────────────────────┘          │ ⊕ Insert column after    │
   ⊕ on the right edge            │ ⇅ Move left / Move right │
   inserts after this column      │ ─────────────────────────│
                                  │ 🗑 Delete column (4 cells)│
                                  └──────────────────────────┘
```

Every one of these is a single `add_step` / `reorder_steps` / `remove_step`
call. The client never computes a `column_position`.

### 6. Cell panel — Overview, in Design mode

```
┌ In-session › Warm-Up › Step 1 ────────────── ⧉  ✕ ┐
│ ┌────────────────────────────────────────────────┐ │
│ │              (illustration)                    │ │
│ └────────────────────────────────────────────────┘ │
│ Enter breakout room.                          ✎    │
│ ╭─────────────╮                                    │
│ │ Regular Tutor│  lane chip                        │
│ ╰─────────────╯                                    │
│ The tutor joins the room the student is in.   ✎    │
│                                                     │
│ FUNCTION                                       ✎    │
│ Be present before the student needs anything.       │
│ FORM                                           ✎    │
│ Camera on, greeting within five seconds.            │
│ VALUE                                          ✎    │
│ · tutor — knows the room is theirs                  │
│ · student — sees a face, not a queue                │
│ OWNER              Regular Tutor               ✎    │
│ SEEN AS OWNED BY   PLUS                        ✎    │
│                                                     │
│ ┌ Dependencies ┬ Evidence ┬ Resources ┐             │
└─────────────────────────────────────────────────────┘
```

Every `✎` is inline; there is no separate edit screen. In View mode the `✎`
glyphs are absent and the panel is exactly what it is today.

### 7. Dependencies tab, editable

```
┌ Dependencies ┬ Evidence ┬ Resources ┐
│                                          │
│ SET OFF BY                               │
│  ← Zoom/Pencil · Enter Breakout       ✕  │
│     "room opens"                      ✎  │
│                                          │
│ SETS OFF                                 │
│  → Greet student · Greet Student      ✕  │
│                                          │
│ NEEDS  (no arrow drawn)                  │
│  · Roster synced · Lead Tutor         ✕  │
│    "names must match before pairing"  ✎  │
│                                          │
│  [ + Add dependency ]                    │
│      └→ then click the other cell        │
└──────────────────────────────────────────┘
```

`+ Add dependency` puts the canvas in **connect mode**: the source cell stays
lit, the next cell clicked becomes the target, Esc cancels. A small chooser
appears on commit for `trigger` (draws an arrow) vs `needs` (panel-only).

Connect mode is the one place a drag *on* the canvas is allowed, and only as
an alternative to the click-click path — drag from a cell's edge handle to
another cell. Starting the drag on the edge handle, never the cell body, is
what keeps it from competing with marquee selection.

### 8. Resources tab, editable

```
┌ Dependencies ┬ Evidence ┬ Resources ┐
│  🔗 Zoom breakout guide            ✕ │
│     https://…/breakout-rooms       ✎ │
│  📄 Session SOP                    ✕ │
│     https://…/sop.pdf              ✎ │
│  [ + Add resource ]                  │
│    Label [            ]              │
│    URL   [            ]  https only  │
└──────────────────────────────────────┘
```

URLs are validated `https:`-only on write **and** on render — the existing
`safeExternalHref()` rule, applied at both ends.

### 9. Storyboard upload, in the frame strip

```
┌ 1 · Arrive ──────────────┐
│ ┌──────────────────────┐ │
│ │   ⬆ drop an image    │ │  ← drop zone when empty
│ │   or click to pick   │ │
│ └──────────────────────┘ │
│ ① Enter breakout room  ✕ │
│ ② Zoom/Pencil          ✕ │
│ [narrative…]             │
└──────────────────────────┘

with an image:
┌ 1 · Arrive ──────────────┐
│ ┌──────────────────────┐ │
│ │  [thumbnail]    ✕ ↻  │ │  ✕ remove · ↻ replace
│ └──────────────────────┘ │
```

Uploads go to `slice-illustrations/<slice-id>/frame-<position>.<ext>`,
deterministic so a replace overwrites rather than accumulating. On success the
frame's `illustration.updated_at` is stamped — the app cache-busts on it, and
without the stamp viewers keep seeing the old image.

### 10. The slice creation popover — ordering *and* grouping in one list

The radio buttons were the wrong idea. Grouping is not three presets, it is a
thing people need to shape cell by cell — and since they are already dragging
to reorder, the two belong in one gesture space.

**One list, with divider rows.** Cells between two dividers are one screen.
Reordering and re-bucketing become the same drag.

```
┌─ New slice · 6 cells ──────────────────────────────┐
│  Order & grouping              [⟲ reading order]   │
│                                                     │
│  ┌ Screen 1 ────────────────────────────────────┐  │
│  │ Caption [ Arrive                          ]  │  │
│  │  ⠿ ① Enter breakout room                 ✕  │  │
│  │       Regular Tutor · Enter Breakout          │  │
│  │  ⠿ ② Zoom/Pencil                         ✕  │  │
│  │       Front Stage Tech · Enter Breakout       │  │
│  └───────────────────────────────────────────────┘  │
│  ·  ·  ·  ·  ✂ split here  ·  ·  ·  ·  ·  ·  ·  ·   │ ← on hover
│  ┌ Screen 2 ──────────────────────────── ⌥ merge ┐  │
│  │ Caption [ Connect                         ]  │  │
│  │  ⠿ ③ Greet student                       ✕  │  │
│  │  ⠿ ④ Ask them to share screen            ✕  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Quick grouping:  per cell · per step · all in one  │
│                                  [ Create slice ]   │
└─────────────────────────────────────────────────────┘
```

| Gesture | Result |
|---|---|
| Drag a cell row | Move it — within its screen, or into another one |
| Drop a cell on a screen header | Append to that screen |
| Hover the gap between two cells → `✂ split here` | Cut a screen in two at that point |
| `⌥ merge` on a screen header | Fold this screen into the one above |
| Edit the caption inline | Names the screen; blank is allowed |
| Quick grouping | Re-buckets everything at once — a starting point, not a mode |

The three former radio options survive only as **quick grouping** shortcuts.
They set the buckets; everything stays editable afterwards, which is what
makes them safe to offer.

**"Screen", not "frame", in the interface.** Frame is our internal word for
the row in `slice_items`. A screen is what the reader sees in presentation.
The code keeps `frame`; the UI says screen.

This is the same component as the frame strip in the slice editor, rendered
vertically instead of horizontally — one drag implementation, two
orientations, so grouping behaves identically before and after creation.

## Adding another version of a journey (in scope, planned up front)

A scenario holds several versions of the same journey — Warm-Up already has
*Happy Path*, *Alternate Path* and edge cases. They are `paths` rows, and the
sidebar's Paths checklist switches between them. A scenario the app can only
create one version of would be simpler than every scenario already in PLUS,
so this belongs in the design from the start.

**What a version actually costs.** `layers` rows belong to a *path*, not a
scenario — so every version carries its own copy of every lane. `steps` are
scenario-scoped and shared, but `path_steps` decides which steps a version
uses and in what column order. Adding a version therefore means: one `paths`
row, N `layers` rows, M `path_steps` rows, and (if copying) every `cells` row
and the `cell_triggers` between them. That is one RPC, never a client loop:

```
duplicate_path(source_path_id, name, path_type)   -- copy the grid
create_path(scenario_id, name, path_type)         -- lanes only, no cells
delete_path(path_id)
set_path_steps(path_id, step_ids uuid[])          -- which columns this version uses
```

`duplicate_path` remaps `cell_triggers` to the *new* cells — a copied version
whose arrows still point at the original's cells would render arrows leaving
the artboard, which is exactly the bug this remap prevents.

### Version creation

```
sidebar, Design mode                dialog
┌ VERSIONS ─────────────┐    ┌─ New version ─────────────────────┐
│ ✓ Happy Path       ⋯  │    │  Name  [ Student doesn't show   ] │
│ ✓ Alternate Path   ⋯  │    │  Type  ( ) happy    (•) unhappy   │
│   Edge case        ⋯  │    │        ( ) exception ( ) alternate│
│ ⊕ Add version         │    │                                   │
└───────────────────────┘    │  Start from                       │
                             │   (•) Copy [ Happy Path       ▾ ] │
                             │       ✓ also copy cells           │
                             │       ✓ also copy dependencies    │
                             │   ( ) Lanes only, empty grid      │
                             │                                   │
                             │              [Cancel] [ Create ]  │
                             └───────────────────────────────────┘
```

"Copy from Happy Path, cells included" is the common case: an unhappy path is
usually the happy one with three cells changed. Starting blank makes people
retype a grid they already have.

The `⋯` menu per version: rename, change type, edit description and note
(`paths.description` / `paths.note` — columns that exist and have never had
UI), choose which columns it uses, duplicate, delete.

### Which columns a version uses

Steps are shared; versions opt in. This is the `path_steps` subset, and it is
the one grid-shaped control in the app:

```
┌─ Columns in “Student doesn't show” ──────────────────┐
│  ✓ 1  Enter Breakout Room                            │
│  ✓ 2  Greet Student                                  │
│  ☐ 3  Ask Student to Share Screen   (not in this     │
│  ☐ 4  Remind They Can Ask for Help   version)        │
│  ✓ 5  Mark Student Present                           │
│                                                       │
│  Unchecking removes 6 cells from this version.       │
│                              [Cancel]  [ Apply ]      │
└───────────────────────────────────────────────────────┘
```

One `set_path_steps` call takes the whole desired set and reconciles —
inserting, deleting and renumbering `column_position` contiguously in one
transaction. The non-deferrable unique constraint makes any client-side
version of this unsafe.

## Technical approach

### Migration `20260731000000_blueprint_authoring.sql`

1. `origin` column + check constraint on the five structural tables.
2. `path_steps_path_column_unique` → `DEFERRABLE INITIALLY DEFERRED` (belt and
   braces; the RPCs make it unnecessary, but a deferrable constraint is
   strictly safer and matches `slice_items`).
3. The RPC set from Decision 1, all `security definer`, all
   `set search_path = public, pg_catalog, pg_temp`, each stamping
   `origin='app'` on what it creates.
4. `grant execute` on each to `authenticated`; **no new table-level
   INSERT/DELETE grants**.
5. `grant update (content, description, links) on public.cells to authenticated`
   — the ordinary column writes the panel does, which need no function.
6. Widen `slice-illustrations.allowed_mime_types` to
   `['image/png','image/jpeg','image/webp']`.

### Frontend

New: `src/lib/blueprintMutations.ts` (one wrapper per RPC),
`CreateBlueprintDialog`, `GridHeaderRail` (lane + step headers with their
menus), `CellCreateAffordance`, `CellDependencyEditor`, `CellResourcesEditor`,
`LaneMetadataPopover`, `PhaseMetadataEditor`, `FrameIllustrationUpload`,
`ConnectModeOverlay`.

Modified: `BlueprintCellDetailPanel` (inline `✎` affordances gated on Design
mode), `CanvasDesignToolbar` (Blueprint… entry), `SliceFrameEditor` (upload
zone), `CreateSliceDialog` (label fix), `ServiceBlueprintGrid` (hover `+`
affordances, connect-mode hit targets).

**Cache invalidation.** Every structural write invalidates `blueprints:` and
`lifecycle-phases:`; cell writes additionally invalidate `cell-spec:<id>`. The
grid is rendered from a cached query — a write that does not invalidate looks
like it silently failed.

## Implementation status (2026-07-31)

**Phase 1 is written and unapplied. Phases 2–8 cannot start until it lands.**

### Correction: slice recovery was broken before it was built (2026-07-31)

Reviewing the unapplied migration against live data turned up a defect that
would have shipped silently. `cell_natural_key` derived
`path.name/layer.name/step.name` — three parts, unslugified. The keys slices
are actually bound by look like `warm-up/happy/regular-tutor/step-5`, and
`slice_tools.py:cell_key` produces `lifecycle/scenario/path/layer/step`.
Neither matches the derived form, and `paths.name` is "Happy Path" where the
key segment is `happy`. Every recovery lookup would have missed, and missed
*quietly* — Phase 7's entire undo path rests on this function.

The key cannot be derived at all: it is **authored in the IR**, not computed
from display names, and names repeat across scenarios. So the fix is a column,
not a better expression — `cells.cell_key`, written by the import pipeline for
imported rows and minted by `upsert_cell` for app rows. `cell_natural_key` now
reads it and returns null when it was never written; `slices_referencing` now
returns the actual keys each slice would lose, which is what the confirm dialog
and the undo path both need and what its comment had always claimed.

**Blocking data problem this exposed.** `slice_items.cell_keys` today holds
three incompatible conventions across 36 stored keys:

| Shape | Keys | Slices | Recoverable |
|---|---|---|---|
| Raw UUIDs (`a0000000-…`) | 17 | 4 | No — an id, not a key |
| `warm-up/happy/rt/s4` | some of 19 | 3 | Only against itself |
| `warm-up/happy/regular-tutor/step-5` | rest of 19 | 3 | Only against itself |

None matches what `slice_tools.py` emits now. **`cell_keys` is currently
decorative — it cannot recover anything.** Phase 7 therefore gains a
prerequisite: backfill `cells.cell_key` from the IR and rewrite
`slice_items.cell_keys` through one convention, then verify every stored key
resolves to a live cell. Until that passes, the delete confirm must say plainly
which frames it cannot promise to restore rather than implying it can restore
them all — which is why `AffectedSlice.cell_keys` is typed
`Array<string | null>` and not `string[]`.

### Phase status (2026-07-31)

| Phase | State | Verified by |
|---|---|---|
| 1 — backend foundation | Written, **unapplied**; two defects fixed | — |
| 2 — structure export/restore | Landed | Live database: 11/11 cells round-trip, injected collisions refused |
| 3 — create + dialog | Entry point landed | Browser against live data; write reaches PostgREST with the right seven parameters |
| 4 — cell contents | Landed | 7 tests |
| 5 — dependencies | Landed **and mounted** | 6 tests; browser: `set_cell_dependency` reaches PostgREST with its five parameter names |
| 6 — versions | Landed **and mounted** | 5 tests; browser: `create_path` reaches PostgREST with its four parameter names |
| 7 — deletion guardrails | Landed; **affordance wired but hidden** | 8 tests; browser: no delete button renders against a schema with no archive |
| 8 — storyboard upload | Checks landed, **not mounted** | 9 tests |

35 tests, all passing, via `npm test`.

**What "landed" does not mean.** No write path in phases 3–8 has ever
succeeded, because every one of them needs the migration. What is proven is
everything up to the wire: validation, cascade description, key derivation,
link preservation, parameter names. What is not proven is the database
accepting any of it.

**Phase 7 is deliberately inert.** `deletionReadiness(archiveAvailable)`
returns `canDelete: false` while `deleted_structure` does not exist, and the
affordance is hidden rather than disabled. The dialog, the impact reading and
the confirmation are all built and tested; nothing can reach them yet. This
holds the ordering rule below without depending on anyone remembering it.

`archiveAvailable` now comes from `useArchiveAvailable()`, which asks
PostgREST for a row from `deleted_structure` rather than reading a flag. The
app is deployed against more than one database, so the question has to be
answered per-connection: a build cannot know which schema it will be pointed
at. An empty result is availability; only an error is absence. Confirmed in
the browser — against the current schema the Delete version button does not
render at all.

**What the mounting pass changed (2026-07-31, later).** Phases 5, 6 and 7 were
written but reachable from nowhere: `CellDependencyEditor`, `CreateVersionDialog`
and `DeleteStructureDialog` were each imported by no file. They are now mounted —
the arrow editor behind "Add dependency" in the panel's Dependencies tab, the
version dialog and the archive-gated delete in the Design tool run. Both live
write paths were driven in the browser and fail only on function-not-found,
with the parameter names matching the migration exactly.

Mounting surfaced one real defect that no test could have: the arrow picker
labelled candidates by step name and lane, and Discovery runs several columns
all named "Discovers PLUS" — three rows read identically, so choosing between
them was a coin flip. Labels now lead with the column number and sort in grid
reading order. Twenty-five candidates, zero duplicates. Note this is the same
duplicate-name data defect that leaves 24 cells unkeyable; the picker works
around it, the backfill still cannot.

**Phase 8 is written but not mounted.** `storyboardUpload.ts` keys images by
`(sliceId, itemId)` — persisted row ids — and the frame editor works on draft
frames that have no ids until they are saved. Wiring it needs the persisted
slice-item surface, and the bucket's mime widening from the unapplied
migration. Left out deliberately rather than half-wired.

**Still outstanding regardless of the migration:** the `cell_keys` backfill.
Until it runs, `splitByRecoverability` will classify most affected slices as
unrecoverable — which is correct, and is why undo cannot be trusted yet.

### Landed ahead of the migration

`src/lib/authoringRpc.ts` and `src/lib/authoringErrors.ts` — the typed call
seam every later phase writes through, and the mapping that keeps trigger text
("cells.step_id must be linked to cells.path_id in path_steps") out of the UI.
Verified by `tsc` against the migration's actual signatures, which caught six
parameter mismatches that would each have been a silent PostgREST 404:
`add_step` takes `at_position`; `add_lane` is scenario-scoped, takes `at_row`,
and returns void; `create_path`/`duplicate_path` default to `'alternative'`;
`duplicate_path` takes `source_path_id`, `copy_cells`, `copy_dependencies`.

Both files are complete on disk:
- `supabase/migrations/20260731000000_blueprint_authoring_foundation.sql`
- `supabase/migrations/20260731001000_blueprint_authoring_operations.sql`

Applying them needs one command from someone with credentials:

```bash
npx supabase db push
```

Why it was not applied here, for the record: the Supabase MCP
`apply_migration` tool was denied by the permission classifier on four
attempts, and the CLI has no credentials in this environment — the project is
not linked (`supabase/.temp/project-ref` absent) and there is no access token
(`~/.supabase/access-token` absent). Running the same DDL through
`execute_sql` would be the denied action wearing a different name, so it was
not attempted.

Everything downstream — structure export/restore, blueprint creation, grid
editing, dependencies, versions, deletion safety, storyboard upload — depends
on this schema existing. Writing those against a schema that cannot be created
or tested would produce exactly the unverifiable code this plan's acceptance
criteria are designed to prevent.

## Implementation phases

**Phase 1 — backend foundation.** Migration: `origin` columns, deferrable
constraint, the RPC set, grants, bucket mime widening. Verified by SQL, not by
UI: create a scenario, add a column at position 2 of 5, reorder, delete, and
confirm `column_position` stays contiguous and unique throughout.

**Phase 2 — structure export/restore.** `authored_fields.mjs` gains the
`structure` payload and a restore path that replays through the RPCs.
Acceptance: create a scenario in SQL with `origin='app'`, export, wipe it,
restore, and get an identical grid — verified by row counts and a content
diff.

**Phase 3 — create + grid editing.** `CreateBlueprintDialog`, header rails,
cell creation, rename/reorder/delete. Acceptance: a complete scenario can be
built from the dialog to a filled grid without touching SQL.

**Phase 4 — the cell's contents.** Inline editing of label, description,
owner pair; Resources tab; lane and phase metadata popovers. Acceptance: every
row of the authoring-surface table in plan 003 is reachable in the UI.

**Phase 5 — dependencies.** Connect mode, the Dependencies tab editor, trigger
vs needs. Acceptance: an arrow drawn in the app renders identically to one
imported from seed; `needs` never draws an arrow.

**Phase 6 — versions.** `duplicate_path` / `create_path` / `delete_path` /
`set_path_steps`, the version list in the sidebar, the creation dialog, the
columns chooser. Acceptance: duplicating a version copies its cells and remaps
its arrows to the copies — no arrow points at the original's cells.

**Phase 7 — deletion safety.** `deleted_structure` archive, the cascade-counting
confirm with affected slices, undo toast, recovery list, `restore_deleted`
re-pointing `slice_items.cell_ids` by `cell_keys`. Load-bearing markers on
cells that slices reference; tombstone chips in the frame strip; `⚠` on
affected sidebar rows.

**Ordering note:** Phase 7 carries the destructive-delete guardrails, but
delete buttons appear in Phase 3. Either Phase 3 ships without delete (edit
and create only) or Phase 7 moves ahead of it. **Recommended: no delete
affordance ships before its archive exists** — the alternative is a window
where the app can destroy imported structure with nothing behind it.

**Phase 8 — storyboard upload.** Drop zone, deterministic paths,
`updated_at` stamping, replace and remove.

## System-wide impact

**Interaction graph.** `upsert_cell` → `cells` INSERT → fires
`cells_validate_path_match` (reads `layers`, `path_steps`) → on success fires
the `updated_at` trigger. `remove_step` → `steps` DELETE → cascades
`path_steps` **and every `cells` row on that step across all paths** → which
cascades `cell_triggers` on both endpoints. A column delete is therefore a
multi-table cascade, and the confirm dialog must count cells *and* the arrows
that die with them.

**Error propagation.** The trigger raises plain exceptions; PostgREST returns
them as 400 with the message. Those messages ("cells.step_id must be linked to
cells.path_id in path_steps") are correct but not user-facing — the RPC layer
maps each to a sentence a person can act on, and the raw text goes to the
console only.

**State lifecycle risks.** The RPCs are single transactions, so the classic
half-created-scenario is impossible. The remaining risk is *client* state: an
optimistic grid update that the server rejects. Structural writes are therefore
**pessimistic** — the grid re-reads after each RPC. Cell text edits stay
optimistic; they are single-column and cheap to reconcile.

**API surface parity.** Anything the app can do here, the map skill must be
able to do too, or the two diverge. The RPCs are the shared surface; the skill
calls the same functions with the service key rather than composing raw
inserts.

**Integration scenarios worth writing:**
1. Insert a column at position 2 of 6, then reorder, then delete position 4 —
   `column_position` stays contiguous and unique after each.
2. Delete a lane that is an endpoint of five arrows — arrows disappear, no
   orphan `cell_triggers` rows survive.
3. Create a scenario in the app, run the full export → seed reset → restore
   cycle, diff the grid.
4. Two sessions add a column to the same path simultaneously — second call
   either succeeds at the next position or fails cleanly; never a duplicate
   `column_position`.
5. Upload a 6 MB JPEG — rejected with a size message, not a mime error.

## Acceptance criteria

### Functional
- [ ] A scenario can be created, filled, connected and deleted entirely in the app.
- [ ] Deleting imported structure names every cascade — cells, arrows, and the slices that lose frames — and requires typing the name.
- [ ] No delete of imported structure proceeds without a fresh export snapshot behind it.
- [ ] No delete affordance exists in the UI before `deleted_structure` does.
- [ ] A deleted cell leaves a visible tombstone in every slice that referenced it — never a silently shorter slice.
- [ ] Undo within 30 s restores the structure *and* re-points the slices that referenced it, matched by `cell_keys`.
- [ ] Duplicating a version copies its cells and remaps its arrows to the copies.
- [ ] Slice creation supports arbitrary grouping: any cell into any screen, split and merge by hand.
- [ ] Every field in plan 003's authoring-surface table has UI.
- [ ] `needs` dependencies never draw an arrow; `trigger` always does.
- [ ] Deleting a lane or column states how many cells and arrows it removes.
- [ ] Export → reset → restore reproduces an app-created scenario exactly.

### Non-functional
- [ ] No structural write is composed client-side; every one is a single RPC.
- [ ] No new table-level INSERT or DELETE grant exists after the migration.
- [ ] Resource URLs are `https:`-validated on write and on render.
- [ ] Design-mode affordances are absent (not disabled) without write access.

### Quality gates
- [ ] `tsc -b`, `vite build` green; lint ≤ baseline (71).
- [ ] The five integration scenarios above pass against a real database.
- [ ] No user-facing string contains "spec", "frame" (as jargon), or a raw UUID.

## Risks

| Risk | Mitigation |
|---|---|
| RPC set grows into an unmaintainable API | Keep it to the eleven operations listed; anything else is a column update through PostgREST |
| `security definer` functions bypass RLS by design | Each one is scoped to a single operation and validates its inputs; none takes a table name or free SQL |
| Restore diverges from the UI's creation path | Restore replays through the same RPCs — there is deliberately no second implementation |
| App-created structure has no IR key path | Deferred to the template port; `origin='app'` marks exactly which rows will need synthesized keys |
| Seed re-run still destroys everything | Phase 2 lands before Phase 3, so the safety net exists before there is anything to lose |

## Resolved (Bill, 2026-07-30)

| # | Question | Decision |
|---|---|---|
| 1 | Add a second *version* of a journey (path) in the app? | **Yes, planned up front** — see "Adding another version of a journey". Copy-with-cells is the default, since an unhappy path is usually the happy one with three cells changed |
| 2 | May the app delete content it didn't create? | **Yes — allowed**, against the original recommendation. Guardrails below |
| 3 | Do the database functions go into the template? | **Yes**, in stage 2. One behaviour, not two |

### Deleting imported structure — the guardrails

The app may delete `origin='import'` rows. That is genuinely destructive: the
only way back is re-running `seed.sql`, which wipes every app-authored field
on the whole database. Four requirements make it survivable, and none of them
are optional:

1. **The confirm dialog counts what dies**, following every cascade — cells,
   the arrows on both endpoints, and any **slice frames that reference those
   cells**. A slice quietly losing half its cells is the worst outcome here,
   because it stays renderable and simply says less than it did.

   ```
   ┌─ Delete “Warm-Up”? ──────────────────────────────┐
   │  This scenario came from the imported blueprint.  │
   │                                                   │
   │  Deleting it removes                              │
   │    · 3 versions (Happy Path, Alternate, Edge)     │
   │    · 47 cells                                     │
   │    · 12 dependency arrows                         │
   │                                                   │
   │  ⚠ 2 slices reference 9 of these cells and will   │
   │    lose those frames:                             │
   │      ◇ Tutor warm-up journey (cross-lane)         │
   │      ◇ Regular Tutor lane: warm-up                │
   │                                                   │
   │  Type the name to confirm:  [                  ]  │
   │                         [ Cancel ]  [ Delete ]    │
   └───────────────────────────────────────────────────┘
   ```

2. **Type-to-confirm** for imported structure only. App-created rows delete
   with a plain confirm — you made it a minute ago, you know what it is.

3. **Export first.** The dialog runs `authored_fields.mjs export` equivalent
   in-app before deleting, so the JSON snapshot always predates the deletion.
   A delete with no snapshot behind it is refused.

4. **Deleting is a single RPC** (`delete_scenario`, `delete_lane`,
   `delete_step`) that captures the counts and performs the cascade in one
   transaction — so the numbers shown in the dialog are the numbers that die,
   not an estimate taken a moment earlier.

### The real hazard, and the five places it gets handled

The dialog is one moment. The damage it warns about is permanent and quiet:
**a slice whose cells were deleted stays renderable and simply says less than
it did.** Nothing about it looks broken. So the mitigation runs across the
whole lifecycle, not just the confirm.

Good news: two of the five already exist and only need wiring.

**① Prevent — mark what is load-bearing.** In Design mode, a cell referenced
by any slice carries a small marker. You see that a cell matters *before* you
reach for delete.

```
┌──────────────┐
│ Enter        │◇²   ← in 2 slices; hover lists them
│ breakout     │
│ room.        │
└──────────────┘
```

Derived client-side from the already-cached `useSlices` list (the same
membership data the "In slices" panel footer uses) — no new query.

**② Warn — the confirm dialog above**, naming affected slices by title.

**③ Record — archive before deleting.** The delete RPC writes the full
payload to a new table inside the same transaction, before the cascade runs:

```sql
create table public.deleted_structure (
  id            uuid primary key default gen_random_uuid(),
  deleted_at    timestamptz not null default now(),
  kind          text not null check (kind in ('scenario','path','lane','step','cell')),
  label         text not null,     -- for the undo toast and the recovery list
  payload       jsonb not null,    -- every deleted row, natural-keyed, in dependency order
  affected_slices jsonb not null default '[]'::jsonb
);
```

Nothing is truly deleted until the archive row is written. Retention: 30 days,
purged by the same script that runs the export.

**④ Surface — make a broken slice look broken.** `resolveSliceCells()` already
returns `missingCellIds`, and `SliceHeaderBand` already renders the count
(`SliceView.tsx:145`). Three additions finish the job:

```
sidebar                     frame strip (edit mode)
◇ Tutor warm-up journey ⚠   ┌ 2 · Connect ────────────┐
  2 cells missing           │ ③ Greet student       ✕ │
                            │ ⚠ deleted cell        ✕ │ ← was 040303
                            └─────────────────────────┘
```

- The sidebar row carries `⚠` when the slice has unresolvable cells.
- The frame strip shows a **tombstone chip** for each unresolvable
  `cell_key`, so the gap is visible and removable rather than invisible.
- Presentation **skips** tombstones silently — a live audience is the wrong
  place to surface data integrity.

**⑤ Recover — undo, and a recovery list.** The delete toast carries
`[ Undo ]` for 30 seconds, which calls `restore_deleted(id)` and replays the
archived payload through the same create RPCs. After that window it moves to
a recovery list (Design mode → creation menu → "Recently deleted"), where the
last 30 days can be restored by name.

Restoring re-creates rows with **new UUIDs**, so slices referencing the old
ones stay broken unless their `cell_keys` are re-matched. `restore_deleted`
therefore also re-points any `slice_items.cell_ids` whose `cell_keys` match
what it just restored — the recovery column finally doing the job it was
added for.

## Original open questions (kept for context)

### 1. Should the app be able to add a second version of a journey?

A scenario can hold several versions of the same journey — in PLUS, Warm-Up
already has *Happy Path*, *Alternate Path* and a couple of edge cases. They
are what the Paths checklist in the sidebar switches between.

This plan creates a scenario with **one** version (the happy one). Adding a
second — "what happens when the student doesn't show up" — has no UI, so a
scenario built in the app would be simpler than every scenario you already
have.

*Recommendation:* leave it out of the first pass, add "Add another version" in
a later phase. It needs its own thinking about copying the grid from an
existing version rather than starting blank, and that is a second design.

### 2. May the app delete blueprint content it didn't create?

After this lands, two kinds of content sit side by side: rows that came from
`seed.sql` (marked `origin='import'`) and rows made in the app
(`origin='app'`).

The question is whether the delete buttons work on the imported ones. If yes,
two clicks can remove a whole seeded scenario and the only way back is
re-running the seed — which wipes every app-authored field on the entire
database. If no, imported content can be *edited* freely but not deleted, and
only what the app created can be removed by the app.

*Recommendation was:* block it in the first pass. **Overruled** — Bill chose to
allow it, so the guardrails above (cascade counts including affected slices,
type-to-confirm, mandatory export, single-transaction delete) carry the risk
instead.

### 3. Do these database functions go into the template too?

The eleven functions are being written into uno's migration. The template
(`agentic-service-blueprinting`) is the generic version other organizations
would clone.

If they go in, the template's app can author blueprints too, and the skills
can rely on the functions existing. If they don't, the template stays
"blueprints only come from the pipeline", uno and the template diverge in what
their apps can do, and any skill that wants to write structure has to compose
raw inserts — the exact thing Decision 1 exists to avoid.

*Recommendation:* port them in stage 2. Two behaviours is a maintenance cost
with no upside.

## Sources

- Origin: [2026-07-30-003 View / Design mode](./2026-07-30-003-feat-view-design-mode-authoring-plan.md) — option B, the authoring-surface table, and the re-import survival problem.
- Live schema reads (2026-07-30): `cells_validate_path_match` definition; `pg_constraint` deferrability; `pg_policy` (SELECT-only on structural tables); `storage.buckets` mime allowlist.
- `supabase/migrations/20260729120000_derived_layer.sql` — the column-grant pattern this plan follows.
- `scripts/authored_fields.mjs` — the export/restore this plan extends.
