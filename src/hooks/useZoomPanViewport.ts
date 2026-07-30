import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { isCanvasResizeRefitSuppressed } from '@/lib/canvasChromeResize'
import {
  BLUEPRINT_VIEWPORT_ARTBOARD_MARGIN,
  BLUEPRINT_VIEWPORT_FIT_TOP_INSET,
} from '@/lib/slideLayout'

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 4

export const BLUEPRINT_ARTBOARD_SELECTOR = '[data-blueprint-artboard]'
/** Root wrapper for fit-to-view / centering across overview and detail canvases. */
export const CANVAS_FIT_SELECTOR = '[data-canvas-fit]'

export function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

type UseZoomPanViewportOptions = {
  /** When this value changes, the viewport recenters and fits content. */
  resetKey?: string
  /** Ignore pan start on these selectors (e.g. interactive controls). */
  panIgnoreSelector?: string
  /** When false, left-drag never starts a pan (e.g. while drawing). */
  panEnabled?: boolean
  /** Element used to compute fit-to-view bounds. */
  fitSelector?: string
  /** Cap for programmatic fit zoom (overview stays ≤1; focus can zoom in). */
  maxFitZoom?: number
  /** Uniform margin around the fit target (px). */
  fitMargin?: number
  /** Extra top inset on top of fitMargin (px). */
  fitTopInset?: number
  /** Extra bottom inset on top of fitMargin (px). */
  fitBottomInset?: number
  /** Animate camera moves when resetKey / fitSelector change. */
  animateFit?: boolean
  /** Duration for animated camera moves (ms). */
  fitDurationMs?: number
  /** Re-center whenever the content box resizes (e.g. async blueprint panels). */
  refitOnResize?: boolean
  /** Debounce for refitOnResize (ms). */
  refitDebounceMs?: number
  /** Never react to container/content resizes (viewport owns its own framing). */
  suppressResizeRefit?: boolean
}

