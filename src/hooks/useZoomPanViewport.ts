import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { BLUEPRINT_VIEWPORT_ARTBOARD_MARGIN } from '@/lib/slideLayout'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

export const BLUEPRINT_ARTBOARD_SELECTOR = '[data-blueprint-artboard]'

function getOffsetWithinAncestor(
  element: HTMLElement,
  ancestor: HTMLElement,
  ancestorZoom: number,
): { left: number; top: number; width: number; height: number } {
  const ancestorRect = ancestor.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const zoom = ancestorZoom > 0 ? ancestorZoom : 1

  return {
    left: (elementRect.left - ancestorRect.left) / zoom,
    top: (elementRect.top - ancestorRect.top) / zoom,
    width: element.offsetWidth,
    height: element.offsetHeight,
  }
}

export function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

type UseZoomPanViewportOptions = {
  /** When this value changes, the viewport recenters and fits content. */
  resetKey?: string
  /** Ignore pan start on these selectors (e.g. interactive controls). */
  panIgnoreSelector?: string
}

export function useZoomPanViewport(options: UseZoomPanViewportOptions = {}) {
  const {
    resetKey,
    panIgnoreSelector = 'button, a, input, textarea, select, [role="button"]',
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const transformRef = useRef({ pan: { x: 0, y: 0 }, zoom: 1 })
  const pendingFitRef = useRef(false)

  transformRef.current = { pan, zoom }

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, scaleFactor: number) => {
      const el = containerRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const mx = clientX - rect.left
      const my = clientY - rect.top
      const { pan: p, zoom: z } = transformRef.current
      const newZoom = clampZoom(z * scaleFactor)
      const worldX = (mx - p.x) / z
      const worldY = (my - p.y) / z

      setZoom(newZoom)
      setPan({
        x: mx - worldX * newZoom,
        y: my - worldY * newZoom,
      })
    },
    [],
  )

  const fitToView = useCallback(() => {
    const el = containerRef.current
    const content = contentRef.current
    if (!el || !content) return

    const margin = BLUEPRINT_VIEWPORT_ARTBOARD_MARGIN
    const artboard = content.querySelector<HTMLElement>(BLUEPRINT_ARTBOARD_SELECTOR)
    const fitTarget = artboard ?? content
    const { zoom: currentZoom } = transformRef.current
    const bounds = getOffsetWithinAncestor(fitTarget, content, currentZoom)

    const cw = Math.max(el.clientWidth - margin * 2, 1)
    const ch = Math.max(el.clientHeight - margin * 2, 1)
    const nextZoom = clampZoom(
      Math.min(cw / bounds.width, ch / bounds.height, 1),
    )

    const targetCenterX = bounds.left + bounds.width / 2
    const targetCenterY = bounds.top + bounds.height / 2

    setZoom(nextZoom)
    setPan({
      x: el.clientWidth / 2 - targetCenterX * nextZoom,
      y: el.clientHeight / 2 - targetCenterY * nextZoom,
    })
  }, [])

  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    if (resetKey === undefined) return
    pendingFitRef.current = true

    let frame1 = 0
    let frame2 = 0
    const runFit = () => {
      if (!pendingFitRef.current) return
      fitToView()
    }

    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(runFit)
    })

    const timeout = window.setTimeout(() => {
      if (!pendingFitRef.current) return
      fitToView()
      pendingFitRef.current = false
    }, 150)

    return () => {
      cancelAnimationFrame(frame1)
      cancelAnimationFrame(frame2)
      window.clearTimeout(timeout)
    }
  }, [resetKey, fitToView])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const observer = new ResizeObserver(() => {
      if (!pendingFitRef.current) return
      fitToView()
      pendingFitRef.current = false
    })

    observer.observe(content)
    return () => observer.disconnect()
  }, [fitToView, resetKey])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const scaleFactor = Math.exp(-e.deltaY * 0.01)
        zoomAtPoint(e.clientX, e.clientY, scaleFactor)
        return
      }

      if (e.deltaX !== 0 || e.deltaY !== 0) {
        e.preventDefault()
        const { pan: p } = transformRef.current
        setPan({
          x: p.x - e.deltaX,
          y: p.y - e.deltaY,
        })
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAtPoint])

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (panIgnoreSelector && target.closest(panIgnoreSelector)) return

      containerRef.current?.setPointerCapture(e.pointerId)
      setIsPanning(true)
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      }
    },
    [pan.x, pan.y, panIgnoreSelector],
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isPanning) return
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      })
    },
    [isPanning],
  )

  const handlePointerUp = useCallback((e: PointerEvent) => {
    setIsPanning(false)
    containerRef.current?.releasePointerCapture(e.pointerId)
  }, [])

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
