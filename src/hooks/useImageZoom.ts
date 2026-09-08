import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  clickZoomImage,
  fitImageZoom,
  isImageClick,
  panImageBy,
  resolveImageZoomCursor,
  toggleImageZoom,
  zoomImageByGesture,
  zoomImageByWheel,
  type ImagePoint,
  type ImageSize,
  type ImageZoomCursor,
  type ImageZoomViewport,
} from '@/lib/imageZoomReducer'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * The DOM half of the image viewer: nodes, events, and the transform.
 *
 * Every decision about scale and offset belongs to `imageZoomReducer` and is
 * only CALLED from here — this file measures two boxes, turns pointer and
 * wheel events into anchors, and writes the result onto an element. That
 * split is the whole reason the reducer is pure: the arithmetic is argued
 * about in a test with no DOM, and what is left here is wiring.
 *
 * Explicitly NOT `useZoomPanViewport`. The board's camera is wired to
 * artboards, focus cells, an annotation layer, agent commands and a
 * semantic-zoom threshold, none of which an image has; sharing it would mean
 * a change to image zoom could regress the board. What IS shared is the
 * arithmetic underneath, through the reducer's own imports.
 *
 * Nodes are held in state rather than in refs. The popup mounts when the
 * dialog opens, so an effect that read a ref once, at a moment the popup did
 * not exist, would attach its wheel listener to nothing and never retry.
 */

/** A box that has not been measured yet — fit of an unmeasured box is 1. */
const UNMEASURED: ImageSize = { width: 0, height: 0 }

/**
 * WebKit's pinch, which no `lib.dom` type describes.
 *
 * Safari alone ships `gesturestart`/`gesturechange`/`gestureend`, and on a
 * macOS trackpad they are the ONLY thing a pinch produces — no touch
 * pointers, no synthesised ctrl+wheel. Unprevented, `gesturestart` zooms the
 * page rather than the picture.
 */
type WebKitGestureEvent = Event & {
  scale?: number
  clientX?: number
  clientY?: number
}

export type UseImageZoomResult = {
  /** The popup, whose whole area — margin included — takes the wheel. */
  popupRef: (node: HTMLElement | null) => void
  /** The box the image is fitted to and clipped by. */
  viewportRef: (node: HTMLElement | null) => void
  imageRef: (node: HTMLImageElement | null) => void
  /** Re-reads both boxes; the image's `load` is the event that needs it. */
  measure: () => void
  /** Which CSS cursor this state implies, straight from the reducer. */
  cursor: ImageZoomCursor
  /**
   * Whether this transform should be tweened. Discrete steps are; continuous
   * gestures are not, because a tween on a gesture the hand is still making
   * reads as lag. Reduced motion drops it in both cases.
   */
  animated: boolean
  imageStyle: CSSProperties
  imageHandlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLImageElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLImageElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLImageElement>) => void
    onPointerCancel: (event: ReactPointerEvent<HTMLImageElement>) => void
    onClick: (event: ReactMouseEvent<HTMLImageElement>) => void
    onDoubleClick: (event: ReactMouseEvent<HTMLImageElement>) => void
  }
}

/** A press in flight: where it started, where it last was, and whether it pans. */
type DragState = {
  pointerId: number
  start: ImagePoint
  last: ImagePoint
  /** Set once the press has travelled past the click threshold. */
  panning: boolean
}

