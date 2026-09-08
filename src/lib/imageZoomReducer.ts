/**
 * Everything an image viewer decides about scale and position, as arithmetic.
 *
 * A reader opens an image, pushes the wheel, pinches, clicks, double-clicks
 * and drags; each of those has to become a scale and an offset, and the
 * cursor has to say which one the next gesture will be. None of that needs a
 * DOM, so none of it lives in one — the hook that owns the state calls these
 * functions and writes the result, and the behaviour is argued about here, in
 * numbers, rather than through a rendered popup.
 *
 * The genuinely hard cross-platform parts are NOT re-derived here. A wheel
 * notch means different numbers on different browsers and a macOS trackpad
 * pinch arrives as a cumulative gesture scale; `canvasWheelDelta` and
 * `canvasGestureZoom` already solved both for the board, and this module
 * consumes them so that the two surfaces cannot come to disagree about what
 * one notch of wheel is worth.
 *
 * Coordinates. An anchor is a point inside the viewport, measured in CSS
 * pixels from its top-left corner, which is what a pointer event reports
 * against the popup's box. The offset is the image CENTRE's displacement
 * from the viewport centre, so fit is `{0, 0}` in every image and the
 * clamping below is symmetric instead of having to subtract a top-left
 * corner that moves with the scale.
 */
import { gestureScaleFactor } from '@/lib/canvasGestureZoom'
import {
  normalizeWheelDelta,
  wheelZoomScaleFactor,
  type WheelDeltaInput,
} from '@/lib/canvasWheelDelta'

/**
 * The ceiling, as a multiple of natural size. Scale is measured against the
 * image's own pixels, so this constant IS the maximum scale: past three
 * times, a screenshot is mush and there is nothing further to read.
 */
export const IMAGE_ZOOM_MAX_NATURAL_MULTIPLE = 3

/** What one click of zoom is worth. Doubling is a step the eye can follow. */
export const IMAGE_ZOOM_CLICK_STEP = 2

/**
 * The smallest change of scale worth making a reader watch.
 *
 * A ratio, not a scale and not a number of pixels, because every rule the
 * click ladder is built from has to hold at every viewport width. The step is
 * relative and the ceiling is absolute, so the range a ladder has to divide —
 * the ceiling over fit — shrinks as the viewport grows, and only a rule
 * stated as a ratio survives that. A quarter again as large is a change the
 * eye reads as a change; five percent reads as a click that did nothing.
 */
export const IMAGE_ZOOM_MIN_VISIBLE_STEP = 1.25

/**
 * How far a pointer may travel between press and release and still be a
 * click. A distance, not a timer: a timer punishes a slow deliberate click,
 * and it would force a fake clock into every test of this file.
 */
export const IMAGE_CLICK_DRAG_THRESHOLD_PX = 4

/**
 * Scale comparisons decide whether a click returns to fit and whether a
 * double-click is toggling back, so they run against a scale the clamp may
 * have arrived at by a different route. A relative tolerance keeps that
 * decision from turning on the last bit of a float.
 */
const SCALE_TOLERANCE = 1e-9

export type ImageSize = { width: number; height: number }
export type ImagePoint = { x: number; y: number }

export type ImageZoomViewport = {
  /** The popup's content box, in CSS pixels. */
  viewport: ImageSize
  /** The image's intrinsic size, in CSS pixels. */
  natural: ImageSize
  /** Multiplier on natural size: 1 is natural, `fitImageScale` is the floor. */
  scale: number
  /** The image centre's displacement from the viewport centre, in screen px. */
  offset: ImagePoint
}

/** The cursors this viewer offers, spelled as the CSS keywords they become. */
export type ImageZoomCursor = 'zoom-in' | 'zoom-out' | 'grab' | 'grabbing'

const isMeasured = (size: ImageSize): boolean =>
  Number.isFinite(size.width) &&
  Number.isFinite(size.height) &&
  size.width > 0 &&
  size.height > 0

/** `-0` compares and renders as its own number, and nobody ever means it. */
const zeroSafe = (value: number): number => (value === 0 ? 0 : value)

const sameScale = (a: number, b: number): boolean =>
  Math.abs(a - b) <= Math.max(1, Math.abs(b)) * SCALE_TOLERANCE

/**
 * The scale at which the image exactly fills the viewport in one axis.
 *
 * This is the floor for every image large enough to need shrinking, which is
 * the whole reason the popup is fullscreen — see `imageScaleBounds` for the
 * one shape where the ceiling caps it. Before either box has been
 * measured — a first render, an image whose `naturalWidth` is still 0 —
 * there is no fit to compute, and natural size is the honest answer rather
 * than a division by zero that poisons every offset downstream.
 */
