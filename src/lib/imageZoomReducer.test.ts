import { describe, expect, it } from 'vitest'
import {
  canPanImage,
  clickZoomImage,
  fitImageScale,
  fitImageZoom,
  isImageClick,
  panImageBy,
  resolveImageZoomCursor,
  toggleImageZoom,
  zoomImageByFactor,
  zoomImageByGesture,
  zoomImageByWheel,
  zoomImageToScale,
  IMAGE_CLICK_DRAG_THRESHOLD_PX,
  IMAGE_ZOOM_MAX_NATURAL_MULTIPLE,
  type ImageZoomViewport,
  type ImagePoint,
  type ImageSize,
} from '@/lib/imageZoomReducer'

const VIEWPORT = { width: 1000, height: 800 }
/** Fits at 0.5 in both axes, so every assertion below has room to zoom. */
const NATURAL = { width: 2000, height: 1600 }

const opened = () => fitImageZoom(VIEWPORT, NATURAL)

/** A point on the image, in natural pixels from its centre, under `anchor`. */
const imagePointUnder = (state: ImageZoomViewport, anchor: ImagePoint) => ({
  x: (anchor.x - state.viewport.width / 2 - state.offset.x) / state.scale,
  y: (anchor.y - state.viewport.height / 2 - state.offset.y) / state.scale,
})

const CENTRE = { x: 500, y: 400 }
const OFF_CENTRE = { x: 700, y: 600 }

describe('fitImageZoom', () => {
  it('opens at fit, centred', () => {
    expect(opened()).toEqual({
      viewport: VIEWPORT,
      natural: NATURAL,
      scale: 0.5,
      offset: { x: 0, y: 0 },
    })
  })

  it('fits to whichever axis runs out first', () => {
    expect(fitImageScale(VIEWPORT, { width: 4000, height: 1600 })).toBe(0.25)
    expect(fitImageScale(VIEWPORT, { width: 2000, height: 3200 })).toBe(0.25)
  })

  it('returns a sibling to fit rather than carrying the viewport over', () => {
    const zoomed = panImageBy(
      zoomImageToScale(opened(), 2, OFF_CENTRE),
      { x: -120, y: -90 },
    )
    expect(zoomed.scale).toBe(2)
    expect(zoomed.offset).not.toEqual({ x: 0, y: 0 })

    const sibling = fitImageZoom(zoomed.viewport, { width: 1000, height: 1000 })
    expect(sibling.scale).toBe(0.8)
    expect(sibling.offset).toEqual({ x: 0, y: 0 })
  })
})

describe('scale bounds', () => {
  it('never zooms out below fit, however hard the wheel is pushed', () => {
    const state = zoomImageByWheel(
      opened(),
      { deltaX: 0, deltaY: 400, deltaMode: 0 },
      CENTRE,
    )
    expect(state.scale).toBe(0.5)
  })

  it('never zooms in past three times natural size', () => {
    let state = opened()
    for (let i = 0; i < 40; i += 1) {
      state = zoomImageByWheel(
        state,
        { deltaX: 0, deltaY: -100, deltaMode: 0 },
        CENTRE,
      )
    }
    expect(state.scale).toBe(IMAGE_ZOOM_MAX_NATURAL_MULTIPLE)
  })

  it('caps the floor at the ceiling when fit already exceeds it', () => {
    // A postage stamp in a fullscreen popup: it opens at three times natural
    // and stays there, rather than stretching to fill the frame. Both bounds
    // coincide, so there is nothing left to zoom in either direction.
    const stamp = fitImageZoom(VIEWPORT, { width: 100, height: 100 })
    expect(stamp.scale).toBe(IMAGE_ZOOM_MAX_NATURAL_MULTIPLE)
    expect(zoomImageToScale(stamp, 1, CENTRE).scale).toBe(
      IMAGE_ZOOM_MAX_NATURAL_MULTIPLE,
    )
    expect(zoomImageToScale(stamp, 8, CENTRE).scale).toBe(
      IMAGE_ZOOM_MAX_NATURAL_MULTIPLE,
    )
  })

  it('leaves an image that needs shrinking on the fit scale', () => {
    const wide = fitImageZoom(VIEWPORT, { width: 4000, height: 3200 })
    expect(wide.scale).toBe(0.25)
    expect(zoomImageToScale(wide, 0.01, CENTRE).scale).toBe(0.25)
  })
})

