import { useEffect, useRef, useState } from 'react'
import { Diamond } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateSliceDialog } from '@/components/editor/CreateSliceDialog'
import { useCellPick } from '@/contexts/cellPickContext'

/** Gap between the selection's top edge and the bar sitting above it. */
const OFFSET_PX = 10
/** Below this the bar would cover more of the grid than it is worth. */
const MIN_ROOM_ABOVE = 56

type Anchor = { left: number; top: number; flipped: boolean }

/** Module-level so an empty selection is the same array every render. */
const NO_PICKS: readonly string[] = []

/**
 * Actions on a selection, floating beside the selection.
 *
 * This is the pattern that stops the bottom bar growing forever. Figma and
 * Miro both put selection-scoped actions next to the selection rather than in
 * a global bar, and that is why neither of them has a bar that gains a slot
 * every time a feature ships. "New slice" used to sit in the tool run wearing
 * a count badge, which meant the bar changed width as cells were picked.
 *
 * Two or more picks, deliberately. At exactly one the detail panel is the
 * surface — one cell has contents to edit, not a set to act on — and having
 * both appear at once would be two answers to the same click.
 */
export function SelectionToolbar() {
  const pick = useCellPick()
  const picked = pick?.picked ?? NO_PICKS
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const barRef = useRef<HTMLDivElement | null>(null)

  const visible = picked.length >= 2 && !dialogOpen

  // Drop the stale position the moment the bar goes away, during render rather
  // than in the effect — otherwise the next selection paints one frame at the
  // previous one's coordinates before the first measurement lands.
  const [wasVisible, setWasVisible] = useState(visible)
  if (wasVisible !== visible) {
    setWasVisible(visible)
    if (!visible) setAnchor(null)
  }

  /**
   * Track the selection's bounding box on every frame while the bar is up.
   *
   * Measured from the DOM rather than computed from the camera: the cells are
   * inside a `translate3d`/`scale` transform that pans and zooms continuously,
   * and mirroring that maths here would be a second copy of the camera that
   * can drift. `getBoundingClientRect` already accounts for it.
   *
   * A frame loop rather than listeners because there is no one event to hang
   * this on — the camera moves on wheel, drag, keyboard, and its own fit
   * animations. It runs only while two or more cells are picked.
   */
  useEffect(() => {
    if (!visible) return

    let frame = 0
    const measure = () => {
      frame = window.requestAnimationFrame(measure)

      // Measured off the cells' own `data-slice-picked` marker rather than by
      // looking each id up in the DOM. A pick is keyed by the *resolved* cell
      // id while `data-blueprint-cell` carries the raw one, so an id lookup
      // silently matches nothing for any cell where those differ — which is
      // how this first shipped, with the bar stuck off-screen at -9999.
      // The marker is set from `isPicked`, so it cannot disagree with the
      // selection it is describing.
      let left = Infinity
      let right = -Infinity
      let top = Infinity
      let found = false
      for (const element of document.querySelectorAll('[data-slice-picked]')) {
        const rect = element.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        found = true
        left = Math.min(left, rect.left)
        right = Math.max(right, rect.right)
        top = Math.min(top, rect.top)
      }

      if (!found) {
        setAnchor(null)
        return
      }

      // Below the selection when there is no room above — the standard rule,
      // and the reason the bar never covers the cells it describes.
      const flipped = top < MIN_ROOM_ABOVE
      const width = barRef.current?.offsetWidth ?? 0
      const height = barRef.current?.offsetHeight ?? 0
      const next: Anchor = {
        left: Math.round((left + right) / 2 - width / 2),
        top: Math.round(flipped ? top + OFFSET_PX : top - height - OFFSET_PX),
        flipped,
      }
      setAnchor((current) =>
        current &&
        current.left === next.left &&
        current.top === next.top &&
        current.flipped === next.flipped
          ? current
          : next,
      )
    }

    frame = window.requestAnimationFrame(measure)
    return () => window.cancelAnimationFrame(frame)
  }, [picked, visible])

  return (
    <>
      {visible ? (
        <div
          ref={barRef}
          data-selection-toolbar=""
          className="pointer-events-auto fixed z-40 flex items-center gap-0.5 rounded-full border border-border/70 bg-card/95 px-1.5 py-1 shadow-md backdrop-blur-sm"
          style={{
            left: anchor?.left ?? -9999,
            top: anchor?.top ?? -9999,
            // Hidden until the first measurement lands, so it never paints one
            // frame at the top-left corner before jumping into place.
            visibility: anchor ? 'visible' : 'hidden',
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Make a slice from ${picked.length} cells`}
            onClick={() => setDialogOpen(true)}
            className="h-7 shrink-0 gap-1.5 px-2 text-xs text-foreground"
          >
            <Diamond className="size-3.5" aria-hidden />
            Make slice
          </Button>
          <span className="px-1 text-[11px] text-muted-foreground tabular-nums">
            {picked.length}
          </span>
        </div>
      ) : null}

      <CreateSliceDialog
        cellIds={picked}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          pick?.clear()
          setDialogOpen(false)
        }}
      />
    </>
  )
}