export function fitImageScale(viewport: ImageSize, natural: ImageSize): number {
  if (!isMeasured(viewport) || !isMeasured(natural)) return 1
  return Math.min(
    viewport.width / natural.width,
    viewport.height / natural.height,
  )
}

/**
 * The scales this image may take, floor first.
 *
 * The two rules collide on one shape: an image small enough that fitting it
 * already blows it up past three times natural size. Neither rule wins
 * outright — the FLOOR IS THE FIT SCALE CAPPED AT THE CEILING, so each keeps
 * the intent it was written with.
 *
 * The floor exists to stop a fullscreen popup rendering a postage stamp in
 * the middle of the screen, and that was written imagining a large diagram
 * shrunk down, where fit sits below 1. When fit is already above the ceiling
 * nothing is floating small — the image is simply tiny, and stretching a
 * hundred-pixel picture across the viewport at eight times natural size
 * produces exactly the mush the ceiling exists to prevent.
 *
 * Both bounds then coincide and the image is pinned at one scale, which is
 * the truth of it: a picture that small has no detail left to reveal. It
 * renders at three times natural, centred, rather than filling the frame.
 */
function imageScaleBounds(
  viewport: ImageSize,
  natural: ImageSize,
): { min: number; max: number } {
  const fit = fitImageScale(viewport, natural)
  return {
    min: Math.min(fit, IMAGE_ZOOM_MAX_NATURAL_MULTIPLE),
    max: IMAGE_ZOOM_MAX_NATURAL_MULTIPLE,
  }
}

export function clampImageScale(
  scale: number,
  viewport: ImageSize,
  natural: ImageSize,
): number {
  const { min, max } = imageScaleBounds(viewport, natural)
  if (!Number.isFinite(scale)) return min
  return Math.min(max, Math.max(min, scale))
}

/**
 * How far the image centre may travel from the viewport centre before an
 * edge comes inside the frame, per axis.
 *
 * Zero on an axis the image does not overflow, which is what makes "a drag
 * at fit does not pan" fall out of the clamp instead of needing a guard: at
 * fit the image overflows nothing.
 */
function panLimits(
  scale: number,
  viewport: ImageSize,
  natural: ImageSize,
): ImagePoint {
  if (!isMeasured(viewport) || !isMeasured(natural)) return { x: 0, y: 0 }
  return {
    x: Math.max(0, (natural.width * scale - viewport.width) / 2),
    y: Math.max(0, (natural.height * scale - viewport.height) / 2),
  }
}

/**
 * The offset with the image held against the viewport: never a gap along an
 * axis it overflows, and centred along one it does not.
 */
function clampOffset(
  offset: ImagePoint,
  scale: number,
  viewport: ImageSize,
  natural: ImageSize,
): ImagePoint {
  const limit = panLimits(scale, viewport, natural)
  const axis = (value: number, bound: number) =>
    zeroSafe(
      Number.isFinite(value) ? Math.min(bound, Math.max(-bound, value)) : 0,
    )
  return { x: axis(offset.x, limit.x), y: axis(offset.y, limit.y) }
}

/**
 * The viewer's opening state, and the state a sibling step returns to.
 *
 * Stepping deliberately drops the scale and pan the reader had built up:
 * carrying them across would have to reason about two images with different
 * aspect ratios, which is more than this state is worth.
 */
export function fitImageZoom(
  viewport: ImageSize,
  natural: ImageSize,
): ImageZoomViewport {
  return {
    viewport,
    natural,
    // Through the clamp, not the raw fit: an image small enough that fitting
    // it would exceed the ceiling opens at the ceiling instead.
    scale: clampImageScale(fitImageScale(viewport, natural), viewport, natural),
    offset: { x: 0, y: 0 },
  }
}

/**
 * Rescales while holding the image point under `anchor` where it is.
 *
 * Every zoom in this module goes through here, so a wheel notch and a click
 * cannot end up anchoring differently. The clamp on the way out is what makes
 * a zoom out land back at fit dead centre rather than leaving the image
 * hanging off one side at the scale it was dragged to.
 */
