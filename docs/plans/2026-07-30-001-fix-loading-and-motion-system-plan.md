---
title: "Loading & motion system — one vocabulary, one camera move, deterministic warm paths"
type: fix
status: active
date: 2026-07-30
---

# Loading & motion system

Plan only — no implementation until Bill signs off (his explicit instruction). Grounded in
a full inventory of all 24 loading/transition moments on `feat/derived-layer-slices`
(in-session agent report, 2026-07-30) plus `main`'s baseline patterns.

## Problem Statement

The user reports loading animations "on and off at times" and motion that feels worse
than the original app. The inventory found this is not one bug but three structural
mismatches the branch introduced, plus two pre-existing camera bugs:

1. **Two loading vocabularies.** `main` had one: instant `animate-pulse` skeletons,
   everywhere, every time — predictable if never instant. The branch added a second:
   `DelayedSpinner` (300 ms hold + 200 ms fade) used only on slice/present paths. Same
   situation now looks different depending on which surface you're on
   (`ServiceOverviewView` skeleton flashes on 40 ms loads; slice tabs show nothing).
2. **Nondeterministic warm/cold paths.** The query cache serves warm switches on frame 1
   (no loader) but goes cold when: a query ever failed/timed out (failures never cached
   — cold forever after), or the cache key differs for overlapping data (base view keys
   all scenario ids; a slice tab keys `[soloScenarioId]` — always cold even though the
   data is a subset). Slice tabs are additionally a 3-stage sequential waterfall
   (slice → scenario-id → blueprints), each stage restarting its own 300 ms spinner
   clock → spinner/blank/spinner strobe on cold, nothing on warm. That IS the
   "on and off."
3. **The camera moves more than once per navigation.** (a) `pendingFitRef` is never
   cleared on the rAF path (`useZoomPanViewport.ts:273-285`) so every fit runs at ~2
   frames AND again at the 150 ms backstop, restarting the 420 ms ease mid-flight —
   visible stutter (pre-existing on main); (b) `fitKey` includes path selection that
   settles one commit after `overviewReady` (`ServiceOverviewView.tsx:263-265` +
   `PathSelectionContext.tsx:118-124`) → a second full animated fit on every cold
   overview load; (c) `SlideModeView.tsx:132` bakes `loading` into the reset key —
   refits for non-geometric reasons; (d) the viewport subtree mounts after the loading
   early-return, so content paints at zoom 1 then flies — the "pops in then jumps."
4. Assorted pops: spec block reflows the open drawer (`CellOverviewSpec` null→render),
   panel tab switches hard-swap with height jumps, badges `display:none` at the zoom
   threshold, slice-dim desaturation snaps while opacity eases (filter not in the
   transition list — correctly so, per perf review), sidebar slices section pops in.

The one well-sequenced motion in the app — sidebar collapse (320 ms
`cubic-bezier(0.22,1,0.36,1)` width + 200 ms opacity crossfade with 75 ms delay) — is
the model everything else should follow.

## Design principles (proposed, need sign-off)

- **One loading vocabulary, one clock.** A single `DeferredFallback` wrapper owns the
  timing contract for EVERY loading state: nothing for the first ~250 ms, then the
  surface-appropriate fallback fading in over 200 ms, then content crossfading in.
  Skeletons remain the fallback for full-surface loads (base canvas — layout-shaped),
  the spinner for embedded/partial loads (slice tabs, panel tabs, presentation). What
  users never see again: fallbacks for warm loads, strobing between multiple loaders.
- **A surface shows at most ONE loader per load.** Waterfalls hold the same fallback
  instance until content is ready — never loader → blank → loader.
- **The camera moves exactly once per navigation.** Fit when geometry is settled, not
  per state commit.
- **Warm means instant, deterministically.** Cache-key alignment + short-lived negative
  caching make "did I see a loader?" a function of data freshness, not code path.
- **Motion tokens** (from the sidebar model + existing drawer): standard ease
  `cubic-bezier(0.22,1,0.36,1)`; 320 ms structural (width/layout), 200 ms opacity
  crossfade (75 ms stagger for in/out pairs), 420 ms camera, 150 ms micro (hover/badges).
  No new easings without updating this list.

