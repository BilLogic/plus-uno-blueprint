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
- A wheel notch means the same thing everywhere: deltas are normalised to
  pixels at the point of entry from the mode the event reports (Firefox sends
  lines, Chromium pixels), and a single event's zoom step is capped so a
  mouse notch cannot jump the scale nearly threefold. The Mac trackpad is the
  baseline and is unchanged by both.
- Arrow keys pan the camera while focus is inside the viewport (Shift for a
  stride), through the same `panBy` primitive the pointer and the agent use.
  Focusing a cell by keyboard moves the camera until that cell is on screen —
  the viewport is transform-based and hides its overflow, so the browser's own
  scroll-into-view cannot help, and the container's scroll offsets are held at
  zero because the camera's maths assumes them. A focus move never interrupts
  a fit already in flight.
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

**1. One writer per navigation.** There is exactly one camera writer for a
navigation: the fit scheduled when the fit key changes. There used to be a
second — an ease started imperatively at click time, before React
reconciled — and the two could never agree on a destination, because the
pre-flight closed over the *overview's* fit parameters (`maxFitZoom: 1`,
margin 48, no insets) while the settled fit uses the *focused* view's
(`MAX_ZOOM`, margin 20, 56px insets), and navigating also mounts the sticky
header, which changes the container's height. `fitToView` skips a second
animation only when the targets match, so that skip could never fire: every
click ran a 420 ms glide superseded partway by another, and a sine ease
restarted from a moving camera departs at zero velocity — glide, brake,
glide. `createCameraTransitionClock` already covers the latency the
pre-flight was for, by starting the ease's clock on the first frame the
browser can draw.

Keep this property when adding camera entry points: an imperative flight and
a fit-key flight for the same intent will fight unless they compute the same
destination from the same parameters.

**1a. Focus should change as little geometry as possible.** Every scenario in
a phase row takes identical layout props whether or not it is the focused
one, and no focus styling touches a box-affecting property (the dim rules set
`opacity`, `background-color`, `border-color`, `box-shadow` only).

This is a discipline, not a guarantee, and the honest statement of the
remaining hole is: the focused scenario is excluded from the row-height
**input**, and that height reaches every panel — including the focused one —
as a `Math.max` floor. So the focused panel's box is unchanged *provided its
own measured content exceeds the row floor*, which is the ordinary case and
is exactly the case the exclusion was introduced for. Where a hot estimate
for the focused scenario is strictly the row maximum, focusing it does shrink
the row. Fixing that properly means fixing the estimator, not the exclusion.

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

**The row height is MEASURED, and the estimate is only a placeholder.** The
estimate exists to size panels in the commit before anything has been
measured; the moment a measurement lands it replaces the estimate outright,
in both directions. Treating it as a floor put **84px of dead gray under
every board on the canvas** — the same 84px on all six phase rows, which is
the signature of an arithmetic error, not a measurement one. A `Math.max`
against a prediction that is always high can never correct itself. Two
independent terms produced it: 64px because the panel-height estimates
called `getComparePanelScrollPaddingY()` with no options and so budgeted for
the *unlocked* scroll chrome — resize-handle inset plus artboard buffer — on
panels that are height-locked and have no handle, while the measuring pass
and `ResizableComparePanel` both correctly passed `{ lockHeight: true }`;
and 20px for a path-section bottom inset the stacked board does not render.
The estimates take the chrome as an argument now, so the placeholder is
close — but nothing depends on it being right any more, which is the point.
A future drift shows up as one wrong pre-paint frame instead of permanent
gray.

**A panel leaves the row's height input only when it is EXPANDED, never
merely because it is focused.** The exclusion exists for one case: a
comparison opened inside a focused scenario reaching its dimmed neighbours.
Gating it on focus instead made invariant 1 unsatisfiable — excluding a
panel changes the row height, and the focused panel went down with it (the
Application row read 1766px at overview and 1730px once Discovery was
focused; that 36px was the container padding appearing to jump between the
phase view and the scenario view). Gated on the expansion, a plain focus
leaves every number in the row exactly where it was, and an expanded panel
is still bucketed rather than dropped — `resolveScenarioPanelHeight` hands
it `max(rowHeight, itsOwn)` so excluding it can never shrink it.

The marker is an explicit `data-row-height-excluded` attribute, not a
reading of `data-canvas-focus-active`. That attribute is set on the phase
SECTION as well as the panel, so a `closest()` for it matched *every* panel
in a focused row rather than the focused one — which silently disabled the
row measurement altogether and dropped the row to its estimate.

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
- **A finger inside a scrolling region scrolls it, not the board.** The board
  does contain scrollable regions (an overflowing `ServiceBlueprintGrid`), and
  the wheel path has always handed them their deltas; touch does the same, off
  the same determination (`canvasScrollRegions.ts`). Two fingers are still a
  pinch wherever they land — a region gets `touch-action: pan-x pan-y`, never
  `auto`.

**The gesture is claimed twice over: declared in CSS, then taken in JS.**
`touch-action: none` is set on the viewport, on the transformed content
wrapper, and on every descendant of it (`blueprint.css`) — but that property
is a *declaration* the compositor consults before deciding whether a touch
belongs to the page, and `[data-zoom-pan-content]` is a composited layer that
WebKit does not dependably resolve it across. When it resolves to `auto` the
browser takes the touch and answers with `pointercancel`: a finger on empty
canvas pans, the identical finger on a cell does nothing, and two fingers
zoom the page instead of the board. So the viewport also holds non-passive
`touchmove` and `touchstart` listeners that call `preventDefault` — no layer
boundary sits between an event already delivered and its default action.
`touchstart` is claimed only from the second finger: preventing the first
would suppress the click a tap depends on, while multi-touch synthesizes no
click and is where WebKit's page pinch-zoom starts, which `touch-action`
cannot reach at all. Chromium resolves the declaration correctly and never
showed any of this, which is why `canvasTouchContract.test.ts` pins both
halves — no amount of checking in a Chromium pane can catch a regression
here.

The viewport observes pointer streams in native capture, before populated
lanes, cells, or controls can stop bubbling. Desktop adds two temporary pan
overrides without changing the selected tool: hold Space and primary-drag, or
drag with the middle mouse button. Editable fields retain Space and shortcuts.

Desktop wheel/keyboard paths are untouched by all of this, and an
interaction test pins the pinch path. macOS Safari's trackpad pinch is a
third mechanism again — WebKit `gesture*` events, with no touch pointers and
no synthesised ctrl+wheel behind them — so the canvas reads their cumulative
`scale` and zooms from it, gated on the touch-pointer count being zero so
that iOS, where the pointer map already pinches, never applies scale twice. Breakpoint questions (what exists on a
phone at all) belong to [responsive](responsive.md).