export function zoomImageToScale(
  state: ImageZoomViewport,
  targetScale: number,
  anchor: ImagePoint,
): ImageZoomViewport {
  const scale = clampImageScale(targetScale, state.viewport, state.natural)
  const ratio =
    state.scale > 0 && Number.isFinite(state.scale) ? scale / state.scale : 1
  const from = {
    x: Number.isFinite(anchor.x) ? anchor.x - state.viewport.width / 2 : 0,
    y: Number.isFinite(anchor.y) ? anchor.y - state.viewport.height / 2 : 0,
  }
  const offset = {
    x: from.x + (state.offset.x - from.x) * ratio,
    y: from.y + (state.offset.y - from.y) * ratio,
  }
  return {
    ...state,
    scale,
    offset: clampOffset(offset, scale, state.viewport, state.natural),
  }
}

/** Multiplies the scale — the shape both continuous gestures arrive in. */
export function zoomImageByFactor(
  state: ImageZoomViewport,
  factor: number,
  anchor: ImagePoint,
): ImageZoomViewport {
  if (!Number.isFinite(factor) || factor <= 0) return state
  return zoomImageToScale(state, state.scale * factor, anchor)
}

/**
 * One wheel event, in whatever unit the browser reported it, as a zoom.
 *
 * Continuous: no step, no snap, and the caller is expected not to tween it —
 * a tween on a gesture the hand is still making reads as lag.
 */
export function zoomImageByWheel(
  state: ImageZoomViewport,
  event: WheelDeltaInput,
  anchor: ImagePoint,
): ImageZoomViewport {
  const { deltaY } = normalizeWheelDelta(event)
  return zoomImageByFactor(state, wheelZoomScaleFactor(deltaY), anchor)
}

/**
 * One step of a trackpad pinch, from the cumulative scales WebKit reports.
 *
 * Whether this platform's pinch is ours to apply at all is the caller's
 * question — `shouldApplyGestureZoom` answers it from the touch pointers the
 * caller can see, and this module cannot.
 */
export function zoomImageByGesture(
  state: ImageZoomViewport,
  previousGestureScale: number,
  nextGestureScale: number,
  anchor: ImagePoint,
): ImageZoomViewport {
  return zoomImageByFactor(
    state,
    gestureScaleFactor(previousGestureScale, nextGestureScale),
    anchor,
  )
}

/**
 * Where a click goes from here: a scale, or `null` for "back to fit".
 *
 * The step is relative and the ceiling is absolute, so the range a ladder has
 * to divide — the ceiling over fit — is not a fixed thing. An 880px figure
 * fits at 1.14 on a laptop and at 2.18 on a wide display, leaving 2.6 times
 * of room in the first and 1.4 in the second, and a doubling divides neither
 * evenly. What will not divide lands on the LAST rung, where it is worst: a
 * reader who has clicked to the top of the ladder gets a final click worth
 * five percent, which reads as a broken control rather than as "you are at
 * maximum".
 *
 * Two rules, both stated as ratios so that a wide display and a phone get one
 * ladder rather than two different ones:
 *
 * - a stop that would leave less than a visible step below the ceiling is not
 *   a stop. The click takes the ceiling instead, so the remainder is absorbed
 *   into the rung above rather than saved up to be the last one.
 * - a click with no visible step left above it has nothing to offer, so it
 *   goes back to fit — which is what a click at the ceiling has always done,
 *   now said in terms of what the reader can see rather than of one exact
 *   scale a wheel can stop just short of.
 *
 * Between them, every click that changes the scale changes it by at least
 * `IMAGE_ZOOM_MIN_VISIBLE_STEP`, at every viewport width. The one image with
 * nothing to offer is the one whose whole range is under a single step —
 * artwork blown up until fitting alone nearly touches the ceiling — and there
 * a click stays where it is rather than nudging.
 *
 * The double-click's second stop is deliberately NOT absorbed the same way.
 * It is a two-stop toggle rather than a ladder, so it has no last rung to
 * leave over, and #474 gave it a stop that is a FIXED multiple of fit;
 * absorbing that into the ceiling would make it a different multiple on every
 * viewport, which is the property that fix exists to hold.
 */
function clickZoomTarget(state: ImageZoomViewport): number | null {
  const { max } = imageScaleBounds(state.viewport, state.natural)
  const stepped = Math.min(max, state.scale * IMAGE_ZOOM_CLICK_STEP)
  const target = max / stepped < IMAGE_ZOOM_MIN_VISIBLE_STEP ? max : stepped
  return target >= state.scale * IMAGE_ZOOM_MIN_VISIBLE_STEP ? target : null
}

/**
 * A click on the image: one visible step in, or back to fit when there is no
 * visible step left to take.
 *
 * The wrap is what keeps the gesture from becoming a dead end. A reader who
 * has clicked their way to the top and clicks again gets the whole image
 * back, rather than a click that does nothing and reads as a broken control.
 */