export function useImageZoom({
  naturalWidth,
  naturalHeight,
}: {
  /**
   * The image's authored size, when the caller knows it.
   *
   * `naturalWidth` is not trustworthy for the asset class this viewer was
   * built for. An SVG authored with a `viewBox` and no root `width`/`height`
   * has no intrinsic size, and the browser answers with its default box —
   * Chrome reports 300 wide for an 880px diagram — which the reducer then
   * correctly fits and correctly pins at the ceiling, to a picture three
   * times too small. Where an adopter carries the authored numbers, they are
   * the truth and `naturalWidth` is a guess; where it does not, a raster
   * screenshot reports its own size honestly and the guess is the truth.
   */
  naturalWidth?: number
  naturalHeight?: number
} = {}): UseImageZoomResult {
  const [popupNode, setPopupNode] = useState<HTMLElement | null>(null)
  const [viewportNode, setViewportNode] = useState<HTMLElement | null>(null)
  const [imageNode, setImageNode] = useState<HTMLImageElement | null>(null)

  const [state, setState] = useState<ImageZoomViewport>(() =>
    fitImageZoom(UNMEASURED, UNMEASURED),
  )
  const [dragging, setDragging] = useState(false)
  const [animated, setAnimated] = useState(false)

  /**
   * The state, readable synchronously.
   *
   * A wheel arrives as dozens of events inside one React commit and a drag as
   * one per frame; reading `state` from a handler's closure would compound
   * every one of them onto the same stale scale. The ref is the value each
   * gesture builds on, and `setState` exists to render it.
   */
  const stateRef = useRef(state)
  const dragRef = useRef<DragState | null>(null)
  /** Set on release when the press panned: the click that follows is not one. */
  const draggedRef = useRef(false)
  /**
   * The state as it stood before the single click that may turn out to be
   * the first half of a double click. See `onDoubleClick`.
   */
  const beforeClickRef = useRef<ImageZoomViewport | null>(null)

  const apply = useCallback(
    (next: (current: ImageZoomViewport) => ImageZoomViewport, tween: boolean) => {
      const result = next(stateRef.current)
      if (result === stateRef.current) return
      stateRef.current = result
      setAnimated(tween && !prefersReducedMotion())
      setState(result)
    },
    [],
  )

  /**
   * Both boxes, re-read.
   *
   * `clientWidth`/`clientHeight` rather than `getBoundingClientRect`: the
   * popup carries an entrance transform, and a rect is scaled by it while a
   * layout size is not. Measuring during the entrance would otherwise fit the
   * image to 95% of the viewport and never correct itself, since a transform
   * fires no resize.
   *
   * A measurement always returns to fit. A viewport that changed size has a
   * different fit scale and a different pan limit, and re-deriving both from
   * the new box is more honest than carrying a scale that was chosen for the
   * old one. It is also what resets the viewer between openings: on close the
   * nodes go, the boxes measure zero, and the next opening starts at fit.
   */
  const measure = useCallback(() => {
    const viewport: ImageSize = viewportNode
      ? { width: viewportNode.clientWidth, height: viewportNode.clientHeight }
      : UNMEASURED
    const authored =
      naturalWidth && naturalHeight
        ? { width: naturalWidth, height: naturalHeight }
        : null
    const measured = imageNode
      ? { width: imageNode.naturalWidth, height: imageNode.naturalHeight }
      : UNMEASURED
    // Only while the popup is mounted: on close the nodes go, and an
    // authored size that outlived them would keep the viewer measured.
    const natural: ImageSize = imageNode ? (authored ?? measured) : UNMEASURED
    const current = stateRef.current
    if (
      current.viewport.width === viewport.width &&
      current.viewport.height === viewport.height &&
      current.natural.width === natural.width &&
      current.natural.height === natural.height
    ) {
      return
    }
    beforeClickRef.current = null
    stateRef.current = fitImageZoom(viewport, natural)
    setAnimated(false)
    setState(stateRef.current)
  }, [imageNode, naturalHeight, naturalWidth, viewportNode])

  /**
   * Measured in a layout effect so the first painted frame is already fitted,
   * and re-measured on `load` for an image whose pixels arrive later. A
   * cached image is already `complete` by the time the ref lands, which is
   * why this cannot be left to `load` alone.
   */
  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    if (!viewportNode) return
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    // jsdom ships no ResizeObserver, and the window resize above is the
    // coarse half of the same job — so its absence degrades rather than throws.
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null
    observer?.observe(viewportNode)
    return () => {
      window.removeEventListener('resize', onResize)
      observer?.disconnect()
    }
  }, [measure, viewportNode])

  /** A client point as the reducer wants it: CSS pixels from the box's corner. */
  const anchorAt = useCallback(
    (clientX: number, clientY: number): ImagePoint => {
      const box = viewportNode?.getBoundingClientRect()
      if (!box) return { x: clientX, y: clientY }
      return { x: clientX - box.left, y: clientY - box.top }
    },
    [viewportNode],
  )

  /**
   * The wheel, bound to the POPUP rather than to the image.
   *
   * A reader whose pointer has drifted into the empty margin is still inside
   * the viewer, and a gesture that dies over part of the surface reads as
   * broken. `{ passive: false }` is what makes `preventDefault` legal, and
   * preventing it is what stops the page behind scrolling under the popup.
   */
  useEffect(() => {
    if (!popupNode) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      beforeClickRef.current = null
      const anchor = anchorAt(event.clientX, event.clientY)
      apply((current) => zoomImageByWheel(current, event, anchor), false)
    }
    popupNode.addEventListener('wheel', onWheel, { passive: false })
    return () => popupNode.removeEventListener('wheel', onWheel)
  }, [anchorAt, apply, popupNode])

  /**
   * Safari's pinch — prevented on the page, applied to the picture.
   *
   * The canvas gates this on its touch-pointer count, because on iOS its own
   * pointer map pinches too and scale would land twice. This viewer has no
   * second pinch mechanism to collide with, so there is nothing to gate: the
   * gesture is always ours.
   *
   * Bound on the window in capture and filtered by containment, as the canvas
   * binds it — `gesture*` reach the window whatever they are dispatched on.
   */
  useEffect(() => {
    if (!popupNode) return
    let previousScale = 1
    const inPopup = (event: Event) =>
      event.target instanceof Node && popupNode.contains(event.target)
    const onGestureStart = (event: Event) => {
      if (!inPopup(event)) return
      event.preventDefault()
      previousScale = 1
    }
    const onGestureChange = (event: Event) => {
      if (!inPopup(event)) return
      event.preventDefault()
      const gesture = event as WebKitGestureEvent
      const nextScale = gesture.scale ?? previousScale
      const box = popupNode.getBoundingClientRect()
      const anchor = anchorAt(
        gesture.clientX ?? box.left + box.width / 2,
        gesture.clientY ?? box.top + box.height / 2,
      )
      const from = previousScale
      if (Number.isFinite(gesture.scale)) previousScale = nextScale
      beforeClickRef.current = null
      apply(
        (current) => zoomImageByGesture(current, from, nextScale, anchor),
        false,
      )
    }
    const onGestureEnd = (event: Event) => {
      if (!inPopup(event)) return
      event.preventDefault()
      previousScale = 1
    }
    const options = { passive: false, capture: true } as const
    window.addEventListener('gesturestart', onGestureStart, options)
    window.addEventListener('gesturechange', onGestureChange, options)
    window.addEventListener('gestureend', onGestureEnd, options)
    return () => {
      window.removeEventListener('gesturestart', onGestureStart, {
        capture: true,
      })
      window.removeEventListener('gesturechange', onGestureChange, {
        capture: true,
      })
      window.removeEventListener('gestureend', onGestureEnd, { capture: true })
    }
  }, [anchorAt, apply, popupNode])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLImageElement>) => {
      if (event.button !== 0) return
      const point = { x: event.clientX, y: event.clientY }
      dragRef.current = {
        pointerId: event.pointerId,
        start: point,
        last: point,
        panning: false,
      }
      draggedRef.current = false
      // The pointer leaves a zoomed image long before the drag ends.
      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    [],
  )

  /**
   * Pan, but not before the press has proved it is a drag.
   *
   * `isImageClick` holds the press still inside the threshold, so the shaky
   * three-pixel press that the reducer promises still counts as a click also
   * moves the image not at all. The first pan once the threshold breaks
   * carries the whole travel since the press, because `last` is still where
   * the press went down.
   */
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLImageElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const point = { x: event.clientX, y: event.clientY }
      if (!drag.panning) {
        if (isImageClick(drag.start, point)) return
        drag.panning = true
        setDragging(true)
      }
      const delta = { x: point.x - drag.last.x, y: point.y - drag.last.y }
      drag.last = point
      beforeClickRef.current = null
      apply((current) => panImageBy(current, delta), false)
    },
    [apply],
  )

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLImageElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      dragRef.current = null
      draggedRef.current = drag.panning
      setDragging(false)
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    },
    [],
  )

  /**
   * A click on the image: one step in, or back to fit from the ceiling.
   *
   * The second click of a double click is stepped over rather than applied —
   * `detail` is 2 there, and `onDoubleClick` is about to speak for it. The
   * FIRST click is not stepped over, because nothing yet says a second is
   * coming; a timer would be the only way to know, and this viewer refuses
   * timers for the same reason the reducer does.
   */
  const onClick = useCallback(
    (event: ReactMouseEvent<HTMLImageElement>) => {
      if (draggedRef.current) {
        draggedRef.current = false
        return
      }
      if (event.detail >= 2) return
      const anchor = anchorAt(event.clientX, event.clientY)
      beforeClickRef.current = stateRef.current
      apply((current) => clickZoomImage(current, anchor), true)
    },
    [anchorAt, apply],
  )

  /**
   * A double click toggles fit and natural size — from where the reader was
   * BEFORE the single click that came with it.
   *
   * Without that snapshot the toggle is not one: the first click has already
   * moved off fit, so every double click reads as "not at natural yet" and
   * the way back to fit never fires. Taking the state the press started from
   * makes the double click mean what it says, at the cost of one step being
   * visible on the way.
   */
  const onDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLImageElement>) => {
      if (draggedRef.current) {
        draggedRef.current = false
        return
      }
      const anchor = anchorAt(event.clientX, event.clientY)
      const base = beforeClickRef.current ?? stateRef.current
      beforeClickRef.current = null
      apply(() => toggleImageZoom(base, anchor), true)
    },
    [anchorAt, apply],
  )

  const imageStyle = useMemo<CSSProperties>(() => {
    const { natural, scale, offset } = state
    return {
      width: natural.width || undefined,
      height: natural.height || undefined,
      /*
        Read right to left. `translate(-50%, -50%)` puts the image's own
        centre on the origin, `scale` grows it about that centre, and the
        pixel translate is the offset the reducer holds — the centre's
        displacement from the viewport centre, which is what the element's
        `top: 50%; left: 50%` has already put the origin at. Ordered any
        other way the half-size shift would be taken at the wrong scale.
      */
      transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) translate(-50%, -50%)`,
    }
  }, [state])

  return {
    popupRef: setPopupNode,
    viewportRef: setViewportNode,
    imageRef: setImageNode,
    measure,
    cursor: resolveImageZoomCursor(state, { dragging }),
    animated,
    imageStyle,
    imageHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClick,
      onDoubleClick,
    },
  }
}
