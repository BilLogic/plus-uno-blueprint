---
title: 'feat: Unified loading — determinate progress over the shared skeleton system'
type: feat
status: completed
date: 2026-08-17
---

# feat: Unified loading — determinate progress over the shared skeleton system

## Overview

Add a Figma-style determinate loading bar to the canvas, on desktop and
mobile, **on top of** the existing skeleton system rather than replacing it.
One implementation serves both shells because both now render the same
`ServiceOverviewView`; the bar rides the same 250 ms hold and single-commit
swap the skeletons already obey, and its progress comes from the real query
waterfall — never from a timer.

## Problem statement

The staged-disclosure part of Figma's pattern already exists here (chrome
paints instantly → sidebar skeleton → shaped canvas skeleton → one-commit
swap). What is missing:

1. **No progress signal.** On a slow network the canvas skeleton sits with
   no indication of how far along the load is or whether it is moving.
2. **One unshaped hole.** The drawer/sidebar slices list has no loading
   state on mobile (desktop's `PathsLoadingRows` shows the idea).
3. The bar must not regress the two hard-won invariants:
   - fast loads show **nothing** (250 ms hold, `DeferredSkeleton`);
   - content swaps in **one commit** with a 200 ms fade — never a frame
     that "fills in" (`EditorLoadingSkeletons.tsx:81` doctrine).

## Current machinery (all kept)

| Piece | Role |
|---|---|
| `DeferredSkeleton` (`deferred-skeleton.tsx`) | Timing contract: 250 ms hold, shared `holdKey` sessions across waterfall hand-offs, fade on reveal and on swap |
| `ServiceOverviewCanvasSkeleton` | Canvas placeholder shaped from real phase/scenario counts; carries `data-canvas-fit` so the camera pre-fits |
| `SlideNavLoadingSkeleton` | Desktop sidebar phase/scenario placeholder |
| Query waterfall | `useLifecyclePhases` (structure) → `useSlices` (slices) → `useCanvasBlueprints` (blueprints, keyed per scope, cached) |
| `overviewReady` (`ServiceOverviewView.tsx:274`) | `!slidesLoading && !blueprintsLoading` — the swap trigger |

## Design — low-fi

### The loading composition (identical composition, both shells)

Centered over the canvas pad, floating **above** the shaped skeleton
artboards. Mark + 2 px determinate track + stage label:

```
            ╭───────╮
            │   ◇   │        ← app mark, quiet
            ╰───────╯
        ▓▓▓▓▓▓▓▓▓░░░░░░       ← 2px track, w-40, primary fill
        Loading blueprints…   ← current stage, text-xs muted
```

### Desktop, slow load (after the 250 ms hold)

```
┌──────────────────────────────────────────────────────────────┐
│  top nav  (instant)                                          │
├────┬────────────┬────────────────────────────────────────────┤
│ ◫  │ PHASES     │           canvas pad                       │
│ ◇  │ ▭▭▭▭▭      │   ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐      │
│    │  ▭▭▭       │   ┆ ░░░░░░░░░░░░ ┆  ┆ ░░░░░░░░░░░░ ┆      │
│rail│ ▭▭▭▭       │   ┆ ░░ skeleton░ ┆  ┆ ░░artboards░ ┆      │
│(in-│  ▭▭        │   └╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘      │
│stant)│ ▭▭▭      │              ╭───╮                         │
│    │            │              │ ◇ │                         │
│    │ (sidebar   │              ╰───╯                         │
│    │  skeleton) │        ▓▓▓▓▓▓▓▓▓░░░░░░                     │
│    │            │        Loading blueprints…                 │
└────┴────────────┴────────────────────────────────────────────┘
     camera is already fitted to the skeleton artboards;
     swap to content is one commit + 200 ms fade, bar unmounts with it
```

### Mobile, slow load (same components, phone frame)

```
┌─────────────────────────┐
│ ☰  Service blueprint    │ ← top bar, instant
├─────────────────────────┤
│      canvas pad         │
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐   │
│  ┆ ░░░░░░░░░░░░░░░░ ┆   │ ← phase-shaped skeleton
│  ┆ ░░░░░░░░░░░░░░░░ ┆   │   (camera pre-fit)
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘   │
│         ╭───╮           │
│         │ ◇ │           │
│         ╰───╯           │
│     ▓▓▓▓▓░░░░░░░        │
│     Loading structure…  │
├─────────────────────────┤
│    ✦ Ask the agent      │ ← agent bar, instant
└─────────────────────────┘
```

### Timeline (unchanged holds, new bar)

```
t=0                 250ms                                   ready
 │ chrome paints     │ skeleton + progress bar fade in       │ one-commit swap,
 │ (no placeholder)  │ TOGETHER (only if still loading)      │ content fades 200ms,
 │                   │ bar advances per completed stage      │ bar unmounts
 └───────────────────┴───────────────────────────────────────┘
   fast/warm loads never reach 250ms → never see skeleton OR bar
```

### Progress semantics — honest ticks only

- The canvas load has **two real stages**: structure (`slidesLoading`) and
  blueprints (`blueprintsLoading`) — **the same two stages on desktop and
  mobile** (confirmed 2026-08-17): both shells render `ServiceOverviewView`,
  so the bar reads identically on both. Fraction = completed/total, eased
  by a CSS width transition (~400 ms) so ticks read as motion, not jumps.
- A small head-start floor (8%) so the bar never looks parked at zero.
- **Never** time-based fill, never 100% before `overviewReady` — the bar
  hits full only in the same commit that swaps content in, and the swap
  fade carries it out.
- Label names the earliest incomplete stage: "Loading structure…" →
  "Loading blueprints…".

## Benchmark — how Supabase Studio does loading (surveyed 2026-08-17)

Read from `supabase/supabase` `apps/studio` source (components/ui +
interfaces/layouts):

| Their pattern | What it is | Our equivalent / takeaway |
|---|---|---|
| Per-surface skeletons (~15 dedicated `*Skeleton`/`*Loading` components: `EditorMenuListSkeleton`, `RoleRowSkeleton`, `ShimmeringCard`, …) | Placeholders shaped like the real layout, one per surface | Same architecture as `EditorLoadingSkeletons` — **validated**; ours adds camera pre-fit, which they don't need |
| `Shimmers.tsx` / `shimmering-loader` CSS | Shimmer sweep on skeleton blocks | We pulse; shimmer is a token-level style choice, not structural — optional polish |
| `ShimmerLine.tsx` — 2 px full-width **indeterminate** line at panel top | Their "loading bar" for streaming/log panels | Alternative composition if the centered Figma-style bar feels heavy; a 2 px line under the top bar carries the same signal at lower volume |
| `LoadingOpacity.tsx` — stale content dims to 30 % while refetching | Stale-while-revalidate presentation over react-query cache: **refetch never unmounts to skeleton** | Matches our single-commit doctrine; our `useSupabaseQuery` cache + no-remount rule already behaves this way on path/scenario switches |
| `SonnerProgress` toast (row export) | Their **only determinate** progress — used exactly where real units exist (rows exported / total) | Confirms the honest-units rule: they never put a percentage on a data *fetch*, because fetches have no honest units. Our stage-count (2 real query stages) is the honest unit we do have — coarser than rows, but real |

**Conclusion:** our plan is structurally aligned with Studio's system
(shaped skeletons + never-regress-to-skeleton + determinate only with real
units). The one place we go beyond them — a determinate stage bar on first
canvas load — stays honest because each tick is a completed query, and
Figma (the user's reference) does the same with download phases. If the
centered composition proves heavy in review, `ShimmerLine`'s 2 px top-edge
variant is the fallback with the same wiring.

## Technical implementation — step by step

### U1 — `CanvasLoadProgress` component

- **Files:** `src/components/editor/CanvasLoadProgress.tsx` (new)
- **Approach:** props `stages: Array<{ label: string; done: boolean }>`.
  Renders mark + track + fill + label. Fill width =
  `max(8, done/total*100)%` with `transition-[width] duration-400
  motion-reduce:transition-none`. Container is presentation-only
  (`aria-hidden`) — the skeleton wrapper already carries
  `role="status" aria-busy` and the sr-only "Loading…", so the bar adds no
  duplicate announcement.
- **Patterns:** token colors only (`bg-border` track, `bg-primary` fill,
  `text-muted-foreground` label); no fixed px widths beyond the track.
- **Test:** jsdom render test — fraction math to width, label = first
  not-done stage, floor applies at zero stages done.

### U2 — Mount inside the canvas skeleton branch

- **Files:** `src/components/editor/ServiceOverviewView.tsx`
- **Approach:** in the existing `DeferredSkeleton` skeleton node (line
  ~441), wrap `ServiceOverviewCanvasSkeleton` and an absolutely-centered
  `CanvasLoadProgress` in one relative container. Stages come from state
  the component already holds: `[{label: 'Loading structure…', done:
  !slidesLoading}, {label: 'Loading blueprints…', done:
  !blueprintsLoading}]`.
- **Why here:** both shells render `ServiceOverviewView`, so desktop and
  mobile get the bar from one mount point; the `holdKey` session it
  inherits is exactly the skeleton's, so bar and skeleton appear and leave
  together. No new timing policy.
- **Verification:** throttle network (dev tools "Slow 3G") on both shells:
  bar appears with skeleton after ~250 ms, advances structure→blueprints,
  unmounts in the content fade. Fast reload: neither skeleton nor bar
  flashes.

### U3 — Slice-surface parity (already-skeletoned surfaces)

- **Files:** `src/components/editor/SliceView.tsx`,
  `SlicePresentation.tsx` — **no change** to their skeletons; add the same
  centered `CanvasLoadProgress` only to `SliceTabLoadingSkeleton`'s canvas
  rectangle with its own stages (slice detail → owning scenario →
  blueprints, which is that surface's real waterfall, sharing one
  `holdKey` today).
- **Optional / second PR** if the first lands well.

### U4 — Drawer slices skeleton (the unshaped hole)

- **Files:** `src/components/mobile/MobileNavSheet.tsx`,
  `src/components/editor/EditorLoadingSkeletons.tsx`
- **Approach:** new tiny `SliceListLoadingSkeleton` (3 rows, mirrors
  `PathsLoadingRows`); `MobileNavSheet` gains `slicesLoading: boolean` and
  shows it in the Slices surface instead of "No saved slices yet" while
  loading. Desktop's slices section: verify it has an equivalent; add the
  same if not.
- **Test:** nav-sheet render test: loading → skeleton rows, not the empty
  state; ready+empty → empty state.

### U5 — Regression pins

- Unit test for the stage-fraction function (node).
- Existing pinned invariants stay green: 250 ms hold (`DeferredSkeleton`
  untouched), single-commit swap (bar lives inside the skeleton branch, so
  it cannot outlive it).

### Sequencing

1. U1 (component, tests) — no integration risk.
2. U2 (canvas mount) — the visible change; verify both shells throttled.
3. U4 (drawer skeleton) — small, independent.
4. U3 (slice surfaces) — optional follow-up.

## Scope boundaries

- **No timer-driven progress.** If a stage stalls, the bar stalls — that is
  the honest signal.
- **No byte-level progress.** Supabase queries don't stream sizes;
  stage-count is the truthful resolution available.
- **`DeferredSkeleton` internals untouched.** The bar is a consumer of the
  existing session, not a new mechanism.
- Slice-presentation restyling, annotation-toolbar visibility, and other
  mobile chrome questions are separate tracks.

## Acceptance criteria

- [ ] Slow load, desktop + mobile: skeleton and bar appear together after
      the hold; bar advances only on real stage completion; content swaps
      in one commit with the existing fade; bar never survives the swap.
- [ ] Fast/warm load: no skeleton, no bar, no flash (hold behavior
      unchanged).
- [ ] `prefers-reduced-motion`: no width animation; bar still updates.
- [ ] Mobile drawer Slices surface shows skeleton rows while loading.
- [ ] vitest suite green including new pins; tsc + eslint clean.

## Sources & references

- Timing contract: [deferred-skeleton.tsx](../../src/components/ui/deferred-skeleton.tsx)
- Non-progressive-swap doctrine: [EditorLoadingSkeletons.tsx:81](../../src/components/editor/EditorLoadingSkeletons.tsx)
- Swap trigger: [ServiceOverviewView.tsx:274](../../src/components/editor/ServiceOverviewView.tsx) (`overviewReady`)
- Motion system decisions: [2026-07-30-001-fix-loading-and-motion-system-plan.md](2026-07-30-001-fix-loading-and-motion-system-plan.md)
- Mobile shell (both shells share the canvas): [2026-08-16-002-feat-mobile-shell-implementation-plan.md](2026-08-16-002-feat-mobile-shell-implementation-plan.md)