describe('continuous zoom', () => {
  it('keeps the point under the cursor under the cursor', () => {
    const state = opened()
    const before = imagePointUnder(state, OFF_CENTRE)
    const zoomed = zoomImageByWheel(
      state,
      { deltaX: 0, deltaY: -10, deltaMode: 0 },
      OFF_CENTRE,
    )
    expect(zoomed.scale).toBeGreaterThan(state.scale)
    const after = imagePointUnder(zoomed, OFF_CENTRE)
    expect(after.x).toBeCloseTo(before.x, 9)
    expect(after.y).toBeCloseTo(before.y, 9)
  })

  it('reads a push away as zoom out and a pull toward as zoom in', () => {
    const state = zoomImageToScale(opened(), 1.5, CENTRE)
    expect(
      zoomImageByWheel(state, { deltaX: 0, deltaY: -10, deltaMode: 0 }, CENTRE)
        .scale,
    ).toBeGreaterThan(1.5)
    expect(
      zoomImageByWheel(state, { deltaX: 0, deltaY: 10, deltaMode: 0 }, CENTRE)
        .scale,
    ).toBeLessThan(1.5)
  })

  it('normalises the wheel unit rather than trusting the raw delta', () => {
    // Three lines on Firefox move the zoom far more than three pixels do;
    // this is the shared normaliser doing its job, not this module's maths.
    const state = opened()
    const pixels = zoomImageByWheel(
      state,
      { deltaX: 0, deltaY: -3, deltaMode: 0 },
      CENTRE,
    )
    const lines = zoomImageByWheel(
      state,
      { deltaX: 0, deltaY: -3, deltaMode: 1 },
      CENTRE,
    )
    expect(lines.scale).toBeGreaterThan(pixels.scale)
  })

  it('pinches by the ratio between two cumulative gesture scales', () => {
    const state = opened()
    expect(zoomImageByGesture(state, 1, 1.5, OFF_CENTRE)).toEqual(
      zoomImageByFactor(state, 1.5, OFF_CENTRE),
    )
    // A gesture that repeats its scale asks for nothing.
    expect(zoomImageByGesture(state, 1.5, 1.5, OFF_CENTRE)).toEqual(state)
  })
})

describe('clickZoomImage', () => {
  it('doubles the scale about the point clicked', () => {
    const state = opened()
    const before = imagePointUnder(state, OFF_CENTRE)
    const clicked = clickZoomImage(state, OFF_CENTRE)
    expect(clicked.scale).toBe(1)
    const after = imagePointUnder(clicked, OFF_CENTRE)
    expect(after.x).toBeCloseTo(before.x, 9)
    expect(after.y).toBeCloseTo(before.y, 9)
  })

  it('stops at the ceiling instead of overshooting it', () => {
    const nearly = zoomImageToScale(opened(), 2, CENTRE)
    expect(clickZoomImage(nearly, CENTRE).scale).toBe(3)
  })

  it('returns to fit from the ceiling, so no click is a dead end', () => {
    const ceiling = zoomImageToScale(opened(), 3, OFF_CENTRE)
    expect(clickZoomImage(ceiling, OFF_CENTRE)).toEqual(opened())
  })
})

describe('toggleImageZoom', () => {
  it('goes from fit to natural size', () => {
    expect(toggleImageZoom(opened(), CENTRE).scale).toBe(1)
  })

  it('goes from natural size back to fit', () => {
    const natural = toggleImageZoom(opened(), OFF_CENTRE)
    expect(toggleImageZoom(natural, OFF_CENTRE)).toEqual(opened())
  })

  it('lands on natural size from anywhere in between', () => {
    const between = zoomImageToScale(opened(), 2.4, CENTRE)
    expect(toggleImageZoom(between, CENTRE).scale).toBe(1)
  })

  // 880px of authored artwork in a 1200px box fits at 1.36, so natural
  // size — scale 1 — is under the floor and cannot be reached. That is every
  // cover figure on every desktop, and a fixture that fits at 0.5 never
  // meets it.
  const WIDE_VIEWPORT = { width: 1200, height: 900 }
  const COVER = { width: 880, height: 660 }
  const WIDE_CENTRE = { x: 600, y: 450 }

  /** How far past fit the toggle goes, as a multiple of fit. */
  const stopAsMultipleOfFit = (viewport: ImageSize) => {
    const fit = fitImageZoom(viewport, COVER)
    const centre = { x: viewport.width / 2, y: viewport.height / 2 }
    return toggleImageZoom(fit, centre).scale / fit.scale
  }

  it('still moves when the fit floor has swallowed natural size', () => {
    const fit = fitImageZoom(WIDE_VIEWPORT, COVER)
    expect(fit.scale).toBeGreaterThan(1)
    expect(toggleImageZoom(fit, WIDE_CENTRE).scale).toBeGreaterThan(fit.scale)
  })

  it('comes back to fit from the stop it moved to', () => {
    const fit = fitImageZoom(WIDE_VIEWPORT, COVER)
    const closer = toggleImageZoom(fit, WIDE_CENTRE)
    expect(toggleImageZoom(closer, WIDE_CENTRE)).toEqual(fit)
  })

  it('steps the same multiple of fit whatever the viewport', () => {
    // The stop is stated relative to fit rather than as an absolute scale,
    // so a narrower screen gets the same gesture rather than a different one.
    const narrow = stopAsMultipleOfFit({ width: 1000, height: 750 })
    expect(narrow).toBeGreaterThan(1)
    expect(narrow).toBeCloseTo(stopAsMultipleOfFit(WIDE_VIEWPORT), 9)
  })

  it('never offers a stop below fit', () => {
    const fit = fitImageZoom(WIDE_VIEWPORT, COVER)
    const above = zoomImageToScale(fit, 2.9, WIDE_CENTRE)
    for (const from of [fit, above]) {
      expect(toggleImageZoom(from, WIDE_CENTRE).scale).toBeGreaterThanOrEqual(
        fit.scale,
      )
    }
  })
})

