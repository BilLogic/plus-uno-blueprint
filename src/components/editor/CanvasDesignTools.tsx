import { useState } from 'react'
import { Diamond, LayoutGrid, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CreateSliceDialog } from '@/components/editor/CreateSliceDialog'
import { CreateBlueprintDialog } from '@/components/editor/CreateBlueprintDialog'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import { useCellPick } from '@/contexts/cellPickContext'
import { buildBlueprintCellSelectionForId } from '@/lib/blueprintCellConnections'
import { cn } from '@/lib/utils'

/**
 * The Design-mode tool run.
 *
 * Creation is a count, not a verb-only button: "New slice (3)" says both what
 * it will do and what it will use, so the selection never has to be counted by
 * eye. With nothing picked it stays visible but inert — the affordance is how
 * you learn that picking cells is the way in.
 */
export function CanvasDesignTools() {
  const pick = useCellPick()
  const detail = useBlueprintCellDetailOptional()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [blueprintDialogOpen, setBlueprintDialogOpen] = useState(false)
  const pickedCellIds = pick?.picked ?? []
  const count = pickedCellIds.length

  /**
   * Open the detail panel on the one picked cell, where Function, Form and
   * Value are edited. Single-cell only: "edit these six cells" has no meaning
   * for fields that describe one cell each.
   */
  const editPickedCell = () => {
    const cellId = pickedCellIds[0]
    if (!detail || cellId === undefined) return
    for (const blueprint of detail.blueprints) {
      // The scenario name is only used for the panel breadcrumb; the panel
      // re-derives its own from context, so an empty one is honest rather
      // than a guess.
      const selection = buildBlueprintCellSelectionForId(blueprint, cellId, '')
      if (selection) {
        detail.selectCell(selection)
        return
      }
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={count === 0}
              aria-label={
                count === 0
                  ? 'New slice — pick cells first'
                  : `New slice from ${count} cells`
              }
              onClick={() => setDialogOpen(true)}
              className={cn(
                'pointer-events-auto h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground',
                count > 0 && 'text-foreground',
              )}
            >
              <Diamond className="size-3.5" aria-hidden />
              New slice
              {count > 0 ? (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {count}
                </span>
              ) : null}
            </Button>
          }
        />
        <TooltipContent side="top" className="text-xs">
          {count === 0
            ? 'Click cells on the canvas, then create a slice from them'
            : `Create a slice from ${count} cell${count === 1 ? '' : 's'}`}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={count !== 1}
              aria-label="Edit cell details"
              onClick={editPickedCell}
              className={cn(
                'pointer-events-auto h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground',
                count === 1 && 'text-foreground',
              )}
            >
              <Pencil className="size-3.5" aria-hidden />
              Edit cell
            </Button>
          }
        />
        <TooltipContent side="top" className="text-xs">
          {count === 1
            ? 'Open this cell to edit its function, form and value'
            : 'Pick a single cell to edit its details'}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="New blueprint"
              onClick={() => setBlueprintDialogOpen(true)}
              className="pointer-events-auto h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <LayoutGrid className="size-3.5" aria-hidden />
              New blueprint
            </Button>
          }
        />
        <TooltipContent side="top" className="text-xs">
          Create an empty blueprint in a phase
        </TooltipContent>
      </Tooltip>

      <CreateSliceDialog
        cellIds={pickedCellIds}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          pick?.clear()
          setDialogOpen(false)
        }}
      />

      <CreateBlueprintDialog
        open={blueprintDialogOpen}
        onOpenChange={setBlueprintDialogOpen}
      />
    </>
  )
}
