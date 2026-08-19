---
audience: designers, developers
summary: The click grammar, canvas modes, panel-as-selection, camera behavior, and the touch contract — what every input gesture means and why.
sources: src/components/blueprint/BlueprintCellButton.tsx, src/contexts/canvasModeContext.ts, src/hooks/useZoomPanViewport.ts, docs/plans/2026-07-30-001-fix-loading-and-motion-system-plan.md
last-reviewed: 2026-08-08
---

# Interaction

## The click grammar

One grammar for cells, everywhere (the authoritative comment lives in
`BlueprintCellButton.tsx`):

- **⌘/Ctrl-click opens the cell detail panel.** Always, on every surface.
  Right-click → "View cell detail" is the discoverable route to the same
  place.
- **A bare click picks, when a picker is armed** (slice membership, compare
  selection). No picker armed → a bare click opens the panel — or closes it,
  when the panel already shows that exact cell (click-in, click-out).
- **Double-click deliberately does nothing.** In a toggle grammar, click-in
  click-out *is* a fast double-click — indistinguishable by construction —
  and every attempt to give the pair its own meaning turned reading a cell
  into flipping its membership. A held modifier cannot be produced by
  clicking fast; that is why "open" is the modifier.

Which non-toggling cases skip the close (⌘-click, the agent's synthetic
clicks, the Differences surface, an open draft) is decided in one place,
`detailClickCloses`, next to the rest of the grammar.

## Canvas modes

`CanvasMode` is `'view' | 'design'` (`src/contexts/canvasModeContext.ts`).
View is reading, navigating, annotating; design turns the same canvas into an
authoring surface — cells become selectable, and the toolbar *swaps* its
annotation tools for creation ones rather than growing a second row. Scope is
**per surface**, not global: the base canvas and each slice tab hold their own
mode.

**The Edit switch is absent, never disabled.** When a session cannot write
(`available: false`) — and on all mobile — the switch does not render. A
disabled Edit button would advertise a capability the session doesn't have;
discoverability is handled in copy instead ("Editing is available on
desktop" — see [content-voice](content-voice.md)).

## Panel as selection

The open cell panel IS the selection, and `panelState` is its **single
owner**: the ✕, Escape, a toggling click, and the agent all go through the
same `closePanel`; nothing else holds an "is it open" fact. Any new
affordance that opens or closes the panel calls the owner — a second source
of truth here is the bug class this rule killed.

## Camera

The full action-by-action table lives in the 2026-07-30 motion plan; the
contract in short:

- Navigation **fits**: phase/scenario clicks, prev/next, and re-clicking the
  selected row (recenter) all fly on `--motion-camera` eases.
- **Escape / Home / breadcrumb all animate to the overview identically** —
  same destination, same feel, no jump-cut variant.
- First fit after any mount **jumps**; deep-link restores jump.
- Path toggles, sidebar collapse, and chrome-driven resizes **never move the
  camera**. Wheel/trackpad input follows instantly — no smoothing, no
  momentum, and no snapping of any kind.
- Exactly one camera animation per intent; reduced motion makes every fit a
  jump.
- Camera time begins on the first drawable animation frame. React/layout work
  may delay the start, but it cannot consume the ease before the browser paints.
- Focus mode dims non-selected phase/scenario cards to 30%, then lifts them to
  70% on hover or keyboard focus. They remain navigation targets so a reader
  can switch focus directly; cell-level actions inside them remain inactive.

## The touch contract

Owned by the native-capture boundary in `useZoomPanViewport.ts`, with the
pure ownership table in `canvasInputPolicy.ts`; this contract governs the canvas on any
touch screen — on a phone the canvas is the whole surface:

- **Tap opens.** A finger that lifts inside the slop is a tap and behaves as
  a (bare) click.
- **10px slop, then drag pans — from anywhere, including cells.** A touch
  goes "pending" on contact; crossing `TOUCH_PAN_SLOP` commits it to a pan,
  so starting a drag on a cell pans the board rather than opening the cell.
- **Two fingers pinch, always** — pinch-zoom about the midpoint regardless of
  what the fingers landed on. A pinch is never a tap.
- **Ghost-pointer reset on primary contact**: a fresh first touch clears any
  pointers stranded by a died stream, so a cancelled pinch can't wedge the
  gesture state.
- **A drag's trailing click is swallowed** — the synthetic click browsers
  fire after a pan must not also open a cell.

The viewport observes pointer streams in native capture, before populated
lanes, cells, or controls can stop bubbling. Desktop adds two temporary pan
overrides without changing the selected tool: hold Space and primary-drag, or
drag with the middle mouse button. Editable fields retain Space and shortcuts.

Desktop wheel/keyboard paths are untouched by all of this, and an
interaction test pins the pinch path. Breakpoint questions (what exists on a
phone at all) belong to [responsive](responsive.md).