describe('isImageClick', () => {
  it('forgives a shaky press', () => {
    expect(isImageClick({ x: 100, y: 100 }, { x: 100, y: 100 })).toBe(true)
    expect(isImageClick({ x: 100, y: 100 }, { x: 102, y: 102 })).toBe(true)
    expect(
      isImageClick(
        { x: 100, y: 100 },
        { x: 100 + IMAGE_CLICK_DRAG_THRESHOLD_PX, y: 100 },
      ),
    ).toBe(true)
  })

  it('calls anything further a drag', () => {
    expect(isImageClick({ x: 100, y: 100 }, { x: 105, y: 100 })).toBe(false)
    expect(isImageClick({ x: 100, y: 100 }, { x: 103, y: 104 })).toBe(false)
  })
})

describe('panImageBy', () => {
  it('does nothing at fit, where there is nothing off screen to reach', () => {
    expect(panImageBy(opened(), { x: -200, y: -150 })).toEqual(opened())
  })

  it('follows the pointer once past fit', () => {
    const state = zoomImageToScale(opened(), 1, CENTRE)
    expect(panImageBy(state, { x: -120, y: -90 }).offset).toEqual({
      x: -120,
      y: -90,
    })
  })

  it('never drags an edge inside the viewport', () => {
    const state = zoomImageToScale(opened(), 1, CENTRE)
    // 2000x1600 at natural size in a 1000x800 viewport: 500px of slack each
    // way horizontally, 400 vertically.
    const dragged = panImageBy(state, { x: -9000, y: 9000 })
    expect(dragged.offset).toEqual({ x: -500, y: 400 })
    const left = dragged.offset.x - (state.natural.width * state.scale) / 2
    expect(left + state.natural.width * state.scale).toBe(
      VIEWPORT.width / 2,
    )
  })

  it('has pan room only past fit', () => {
    expect(canPanImage(opened())).toBe(false)
    expect(canPanImage(zoomImageToScale(opened(), 1, CENTRE))).toBe(true)
  })

  it('recentres an axis the image no longer fills', () => {
    const wide = fitImageZoom(VIEWPORT, { width: 4000, height: 800 })
    const state = zoomImageToScale(wide, 0.5, CENTRE)
    const dragged = panImageBy(state, { x: -400, y: -300 })
    expect(dragged.offset).toEqual({ x: -400, y: 0 })
  })
})

describe('resolveImageZoomCursor', () => {
  it('offers a zoom in at fit', () => {
    expect(resolveImageZoomCursor(opened())).toBe('zoom-in')
  })

  it('offers a grab once panning is possible', () => {
    expect(resolveImageZoomCursor(zoomImageToScale(opened(), 1, CENTRE))).toBe(
      'grab',
    )
  })

  it('grabs while a drag is in progress', () => {
    expect(
      resolveImageZoomCursor(zoomImageToScale(opened(), 1, CENTRE), {
        dragging: true,
      }),
    ).toBe('grabbing')
  })

  it('offers a zoom out at the ceiling, where a click returns to fit', () => {
    expect(resolveImageZoomCursor(zoomImageToScale(opened(), 3, CENTRE))).toBe(
      'zoom-out',
    )
  })
})

describe('degenerate sizes', () => {
  it('survives a viewport or an image that has not been measured yet', () => {
    const unmeasured = fitImageZoom({ width: 0, height: 0 }, NATURAL)
    expect(unmeasured.scale).toBe(1)
    expect(unmeasured.offset).toEqual({ x: 0, y: 0 })
    expect(panImageBy(unmeasured, { x: 40, y: 40 }).offset).toEqual({
      x: 0,
      y: 0,
    })
    expect(zoomImageByFactor(unmeasured, Number.NaN, CENTRE)).toEqual(
      unmeasured,
    )
  })
})
