---
audience: designers, developers
summary: Width tokens and their one-home split, the shell's three columns, the one width gate (this doc owns it) — 768px, where the shell forks — and the three semantic-zoom thresholds.
sources: src/styles/theme.css, src/lib/layoutTokens.ts, src/hooks/useMobileShell.ts, src/lib/canvasCameraPolicy.ts
last-reviewed: 2026-08-26
---

# Layout

## Width tokens, and the one-home rule

Widths have **exactly one home each**, chosen by who consumes them — the
general rule and its rationale are in [tokens.md](tokens.md):

- **`src/styles/theme.css`** owns widths that *only feed class names*:
  `--width-cell-panel` / `--width-cell-panel-expanded` (the detail panel's two
  desktop postures), `--width-listbox`. CSS is their single home because no
  JavaScript ever computes with them.
- **`src/lib/layoutTokens.ts`** owns widths the *runtime does math on* — drag
  clamps, persistence, viewport clamping, things a CSS custom property cannot
  serve (`Math.min` has no `var()`): `RAIL_WIDTH`, the sidebar
  default/min/max widths, and the agent float's birth geometry and minimums.
  The file's header comment is the contract.

The sidebar width is the worked example — one value for all three sidebar
surfaces, drag-resizable, persisted as a single number, because a width that
jumps per surface reads as layout instability.

## Shell structure

The desktop shell is three columns: icon rail + resizable sidebar, the canvas,
and the right-pinned detail panel; the mobile shell replaces all of it below the
breakpoint. Z-ordering of shell parts is owned by
[elevation](elevation.md#z-index-conventions).

## Breakpoints — two gates, owned here

**This doc owns breakpoints.** Components, composition docs and engineering docs
link here; none of them may declare their own thresholds. There is one:

| Gate | Declared in | What crosses it |
|---|---|---|
| **768px** | `MOBILE_SHELL_QUERY` (`max-width: 767px`), `src/hooks/useMobileShell.ts` | **the shell itself** — mobile below, desktop at or above |

It is read synchronously (`matchMedia` through `useSyncExternalStore`), so it
paints no frame of the wrong answer before correcting itself.

**There used to be a second, and this document outlived it.** A 900px
`SIDEBAR_OVERLAY_BREAKPOINT` governed a band where the desktop sidebar
collapsed and reopened *over* the canvas instead of beside it. The application
put the sidebar back in flow and the hook went with it; the pinned package
ships neither the constant nor `useSidebarOverlay.ts`, and has not for several
releases. This paragraph is here so the next reader does not go looking for a
gate that the board no longer has.

**The shell forks exactly once, and it forks on 768** — below the gate the
mobile shell renders; at or above it, the desktop shell, byte-for-byte the same
tree as before the mobile work. That is the whole of the contract: there is no
second *shell fork*, and a surface that wants a different shell by width goes
through this gate or argues a change here. (The shadcn `useIsMobile` in
`src/hooks/use-mobile.ts` survives only inside the ui sidebar primitive; app
code uses `useMobileShell`.)

**The sidebar pushes; it does not float.** Above the gate the desktop tree has
one posture, and the sidebar's two states are open in the flow and collapsed to
its rail — no width reads a second threshold. The sidebar's own account of
width, collapse and the camera is the package's
`node_modules/agentic-service-blueprinting/docs/guidelines/composition/sidebar.md`.
A deployment
that wanted a narrow band where the column drew over the canvas would be adding
a posture rather than tuning one, and that is a change to argue upstream.

Tailwind's width variants (`sm:`, `md:`, `max-xl:`, and the
`--breakpoint-xs: 480px` step in `theme.css`) remain available for in-component
sizing and are used in about fifteen files. A type step or a column hidden at
narrow is not a shell fork and needs no argument here.

**At and above 768 — desktop, tablets included.** Tablets get the full desktop
shell, **editing included**: the view-only rule binds to the mobile shell, not
to touch. Portrait tablet gets that desktop shell like any other width, with
the sidebar collapsible to its rail when the board wants the room. No
intermediate tablet *shell* exists, deliberately — a third shell would triple
every layout decision for one middling viewport.

What the phone does below the gate is the package's
`composition/mobile-shell.md`, beside the sidebar document named above.

## Semantic zoom

Width is not the only axis that changes rendering — zoom is the other. Below the
threshold the board drops to the **blocks tier**: flat blocks + counter-scaled
phase badges (counter-scale capped at 10× so a deep zoom-out cannot detach a
badge from its frame), the overview as density map
([data-viz](data-viz.md)).

One implementation, **three thresholds**, resolved by `canvasCameraPolicy.ts` —
which is their owner, not the viewport hook:

| Threshold | Value | Where |
|---|---|---|
| `SEMANTIC_ZOOM_THRESHOLD` | 0.25 | desktop board (`useZoomPanViewport.ts`) |
| `MOBILE_SEMANTIC_ZOOM_THRESHOLD` | 0.15 | the phone, which fits a whole board smaller |
| `COMPARE_SEMANTIC_ZOOM_THRESHOLD` | 0.12 | a focused comparison, whose fitted frame is larger than one blueprint |

The phone and the comparison drop later on purpose: opening either must not
immediately replace the content the reader asked for with the density encoding.
