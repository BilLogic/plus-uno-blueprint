---
title: "feat: Compare v3 — Stacked & Merged views (branch canvas, difference ledger, divergence strip)"
type: feat
status: active
date: 2026-08-06
origin: docs/ideation/2026-08-04-compare-view-v3-ideation.md
---

# feat: Compare v3 — Stacked & Merged views

## Summary

Third attempt at path comparison. The two shipped attempts failed in opposite ways — the merged spine changed the layout too much, the highlight paint too little (see origin doc). v3 rebuilds comparison as **one pure computation feeding four instruments**:

| Instrument | What it does | Ships |
|---|---|---|
| **Stacked view** | Paths as vertical bands on one shared step axis; divergent step columns lightly highlighted | Phase 2b |
| **Difference Ledger** | Floating-panel surface (sibling of cell details) enumerating every difference as zone-grouped diff tables | Phase 3 |
| **Divergence strip** | ~48px braid above the panel, both modes: fork/rejoin topology + zone navigation | Phase 3 |
| **Merged view** | Branch canvas: shared cells drawn once on a spine, divergent runs fork into parallel blocks | Phase 4b — **gated** (see below) |

Controls live in one menubar cluster beside the slide title (≥2 paths selected):

```
Warm-Up ⓘ   [ Stacked ▣ │ Merged ▢ ]   [⇤ Fold]   [≠ 12]        ⊕ ⊖ ⌂
              mode toggle              fold shared  opens ledger
```

**The gate on Merged:** a critique pass measured the real Ecoeled blueprints — compared pairs are **67–95% divergent**, mostly outside the regime where branch geometry beats Stacked+strip. So Merged builds only if, after Phase 1's alignment normalization, the median compared pair yields ≥2 spine segments covering ≥30% of columns. Until then it's a documented design, not a commitment. Stacked + ledger + strip serve the reviewer jobs on the data that exists.

## Locked decisions

| Decision | Choice |
|---|---|
| Mode names | **Stacked / Merged** (client tokens `'stacked'`/`'merged'`; `'merged'` never persisted; DB keeps `'side-by-side'`/`'integrated'`, mapped at two seams via new `viewTypeVocabulary.ts`) |
| Layout | Vertical stacking replaces horizontal side-by-side (focused scenario view only; overview rows keep old horizontal rendering, no compare affordances) |
| Diff signal, Stacked | **Light per-column highlight** on divergent steps (header tint + faint column tint). No per-cell paint anywhere — v2's cell outlines are retired |
| Diff signal, Merged | **Geometry only** (fork = the highlight); zero background paint |
| Signal contract | Ledger `[≠ N]` count is the **authoritative** completeness instrument; canvas geometry is a lossy overview (see taxonomy V7/V8/V9/V12) |
| Panel | Ledger = **sibling surface of the whole cell-detail panel** (`Details │ Differences` top-level switcher); inner cell tabs untouched |
| Ledger layout | Zone-grouped **diff tables** (lane rows × path columns). 2+ zones → accordion, one open; exactly 1 zone → flat table |
| Ledger filter | One `[Filter ▾]`: lane + verdict chips. No path filter (sidebar owns paths) |
| Review/check-off | **Cut from v3** (→ v3.1). No reviewed store, no banner, no footer bar |
| Fold | Works in **both modes** (per-band pleats in Stacked, spine pleats in Merged); one shared per-scenario state; opt-in, both modes start unfolded |
| Pin rule | Shared cell with a **one-hop** trigger/needs edge to a divergent cell never folds (pure-lib `computePinnedColumns`, unit-tested) |
| Controls | All in the menubar cluster; the strip is **navigation only** |
| Zone numbering | ①②③ shared across strip, canvas, ledger, and `jump_divergence <n>` |

## Problem

Reviewer user stories, none served today:

