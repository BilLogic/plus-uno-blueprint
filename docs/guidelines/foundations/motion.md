---
audience: designers
summary: The motion vocabulary, the drift test that pins it, the reduced-motion policy, and the list of moments that deliberately do not animate.
sources: src/styles/animations.css, src/lib/motion.ts, src/lib/cameraTransition.ts, src/hooks/useZoomPanViewport.ts
last-reviewed: 2026-09-09
---

# Motion

## The vocabulary

Everything derives from the sidebar collapse — the one motion that was already
right — so structural moves, crossfades, and camera eases read as one system
rather than per-screen inventions. Five duration tokens and two easing profiles:

| Token                                       | Used for                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--motion-micro`                            | Hover, badges, threshold fades, panel exits                                                            |
| `--motion-fade` (+ `--motion-fade-stagger`) | Opacity crossfades, and the offset between an out/in pair                                              |
| `--motion-structural`                       | Width/size changes — sidebar collapse, presentation wipe                                               |
| `--motion-camera`                           | Nominal camera reference and non-flight camera-adjacent CSS                                             |
| `--ease-structural`                         | The quintic-out ease for structural moves (a Tailwind `@theme` key, so `ease-structural` is a utility) |
| `--ease-camera`                             | The symmetric ease family for camera-adjacent CSS                                                       |

Values live in two homes that must agree: `src/styles/animations.css` (CSS)
and `src/lib/motion.ts` (JS that has to wait for them, plus
`prefersReducedMotion()`). Illustratively: micro 150ms, fade 200ms + 75ms
stagger, structural 320ms, and camera 420ms as a nominal reference — but
automatic camera flights derive a 240–650ms duration from screen-space travel
and logarithmic zoom distance. The camera-flight model owns that bound; route
call sites do not choose timing.
Durations are consumed as `duration-(--motion-structural)` since Tailwind v4
has no duration namespace.

An easing token only describes what a reader sees if the property it drives is
perceived linearly in the value being interpolated. Scale is not: it is
perceived as a **ratio**, so camera zoom interpolates geometrically
(`z0·(z1/z0)^t`) and the ease is applied to that. Interpolating the visible
width linearly instead — zoom being width's reciprocal — makes the curve
hyperbolic and the token decorative, front-loading one direction and
back-loading the other. The measurement that caught it is in "What 'exactly one camera animation per
intent' rests on", below.

Asymmetry is part of the vocabulary: **arriving is an event, leaving is not**.
Enters run on `--motion-fade`; exits on the shorter `--motion-micro` (see the
cell-panel block in `animations.css` for the worked example, including why the
exit swaps to `ease-in`).

## The test that pins it

`src/lib/motion.test.ts` holds the two homes to the same numbers — change one
without the other and the suite fails. This is what makes the vocabulary a
_vocabulary_: a new duration or easing is a system change made in both files
with the test updated, never a literal at a call site.

Timing literals at call sites are a review rule, **not a checked one**: no lint
rule and no test scans for them, and one violation ships today
(`CoverFigure.tsx:99,103` use `duration-200`). Read this as "a reviewer will
ask you to justify it", not as "the build stops you".

## Reduced motion

**Every animation has a reduced path, and an instant swap is an acceptable
one.** The `prefers-reduced-motion` block in `animations.css` zeroes the
transitions and strips travel (surfaces appear/disappear; they never move);
camera flights jump.
JS reads the preference **live** via `prefersReducedMotion()` — never cached
at mount — because the OS setting can change mid-session. A new animation
ships with its reduced path in the same PR or it does not ship.

## When NOT to animate

Motion carries information here; motion that carries none is noise. Pinned
non-animations (rationale in the 2026-07-30 motion plan):

- **Path toggles in overview never move the camera.** In a focused scenario,
  adding or removing a compared path changes the framed layout and therefore
  gets one normal camera ease to the new fit.
- **Chrome-driven resizes** (tab strip mounting, header reflow) never refit;
  real window resizes re-center un-eased, debounced.
- **First fit after any mount jumps** — no swoop-from-nowhere.
- **No snapping, ever**: no zoom quantization, no magnetic thresholds. Direct
  manipulation (wheel, drag, pinch) follows the pointer instantly.
- **Never transition `filter`** — it repaints every affected cell per frame
  (the slice dim applies its desaturation un-transitioned on frame 1 under an
  opacity ease; see the comment in `src/styles/blueprint.css`).
  ⚠️ **Violated in app code today**: `BlueprintCellDetailPanel.tsx:1139` sets
  `transition-[filter,opacity]`. The rule stands and the call site is wrong;
  whether the panel's single filtered surface is cheap enough to be a named
  exception is a perf question this doc cannot settle. Filed, not swept.
- Exactly **one camera flight per user intent** — a boot, a phase click, a
  flight; never a restarted or doubled ease. Automatic fits use one bounded,
  distance-aware model. Its sampled progress drives both transform and
  transient focus, so they settle together without parallel clocks.

Loading follows the same restraint: one deferred skeleton per surface,
all-or-nothing swap — see [components](../components/overview.md#empty-loading-and-error-states).

## What "exactly one camera flight per intent" rests on

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
click ran one glide superseded partway by another, and the replacement
restarted from zero velocity — glide, brake, glide. The current flight starts
on the first drawable frame and carries compatible live momentum when a newer
intent supersedes it.

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

**2. The destination approaches in screen space while scale interpolates
geometrically.** Zoom is the reciprocal
of the visible rect's width, so interpolating width linearly makes the
perceived rate hyperbolic and the ease curve decorative. Measured on a real
zoom-out before this was fixed: 78% of the perceived travel was done by the
halfway frame, 98% by 74% of the duration — the camera flew out and then
hung, which reads exactly as overshoot. A world-linear viewport centre is
still insufficient: under a large zoom-in it can make the destination move
farther away on screen before returning. `interpolateCameraTransform` instead
moves the final viewpoint monotonically toward the screen centre and changes
**scale** as a ratio (`z0·(z1/z0)^t`). `cameraTransition.test.ts` pins both
properties densely.

**3. A fit takes off once the named target exists, and retargets while live.**
Compare panels reach
their real size across more than one commit. The flight starts once the
intended element is measurable for two frames — not once its box and the
viewport have frozen. Waiting for left/top/width/height to agree made
overview → scenario sit on the 250 ms backstop: focusing a scenario mounts
a sticky header and can reshuffle row height, so consecutive frames rarely
match. Overview → phase barely churns, which is why it already felt
immediate. Late growth after takeoff is a live replan from the current
transform and velocity, not a second animation or a landing snap. The
resize observer's owed-fit branch stands down while the settle loop is
watching, since the resizes it sees are the ones being waited out. The
250 ms backstop remains for a target that never appears.

**3a. A zoom-in from the blocks tier does not paint the whole board.** Below
`SEMANTIC_ZOOM_THRESHOLD` cells are density blocks. Overview → phase lands
still below it, so takeoff is cheap. Overview → scenario lands above it:
stamping that destination zoom on the canvas root used to reveal every
cell's text on the first camera frame, a style/paint burst of hundreds of
milliseconds before anything moved — and the inverse path paid the hide
on the way back. The flight now keeps the blocks mark and sets
`data-camera-flight-reveal` on the named target so only that subtree
shows text. Wheel and pinch still follow the live zoom and will leave
the tier when the reader asks.

## The vendored layer's exemption

Components under `src/components/ui/` (the vendored shadcn/base-ui
layer) run their own literal durations rather than the `--motion-*`
vocabulary. This is deliberate: the layer is upstream-maintained and
re-generated by the shadcn CLI, and rebasing its timings onto local
tokens would be undone by every regeneration. The one-vocabulary rule
applies to everything the project authors; the vendored layer is read
as third-party.
