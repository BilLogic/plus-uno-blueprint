import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
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
import { useEditor } from '@/contexts/EditorContext'
import { usePathSelectionContext } from '@/contexts/PathSelectionContext'
import { useArchiveAvailable } from '@/hooks/useArchiveAvailable'
import { useScenarioPaths } from '@/hooks/useScenarioPaths'
import { deletionReadiness } from '@/lib/deletionSafety'

/**
 * What is left of the Design tool run.
 *
 * It used to hold five labelled buttons — New slice, Edit cell, New blueprint,
 * New path, Delete path — and it grew one every time a capability shipped,
 * until the mode switch was clipping off the right edge at 800 px. Every one of
 * them has moved somewhere that knows more than a global bar does:
 *
 * - **New slice** → the selection toolbar, floating beside the cells it will
 *   use, so the bar stops changing width as cells are picked.
 * - **Edit cell** → gone. Picking one cell opens the panel, which is what
 *   clicking a cell always did.
 * - **New scenario** → the phase row's `+`, so the phase is chosen by the row
 *   rather than by a picker that can disagree with it.
 * - **New path** → the PATHS header's `+`, scoped to the selected scenario.
 *
 * Delete path is the last one here, and it is on its way to the path's own row
 * menu for the same reason as the rest. It stays for now because that menu does
 * not exist yet, and losing the only delete affordance in the meantime would be
 * a regression rather than a simplification.
 */
export function CanvasDesignTools() {
  const { selectedScenarioId } = useEditor()
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
