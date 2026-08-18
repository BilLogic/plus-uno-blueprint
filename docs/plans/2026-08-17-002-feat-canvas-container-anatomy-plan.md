---
title: 'feat: Canvas container anatomy — one spec for frames, headers, focus, and zoom'
type: feat
status: completed
date: 2026-08-17
---

# feat: Canvas container anatomy — one spec for frames, headers, focus, and zoom

## Overview

Three related complaints trace to the same root: the canvas has no single
written contract for **what lives inside which container**. Column headers
float above the path frame, vertical padding appears as dead space, focus
rings land on rows that are not the selection, and the merged view's path
affiliation is carried by colored side-rails nobody can parse. This plan
specs the container model in lo-fi, then sequences three implementation
units: container/anatomy fixes, the path selector's move to the top bar,
and the merged-view tint redesign.

Visual standard reference: Supabase Studio — quiet containers, one border
per meaning, affiliation by fill not by ornament.

## The container contract (target)

### Anatomy — one scenario board (any zoom)

```
┌─ PANEL (gray artboard, rounded-2xl, bg-viewportPad-contrast) ──────────┐
│  scenario title chip (top-left, on the gray)                           │
│                                                                        │
│  ┌─ PATH FRAME (one per compared path • border in path color) ──────┐  │
│  │ [path badge]                                                     │  │
│  │  ┌─ step header row ─────────────────────────────────────────┐   │  │
│  │  │   Applies   Receives email   Group interviews   …         │   │  │  ← INSIDE the frame
│  │  └───────────────────────────────────────────────────────────┘   │  │
│  │  lane rows (minmax tracks, grow with content)                    │  │
│  │  … INTERACTION LINE … VISIBILITY LINE …                          │  │
│  │  last lane row                                                   │  │
│  └── frame bottom = last row bottom + one gutter ───────────────────┘  │
│   (no dead band: panel bottom = frame bottom + panel padding)          │
└────────────────────────────────────────────────────────────────────────┘
```

**Rules**

1. **The step header row belongs to the path frame**, not to the panel:
   step names are facts about the path's columns. Today the header renders
   above/outside the green border (`COMPARE_STEP_HEADER_HEIGHT` row sits
   before the band in the grid; the frame is drawn around the band only).
   Target: frame top edge wraps the header row; badge overlaps the frame
   edge as now. **The header row gets NO container of its own** (decided
   2026-08-17): it is bare labels inside the frame — no border, no
   background, no box.
2. **No fixed vertical remainder.** Panel height = sum of its children +
   paddings, nothing else. Any hardcoded height that can exceed content
   (the source of the empty band under the last lane) becomes `minHeight`
   on a wrapping element whose bottom hugs content.
3. **One border per meaning.** Panel edge (gray, container) · path frame
   (path color, affiliation) · lane dividers (hairline, structure). No
   second decorative border may wrap any of these.

### Zoom stages

```
zoom ≥ 0.25 (content tier)          zoom < 0.25 (blocks tier)
┌ panel ───────────────┐            ┌ panel ───────────────┐
│ ┌ frame ───────────┐ │            │ ┌ frame ───────────┐ │
│ │ headers + cells  │ │            │ │ ▪ ▪ ▪ ▪ (blocks) │ │
│ │ readable text    │ │            │ │ ▪ ▪ ▪            │ │
│ └──────────────────┘ │            │ └──────────────────┘ │
└──────────────────────┘            └──────────────────────┘
   all borders visible                 frame + panel keep edges;
                                       badges counter-scale WITHOUT
                                       transition (no growing effect)
```

- The **same containers** exist at every stage; tiers change ink, never
  structure. Nothing may appear outside a frame at one zoom and inside at
  another.

### Focus in vs out

```
focused scenario                     unfocused sibling
┌ panel (full ink) ────┐             ┌ panel (dimmed via opacity) ┐
│ frame + content      │             │ everything dims TOGETHER   │
└──────────────────────┘             └────────────────────────────┘
```

