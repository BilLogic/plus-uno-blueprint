import type { ReactNode } from 'react'
import { useZoomPanViewport } from '@/hooks/useZoomPanViewport'
import { CanvasAnnotationLayer } from '@/components/editor/CanvasAnnotationLayer'
import { CanvasAnnotationToolbar } from '@/components/editor/CanvasAnnotationToolbar'
import { CanvasModeProvider } from '@/components/editor/CanvasModeProvider'
import { CanvasSelectionProvider } from '@/components/editor/CanvasSelectionProvider'
import { CanvasPenCursor } from '@/components/editor/CanvasPenCursor'
import { EditorSequenceNav } from '@/components/editor/EditorSequenceNav'
import { CanvasAnnotationProvider } from '@/contexts/CanvasAnnotationProvider'
import { usePublishCanvasZoomChrome } from '@/contexts/CanvasZoomChromeContext'
import { useCanvasAnnotations } from '@/contexts/canvasAnnotationContext'
import { BLUEPRINT_THEME } from '@/lib/blueprintTheme'
import { cn } from '@/lib/utils'

type ZoomPanViewportProps = {
  children: ReactNode
  className?: string
  resetKey?: string
  panIgnoreSelector?: string
  fitSelector?: string
  maxFitZoom?: number
  fitMargin?: number
  fitTopInset?: number
  fitBottomInset?: number
  animateFit?: boolean
  showSequenceNav?: boolean
  refitOnResize?: boolean
  /** Shows a "Reset View" action in the canvas navbar (focus mode). */
  onResetView?: () => void
}

export function ZoomPanViewport(props: ZoomPanViewportProps) {
  return (
    <CanvasAnnotationProvider>
      <ZoomPanViewportInner {...props} />
    </CanvasAnnotationProvider>
  )
}

function ZoomPanViewportInner({
  children,
  className,
  resetKey,
  panIgnoreSelector,
  fitSelector,
  maxFitZoom,
  fitMargin,
  fitTopInset,
  fitBottomInset,
  animateFit = false,
  showSequenceNav = true,
  refitOnResize = true,
  onResetView,
}: ZoomPanViewportProps) {
  const { isAnnotating } = useCanvasAnnotations()
  const {
    containerRef,
    contentRef,
    zoom,
    isPanning,
    pointerHandlers,
  } = useZoomPanViewport({
    resetKey,
    panIgnoreSelector,
    // Draw / place tools own the drag gesture — don't pan the board.
    panEnabled: !isAnnotating,
    fitSelector,
    maxFitZoom,
    fitMargin,
    fitTopInset,
    fitBottomInset,
    animateFit,
    refitOnResize,
  })

  usePublishCanvasZoomChrome(onResetView)

  return (
    // One mode per viewport: the base canvas and each slice tab are separate
    // surfaces, and editing a slice while reading the base blueprint is a
    // normal thing to want. It wraps the whole viewport, not just the
    // toolbar, because the grid reads the mode too.
    <CanvasModeProvider>
    <CanvasSelectionProvider>
    <div
      className={cn('relative min-h-0 flex-1', className)}
      data-zoom-pan-root
      // Cell-corner overlays (slice sequence badges) scale with the canvas;
      // below this zoom they are illegible specks, so CSS hides them.
      data-canvas-zoom-far={zoom < 0.25 ? '' : undefined}
    >
      <div
        ref={containerRef}
        className={cn(
          'absolute inset-0 overflow-hidden touch-none',
          isPanning && 'cursor-grabbing',
        )}
        style={{ backgroundColor: BLUEPRINT_THEME.viewportPad }}
        data-zoom-pan-viewport
        {...pointerHandlers}
      >
        <div
          ref={contentRef}
          className="absolute left-0 top-0 origin-top-left"
          style={{ backfaceVisibility: 'hidden' }}
          data-zoom-pan-content
        >
          <div className="relative inline-block min-h-0 align-top">
            {children}
            <CanvasAnnotationLayer zoom={zoom} />
          </div>
        </div>
        <CanvasPenCursor />
      </div>

      {showSequenceNav ? <EditorSequenceNav /> : null}
      <CanvasAnnotationToolbar />
    </div>
    </CanvasSelectionProvider>
    </CanvasModeProvider>
  )
}
