import { useCallback, useMemo, useState } from 'react'
import { Copy, Diamond, LayoutGrid, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CreateSliceDialog } from '@/components/editor/CreateSliceDialog'
import { CreateBlueprintDialog } from '@/components/editor/CreateBlueprintDialog'
import {
  CreateVersionDialog,
  type ExistingVersion,
} from '@/components/editor/CreateVersionDialog'
import {
  DeleteStructureDialog,
  type DeletionTarget,
} from '@/components/editor/DeleteStructureDialog'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import { useCellPick } from '@/contexts/cellPickContext'
import { useEditor } from '@/contexts/EditorContext'
import { usePathSelectionContext } from '@/contexts/PathSelectionContext'
import { useArchiveAvailable } from '@/hooks/useArchiveAvailable'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { buildBlueprintCellSelectionForId } from '@/lib/blueprintCellConnections'
import { deletionReadiness } from '@/lib/deletionSafety'
import { cn } from '@/lib/utils'

type ScenarioVersions = { scenarioName: string; versions: ExistingVersion[] }

/**
 * The versions of one blueprint, and its name.
 *
 * Read here rather than taken from the canvas: the canvas only holds the
 * versions currently *selected* for display, and a new version has to be
 * named against all of them or the uniqueness check would pass on a name
 * that is already taken by a version nobody is looking at.
 */
function useScenarioVersions(scenarioId: string | null) {
  const fallback = useCallback((): ScenarioVersions | null => null, [])
  return useSupabaseQuery<ScenarioVersions>(
    scenarioId ? `scenario-versions:${scenarioId}` : null,
    async (client) => {
      const { data, error } = await client
        .from('paths')
        .select('id,name,service_scenario:service_scenarios(name)')
        .eq('service_scenario_id', scenarioId ?? '')
        .order('name')
      if (error) throw new Error(error.message)
      const rows = data ?? []
      const scenario = rows[0]?.service_scenario as { name?: string } | null
      return {
        scenarioName: scenario?.name ?? 'this blueprint',
        versions: rows.map((row) => ({
          pathId: row.id as string,
          name: row.name as string,
        })),
      }
    },
    fallback,
  )
}

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
  const { selectedScenarioId } = useEditor()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [blueprintDialogOpen, setBlueprintDialogOpen] = useState(false)
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeletionTarget | null>(null)
  const scenarioVersions = useScenarioVersions(selectedScenarioId)
  const versionData =
    scenarioVersions.status === 'ready' ? scenarioVersions.data : null
  const { getSelectedPathIds } = usePathSelectionContext()
  const archiveAvailable = useArchiveAvailable()
  const pickedCellIds = pick?.picked ?? []
  const count = pickedCellIds.length

  /**
   * The version a delete would act on, or null if there is no safe one.
   *
   * Null hides the affordance entirely rather than disabling it — a disabled
   * delete invites someone to go looking for how to enable it, and while the
   * recovery archive is missing there is no safe way to. `deletionReadiness`
   * is the gate, not a comment: a database without `deleted_structure` cannot
   * put back what it removes.
   *
   * One selected version only. "Delete these two" is a different confirm with
   * a different cascade behind it, and running this one twice is not it.
   */
  const deletableVersion = useMemo(() => {
    if (!deletionReadiness(archiveAvailable).canDelete) return null
    if (!selectedScenarioId || !versionData) return null
    const selected = getSelectedPathIds(selectedScenarioId)
    if (selected.length !== 1) return null
    return (
      versionData.versions.find((entry) => entry.pathId === selected[0]) ?? null
    )
  }, [archiveAvailable, getSelectedPathIds, selectedScenarioId, versionData])

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

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              // A version belongs to one blueprint, so there is nothing to
              // name it against until one is selected.
              disabled={versionData === null}
              aria-label="New version"
              onClick={() => setVersionDialogOpen(true)}
              className={cn(
                'pointer-events-auto h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground',
                versionData !== null && 'text-foreground',
              )}
            >
              <Copy className="size-3.5" aria-hidden />
              New version
            </Button>
          }
        />
        <TooltipContent side="top" className="text-xs">
          {versionData === null
            ? 'Select a blueprint first — versions belong to one'
            : `Add a version of ${versionData.scenarioName}`}
        </TooltipContent>
      </Tooltip>

      {deletableVersion ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Delete version ${deletableVersion.name}`}
                onClick={() =>
                  setDeleteTarget({
                    kind: 'path',
                    id: deletableVersion.pathId,
                    label: deletableVersion.name,
                    scenarioId: selectedScenarioId ?? undefined,
                  })
                }
                className="pointer-events-auto h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete version
              </Button>
            }
          />
          <TooltipContent side="top" className="text-xs">
            Delete “{deletableVersion.name}” and everything on it
          </TooltipContent>
        </Tooltip>
      ) : null}

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

      {selectedScenarioId && versionData ? (
        <CreateVersionDialog
          scenarioId={selectedScenarioId}
          scenarioName={versionData.scenarioName}
          versions={versionData.versions}
          open={versionDialogOpen}
          onOpenChange={setVersionDialogOpen}
        />
      ) : null}

      <DeleteStructureDialog
        target={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null)
        }}
      />
    </>
  )
}
