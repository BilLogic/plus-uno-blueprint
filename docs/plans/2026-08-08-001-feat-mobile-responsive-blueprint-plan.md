---
title: Mobile-Responsive Blueprint — the phone reads the board as a vertical journey
type: feat
status: active
date: 2026-08-08
---

# Mobile-Responsive Blueprint

> The crash is fixed (commit `5911a95` — step visuals no longer decode 325 MB). The app now *survives* a phone; it is not yet *designed* for one. This plan makes it designed for one.

## Overview

The editor is a desktop-only three-column fixed-pixel shell (320 px sidebar · pan/zoom canvas · 320/640 px right drawer). On a 375 px phone the sidebar alone eats 85 % of the width, the canvas has **zero touch gestures** (`touch-none` actively suppresses even native pinch — zoom is wheel-only), and the cell drawer overflows the screen. This plan does **not** shrink the desktop layout onto glass. It gives the phone its own reading grammar derived from what a service blueprint *is*, and adds real touch to the canvas as the expert escape hatch.

**The one idea:** a blueprint is read left-to-right across time (phases/steps) and top-to-bottom across the line of visibility (lanes). A phone can't hold that 2-D board. So we **rotate the time axis into vertical scroll** — scrolling down *is* moving forward through the journey — and preserve the line of visibility as a labeled band *inside* each step. The 2-D board folds into a 1-D journey. That fold is the signature of the whole design, and it is the true "phone version of reading a blueprint," not a zoomed-out miniature of the desktop canvas.

**The access stance (decided 2026-08-08):** mobile is **view-only for every user**, including service accounts — the same experience site visitors get. No design mode, no cell editing, no structure writes from a phone. The agent is present on mobile but limited to the *reading* toolset: navigation, Q&A over the board, annotation-free explanation. This is a UX gate, not the security boundary — the RPC tier enforcement on the server remains the real wall; mobile simply never offers the write surfaces.

## Problem statement

Concrete failures on a 375–430 px viewport today (all confirmed against source, see Research):

1. **Shell** — `EditorShell.tsx` root is `flex` with an `<aside>` at inline `width: 320px` (clamp 240–640) beside `<main>`. No layout breakpoint anywhere. The sidebar + canvas + drawer all compete for width that doesn't exist.
2. **Canvas** — `useZoomPanViewport.ts` zoom is `wheel`-only (`ctrl`/`meta`+wheel); pan is Pointer-Events, mouse-left oriented. **No `touchstart`/`touchmove`/`gesture*`/`pinch` code exists in `src/` at all**, and `ZoomPanViewport.tsx:129` sets `touch-none`, which disables the browser's own pinch-zoom. On a phone there is *no way to zoom*.
3. **Cell detail** — `BlueprintCellDetailPanel.tsx` is a vaul `Drawer` rendered as a right-pinned floating card, `w-[20rem]` / `w-[40rem]` expanded. The 320 px card + 16 px inset nearly covers a phone; the 640 px expanded state overflows entirely.
4. **Agent** — `AgentDock` floats a 380 px card at `x: 360` — mostly offscreen on a phone; docked mode is tied to the 320 px sidebar that itself doesn't fit.
5. **Top nav** — `TabStrip` + breadcrumb assume desktop horizontal room.

## Proposed solution — three layers, desktop untouched

A single breakpoint gate. **Below `md` (768 px, the existing `useIsMobile` threshold) → mobile shell. At/above `md` → today's desktop shell, byte-for-byte unchanged.** Desktop risk is therefore near-zero; every mobile branch is additive and gated.

| Layer | What ships | Primary shadcn primitive (already in repo) |
|---|---|---|
| **A. Responsive shell** | Top bar condenses; sidebar → left `Sheet`; cell detail → bottom `Drawer` with snap points; agent → full-screen `Sheet`; FAB launchers | `sheet`, `drawer`, `button` |
| **B. Touch canvas** | Real pinch-zoom + one-finger pan; drop `touch-none` on coarse pointers; keeps desktop wheel path intact | (hook change, no new primitive) |
| **C. Mobile reader** | The vertical-journey view — the *default* mobile reading mode; canvas becomes an opt-in "Map" | reuses `VisualStepDetailStack`, `blueprint.steps`/`layers` |

