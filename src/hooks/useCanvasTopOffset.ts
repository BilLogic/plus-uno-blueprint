import { useEffect } from 'react'
import {
  CANVAS_REGION_SELECTOR,
  CELL_DETAIL_PANEL_TOP_GAP_PX,
  CELL_DETAIL_PANEL_TOP_VAR,
} from '@/components/editor/menubarHeaderLayout'

/**
 * Publishes the canvas region's top edge so the portalled drawer can sit
 * below whatever chrome that surface stacks above it — the base view's navbar
 * alone, or a slice tab's header band on top of it. Re-measured on resize and
 * whenever the panel opens; the surface's own transitions (sidebar wipe, tab
 * strip) do not move the canvas top, so no observer is needed.
 */
export function useCanvasTopOffset(active: boolean) {
  useEffect(() => {
    if (!active) return

    const measure = () => {
      const canvas = document.querySelector(CANVAS_REGION_SELECTOR)
      const top = canvas?.getBoundingClientRect().top ?? 0
      document.documentElement.style.setProperty(
        CELL_DETAIL_PANEL_TOP_VAR,
        `${Math.max(0, top) + CELL_DETAIL_PANEL_TOP_GAP_PX}px`,
      )
    }

    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      document.documentElement.style.removeProperty(CELL_DETAIL_PANEL_TOP_VAR)
    }
  }, [active])
}