export function clickZoomImage(
  state: ImageZoomViewport,
  anchor: ImagePoint,
): ImageZoomViewport {
  const target = clickZoomTarget(state)
  if (target === null) return fitImageZoom(state.viewport, state.natural)
  return zoomImageToScale(state, target, anchor)
}

/**
 * A double-click: fit and one scale closer in, either way round.
 *
 * Closer in means natural size wherever natural size can be reached, because
 * that is the scale a reader cannot arrive at by stepping and the one where a
 * screenshot's text is drawn at the size it was captured. From anywhere in
 * between, the toggle lands there.
 *
 * It cannot always be reached. Scale is measured against natural size, so
 * natural size is scale 1, and the floor of the range is the fit scale: an
 * image narrower than its viewport fits at more than 1, the clamp pulls scale
 * 1 up to that floor, and the toggle finds itself already standing on its own
 * target. That is not a rare shape — it is every cover figure on a desktop,
 * where 880px of artwork in a 1200px box fits at 1.36.
 *
 * The floor is not the mistake; letting a diagram shrink into the middle of
 * an empty screen would be worse than a dead gesture. The mistake is naming
 * the second stop as an ABSOLUTE scale when the first is a RELATIVE one: fit
 * moves with the viewport, natural size does not, and on a wide screen the
 * two cross. So where natural size has gone under the floor, the second stop
 * is stated relative to fit instead — one click's worth in, capped by the
 * ceiling, so the click and the double-click agree about what closer means. A
 * desktop and a phone then get one gesture rather than a live one and a dead
 * one.
 *
 * One image is still left with nowhere to go: the postage stamp whose floor
 * and ceiling coincide, which is pinned at a single scale by `imageScaleBounds`
 * and has no detail left to reveal at any other.
 */
export function toggleImageZoom(
  state: ImageZoomViewport,
  anchor: ImagePoint,
): ImageZoomViewport {
  const { min: fit } = imageScaleBounds(state.viewport, state.natural)
  const naturalScale = clampImageScale(1, state.viewport, state.natural)
  const target = sameScale(naturalScale, fit)
    ? clampImageScale(
        fit * IMAGE_ZOOM_CLICK_STEP,
        state.viewport,
        state.natural,
      )
    : naturalScale
  if (sameScale(state.scale, target)) {
    return fitImageZoom(state.viewport, state.natural)
  }
  return zoomImageToScale(state, target, anchor)
}

/** The image follows the pointer, as far as the clamp allows. */
export function panImageBy(
  state: ImageZoomViewport,
  delta: ImagePoint,
): ImageZoomViewport {
  const moved = {
    x: state.offset.x + (Number.isFinite(delta.x) ? delta.x : 0),
    y: state.offset.y + (Number.isFinite(delta.y) ? delta.y : 0),
  }
  return {
    ...state,
    offset: clampOffset(moved, state.scale, state.viewport, state.natural),
  }
}

/** True when the image overflows the viewport in either axis. */
export function canPanImage(state: ImageZoomViewport): boolean {
  const limit = panLimits(state.scale, state.viewport, state.natural)
  return limit.x > 0 || limit.y > 0
}

/** A press and a release close enough together in space to be one click. */
export function isImageClick(from: ImagePoint, to: ImagePoint): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false
  return Math.hypot(dx, dy) <= IMAGE_CLICK_DRAG_THRESHOLD_PX
}

/**
 * Which cursor this state implies — the viewer's only running explanation of
 * what the next gesture does, so the reader does not have to find the
 * gestures by accident.
 *
 * The top of the range outranks the grab because there the click is the
 * interesting affordance: it is the way back to the whole image. The drag is
 * still available there; a reader mid-drag is told so by `grabbing`, which
 * outranks everything.
 *
 * "At the top" is asked of the click itself rather than measured against the
 * ceiling a second time here, so the two cannot come to disagree. A reader a
 * wheel notch short of the ceiling is at the top as far as a click is
 * concerned, and is told so, instead of being shown a `grab` that says "drag
 * me" at the moment a click is the only thing left.
 */
export function resolveImageZoomCursor(
  state: ImageZoomViewport,
  options: { dragging?: boolean } = {},
): ImageZoomCursor {
  if (options.dragging) return 'grabbing'
  const { min, max } = imageScaleBounds(state.viewport, state.natural)
  if (max > min && clickZoomTarget(state) === null) return 'zoom-out'
  if (canPanImage(state)) return 'grab'
  return 'zoom-in'
}