Layer A makes it *usable*. Layer B makes the board *explorable*. Layer C makes it *native to the phone*. They can ship in that order; A+B alone already clear the "desktop-on-a-phone" complaint, C is the part that delights.

---

## Design brainstorm (frontend-design deliverable)

Per the design-lead brief: reuse the existing Supabase-caliber token system — this is not a re-skin. The mobile work spends its one risk on the **fold**, and keeps everything else quiet.

### Color
No new palette. Reuse semantic tokens (`--background`, `--card`, `--border`, `--muted-foreground`, the single accent). The only new *usage*: a hairline **line-of-visibility rule** inside each reader step, drawn in `--border` with a `--muted-foreground` label — the blueprint's most load-bearing convention, made legible on a small screen. Lane identity keeps its existing per-lane tint token; no invented colors. This deliberately refuses the AI-default "one bright acid accent on near-black" — the restraint *is* the Supabase alignment.

### Type
Reuse the existing display/body/mono roles. One deliberate mobile move: **the phase eyebrow is set in the utility/mono face, uppercase, letter-spaced**, as a sticky section marker while you scroll a phase. Numbering (`01 / 02`) is earned here and only here — blueprint steps *are* an ordered sequence in time, so a step index is information, not decoration. Cell titles stay in the body face at a size that survives 375 px without truncation mid-word.

### Layout
```
Desktop (unchanged):   time →→→ horizontal,  lanes ↓ vertical,  2-D board
Mobile reader:         time ↓↓↓ vertical scroll,  lanes = band inside each step
```
Single column, full-bleed cards, generous vertical rhythm. The horizontal time-axis becomes the scroll axis; the vertical lane-axis becomes an in-card stack split by the line-of-visibility rule.

### Signature
**The fold.** Entering a scenario on a phone, the board visibly *folds* from its 2-D miniature into the vertical journey (a short, reduced-motion-respecting transform — the same motion vocabulary already pinned by the motion test). Tapping **Map** unfolds it back to the touch canvas. One memorable moment; everything around it disciplined.

---

## ASCII wireframes

### Desktop today (reference — untouched by this plan)
```
┌──────────────────────────────────────────────────┐
│ TabStrip:  Board · Slices · Compare      title  ✦ │
├────────────┬─────────────────────────────────────┤
│ aside 320  │  main — pan/zoom board               │
│  Board     │   phase   phase   phase   phase       │
│  Slices    │   ▓▓cell  ▓▓cell  ▓▓cell   ·· arrows  │
│  ── phases │   ▓▓cell  ▓▓cell  ▓▓cell              │
│  ── scen.  │                        cell detail →⟦⟧│
│ (agentdock)│                                       │
└────────────┴─────────────────────────────────────┘
```

### Mobile — the reader (DEFAULT below md)
```
┌───────────────────────┐  ~390px
│ ☰   Warm-Up      ✦  ⋯ │  compact bar: nav · title · agent · overflow
├───────────────────────┤
│ 01 · ARRIVAL          │  ← sticky phase eyebrow (mono, uppercased)
│   New-user scenario   │
│ ┌───────────────────┐ │
│ │ FRONTSTAGE        │ │  lane band label (muted)
│ │ ▓ Greet at door   │ │  full-bleed cell card
│ │ ▓ Sign-in kiosk   │ │
│ ├── line of visibility ┤ │  ← the hairline rule, preserved
│ │ BACKSTAGE         │ │
│ │ ▓ ID verify       │ │
│ └───────────────────┘ │
│          │            │  vertical connector = the "trigger" arrow
│          ▼  triggers  │
│ 02 · SETUP            │
│   ...                 │
├───────────────────────┤
│    🗺 Map        ✦ Ask │  bottom action bar (thumb reach)
└───────────────────────┘
```

### Mobile — Map (touch canvas, opt-in via the fold)
```
┌───────────────────────┐
│ ‹ Reader     Map   ⊕ ⊖│
├───────────────────────┤
│                       │
│   ▓▓ ▓▓ ▓▓ ▓▓         │  the real 2-D board
│   ▓▓ ▓▓ ▓▓ ▓▓         │  ✋ one finger = pan
│   ·· arrows ··        │  🤏 two fingers = pinch-zoom
│                       │
│   tap a cell ⟶ drawer  │
└───────────────────────┘
    pinch to zoom · drag to pan
```

