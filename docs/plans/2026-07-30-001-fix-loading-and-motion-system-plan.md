---
title: "Loading & motion system — one skeleton, one camera move, restored zoom feel"
type: fix
status: active
date: 2026-07-30
---

# Loading & motion system (v3)

Plan only — no implementation until Bill signs off. Local doc, not pushed.
Companion: [2026-07-30-002 sidebar navigation model](./2026-07-30-002-feat-sidebar-navigation-model-plan.md).

**v3 changes:** loading model simplified per Bill (one skeleton, all-or-nothing — the
staged/progressive reveal of v2 read as noisy); added the S0 cold-boot-with-all-blueprints
scenario; added a full navigational-motion spec (zoom, snapping, transitions); and the
"lost zoom smoothness" is now root-caused with hard evidence instead of candidates.

## Root cause — why zoom-on-click feels worse than Meryem's version

A file-level diff against `main` settles it: **`useZoomPanViewport.ts` and
`CanvasPhaseSection.tsx` are byte-identical to main**, `canvasFocus.ts` differs only by
the `Slide`→`NavItem` type rename, and `ZoomPanViewport.tsx` differs by exactly three
lines (a `data-canvas-zoom-far` attribute). **No CSS `transition: transform` ever existed
on the viewport on either branch** — the rAF loop (`easeInOutCubic`, 420 ms) always was
the sole animator. Nothing was deleted. The bad feel comes from five defects:

| # | Defect | Status | Effect |
|---|---|---|---|
| **1** | **Double fit.** `pendingFitRef` is never cleared on the rAF path (`useZoomPanViewport.ts:266-293`); the 150 ms backstop fires unconditionally and calls `fitToView` again, which `cancelFitAnimation()`s the in-flight ease **~36% through** and restarts a fresh 420 ms `easeInOutCubic` from the interpolated midpoint. | Pre-existing on main | **The dominant defect.** Slow-fast-slow-fast stutter; a "420 ms" move actually takes ~570 ms. Because the ease decelerates at both ends, the restart is very visible. |
| **2** | **Viewport mounts after the loading early-return**, so it starts at `pan 0,0 / zoom 1`: content paints at natural size, then flies to fit (on an overview that's 1× → ~0.1×). | Pre-existing, **aggravated** | The branch lengthened the pre-mount window: `useLifecyclePhases` now resolves the first lifecycle *then* queries phases — two sequential round-trips where main had one constant. You see the zoom-1 frame more often. |
| **3** | **Path toggles refit the camera** — `selectedPathIds` is inside `fitKey`. | Mechanism pre-existing, **exposure regression** | On main this was buried in a header menu; now the checklist sits permanently open in the sidebar, so casual path toggling throws the camera away. |
| **4** | **ResizeObserver hard-snap.** `refitOnResize` defaults true and the `resetKey` effect clears `userAdjustedViewRef`, so a container resize inside the animation window schedules an **un-eased** `fitToView({animate:false})` 200 ms later. | Mechanism pre-existing, **new trigger** | `TabStrip` mounting/unmounting (first slice tab opened/closed) changes canvas height → hard snap on top of the ease. |
| **5** | `data-canvas-zoom-far` flips at zoom 0.25, invalidating styles across the canvas subtree. | New | Minor: the badge is absolutely positioned so there's no reflow/refit; one style re-match per threshold crossing. |

Also inconsistent, worth fixing while in here: the sidebar **Overview** row calls
`enterCanvas()` which sets `skipCanvasFitAnimation = true` → **jump cut**, while Escape
and the workspace breadcrumb call `goHome()` → **animated**. Same destination, two
different feels. And the flag is sticky: it's only cleared by `goHome`, so after
Home → enter canvas, *every* subsequent phase focus jumps instead of animating.

## Loading model (revised per Bill)

**One skeleton, all-or-nothing.** While a surface loads, show a single skeleton state;
when everything that surface needs is ready, swap to content in one commit. No staged
per-region filling, no "structure now, cells later" — that reads as noisy.

Refinements that keep it calm rather than crude:
- **Deferred:** the skeleton itself waits ~250 ms. Fast/warm loads show *nothing* — no
  flash. (Today the base view's skeleton paints on frame 1 and flashes on 40 ms loads.)
- **Shaped, not fake:** where real geometry is free (phase/scenario names and counts are
  already in nav metadata), the skeleton uses the true frame count and proportions so the
  swap doesn't jump. What it must NOT do is fill those frames progressively.
- **One skeleton per surface, ever.** A waterfall (slice → scenario → blueprints) holds
  the same skeleton until the last stage resolves — never skeleton → blank → skeleton.
- **Mounted inside the viewport** so the camera can fit before content lands (kills
  defect 2).
- One vocabulary: `Skeleton` for surfaces, the spinner only where no structure is
  knowable (cold deep link before the slice row exists).

## ASCII prototypes

**S0 — cold boot → overview with every blueprint in frame** (the fullest load):

```
t=0–250ms        │ t≈250ms (still loading)        │ ready: single swap
nothing new      │ ┌──────┐ ┌──────┐ ┌──────┐    │ ┌──────┐ ┌──────┐ ┌──────┐
(prev view held, │ │▒▒▒▒▒▒│ │▒▒▒▒▒▒│ │▒▒▒▒▒▒│    │ │[cells│ │[cells│ │[cells│
 no flash)       │ │▒▒▒▒▒▒│ │▒▒▒▒▒▒│ │▒▒▒▒▒▒│ →  │ │ …   ]│ │ …   ]│ │ …   ]│
                 │ └──────┘ └──────┘ └──────┘    │ └──────┘ └──────┘ └──────┘
                 │  real phase count & ratios,    │  content crossfades 200ms
                 │  already camera-fitted         │  camera does NOT move again
```
Rules: skeleton mounts *inside* `ZoomPanViewport` and the fit runs against the skeleton
frames, so the first content paint is already at final transform — no 1×-then-fly. Exactly
one camera animation for the whole boot.

**S1 — cold slice tab:** header band paints instantly (slice row is already cached from
the sidebar list); one artboard skeleton; one swap when cells land. Never three spinners.

**S2 — warm switch (tab ⇄ base, tab ⇄ tab):** zero loaders, zero network; 200 ms content
crossfade only.

**S3 — phase click (the money interaction):**
```
click ──▶ accordion expands (200ms height)   ─┐
      ──▶ camera eases to the phase frame     ─┴─ same start, run together
          420ms easeInOutCubic, ONE animation, no mid-flight restart
```

**S4 — presentation entry:** sidebar wipes (320 ms width ease, not unmount-snap); dark
stage fades up 200 ms; filmstrip slides up 200 ms.

**S5 — panel spec load:** panel opens at full height, spec block reserves its space,
content crossfades — no reflow mid-read.

## Navigational motion spec

Every navigation action, and what the camera does:

| Action | Camera | Duration / easing |
|---|---|---|
| Phase row click | fit phase frame | 420 ms `easeInOutCubic` |
| Scenario row / canvas scenario click | fit scenario panel (maxZoom 4, 56 px bottom inset for nav pills) | 420 ms |
| Home / Escape / breadcrumb / Reset View | fit overview (maxZoom 1) | 420 ms — **animated in all four** (today the sidebar Overview row jump-cuts) |
| Re-click the already-selected row | recenter (focus nonce) | 420 ms |
| Prev/next sequence pills | fit next target | 420 ms |
| First fit after any mount | **jump** (no animation) | 0 ms — prevents the swoop-from-nowhere when leaving a slice tab |
| Path toggle | **no move** | — |
| Sidebar collapse / mode switch / accordion collapse | **no move** | — |
| Window resize (real) | re-center, preserve zoom | un-eased, debounced 200 ms |
| Chrome-driven resize (TabStrip mount, header reflow) | **no move** | — |
| Deep-link restore | jump to target | 0 ms |
| Wheel / trackpad zoom & pan | instant follow (direct manipulation) | no animation, no momentum |
| `prefers-reduced-motion` | all fits jump | 0 ms |

**Snapping — deliberate non-goal.** No zoom quantization, no snap-to-artboard, no
magnetic thresholds. Direct manipulation should never fight the user; snapping is what
makes canvases feel sticky. The one threshold that stays is cosmetic
(`data-canvas-zoom-far` hiding sequence badges below 0.25×, which gains a 150 ms fade
instead of `display:none`). If a "snap back to fit" affordance is wanted later, it should
be an explicit control (double-click an artboard = fit to it), not implicit magnetism.

**Zoom bounds unchanged:** clamp `[0.05, 4]`; overview fits at maxZoom 1 so it never
zooms past 100%; detail fits at maxZoom 4.

## Phases

### Phase 1 — Camera correctness (biggest feel win, zero redesign)
- Clear `pendingFitRef` in `runFit`; keep the timeout as a true backstop (**defect 1**).
- Remove `selectedPathIds` from `fitKey`; add a focus nonce so re-clicking recenters
  (**defect 3**).
- First fit after any mount jumps; make `skipCanvasFitAnimation` a one-shot consumed by
  the next fit, and route the sidebar Overview/Home path through the animated `goHome`
  so all overview returns feel identical.
- Suppress `ResizeObserver` refits for chrome-driven resizes; on real resizes preserve
  zoom and re-center only (**defect 4**).
- Honor `prefers-reduced-motion`.
- Acceptance: instrument `animateTransform` — cold overview boot = exactly **1** call;
  phase click = 1; path toggle = 0; sidebar collapse = 0; tab open/close = 0.

### Phase 2 — One skeleton, deferred, mounted in the viewport
- `DeferredSkeleton` wrapper: 250 ms hold, 200 ms fade-in, 200 ms crossfade to content;
  one instance per surface, held across waterfall stages.
- Move the skeleton inside `ZoomPanViewport` and fit against it (**defect 2**).
- Retire `loadingVariant` divergence and the fake 3-row guess; evidence text state and
  the panel spec block adopt the same wrapper.
- Shorten the cold path: parallelize or cache the lifecycle lookup so it stops adding a
  sequential round-trip.
- Acceptance: fast/warm loads show no skeleton at all; cold loads show exactly one;
  containers never move when content lands.

### Phase 3 — Transition polish + presentation mode rework

**Presentation mode (Bill, 2026-07-30):**
- **Sidebar collapses to the icon rail — it must NOT unmount.** Today
  `EditorShell.tsx:55` drops the whole `<aside>` on a present tab, which is why entering
  presentation snaps instead of wiping. Reuse the existing 320 ms width ease + 200 ms
  opacity crossfade (75 ms stagger) — the same motion the sidebar already uses when
  auto-collapsing, so entering and leaving presentation feel identical to every other
  collapse in the app.
- **Presentation keeps the slice header band.** Same two-row band as the slice tab (◇
  title + type badge, subtitle), so switching between the two reads as a mode change on
  one object rather than two unrelated screens. The only difference: the primary button
  becomes **Return** (exit presentation, back to that slice's focus tab) instead of
  Present. Dark-mode tokens apply to the band inside the presentation surface.
- **Enter/exit symmetry:** entering = sidebar collapses (320 ms) ∥ stage fades up
  (200 ms) ∥ filmstrip slides up (200 ms); exiting plays the same three in reverse with
  the same durations/easing. No hard cuts in either direction.

**General:**
- 200 ms crossfade on tab/content switches and landing ⇄ canvas (model: the sidebar's
  320 ms width + 200 ms opacity with 75 ms stagger — the one motion already right).
- Badge threshold fades 150 ms; slice-dim eases opacity 180 ms with `filter` applied
  un-transitioned (never add `filter` to the cell transition list — repaint hazard).
- Panel tab switches: reserved height or 150 ms ease.
- Delete the stale `@media print` rule for the removed stacked-view markup.

## Scope boundaries
- No animation library; CSS + the existing rAF camera only.
- Tabs stay unmount-on-switch (memory); per-tab camera preservation is a later follow-up.
- Dead `SlideModeMain` gets deleted (nav plan Phase 1), not animated.

## Sources
- In-session zoom/motion forensics (2026-07-30): file-level diff vs `main` proving the
  machinery is unchanged; defect table above with line references.
- In-session loading inventory (2026-07-30): 24 loading/transition moments.
- Bill's feedback (2026-07-30): simplify to one skeleton; add S0; restore the ease-in-out
  zoom feel; specify snapping/zoom/navigation motion.