## Phases

### Phase 1 — Camera correctness (biggest feel win; zero visual redesign)
- Clear `pendingFitRef` in `runFit` on the rAF path; keep the timeout as a true backstop.
- Remove pre-settlement `overviewSelectedPathIds` churn from `fitKey`: gate fit on
  path-selection settled (or exclude selection from the key and refit only on explicit
  filter toggles).
- Drop `loading` from `SlideModeView`'s reset key.
- Mount the viewport subtree during loading (fallback renders INSIDE it) so first
  content paint is already at fitted transform — kills the zoom-1 flash.
- Acceptance: cold overview load = exactly one 420 ms camera animation (count via a dev
  hook on `animateTransform`); no post-fit snap unless the window actually resized.

### Phase 2 — One loading vocabulary
- New `DeferredFallback` (wraps the existing `.delayed-appear` timing): props
  `{fallback: 'skeleton-overview' | 'skeleton-panel' | 'spinner', minHold?: number}`;
  content mounts with a 200 ms fade-in when it replaces a shown fallback (no fade when
  warm — frame-1 content stays instant).
- Kill `loadingVariant` divergence: base view and slice tabs both go through
  `DeferredFallback`; skeletons gain the 250 ms hold (no more skeleton flash on fast
  loads); `"Loading evidence…"` text and `CellOverviewSpec`'s null-pop adopt it too
  (spec block reserves height while loading).
- Slice-tab waterfall shows ONE fallback for the whole chain (hoist the loader above
  the three stages; stages no longer each own a spinner).
- Acceptance: throttled-network walkthrough shows at most one fallback per surface;
  fast loads (<250 ms) show zero fallbacks anywhere.

### Phase 3 — Deterministic warm paths (cache semantics)
- Negative caching: failures/timeouts cache for 15 s (with the error state served),
  then retry — a once-failed tab stops being cold forever.
- Cache-key alignment for blueprints: slice tabs look up the superset entry (all-ids
  key) before fetching the subset key — base-view-warmed data serves slice tabs
  frame-1. (Simplest: `useCanvasBlueprints` consults a registry of settled keys whose
  id-sets superset the request.)
- Collapse the slice waterfall from 3 RTT to ≤2: fetch slice+items and, in parallel,
  resolve scenario from the already-cached slices list when possible (slice list rows
  carry cell→scenario hints via the sidebar's earlier fetch); keep the sequential path
  only for cold deep links.
- Acceptance: warm tab round-trips render frame-1 with zero network (existing fetch
  logger); cold deep link ≤2 sequential round-trips before canvas data.

### Phase 4 — Motion polish (only after 1–3 land)
- Tab/content switches: 200 ms opacity crossfade on `ActiveTabContent` (model: sidebar
  crossfade), including landing ⇄ canvas.
- Present-tab sidebar: animate the width collapse instead of unmounting the aside
  (`w-0` + the existing 320 ms transition), so entering presentation wipes instead of
  snapping.
- Badges at the zoom threshold: 150 ms opacity fade instead of `display:none`.
- Slice-dim: opacity-only easing (drop `filter` from the dim per the perf review's
  repaint warning; compensate with opacity ~0.18) OR keep filter values applied
  un-transitioned from frame 1 — decide by eye against the stronger-contrast look Bill
  approved; never add `filter` to the cell transition list.
- Panel tab switches: fixed-height content container (max of the three tabs' typical
  heights) or 150 ms height ease; spec block fades in.
- Sidebar slices section: 200 ms fade/height-in on first appearance; no exit animations
  (YAGNI).
- Delete `index.css` stale print rule for the removed stacked-view markup.

## Scope boundaries
- No new animation library (no framer-motion) — CSS + the existing rAF camera only.
- No keep-mounted tabs (memory cost rejected earlier); per-tab camera preservation is a
  possible later follow-up, not this plan.
- The dead `SlideModeMain` path and its skeleton stack: delete separately, not animate.

## Sources
- In-session loading-state inventory (2026-07-30): 24-moment table, cause analysis,
  main-baseline comparison.
- Perf review (filter repaint hazard); prior user feedback rounds (stronger dim kept,
  skeletons rejected for slices, "on and off" report).
