import { useMemo, useState, type ReactNode } from 'react'
import { Check, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import { usePathSelectionContext } from '@/hooks/usePathSelection'
import { NavRowAction, NavSection } from '@/components/editor/SidebarNav'
import { CreateVersionDialog } from '@/components/editor/CreateVersionDialog'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useScenarioPaths } from '@/hooks/useScenarioPaths'
import {
  DeleteStructureDialog,
  type DeletionTarget,
} from '@/components/editor/DeleteStructureDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useArchiveAvailable } from '@/hooks/useArchiveAvailable'
import { deletionReadiness } from '@/lib/deletionSafety'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  collectOverviewPathOptions,
  collectOverviewPathOptionsForScenarios,
} from '@/lib/overviewPathFilters'
import { cn } from '@/lib/utils'
import type { PathOption } from '@/components/blueprint/PathMultiSelect'

/**
 * The PATHS disclosure, divider included — the rule that decides whether the
 * section renders lives here, so the divider can never outlive it and leave a
 * line floating under the phase list.
 *
 * Local open state (rather than a `defaultValue`) survives the section
 * hiding and coming back within one mount.
 */
function PathsSection({
  children,
  trailing,
}: {
  children: ReactNode
  trailing?: ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <>
      <Separator className="my-1.5" />
      <NavSection
        title="Paths"
        open={open}
        onOpenChange={setOpen}
        trailing={trailing}
      >
        {children}
      </NavSection>
    </>
  )
}

/**
 * The header `+`, and the dialog behind it.
 *
 * Scoped to the selected scenario, which is the only reason this section is on
 * screen at all — a path belongs to exactly one scenario, so there is nothing
 * to disambiguate and no picker to offer.
 */
function NewPathAction({ scenarioId }: { scenarioId: string }) {
  const { canWrite } = useSupabase()
  const [open, setOpen] = useState(false)
  const paths = useScenarioPaths(canWrite ? scenarioId : null)
  const data = paths.status === 'ready' ? paths.data : null

  if (!canWrite || !data) return null

  return (
    <>
      <NavRowAction label={`New path in ${data.scenarioName}`} onClick={() => setOpen(true)}>
        <Plus className="size-3" aria-hidden />
      </NavRowAction>
      <CreateVersionDialog
        scenarioId={scenarioId}
        scenarioName={data.scenarioName}
        versions={data.versions}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

/**
 * Placeholder for "a scenario is selected but its path catalog has not
 * arrived yet". Distinct from the hidden state on purpose: without it the
 * section pops in mid-read as the canvas finishes loading.
 */
function PathsLoadingRows() {
  return (
    <div className="flex flex-col gap-0.5" aria-hidden>
      <Skeleton className="mx-2 my-1 h-3.5 w-28" />
      <Skeleton className="mx-2 my-1 h-3.5 w-20" />
    </div>
  )
}

/**
 * The per-path menu — rename, duplicate, delete.
 *
 * Delete lives *here*, on the row for the path it destroys, and not in the
 * canvas tool run where it spent a while sitting one pixel from "Make slice".
 * A destructive action beside a constructive one is a misclick waiting to
 * happen, and a global button also has to guess which path it means; a row
 * cannot be wrong about that.
 *
 * Hidden entirely while the recovery archive is missing — `deletionReadiness`
 * is the gate, and a disabled item would only invite someone to look for how
 * to enable it.
 */
function PathRowMenu({
  pathId,
  name,
  scenarioId,
}: {
  pathId: string
  name: string
  scenarioId: string
}) {
  const { canWrite } = useSupabase()
  const archiveAvailable = useArchiveAvailable()
  const [target, setTarget] = useState<DeletionTarget | null>(null)

  if (!canWrite || !deletionReadiness(archiveAvailable).canDelete) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`Actions for ${name}`}
              title={`Actions for ${name}`}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-sm',
                'opacity-0 transition-opacity duration-150',
                'group-hover/path-row:opacity-100 group-focus-within/path-row:opacity-100',
                'text-sidebar-foreground/60 hover:bg-sidebar-hover hover:text-sidebar-accent-foreground',
                'focus-visible:opacity-100 focus-visible:outline-none',
                '[@media(pointer:coarse)]:opacity-100',
              )}
            >
              <MoreHorizontal className="size-3" aria-hidden />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="text-xs">
          <DropdownMenuItem
            variant="destructive"
            onClick={() =>
              setTarget({ kind: 'path', id: pathId, label: name, scenarioId })
            }
          >
            <Trash2 className="size-3.5" aria-hidden />
            Delete path
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteStructureDialog
        target={target}
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
      />
    </>
  )
}

