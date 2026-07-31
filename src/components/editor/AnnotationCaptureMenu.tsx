import { useState } from 'react'
import { Share, Download, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCanvasAnnotations } from '@/contexts/canvasAnnotationContext'
import {
  captureMarks,
  describeMarks,
  type MarkBounds,
} from '@/lib/annotationCapture'

/**
 * The way marks get out of the scratch layer.
 *
 * Annotations are not saved, on purpose: persisting every stroke turns markup
 * into a record, and people stop scribbling freely once a scribble is
 * permanent. Costing nothing is the point of the layer. So instead of quiet
 * persistence there is one explicit action, and it appears only once there is
 * something to capture — the affordance is also the notice that reloading will
 * lose them.
 */
export function AnnotationCaptureMenu() {
  const { annotations } = useCanvasAnnotations()
  const [busy, setBusy] = useState(false)

  if (annotations.length === 0) return null

  /**
   * Every cell's box, in the same coordinate space the marks use.
   *
   * Read from the DOM at capture time rather than tracked continuously: this
   * runs once, when someone asks for it, and the camera has usually moved
   * several times since the marks were drawn.
   */
  const cellRects = Array.from(
    document.querySelectorAll('[data-blueprint-cell]'),
  ).flatMap((element) => {
    const cellId = element.getAttribute('data-blueprint-cell')
    if (!cellId) return []
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return []
    const bounds: MarkBounds = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    }
    return [{ cellId, bounds }]
  })

  const download = () => {
    setBusy(true)
    try {
      const marks = captureMarks(annotations, cellRects)
      const payload = {
        capturedAt: new Date().toISOString(),
        marks,
        summary: describeMarks(marks),
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `annotations-${payload.capturedAt.slice(0, 19)}.json`
      link.click()
      // Revoked immediately: the click has already handed the blob to the
      // browser, and leaving it alive holds the whole payload in memory.
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  aria-label="Save or send these marks"
                  className="pointer-events-auto size-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                >
                  <Share className="size-3.5" aria-hidden />
                </Button>
              }
            />
          }
        />
        <TooltipContent side="top" className="text-xs">
          Marks are not saved — capture them before reloading
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="center" side="top" className="text-xs">
        <DropdownMenuItem onClick={download}>
          <Download className="size-3.5" aria-hidden />
          Save {annotations.length} mark{annotations.length === 1 ? '' : 's'}
        </DropdownMenuItem>
        {/*
          Disabled rather than hidden, uniquely here: this is the one place the
          agent is worth advertising before it exists, because "send to the
          agent" is what the marks are *for* and knowing it is coming changes
          whether someone bothers to draw them.
        */}
        <DropdownMenuItem disabled>
          <MessageSquare className="size-3.5" aria-hidden />
          Send to the agent — not built yet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