### Mobile — cell detail (bottom Drawer, snap peek↔full)
```
┌───────────────────────┐
│    ▓▓ board dimmed     │
├═══════════════════════┤  swipe down = close
│  ═══ (grabber)        │
│  Sign-in kiosk        │
│  Frontstage · Step 01 │
│  ───────────────────  │
│  What happens here…   │
│  Emotion   😊 curious  │
│  Triggers  ⟶ ID verify │
│  [ Slices ]  [ Notes ]│
├───────────────────────┤  ← peek snap; drag up for full
└───────────────────────┘
```

### Mobile — agent (full-screen Sheet)
```
┌───────────────────────┐
│ ✦  Agent          ✕   │
├───────────────────────┤
│  you  Where's sign-in?│
│  ✦    Drew a box on   │
│       the Warm-Up …   │
│                       │
├───────────────────────┤
│ [ Ask about the board…] ▶│
└───────────────────────┘
```

### Mobile — nav (left Sheet)
```
┌─────────────────┬─────┐
│ Blueprint       │ dim │
│ ─────────────── │     │
│ ▸ Board      ●  │     │  ← current-view checkmark
│ ▸ Slices        │     │
│ ─────────────── │     │
│ PHASES          │     │
│  01 Arrival  ●  │     │
│  02 Setup       │     │
│ SCENARIOS       │     │
│  New user    ●  │     │
│ PATHS (if scen) │     │  progressive disclosure preserved
└─────────────────┴─────┘
```

---

## Technical approach

### Breakpoint contract
- Single source of truth: extend the existing `src/hooks/use-mobile.ts` (`MOBILE_BREAKPOINT = 768`). Export a stable `useIsMobile()` already there; add nothing new unless a second breakpoint proves necessary.
- `EditorShell` reads `useIsMobile()` once and forks: `isMobile ? <MobileShell/> : <existing desktop tree/>`. The desktop subtree is *moved, not modified*.
- SSR/hydration: `useIsMobile` returns `undefined` on first paint today. The fork must render a neutral skeleton (or the mobile shell) until resolved to avoid a desktop→mobile flash. Verify no layout-shift jank.

### Layer A — responsive shell (`MobileShell`)
- **Top bar**: `☰` (opens nav Sheet) · scenario/view title (truncating) · `✦` agent · `⋯` overflow (present/return, share, theme). Height ~52 px, sticky.
- **Nav → left `Sheet`**: reuse the *content* of the existing sidebar nav (`SidebarNav` / `SlideModeSidebarNav`) inside `ui/sheet.tsx`. The dormant `ui/sidebar.tsx` mobile `Sheet` branch (`SIDEBAR_WIDTH_MOBILE = 18rem`) is the template; prefer wrapping existing nav components over the vendored sidebar to keep one nav implementation. Progressive disclosure (Paths hidden until a scenario is selected) carries over unchanged.
- **Cell detail → bottom `Drawer`**: `BlueprintCellDetailPanel` already *is* a vaul Drawer. Add a mobile branch to its className/props: bottom-anchored, full-width, `snapPoints={[0.35, 1]}` (peek ↔ full), `swipeDirection="down"`. Desktop keeps the right-pinned card. One component, two postures — mirrors the AgentDock docked/floating precedent. **Mobile renders the view-only content branch**: no edit affordances, no field editors, no delete — the same read surface visitors see, regardless of the signed-in tier.
- **Agent → full-screen `Sheet`**: below `md`, `AgentDock` renders its panel inside a bottom/full `Sheet` instead of the floating portal; the FAB in the top bar / bottom action bar is the trigger. Session + draft state already hoisted into `panelState.ts`, so posture change won't drop a conversation (regression already paid down this session). **Mobile agent = reading toolset only**: the tool registry exposes navigation/read/Q&A tools (`open_phase`, `open_scenario`, `open_cell_panel`, `get_ui_state`, focus/scroll) and withholds every write tool and annotation write when `isMobile` — even for service accounts. Client-side gate for UX coherence; the server-side RPC tier enforcement stays the actual security boundary.
- **Overflow / present / return**: presentation Return/Close moves into the `⋯` overflow menu on mobile.

