import { useState } from 'react'
import { Diamond } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CreateSliceDialog } from '@/components/editor/CreateSliceDialog'
import { useCellPick } from '@/contexts/cellPickContext'
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const pickedCellIds = pick?.picked ?? []
  const count = pickedCellIds.length

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

      <CreateSliceDialog
        cellIds={pickedCellIds}
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
