# Agent-UX component inventory

The do-not-reinvent contract: every agent-surface need maps to an
existing `src/components/ui/` primitive (shadcn, base-ui flavor —
triggers take `render={...}`). Verified against the directory 2026-08-04.

| Need | Primitive | Note |
|---|---|---|
| Panel header (SESSIONS · 🔍 · ＋) | `button.tsx` icon variants + `tooltip.tsx` | Figma Pages header row |
| Session groups (Today/Earlier) | `SidebarNav` NavSection (composes `collapsible.tsx`) | the sidebar's one disclosure vocabulary |
| Session fuzzy search | `input.tsx` + subsequence filter | OwnerTagSelect's filter-as-you-type pattern; add shadcn `command` only if this proves insufficient |
| Chat header (‹ back · title · count) | `button.tsx` | nothing else in the header — transcript owns the height |
| Transcript tool-call rows | `collapsible.tsx` + `badge.tsx` | ✦ badge; reuse `describeChange` vocabulary |
| Stop / send | `button.tsx` + `spinner.tsx` | |
| Provider + model pickers | `dropdown-menu.tsx` | model list fetched live from the provider; curated fallback |
| Key entry (⚙) | `popover.tsx` + `input.tsx` type=password | masked after save; localStorage only |
| Session row actions | `context-menu.tsx` | rename/delete — right-click, like every sidebar row |
| Rename / delete confirms | `dialog.tsx` | |
| Empty / loading states | `skeleton.tsx` / `deferred-skeleton.tsx` | |
| Status callouts | `alert.tsx` — `default`/`destructive`/`warning`/`info`/`success` | tinted surface + filled icon chip; copy stays `--foreground` |
| Light/dark switch | `editor/ThemeToggle.tsx` (composes `button.tsx`) | next-themes; lives in the rail's bottom utilities group |

Rule of thumb: a need that seems to lack a primitive usually has a
precedent — check `OwnerTagSelect`, `SessionChangesSheet`,
`SlicesSidebarSection` before assuming it's missing.

## Compare review cockpit (Compare v3, Phases 3–4b)

| Need | Primitive | Note |
|---|---|---|
| Stacked ⇄ Merged mode toggle | `editor/SegmentedControl` in `PhaseMenubarHeader` | Merged = reading preset (Phase 4b, branch-canvas gate FAIL): entering folds shared runs + opens the Differences surface; leaving unfolds. Same via agent `set_scenario_view merged` — one seam in `ScenarioBlueprintPanel` |
| Details │ Differences surface switch | `editor/SegmentedControl` (composes `toggle-group.tsx`) | top-level panel chrome, only while ≥2 paths compared; mono count badge |
| Difference ledger zone groups | `accordion.tsx`, controlled | one open at a time; open state = the compare store's active zone, shared with the strip and `jump_divergence` |
| Ledger filter | `popover.tsx` + pressed chips | lane + verdict facets, empty = all; same grammar as `differences_filter` |
| Zone numbering ①②③ | `blueprint/CompareZoneChip` | ONE drawn chip (mono digit in a circle) — strip, ledger, agent args all mean the same index |
| Divergence strip | `blueprint/CompareDivergenceStrip` | SVG braid, segment buttons (≥44px hits), sidebar-selection idiom for the active zone; navigation only |
| Fly-to-cell + counterpart pulse | `lib/canvasFocusCells` registry → `useZoomPanViewport.focusCells` | resolve at call time by scenario id; pulse = `[data-blueprint-cell-pulse]`, reduced-motion aware |
| Cross-surface compare state | `lib/compareReviewStore` (module store + `useSyncExternalStore`) | model registration, active zone, ledger filters, ledger-open flag, fold state |
| `[⇤ Fold]` menubar toggle | `button.tsx` ghost + `aria-pressed` + `tooltip.tsx` | disabled at 0 differences or 0 foldable columns; tooltip carries the "Fold N shared steps" count |
| Folded pleats | `blueprint/BlueprintPathBand` `ComparePleatCell` + `tooltip.tsx` | one fixed 28px track per shared run fragment (pin-split, `lib/compareFold`); click expands; `gridTemplateColumns` never animates |
| Pinned-column explainer | `Link2` glyph in the column header + `tooltip.tsx` | one-hop pin rule (`computePinnedColumns`) — "kept expanded — feeds a divergent step" |
| Fly-to while folded | `lib/compareZoneNavigation.focusCompareCells` | THE compare focus gesture: auto-expands the target's pleat, waits two rAFs, aborts on a newer generation |

Agent parity for these surfaces: ui commands `differences_open`,
`differences_close`, `panel_surface <details|differences>`,
`differences_filter <lane:"…" verdict:…>`, `jump_divergence
<next|prev|n>`, `collapse_shared <true|false|empty toggles>`,
`toggle_pleat <columnKey or 1-based pleat index>`; read tool
`get_compare_diff` (headless `buildCompareModel` — grounds zone indices,
lane names, columnKeys and cell ids); `get_ui_state` gains a `compare`
line (mode, paths, counts, active zone, ledger open + filters, fold
state).

Full DS directory today: accordion, alert, attachment, badge, breadcrumb,
bubble, button, card, carousel, collapsible, context-menu,
deferred-skeleton, dialog, drawer, dropdown-menu, input, marker, menubar,
message, message-scroller, navigation-menu, popover, separator, sheet,
sidebar, skeleton, spinner, tabs, toggle-group, toggle, tooltip.