- **R1 Completeness** — count + location of every difference; know when done. Today: eye-scan two 3000px grids.
- **R2 Economy** — read only what differs. Today: zero compression.
- **R3 Topology** — where do paths fork/rejoin. Today: nothing.
- **R4 Adjacency** — read both versions of one cell together. Today: counterparts grid-widths apart.
- **R5 Verdict** — mark differences reviewed. *Deferred to v3.1.*

Code-level pain: unbounded horizontal growth (`getCompareCardWidth` × N, `sideBySideCompareLayout.ts:579-585`), content-only verdicts (`comparePathCells.ts:79-84`), no counterpart navigation, dead `mergeIntegratedBlueprint` computed every render (`ScenarioBlueprintPanel.tsx:136-139`).

## UI states

Real chrome: paths picked in the left sidebar's PATHS section (unchanged); compare cluster in the menubar; strip inside the panel chrome; ledger in the floating right panel.

**S1 — Stacked.** Full vertical bands; divergent step columns lightly tinted; menubar cluster live.

```
┌──────────┬─────────────────────────────────────────────────────────────────┐
│ Phases   │  Warm-Up ⓘ  [ Stacked ▣ │ Merged ▢ ] [⇤ Fold] [≠ 12]   ⊕ ⊖ ⌂    │
│  ▾ Warm… │─────────────────────────────────────────────────────────────────│
│ ─────────│  │ ━①╌╌╌●━━━②╌●━━  ◀ zone 1/2 ▶ │  strip (nav only)            │
│ PATHS    │           Browse  Select  ▁Pay▁▁▁ ▁Confirm  Ship   ▁Rate▁       │
│  ✓ Happy │    ┌ Happy Path ──────────┊········┊········┊──────┊·····┊─┐    │
│  ✓ Crisis│    │ FS  [Browse][Select] ┊[Pay   ]┊[Confirm]┊[Ship]┊[Rate]┊    │
│  · Refund│    │ BS  [      ][Stock✓] ┊[Charge]┊[Email  ]┊[Pack]┊[    ]┊    │
│          │    └──────────────────────┊········┊········┊──────┊·····┊─┘    │
│          │    ┌ Crisis Path ─────────┊········┊········┊──────┊·····┊─┐    │
│          │    │ FS  [Browse][Select] ┊[Pay ✗ ]┊[Called ]┊[Ship]┊[Rate]┊    │
│          │    │ BS  [      ][Stock✓] ┊[Callbk]┊[Log    ]┊[Pack]┊[    ]┊    │
│          │    └──────────────────────┊········┊········┊──────┊·····┊─┘    │
└──────────┴─────────────────────────────────────────────────────────────────┘
     ▁Pay▁ = tinted step header    ┊···┊ = faint column tint (no per-cell marks)
```

**S2 — Merged (if gate passes).** Shared cells once on a spine; divergent runs fork into path-framed blocks; primary path stays on the spine baseline.

```
│  Warm-Up ⓘ  [ Stacked ▢ │ Merged ▣ ] [⇤ Fold] [≠ 12]              ⊕ ⊖ ⌂    │
│──────────────────────────────────────────────────────────────────────────── │
│  │ ━①╌╌╌●━━━②╌●━━  ◀ zone 1/2 ▶ │  strip (nav only)                        │
│                                                                             │
│   spine (shared, once)      ① branches            spine                     │
│  ┌───────────────────┐  ╔═Happy════════════╗  ┌─────────┐                   │
│  │FS [Browse][Selct] │──║FS[Pay   ][Confm] ║──│FS [Ship]│── …               │
│  │BS [      ][Stock✓]│┐ ║BS[Charge][Email] ║ ┌│BS [Pack]│                   │
│  └───────────────────┘│ ╚══════════════════╝ │└─────────┘                   │
│                       │ ╔═Crisis═══════════╗ │                              │
│                       └─║FS[Pay ✗ ][Calld] ║─┘                              │
│                         ║BS[Callbk][Log  ] ║                                │
│                         ╚══════════════════╝                                │
```

