import { useMemo, useState } from 'react'
import { Diamond, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CreateSliceSheet } from '@/components/editor/CreateSliceSheet'
import { SessionChangesSheet } from '@/components/editor/SessionChangesSheet'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import { useCellPick } from '@/contexts/cellPickContext'
import { cn } from '@/lib/utils'

/** Module-level so an empty selection is the same array on every render. */
const NO_PICKS: readonly string[] = []

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
  const detail = useBlueprintCellDetailOptional()
  const picked = pick?.picked ?? NO_PICKS
  const [sliceDialogOpen, setSliceDialogOpen] = useState(false)
  // Armed: clicked with nothing picked. The button becomes the instruction
  // rather than sitting greyed out — "pick cells first" is advice you can only
  // read once you have already guessed that cells are pickable.
  const [armed, setArmed] = useState(false)

  /**
   * How many blueprints the selection spans.
   *
   * Worth saying out loud because the Hand tool made crossing the canvas easy,
   * so cells picked two blueprints away are now ordinary rather than odd — and
   * without this the bar reads "3" while two of them are somewhere the user
   * cannot see.
   */
  const spannedPaths = useMemo(() => {
    if (!detail || picked.length === 0) return 0
    const paths = new Set<string>()
    for (const blueprint of detail.blueprints) {
      if (blueprint.cells.some((cell) => picked.includes(cell.id))) {
        paths.add(blueprint.path.id)
      }
    }
    return paths.size
  }, [detail, picked])

  // Picking something disarms: the instruction has been followed.
  const [lastCount, setLastCount] = useState(picked.length)
  if (lastCount !== picked.length) {
    setLastCount(picked.length)
    if (picked.length > 0 && armed) setArmed(false)
  }

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
      <CreateSliceSheet
        cellIds={picked}
        open={sliceDialogOpen}
        onOpenChange={setSliceDialogOpen}
        onCreated={() => {
          pick?.clear()
          setSliceDialogOpen(false)
        }}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={
              picked.length === 0
                ? 'Make a slice — click cells to add them'
                : `Make a slice from ${picked.length} cells`
            }
            onClick={(event) => {
              // With nothing picked the button teaches instead of opening: a
              // sheet listing no cells answers a question nobody asked.
              if (picked.length === 0) {
                event.preventDefault()
                setArmed(true)
              }
            }}
            // Never a filled button. Nothing in this bar is a page's primary
            // action — it is a tool bar, and a solid brand pill in it reads
            // as "press me" from the moment the canvas loads, long before
            // there is anything to press it about. Weight arrives with the
            // selection instead: ghost at rest, tinted and bordered once
            // cells are picked, which is also when it starts doing anything.
            className={cn(
              'pointer-events-auto h-7 shrink-0 gap-1.5 px-2.5 text-xs',
              picked.length > 0
                ? 'border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Diamond className="size-3.5" aria-hidden />
            {armed && picked.length === 0
              ? 'Click cells to add them'
              : 'Make slice'}
            {picked.length > 0 ? (
              <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold tabular-nums">
                {spannedPaths > 1
                  ? `${picked.length} · ${spannedPaths} blueprints`
                  : picked.length}
              </span>
            ) : null}
          </Button>
        }
      />

      {/*
        Clearing lives beside the count because that is the question the count
        raises — "how do I start over" — and Escape is invisible.

        It is also now the *only* way to clear. Clicking empty canvas used to,
        and a selection gathered across several blueprints is far too expensive
        to lose to a miss between two cells. One deliberate target, aimed at.
      */}
      {picked.length > 0 || armed ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={armed && picked.length === 0 ? 'Cancel' : 'Clear the selection'}
                onClick={() => {
                  setArmed(false)
                  pick?.clear()
                }}
                className="pointer-events-auto size-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            }
          />
          <TooltipContent side="top" className="text-xs">
            Clear the selection — the only thing that does (Esc)
          </TooltipContent>
        </Tooltip>
      ) : null}

      <SessionChangesSheet />
    </>
  )
}