function applyTransformToElement(
  el: HTMLElement,
  pan: { x: number; y: number },
  zoom: number,
) {
  el.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`
}

function measureFitBounds(
  content: HTMLElement,
  fitTarget: HTMLElement,
  zoom: number,
): { left: number; top: number; width: number; height: number } {
  if (fitTarget === content) {
    return {
      left: 0,
      top: 0,
      width: content.scrollWidth,
      height: content.scrollHeight,
    }
  }

  const contentRect = content.getBoundingClientRect()
  const targetRect = fitTarget.getBoundingClientRect()
  const safeZoom = zoom || 1

  return {
    left: (targetRect.left - contentRect.left) / safeZoom,
    top: (targetRect.top - contentRect.top) / safeZoom,
    width: targetRect.width / safeZoom,
    height: targetRect.height / safeZoom,
  }
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Read live rather than at mount: the OS setting can change mid-session and
 * every fit should honor the current value.
 */
function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Sub-pixel camera deltas aren't worth a React commit. */
function isSameTransform(
  a: { pan: { x: number; y: number }; zoom: number },
  b: { pan: { x: number; y: number }; zoom: number },
) {
  return (
    Math.abs(a.pan.x - b.pan.x) < 0.5 &&
    Math.abs(a.pan.y - b.pan.y) < 0.5 &&
    Math.abs(a.zoom - b.zoom) < 0.0001
  )
}

export function useZoomPanViewport(options: UseZoomPanViewportOptions = {}) {
  const {
    resetKey,
    panIgnoreSelector = 'button, a, input, textarea, select, [role="button"]',
    panEnabled = true,
    fitSelector = CANVAS_FIT_SELECTOR,
    maxFitZoom = 1,
    fitMargin = BLUEPRINT_VIEWPORT_ARTBOARD_MARGIN,
    fitTopInset = BLUEPRINT_VIEWPORT_FIT_TOP_INSET,
    fitBottomInset = 0,
    animateFit = false,
    fitDurationMs = 420,
    refitOnResize = true,
    refitDebounceMs = 200,
    suppressResizeRefit = false,
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const transformRef = useRef({ pan: { x: 0, y: 0 }, zoom: 1 })
  const pendingFitRef = useRef(false)
  const userAdjustedViewRef = useRef(false)
  const fitAnimationRef = useRef<number | null>(null)
  /**
   * False until this viewport instance has framed content once. The first
   * fit jumps: animating it would swoop in from the unfitted origin
   * (pan 0,0 / zoom 1) that every fresh mount starts at.
   */
  const hasFittedRef = useRef(false)
  /**
   * Latest `animateFit`, kept in a ref so `fitToView` stays identity-stable
   * across renders — otherwise flipping the prop would re-run the fit
   * effect and fire a second camera move. Synced by an effect declared
   * above the fit effect, so it is current by the time that effect reads it.
   */
  const animateFitRef = useRef(animateFit)

  useEffect(() => {
    animateFitRef.current = animateFit
  }, [animateFit])

  const cancelFitAnimation = useCallback(() => {
    if (fitAnimationRef.current !== null) {
      cancelAnimationFrame(fitAnimationRef.current)
      fitAnimationRef.current = null
    }
  }, [])

  const commitTransform = useCallback(
    (
      nextPan: { x: number; y: number },
      nextZoom: number,
      syncReact = false,
    ) => {
      transformRef.current = { pan: nextPan, zoom: nextZoom }
      const el = contentRef.current
      if (el) {
        applyTransformToElement(el, nextPan, nextZoom)
      }
      if (syncReact) {
        setPan(nextPan)
        setZoom(nextZoom)
      }
    },
    [],
  )

  const animateTransform = useCallback(
    (nextPan: { x: number; y: number }, nextZoom: number) => {
      cancelFitAnimation()
      const from = transformRef.current
      const start = performance.now()

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / fitDurationMs)
        const e = easeInOutCubic(t)
        commitTransform(
          {
            x: from.pan.x + (nextPan.x - from.pan.x) * e,
            y: from.pan.y + (nextPan.y - from.pan.y) * e,
          },
          from.zoom + (nextZoom - from.zoom) * e,
          t === 1,
        )
        if (t < 1) {
          fitAnimationRef.current = requestAnimationFrame(step)
          return
        }
        fitAnimationRef.current = null
      }

      fitAnimationRef.current = requestAnimationFrame(step)
    },
    [cancelFitAnimation, commitTransform, fitDurationMs],
  )

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, scaleFactor: number, syncReact = true) => {
      const el = containerRef.current
      if (!el) return

      cancelFitAnimation()
      userAdjustedViewRef.current = true

      const rect = el.getBoundingClientRect()
      const mx = clientX - rect.left
      const my = clientY - rect.top
      const { pan: p, zoom: z } = transformRef.current
      const newZoom = clampZoom(z * scaleFactor)
      const worldX = (mx - p.x) / z
      const worldY = (my - p.y) / z
      const nextPan = {
        x: mx - worldX * newZoom,
        y: my - worldY * newZoom,
      }

      commitTransform(nextPan, newZoom, syncReact)
    },
    [cancelFitAnimation, commitTransform],
  )

  /**
   * Camera transform that frames the fit target, or null when the geometry
   * isn't measurable yet (viewport unmounted, content not laid out).
   * `forcedZoom` keeps an existing zoom and solves for pan only.
   */
  const computeFitTransform = useCallback(
    (forcedZoom?: number) => {
      const el = containerRef.current
      const content = contentRef.current
      if (!el || !content) return null

      const margin = fitMargin
      const fitTarget =
        content.querySelector<HTMLElement>(fitSelector) ?? content
      const { zoom: currentZoom } = transformRef.current
      const bounds = measureFitBounds(content, fitTarget, currentZoom)

      const insets = {
        top: margin + fitTopInset,
        right: margin,
        bottom: margin + fitBottomInset,
        left: margin,
      }
      const fitWidth = Math.max(el.clientWidth - insets.left - insets.right, 1)
      const fitHeight = Math.max(el.clientHeight - insets.top - insets.bottom, 1)
      if (bounds.width <= 0 || bounds.height <= 0) return null

      const nextZoom =
        forcedZoom ??
        clampZoom(
          Math.min(fitWidth / bounds.width, fitHeight / bounds.height, maxFitZoom),
        )

      const targetCenterX = bounds.left + bounds.width / 2
      const targetCenterY = bounds.top + bounds.height / 2
      const viewportCenterX = insets.left + fitWidth / 2
      const viewportCenterY = insets.top + fitHeight / 2

      return {
        pan: {
          x: viewportCenterX - targetCenterX * nextZoom,
          y: viewportCenterY - targetCenterY * nextZoom,
        },
        zoom: nextZoom,
      }
    },
    [fitBottomInset, fitMargin, fitSelector, fitTopInset, maxFitZoom],
  )

  /** Frames the fit target. Returns false when geometry wasn't measurable. */
  const fitToView = useCallback(
    (options?: { animate?: boolean }) => {
      const next = computeFitTransform()
      if (!next) return false

      const shouldAnimate =
        (options?.animate ?? animateFitRef.current) && !prefersReducedMotion()
      if (shouldAnimate) {
        animateTransform(next.pan, next.zoom)
      } else {
        commitTransform(next.pan, next.zoom, true)
      }
      return true
    },
    [animateTransform, commitTransform, computeFitTransform],
  )

  /**
   * Re-centers the fit target at the current zoom. Resizes use this instead
   * of a fit so a window drag never throws away the zoom the user chose.
   */
  const recenterToView = useCallback(() => {
    const current = transformRef.current
    const next = computeFitTransform(current.zoom)
    if (!next || isSameTransform(current, next)) return
    commitTransform(next.pan, next.zoom, true)
  }, [commitTransform, computeFitTransform])

  /**
   * Runs the fit scheduled by the last `resetKey` change, at most once.
   * Clearing `pendingFitRef` here is what demotes the 150 ms timeout to a
   * true backstop — without it the timeout fires on top of the rAF fit and
   * restarts the ease from its own midpoint.
   */
  const runPendingFit = useCallback(
    (animate: boolean) => {
      if (!pendingFitRef.current) return
      const didFit = fitToView({ animate: hasFittedRef.current && animate })
      // Geometry wasn't ready — leave the fit pending for the backstop.
      if (!didFit) return
      pendingFitRef.current = false
      hasFittedRef.current = true
    },
    [fitToView],
  )

  const resetView = useCallback(() => {
    cancelFitAnimation()
    userAdjustedViewRef.current = false
    commitTransform({ x: 0, y: 0 }, 1, true)
  }, [cancelFitAnimation, commitTransform])

  useLayoutEffect(() => {
    const { pan: p, zoom: z } = transformRef.current
    commitTransform(p, z, false)
  }, [commitTransform])

  useEffect(() => {
    if (resetKey === undefined) return
    pendingFitRef.current = true
    userAdjustedViewRef.current = false

    // Captured now, not read at fit time: a one-shot skip flag may be
    // cleared between scheduling this fit and the frame it runs on.
    const animate = animateFitRef.current
    let frame1 = 0
    let frame2 = 0
    const runFit = () => runPendingFit(animate)

    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(runFit)
    })

    // Backstop for content that hasn't laid out within two frames.
    const timeout = window.setTimeout(runFit, 150)

    return () => {
      cancelAnimationFrame(frame1)
      cancelAnimationFrame(frame2)
      window.clearTimeout(timeout)
    }
  }, [resetKey, fitSelector, runPendingFit])

  useEffect(() => {
    return () => cancelFitAnimation()
  }, [cancelFitAnimation])

  useEffect(() => {
    const content = contentRef.current
    const container = containerRef.current
    if (!content) return

    let debounceTimer = 0

    const onResize = () => {
      if (userAdjustedViewRef.current) return

      if (refitOnResize) {
        // Checked as the resize is observed, not when the debounce fires:
        // the chrome window closes before a 200 ms debounce would elapse.
        if (suppressResizeRefit || isCanvasResizeRefitSuppressed()) return
        window.clearTimeout(debounceTimer)
        // Re-center only. A resize is not a navigation, so it must not
        // discard the zoom level the viewport is currently at.
        debounceTimer = window.setTimeout(recenterToView, refitDebounceMs)
        return
      }
      // Not a refit: the fit scheduled by the last resetKey is still
      // waiting on content that has only now laid out.
      runPendingFit(false)
    }

    const observer = new ResizeObserver(onResize)

    observer.observe(content)
    if (container) observer.observe(container)

    return () => {
      window.clearTimeout(debounceTimer)
      observer.disconnect()
    }
  }, [
    recenterToView,
    resetKey,
    refitOnResize,
    refitDebounceMs,
    runPendingFit,
    suppressResizeRefit,
  ])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const scaleFactor = Math.exp(-e.deltaY * 0.01)
        zoomAtPoint(e.clientX, e.clientY, scaleFactor, true)
        return
      }

      if (e.deltaX !== 0 || e.deltaY !== 0) {
        e.preventDefault()
        cancelFitAnimation()
        userAdjustedViewRef.current = true
        const { pan: p, zoom: z } = transformRef.current
        commitTransform(
          {
            x: p.x - e.deltaX,
            y: p.y - e.deltaY,
          },
          z,
          false,
        )
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [cancelFitAnimation, commitTransform, zoomAtPoint])

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!panEnabled) return
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (panIgnoreSelector && target.closest(panIgnoreSelector)) return

      cancelFitAnimation()
      userAdjustedViewRef.current = true
      containerRef.current?.setPointerCapture(e.pointerId)
      setIsPanning(true)
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: transformRef.current.pan.x,
        panY: transformRef.current.pan.y,
      }
    },
    [cancelFitAnimation, panEnabled, panIgnoreSelector],
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isPanning) return
      commitTransform(
        {
          x: panStart.current.panX + (e.clientX - panStart.current.x),
          y: panStart.current.panY + (e.clientY - panStart.current.y),
        },
        transformRef.current.zoom,
        false,
      )
    },
    [commitTransform, isPanning],
  )

  const handlePointerUp = useCallback((e: PointerEvent) => {
    setIsPanning(false)
    containerRef.current?.releasePointerCapture(e.pointerId)
  }, [])

  useEffect(() => {
    if (panEnabled) return
    setIsPanning(false)
  }, [panEnabled])

  const zoomIn = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.2)
  }, [zoomAtPoint])

  const zoomOut = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.2)
  }, [zoomAtPoint])

  return {
    containerRef,
    contentRef,
    pan,
    zoom,
    isPanning,
    fitToView,
    resetView,
    zoomIn,
    zoomOut,
    pointerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerUp,
    },
  }
}