### Layer B — touch canvas (`useZoomPanViewport.ts`)
- Add Pointer-Events-based gesture handling (Pointer Events already used for pan — extend, don't add a parallel Touch listener):
  - Track active pointers in a `Map`. **1 pointer → pan** (existing path, relax the mouse-left guard for `pointerType === 'touch'`). **2 pointers → pinch**: zoom by the ratio of current/previous pinch distance, centered on the midpoint via the existing `zoomAtPoint`.
  - Remove `touch-none` on coarse pointers only: `[@media(pointer:coarse)]:touch-auto` or conditional class, so desktop trackpad behavior is untouched.
  - Respect `MIN_ZOOM = 0.05` / `MAX_ZOOM = 4` as-is.
- Guard: `touch-action` must let the *page* scroll in the reader but the *canvas* own its gestures in Map mode — scope the coarse-pointer touch-action to the Map viewport, not the reader scroll container.
- Keep every desktop wheel/keyboard path exactly as-is; add a `pinch` test to the interaction suite so this can't silently regress.

### Layer C — mobile reader (`MobileScenarioReader`)
- **Data**: reuse the blueprint grid model directly — `blueprint.steps` (ordered time axis), `blueprint.layers` (lanes), `getCellAt(layer, step)` (intersection). This is the exact decomposition `buildVisualWalkthroughSession` already performs (`src/lib/visualWalkthrough.ts`); generalize it from the visual-only, Ecoeled-flagged path to any blueprint's cells. Extract a `buildScenarioReaderModel(blueprint, scenarioId)` in `src/lib/` returning `{ phaseName, steps: [{ index, name, lanes: [{ laneName, side: 'frontstage'|'backstage'|'support', cells }] }] }`.
- **Render**: vertical scroll of step sections. Sticky phase eyebrow. Within a step, lane bands split by the line-of-visibility rule. Each cell is a tappable card that opens the same bottom Drawer (Layer A). Reuse `VisualStepDetailStack` for cells that carry step visuals (already downscaled/lazy from the crash fix).
- **The fold**: entering a scenario animates board-miniature → reader; **Map** button reverses it. Use `lib/motion.ts` structural duration; honor `prefers-reduced-motion` (cross-fade instead of transform).
- Reader is the mobile **default**; Map is opt-in. Desktop never shows the reader.

### Component / token hygiene
- Tokenize the widths this touches while we're here (the 320/640/380/48 magic numbers the review already flagged) — at minimum the sidebar and drawer widths become named tokens so mobile/desktop read from one place. Scoped: only widths on the mobile path; not a repo-wide sweep.

---

## Implementation units

| # | Unit | Files | Verification |
|---|---|---|---|
| 1 | Breakpoint fork + neutral first paint | `EditorShell.tsx`, `use-mobile.ts` | Desktop tree identical (visual diff ≥ md); no hydration flash; mobile renders a shell stub |
| 2 | Top bar + nav Sheet | new `MobileTopBar.tsx`, reuse `SidebarNav` in `ui/sheet.tsx` | Nav opens/closes; progressive Paths disclosure intact; view switch works |
| 3 | Cell detail bottom Drawer (mobile branch) | `BlueprintCellDetailPanel.tsx` | Peek↔full snap; swipe-down closes; desktop card unchanged |
| 4 | Agent full-screen Sheet (mobile branch) | `AgentDock.tsx`, `placement.ts` | Conversation + draft survive posture; FAB opens; desktop float/dock unchanged |
| 4b | View-only gate: no edit surfaces + read-limited agent tool roster on mobile | tool registry, `BlueprintCellDetailPanel.tsx`, mode entry points | No design-mode entry below md; drawer shows visitor read branch for service accounts too; agent tool list on mobile contains zero write tools (test asserts roster) |
| 5 | Touch pinch/pan on canvas | `useZoomPanViewport.ts`, `ZoomPanViewport.tsx` | Two-finger zoom + one-finger pan on a real touch device / emulated coarse pointer; desktop wheel path unchanged; new interaction test green |
| 6 | `buildScenarioReaderModel` + tests | new `src/lib/scenarioReader.ts` (+ test) | Model matches board grid for a known scenario; lane sides correct |
| 7 | `MobileScenarioReader` render | new `MobileScenarioReader.tsx` | Vertical journey renders; sticky eyebrow; cell tap → Drawer |
| 8 | The fold (reader ⇄ Map) | reader + `ZoomPanViewport` mount | Animates once; reduced-motion cross-fades; Map gestures live |
| 9 | Width tokenization (scoped) | token file + touched components | Mobile/desktop widths read one token; no visual change ≥ md |

Units 1–5 = Layers A+B (usable + explorable). Units 6–9 = Layer C (the fold). Ship 1–5 first, review, then 6–9.

## Requirements trace

- "responsive design thinking" → Layer A, breakpoint contract, unchanged desktop.
- "components from the component library / common patterns" → Sheet (nav, agent), Drawer + snap points (cell detail), FAB, existing tokens/motion. No new primitives.
- "reference to supabase" → restraint over decoration; collapse nav to Sheet + top bar; single accent; reuse the Supabase-caliber token system already in place; refuse the AI-default acid-on-black look.
- "come up with the design for the mobile" → the reader (Layer C) + the fold signature.
- Prior known gap ("canvas has no touch") → Layer B.

## Scope boundaries (non-goals)

- **Not** rebuilding the desktop layout. Desktop is forked around, never edited.
- **Not** a mobile *authoring* experience — **decided: no edit access on mobile for any tier**. Mobile is the visitor view-only experience plus a read-limited agent. Design mode is never offered below `md` (no disabled stub — it simply doesn't exist there; the overflow menu carries a "Editing is available on desktop" line so the capability is discoverable, not mysterious).
- **Not** Compare v3 on mobile in this pass — the stacked-bands cockpit is its own responsive problem; file a follow-up.
- **Not** offline / PWA / install.

## Deferred to implementation

1. Exact `md` behavior for **tablet** (768–1024): does the desktop shell hold at 768, or does a narrow tablet want the mobile reader too? Decide from a real iPad-width screenshot. Note: tablet ≥ md keeps full desktop capability incl. editing; the view-only rule binds to the mobile shell, not to touch.
2. ~~Design mode hidden or disabled on mobile?~~ **Resolved: mobile is view-only for all tiers; design mode absent below `md`.**
3. Drawer snap ratios (`0.35`/`1`) — tune on device.
4. The fold's precise motion — validate it reads as "the board becoming the journey," not a generic slide, and that reduced-motion is honored.
5. Exact mobile agent tool roster — which read tools stay (navigation, Q&A, `get_ui_state`) and whether ephemeral annotations count as "reading" (lean: exclude; marks imply an authoring posture).

## Risks

- **Hydration flash** (desktop→mobile) if the fork renders before `useIsMobile` resolves. Mitigate with a neutral first paint. **Primary risk.**
- **Gesture/scroll conflict**: reader must scroll the page while Map must own touch. Scope `touch-action` per surface; test both on device.
- **vaul Drawer snap points** interacting with `modal={false}` — verify the peek state doesn't block canvas taps behind it.
- **Regression surface**: every mobile branch is gated, but units 3–5 edit shared components. Visual-diff desktop at ≥ md after each.

## Verification plan

- Emulated coarse-pointer + 390 px viewport via the browser preview: nav Sheet, cell Drawer snaps, agent Sheet, touch pinch/pan, reader scroll + fold.
- Desktop visual diff at 1280 px after units 3, 4, 5, 9 — must be pixel-identical.
- `npm test` green incl. new pinch + reader-model tests.
- Real-device smoke on the phone that originally crashed.

## Post-deploy monitoring & validation

- Watch the ErrorBoundary console channel (`[editor] uncaught error`) for mobile-specific throws after ship.
- No server/data changes — no DB monitoring required.
- Validation window: first mobile session on the crash-repro device is the go/no-go.

## Sources & references

- Layout map: `EditorShell.tsx:473–558` (shell), `useZoomPanViewport.ts:518–641` (wheel zoom / pointer pan, no touch), `ZoomPanViewport.tsx:129` (`touch-none`), `BlueprintCellDetailPanel.tsx:257–279` (drawer card), `AgentDock.tsx` + `placement.ts` (float/dock), `use-mobile.ts` (`MOBILE_BREAKPOINT = 768`), `ui/sheet.tsx` / `ui/drawer.tsx` / `ui/sidebar.tsx` (primitives + dormant mobile branch).
- Reader model precedent: `src/lib/visualWalkthrough.ts` (`buildVisualWalkthroughSession`, step/layer/cell decomposition), `VisualStepDetailStack.tsx`.
- Crash fix this builds on: commit `5911a95`; follow-ups filed in `todos/019`.
