import { useMemo, useState } from 'react'
import { Diamond, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DeleteStructureDialog,
  type DeletionTarget,
} from '@/components/editor/DeleteStructureDialog'
import { CreateSliceDialog } from '@/components/editor/CreateSliceDialog'
import { useCellPick } from '@/contexts/cellPickContext'
import { useEditor } from '@/contexts/EditorContext'
import { usePathSelectionContext } from '@/contexts/PathSelectionContext'
import { useArchiveAvailable } from '@/hooks/useArchiveAvailable'
import { useScenarioPaths } from '@/hooks/useScenarioPaths'
import { deletionReadiness } from '@/lib/deletionSafety'

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
 * Delete path is the last stray, on its way to the path's own row menu. It
 * stays until that menu exists, because losing the only delete affordance in
 * the meantime would be a regression rather than a simplification.
 */
export function CanvasDesignTools() {
  const { selectedScenarioId } = useEditor()
  const pick = useCellPick()
  const picked = pick?.picked ?? []
  const [sliceDialogOpen, setSliceDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeletionTarget | null>(null)
  const scenarioPaths = useScenarioPaths(selectedScenarioId)
  const pathData = scenarioPaths.status === 'ready' ? scenarioPaths.data : null
  const { getSelectedPathIds } = usePathSelectionContext()
  const archiveAvailable = useArchiveAvailable()

  /**
   * The path a delete would act on, or null if there is no safe one.
   *
   * Null hides the affordance entirely rather than disabling it — a disabled
   * delete invites someone to go looking for how to enable it, and while the
   * recovery archive is missing there is no safe way to. `deletionReadiness`
   * is the gate, not a comment.
   *
   * One selected path only. "Delete these two" is a different confirm with a
   * different cascade behind it, and running this one twice is not it.
   */
  const deletablePath = useMemo(() => {
    if (!deletionReadiness(archiveAvailable).canDelete) return null
    if (!selectedScenarioId || !pathData) return null
    const selected = getSelectedPathIds(selectedScenarioId)
    if (selected.length !== 1) return null
    return pathData.versions.find((entry) => entry.pathId === selected[0]) ?? null
  }, [archiveAvailable, getSelectedPathIds, pathData, selectedScenarioId])

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

      {deletablePath ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Delete path ${deletablePath.name}`}
                onClick={() =>
                  setDeleteTarget({
                    kind: 'path',
                    id: deletablePath.pathId,
                    label: deletablePath.name,
                    scenarioId: selectedScenarioId ?? undefined,
                  })
                }
                className="pointer-events-auto h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete path
              </Button>
            }
          />
          <TooltipContent side="top" className="text-xs">
            Delete “{deletablePath.name}” and everything on it
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

      <DeleteStructureDialog
        target={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
    </>
  )
}
