import { useState } from 'react'
import { Diamond, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CreateSliceDialog } from '@/components/editor/CreateSliceDialog'
import { useCellPick } from '@/contexts/cellPickContext'

/**
 * The Edit tool run.
 *
 * Edit and View own separate tool runs — that is what makes them two modes
 * rather than one mode with a flag. View reads, navigates and marks up; Edit
 * authors. Annotation tools deliberately do not appear here: a pen active
 * while cells are selectable is a click with two meanings, and the mode switch
 * exists precisely so that question has one answer at a time.
 *
 * What used to be here and is not any more, each moved somewhere that knows
 * more than a global bar does:
 *
 * - **Edit cell** → gone. Picking one cell opens the panel, which is what
 *   clicking a cell always did.
 * - **New scenario** → the phase row's `+` in the sidebar, so the phase is
 *   chosen by the row rather than by a picker that can disagree with it.
 * - **New path** → the PATHS header's `+`, scoped to the selected scenario.
 * - **New step / lane / cell** → handles on the grid, because a position
 *   cannot be supplied by a menu.
 *
 * What stays is what acts on the *selection*, which has no home on the canvas:
 * making a slice from it, and clearing it.
 *
 * **Delete path** has now gone too, to the path's own row menu in the sidebar.
 * A destructive button sitting beside "Make slice" is a misclick waiting to
 * happen, and a global one also has to guess which path it means — a row
 * cannot be wrong about that.
 */
export function CanvasDesignTools() {
  const pick = useCellPick()
  const picked = pick?.picked ?? []
  const [sliceDialogOpen, setSliceDialogOpen] = useState(false)

  return (
    <>
      {/*
        The primary action of Edit mode, and the only one that acts on the
        selection — so it is a filled button rather than another ghost icon.
        It briefly lived floating above the picked cells, Figma-style, which
        does not survive contact with this grid: a selection can span lanes and
        steps anywhere on a very wide canvas, so a bar anchored to its bounding
        box lands somewhere unpredictable and often off-screen. A fixed home is
        worth more here than proximity.
      */}
      <Button
        type="button"
        size="sm"
        disabled={picked.length === 0}
        aria-label={
          picked.length === 0
            ? 'Make a slice — pick cells first'
            : `Make a slice from ${picked.length} cells`
        }
        onClick={() => setSliceDialogOpen(true)}
        className="pointer-events-auto h-7 shrink-0 gap-1.5 px-2.5 text-xs"
      >
        <Diamond className="size-3.5" aria-hidden />
        Make slice
        {picked.length > 0 ? (
          <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-semibold tabular-nums">
            {picked.length}
          </span>
        ) : null}
      </Button>

      {/*
        Clearing lives beside the count because that is the question the count
        raises — "how do I start over" — and Escape is invisible.
      */}
      {picked.length > 0 ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Clear the selection"
                onClick={() => pick?.clear()}
                className="pointer-events-auto size-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            }
          />
          <TooltipContent side="top" className="text-xs">
            Clear the selection (Esc)
          </TooltipContent>
        </Tooltip>
      ) : null}

      <CreateSliceDialog
        cellIds={picked}
        open={sliceDialogOpen}
        onOpenChange={setSliceDialogOpen}
        onCreated={() => {
          pick?.clear()
          setSliceDialogOpen(false)
        }}
      />

    </>
  )
}
