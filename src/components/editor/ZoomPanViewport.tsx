import type { ReactNode } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { useZoomPanViewport } from '@/hooks/useZoomPanViewport'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ZoomPanViewportProps = {
  children: ReactNode
  className?: string
  resetKey?: string
  hint?: string
}

export function ZoomPanViewport({
  children,
  className,
  resetKey,
  hint = '⌘ scroll to zoom · Scroll to pan · Drag to move',
}: ZoomPanViewportProps) {
  const {
    containerRef,
    contentRef,
    pan,
    zoom,
    isPanning,
    fitToView,
    resetView,
    zoomIn,
    zoomOut,
    pointerHandlers,
  } = useZoomPanViewport({ resetKey })

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-h-0 flex-1 overflow-hidden touch-none bg-[#e8e8e8] dark:bg-[#1a1a1a]',
        isPanning ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
      {...pointerHandlers}
    >
      <div
        ref={contentRef}
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {children}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 max-w-lg rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
        {hint}
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-background/80 p-1 backdrop-blur-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={zoomOut}
          aria-label="Zoom out"
        >
          <Minus className="size-3.5" />
        </Button>
        <button
          type="button"
          className="min-w-12 px-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          onClick={fitToView}
          aria-label="Fit slide to view"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={zoomIn}
          aria-label="Zoom in"
        >
          <Plus className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={resetView}
          aria-label="Reset zoom"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
