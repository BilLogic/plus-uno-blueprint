import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCanvasZoomChrome } from '@/contexts/CanvasZoomChromeContext'
import { cn } from '@/lib/utils'

type EditorZoomIndicatorProps = {
  /** Exit canvas focus and reframe the full overview. */
  onResetView: () => void
  className?: string
}

/** Current canvas zoom with a reset control; pointer-transparent except the button. */
export function EditorZoomIndicator({
  onResetView,
  className,
}: EditorZoomIndicatorProps) {
  return (
    <div
      data-zoom-indicator=""
      className={cn('pointer-events-none flex items-center', className)}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Reset view"
        title="Reset view"
        onClick={onResetView}
        className="pointer-events-auto h-5 shrink-0 gap-1 px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="size-3" aria-hidden />
        Reset View
      </Button>
    </div>
  )
}

/** Renders Reset View in the canvas navbar when focus mode is active. */
export function NavbarZoomIndicator({ className }: { className?: string }) {
  const ctx = useCanvasZoomChrome()
  if (!ctx?.chrome?.onResetView) return null

  return (
    <EditorZoomIndicator
      onResetView={ctx.chrome.onResetView}
      className={className}
    />
  )
}