- spine = neutral band with its own material (hairline border, slightly recessed) — an object, not an absence
- branch block = existing `ComparePathSectionFrame` (path color + dash + badge), **swatch-only lane rails** (text rail on spine only)
- connectors = 3px frame-weight, **no arrowheads**, orthogonal routing through a fixed fork gutter — never confusable with trigger arrows
- fork badge = drawn zone chip (mono digit in circle), same component on strip and ledger

**S3 — Ledger, collapsed (zone triage).**

```
                                   ┌─ floating panel ──────────────────────┐
                                   │ [ Details ]  [ Differences ●12 ]      │
                                   │───────────────────────────────────────│
                                   │ ⟨Happy⟩ vs ⟨Crisis⟩        [Filter ▾] │
                                   │ 12 differences · 2 zones · 3 detail   │
                                   │ ⓘ triggers/needs are not compared     │
                                   │───────────────────────────────────────│
                                   │ ▸ ① Steps 3–4 · Pay → Callback    7   │
                                   │ ▸ ② Step 6 · Rate                 2   │
                                   │ ▸ Detail-only differences         3   │
                                   └───────────────────────────────────────┘
   2+ zones → accordion (one open) · 1 zone → flat table, no accordion chrome
   "Detail-only" = description/links diffs (unnumbered — they have no canvas zone)
```

**S4 — Ledger, zone open (diff table).** One click opens the zone AND flies the camera to it. Row click re-centers + pulses counterparts; `⇱` opens the cell.

```
                                   │ ▾ ① Steps 3–4 · Pay → Callback    7   │
                                   │ ┌──────────┬─▎Happy────┬─▎Crisis────┐ │
                                   │ │ FrontSt ≠│ "Pay"     │ "Pay ✗ —   │ │
                                   │ │          │           │  card dec…"│ │
                                   │ │ Backst  ≠│ "Charge"  │ "Callback  │ │
                                   │ │          │           │  queued"   │ │
                                   │ │ Tech    ≠│ "Stripe"  │ "Twilio" ⇱ │ │
                                   │ │ FrontSt +│  —        │ "Called by │ │
                                   │ │  (only)  │           │  agent"    │ │
                                   │ └──────────┴───────────┴────────────┘ │
   lane rows (swatch + verdict chip) · path columns (rail-colored headers) · — = absent
```

**S5 — Details surface.** `⇱` selects the cell + flips the switcher; existing cell view untouched (Overview + inner `Dependencies│Evidence│Resources` tabs); "← back to Differences" chip; selection survives switching back. Spine cells open with the full counterpart set (existing `selection.paths` shape) and a "shared across Happy, Crisis" badge.

**S6 — Folded (either mode).** Menubar `⇤ Fold`: per-band pleats in Stacked, spine pleats in Merged; pinned columns (🔗 one-hop link to a divergent cell) stay expanded with a tooltip explaining why. One shared fold state across mode switches.

```
   folded rhythm:  │▸2│ · zone ① · │🔗Stock✓│ · │▸3│ · zone ② · [End]
   everything visible = a difference, or context required to understand one
```

**S7 — Zero differences.** Unbroken spine (itself the message); strip one segment; fold + chip disabled; ledger: "Paths identical across 14 steps."

## How the reviewer uses it

1. Working in **Stacked**, tinted step headers say "Pay, Confirm, Rate differ." Strip shows the fork/rejoin shape.
2. `[≠ 12]` → ledger: zone groups with counts (R1 — countable).
3. Open `①` → camera flies; diff table gives the words, lane × path (R4).
4. `[⇤ Fold]` if wanted → pleats compress shared runs, differences pulled adjacent (R2).
5. `▶` steps zone to zone; strip, canvas, and open ledger group stay in sync (R3).
6. **Merged** (if built): same instruments over the branch canvas — the strip's braid at full scale, counterpart cells stacked one frame apart.

## Merged view — branch anatomy (gated design)

