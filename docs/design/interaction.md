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
  click-out _is_ a fast double-click — indistinguishable by construction —
  and every attempt to give the pair its own meaning turned reading a cell
  into flipping its membership. A held modifier cannot be produced by
  clicking fast; that is why "open" is the modifier.

Which non-toggling cases skip the close (⌘-click, the agent's synthetic
clicks, the Differences surface, an open draft) is decided in one place,
`detailClickCloses`, next to the rest of the grammar.

## Canvas modes

`CanvasMode` is `'view' | 'design'` (`src/contexts/canvasModeContext.ts`).
View is reading, navigating, annotating; design turns the same canvas into an
authoring surface — cells become selectable, and the toolbar _swaps_ its
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
- Path toggles in overview, sidebar collapse, and chrome-driven resizes **never
  move the camera**. A path toggle inside a focused comparison changes the
  target's geometry, so it gets one normal camera ease to the new fit.
  Wheel/trackpad input follows instantly — no smoothing, no momentum, and no
  snapping of any kind.
- Exactly one camera animation per intent; reduced motion makes every fit a
  jump. Automatic travel uses one 420 ms duration and a symmetric sine
  ease-in-out across every route, keeping camera movement synchronized with
  its focus fades. Manual wheel, pinch, drag, and keyboard input remains
  immediate and never runs through this animation clock.
- Wheel and trackpad zoom preserve the world point beneath the cursor. A
  two-finger pinch maps its previous midpoint directly to its current midpoint,
  combining scale and finger drift in one transform instead of applying drift
  twice.
- Focused phase and scenario boards are centered in the canvas. Floating
  sequence controls use equal top and bottom clearance so avoiding the controls
  never shifts the selected board off the visual center.
- Camera time begins on the first drawable animation frame. React/layout work
  may delay the start, but it cannot consume the ease before the browser paints.
- Focus mode dims non-selected phase/scenario cards to 30%, then lifts them to
  70% on hover or keyboard focus. They remain navigation targets so a reader
  can switch focus directly; cell-level actions inside them remain inactive.

### What "exactly one camera animation per intent" rests on

The rule above is not self-enforcing. Three invariants hold it up, and each
has been broken at least once — always with the same symptom, a navigation
that lurches or appears to overshoot. Check them before touching canvas
layout, not just canvas camera code.

**1. Focus changes no geometry.** A canvas click starts the ease immediately
from the geometry on screen (`focusActiveCanvasSlide`, before React's
navigation reconciles), and the navigation then bumps the fit key, which
computes the fit a second time. `fitToView` skips that second animation only
when the two targets agree. So anything that resizes the focused panel
*because* it became focused guarantees a second ease that supersedes the
first partway through — and an ease-in-out restarting from a moving camera
drops to zero velocity, which is the lurch. Every scenario in a phase row
therefore takes identical layout props whether or not it is the focused one.
The focused scenario is excluded from the row-height **input** (see below);
it is never excluded from the row-height **contract**.

**2. Scale interpolates geometrically, not linearly.** Zoom is the reciprocal
of the visible rect's width, so interpolating width linearly makes the
perceived rate hyperbolic and the ease curve decorative. Measured on a real
zoom-out before this was fixed: 78% of the perceived travel was done by the
halfway frame, 98% by 74% of the duration — the camera flew out and then
hung, which reads exactly as overshoot. `interpolateCameraTransform`
interpolates the viewport **centre** linearly and the **scale** as a ratio
(`z0·(z1/z0)^t`), which is what makes the ease symmetric between zooming in
and zooming out. `cameraTransition.test.ts` pins equal ratios per quarter.

**3. A fit waits for its target's layout to settle.** Compare panels reach
their real size across more than one commit, so the fit scheduled by a fit-key
change holds until the target measures the same size on two consecutive frames
(250 ms backstop). Without it the ease aims at half-grown geometry and the
resize observer's correction lands as a snap on top of the finished ease. The
resize observer's own owed-fit branch stands down while that loop is watching,
since the resizes it sees are the ones being waited out.

## The phase-row height contract

Scenario panels in one phase row share a height so the row reads as one
object: the step header row and the lane rail sit at the same height in every
panel. Two rules keep that true.

**Boards top-align inside their panel, always.** Never centred. Centring each
board independently inside its own container is precisely what breaks the
row — shorter boards drift down and their headers no longer line up with
their neighbours'. It also makes the padding above a board appear to change
as the measurement settles.

**The focused scenario is excluded from the height input, not from the
contract.** It still receives the row height like every other panel
(invariant 1 above). It is left out of the `Math.max` that computes that
height, because otherwise a comparison opened inside a focused scenario
inflates its dimmed neighbours: a second path once grew six untouched
siblings from 2218px to 4250px each. The same inflation raised the focused
panel's own floor, which is where the dead gray under a focused Merged view
came from — one exclusion fixes both, because the row height is a floor and
not a ceiling (`targetHeight` in `ResizableComparePanel`), so a taller board
simply grows past it.

Panel content is measured in a **layout** effect, not a passive one. The
panel answers growth in the commit that causes it (the estimate rises
immediately) but can only answer shrinkage once a new measurement arrives —
measure a paint late and the two directions stop behaving alike: adding a
path resizes at once, removing one holds the old size for a frame and then
snaps. The camera fit, which waits on this size, inherits that asymmetry
exactly.

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