- Focus dims **whole panels**, never elements inside one — a header or
  chip that stays bright inside a dimmed panel means it is parented to
  the wrong container (that is the bug's signature).
- **Focus ring ≠ selection.** The green keyboard ring may only appear on
  `:focus-visible`. The sidebar rows currently keep a ring after mouse
  taps (chevron click hands focus to the Collapsible trigger); fix at
  `SidebarNav` so pointer interaction never leaves a ring behind.

## Implementation units

### U1 — Container fixes

- **Files:** `StackedCompareGrid.tsx` / `BlueprintPathBand.tsx` (move the
  step-header row inside the band frame; frame wraps
  `COMPARE_STEP_HEADER_HEIGHT`), `ScenarioBlueprintPanel.tsx` +
  `sideBySideCompareLayout.ts` (audit every fixed height on the panel
  chain → minHeight-on-content), `SidebarNav.tsx` (pointer taps never
  strand a focus ring).
- **Verification:** screenshot sweep at zooms 1.0 / 0.4 / 0.15 on a
  2-path scenario: header inside frame at all three; zero dead band below
  the last lane; click every sidebar row with the mouse — no rings.

### U2 — Path selector to the top bar (desktop)

- Move the multi-select out of the sidebar PATHS section into the canvas
  top bar's right slot (where Reset View sits today):

```
┌ top bar ──────────────────────────────────────────────────────┐
│  Scenario name                    [✓ Happy Path] [✓ Future ▾]  │  ← multi-select
└───────────────────────────────────────────────────────────────┘
   Reset View → floating pill, bottom-right of the canvas
   (exactly the slice view's floatingChrome position)
```

- **Multi-select stays** (desktop compares; mobile stays single-select).
  **Compact trigger** (decided 2026-08-17): never the full path names —
  overlapping path-color dots plus a count (`●● 2 paths ▾`); one selected
  path may show its short name. The popover lists the scenario's paths
  with the same checkmark rows `PathsSidebarSection` renders now — the
  state and `PathSelectionContext` wiring do not change, only where the
  control mounts.
- Sidebar PATHS section retires once the top-bar control lands (one
  owner per fact).
- **Files:** `SlideStickyHeader.tsx` (right slot), new
  `PathSelectorMenu.tsx` (shared popover), `ServiceOverviewView.tsx`
  (Reset View → `floatingChrome` bottom-right, matching SliceView),
  `PathsSidebarSection.tsx` (retire).

### U3 — Merged-view affiliation by tint, not rails

Today: each cell wears a colored left side-rail (HP/FR bars) — "hella
confusing". Target:

```
before                              after
┌──────────────┐                    ┌──────────────┐
│▌HP cell text │  ← colored rail    │ cell text    │  ← bg = path tint
└──────────────┘                    └──────────────┘   (e.g. 8-12% of the
┌──────────────┐                    ┌──────────────┐    path color over
│▌FR cell text │                    │ cell text    │    the lane fill)
└──────────────┘                    └──────────────┘
```

- **Affiliation = background tint** derived from the path color
  (`color-mix(in oklab, <pathColor> 10%, <laneFill>)`), light/dark aware.
  All colored side-rails/lines are deleted.
- **Trigger/needs arrows take the path color** of the path they belong
  to — the arrow itself says which path's flow it traces (today they are
  all one green).
- Divergent-slot stacking, pleats, and the diff ledger keep their
  current geometry; only the affiliation ink changes.
- **Files:** merged cell renderer (side-rail styles) in
  `BlueprintPathBand.tsx` / merged grid, `blueprintTheme.ts` (tint
  helper), arrow drawing in `blueprintCellConnections.ts` (per-path
  stroke), path badge/color source `getPathColor`.

### Sequencing

1. U1 (correctness/anatomy — everything else sits on it)
2. U2 (chrome move; independent of U3)
3. U3 (merged ink redesign; verify against the diff ledger + strip)

## Acceptance criteria

- [ ] Step headers render inside the path frame at every zoom
- [ ] No vertical dead band inside any panel; panel bottom hugs content
- [ ] Mouse interaction never leaves a focus ring on sidebar rows
- [ ] Path multi-select lives in the top bar; Reset View floats
      bottom-right; sidebar PATHS section gone
- [ ] Merged view: no colored side-rails; cells tinted by path; arrows
      stroked in their path's color
- [ ] Ledger/strip/ledger counts unchanged by U3 (ink-only change)

## Sources & references

- Supabase Studio visual standard (loading benchmark:
  [2026-08-17-001](2026-08-17-001-feat-unified-loading-progress-plan.md))
- Todo 026 (row growth + estimator) — the floor this builds on
- Compare v3 review cockpit decisions (merged = per-slot combined grid)