function PathChecklist({
  options,
  scenarioId,
}: {
  options: PathOption[]
  scenarioId?: string
}) {
  const { activePathKeys, togglePathKey } = usePathSelectionContext()

  return (
    <ul className="flex flex-col gap-0.5">
      {options.map((option) => {
        const selected = activePathKeys.includes(option.id)
        return (
          <li
            key={option.id}
            className="group/path-row flex items-center gap-1 rounded-md pr-1 hover:bg-sidebar-hover"
          >
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => togglePathKey(option.id)}
              // The check occupies the same 1rem slot the nav rows give their
              // chevron, so path names line up with phase names.
              className="flex min-w-0 flex-1 items-center gap-1 rounded-md pl-1 text-left text-xs text-sidebar-foreground/85 transition-colors group-hover/path-row:text-sidebar-accent-foreground"
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                <Check
                  className={cn('size-3.5', !selected && 'invisible')}
                  aria-hidden
                />
              </span>
              <span className="min-w-0 flex-1 truncate py-1.5 pr-2">
                {option.name}
              </span>
            </button>
            {scenarioId ? (
              <PathRowMenu
                pathId={option.id}
                name={option.name}
                scenarioId={scenarioId}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Checkmark multi-select of one scenario's paths — one row per path, the
 * Check icon visible only while selected. Wired to the same shared path-key
 * store (`PathSelectionContext`) the removed navbar Paths field used.
 */
function ScenarioPathsChecklist({ scenarioId }: { scenarioId: string }) {
  const { catalog } = usePathSelectionContext()
  const paths = catalog[scenarioId]

  const options = useMemo(
    () =>
      collectOverviewPathOptionsForScenarios(
        new Map(paths ? [[scenarioId, paths]] : []),
        [scenarioId],
      ),
    [paths, scenarioId],
  )

  // The scenario's paths land in the catalog once its canvas loads.
  if (options.length === 0) return <PathsLoadingRows />

  return <PathChecklist options={options} scenarioId={scenarioId} />
}

/**
 * The no-scenario branch. Normally hidden (progressive disclosure), but
 * never while nothing is selected: deselecting every path empties the
 * canvas, and hiding the section there would leave no path control anywhere
 * in the app. In that state the whole known catalog is offered so the user
 * can switch one back on.
 *
 * An *empty* catalog is a different thing — the boot state, before any
 * scenario has loaded its paths. There is nothing to control and no dead
 * end to escape, so the section stays hidden rather than greeting every
 * visitor with an empty Paths header.
 */
function PathsSafetyValve() {
  const { catalog, activePathKeys } = usePathSelectionContext()
  const options = useMemo(
    () => collectOverviewPathOptions(new Map(Object.entries(catalog))),
    [catalog],
  )

  if (activePathKeys.length > 0 || options.length === 0) return null

  return (
    <PathsSection>
      <PathChecklist options={options} />
    </PathsSection>
  )
}

/**
 * Sidebar PATHS section — renders for the base view's selected scenario.
 *
 * Slices deliberately have no path control: a slice is a fixed selection of
 * cells, so there is nothing for a path filter to narrow. The section is
 * mounted inside the Blueprints branch of the sidebar, which is also the only
 * mode that can have a scenario selected.
 */
export function PathsSidebarSection() {
  const { view, selectedScenarioId } = useEditor()

  if (view === 'detail' && selectedScenarioId !== null) {
    return (
      <PathsSection trailing={<NewPathAction scenarioId={selectedScenarioId} />}>
        <ScenarioPathsChecklist scenarioId={selectedScenarioId} />
      </PathsSection>
    )
  }
  return <PathsSafetyValve />
}
