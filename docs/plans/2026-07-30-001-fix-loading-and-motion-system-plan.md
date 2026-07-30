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

## Design principles (revised per Bill, 2026-07-30)

- **Structure-true loading.** The fallback is never a generic guess: render the REAL
  containers of what is actually about to load — the true artboard frame(s), lane rails,
  panel chrome — sized from data we already have (nav/slice metadata is cached and
  arrives first), with only the inner content shimmering. The page's bones appear
  immediately and never move; content fills into them. This replaces the fake
  3-row skeleton guess AND the bare centered spinner. Spinners survive only where no
  structure is knowable (cold deep link before the slice row arrives).
- **One clock.** A single `DeferredFallback` wrapper owns timing for every loading
  state: structure renders immediately; the inner shimmer appears only if content takes
  >250 ms, fading in over 200 ms; content crossfades in over 200 ms when it replaces a
  shown shimmer (frame-1 instant when warm). Never fallbacks for warm loads, never
  loader → blank → loader strobes.
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

### Phase 2 — Structure-true loading vocabulary
- New `DeferredFallback` (wraps the existing `.delayed-appear` timing): structure
  slot renders immediately, shimmer slot defers 250 ms, content crossfades 200 ms when
  replacing a shown shimmer (frame-1 instant when warm).
- Structure sources (all available before the heavy cells query): nav metadata gives
  phase/scenario names + counts (base view frames); the cached slices list gives slice
  title/description/type (slice header instantly); path metadata gives lane-rail counts
  once paths load. Containers are laid out at real positions — the camera can fit to
  them BEFORE cells arrive, so first content paint is already at the fitted transform.
- Kill `loadingVariant` divergence and the fake 3-row skeleton; `"Loading evidence…"`
  text and `CellOverviewSpec`'s null-pop adopt the same wrapper (spec block reserves
  height while loading).
- Slice-tab waterfall shows ONE structure + shimmer for the whole chain — never a
  second loader.
- Acceptance: throttled-network walkthrough shows real containers with at most one
  shimmer per surface; fast loads (<250 ms) show structure-then-content with zero
  shimmer; containers never move when content lands.

## ASCII prototypes — loading scenarios & transitions

**S1 — cold overview load (base view).** Bones first, shimmer inside, one camera move:

```
t=0ms  frame containers from nav data,     t>250ms  inner shimmer fades in     content lands: cells crossfade in,
       already camera-fitted                        (only if still loading)    containers never move
┌─────────┐ ┌─────────┐ ┌────────┐         ┌─────────┐ ┌─────────┐            ┌─────────┐ ┌─────────┐
│In-session│ │Post-ses…│ │ …      │         │▒▒▒▒▒▒▒▒▒│ │▒▒▒▒▒▒▒▒▒│            │[cell][ce│ │[cell][ce│
│          │ │         │ │        │   →     │▒▒▒▒▒▒▒▒▒│ │▒▒▒▒▒▒▒▒▒│     →      │[cell][ce│ │[cell][ce│
│          │ │         │ │        │         │▒▒▒▒▒▒▒▒▒│ │▒▒▒▒▒▒▒▒▒│            │[cell][ce│ │[cell][ce│
└─────────┘ └─────────┘ └────────┘         └─────────┘ └─────────┘            └─────────┘ └─────────┘
(no fake 3-row guess; no zoom-1 flash; camera fits ONCE, to these frames)
```

**S2 — cold slice tab.** Header is instant (slice row already cached from the sidebar
list); one artboard skeleton with lane rails; single shimmer for the whole waterfall:

```
t=0ms                                           content lands
┌────────────────────────────────────[▶ Present]┐    ┌──────────────────────────────[▶ Present]┐
│ ◇ Tutor warm-up journey  (journey)            │    │ ◇ Tutor warm-up journey  (journey)       │
│ What the tutor does and touches…              │    │ What the tutor does and touches…         │
├───────────────────────────────────────────────┤ →  ├──────────────────────────────────────────┤
│ ┌─ Warm-Up ────────────────────────────────┐  │    │ ┌─ Warm-Up ────────────────────────────┐ │
│ │ Visual   │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│ │  │    │ │ ① [cell] ② [cell] … badges + dim     │ │
│ │ Lead Tut │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│ │  │    │ │ …                                    │ │
│ │ Reg Tut  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│ │  │    │ │                                      │ │
│ └──────────────────────────────────────────┘  │    │ └──────────────────────────────────────┘ │
└───────────────────────────────────────────────┘    └──────────────────────────────────────────┘
(never spinner→blank→spinner; lane rails appear when path metadata lands, cells after)
```

**S3 — warm tab switch.** Zero loaders, zero network; 200 ms content crossfade only:

```
[slice tab A] ──click tab B──▶ A fades out (200ms, ease) ⟍
                                                          ⟩ 75ms stagger (sidebar model)
                               B fades in  (200ms, ease) ⟋
```

**S4 — entering presentation.** Sidebar wipes (320 ms width ease, not unmount-snap);
stage fades up from dark:

```
│▓ sidebar ▓│ canvas │   →   │▓│ canvas → dark stage fades in (200ms)   →   │ dark stage, full bleed │
   320ms width ease                                                            filmstrip slides up 200ms
```

**S5 — cell panel spec load.** Panel opens at full height; spec block shimmers in place,
no reflow:

```
┌─ panel ─────┐        ┌─ panel ─────┐
│ title, chip │        │ title, chip │
│ description │   →    │ description │
│ ▒▒▒▒▒▒▒▒▒▒ │        │ FUNCTION …  │   (reserved height; crossfade; tabs below never jump)
│ [Deps][Ev.] │        │ [Deps][Ev.] │
└─────────────┘        └─────────────┘
```

**S6 — badge zoom threshold & slice dim.** Badges fade 150 ms at the 0.25× threshold
(no display:none pop); dim eases opacity 180 ms with filter applied un-transitioned at
t=0 (single visual event, no per-frame filter animation).

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