`CompareModel.runs` maps 1:1 onto canvas segments: shared run → **spine segment** (one band, cells rendered once — identical by definition), divergent run → **branch cluster** (one mini-band per path, only that run's columns, full lane rows inside). 'Only'-runs: the owning path gets a block; other paths' connectors pass straight through as a visible **bypass** (tooltip: "Happy Path: no additional steps here"; click focuses the cluster).

Why this isn't v1's failed merged spine: (1) every segment keeps full lane-row anatomy — rhythm intact; (2) the instruments v1 lacked exist (strip narrates, ledger enumerates); (3) Stacked is one toggle away. Honest cost: the lane axis repeats per block (mitigated: swatch-only rails).

Comprehension guards (from critique): primary path's block on the spine baseline so one path always reads as an unbroken band; first-flip coachmark ("Shared steps are drawn once; where paths differ, each path gets its own block"); toggle tooltips; persistent `⟨Happy⟩ vs ⟨Crisis⟩` badges in canvas chrome so a screenshot can't be misread as a flowchart.

### Variance taxonomy — how each shape renders (paths A/B)

| # | Variance | Rendering |
|---|---|---|
| V1 | Substitution (both present, content differs) | Canonical fork: same columns, two blocks |
| V2 | Partial-lane (one lane differs, others same) | Whole **column** forks (lane alignment survives); identical rows inside blocks **de-emphasize with an `=` glyph** so repetition isn't read as a diff; ledger lists only differing lanes |
| V3/V4 | Addition / omission (steps only in one path) | Owning path gets a block; other path = bypass connector |
| V5 | Length mismatch (A:1 step ↔ B:2, adjacent) | Adjacent divergent columns fuse into one cluster; **name-aligned columns inside a fused cluster keep shared x** (only unmatched columns pack) |
| V6 | Multiset (extra cell in same slot) | Same-column fork; blocks differ by cell count in one lane |
| V7 | Invisible (description/links only; content identical) | **No fork, no canvas mark** — two identical blocks would read as a bug. Lives in the ledger's unnumbered "Detail-only differences · N" group; stat line: `12 differences · 2 zones · 3 detail-only` |
| V8 | Reorder | Renders as omission + addition (like text diffs treat moves). Ledger microcopy: "steps are matched by name — a renamed or moved step appears as removed + added" |
| V9 | Rename | Trivial renames (punctuation/articles) align correctly after Phase 1 normalization; substantive renames = remove+add, with a "possibly renamed/moved" tag linking high-overlap omission/addition groups |
| V10 | No shared prefix/suffix | Canvas may start/end with a cluster; degenerate zero-shared = one cluster ≈ Stacked with frames (this is what the gate protects against) |
| V11 | Lone shared step between forks | Minimal spine segment, never fused — rejoin+fork is topology information |
| V12 | Edge-only (cells same, triggers differ) | **Not detected in v3** (signature covers cell fields). Ledger header disclaimer: "triggers/needs are not compared." v3.1 signature widening |

Fork condition: `content` differs OR presence differs. Precedence: presence + content variance fuse when adjacent; V7 rides along as a table row if its column is already in a cluster.

### The Phase 4b gate

Measured on the real Ecoeled fallback data (`src/data/`): compared pairs are 67–95% divergent; the typical spine is one column. **Gate: Merged builds only if, post-normalization, the median compared pair yields ≥2 spine segments covering ≥30% of columns.** Evaluated after Phase 3 dogfood (the check is just `buildCompareModel` over live scenarios). If it fails, Merged stays a documented concept and the toggle doesn't ship.

## Architecture

### One computation: `buildCompareModel` (Phase 1, pure lib)

Replaces `comparePathCells` (flat cell→status map: can't represent absence, carries no reason, hides the alignment machinery). Plain objects (agent-serializable), colocated vitest.

```ts
// src/lib/compareSlots.ts — carries forward the matching-grammar doc comment (comparePathCells.ts:8-13)
export const COMPARE_FIELDS = ['content', 'description', 'links'] as const   // 'owner' in v3.1
export type CompareStatus = 'shared' | 'divergent' | 'only'                  // moves here from integratedBlueprint.ts

export type CompareSlotPathEntry =
  | { present: true; cellIds: [string, ...string[]]; signature: string }
  | { present: false }                                    // absence has no signature — no lying empty string

export interface CompareSlot {
  readonly slotKey: string                                // makeSlotKey(laneKey, columnKey), ' '-joined
  readonly columnKey: string; readonly laneKey: string
  readonly verdict: CompareStatus
  readonly perPath: Readonly<Record<string, CompareSlotPathEntry>>
  readonly differingFields: readonly CompareField[]
}
export interface CompareColumn { columnKey; label; perPathPresent; verdict; agreementGroups }
export interface CompareRun    { kind: 'shared' | 'divergent'; columnKeys }   // boundaries = fork/rejoin
export interface CompareModel {
  readonly slots: readonly CompareSlot[]                  // ordered column-then-lane (tested invariant)
  readonly columns: readonly CompareColumn[]
  readonly runs: readonly CompareRun[]
  readonly cellStatus: Readonly<Record<string, CompareStatus>>   // counterpart pulse + agent serialization only
}
export function buildCompareModel(blueprints: [BlueprintData, BlueprintData, ...BlueprintData[]]): CompareModel
export function computePinnedColumns(model, blueprints): ReadonlySet<string>
```

- **Alignment normalization (prerequisite):** widen `normalize()` — strip punctuation + leading articles, add a near-match rename pass. Tests pinned on real Ecoeled rename cases (quotes / trailing period / "the"). Without it, trivial renames fabricate phantom clusters in both modes.
- Signature = content + description + links (`type+label+url`, not `pictures`); ` ` separators. Owner deferred to v3.1 (needs `PATH_BLUEPRINT_SELECT` widening; `sb:audit` already checks ownership). Multiset slots: sorted-content pairing; field-level diffs on 1:1 slots only.
- Consumers: Stacked highlight ← `columns` · ledger ← `slots` · strip + Merged canvas ← `runs` · fly-pulse ← `cellStatus`. Fix while porting: O(columns²) `includes` at `comparePathCells.ts:36` → `Set`.
- **Recompute discipline:** one `useMemo` in `ScenarioBlueprintPanel` keyed on memoized `visibleBlueprints`; distributed via one context (consumers never call `buildCompareModel` themselves). Gate returns `null` until all selected blueprints are loaded **from the same refetch generation** (a half-refreshed pair fabricates flash divergences).

### Stacked grid (Phase 2b — rewrite of `SideBySideCompareGrid`)

- Subgrid inverts: each path = row band with `gridTemplateColumns: 'subgrid'`; parent owns the one column axis (fold changes parent tracks, bands re-derive).
- **Shared band renderer** factored out — stacked arranges bands on y; overview's surviving horizontal layout arranges the same component on x (anti-rot: second arrangement, not second implementation).
- Subgrid pitfalls (researched): explicit `gap` per band; pleat columns fixed-width; **no `position: sticky` inside the transformed canvas** (strip in panel chrome is fine); `align-self: start` on rail cells.
- 'Only' columns: inert spacer `div`s in other bands (not `BlueprintEmptyCellSlot` — that's an edit-mode drop target).
- Arrow overlay hardening while touching the file: `querySelectorAll` → `Map<id,el>` index per update (kills O(T×N) scans); rAF-coalesce its ResizeObserver; no `content-visibility`/`contain: paint` on bands.
- Estimators: width = rail + one canonical card; height = Σ bands + gaps; view mode in `compareFitContentKey`, **fold state NOT in it** (panel's ResizeObserver already handles content shrink; key-reset would nuke the user's drag-resize per pleat toggle). Soft cap 4 bands; no virtualization.
- Deletions, enumerated: `IntegratedBlueprintGrid.tsx`, `IntegratedPathSectionFrame.tsx`, `mergeIntegratedBlueprint.ts`, `integratedForkArrowGeometry.ts`, the dead `useIntegratedLayout` branch + always-computed merge call, highlight-pass gating. `IntegratedTriggerArrows.tsx` survives, renamed; its mapper gains `kind: 'trigger'|'needs'`.

### Panel & ledger (Phase 3)

- **One owner:** `panelState: { surface: 'details' | 'differences' } | null` in `BlueprintCellDetailContext`. `drawerOpen = panelState !== null`; cell click → `{surface:'details'}` + selection; menubar `[≠ N]` → `{surface:'differences'}` (no selection needed); Details with no selection = quiet placeholder. **One** closing snapshot of panelState + rendered content (the `onOpenChange` comment at `BlueprintCellDetailPanel.tsx:~1035` is a tombstone for the last multi-owner design — never OR two booleans). Surface switch = content swap, never close-reopen; `closePanel()` clears atomically; clears on `resetKey` and on path selection dropping below 2.
- Selection retained across surfaces (true siblings). `uiBridge.ts:85` probe fix: check the selection-scoped `cell-panel` contributor, not `cell_panel_close` presence.
- Table anatomy: first column = lane name + 8px lane swatch (tier-4 tokens) + verdict chip on **status tokens** (divergent = warning recipe, only = info recipe — path colors stay path identity); path columns headed by short-name over a 3px `getPathColor()` rail; `—` for absence; hairline borders, no zebra.
- Stable order across recomputes (column-then-lane); `React.memo` rows keyed `slotKey`.

### Camera (Phase 3)

- `focusCells(cellIds)`: **fly to first + pulse counterparts** (no union bbox in v3 — cross-band fits would hit the ~0.4–0.5 readable-zoom floor anyway). Returns `{kind:'flown'} | {kind:'miss', missing}` — no silent no-ops.
- Reads camera from `transformRef.current` (React copy trails ~80ms). Expand-then-fly uses the file's **existing** double-rAF+backstop pattern + a generation token (▶-spam aborts stale measures); sets the existing refit-suppression so the debounced `recenterToView` can't yank the camera post-fly.
- Bridge: module-store `Map<slideId, focusCells>`, resolved **at call time**, keyed by the ledger's scenario id captured at open; stable callbacks only.

### Fold (Phase 4a)

Pleats: fixed-width column, flat `--muted` + single 1px crease (rib texture cut — moirés), label `▸ 4` mono with step range in tooltip. **Never animate `gridTemplateColumns`** (full-subgrid relayout per frame + arrows drawn against intermediate geometry); instant toggle, `prefers-reduced-motion` respected either way. Arrows with a folded endpoint are **filtered at the data layer** (declared drop — no DOM placeholder discipline). Any focus request on a folded cell routes through the single focus pipeline, which auto-expands first (one function, all callers).

### Mode plumbing (Phase 2a)

`src/lib/viewTypeVocabulary.ts`: `DbScenarioViewType` mirror of the CHECK constraint + two exhaustive `satisfies`-checked maps. Read seam `phasesToSlides.ts:43` (deletes the unchecked cast); write seam stays DB-typed in `authoringRpc.ts`; `CreateBlueprintDialog.tsx:79` maps through the module. Persisted `'integrated'` rows keep coercing to plain view — no migration, no behavior change on old data. Grep gate both directions. Rename surface: `nav.ts` union + labels + ~19 fallback literals, `EditorContext.viewTypeOverrides`, `EditorShell`, agent-skill markdown, `SCENARIO_VIEW_TYPE_OPTIONS` (deliberate new list).

### Agent parity (ships with each surface — registry norm)

- **Read tool `get_compare_diff`** (`read.ts` + `TOOL_SPECS`): args `scenario_id`, optional `path_ids`; runs `buildCompareModel` headless; serializes slots/runs/columns. Grounds slotKey/zone args for everything else.
- Phase 2a: `set_scenario_view` args `stacked | merged` + documented legacy aliases (`integrated → merged`, `side-by-side → stacked`).
- Phase 3: `differences_open`/`differences_close`, `panel_surface <details|differences>`, `differences_filter` (`lane:"Front Stage" verdict:divergent`, empty clears), `jump_divergence <next|prev|n>`.
- Phase 4a: `collapse_shared <true|false>`, `toggle_pleat <columnKey>`.
- `get_ui_state` `'compare'` contributor: mode, path names, N differences, zone position, ledger open + filters, fold state. `docs/agent/ui-inventory.md` + skill markdown updated per phase.

## Design language

**"Agreement is grey, divergence is color."** Compare chrome on the neutral ladder; saturated ink = path accents at divergence sites, plus one deliberate second ink: **warning family = THAT they differ** (Stacked column tint, ledger verdict chips), **path accents = WHO differs** (frames, connectors, table headers). All counts/step numerals in `--font-mono tabular-nums`. Path identity always the color+dash **pair** (SC 1.4.1). No raw `--color-*` in `.tsx` — tier-4 tokens (`--background-blueprint-diffcolumn`, etc.); verify 3–4% warning alphas survive dark mode. Motion only from `animations.css` tokens. Strip: neutral 3px spine, paths color only when split; fork = 6px diamond, rejoin = circle (strip-only vocabulary); active segment uses the sidebar-selection idiom; ≥44px hit rects. No `checkbox.tsx` needed (no check-off).

## Phases

| Phase | Contents | Gate |
|---|---|---|
| **1** | `compareSlots` model + **normalization/near-match** + `computePinnedColumns` + tests (alignment, absence, multiset, runs, ordering, pin one-hop, Ecoeled rename cases, ≥2-tuple) ; migrate 2 call sites; delete `comparePathCells.ts` | `npm test` |
| **2a** | Vocabulary rename: `viewTypeVocabulary.ts`, both seams, union ripple, toggle labels, agent aliases, skill markdown; menubar cluster shell | grep gate both directions |
| **2b** | Stacked grid rewrite: shared band renderer, subgrid inversion, spacers, estimators, arrow hardening, **column highlight**, enumerated deletions, overview scope-down | build+lint clean; Ecoeled visual pass (row rhythm) |
| **3** | Panel: `panelState` refactor → ledger surface (accordion policy, diff tables, filter) + **strip (both modes)** + `focusCells` pipeline + agent commands + `get_compare_diff` | drawer bounce tests; ledger opens from Stacked |
| **4a** | Fold in both modes (pleats, pin rule wiring, data-level arrow filtering, menubar toggle, shared state) | pleat toggle = one frame, no camera shimmy |
| **4b** | **Merged branch canvas — only if the data gate passes** (median pair ≥2 spine segments covering ≥30% of columns, post-normalization, measured on live Ecoeled). Dev-flagged; priced as its own Phase-2b-sized effort (second geometry model: block layout, DOM-measured strip positions, cross-block arrows, connectors, coachmark) | the data gate, then Ecoeled visual pass |
| **5** | A11y polish: keyboard scoping, roles/labels, reduced-motion audit, empty states | — |

1 → 2a → 2b → 3 → 4a ordered; 4b after gate; focus pipeline (3) must precede fold auto-expand (4a).

## Acceptance criteria

- [ ] ≥2 paths render as vertical stacks on a canonical axis; 'only' columns hold inert spacers; divergent columns lightly tinted (no per-cell paint anywhere)
- [ ] Menubar cluster (≥2 paths): mode toggle + `[⇤ Fold]` + `[≠ N]`; fold works in both modes with one shared per-scenario state; strip = navigation only, renders in both modes
- [ ] DB tokens untouched; persisted `'integrated'` coerces as today; `'merged'` never persisted; grep gate passes both directions
- [ ] Ledger: 2+ zones accordion / 1 zone flat; lane×path tables with `—` absences; lane+verdict filter; detail-only group + V12 disclaimer in header; stable row order; no review UI
- [ ] Opening a zone flies to it (auto-expanding folds via the single pipeline) without leaving the Differences surface; `⇱` flips to Details with selection retained + return chip; drawer closes cleanly from either surface, exit animation never empty
- [ ] Strip/canvas/ledger/`jump_divergence` share ①②③ indices; ◀/▶ keeps all three in sync
- [ ] One-hop pin rule unit-tested; pinned columns show the explainer; fold disabled at zero differences
- [ ] `get_compare_diff` works headless; all commands registered in their surface's phase; `get_ui_state` compare line present; uiBridge probe correct for ledger-only open
- [ ] If 4b builds: spine cells render once, primary path on baseline, connectors non-arrow vocabulary, V2 `=` de-emphasis, V5 aligned-x preservation, coachmark + vs-badges
- [ ] `npm test` green, `npm run lint` zero, `npm run build` clean; pleat toggle one frame; reduced-motion respected

## Risks

| Risk | Mitigation |
|---|---|
| Real data 67–95% divergent — Merged's regime may not exist | Phase 4b data gate; Stacked+strip+ledger ship first and may suffice |
| Name-based alignment fabricates topology | Phase 1 normalization + near-match, tests pinned on real rename cases |
| Subgrid inversion breaks row rhythm (v1's failure mode) | Bands keep full lane structure; rename split out of the PR; Ecoeled visual pass |
| Drawer refactor destabilizes cell flow | `panelState` lands first with bounce tests; single owner = less state than today |
| `focusCells` on stale geometry after expand | Existing double-rAF+backstop + generation token + refit suppression |
| Pin rule pins too much | One-hop only, unit-tested, per-pleat manual expand as escape hatch |
| Overview horizontal path rots | Shared band renderer = one implementation, two arrangements; tracked debt |

## v3.1+ (deferred)

Review/check-off (session store keyed `(slotKey, signatureHash, pathIdSet)` — design retained in this plan's git history); owner-field diffing; edge/trigger comparison (V12); partial-split clusters from `agreementGroups` (A=B≠C → two tracks); rename detection (Copy-Drift Auditor); union-bbox focus; strip overflow/touch; Diff Tour slice; Agent Divergence Brief (input channel = `get_compare_diff`, already shipped); Counterpart Peek hover ghosts.

## Sources

- **Origin:** [docs/ideation/2026-08-04-compare-view-v3-ideation.md](../ideation/2026-08-04-compare-view-v3-ideation.md) (post-mortem: enumerate/compress/narrate, not paint); prior: [2026-08-02-001](2026-08-02-001-feat-path-comparison-view-ideas.md); panel precedent: [2026-08-05 agent-chat placement](../ideation/2026-08-05-agent-chat-placement-ideation.md)
- **Key code:** classifier `src/lib/comparePathCells.ts` · grid `SideBySideCompareGrid.tsx` + `sideBySideCompareLayout.ts` · panel `BlueprintCellDetailPanel.tsx` + `BlueprintCellDetailContext.tsx` · camera `useZoomPanViewport.ts` · arrows `IntegratedTriggerArrows.tsx` · plumbing `nav.ts` / `phasesToSlides.ts:43` / `authoringRpc.ts:70,202` / `schema.reference.sql:33` · agent `registry.ts` / `uiBridge.ts` · measurement `ResizableComparePanel.tsx` / `ScenarioBlueprintPanel.tsx` · conventions `AGENTS.md`, `docs/agent/ui-inventory.md`
- **External:** GitHub/GitLab fold affordances; DoltHub commit-graph lane rules; storyline-visualization bundling literature; CSS subgrid pitfalls (explicit gap, sticky-in-transform)

## Appendix — decision history (compressed)

2026-08-06: concepts A+C chosen from ideation; vertical stacking; ledger as panel sibling (corrected from inner-tab reading); deepen round (8 agents: drawer single-owner, two-seam rename, agent read tool, race/perf fixes, simplicity cuts). Naming churned Review → Diff → Merged (final). Zones-on-stacked concept explored, then superseded. 2026-08-07: Merged pivoted to true branch canvas; review machinery cut; accordion policy + filter settled; fold both modes + menubar cluster (user-picked layout); 3-lens critique panel → Ecoeled divergence measurements → Merged gated, normalization prerequisite, strip in both modes, signal contract demoted to ledger-authoritative.
